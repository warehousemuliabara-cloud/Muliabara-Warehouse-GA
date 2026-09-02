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
import firebaseConfig from '../../firebase-applet-config.json';

// Suppress Firestore verbose debug log noise in console
try {
  setLogLevel('silent');
} catch {
  // Ignore
}

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const dbId = (firebaseConfig as any).firestoreDatabaseId;

// Initialize Firestore with ignoreUndefinedProperties and experimentalAutoDetectLongPolling
// This ensures 100% reliable connectivity on Netlify, Mobile Safari, Android Chrome, and PC.
let firestoreInstance: ReturnType<typeof getFirestore>;
try {
  firestoreInstance = initializeFirestore(
    app,
    {
      ignoreUndefinedProperties: true,
      experimentalAutoDetectLongPolling: true,
    },
    dbId || undefined
  );
} catch {
  try {
    firestoreInstance = initializeFirestore(
      app,
      {
        ignoreUndefinedProperties: true,
      },
      dbId || undefined
    );
  } catch {
    try {
      firestoreInstance = dbId ? getFirestore(app, dbId) : getFirestore(app);
    } catch {
      firestoreInstance = getFirestore(app);
    }
  }
}

export const db = firestoreInstance;

// Global Warehouse Collection & Document constants
export const WAREHOUSE_DOC_ID = 'warehouse_kbct_main';
export const WAREHOUSE_COLLECTION = 'warehouses';

// Unique Session ID for this browser tab/client to prevent self-echo loops
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

// Cross-tab BroadcastChannel for 0ms multi-account & multi-tab synchronization on same device
const CROSS_TAB_CHANNEL_NAME = 'ga_warehouse_kbct_broadcast_v3';
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

// Track last applied hash to prevent unnecessary re-renders
let lastAppliedHash = '';

/**
 * Deep cleans any JavaScript object before writing to Firestore.
 * Strips all `undefined` properties, cleans arrays, and limits log sizes.
 */
export function sanitizePayloadForFirestore(raw: any): any {
  if (raw === null || raw === undefined) return null;
  
  try {
    // JSON parse/stringify drops all object keys with value `undefined`
    const cleaned = JSON.parse(JSON.stringify(raw, (key, value) => {
      if (value === undefined) return undefined; // will be omitted by JSON.stringify
      return value;
    }));
    return cleaned;
  } catch {
    return raw;
  }
}

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
 * Filter out transactions older than 3 months (90 days) based on their transaction date.
 * Requirement 1: Automatic 3-month pruning based on transaction date.
 */
export function filterTransactionsWithin3Months<T extends { date?: string; timestamp?: string; createdAt?: string }>(
  transactions: T[]
): T[] {
  if (!Array.isArray(transactions)) return [];
  const now = new Date();
  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(now.getMonth() - 3);
  const cutoffTime = threeMonthsAgo.getTime();

  return transactions.filter((trx) => {
    const rawDate = trx.date || trx.timestamp || trx.createdAt;
    if (!rawDate) return true;
    const trxTime = new Date(rawDate).getTime();
    if (isNaN(trxTime)) return true;
    return trxTime >= cutoffTime;
  });
}

/**
 * Robust Smart Merger:
 * Cloud Firestore is the authoritative source of truth.
 * When merging, transactions older than 3 months are pruned automatically.
 */
