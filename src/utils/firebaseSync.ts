import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getFirestore, 
  doc, 
  setDoc, 
  onSnapshot
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const dbId = (firebaseConfig as any).firestoreDatabaseId;
export const db = dbId ? getFirestore(app, dbId) : getFirestore(app);

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
          onData(snapshot.data() as WarehouseSyncPayload);
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
 * Push full updated warehouse snapshot to Firestore
 */
export async function pushWarehouseSync(
  payload: Partial<WarehouseSyncPayload> & { updatedBy: string }
): Promise<void> {
  try {
    updateSyncState('syncing', 'Menyimpan ke Cloud...');
    const docRef = doc(db, WAREHOUSE_COLLECTION, WAREHOUSE_DOC_ID);
    const dataToSave = {
      ...payload,
      lastUpdated: new Date().toISOString(),
    };
    await setDoc(docRef, dataToSave, { merge: true });
    updateSyncState('connected', 'Tersinkronisasi Cloud');
  } catch (error: any) {
    const isOffline = error?.code === 'unavailable' || error?.message?.includes('offline');
    if (isOffline) {
      updateSyncState('offline', 'Mode Offline (Tersimpan Lokal)');
    } else {
      updateSyncState('error', error?.message || 'Gagal sinkron ke Cloud');
    }
    // Do not throw to avoid crashing callers; local storage already holds latest state
  }
}
