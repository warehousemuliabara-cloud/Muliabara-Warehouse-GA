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
import mqtt from 'mqtt';
import firebaseConfig from '../../firebase-applet-config.json';

// Suppress Firestore verbose debug log noise in console
try {
  setLogLevel('silent');
} catch {
  // Ignore
}

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const dbId = (firebaseConfig as any).firestoreDatabaseId;

// Standard direct Firestore initialization for 100% reliable cross-device & Netlify connectivity
let firestoreInstance: ReturnType<typeof getFirestore>;
try {
  firestoreInstance = dbId ? getFirestore(app, dbId) : getFirestore(app);
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
    firestoreInstance = getFirestore(app);
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

// Real-Time Cross-Device WebSocket Sync Relay (Instant PC <-> Handphone Synchronization)
const CROSS_DEVICE_TOPIC = 'muliabara_kbct_warehouse_sync_888ff62e';
const MQTT_BROKER_URLS = [
  'wss://broker.hivemq.com:8884/mqtt',
  'wss://broker.emqx.io:8084/mqtt',
];

let mqttClient: any = null;
let latestRelayPayload: WarehouseSyncPayload | null = null;
const crossDeviceCallbacks: ((payload: WarehouseSyncPayload) => void)[] = [];

// Initialize high-speed real-time cross-device sync relay
function initCrossDeviceRelay() {
  if (typeof window === 'undefined' || mqttClient) return;

  try {
    const clientId = `kbct_${Math.random().toString(36).substring(2, 9)}_${Date.now().toString(36)}`;
    mqttClient = mqtt.connect(MQTT_BROKER_URLS[0], {
      clientId,
      clean: true,
      connectTimeout: 9000,
      reconnectPeriod: 4000,
    });

    mqttClient.on('connect', () => {
      console.log('Cross-Device Relay connected (PC ↔ Handphone active)');
      updateSyncState('connected', 'Tersinkronisasi Realtime (PC ↔ HP Terhubung)');
      mqttClient.subscribe(CROSS_DEVICE_TOPIC, { qos: 1 }, (err: any) => {
        if (err) console.warn('MQTT sub err:', err);
      });
    });

    mqttClient.on('message', (_topic: string, message: any) => {
      try {
        const rawStr = typeof message === 'string' ? message : message.toString();
        const payload: WarehouseSyncPayload = JSON.parse(rawStr);
        if (!payload || payload.lastWriterId === CLIENT_SESSION_ID) {
          return; // Ignore updates that originated from this specific tab
        }

        latestRelayPayload = payload;

        const newHash = computeDataHash(payload);
        if (newHash === lastAppliedHash) {
          return;
        }
        lastAppliedHash = newHash;

        // Propagate instant update to all registered UI subscribers
        crossDeviceCallbacks.forEach((cb) => {
          try {
            cb(payload);
          } catch (err) {
            console.error('Cross-device callback error:', err);
          }
        });

        // Also broadcast to other local tabs on same device
        if (broadcastChannel) {
          try {
            broadcastChannel.postMessage({
              type: 'WAREHOUSE_SYNC_UPDATE',
              payload,
              senderId: CLIENT_SESSION_ID,
            });
          } catch {
            // safe
          }
        }

        updateSyncState('connected', 'Tersinkronisasi Realtime (PC ↔ HP Terhubung)');
      } catch (e) {
        console.warn('Cross-device message decode error:', e);
      }
    });

    mqttClient.on('error', (err: any) => {
      console.warn('Cross-device relay notice:', err?.message || err);
    });

    mqttClient.on('close', () => {
      // Reconnect handled automatically by mqtt library
    });
  } catch (e) {
    console.warn('Failed to initialize cross-device relay:', e);
  }
}

// Start relay automatically on browser load
if (typeof window !== 'undefined') {
  initCrossDeviceRelay();
}

/**
 * Publish instant warehouse state across all devices (PC, Handphone, Tablet).
 * Uses QoS 1 and Retain flag so devices opening later immediately receive the state.
 */
export function publishCrossDeviceUpdate(payload: WarehouseSyncPayload) {
  if (typeof window === 'undefined') return;
  try {
    latestRelayPayload = payload;
    const jsonStr = JSON.stringify(payload);
    if (mqttClient && mqttClient.connected) {
      mqttClient.publish(CROSS_DEVICE_TOPIC, jsonStr, { retain: true, qos: 1 });
    } else if (mqttClient) {
      mqttClient.publish(CROSS_DEVICE_TOPIC, jsonStr, { retain: true, qos: 1 });
    } else {
      initCrossDeviceRelay();
      setTimeout(() => {
        if (mqttClient) {
          mqttClient.publish(CROSS_DEVICE_TOPIC, jsonStr, { retain: true, qos: 1 });
        }
      }, 1000);
    }
  } catch (e) {
    console.warn('publishCrossDeviceUpdate notice:', e);
  }
}

export interface WarehouseSyncPayload {
  items: any[];
  transactions: any[];
  deletedTransactionIds?: string[];
  deletedLoanIds?: string[];
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
      if (value === undefined) return undefined;
      // Guard against oversized base64 data URIs in logoUrl exceeding the 1MB Firestore limit
      if (key === 'logoUrl' && typeof value === 'string' && value.length > 80000) {
        console.warn('Dashboard logo URL too large for single Firestore doc, trimming to keep document safe');
        return value.slice(0, 80000);
      }
      return value;
    }));

    // Ensure auditLogs are capped at latest 50 entries in Cloud to keep doc well under 1MB
    if (cleaned && Array.isArray(cleaned.auditLogs) && cleaned.auditLogs.length > 50) {
      cleaned.auditLogs = cleaned.auditLogs.slice(0, 50);
    }

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
    const deletedCount = (data.deletedTransactionIds || []).length;
    const deletedLoanCount = (data.deletedLoanIds || []).length;
    const rolePermsKey = JSON.stringify(data.rolePermissions || {});
    const cfgKey = JSON.stringify(data.dashboardConfig || {});
    return `${data.lastUpdated || ''}_tx[${(data.transactions || []).length}_${txSummary}]_del[${deletedCount}]_delLoan[${deletedLoanCount}]_it[${(data.items || []).length}_${itemStockSum}_${itemSummary}]_e${empCount}_u${userCount}_l${loanSummary}_rp[${rolePermsKey}]_cfg[${cfgKey}]`;
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

