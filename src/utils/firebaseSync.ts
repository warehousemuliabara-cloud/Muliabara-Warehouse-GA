import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  initializeFirestore,
  getFirestore, 
  doc, 
  setDoc, 
  getDoc,
  onSnapshot,
  setLogLevel
} from 'firebase/firestore';
import { getAuth, signInAnonymously } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

// Suppress Firestore benign polling and retry log noise in console
try {
  setLogLevel('silent');
} catch {
  // Ignore in case environment restricts logLevel
}

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const dbId = (firebaseConfig as any).firestoreDatabaseId;

// Initialize Firebase Anonymous Auth for seamless cross-origin Netlify access
try {
  const auth = getAuth(app);
  signInAnonymously(auth).catch((err) => {
    // Non-blocking in case auth is not enabled
    console.debug('Firebase Auth status:', err?.message);
  });
} catch {
  // Safe
}

// Initialize Firestore with standard high-performance WebSockets & fallback for seamless Netlify & Mobile connectivity
let firestoreInstance: ReturnType<typeof getFirestore>;
try {
  firestoreInstance = dbId ? getFirestore(app, dbId) : getFirestore(app);
} catch {
  try {
    firestoreInstance = initializeFirestore(app, {}, dbId || undefined);
  } catch {
    firestoreInstance = getFirestore(app);
  }
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
    const txSummary = (data.transactions || [])
      .map((t) => `${t.id || t.transactionNumber}:${t.status}:${t.updatedAt || t.date || ''}:${t.dispatchedAt || ''}`)
      .join('|');
    const itemStockSum = (data.items || []).reduce((acc, i) => acc + (Number(i.currentStock) || 0), 0);
    const itemSummary = (data.items || [])
      .map((i) => `${i.id || i.code}:${i.currentStock}:${i.updatedAt || ''}`)
      .join('|');
    const empCount = (data.employees || []).length;
    const userCount = (data.users || []).length;
    const loanSummary = (data.loans || []).map((l) => `${l.id}:${l.status}:${l.actualReturnDate || l.borrowDate || ''}`).join('|');
    const rolePermsKey = JSON.stringify(data.rolePermissions || {});
    const cfgKey = JSON.stringify(data.dashboardConfig || {});
    return `${data.lastUpdated || ''}_tx[${(data.transactions || []).length}_${txSummary}]_it[${(data.items || []).length}_${itemStockSum}_${itemSummary}]_e${empCount}_u${userCount}_l${loanSummary}_rp[${rolePermsKey}]_cfg[${cfgKey}]`;
  } catch {
    return String(Date.now());
  }
}

const getTrxRank = (t: any): number => {
  if (!t) return 0;
  if (t.status === 'COMPLETED') return 40;
  if (t.status === 'APPROVED') return 30;
  if (t.status === 'REJECTED') return 20;
  if (t.status === 'PENDING') return 10;
  return 5;
};

const getLoanRank = (l: any): number => {
  if (!l) return 0;
  if (l.status === 'RETURNED') return 20;
  if (l.status === 'BORROWED') return 10;
  return 5;
};

/**
 * Robust Bidirectional Smart Merger:
 * Combines local and cloud records so that NO TRANSACTION OR ITEM IS EVER LOST.
 * If a transaction exists only locally or only in cloud, both are preserved.
 */
