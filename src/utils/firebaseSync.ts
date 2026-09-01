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

export function smartMergeWarehouseData(
  local: Partial<WarehouseSyncPayload>,
  remote: Partial<WarehouseSyncPayload>
): WarehouseSyncPayload {
  // 1. Transactions merge
  const txMap = new Map<string, any>();

  // Add remote transactions first
  if (Array.isArray(remote.transactions)) {
    remote.transactions.forEach((tx) => {
      if (tx && (tx.id || tx.transactionNumber)) {
        const key = tx.id || tx.transactionNumber;
        txMap.set(key, tx);
      }
    });
  }

  // Merge with local transactions (never lose local transactions that are not on cloud yet)
  if (Array.isArray(local.transactions)) {
    local.transactions.forEach((localTx) => {
      if (!localTx) return;
      const key = localTx.id || localTx.transactionNumber;
      if (!key) return;

      const remoteTx = txMap.get(key);
      if (!remoteTx) {
        // Local has a transaction that remote doesn't -> Keep local!
        txMap.set(key, localTx);
      } else {
        // Both have this transaction -> pick the most updated status
        const statusWeight: Record<string, number> = {
          COMPLETED: 4,
          REJECTED: 3,
          APPROVED: 2,
          PENDING: 1,
        };
        const localWeight = statusWeight[localTx.status] || 0;
        const remoteWeight = statusWeight[remoteTx.status] || 0;

        if (localWeight > remoteWeight) {
          txMap.set(key, { ...remoteTx, ...localTx });
        } else if (remoteWeight > localWeight) {
          txMap.set(key, { ...localTx, ...remoteTx });
        } else {
          // If equal status, prefer newer timestamp
          const localTime = new Date(localTx.timestamp || localTx.date || 0).getTime();
          const remoteTime = new Date(remoteTx.timestamp || remoteTx.date || 0).getTime();
          txMap.set(key, localTime >= remoteTime ? localTx : remoteTx);
        }
      }
    });
  }

  const mergedTransactions = Array.from(txMap.values()).sort((a, b) => {
    const timeA = new Date(a.timestamp || a.date || 0).getTime();
    const timeB = new Date(b.timestamp || b.date || 0).getTime();
    return timeB - timeA;
  });

  // 2. Items merge (by ID or code)
  const itemMap = new Map<string, any>();
  if (Array.isArray(remote.items)) {
    remote.items.forEach((item) => {
      if (item && (item.id || item.code)) {
        itemMap.set(item.id || item.code, item);
      }
    });
  }
  if (Array.isArray(local.items)) {
    local.items.forEach((localItem) => {
      if (!localItem) return;
      const key = localItem.id || localItem.code;
      if (!key) return;
      const remoteItem = itemMap.get(key);
      if (!remoteItem) {
        itemMap.set(key, localItem);
      } else {
        const localTime = new Date(localItem.updatedAt || 0).getTime();
        const remoteTime = new Date(remoteItem.updatedAt || 0).getTime();
        itemMap.set(key, localTime >= remoteTime ? localItem : remoteItem);
      }
    });
  }
  const mergedItems = Array.from(itemMap.values());

  // 3. Employees merge
  const empMap = new Map<string, any>();
  if (Array.isArray(remote.employees)) {
    remote.employees.forEach((emp) => {
      if (emp && (emp.id || emp.name)) empMap.set(emp.id || emp.name, emp);
    });
  }
  if (Array.isArray(local.employees)) {
    local.employees.forEach((emp) => {
      if (emp && (emp.id || emp.name)) empMap.set(emp.id || emp.name, emp);
    });
  }
  const mergedEmployees = Array.from(empMap.values());

  // 4. Users merge
  const userMap = new Map<string, any>();
  if (Array.isArray(remote.users)) {
    remote.users.forEach((u) => {
      if (u && (u.id || u.username)) userMap.set(u.id || u.username, u);
    });
  }
  if (Array.isArray(local.users)) {
    local.users.forEach((u) => {
      if (u && (u.id || u.username)) userMap.set(u.id || u.username, u);
    });
  }
  const mergedUsers = Array.from(userMap.values());

  // 5. Loans merge
  const loanMap = new Map<string, any>();
  if (Array.isArray(remote.loans)) {
    remote.loans.forEach((l) => {
      if (l && l.id) loanMap.set(l.id, l);
    });
  }
  if (Array.isArray(local.loans)) {
    local.loans.forEach((l) => {
      if (!l || !l.id) return;
      const remoteLoan = loanMap.get(l.id);
      if (!remoteLoan) {
        loanMap.set(l.id, l);
      } else {
        if (l.status === 'RETURNED' || remoteLoan.status !== 'RETURNED') {
          loanMap.set(l.id, l);
        }
      }
    });
  }
  const mergedLoans = Array.from(loanMap.values());

  // 6. Audit logs merge
  const logMap = new Map<string, any>();
  if (Array.isArray(remote.auditLogs)) {
    remote.auditLogs.forEach((log) => {
      if (log && log.id) logMap.set(log.id, log);
    });
  }
  if (Array.isArray(local.auditLogs)) {
    local.auditLogs.forEach((log) => {
      if (log && log.id) logMap.set(log.id, log);
    });
  }
  const mergedAuditLogs = Array.from(logMap.values())
    .sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime())
    .slice(0, 500);

  // 7. Role permissions & Dashboard config
  const mergedRolePermissions = remote.rolePermissions || local.rolePermissions || {};
  const mergedDashboardConfig = {
    ...(local.dashboardConfig || {}),
    ...(remote.dashboardConfig || {}),
  };

  return {
    items: mergedItems,
    transactions: mergedTransactions,
    employees: mergedEmployees,
    users: mergedUsers,
    loans: mergedLoans,
    auditLogs: mergedAuditLogs,
    rolePermissions: mergedRolePermissions,
    dashboardConfig: mergedDashboardConfig,
    lastUpdated: new Date().toISOString(),
    updatedBy: remote.updatedBy || local.updatedBy || 'Sistem',
  };
}

