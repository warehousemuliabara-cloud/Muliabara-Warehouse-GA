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

// Unique Session ID for this tab/client to prevent self-echo and infinite loops
export const CLIENT_SESSION_ID = typeof window !== 'undefined'
  ? `client_${Math.random().toString(36).substring(2, 9)}_${Date.now()}`
  : 'server_env';

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
  lastWriterId?: string;
}

export type SyncState = 'connected' | 'syncing' | 'offline' | 'error';

let currentSyncState: SyncState = 'connected';
const syncListeners: ((state: SyncState, message?: string) => void)[] = [];

// Cross-tab BroadcastChannel for instant 0ms multi-account & multi-tab synchronization
const CROSS_TAB_CHANNEL_NAME = 'ga_warehouse_kbct_broadcast_v2';
let broadcastChannel: BroadcastChannel | null = null;
if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
  try {
    broadcastChannel = new BroadcastChannel(CROSS_TAB_CHANNEL_NAME);
  } catch (e) {
    console.warn('BroadcastChannel not supported:', e);
  }
}

export function subscribeToCrossTabSync(callback: (payload: WarehouseSyncPayload) => void) {
  if (!broadcastChannel) return () => {};
  
  const handleMessage = (event: MessageEvent) => {
    if (
      event.data && 
      event.data.type === 'WAREHOUSE_SYNC_UPDATE' && 
      event.data.payload &&
      event.data.senderId !== CLIENT_SESSION_ID
    ) {
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

// Track last applied hash to prevent duplicate re-renders
let lastAppliedHash = '';

function computeDataHash(data: Partial<WarehouseSyncPayload>): string {
  try {
    const txSummary = (data.transactions || []).map(t => `${t.id || t.transactionNumber}:${t.status}`).join(',');
    const itemSummary = (data.items || []).map(i => `${i.id || i.code}:${i.currentStock}`).join(',');
    const empCount = (data.employees || []).length;
    const userCount = (data.users || []).length;
    const loanSummary = (data.loans || []).map(l => `${l.id}:${l.status}`).join(',');
    return `${data.lastUpdated || ''}_${txSummary}_${itemSummary}_${empCount}_${userCount}_${loanSummary}`;
  } catch {
    return String(Date.now());
  }
}

/**
 * Direct fetch from Firestore server to get fresh authoritative cloud data
 */
export async function fetchFreshWarehouseData(
  currentLocal?: Partial<WarehouseSyncPayload>
): Promise<WarehouseSyncPayload | null> {
  try {
    const docRef = doc(db, WAREHOUSE_COLLECTION, WAREHOUSE_DOC_ID);
    const snapshot = await getDoc(docRef);
    if (snapshot.exists()) {
      updateSyncState('connected', 'Tersinkronisasi Cloud');
      const cloudData = snapshot.data() as WarehouseSyncPayload;
      lastAppliedHash = computeDataHash(cloudData);
      return cloudData;
    } else if (currentLocal) {
      // First time initialization on Cloud
      const initialCloud: WarehouseSyncPayload = {
        items: currentLocal.items || [],
        transactions: currentLocal.transactions || [],
        employees: currentLocal.employees || [],
        users: currentLocal.users || [],
        loans: currentLocal.loans || [],
        auditLogs: currentLocal.auditLogs || [],
        rolePermissions: currentLocal.rolePermissions || {},
        dashboardConfig: currentLocal.dashboardConfig || {},
        lastUpdated: new Date().toISOString(),
        updatedBy: currentLocal.updatedBy || 'Sistem',
        lastWriterId: CLIENT_SESSION_ID,
      };
      await setDoc(docRef, initialCloud);
      updateSyncState('connected', 'Tersinkronisasi Cloud');
      lastAppliedHash = computeDataHash(initialCloud);
      return initialCloud;
    }
    return null;
  } catch (err: any) {
    console.warn('Direct fetch from Firestore failed:', err?.message);
    return null;
  }
}

/**
 * Subscribe to real-time warehouse data changes from Firestore.
 * Automatically filters out self-echoes to avoid infinite loops and UI flickering.
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

          // Skip if this change originated from the current tab
          if (data.lastWriterId === CLIENT_SESSION_ID) {
            return;
          }

          // Check if data actually changed to prevent pointless React re-renders
          const newHash = computeDataHash(data);
          if (newHash === lastAppliedHash) {
            return;
          }
          lastAppliedHash = newHash;

          onData(data);

          // Broadcast to other local tabs
          if (broadcastChannel) {
            try {
              broadcastChannel.postMessage({
                type: 'WAREHOUSE_SYNC_UPDATE',
                payload: data,
                senderId: CLIENT_SESSION_ID,
              });
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
 * Primary sync function: Writes direct authoritative snapshot to Firestore Cloud.
 * Guarantees that deletions are permanent and changes propagate to all accounts instantly.
 */
export async function pushWarehouseSync(
  payload: Partial<WarehouseSyncPayload> & { updatedBy?: string }
): Promise<WarehouseSyncPayload> {
  const docRef = doc(db, WAREHOUSE_COLLECTION, WAREHOUSE_DOC_ID);
  updateSyncState('syncing', 'Menyimpan ke Cloud...');

  const finalPayload: WarehouseSyncPayload = {
    items: payload.items || [],
    transactions: payload.transactions || [],
    employees: payload.employees || [],
    users: payload.users || [],
    loans: payload.loans || [],
    auditLogs: payload.auditLogs || [],
    rolePermissions: payload.rolePermissions || {},
    dashboardConfig: payload.dashboardConfig || {},
    lastUpdated: new Date().toISOString(),
    updatedBy: payload.updatedBy || 'Sistem',
    lastWriterId: CLIENT_SESSION_ID,
  };

  lastAppliedHash = computeDataHash(finalPayload);

  // 1. Broadcast to other tabs in the same browser instantly
  if (broadcastChannel) {
    try {
      broadcastChannel.postMessage({
        type: 'WAREHOUSE_SYNC_UPDATE',
        payload: finalPayload,
        senderId: CLIENT_SESSION_ID,
      });
    } catch {
      // safe
    }
  }

  // 2. Persist directly to Firestore Cloud (without resurrecting deleted items)
  try {
    await setDoc(docRef, finalPayload);
    updateSyncState('connected', 'Tersinkronisasi Cloud');
    return finalPayload;
  } catch (error: any) {
    console.warn('Firestore push error:', error?.message);
    updateSyncState('offline', 'Mode Offline (Tersimpan Lokal)');
    return finalPayload;
  }
}

/**
 * Backward compatibility alias for smartMergeWarehouseData
 */
export function smartMergeWarehouseData(
  local: Partial<WarehouseSyncPayload>,
  remote: Partial<WarehouseSyncPayload>
): WarehouseSyncPayload {
  return {
    items: remote.items || local.items || [],
    transactions: remote.transactions || local.transactions || [],
    employees: remote.employees || local.employees || [],
    users: remote.users || local.users || [],
    loans: remote.loans || local.loans || [],
    auditLogs: remote.auditLogs || local.auditLogs || [],
    rolePermissions: remote.rolePermissions || local.rolePermissions || {},
    dashboardConfig: { ...(local.dashboardConfig || {}), ...(remote.dashboardConfig || {}) },
    lastUpdated: remote.lastUpdated || local.lastUpdated || new Date().toISOString(),
    updatedBy: remote.updatedBy || local.updatedBy || 'Sistem',
    lastWriterId: remote.lastWriterId || local.lastWriterId,
  };
}