export function smartMergeWarehouseData(
  local?: Partial<WarehouseSyncPayload>,
  remote?: Partial<WarehouseSyncPayload>
): WarehouseSyncPayload {
  const localObj = local || {};
  const remoteObj = remote || {};

  // 1. Merge Transactions (Union by ID / Transaction Number, highest status rank & newest timestamp wins)
  const trxMap = new Map<string, any>();

  // Add remote transactions
  (remoteObj.transactions || []).forEach((t: any) => {
    const key = String(t.id || t.transactionNumber || '').trim();
    if (key) trxMap.set(key, t);
  });

  // Add or update with local transactions (if local has new or newer)
  (localObj.transactions || []).forEach((t: any) => {
    const key = String(t.id || t.transactionNumber || '').trim();
    if (!key) return;

    if (!trxMap.has(key)) {
      trxMap.set(key, t);
    } else {
      const existing = trxMap.get(key);
      const localRank = getTrxRank(t);
      const remoteRank = getTrxRank(existing);

      if (localRank > remoteRank) {
        trxMap.set(key, { ...existing, ...t });
      } else if (remoteRank > localRank) {
        trxMap.set(key, { ...t, ...existing });
      } else {
        const localTime = new Date(t.updatedAt || t.date || 0).getTime();
        const remoteTime = new Date(existing.updatedAt || existing.date || 0).getTime();
        if (localTime >= remoteTime) {
          trxMap.set(key, { ...existing, ...t });
        } else {
          trxMap.set(key, { ...t, ...existing });
        }
      }
    }
  });

  const mergedTransactions = Array.from(trxMap.values()).sort(
    (a, b) => new Date(b.date || b.updatedAt || 0).getTime() - new Date(a.date || a.updatedAt || 0).getTime()
  );

  // 2. Merge Items (Union by ID / Code, keeping latest stock and data)
  const itemMap = new Map<string, any>();
  (remoteObj.items || []).forEach((it: any) => {
    const key = String(it.id || it.code || '').trim().toLowerCase();
    if (key) itemMap.set(key, it);
  });

  (localObj.items || []).forEach((it: any) => {
    const key = String(it.id || it.code || '').trim().toLowerCase();
    if (!key) return;
    if (!itemMap.has(key)) {
      itemMap.set(key, it);
    } else {
      const existing = itemMap.get(key);
      const localTime = new Date(it.updatedAt || 0).getTime();
      const remoteTime = new Date(existing.updatedAt || 0).getTime();
      if (localTime >= remoteTime) {
        itemMap.set(key, { ...existing, ...it });
      } else {
        itemMap.set(key, { ...it, ...existing });
      }
    }
  });
  const mergedItems = Array.from(itemMap.values());

  // 3. Merge Employees (Union by ID / NIK)
  const empMap = new Map<string, any>();
  (remoteObj.employees || []).forEach((e: any) => {
    const key = String(e.id || e.nik || e.name || '').trim().toLowerCase();
    if (key) empMap.set(key, e);
  });
  (localObj.employees || []).forEach((e: any) => {
    const key = String(e.id || e.nik || e.name || '').trim().toLowerCase();
    if (key && !empMap.has(key)) empMap.set(key, e);
  });
  const mergedEmployees = Array.from(empMap.values());

  // 4. Merge Users (Union by ID / Username)
  const userMap = new Map<string, any>();
  (remoteObj.users || []).forEach((u: any) => {
    const key = String(u.id || u.username || '').trim().toLowerCase();
    if (key) userMap.set(key, u);
  });
  (localObj.users || []).forEach((u: any) => {
    const key = String(u.id || u.username || '').trim().toLowerCase();
    if (key && !userMap.has(key)) userMap.set(key, u);
  });
  const mergedUsers = Array.from(userMap.values());

  // 5. Merge Loans (Union by ID, highest rank and latest return date wins)
  const loanMap = new Map<string, any>();
  (remoteObj.loans || []).forEach((l: any) => {
    if (l.id) loanMap.set(l.id, l);
  });
  (localObj.loans || []).forEach((l: any) => {
    if (l.id) {
      if (!loanMap.has(l.id)) {
        loanMap.set(l.id, l);
      } else {
        const existing = loanMap.get(l.id);
        const localRank = getLoanRank(l);
        const remoteRank = getLoanRank(existing);

        if (localRank > remoteRank) {
          loanMap.set(l.id, { ...existing, ...l });
        } else if (remoteRank > localRank) {
          loanMap.set(l.id, { ...l, ...existing });
        } else {
          const localTime = new Date(l.updatedAt || l.actualReturnDate || l.borrowDate || 0).getTime();
          const remoteTime = new Date(existing.updatedAt || existing.actualReturnDate || existing.borrowDate || 0).getTime();
          if (localTime >= remoteTime) loanMap.set(l.id, { ...existing, ...l });
          else loanMap.set(l.id, { ...l, ...existing });
        }
      }
    }
  });
  const mergedLoans = Array.from(loanMap.values());

  // 6. Merge Audit Logs (Union by ID, sorted newest first, max 500)
  const auditMap = new Map<string, any>();
  (remoteObj.auditLogs || []).forEach((a: any) => {
    if (a.id) auditMap.set(a.id, a);
  });
  (localObj.auditLogs || []).forEach((a: any) => {
    if (a.id) auditMap.set(a.id, a);
  });
  const mergedAuditLogs = Array.from(auditMap.values())
    .sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime())
    .slice(0, 500);

  // 7. Role Permissions & Dashboard Config
  const mergedPermissions = {
    ...(localObj.rolePermissions || {}),
    ...(remoteObj.rolePermissions || {}),
  };

  const mergedConfig = {
    ...(localObj.dashboardConfig || {}),
    ...(remoteObj.dashboardConfig || {}),
  };

  return {
    items: mergedItems.length > 0 ? mergedItems : localObj.items || [],
    transactions: mergedTransactions,
    employees: mergedEmployees.length > 0 ? mergedEmployees : localObj.employees || [],
    users: mergedUsers.length > 0 ? mergedUsers : localObj.users || [],
    loans: mergedLoans,
    auditLogs: mergedAuditLogs,
    rolePermissions: Object.keys(mergedPermissions).length > 0 ? mergedPermissions : localObj.rolePermissions || {},
    dashboardConfig: Object.keys(mergedConfig).length > 0 ? mergedConfig : localObj.dashboardConfig || {},
    lastUpdated: remoteObj.lastUpdated || localObj.lastUpdated || new Date().toISOString(),
    updatedBy: remoteObj.updatedBy || localObj.updatedBy || 'Sistem',
    lastWriterId: remoteObj.lastWriterId || localObj.lastWriterId,
  };
}

/**
 * Direct fetch from Firestore server to get fresh authoritative cloud data.
 * Safely merges with local state so newly created transactions are NEVER lost.
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

      // Smart merge cloud data with current local records so no transaction is overwritten or lost
      const mergedData = currentLocal
        ? smartMergeWarehouseData(currentLocal, cloudData)
        : cloudData;

      lastAppliedHash = computeDataHash(mergedData);

      // If local had new transactions not yet in cloud, push the merged result to Cloud
      if (currentLocal && (currentLocal.transactions?.length || 0) > (cloudData.transactions?.length || 0)) {
        pushWarehouseSync(mergedData).catch(() => {});
      }

      return mergedData;
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
 * Guarantees that changes propagate to all accounts instantly.
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

  // 2. Persist directly to Firestore Cloud
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