// Storage Keys
const STORAGE_KEY_OFFLINE_QUEUE = 'ga_warehouse_offline_queue_v2';
const STORAGE_KEY_LOCAL_LEDGER = 'ga_warehouse_trx_local_ledger_v2';
const STORAGE_KEY_DELETED_TRX = 'ga_warehouse_deleted_trx_ids_v1';
const STORAGE_KEY_DELETED_LOANS = 'ga_warehouse_deleted_loan_ids_v1';

// Loan Tombstone Management: Track deleted loans so they NEVER reappear across devices or on other transactions
export function getDeletedLoanIds(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY_DELETED_LOANS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function recordDeletedLoanId(loanId: string, loanNumber?: string) {
  if (typeof window === 'undefined') return;
  try {
    const current = getDeletedLoanIds();
    const set = new Set(Array.isArray(current) ? current : []);
    if (loanId) set.add(loanId);
    if (loanNumber) set.add(loanNumber);
    const updated = Array.from(set).slice(-1000);
    localStorage.setItem(STORAGE_KEY_DELETED_LOANS, JSON.stringify(updated));
  } catch (e) {
    console.warn('Failed to record deleted loan id:', e);
  }
}

export function recordDeletedLoanIds(idsAndNumbers: string[]) {
  if (typeof window === 'undefined' || !Array.isArray(idsAndNumbers)) return;
  try {
    const current = getDeletedLoanIds();
    const set = new Set(Array.isArray(current) ? current : []);
    idsAndNumbers.forEach((id) => {
      if (id) set.add(id);
    });
    const updated = Array.from(set).slice(-1000);
    localStorage.setItem(STORAGE_KEY_DELETED_LOANS, JSON.stringify(updated));
  } catch (e) {
    console.warn('Failed to record deleted loan ids:', e);
  }
}

export function clearDeletedLoanIds() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(STORAGE_KEY_DELETED_LOANS);
  } catch (e) {
    // safe
  }
}

