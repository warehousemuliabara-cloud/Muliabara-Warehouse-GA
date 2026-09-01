import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  initializeFirestore,
  getFirestore, 
  doc, 
  setDoc, 
  getDoc,
  onSnapshot,
  setLogLevel,
  persistentLocalCache,
  persistentMultipleTabManager
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

// Configure log level to suppress benign connection polling notices
try {
  setLogLevel('error');
} catch {
  // Ignore in case environment restricts logLevel
}

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const dbId = (firebaseConfig as any).firestoreDatabaseId;

// Initialize Firestore with auto-detect long polling and multi-tab persistent cache
let firestoreInstance: ReturnType<typeof getFirestore>;
try {
  firestoreInstance = initializeFirestore(
    app,
    {
      experimentalAutoDetectLongPolling: true,
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      }),
    },
    dbId || undefined
  );
} catch {
  firestoreInstance = dbId ? getFirestore(app, dbId) : getFirestore(app);
}

export const db = firestoreInstance;

// Global Warehouse Collection & Document constants
export const WAREHOUSE_DOC_ID = 'warehouse_kbct_main';
export const WAREHOUSE_COLLECTION = 'warehouses';

export interface WarehouseSyncPayload {
  items: any[];
  transactions: any[];
  employees: any[];
  users: any[];
  loans: any[];
  auditLogs: any[];
  rolePermissions: any;
  dashboardConfig: any;
  lastUpdated: string;
  updatedBy: string;
}

export type SyncState = 'connected' | 'syncing' | 'offline' | 'error';

let currentSyncState: SyncState = 'connected';
const syncListeners: ((state: SyncState, message?: string) => void)[] = [];

// Cross-tab BroadcastChannel for instant 0ms multi-account & multi-tab synchronization
const CROSS_TAB_CHANNEL_NAME = 'ga_warehouse_kbct_broadcast_v1';
let broadcastChannel: BroadcastChannel | null = null;
if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
  try {
    broadcastChannel = new BroadcastChannel(CROSS_TAB_CHANNEL_NAME);
  } catch (e) {
    console.warn('BroadcastChannel not supported:', e);
  }
}

export function subscribeToCrossTabSync(callback: (payload: Partial<WarehouseSyncPayload>) => void) {
  if (!broadcastChannel) return () => {};
  
  const handleMessage = (event: MessageEvent) => {
    if (event.data && event.data.type === 'WAREHOUSE_SYNC_UPDATE' && event.data.payload) {
      callback(event.data.payload);
    }
  };

  broadcastChannel.addEventListener('message', handleMessage);
  return () => {
    broadcastChannel?.removeEventListener('message', handleMessage);
  };
}

export function onSyncStatusChange(callback: (state: SyncState, message?: string) => void) {
  syncListeners.push(callback);
  callback(currentSyncState);
  return () => {
    const idx = syncListeners.indexOf(callback);
    if (idx !== -1) syncListeners.splice(idx, 1);
  };
}

function updateSyncState(state: SyncState, message?: string) {
  currentSyncState = state;
  syncListeners.forEach(listener => {
    try {
      listener(state, message);
    } catch {
      // Ignore listener error
    }
  });
}

/**
 * Direct fetch from Firestore server to get fresh data immediately
 */
export async function fetchFreshWarehouseData(): Promise<WarehouseSyncPayload | null> {
  try {
    const docRef = doc(db, WAREHOUSE_COLLECTION, WAREHOUSE_DOC_ID);
    const snapshot = await getDoc(docRef);
    if (snapshot.exists()) {
      updateSyncState('connected', 'Tersinkronisasi Cloud');
      const data = snapshot.data() as WarehouseSyncPayload;
      // Broadcast to other tabs as well
      if (broadcastChannel) {
        broadcastChannel.postMessage({ type: 'WAREHOUSE_SYNC_UPDATE', payload: data });
      }
      return data;
    }
    return null;
  } catch (err: any) {
    console.warn('Direct fetch from Firestore failed:', err?.message);
    return null;
  }
}

/**
 * Subscribe to real-time warehouse data changes from Firestore
 */
export function subscribeToWarehouseData(
  onData: (data: WarehouseSyncPayload) => void,
  onError?: (err: any) => void
) {
  try {
    const docRef = doc(db, WAREHOUSE_COLLECTION, WAREHOUSE_DOC_ID);
    return onSnapshot(
      docRef,
      (snapshot) => {
        if (snapshot.exists()) {
          updateSyncState('connected', 'Tersinkronisasi Cloud');
          const data = snapshot.data() as WarehouseSyncPayload;
          onData(data);
          // Broadcast to any other open tabs in the same browser
          if (broadcastChannel) {
            try {
              broadcastChannel.postMessage({ type: 'WAREHOUSE_SYNC_UPDATE', payload: data });
            } catch {
              // safe
            }
          }
        } else {
          updateSyncState('connected', 'Tersinkronisasi Cloud');
        }
      },
      (error) => {
        const isOffline = error?.code === 'unavailable' || error?.message?.includes('offline');
        if (isOffline) {
          updateSyncState('offline', 'Mode Offline (Tersimpan Lokal)');
        } else {
          updateSyncState('error', error?.message || 'Sinkronisasi tertunda');
        }
        if (onError) onError(error);
      }
    );
  } catch (err: any) {
    updateSyncState('offline', 'Mode Offline (Tersimpan Lokal)');
    if (onError) onError(err);
    return () => {};
  }
}

/**
 * Push full updated warehouse snapshot to Firestore and broadcast immediately
 */
export async function pushWarehouseSync(
  payload: Partial<WarehouseSyncPayload> & { updatedBy: string }
): Promise<boolean> {
  try {
    updateSyncState('syncing', 'Menyimpan ke Cloud...');
    const docRef = doc(db, WAREHOUSE_COLLECTION, WAREHOUSE_DOC_ID);
    const dataToSave = {
      ...payload,
      lastUpdated: new Date().toISOString(),
    };

    // 1. Broadcast locally first for instant zero-latency UI update across tabs/accounts
    if (broadcastChannel) {
      try {
        broadcastChannel.postMessage({ type: 'WAREHOUSE_SYNC_UPDATE', payload: dataToSave });
      } catch {
        // safe
      }
    }

    // 2. Persist to Firestore Cloud
    await setDoc(docRef, dataToSave, { merge: true });
    updateSyncState('connected', 'Tersinkronisasi Cloud');
    return true;
  } catch (error: any) {
    console.warn('pushWarehouseSync error:', error);
    const isOffline = error?.code === 'unavailable' || error?.message?.includes('offline');
    if (isOffline) {
      updateSyncState('offline', 'Mode Offline (Tersimpan Lokal)');
    } else {
      updateSyncState('error', error?.message || 'Gagal sinkron ke Cloud');
    }
    return false;
  }
}