/**
 * Direct fetch from Firestore server to get fresh data immediately with smart merge protection
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
      
      const merged = currentLocal ? smartMergeWarehouseData(currentLocal, cloudData) : cloudData;

      // If local has items/transactions that are not yet on cloud, write merged state back to cloud immediately
      if (currentLocal && currentLocal.transactions && currentLocal.transactions.length > (cloudData.transactions?.length || 0)) {
        setDoc(docRef, merged, { merge: true }).catch(console.warn);
      }

      if (broadcastChannel) {
        broadcastChannel.postMessage({ type: 'WAREHOUSE_SYNC_UPDATE', payload: merged });
      }
      return merged;
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
      };
      await setDoc(docRef, initialCloud, { merge: true });
      updateSyncState('connected', 'Tersinkronisasi Cloud');
      return initialCloud;
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
 * Push full updated warehouse snapshot to Firestore with smart-merge protection
 */
export async function pushWarehouseSync(
  payload: Partial<WarehouseSyncPayload> & { updatedBy: string }
): Promise<WarehouseSyncPayload> {
  const docRef = doc(db, WAREHOUSE_COLLECTION, WAREHOUSE_DOC_ID);
  updateSyncState('syncing', 'Menyimpan ke Cloud...');

  // 1. Broadcast locally first for instant zero-latency UI update across tabs/accounts
  if (broadcastChannel) {
    try {
      broadcastChannel.postMessage({ type: 'WAREHOUSE_SYNC_UPDATE', payload });
    } catch {
      // safe
    }
  }

  // 2. Fetch existing cloud doc to smart merge before saving
  let finalPayload: WarehouseSyncPayload;
  try {
    const currentSnap = await getDoc(docRef);
    if (currentSnap.exists()) {
      const cloudData = currentSnap.data() as WarehouseSyncPayload;
      finalPayload = smartMergeWarehouseData(payload, cloudData);
    } else {
      finalPayload = {
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
      };
    }

    // 3. Persist to Firestore Cloud
    await setDoc(docRef, finalPayload, { merge: true });
    updateSyncState('connected', 'Tersinkronisasi Cloud');

    // 4. Re-broadcast the confirmed merged payload
    if (broadcastChannel) {
      try {
        broadcastChannel.postMessage({ type: 'WAREHOUSE_SYNC_UPDATE', payload: finalPayload });
      } catch {
        // safe
      }
    }

    return finalPayload;
  } catch (error: any) {
    console.warn('pushWarehouseSync direct fallback:', error?.message);
    const fallbackPayload: WarehouseSyncPayload = {
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
    };
    try {
      await setDoc(docRef, fallbackPayload, { merge: true });
      updateSyncState('connected', 'Tersinkronisasi Cloud');
    } catch {
      updateSyncState('offline', 'Mode Offline (Tersimpan Lokal)');
    }
    return fallbackPayload;
  }
}