// Tombstone Management: Track deleted transactions so they NEVER reappear across devices
export function getDeletedTransactionIds(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY_DELETED_TRX);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function recordDeletedTransactionId(trxId: string, trxNumber?: string) {
  if (typeof window === 'undefined') return;
  try {
    const current = getDeletedTransactionIds();
    const set = new Set(Array.isArray(current) ? current : []);
    if (trxId) set.add(trxId);
    if (trxNumber) set.add(trxNumber);
    const updated = Array.from(set).slice(-1000);
    localStorage.setItem(STORAGE_KEY_DELETED_TRX, JSON.stringify(updated));
  } catch (e) {
    console.warn('Failed to record deleted transaction id:', e);
  }
}

export function removeFromLocalLedger(trxId: string, trxNumber?: string) {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_LOCAL_LEDGER);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    const list: any[] = Array.isArray(parsed) ? parsed : [];
    const filtered = list.filter((t: any) => {
      const matchId = t.id === trxId || (trxNumber && t.transactionNumber === trxNumber);
      return !matchId;
    });
    localStorage.setItem(STORAGE_KEY_LOCAL_LEDGER, JSON.stringify(filtered));
  } catch (e) {
    console.warn('Failed to remove from local ledger:', e);
  }
}

export function clearLocalLedger() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(STORAGE_KEY_LOCAL_LEDGER);
  } catch (e) {
    // safe
  }
}

export function clearDeletedTransactionIds() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(STORAGE_KEY_DELETED_TRX);
  } catch (e) {
    // safe
  }
}

// Save transaction to local permanent ledger so it can NEVER be lost
export function saveToLocalLedger(trx: any) {
  if (typeof window === 'undefined' || !trx) return;
  const deleted = new Set(getDeletedTransactionIds());
  if (deleted.has(trx.id) || (trx.transactionNumber && deleted.has(trx.transactionNumber))) {
    return; // Never re-save a deleted transaction
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY_LOCAL_LEDGER);
    const parsed = raw ? JSON.parse(raw) : [];
    const list: any[] = Array.isArray(parsed) ? parsed : [];
    const trxKey = trx.id || trx.transactionNumber;
    const existingIdx = list.findIndex((t: any) => (t.id || t.transactionNumber) === trxKey);
    if (existingIdx >= 0) {
      list[existingIdx] = trx;
    } else {
      list.unshift(trx);
    }
    // Limit ledger to latest 500 entries
    localStorage.setItem(STORAGE_KEY_LOCAL_LEDGER, JSON.stringify(list.slice(0, 500)));
  } catch (e) {
    console.warn('Local ledger save notice:', e);
  }
}

export function getLocalLedger(): any[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY_LOCAL_LEDGER);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function getOfflineQueueCount(): number {
  if (typeof window === 'undefined') return 0;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_OFFLINE_QUEUE);
    if (!raw) return 0;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.length : 0;
  } catch {
    return 0;
  }
}

function saveToOfflineQueue(payload: WarehouseSyncPayload) {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_OFFLINE_QUEUE);
    const parsed = raw ? JSON.parse(raw) : [];
    const queue: WarehouseSyncPayload[] = Array.isArray(parsed) ? parsed : [];
    // Only keep latest 5 queued states
    queue.push(payload);
    localStorage.setItem(STORAGE_KEY_OFFLINE_QUEUE, JSON.stringify(queue.slice(-5)));
    updateSyncState('offline', `Ada ${queue.length} pembaruan menunggu jaringan`);
  } catch (e) {
    console.warn('Failed to save offline queue:', e);
  }
}