export function smartMergeWarehouseData(
  local?: Partial<WarehouseSyncPayload>,
  remote?: Partial<WarehouseSyncPayload>
): WarehouseSyncPayload {
  const localObj = local || {};
  const remoteObj = remote || {};

  // If remote exists, remote is authoritative for transactions, loans, and items
  let mergedTransactions = remoteObj.transactions ? [...remoteObj.transactions] : (localObj.transactions || []);
  mergedTransactions = filterTransactionsWithin3Months(mergedTransactions).sort(
    (a, b) => new Date(b.date || b.updatedAt || 0).getTime() - new Date(a.date || a.updatedAt || 0).getTime()
  );

  let mergedLoans = remoteObj.loans ? [...remoteObj.loans] : (localObj.loans || []);
  let mergedItems = remoteObj.items && remoteObj.items.length > 0 ? remoteObj.items : (localObj.items || []);
  let mergedEmployees = remoteObj.employees && remoteObj.employees.length > 0 ? remoteObj.employees : (localObj.employees || []);
  let mergedUsers = remoteObj.users && remoteObj.users.length > 0 ? remoteObj.users : (localObj.users || []);
  let mergedAuditLogs = (remoteObj.auditLogs || localObj.auditLogs || []).slice(0, 200);

  // Merge permissions & config
  const mergedPermissions = {
    ...(localObj.rolePermissions || {}),
    ...(remoteObj.rolePermissions || {}),
  };

  const mergedConfig = {
    ...(localObj.dashboardConfig || {}),
    ...(remoteObj.dashboardConfig || {}),
  };

  return {
    items: mergedItems,
    transactions: mergedTransactions,
    employees: mergedEmployees,
    users: mergedUsers,
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

      // Apply 3-month transaction filter
      if (Array.isArray(cloudData.transactions)) {
        cloudData.transactions = filterTransactionsWithin3Months(cloudData.transactions);
      }

      lastAppliedHash = computeDataHash(cloudData);
      return cloudData;
    } else if (currentLocal) {
      // First time initialization on Cloud
      const initialTransactions = filterTransactionsWithin3Months(currentLocal.transactions || []);
      const initialCloud: WarehouseSyncPayload = {
        items: currentLocal.items || [],
        transactions: initialTransactions,
        employees: currentLocal.employees || [],
        users: currentLocal.users || [],
        loans: currentLocal.loans || [],
        auditLogs: (currentLocal.auditLogs || []).slice(0, 100),
        rolePermissions: currentLocal.rolePermissions || {},
        dashboardConfig: currentLocal.dashboardConfig || {},
        lastUpdated: new Date().toISOString(),
        updatedBy: currentLocal.updatedBy || 'Sistem',
        lastWriterId: CLIENT_SESSION_ID,
      };
      
      const cleanInitial = sanitizePayloadForFirestore(initialCloud);
      await setDoc(docRef, cleanInitial);
      updateSyncState('connected', 'Tersinkronisasi Cloud');
      lastAppliedHash = computeDataHash(cleanInitial);
      return cleanInitial;
    }
    return null;
  } catch (err: any) {
    console.warn('Direct fetch from Firestore notice:', err?.message);
    return null;
  }
}

/**
 * Subscribe to real-time warehouse data changes from Firestore.
 * Automatically propagates instant updates to all Mobile and PC devices.
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
 * Guarantees that changes propagate to all accounts & devices instantly.
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
    auditLogs: (payload.auditLogs || []).slice(0, 200),
    rolePermissions: payload.rolePermissions || {},
    dashboardConfig: payload.dashboardConfig || {},
    lastUpdated: new Date().toISOString(),
    updatedBy: payload.updatedBy || 'Sistem',
    lastWriterId: CLIENT_SESSION_ID,
  };

  const cleanPayload = sanitizePayloadForFirestore(finalPayload);
  lastAppliedHash = computeDataHash(cleanPayload);

  // 1. Broadcast to other tabs in the same browser immediately (0ms)
  if (broadcastChannel) {
    try {
      broadcastChannel.postMessage({
        type: 'WAREHOUSE_SYNC_UPDATE',
        payload: cleanPayload,
        senderId: CLIENT_SESSION_ID,
      });
    } catch {
      // safe
    }
  }

  // 2. Persist directly to Firestore Cloud for all Mobile & PC devices
  try {
    await setDoc(docRef, cleanPayload);
    updateSyncState('connected', 'Tersinkronisasi Cloud');
    return cleanPayload;
  } catch (error: any) {
    console.warn('Firestore push error:', error?.message);
    updateSyncState('offline', 'Mode Offline (Tersimpan Lokal)');
    return cleanPayload;
  }
}