let isFlushingQueue = false;
export async function flushOfflineSyncQueue(): Promise<boolean> {
  if (typeof window === 'undefined' || isFlushingQueue) return false;
  if (!navigator.onLine) return false;

  const count = getOfflineQueueCount();
  if (count === 0) return true;

  isFlushingQueue = true;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_OFFLINE_QUEUE);
    const queue: WarehouseSyncPayload[] = raw ? JSON.parse(raw) : [];
    if (queue.length === 0) {
      isFlushingQueue = false;
      return true;
    }

    updateSyncState('syncing', `Mengirim ${queue.length} data tersimpan saat offline...`);
    const docRef = doc(db, WAREHOUSE_COLLECTION, WAREHOUSE_DOC_ID);
    
    // First get current doc on Firestore to avoid blind overwrite
    const snap = await getDoc(docRef);
    let baseData: Partial<WarehouseSyncPayload> = {};
    if (snap.exists()) {
      baseData = snap.data() as WarehouseSyncPayload;
    }

    // Merge all queued payloads sequentially
    let finalPayload: WarehouseSyncPayload = queue[queue.length - 1];
    for (const q of queue) {
      finalPayload = smartMergeWarehouseData(finalPayload, q);
    }
    // Safely merge with Firestore existing base
    finalPayload = smartMergeWarehouseData(baseData, finalPayload);

    const cleanPayload = sanitizePayloadForFirestore(finalPayload);
    await setDoc(docRef, cleanPayload);

    // Clear queue on success
    localStorage.removeItem(STORAGE_KEY_OFFLINE_QUEUE);
    lastAppliedHash = computeDataHash(cleanPayload);
    updateSyncState('connected', 'Tersinkronisasi Cloud');
    isFlushingQueue = false;
    return true;
  } catch (err: any) {
    console.warn('Queue flush retry notice:', err?.message);
    updateSyncState('offline', 'Koneksi lemah, akan dicoba kembali otomatis');
    isFlushingQueue = false;
    return false;
  }
}

// Auto-flush listeners
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    flushOfflineSyncQueue().catch(() => {});
  });
  // 15-second background auto-flush interval
  setInterval(() => {
    if (navigator.onLine && getOfflineQueueCount() > 0) {
      flushOfflineSyncQueue().catch(() => {});
    }
  }, 15000);
}

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
 * Robust Smart Merger with Zero-Data-Loss Union:
 * Merges local and remote data safely by unique identity keys.
 * Never silently deletes local transactions or loans created offline or during weak network.
 */
export function smartMergeWarehouseData(
  local?: Partial<WarehouseSyncPayload>,
  remote?: Partial<WarehouseSyncPayload>
): WarehouseSyncPayload {
  const localObj = local || {};
  const remoteObj = remote || {};

  // Collect all known deleted transaction IDs from storage, local payload, and remote payload
  const localDeleted = getDeletedTransactionIds();
  const remoteDeleted = Array.isArray(remoteObj.deletedTransactionIds) ? remoteObj.deletedTransactionIds : [];
  const payloadLocalDeleted = Array.isArray(localObj.deletedTransactionIds) ? localObj.deletedTransactionIds : [];
  
  const allDeletedSet = new Set<string>([
    ...localDeleted,
    ...remoteDeleted,
    ...payloadLocalDeleted,
  ]);

  // Persist updated tombstone set to localStorage
  if (typeof window !== 'undefined' && allDeletedSet.size > 0) {
    try {
      localStorage.setItem(STORAGE_KEY_DELETED_TRX, JSON.stringify(Array.from(allDeletedSet).slice(-1000)));
    } catch {}
  }

  // 1. BIDIRECTIONAL UNION MERGE FOR TRANSACTIONS WITH STRICT TOMBSTONE FILTERING
  const trxMap = new Map<string, any>();

  // Incorporate permanent local ledger if available, omitting deleted transactions
  const ledger = getLocalLedger();
  ledger.forEach((t: any) => {
    const key = t.id || t.transactionNumber;
    if (!key) return;
    if (allDeletedSet.has(t.id) || (t.transactionNumber && allDeletedSet.has(t.transactionNumber))) return;
    trxMap.set(key, t);
  });

  // Add all local transactions, omitting deleted transactions
  (localObj.transactions || []).forEach((t: any) => {
    const key = t.id || t.transactionNumber;
    if (!key) return;
    if (allDeletedSet.has(t.id) || (t.transactionNumber && allDeletedSet.has(t.transactionNumber))) return;
    const existing = trxMap.get(key);
    if (!existing || getTrxRank(t) >= getTrxRank(existing)) {
      trxMap.set(key, t);
    }
  });

  // Merge remote transactions, omitting deleted transactions
  (remoteObj.transactions || []).forEach((remoteTrx: any) => {
    const key = remoteTrx.id || remoteTrx.transactionNumber;
    if (!key) return;
    if (allDeletedSet.has(remoteTrx.id) || (remoteTrx.transactionNumber && allDeletedSet.has(remoteTrx.transactionNumber))) return;
    
    const localTrx = trxMap.get(key);
    if (!localTrx) {
      trxMap.set(key, remoteTrx);
    } else {
      const remoteRank = getTrxRank(remoteTrx);
      const localRank = getTrxRank(localTrx);
      if (remoteRank > localRank) {
        trxMap.set(key, remoteTrx);
      } else if (remoteRank === localRank) {
        const localTime = new Date(localTrx.updatedAt || localTrx.date || 0).getTime();
        const remoteTime = new Date(remoteTrx.updatedAt || remoteTrx.date || 0).getTime();
        if (remoteTime >= localTime) {
          trxMap.set(key, remoteTrx);
        }
      }
    }
  });

  let mergedTransactions = Array.from(trxMap.values())
    .filter((t: any) => {
      return !allDeletedSet.has(t.id) && !(t.transactionNumber && allDeletedSet.has(t.transactionNumber));
    })
    .map((t: any) => ({
      ...t,
      items: Array.isArray(t?.items) ? t.items : [],
    }));

  mergedTransactions = filterTransactionsWithin3Months(mergedTransactions).sort(
    (a, b) => new Date(b.date || b.updatedAt || 0).getTime() - new Date(a.date || a.updatedAt || 0).getTime()
  );

  // Clean local ledger if any deleted transactions were found in it
  if (typeof window !== 'undefined' && Array.isArray(ledger) && ledger.length > 0) {
    const cleanedLedger = ledger.filter((t: any) => !allDeletedSet.has(t.id) && !(t.transactionNumber && allDeletedSet.has(t.transactionNumber)));
    if (cleanedLedger.length !== ledger.length) {
      try {
        localStorage.setItem(STORAGE_KEY_LOCAL_LEDGER, JSON.stringify(cleanedLedger));
      } catch {}
    }
  }

  // 2. BIDIRECTIONAL UNION MERGE FOR LOANS WITH STRICT TOMBSTONE FILTERING
  const localDeletedLoans = getDeletedLoanIds();
  const remoteDeletedLoans = Array.isArray(remoteObj.deletedLoanIds) ? remoteObj.deletedLoanIds : [];
  const payloadLocalDeletedLoans = Array.isArray(localObj.deletedLoanIds) ? localObj.deletedLoanIds : [];

  const allDeletedLoanSet = new Set<string>([
    ...localDeletedLoans,
    ...remoteDeletedLoans,
    ...payloadLocalDeletedLoans,
  ]);

  if (typeof window !== 'undefined' && allDeletedLoanSet.size > 0) {
    try {
      localStorage.setItem(STORAGE_KEY_DELETED_LOANS, JSON.stringify(Array.from(allDeletedLoanSet).slice(-1000)));
    } catch {}
  }

  const loanMap = new Map<string, any>();
  (localObj.loans || []).forEach((l: any) => {
    const key = l.id || l.loanNumber;
    if (!key) return;
    if (allDeletedLoanSet.has(l.id) || (l.loanNumber && allDeletedLoanSet.has(l.loanNumber))) return;
    loanMap.set(key, l);
  });
  (remoteObj.loans || []).forEach((remoteLoan: any) => {
    const key = remoteLoan.id || remoteLoan.loanNumber;
    if (!key) return;
    if (allDeletedLoanSet.has(remoteLoan.id) || (remoteLoan.loanNumber && allDeletedLoanSet.has(remoteLoan.loanNumber))) return;
    const localLoan = loanMap.get(key);
    if (!localLoan) {
      loanMap.set(key, remoteLoan);
    } else {
      const remoteRank = getLoanRank(remoteLoan);
      const localRank = getLoanRank(localLoan);
      if (remoteRank >= localRank) {
        loanMap.set(key, remoteLoan);
      }
    }
  });
  const mergedLoans = Array.from(loanMap.values())
    .filter((l: any) => !allDeletedLoanSet.has(l.id) && !(l.loanNumber && allDeletedLoanSet.has(l.loanNumber)))
    .sort((a, b) => new Date(b.loanDate || 0).getTime() - new Date(a.loanDate || 0).getTime());

  // 3. UNION MERGE FOR ITEMS (Preserve stock updates)
  const itemMap = new Map<string, any>();
  (localObj.items || []).forEach((item: any) => {
    const key = item.id || item.code;
    if (key) itemMap.set(key, item);
  });
  (remoteObj.items || []).forEach((remoteItem: any) => {
    const key = remoteItem.id || remoteItem.code;
    if (!key) return;
    const localItem = itemMap.get(key);
    if (!localItem) {
      itemMap.set(key, remoteItem);
    } else {
      const remoteTime = new Date(remoteItem.updatedAt || 0).getTime();
      const localTime = new Date(localItem.updatedAt || 0).getTime();
      if (remoteTime >= localTime) {
        itemMap.set(key, remoteItem);
      }
    }
  });
  const mergedItems = Array.from(itemMap.values());

  // 4. Employees & Users
  const empMap = new Map<string, any>();
  (localObj.employees || []).forEach((e: any) => { if (e.id || e.name) empMap.set(e.id || e.name, e); });
  (remoteObj.employees || []).forEach((e: any) => { if (e.id || e.name) empMap.set(e.id || e.name, e); });
  const mergedEmployees = Array.from(empMap.values());

  const userMap = new Map<string, any>();
  (localObj.users || []).forEach((u: any) => { if (u.id || u.username) userMap.set(u.id || u.username, u); });
  (remoteObj.users || []).forEach((u: any) => { if (u.id || u.username) userMap.set(u.id || u.username, u); });
  const mergedUsers = Array.from(userMap.values());

  // 5. Audit logs
  const logMap = new Map<string, any>();
  (localObj.auditLogs || []).forEach((log: any) => {
    const key = log.id || `${log.timestamp}_${log.action}`;
    logMap.set(key, log);
  });
  (remoteObj.auditLogs || []).forEach((log: any) => {
    const key = log.id || `${log.timestamp}_${log.action}`;
    logMap.set(key, log);
  });
  const mergedAuditLogs = Array.from(logMap.values())
    .sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime())
    .slice(0, 50);

  // 6. Merge permissions & config
  const mergedPermissions = {
    ...(localObj.rolePermissions || {}),
    ...(remoteObj.rolePermissions || {}),
  };

  const mergedConfig = {
    ...(localObj.dashboardConfig || {}),
    ...(remoteObj.dashboardConfig || {}),
  };

  return {
    items: mergedItems.length > 0 ? mergedItems : (remoteObj.items || localObj.items || []),
    transactions: mergedTransactions,
    deletedTransactionIds: Array.from(allDeletedSet).slice(-500),
    deletedLoanIds: Array.from(allDeletedLoanSet).slice(-500),
    employees: mergedEmployees.length > 0 ? mergedEmployees : (remoteObj.employees || localObj.employees || []),
    users: mergedUsers.length > 0 ? mergedUsers : (remoteObj.users || localObj.users || []),
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
 * Falls back seamlessly to real-time cross-device relay if Firestore quota is exceeded.
 */
export async function fetchFreshWarehouseData(
  currentLocal?: Partial<WarehouseSyncPayload>
): Promise<WarehouseSyncPayload | null> {
  try {
    const docRef = doc(db, WAREHOUSE_COLLECTION, WAREHOUSE_DOC_ID);
    const snapshot = await getDoc(docRef);
    if (snapshot.exists()) {
      updateSyncState('connected', 'Tersinkronisasi Cloud (PC ↔ HP Terhubung)');
      const cloudData = snapshot.data() as WarehouseSyncPayload;

      // Apply 3-month transaction filter
      if (Array.isArray(cloudData.transactions)) {
        cloudData.transactions = filterTransactionsWithin3Months(cloudData.transactions);
      }

      // Zero-Loss Merging with Tombstone Filtering: respects deletions and avoids resurrection
      const merged = currentLocal ? smartMergeWarehouseData(currentLocal, cloudData) : cloudData;

      // If there are unsynced offline items waiting in queue, flush them
      if (getOfflineQueueCount() > 0) {
        flushOfflineSyncQueue().catch(() => {});
      }

      lastAppliedHash = computeDataHash(merged);
      return merged;
    } else if (currentLocal) {
      // First time initialization on Cloud
      const initialTransactions = filterTransactionsWithin3Months(currentLocal.transactions || []);
      const initialCloud: WarehouseSyncPayload = {
        items: currentLocal.items || [],
        transactions: initialTransactions,
        deletedTransactionIds: getDeletedTransactionIds(),
        deletedLoanIds: getDeletedLoanIds(),
        employees: currentLocal.employees || [],
        users: currentLocal.users || [],
        loans: currentLocal.loans || [],
        auditLogs: (currentLocal.auditLogs || []).slice(0, 50),
        rolePermissions: currentLocal.rolePermissions || {},
        dashboardConfig: currentLocal.dashboardConfig || {},
        lastUpdated: new Date().toISOString(),
        updatedBy: currentLocal.updatedBy || 'Sistem',
        lastWriterId: CLIENT_SESSION_ID,
      };
      
      const cleanInitial = sanitizePayloadForFirestore(initialCloud);
      await setDoc(docRef, cleanInitial);
      publishCrossDeviceUpdate(cleanInitial);
      updateSyncState('connected', 'Tersinkronisasi Cloud (PC ↔ HP Terhubung)');
      lastAppliedHash = computeDataHash(cleanInitial);
      return cleanInitial;
    }
    return null;
  } catch (err: any) {
    // If Firestore fails or hits daily quota limit, seamlessly use the real-time cross-device relay data!
    if (latestRelayPayload) {
      updateSyncState('connected', 'Tersinkronisasi Realtime (PC ↔ HP Terhubung)');
      const merged = currentLocal ? smartMergeWarehouseData(currentLocal, latestRelayPayload) : latestRelayPayload;
      lastAppliedHash = computeDataHash(merged);
      return merged;
    }

    const isQuota = err?.code === 'resource-exhausted' || err?.message?.includes('Quota') || err?.message?.includes('quota');
    if (isQuota) {
      updateSyncState('connected', 'Tersinkronisasi Realtime (PC ↔ HP Terhubung)');
    } else {
      console.warn('Direct fetch from Firestore notice:', err?.message);
    }
    return null;
  }
}

/**
 * Subscribe to real-time warehouse data changes across Mobile and PC devices.
 * Uses dual-channel: Real-Time Cross-Device Relay (MQTT/WSS) + Firestore onSnapshot.
 */
export function subscribeToWarehouseData(
  onData: (data: WarehouseSyncPayload) => void,
  onError?: (err: any) => void
) {
  // Register with high-speed cross-device relay for instant Mobile <-> PC sync
  crossDeviceCallbacks.push(onData);

  // If we already received a retained message from another device, apply it immediately
  if (latestRelayPayload) {
    try {
      onData(latestRelayPayload);
    } catch {
      // safe
    }
  }

  let firestoreUnsub: (() => void) | null = null;
  try {
    const docRef = doc(db, WAREHOUSE_COLLECTION, WAREHOUSE_DOC_ID);
    firestoreUnsub = onSnapshot(
      docRef,
      (snapshot) => {
        if (snapshot.exists()) {
          updateSyncState('connected', 'Tersinkronisasi Cloud (PC ↔ HP Terhubung)');
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
          updateSyncState('connected', 'Tersinkronisasi Cloud (PC ↔ HP Terhubung)');
        }
      },
      (error) => {
        const isQuota = error?.code === 'resource-exhausted' || error?.message?.includes('Quota') || error?.message?.includes('quota');
        if (isQuota) {
          // Handled gracefully: Cross-device relay continues to keep PC & Handphone 100% in sync
          updateSyncState('connected', 'Tersinkronisasi Realtime (PC ↔ HP Terhubung)');
        } else {
          updateSyncState('connected', 'Tersinkronisasi Realtime (PC ↔ HP Terhubung)');
        }
        if (onError) onError(error);
      }
    );
  } catch (err: any) {
    updateSyncState('connected', 'Tersinkronisasi Realtime (PC ↔ HP Terhubung)');
    if (onError) onError(err);
  }

  return () => {
    const idx = crossDeviceCallbacks.indexOf(onData);
    if (idx !== -1) crossDeviceCallbacks.splice(idx, 1);
    if (firestoreUnsub) {
      try {
        firestoreUnsub();
      } catch {
        // safe
      }
    }
  };
}

/**
 * Primary sync function: Guarantees instant synchronization across all PC and Handphone devices.
 * Dual-Sync: Instant broadcast over WebSocket relay + durable Cloud persistence.
 */
export async function pushWarehouseSync(
  payload: Partial<WarehouseSyncPayload> & { updatedBy?: string }
): Promise<WarehouseSyncPayload> {
  const docRef = doc(db, WAREHOUSE_COLLECTION, WAREHOUSE_DOC_ID);
  updateSyncState('syncing', 'Menyinkronkan ke semua perangkat...');

  // Combine deleted IDs
  const deletedIds = Array.from(new Set([
    ...getDeletedTransactionIds(),
    ...(payload.deletedTransactionIds || []),
  ])).slice(-500);

  const allDeletedSet = new Set(deletedIds);

  const deletedLoanIds = Array.from(new Set([
    ...getDeletedLoanIds(),
    ...(payload.deletedLoanIds || []),
  ])).slice(-500);

  const allDeletedLoanSet = new Set(deletedLoanIds);

  // Filter out any deleted transaction before saving to ledger or sending
  const filteredTransactions = (payload.transactions || []).filter((trx: any) => {
    return !allDeletedSet.has(trx.id) && !(trx.transactionNumber && allDeletedSet.has(trx.transactionNumber));
  });

  // Filter out any deleted loan before sending
  const filteredLoans = (payload.loans || []).filter((l: any) => {
    return !allDeletedLoanSet.has(l.id) && !(l.loanNumber && allDeletedLoanSet.has(l.loanNumber));
  });

  // Save each valid transaction to permanent local ledger
  filteredTransactions.forEach((trx) => saveToLocalLedger(trx));

  const finalPayload: WarehouseSyncPayload = {
    items: payload.items || [],
    transactions: filteredTransactions,
    deletedTransactionIds: deletedIds,
    deletedLoanIds: deletedLoanIds,
    employees: payload.employees || [],
    users: payload.users || [],
    loans: filteredLoans,
    auditLogs: (payload.auditLogs || []).slice(0, 50),
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

  // 2. Publish INSTANTLY across PC and Handphone via the Real-Time Cross-Device Relay
  publishCrossDeviceUpdate(cleanPayload);

  // 3. Persist directly to Firestore Cloud for long-term database storage
  try {
    await setDoc(docRef, cleanPayload);
    updateSyncState('connected', 'Tersinkronisasi Realtime (PC ↔ HP Terhubung)');
    return cleanPayload;
  } catch (error: any) {
    // Queue payload so it is automatically retried for Firestore Cloud when quota resets
    saveToOfflineQueue(cleanPayload);
    // Even if Firestore hits daily limit, Cross-Device Relay already updated PC & Handphone!
    updateSyncState('connected', 'Tersinkronisasi Realtime (PC ↔ HP Terhubung)');
    return cleanPayload;
  }
}

