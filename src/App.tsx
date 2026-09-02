import React, { useState, useEffect, useRef } from 'react';
import { 
  Package, 
  ArrowUpRight, 
  ArrowDownLeft, 
  History, 
  LayoutDashboard, 
  Printer, 
  Menu, 
  X, 
  Bell,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Image as ImageIcon,
  Users,
  ShieldCheck,
  Crown,
  Wrench,
  Sparkles,
  SlidersHorizontal,
  FileSpreadsheet,
  ScanLine,
  FileCheck2,
  Lock,
  Layers,
  Search,
  LogOut,
  HandHelping,
  RefreshCw,
  Cloud
} from 'lucide-react';
import { 
  Item, 
  Transaction, 
  Employee, 
  UserAccount, 
  ItemLoan, 
  AuditLogEntry, 
  DashboardConfig, 
  UserRole,
  UserPermissions 
} from './types';
import { 
  INITIAL_ITEMS, 
  INITIAL_TRANSACTIONS, 
  INITIAL_EMPLOYEES, 
  INITIAL_USERS, 
  INITIAL_LOANS, 
  INITIAL_AUDIT_LOGS, 
  DEFAULT_DASHBOARD_CONFIG 
} from './data/initialData';

import { DashboardOverview } from './components/DashboardOverview';
import { SubHeaderNavigation, MainTabType } from './components/SubHeaderNavigation';
import { ItemRequestView } from './components/ItemRequestView';
import { IncomingGoodsView } from './components/IncomingGoodsView';
import { ItemMasterView } from './components/ItemMasterView';
import { TransactionsHistoryView } from './components/TransactionsHistoryView';
import { ItemLoanView } from './components/ItemLoanView';
import { LoginView } from './components/LoginView';

import { BarcodeScannerModal } from './components/BarcodeScannerModal';
import { BarcodeSheetModal, BarcodePrintMode } from './components/BarcodeSheetModal';
import { CompanyLogo } from './components/CompanyLogo';
import { LogoSettingsModal } from './components/LogoSettingsModal';
import { EmployeeDatabaseModal } from './components/EmployeeDatabaseModal';
import { UserManagementModal, DEFAULT_ROLE_PERMISSIONS } from './components/UserManagementModal';
import { AuditTrailModal } from './components/AuditTrailModal';
import { DashboardSettingsModal } from './components/DashboardSettingsModal';
import { RoleSwitcherModal } from './components/RoleSwitcherModal';
import { ConfirmationModal } from './components/ConfirmationModal';
import { NotificationApprovalModal } from './components/NotificationApprovalModal';
import { ProfessionalStatsReportModal } from './components/ProfessionalStatsReportModal';
import { GoogleSheetsModal } from './components/GoogleSheetsModal';
import { PublicRequestPortalView } from './components/PublicRequestPortalView';
import { 
  subscribeToWarehouseData, 
  pushWarehouseSync, 
  fetchFreshWarehouseData,
  subscribeToCrossTabSync,
  smartMergeWarehouseData,
  onSyncStatusChange, 
  SyncState,
  WarehouseSyncPayload 
} from './utils/firebaseSync';
import { playNotificationChime, triggerBrowserNotification } from './utils/helpers';
import { 
  getThemeConfig, 
  getFontFamilyStyle, 
  getDensityContainerClass, 
  getPageBackground 
} from './utils/themeStyles';

const STORAGE_KEY_ITEMS = 'ga_warehouse_items_v8';
const STORAGE_KEY_TRANSACTIONS = 'ga_warehouse_transactions_v8';
const STORAGE_KEY_EMPLOYEES = 'ga_warehouse_employees_v8';
const STORAGE_KEY_USERS = 'ga_warehouse_users_v8';
const STORAGE_KEY_CURRENT_USER = 'ga_warehouse_current_user_v8';
const STORAGE_KEY_LOANS = 'ga_warehouse_loans_v8';
const STORAGE_KEY_AUDIT = 'ga_warehouse_audit_v8';
const STORAGE_KEY_CONFIG = 'ga_warehouse_config_v8';

export default function App() {
  // Helper to validate and ensure users list is safe, clean, and retains user deletions
  const sanitizeUsersList = (savedList: any): UserAccount[] => {
    if (Array.isArray(savedList) && savedList.length > 0) {
      const valid = savedList.filter(
        (u) => u && typeof u === 'object' && u.id && u.username
      );
      if (valid.length > 0) {
        return valid;
      }
    }
    return INITIAL_USERS;
  };

  // Helper to normalize and ensure rack location is clean Gudang GA or Gudang Kayu
  const sanitizeItemsList = (list: any[]): Item[] => {
    if (!Array.isArray(list)) return INITIAL_ITEMS;
    return list.map((item) => ({
      ...item,
      rackLocation: item.rackLocation && item.rackLocation.toLowerCase().includes('kayu') ? 'Gudang Kayu' : 'Gudang GA',
    }));
  };

  // 1. Core items database
  const [items, setItems] = useState<Item[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_ITEMS) || localStorage.getItem('ga_warehouse_items_v6');
      return saved ? sanitizeItemsList(JSON.parse(saved)) : sanitizeItemsList(INITIAL_ITEMS);
    } catch {
      return sanitizeItemsList(INITIAL_ITEMS);
    }
  });

  // 2. Transactions log
  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_TRANSACTIONS) || localStorage.getItem('ga_warehouse_transactions_v6');
      return saved ? JSON.parse(saved) : INITIAL_TRANSACTIONS;
    } catch {
      return INITIAL_TRANSACTIONS;
    }
  });

  // 3. Employees list
  const [employees, setEmployees] = useState<Employee[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_EMPLOYEES);
      return saved ? JSON.parse(saved) : INITIAL_EMPLOYEES;
    } catch {
      return INITIAL_EMPLOYEES;
    }
  });

  // 4. User accounts & RBAC
  const [users, setUsers] = useState<UserAccount[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_USERS) || localStorage.getItem('ga_warehouse_users_v6') || localStorage.getItem('ga_warehouse_users_v7');
      if (saved) {
        const parsed = JSON.parse(saved);
        return sanitizeUsersList(parsed);
      }
      return INITIAL_USERS;
    } catch {
      return INITIAL_USERS;
    }
  });

  const [currentUser, setCurrentUser] = useState<UserAccount>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_CURRENT_USER);
      if (saved) return JSON.parse(saved);
      return INITIAL_USERS[0]; // Default to Master Admin
    } catch {
      return INITIAL_USERS[0];
    }
  });

  // 5. Item loans
  const [loans, setLoans] = useState<ItemLoan[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_LOANS);
      return saved ? JSON.parse(saved) : INITIAL_LOANS;
    } catch {
      return INITIAL_LOANS;
    }
  });

  // 6. Audit logs
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_AUDIT);
      return saved ? JSON.parse(saved) : INITIAL_AUDIT_LOGS;
    } catch {
      return INITIAL_AUDIT_LOGS;
    }
  });

  // 7. Dashboard & system customization settings
  const [dashboardConfig, setDashboardConfig] = useState<DashboardConfig>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_CONFIG);
      return saved ? JSON.parse(saved) : DEFAULT_DASHBOARD_CONFIG;
    } catch {
      return DEFAULT_DASHBOARD_CONFIG;
    }
  });

  // Login & Session state (Ensures Login screen opens first when deployed to Netlify / on first open)
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('ga_warehouse_is_logged_in');
      return saved === 'true'; // strictly false on first load or after logout
    } catch {
      return false;
    }
  });

  // Role Permissions Matrix state (Requirement 3, 6, 7, 12)
  const STORAGE_KEY_ROLE_PERMS = 'ga_warehouse_role_perms_v7';
  const [rolePermissions, setRolePermissions] = useState<Record<UserRole, UserPermissions>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_ROLE_PERMS);
      return saved ? JSON.parse(saved) : DEFAULT_ROLE_PERMISSIONS;
    } catch {
      return DEFAULT_ROLE_PERMISSIONS;
    }
  });

  const handleUpdateRolePermissions = (newPerms: Record<UserRole, UserPermissions>) => {
    setRolePermissions(newPerms);
    try {
      localStorage.setItem(STORAGE_KEY_ROLE_PERMS, JSON.stringify(newPerms));
    } catch {}

    // Update all users in state and sync their permissions based on role
    const updatedUsers = users.map((u) => ({
      ...u,
      permissions: newPerms[u.role] || DEFAULT_ROLE_PERMISSIONS[u.role],
    }));
    setUsers(updatedUsers);

    // If current logged-in user is affected, update active session permissions immediately
    if (currentUser) {
      const updatedCurrentUser: UserAccount = {
        ...currentUser,
        permissions: newPerms[currentUser.role] || DEFAULT_ROLE_PERMISSIONS[currentUser.role],
      };
      setCurrentUser(updatedCurrentUser);
      try {
        localStorage.setItem(STORAGE_KEY_CURRENT_USER, JSON.stringify(updatedCurrentUser));
      } catch {}
    }

    // Immediately push to Cloud Firestore so all mobile/desktop devices receive it in real-time
    syncToCloud({ rolePermissions: newPerms, users: updatedUsers });
    logAudit('Update Matriks Hak Akses', 'USERS', `Master Admin memperbarui matriks hak akses akun & modul`);
    showToast('Hak akses modul & akun berhasil disimpan & tersinkronisasi ke seluruh perangkat.', 'success');
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    try {
      localStorage.setItem('ga_warehouse_is_logged_in', 'false');
      localStorage.removeItem(STORAGE_KEY_CURRENT_USER);
    } catch {}
    showToast('Anda telah berhasil keluar dari sistem.', 'info');
  };

  // Active navigation tab with persistence so inspections never get lost/reset
  const [activeTab, setActiveTab] = useState<MainTabType>(() => {
    try {
      const saved = localStorage.getItem('ga_warehouse_active_tab');
      if (saved && ['dashboard', 'request', 'incoming', 'stock', 'loans', 'transactions'].includes(saved)) {
        return saved as MainTabType;
      }
    } catch {}
    return 'dashboard';
  });

  const handleTabChange = (tab: MainTabType) => {
    setActiveTab(tab);
    try {
      localStorage.setItem('ga_warehouse_active_tab', tab);
    } catch {}
  };

  // Modals state
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isBarcodeSheetOpen, setIsBarcodeSheetOpen] = useState(false);
  const [barcodePrintMode, setBarcodePrintMode] = useState<BarcodePrintMode>('ALL');
  const [isLogoModalOpen, setIsLogoModalOpen] = useState(false);
  const [isEmployeeModalOpen, setIsEmployeeModalOpen] = useState(false);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isRoleSwitcherOpen, setIsRoleSwitcherOpen] = useState(false);
  const [isResetSampleConfirmOpen, setIsResetSampleConfirmOpen] = useState(false);
  const [isNotificationModalOpen, setIsNotificationModalOpen] = useState(false);
  const [isStatsModalOpen, setIsStatsModalOpen] = useState(false);
  const [isGoogleSheetsModalOpen, setIsGoogleSheetsModalOpen] = useState(false);

  // Self-Service Public Request Portal state (Accessed via QR Code or URL without login)
  const [isPublicPortalOpen, setIsPublicPortalOpen] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      return urlParams.get('portal') === 'request' || window.location.hash.includes('portal=request');
    }
    return false;
  });

  // Cross-modal selected item for request
  const [selectedScannedItem, setSelectedScannedItem] = useState<Item | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Toast notification
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'info' | 'warning' } | null>(null);
  const [syncState, setSyncState] = useState<SyncState>('connected');

  // Multi-Device Cloud Synchronization Engine references
  const isInitialCloudLoaded = useRef<boolean>(false);
  const isRemoteUpdate = useRef<boolean>(false);

  // Keep fresh state references for real-time listeners and multi-tab broadcasts
  const latestStateRef = useRef({
    items,
    transactions,
    employees,
    users,
    loans,
    auditLogs,
    rolePermissions,
    dashboardConfig,
    currentUser,
  });

  useEffect(() => {
    latestStateRef.current = {
      items,
      transactions,
      employees,
      users,
      loans,
      auditLogs,
      rolePermissions,
      dashboardConfig,
      currentUser,
    };
  }, [items, transactions, employees, users, loans, auditLogs, rolePermissions, dashboardConfig, currentUser]);

  // Helper to immediately push authoritative state to Cloud Firestore
  const syncToCloud = (overrides?: Partial<WarehouseSyncPayload>) => {
    const current = latestStateRef.current;
    const payload: Partial<WarehouseSyncPayload> & { updatedBy: string } = {
      items: overrides?.items !== undefined ? overrides.items : current.items,
      transactions: overrides?.transactions !== undefined ? overrides.transactions : current.transactions,
      employees: overrides?.employees !== undefined ? overrides.employees : current.employees,
      users: overrides?.users !== undefined ? overrides.users : current.users,
      loans: overrides?.loans !== undefined ? overrides.loans : current.loans,
      auditLogs: overrides?.auditLogs !== undefined ? overrides.auditLogs : current.auditLogs,
      rolePermissions: overrides?.rolePermissions !== undefined ? overrides.rolePermissions : current.rolePermissions,
      dashboardConfig: overrides?.dashboardConfig !== undefined ? overrides.dashboardConfig : current.dashboardConfig,
      updatedBy: current.currentUser?.fullName || 'Sistem',
    };
    pushWarehouseSync(payload).catch((err) => {
      console.warn('Immediate Firestore sync error:', err?.message);
    });
  };

  // Manual refresh from Cloud button handler (Bidirectional smart merge so nothing is ever lost)
  const handleManualRefreshCloud = async () => {
    showToast('Menghubungkan & menyinkronkan data Cloud Firestore...', 'info');
    try {
      const current = latestStateRef.current;
      const cloudData = await fetchFreshWarehouseData({
        items: current.items,
        transactions: current.transactions,
        employees: current.employees,
        users: current.users,
        loans: current.loans,
        auditLogs: current.auditLogs,
        rolePermissions: current.rolePermissions,
        dashboardConfig: current.dashboardConfig,
      });
      if (cloudData) {
        if (Array.isArray(cloudData.items)) setItems(cloudData.items);
        if (Array.isArray(cloudData.transactions)) setTransactions(cloudData.transactions);
        if (Array.isArray(cloudData.employees)) setEmployees(cloudData.employees);
        if (Array.isArray(cloudData.users)) setUsers(sanitizeUsersList(cloudData.users));
        if (Array.isArray(cloudData.loans)) setLoans(cloudData.loans);
        if (Array.isArray(cloudData.auditLogs)) setAuditLogs(cloudData.auditLogs);
        if (cloudData.rolePermissions) setRolePermissions(cloudData.rolePermissions);
        if (cloudData.dashboardConfig) setDashboardConfig(cloudData.dashboardConfig);
        isInitialCloudLoaded.current = true;
        showToast(
          `Sinkronisasi Cloud berhasil! ${cloudData.transactions?.length || 0} transaksi & ${cloudData.items?.length || 0} barang tersinkronisasi aman.`,
          'success'
        );
      } else {
        showToast('Data lokal sudah tersimpan & terbarui di Cloud.', 'info');
      }
    } catch (err: any) {
      showToast('Gagal memuat dari Cloud: ' + (err?.message || 'Koneksi offline'), 'warning');
    }
  };

  // Track Firestore connection and real-time synchronization state
  useEffect(() => {
    const unsubscribeSync = onSyncStatusChange((state) => {
      setSyncState(state);
    });
    return () => unsubscribeSync();
  }, []);

  // 1. Subscribe to instant cross-tab broadcast (0ms multi-account sync e.g. Wardhana -> Master Admin)
  useEffect(() => {
    const unsubscribeCrossTab = subscribeToCrossTabSync((incomingData) => {
      if (incomingData) {
        if (Array.isArray(incomingData.items)) setItems(sanitizeItemsList(incomingData.items));
        if (Array.isArray(incomingData.transactions)) setTransactions(incomingData.transactions);
        if (Array.isArray(incomingData.employees)) setEmployees(incomingData.employees);
        if (Array.isArray(incomingData.users)) setUsers(sanitizeUsersList(incomingData.users));
        if (Array.isArray(incomingData.loans)) setLoans(incomingData.loans);
        if (Array.isArray(incomingData.auditLogs)) setAuditLogs(incomingData.auditLogs);
        if (incomingData.rolePermissions) setRolePermissions(incomingData.rolePermissions);
        if (incomingData.dashboardConfig) setDashboardConfig(incomingData.dashboardConfig);
      }
    });

    // Initial cloud fetch on startup to establish connection & pull/merge latest cloud transactions
    const initStartupSync = async () => {
      try {
        const current = latestStateRef.current;
        const cloudData = await fetchFreshWarehouseData({
          items: current.items,
          transactions: current.transactions,
          employees: current.employees,
          users: current.users,
          loans: current.loans,
          auditLogs: current.auditLogs,
          rolePermissions: current.rolePermissions,
          dashboardConfig: current.dashboardConfig,
        });
        if (cloudData) {
          if (Array.isArray(cloudData.items)) setItems(sanitizeItemsList(cloudData.items));
          if (Array.isArray(cloudData.transactions)) setTransactions(cloudData.transactions);
          if (Array.isArray(cloudData.employees)) setEmployees(cloudData.employees);
          if (Array.isArray(cloudData.users)) setUsers(sanitizeUsersList(cloudData.users));
          if (Array.isArray(cloudData.loans)) setLoans(cloudData.loans);
          if (Array.isArray(cloudData.auditLogs)) setAuditLogs(cloudData.auditLogs);
          if (cloudData.rolePermissions) setRolePermissions(cloudData.rolePermissions);
          if (cloudData.dashboardConfig) setDashboardConfig(cloudData.dashboardConfig);
        }
        isInitialCloudLoaded.current = true;
      } catch (e) {
        console.warn('Initial cloud sync notice:', e);
      }
    };
    initStartupSync();

    return () => {
      unsubscribeCrossTab();
    };
  }, []);

  // 2. Subscribe to real-time Firestore database updates across all devices & laptops
  useEffect(() => {
    const unsubscribe = subscribeToWarehouseData((cloudData) => {
      if (cloudData) {
        const prevTrx = latestStateRef.current.transactions || [];
        const prevTrxIds = new Set(prevTrx.map((t) => t.id || t.transactionNumber));
        const newTrxList = cloudData.transactions || [];

        // Detect newly created transactions from other devices
        const newlyAddedTrx = newTrxList.filter(
          (t: any) => !prevTrxIds.has(t.id || t.transactionNumber)
        );

        // Detect status changes on existing transactions (e.g. Approved / Rejected)
        const newlyApprovedTrx = newTrxList.filter((t: any) => {
          const old = prevTrx.find((p) => (p.id || p.transactionNumber) === (t.id || t.transactionNumber));
          return old && old.status === 'PENDING' && (t.status === 'APPROVED' || t.status === 'COMPLETED');
        });

        // If new transactions arrived from another phone/laptop
        if (newlyAddedTrx.length > 0) {
          playNotificationChime();
          const firstNew = newlyAddedTrx[0];
          const isPending = firstNew.status === 'PENDING';
          const notifTitle = isPending ? '🔔 Permintaan Barang Baru' : '🔔 Transaksi Barang Baru';
          const notifBody = `${firstNew.transactionNumber} - ${firstNew.requesterName || firstNew.supplier || 'Petugas'} (${firstNew.department || 'Gudang'})`;
          
          triggerBrowserNotification(notifTitle, notifBody);
          showToast(
            `${notifTitle}: [${firstNew.transactionNumber}] oleh ${firstNew.requesterName || firstNew.supplier || 'Petugas'}${isPending ? ' menunggu Persetujuan Admin' : ''}`,
            isPending ? 'info' : 'success'
          );
        } else if (newlyApprovedTrx.length > 0) {
          playNotificationChime();
          const firstApproved = newlyApprovedTrx[0];
          const notifTitle = '✅ Permintaan Disetujui';
          const notifBody = `${firstApproved.transactionNumber} telah disetujui Admin. Siap diserahkan.`;
          triggerBrowserNotification(notifTitle, notifBody);
          showToast(`✅ Permintaan [${firstApproved.transactionNumber}] telah disetujui!`, 'success');
        }

        // Unconditionally update all React state so laptop/phone displays fresh data immediately
        if (Array.isArray(cloudData.items)) setItems(sanitizeItemsList(cloudData.items));
        if (Array.isArray(cloudData.transactions)) setTransactions(cloudData.transactions);
        if (Array.isArray(cloudData.employees)) setEmployees(cloudData.employees);
        if (Array.isArray(cloudData.users)) setUsers(sanitizeUsersList(cloudData.users));
        if (Array.isArray(cloudData.loans)) setLoans(cloudData.loans);
        if (Array.isArray(cloudData.auditLogs)) setAuditLogs(cloudData.auditLogs);
        if (cloudData.rolePermissions) setRolePermissions(cloudData.rolePermissions);
        if (cloudData.dashboardConfig) setDashboardConfig(cloudData.dashboardConfig);
        isInitialCloudLoaded.current = true;
      }
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // Persist states to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_ITEMS, JSON.stringify(items));
    } catch (e) {
      console.error('Save items error', e);
    }
  }, [items]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_TRANSACTIONS, JSON.stringify(transactions));
    } catch (e) {
      console.error('Save transactions error', e);
    }
  }, [transactions]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_EMPLOYEES, JSON.stringify(employees));
    } catch (e) {
      console.error('Save employees error', e);
    }
  }, [employees]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(users));
    } catch (e) {
      console.error('Save users error', e);
    }
  }, [users]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_CURRENT_USER, JSON.stringify(currentUser));
    } catch (e) {
      console.error('Save current user error', e);
    }
  }, [currentUser]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_LOANS, JSON.stringify(loans));
    } catch (e) {
      console.error('Save loans error', e);
    }
  }, [loans]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_AUDIT, JSON.stringify(auditLogs));
    } catch (e) {
      console.error('Save audit error', e);
    }
  }, [auditLogs]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(dashboardConfig));
    } catch (e) {
      console.error('Save config error', e);
    }
  }, [dashboardConfig]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_ROLE_PERMS, JSON.stringify(rolePermissions));
    } catch (e) {
      console.error('Save role perms error', e);
    }
  }, [rolePermissions]);

  // Handle Mobile / Cross-Device Reconnect & Active Heartbeat Sync
  useEffect(() => {
    const triggerSyncRefresh = () => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        const current = latestStateRef.current;
        fetchFreshWarehouseData({
          items: current.items,
          transactions: current.transactions,
          employees: current.employees,
          users: current.users,
          loans: current.loans,
          auditLogs: current.auditLogs,
          rolePermissions: current.rolePermissions,
          dashboardConfig: current.dashboardConfig,
        }).then((cloudData) => {
          if (cloudData) {
            if (Array.isArray(cloudData.items)) setItems(sanitizeItemsList(cloudData.items));
            if (Array.isArray(cloudData.transactions)) setTransactions(cloudData.transactions);
            if (Array.isArray(cloudData.employees)) setEmployees(cloudData.employees);
            if (Array.isArray(cloudData.users)) setUsers(sanitizeUsersList(cloudData.users));
            if (Array.isArray(cloudData.loans)) setLoans(cloudData.loans);
            if (Array.isArray(cloudData.auditLogs)) setAuditLogs(cloudData.auditLogs);
            if (cloudData.rolePermissions) setRolePermissions(cloudData.rolePermissions);
            if (cloudData.dashboardConfig) setDashboardConfig(cloudData.dashboardConfig);
          }
        }).catch(() => {});
      }
    };

    document.addEventListener('visibilitychange', triggerSyncRefresh);
    window.addEventListener('online', triggerSyncRefresh);
    window.addEventListener('focus', triggerSyncRefresh);

    // Active heartbeat every 4 seconds for instantaneous multi-device background update
    const heartbeatInterval = setInterval(triggerSyncRefresh, 4000);

    return () => {
      document.removeEventListener('visibilitychange', triggerSyncRefresh);
      window.removeEventListener('online', triggerSyncRefresh);
      window.removeEventListener('focus', triggerSyncRefresh);
      clearInterval(heartbeatInterval);
    };
  }, []);

  // Toast notification helper
  const showToast = (text: string, type: 'success' | 'info' | 'warning' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // Central audit log dispatcher
  const logAudit = (
    action: string, 
    targetModule: 'STOCK' | 'TRANSACTIONS' | 'LOANS' | 'USERS' | 'SETTINGS' | 'EMPLOYEES', 
    details: string
  ) => {
    const newLog: AuditLogEntry = {
      id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      userName: currentUser.fullName,
      userRole: currentUser.role,
      action,
      targetModule,
      details,
    };
    setAuditLogs((prev) => [newLog, ...(prev || []).slice(0, 499)]); // Keep last 500 logs
  };

  // Role & User operations
  const handleSwitchUser = (user: UserAccount) => {
    setCurrentUser(user);
    setIsRoleSwitcherOpen(false);
    logAudit('Ganti Profil Pengguna', 'USERS', `Pengguna aktif berganti ke ${user.fullName} (${user.role})`);
    showToast(`Aktif sebagai ${user.fullName} [${user.role.replace('_', ' ')}]`, 'info');
  };

  const handleAddUser = (newUser: UserAccount) => {
    const nextUsers = [newUser, ...users.filter(u => u.id !== newUser.id)];
    setUsers(nextUsers);
    try {
      localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(nextUsers));
    } catch (e) {
      console.error('Save users error', e);
    }
    syncToCloud({ users: nextUsers });
    logAudit('Tambah Akun Pengguna', 'USERS', `Membuat akun ${newUser.fullName} (${newUser.role})`);
    showToast(`Pengguna baru "${newUser.fullName}" berhasil didaftarkan & disinkronkan ke Cloud!`, 'success');
  };

  const handleUpdateUser = (updatedUser: UserAccount) => {
    const nextUsers = users.map((u) => (u.id === updatedUser.id ? updatedUser : u));
    setUsers(nextUsers);
    try {
      localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(nextUsers));
    } catch (e) {
      console.error('Save users error', e);
    }
    if (currentUser.id === updatedUser.id) {
      setCurrentUser(updatedUser);
      try {
        localStorage.setItem(STORAGE_KEY_CURRENT_USER, JSON.stringify(updatedUser));
      } catch (e) {
        console.error('Save current user error', e);
      }
    }
    syncToCloud({ users: nextUsers });
    logAudit('Update Akun Pengguna', 'USERS', `Memperbarui profil ${updatedUser.fullName}`);
    showToast(`Data akun "${updatedUser.fullName}" berhasil diperbarui & disinkronkan!`, 'info');
  };

  const handleDeleteUser = (userId: string) => {
    const userToDel = users.find((u) => u.id === userId);
    if (!userToDel) {
      showToast('Akun pengguna tidak ditemukan atau sudah dihapus.', 'warning');
      return;
    }

    if (userToDel.id === currentUser.id) {
      showToast('Anda tidak dapat menghapus akun yang sedang Anda gunakan saat ini.', 'warning');
      return;
    }

    const nextUsers = users.filter((u) => u.id !== userId);
    // Ensure safety: do not leave zero users
    const safeUsers = nextUsers.length > 0 ? nextUsers : [INITIAL_USERS[0]];
    
    setUsers(safeUsers);
    try {
      localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(safeUsers));
    } catch (e) {
      console.error('Save users error', e);
    }
    syncToCloud({ users: safeUsers });
    logAudit('Hapus Akun Pengguna', 'USERS', `Menghapus akun ${userToDel.fullName} (@${userToDel.username})`);
    showToast(`Akun "${userToDel.fullName}" (@${userToDel.username}) berhasil dihapus secara permanen.`, 'success');
  };

  // Dashboard Settings operations
  const handleSaveConfig = (newConfig: DashboardConfig) => {
    setDashboardConfig(newConfig);
    syncToCloud({ dashboardConfig: newConfig });
    logAudit('Update Konfigurasi Dashboard', 'SETTINGS', `Memperbarui setelan gudang & branding`);
    showToast('Konfigurasi dashboard & sistem berhasil disimpan ke Cloud!', 'success');
  };

  const handleResetConfig = () => {
    setDashboardConfig(DEFAULT_DASHBOARD_CONFIG);
    syncToCloud({ dashboardConfig: DEFAULT_DASHBOARD_CONFIG });
    logAudit('Reset Konfigurasi Dashboard', 'SETTINGS', 'Mengembalikan setelan dashboard ke default');
    showToast('Setelan dashboard dikembalikan ke default.', 'info');
  };

  const handleSaveLogo = (newLogoUrl: string | null) => {
    const nextConfig = {
      ...dashboardConfig,
      logoUrl: newLogoUrl,
    };
    setDashboardConfig(nextConfig);
    syncToCloud({ dashboardConfig: nextConfig });
    logAudit('Ganti Logo Perusahaan', 'SETTINGS', newLogoUrl ? 'Mengupload logo baru' : 'Mereset logo ke default');
    showToast(newLogoUrl ? 'Logo perusahaan berhasil diperbarui!' : 'Logo telah dikembalikan ke default.', 'success');
  };

  // Employee operations
  const handleAddEmployee = (newEmp: Employee) => {
    const nextEmployees = [newEmp, ...employees.filter(e => e.id !== newEmp.id)];
    setEmployees(nextEmployees);
    syncToCloud({ employees: nextEmployees });
    logAudit('Tambah Data Personil', 'EMPLOYEES', `Menambahkan ${newEmp.name} (${newEmp.position} - ${newEmp.department})`);
    showToast(`Data personil "${newEmp.name}" berhasil ditambahkan & disinkronkan!`, 'success');
  };

  const handleUpdateEmployee = (updatedEmp: Employee) => {
    const nextEmployees = employees.map((e) => (e.id === updatedEmp.id ? updatedEmp : e));
    setEmployees(nextEmployees);
    syncToCloud({ employees: nextEmployees });
    logAudit('Update Data Personil', 'EMPLOYEES', `Memperbarui data ${updatedEmp.name}`);
    showToast(`Data personil "${updatedEmp.name}" berhasil diperbarui.`, 'info');
  };

  const handleDeleteEmployee = (empId: string) => {
    const deleted = employees.find((e) => e.id === empId);
    const nextEmployees = employees.filter((e) => e.id !== empId);
    setEmployees(nextEmployees);
    syncToCloud({ employees: nextEmployees });
    logAudit('Hapus Data Personil', 'EMPLOYEES', `Menghapus ${deleted?.name || empId}`);
    showToast(`Personil "${deleted?.name || empId}" telah dihapus dari database.`, 'warning');
  };

  const handleResetEmployees = () => {
    setEmployees(INITIAL_EMPLOYEES);
    syncToCloud({ employees: INITIAL_EMPLOYEES });
    logAudit('Reset Database Personil', 'EMPLOYEES', 'Memulihkan data 114 karyawan awal');
    showToast('Database personil telah di-reset ke data master awal (114 nama).', 'info');
  };

  // Barcode scan quick handler
  const handleBarcodeScanned = (scannedItem: Item) => {
    setIsScannerOpen(false);
    setSelectedScannedItem(scannedItem);
    setActiveTab('request');
    logAudit('Scan Barcode', 'STOCK', `Scan barcode item ${scannedItem.code} (${scannedItem.name})`);
    showToast(`Barcode ${scannedItem.code} (${scannedItem.name}) berhasil di-scan! Menuju formulir permintaan.`, 'success');
  };

  const handleDirectItemRequest = (item: Item) => {
    setSelectedScannedItem(item);
    setActiveTab('request');
  };

  // Stock operations
  const handleAddItem = (newItem: Item) => {
    const nextItems = [newItem, ...items.filter(i => i.id !== newItem.id)];
    setItems(nextItems);
    syncToCloud({ items: nextItems });
    logAudit('Tambah Master Barang', 'STOCK', `Menambahkan barang "${newItem.name}" (${newItem.code}) stok awal: ${newItem.currentStock} ${newItem.unit}`);
    showToast(`Barang baru "${newItem.name}" (${newItem.code}) berhasil ditambahkan & disinkronkan!`, 'success');
  };

  const handleBulkAddItems = (newItems: Item[], mode: 'append' | 'replace' = 'append') => {
    let nextItems: Item[];
    if (mode === 'replace') {
      nextItems = newItems;
      setItems(nextItems);
      syncToCloud({ items: nextItems });
      logAudit('Import Excel (Replace)', 'STOCK', `Mengganti seluruh katalog dengan ${newItems.length} barang baru`);
      showToast(`Berhasil mengimpor ${newItems.length} data barang (semua diganti)!`, 'success');
    } else {
      const existingCodes = new Set(items.map(p => p.code.toLowerCase()));
      nextItems = [...newItems, ...items.filter(p => !newItems.some(n => n.id === p.id || n.code.toLowerCase() === p.code.toLowerCase()))];
      setItems(nextItems);
      syncToCloud({ items: nextItems });
      logAudit('Import Excel (Append)', 'STOCK', `Menambahkan ${newItems.length} data barang dari Excel/CSV`);
      showToast(`Berhasil mengimpor ${newItems.length} data barang baru!`, 'success');
    }
  };

  const handleUpdateItem = (updated: Item) => {
    const nextItems = items.map((item) => (item.id === updated.id ? updated : item));
    setItems(nextItems);
    syncToCloud({ items: nextItems });
    logAudit('Update Master Barang', 'STOCK', `Memperbarui item ${updated.name} (${updated.code})`);
    showToast(`Data barang "${updated.name}" berhasil diperbarui.`, 'info');
  };

  const handleDeleteItem = (itemId: string) => {
    const deleted = items.find((i) => i.id === itemId);
    const nextItems = items.filter((item) => item.id !== itemId);
    setItems(nextItems);
    syncToCloud({ items: nextItems });
    logAudit('Hapus Master Barang', 'STOCK', `Menghapus item ${deleted?.name || itemId} (${deleted?.code})`);
    showToast(`Barang "${deleted?.name || itemId}" telah dihapus.`, 'warning');
  };

  const handleClearAllStock = () => {
    const nextItems = items.map((item) => ({
      ...item,
      currentStock: 0,
      updatedAt: new Date().toISOString(),
    }));
    setItems(nextItems);
    syncToCloud({ items: nextItems });
    logAudit('Kosongkan Stok (0)', 'STOCK', 'Master Admin mereset seluruh kuantitas stok fisik menjadi 0');
    showToast('Seluruh jumlah stok barang telah dikosongkan (0).', 'info');
  };

  const handleDeleteAllStockItems = () => {
    setItems([]);
    syncToCloud({ items: [] });
    logAudit('Hapus Semua Data Barang', 'STOCK', 'Master Admin menghapus bersih seluruh katalog master barang');
    showToast('Seluruh data master barang telah dihapus bersih dari database.', 'warning');
  };

  // Transaction submission (IN & OUT) with instant Cloud broadcast
  const handleSubmitTransaction = (newTrx: Transaction) => {
    const nowIso = new Date().toISOString();
    // If autoApproveRequests is active in dashboardConfig, automatically approve OUT requests
    let finalTrx = { 
      ...newTrx,
      updatedAt: nowIso,
    };
    if (newTrx.type === 'OUT' && dashboardConfig.autoApproveRequests && newTrx.status === 'PENDING') {
      finalTrx = {
        ...newTrx,
        status: 'APPROVED',
        updatedAt: nowIso,
        approvalInfo: {
          status: 'APPROVED',
          approvedBy: 'Sistem (Auto-Approve Aktif)',
          approverRole: 'MASTER_ADMIN',
          approvedAt: nowIso,
          notes: 'Disetujui otomatis oleh kebijakan sistem',
        },
      };
    }

    const isPendingApproval = finalTrx.type === 'OUT' && finalTrx.status === 'PENDING';
    let nextItems = items;

    if (!isPendingApproval) {
      nextItems = items.map((item) => {
        const trxItem = finalTrx.items.find((i) => i.itemId === item.id);
        if (trxItem) {
          if (finalTrx.type === 'OUT') {
            const newStock = Math.max(0, item.currentStock - trxItem.quantity);
            return { ...item, currentStock: newStock, updatedAt: nowIso };
          } else {
            const newStock = item.currentStock + trxItem.quantity;
            return { ...item, currentStock: newStock, updatedAt: nowIso };
          }
        }
        return item;
      });
      setItems(nextItems);
    }

    const nextTrx = [finalTrx, ...transactions];
    setTransactions(nextTrx);

    // Broadcast immediately to Firestore so other phones/devices see it instantly!
    syncToCloud({ items: nextItems, transactions: nextTrx });

    if (finalTrx.type === 'OUT') {
      logAudit(
        isPendingApproval ? 'Pengajuan Permintaan Barang' : 'Barang Keluar',
        'TRANSACTIONS',
        `Permintaan [${finalTrx.transactionNumber}] oleh ${finalTrx.requesterName} (${finalTrx.department}) status: ${finalTrx.status || 'COMPLETED'}`
      );
      showToast(
        isPendingApproval 
          ? `Permintaan [${finalTrx.transactionNumber}] tersimpan & menunggu verifikasi Admin.` 
          : `Permintaan [${finalTrx.transactionNumber}] berhasil diproses! Stok terpotong otomatis.`,
        'success'
      );
    } else {
      logAudit('Barang Masuk', 'TRANSACTIONS', `Penerimaan restock [${finalTrx.transactionNumber}] dari ${finalTrx.supplier || 'Vendor'}`);
      showToast(`Penerimaan barang [${finalTrx.transactionNumber}] berhasil dicatat! Stok bertambah.`, 'success');
    }
  };

  // Approval Handlers with immediate Cloud sync
  const handleApproveRequest = (trxId: string, notes?: string) => {
    const trx = transactions.find(t => t.id === trxId);
    if (!trx) return;

    const nowIso = new Date().toISOString();
    const nextTrx = transactions.map(t => {
      if (t.id === trxId) {
        return {
          ...t,
          status: 'APPROVED',
          updatedAt: nowIso,
          approvalInfo: {
            status: 'APPROVED',
            approvedBy: currentUser.fullName,
            approverRole: currentUser.role,
            approvedAt: nowIso,
            notes
          }
        };
      }
      return t;
    });

    setTransactions(nextTrx);
    syncToCloud({ transactions: nextTrx });

    logAudit('Approval Permintaan', 'TRANSACTIONS', `Admin menyetujui permintaan [${trx.transactionNumber}] (${trx.requesterName})`);
    showToast(`Permintaan [${trx.transactionNumber}] telah disetujui. Siap diserah-terimakan.`, 'success');
  };

  const handleRejectRequest = (trxId: string, notes?: string) => {
    const trx = transactions.find(t => t.id === trxId);
    if (!trx) return;

    const nowIso = new Date().toISOString();
    const nextTrx = transactions.map(t => {
      if (t.id === trxId) {
        return {
          ...t,
          status: 'REJECTED',
          updatedAt: nowIso,
          approvalInfo: {
            status: 'REJECTED',
            approvedBy: currentUser.fullName,
            approverRole: currentUser.role,
            approvedAt: nowIso,
            notes: notes || 'Permintaan ditolak oleh Admin'
          }
        };
      }
      return t;
    });

    setTransactions(nextTrx);
    syncToCloud({ transactions: nextTrx });

    logAudit('Penolakan Permintaan', 'TRANSACTIONS', `Admin menolak permintaan [${trx.transactionNumber}]: ${notes || '-'}`);
    showToast(`Permintaan [${trx.transactionNumber}] ditolak.`, 'warning');
  };

  const handleDispatchApprovedRequest = (trxId: string) => {
    const trx = transactions.find(t => t.id === trxId);
    if (!trx) return;

    const nowIso = new Date().toISOString();
    // Deduct stock upon actual dispatch
    const nextItems = items.map((item) => {
      const trxItem = trx.items.find((i) => i.itemId === item.id);
      if (trxItem) {
        const newStock = Math.max(0, item.currentStock - trxItem.quantity);
        return { ...item, currentStock: newStock, updatedAt: nowIso };
      }
      return item;
    });
    setItems(nextItems);

    const nextTrx = transactions.map(t => {
      if (t.id === trxId) {
        return {
          ...t,
          status: 'COMPLETED',
          updatedAt: nowIso,
          dispatchedBy: currentUser.fullName,
          dispatchedAt: nowIso,
        };
      }
      return t;
    });
    setTransactions(nextTrx);

    syncToCloud({ items: nextItems, transactions: nextTrx });

    logAudit('Serah Terima Barang', 'TRANSACTIONS', `Barang [${trx.transactionNumber}] telah diserahkan ke ${trx.requesterName}`);
    showToast(`Serah terima barang [${trx.transactionNumber}] selesai! Stok terpotong.`, 'success');
  };

  const handleDeleteTransaction = (transactionId: string, revertStock: boolean = false) => {
    const trxToDelete = transactions.find((t) => t.id === transactionId);
    if (!trxToDelete) return;

    const nowIso = new Date().toISOString();
    let nextItems = items;
    if (revertStock && trxToDelete.status !== 'REJECTED' && trxToDelete.status !== 'PENDING') {
      nextItems = items.map((item) => {
        const trxItem = trxToDelete.items.find((i) => i.itemId === item.id);
        if (trxItem) {
          if (trxToDelete.type === 'OUT') {
            return {
              ...item,
              currentStock: item.currentStock + trxItem.quantity,
              updatedAt: nowIso,
            };
          } else {
            return {
              ...item,
              currentStock: Math.max(0, item.currentStock - trxItem.quantity),
              updatedAt: nowIso,
            };
          }
        }
        return item;
      });
      setItems(nextItems);
    }

    const nextTrx = transactions.filter((t) => t.id !== transactionId);
    setTransactions(nextTrx);
    syncToCloud({ items: nextItems, transactions: nextTrx });

    logAudit('Hapus Transaksi', 'TRANSACTIONS', `Menghapus log transaksi ${trxToDelete.transactionNumber}${revertStock ? ' dengan rollback stok' : ''}`);
    showToast(
      `Transaksi [${trxToDelete.transactionNumber}] berhasil dihapus${revertStock ? ' dan stok dipulihkan' : ''}.`,
      'warning'
    );
  };

  const handleClearTransactions = (type: 'ALL' | 'IN' | 'OUT' = 'ALL') => {
    let nextTrx: Transaction[];
    if (type === 'ALL') {
      nextTrx = [];
      setTransactions([]);
      syncToCloud({ transactions: [] });
      logAudit('Hapus Semua Riwayat', 'TRANSACTIONS', 'Membersihkan seluruh log riwayat keluar & masuk');
      showToast('Seluruh riwayat transaksi log telah dikosongkan.', 'warning');
    } else {
      nextTrx = transactions.filter((t) => t.type !== type);
      setTransactions(nextTrx);
      syncToCloud({ transactions: nextTrx });
      logAudit('Hapus Riwayat Transaksi', 'TRANSACTIONS', `Membersihkan log riwayat tipe ${type}`);
      showToast(`Riwayat transaksi barang ${type === 'OUT' ? 'KELUAR' : 'MASUK'} telah dibersihkan.`, 'warning');
    }
  };

  // Item Loans operations with immediate Cloud sync
  const handleAddLoan = (newLoan: ItemLoan) => {
    const nowIso = new Date().toISOString();
    const finalLoan: ItemLoan = {
      ...newLoan,
      updatedAt: nowIso,
    };
    const nextLoans = [finalLoan, ...loans];
    setLoans(nextLoans);
    
    // Deduct stock if active
    const nextItems = items.map((it) =>
      it.id === newLoan.itemId
        ? { ...it, currentStock: Math.max(0, it.currentStock - newLoan.quantity), updatedAt: nowIso }
        : it
    );
    setItems(nextItems);

    syncToCloud({ loans: nextLoans, items: nextItems });
    logAudit('Pinjam Barang', 'LOANS', `Peminjaman "${newLoan.itemName}" (${newLoan.quantity} ${newLoan.unit}) oleh ${newLoan.borrowerName}`);
    showToast(`Peminjaman barang [${newLoan.loanNumber}] berhasil dicatat!`, 'success');
  };

  const handleReturnLoan = (
    loanId: string, 
    condition: 'BAIK' | 'RUSAK_RINGAN' | 'RUSAK_BERAT' | 'HILANG',
    notes: string
  ) => {
    const loan = loans.find((l) => l.id === loanId);
    if (!loan) return;

    const returnDateStr = new Date().toISOString().substring(0, 10);
    const nowIso = new Date().toISOString();

    const nextLoans = loans.map((l) =>
      l.id === loanId
        ? {
            ...l,
            status: 'RETURNED' as const,
            actualReturnDate: returnDateStr,
            updatedAt: nowIso,
            receivedReturnBy: currentUser.fullName,
            returnCondition: condition,
            returnNotes: notes,
          }
        : l
    );
    setLoans(nextLoans);

    // Restore stock if not lost
    let nextItems = items;
    if (condition !== 'HILANG') {
      nextItems = items.map((it) =>
        it.id === loan.itemId
          ? { ...it, currentStock: it.currentStock + loan.quantity, updatedAt: nowIso }
          : it
      );
      setItems(nextItems);
    }

    syncToCloud({ loans: nextLoans, items: nextItems });
    logAudit('Pengembalian Pinjaman', 'LOANS', `Pengembalian barang [${loan.loanNumber}] (${loan.itemName}) kondisi: ${condition}`);
    showToast(`Pengembalian barang [${loan.loanNumber}] berhasil dicatat. Stok barang dipulihkan.`, 'success');
  };

  const handleDeleteLoan = (loanId: string) => {
    const loan = loans.find((l) => l.id === loanId);
    const nextLoans = loans.filter((l) => l.id !== loanId);
    setLoans(nextLoans);
    syncToCloud({ loans: nextLoans });
    logAudit('Hapus Data Pinjaman', 'LOANS', `Menghapus arsip pinjaman ${loan?.loanNumber || loanId}`);
    showToast(`Data pinjaman [${loan?.loanNumber || loanId}] telah dihapus.`, 'warning');
  };

  // Reset all sample data to default
  const handleResetSampleData = () => {
    setItems(INITIAL_ITEMS);
    setTransactions(INITIAL_TRANSACTIONS);
    setEmployees(INITIAL_EMPLOYEES);
    setUsers(INITIAL_USERS);
    setCurrentUser(INITIAL_USERS[0]);
    setLoans(INITIAL_LOANS);
    setDashboardConfig(DEFAULT_DASHBOARD_CONFIG);
    
    localStorage.removeItem(STORAGE_KEY_ITEMS);
    localStorage.removeItem(STORAGE_KEY_TRANSACTIONS);
    localStorage.removeItem(STORAGE_KEY_EMPLOYEES);
    localStorage.removeItem(STORAGE_KEY_USERS);
    localStorage.removeItem(STORAGE_KEY_CURRENT_USER);
    localStorage.removeItem(STORAGE_KEY_LOANS);
    localStorage.removeItem(STORAGE_KEY_CONFIG);

    syncToCloud({
      items: INITIAL_ITEMS,
      transactions: INITIAL_TRANSACTIONS,
      employees: INITIAL_EMPLOYEES,
      users: INITIAL_USERS,
      loans: INITIAL_LOANS,
      dashboardConfig: DEFAULT_DASHBOARD_CONFIG,
    });

    logAudit('Reset Sample Data', 'SETTINGS', 'Sistem di-reset ke sample database default');
    showToast('Data sistem gudang GA telah dimuat ulang sesuai master data awal.', 'info');
    setIsResetSampleConfirmOpen(false);
  };

  // Counts for badges
  const lowStockCount = items.filter((i) => i.currentStock <= i.minStock).length;
  const activeLoansCount = loans.filter((l) => l.status === 'BORROWED' || l.status === 'OVERDUE').length;
  const pendingApprovalsCount = transactions.filter((t) => t.type === 'OUT' && t.status === 'PENDING').length;

  // Render Public Self-Service Request Portal if opened via QR or direct link (No login required)
  if (isPublicPortalOpen) {
    return (
      <PublicRequestPortalView
        items={items}
        employees={employees}
        companyName={dashboardConfig.appName || 'GUDANG GA'}
        companySubtitle={dashboardConfig.companySubtitle || 'General Affairs Inventory & Barcode Control System'}
        logoUrl={dashboardConfig.logoUrl}
        onSubmitTransaction={handleSubmitTransaction}
        onGoToStaffLogin={() => setIsPublicPortalOpen(false)}
        recentTransactions={transactions}
      />
    );
  }

  // Render Login View if not logged in (Requirement 4)
  if (!isLoggedIn) {
    return (
      <LoginView
        users={users}
        appName={dashboardConfig.appName || 'GUDANG GA'}
        companySubtitle={dashboardConfig.companySubtitle || 'General Affairs Inventory & Barcode Control System'}
        logoUrl={dashboardConfig.logoUrl}
        onLoginSuccess={(user) => {
          setCurrentUser(user);
          setIsLoggedIn(true);
          localStorage.setItem('ga_warehouse_is_logged_in', 'true');
          localStorage.setItem(STORAGE_KEY_CURRENT_USER, JSON.stringify(user));
        }}
        onGoToRequestPortal={() => setIsPublicPortalOpen(true)}
      />
    );
  }

  const theme = getThemeConfig(dashboardConfig.themeColor);
  const pageBgClass = getPageBackground(dashboardConfig.themeColor, dashboardConfig.mode);
  const densityMainClass = getDensityContainerClass(dashboardConfig.density);
  const fontFamilyString = getFontFamilyStyle(dashboardConfig.fontFamily);

  return (
    <div 
      className={`min-h-screen ${pageBgClass} flex flex-col selection:bg-blue-600 selection:text-white antialiased transition-colors duration-200`}
      style={{ fontFamily: fontFamilyString }}
    >
      {/* 1. Glossy Proportional Header (Non-sticky, responsive and mobile-optimized) */}
      <header className={`${theme.headerGradient || 'bg-gradient-to-r from-[#122240] via-[#1a2f57] to-[#122240]'} text-white shadow-lg shadow-slate-900/10 border-b border-slate-700/60 transition-colors duration-200`}>
        <div className="max-w-7xl mx-auto px-2.5 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14 sm:h-15 gap-1.5 sm:gap-3">
            {/* Left: Brand Logo & Title */}
            <div className="flex items-center gap-2 sm:gap-3 min-w-0 shrink">
              <div 
                onClick={() => setActiveTab('dashboard')} 
                className="flex items-center gap-2 sm:gap-3 cursor-pointer group select-none min-w-0"
                title="Menuju Dashboard Utama"
              >
                {/* Proportional Glossy Logo Frame */}
                <div className="relative p-0.5 sm:p-1 rounded-lg sm:rounded-xl bg-gradient-to-b from-white/20 via-white/10 to-transparent shadow-md shadow-black/20 ring-1 ring-white/20 group-hover:scale-105 transition-all duration-200 shrink-0">
                  <CompanyLogo logoUrl={dashboardConfig.logoUrl} size="sm" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <span className="font-black text-xs sm:text-base tracking-tight text-white group-hover:text-blue-200 transition-colors drop-shadow-xs truncate">
                      {dashboardConfig.appName || 'GUDANG GA'}
                    </span>
                    <span className="text-[9px] sm:text-[10px] font-black bg-blue-500/25 text-blue-300 border border-blue-400/30 px-1 sm:px-1.5 py-0.2 rounded font-mono shadow-xs shrink-0">
                      PRO
                    </span>
                    <button
                      type="button"
                      onClick={handleManualRefreshCloud}
                      title={
                        syncState === 'connected'
                          ? 'Tersinkronisasi Cloud Firestore secara Real-Time. Klik untuk sinkronisasi paksa.'
                          : syncState === 'syncing'
                          ? 'Sedang menyimpan perubahan ke Cloud...'
                          : 'Mode Offline - Klik untuk mencoba menyambungkan ulang ke Cloud'
                      }
                      className={`inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full border shrink-0 transition-all cursor-pointer hover:scale-105 active:scale-95 ${
                        syncState === 'connected'
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30 hover:bg-emerald-500/30'
                          : syncState === 'syncing'
                          ? 'bg-blue-500/20 text-blue-300 border-blue-400/30 animate-pulse'
                          : 'bg-amber-500/20 text-amber-300 border-amber-400/30 hover:bg-amber-500/30'
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        syncState === 'connected' ? 'bg-emerald-400' : syncState === 'syncing' ? 'bg-blue-400' : 'bg-amber-400'
                      }`} />
                      <span className="hidden sm:inline">
                        {syncState === 'connected' ? 'Cloud Sync' : syncState === 'syncing' ? 'Syncing...' : 'Lokal'}
                      </span>
                      <RefreshCw className={`w-2.5 h-2.5 opacity-75 ml-0.5 ${syncState === 'syncing' ? 'animate-spin' : ''}`} />
                    </button>
                  </div>
                  <p className="text-[10px] sm:text-[11px] text-slate-300/90 font-medium hidden md:block truncate">
                    {dashboardConfig.companySubtitle || 'General Affairs Inventory & Barcode Control System'}
                  </p>
                </div>
              </div>
            </div>

            {/* Right: Glossy Quick Actions, Notification Bell, Role & Action Icons (Mobile Responsive & No Overlap) */}
            <div className="flex items-center gap-1 sm:gap-2 shrink-0">
              {/* Glossy Notification Bell with Instant Approval Trigger */}
              <button
                type="button"
                onClick={() => setIsNotificationModalOpen(true)}
                title="Notifikasi Permintaan & Approval"
                className="relative p-1.5 sm:p-2 text-slate-200 hover:text-white bg-white/10 hover:bg-white/20 rounded-lg sm:rounded-xl border border-white/15 shadow-sm transition-all cursor-pointer group shrink-0"
              >
                <Bell className="w-4 h-4 text-amber-300 group-hover:scale-110 transition-transform" />
                {pendingApprovalsCount > 0 && (
                  <span className="absolute -top-1 -right-1 px-1 sm:px-1.5 py-0.2 bg-rose-500 text-white font-mono font-black text-[9px] sm:text-[10px] rounded-full border-2 border-[#122240] animate-pulse shadow-sm">
                    {pendingApprovalsCount}
                  </span>
                )}
              </button>

              {/* Active User Role Glossy Pill (Hidden on Mobile because it's placed in SubHeaderNavigation beside Dashboard) */}
              <button
                type="button"
                onClick={() => setIsRoleSwitcherOpen(true)}
                title="Kelola Akun & Ganti Role"
                className="hidden md:flex relative p-1.5 sm:px-2.5 sm:py-1 rounded-lg sm:rounded-xl bg-white/10 hover:bg-white/15 border border-white/20 shadow-sm backdrop-blur-xs items-center gap-1.5 transition-all cursor-pointer text-left group shrink-0"
              >
                <div className={`w-5 h-5 sm:w-5.5 sm:h-5.5 rounded-md flex items-center justify-center font-black text-[10px] shadow-inner shrink-0 ${
                  currentUser.role === 'MASTER_ADMIN' 
                    ? 'bg-amber-400 text-slate-950 ring-1 ring-amber-300' 
                    : currentUser.role === 'ADMIN' 
                    ? 'bg-blue-500 text-white ring-1 ring-blue-300' 
                    : 'bg-emerald-500 text-white ring-1 ring-emerald-300'
                }`}>
                  {currentUser.role === 'MASTER_ADMIN' ? (
                    <Crown className="w-3 h-3" />
                  ) : currentUser.role === 'ADMIN' ? (
                    <ShieldCheck className="w-3 h-3" />
                  ) : (
                    <Wrench className="w-3 h-3" />
                  )}
                </div>
                <div className="hidden lg:block leading-tight">
                  <div className="text-[11px] font-bold text-white group-hover:text-blue-200 transition-colors flex items-center gap-1">
                    <span>{currentUser.fullName}</span>
                  </div>
                  <div className="text-[9px] font-mono text-slate-300">
                    {currentUser.role.replace('_', ' ')}
                  </div>
                </div>
              </button>

              {/* Header Icon: Google Sheets Sync & Export (Hidden on Mobile, available in Drawer/SubHeader) */}
              <button
                type="button"
                onClick={() => setIsGoogleSheetsModalOpen(true)}
                title="Integrasi Google Sheets (Ekspor Laporan & Impor Stok)"
                className="hidden lg:flex p-1.5 sm:p-2 text-slate-200 hover:text-white bg-emerald-500/20 hover:bg-emerald-500/30 rounded-lg sm:rounded-xl border border-emerald-400/30 shadow-sm transition-all cursor-pointer items-center gap-1 sm:gap-1.5 text-xs font-semibold shrink-0"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-300" />
                <span className="hidden xl:inline">Google Sheets</span>
              </button>

              {/* Header Icon: Personil Database (Hidden on Mobile, placed beside Dashboard in SubHeader) */}
              <button
                type="button"
                onClick={() => setIsEmployeeModalOpen(true)}
                title={`Database Personil (${employees.length} Karyawan)`}
                className="hidden md:flex p-1.5 sm:p-2 text-slate-200 hover:text-white bg-white/10 hover:bg-white/20 rounded-lg sm:rounded-xl border border-white/15 shadow-sm transition-all cursor-pointer items-center gap-1 sm:gap-1.5 text-xs font-semibold shrink-0"
              >
                <Users className="w-4 h-4 text-emerald-300" />
                <span className="hidden xl:inline">Personil ({employees.length})</span>
              </button>

              {/* Header Icon: Dashboard & Branding Settings (Master Admin Only) */}
              {currentUser.role === 'MASTER_ADMIN' && (
                <button
                  type="button"
                  onClick={() => setIsSettingsModalOpen(true)}
                  title="Konfigurasi Dashboard, Tema & Logo (Khusus Master Admin)"
                  className="p-1.5 sm:p-2 text-slate-200 hover:text-white bg-white/10 hover:bg-white/20 rounded-lg sm:rounded-xl border border-white/15 shadow-xs transition-all cursor-pointer shrink-0 flex items-center justify-center"
                >
                  <SlidersHorizontal className="w-4 h-4 text-sky-300" />
                </button>
              )}

              {/* Logout Button */}
              <button
                type="button"
                onClick={handleLogout}
                title="Keluar dari Akun (Logout)"
                className="p-1.5 sm:p-2 text-rose-300 hover:text-white bg-rose-500/20 hover:bg-rose-600 rounded-lg sm:rounded-xl border border-rose-400/30 shadow-sm transition-all cursor-pointer flex items-center gap-1 text-xs font-bold shrink-0"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden lg:inline">Keluar</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* 2. Sub-Header Navigation Bar (Placed directly under the header as requested) */}
      <SubHeaderNavigation
        activeTab={activeTab}
        onTabChange={handleTabChange}
        lowStockCount={lowStockCount}
        activeLoansCount={activeLoansCount}
        pendingApprovalsCount={pendingApprovalsCount}
        currentUser={currentUser}
        rolePermissions={rolePermissions}
        employeeCount={employees.length}
        config={dashboardConfig}
        onOpenEmployeeModal={() => setIsEmployeeModalOpen(true)}
        onOpenRoleSwitcher={() => setIsRoleSwitcherOpen(true)}
        onOpenGoogleSheets={() => setIsGoogleSheetsModalOpen(true)}
        onOpenSettingsModal={() => setIsSettingsModalOpen(true)}
      />

      {/* Floating Global Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 animate-in slide-in-from-bottom-5 duration-300">
          <div
            className={`px-4 py-3 rounded-2xl shadow-2xl border flex items-center gap-3 text-xs font-bold ${
              toastMessage.type === 'success'
                ? 'bg-slate-900 text-white border-emerald-500/50 shadow-emerald-950/20'
                : toastMessage.type === 'warning'
                ? 'bg-rose-950 text-white border-rose-500/50 shadow-rose-950/20'
                : 'bg-slate-900 text-white border-blue-500/50 shadow-blue-950/20'
            }`}
          >
            {toastMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            )}
            <span>{toastMessage.text}</span>
            <button
              onClick={() => setToastMessage(null)}
              className="text-slate-400 hover:text-white text-xs ml-2 cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className={`flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 ${densityMainClass}`}>
        {/* Tab: Dashboard Overview (Ramping, Compact metrics & fast workflow) */}
        {activeTab === 'dashboard' && (
          <DashboardOverview
            items={items}
            transactions={transactions}
            loans={loans}
            currentUser={currentUser}
            config={dashboardConfig}
            rolePermissions={rolePermissions}
            employees={employees}
            onOpenSettingsModal={() => setIsSettingsModalOpen(true)}
            onOpenScanner={() => setIsScannerOpen(true)}
            onOpenBarcodePrint={(mode = 'STOCK') => {
              setBarcodePrintMode(mode);
              setIsBarcodeSheetOpen(true);
            }}
            onOpenStatsReport={() => setIsStatsModalOpen(true)}
            onNavigateToRequest={() => setActiveTab('request')}
            onNavigateToIncoming={() => setActiveTab('incoming')}
            onNavigateToStock={() => setActiveTab('stock')}
            onNavigateToLoans={() => setActiveTab('loans')}
            onNavigateToTransactions={() => setActiveTab('transactions')}
            onScanItemForRequest={handleDirectItemRequest}
          />
        )}

        {/* Tab: Permintaan Barang */}
        {activeTab === 'request' && (
          <ItemRequestView
            items={items}
            transactions={transactions}
            employees={employees}
            currentUser={currentUser}
            rolePermissions={rolePermissions}
            initialSelectedItem={selectedScannedItem}
            onClearInitialItem={() => setSelectedScannedItem(null)}
            onOpenScanner={() => setIsScannerOpen(true)}
            onOpenEmployeeModal={() => setIsEmployeeModalOpen(true)}
            onSubmitTransaction={handleSubmitTransaction}
            onApproveRequest={handleApproveRequest}
            onRejectRequest={handleRejectRequest}
            onDispatchApprovedRequest={handleDispatchApprovedRequest}
            onNavigateToStock={() => setActiveTab('stock')}
          />
        )}

        {/* Tab: Barang Masuk */}
        {activeTab === 'incoming' && (
          <IncomingGoodsView
            items={items}
            currentUser={currentUser}
            rolePermissions={rolePermissions}
            onOpenScanner={() => setIsScannerOpen(true)}
            onSubmitTransaction={handleSubmitTransaction}
            onNavigateToStock={() => setActiveTab('stock')}
          />
        )}

        {/* Tab: Stock Barang */}
        {activeTab === 'stock' && (
          <ItemMasterView
            items={items}
            currentUser={currentUser}
            rolePermissions={rolePermissions}
            onAddItem={handleAddItem}
            onBulkAddItems={handleBulkAddItems}
            onUpdateItem={handleUpdateItem}
            onDeleteItem={handleDeleteItem}
            onClearAllStock={handleClearAllStock}
            onDeleteAllStockItems={handleDeleteAllStockItems}
            onScanItemForRequest={handleDirectItemRequest}
            onOpenPrintSheet={() => {
              setBarcodePrintMode('STOCK');
              setIsBarcodeSheetOpen(true);
            }}
            onOpenGoogleSheets={() => setIsGoogleSheetsModalOpen(true)}
          />
        )}

        {/* Tab: Riwayat Transaksi */}
        {activeTab === 'transactions' && (
          <TransactionsHistoryView
            transactions={transactions}
            companyLogo={dashboardConfig.logoUrl}
            currentUser={currentUser}
            rolePermissions={rolePermissions}
            onOpenScanner={() => setIsScannerOpen(true)}
            onDeleteTransaction={handleDeleteTransaction}
            onClearTransactions={handleClearTransactions}
          />
        )}

        {/* Tab: Peminjaman Barang */}
        {activeTab === 'loans' && (
          <ItemLoanView
            loans={loans}
            items={items}
            employees={employees}
            currentUser={currentUser}
            rolePermissions={rolePermissions}
            onAddLoan={handleAddLoan}
            onReturnLoan={handleReturnLoan}
            onDeleteLoan={handleDeleteLoan}
          />
        )}
      </main>

      {/* Global Modals */}

      {/* 1. Barcode Scanner Modal */}
      <BarcodeScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        items={items}
        onScanSuccess={handleBarcodeScanned}
      />

      {/* 2. Barcode Sheet Printable Modal */}
      <BarcodeSheetModal
        isOpen={isBarcodeSheetOpen}
        onClose={() => setIsBarcodeSheetOpen(false)}
        items={items}
        transactions={transactions}
        companyLogo={dashboardConfig.logoUrl}
        companyName={dashboardConfig.appName || 'GUDANG GA'}
        initialMode={barcodePrintMode}
      />

      {/* 3. Logo Settings Modal */}
      <LogoSettingsModal
        isOpen={isLogoModalOpen}
        onClose={() => setIsLogoModalOpen(false)}
        currentLogo={dashboardConfig.logoUrl}
        onSaveLogo={handleSaveLogo}
      />

      {/* 4. Employee Database Modal */}
      <EmployeeDatabaseModal
        isOpen={isEmployeeModalOpen}
        onClose={() => setIsEmployeeModalOpen(false)}
        employees={employees}
        onAddEmployee={handleAddEmployee}
        onUpdateEmployee={handleUpdateEmployee}
        onDeleteEmployee={handleDeleteEmployee}
        onResetEmployees={handleResetEmployees}
        onOpenGoogleSheets={() => setIsGoogleSheetsModalOpen(true)}
        companyName={dashboardConfig.appName || 'GUDANG GA'}
      />

      {/* 5. User Account & RBAC Management Modal */}
      <UserManagementModal
        isOpen={isUserModalOpen}
        onClose={() => setIsUserModalOpen(false)}
        users={users}
        currentUser={currentUser}
        employees={employees}
        onAddUser={handleAddUser}
        onUpdateUser={handleUpdateUser}
        onDeleteUser={handleDeleteUser}
        rolePermissions={rolePermissions}
        onUpdateRolePermissions={handleUpdateRolePermissions}
      />

      {/* 6. Audit Trail Modal */}
      <AuditTrailModal
        isOpen={isAuditModalOpen}
        onClose={() => setIsAuditModalOpen(false)}
        logs={auditLogs}
      />

      {/* 7. Dashboard Settings & System Lock Modal */}
      <DashboardSettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        config={dashboardConfig}
        currentUser={currentUser}
        onSaveConfig={handleSaveConfig}
        onResetConfig={handleResetConfig}
      />

      {/* 8. Role & User Switcher Modal */}
      <RoleSwitcherModal
        isOpen={isRoleSwitcherOpen}
        onClose={() => setIsRoleSwitcherOpen(false)}
        currentUser={currentUser}
        userAccounts={users}
        onSwitchUser={handleSwitchUser}
        onOpenUserManagement={() => setIsUserModalOpen(true)}
      />

      {/* 9. Reset Sample Data Confirmation Modal */}
      <ConfirmationModal
        isOpen={isResetSampleConfirmOpen}
        title="Reset Sistem ke Sample Data Awal"
        message="PERINGATAN: Seluruh transaksi, data barang, riwayat peminjaman, dan konfigurasi akan dikembalikan ke data awal sistem. Anda yakin?"
        confirmText="Ya, Reset Semua Data"
        isDestructive={true}
        onConfirm={handleResetSampleData}
        onCancel={() => setIsResetSampleConfirmOpen(false)}
      />

      {/* 10. Header Notification & Instant Approval Modal */}
      <NotificationApprovalModal
        isOpen={isNotificationModalOpen}
        onClose={() => setIsNotificationModalOpen(false)}
        transactions={transactions}
        currentUser={currentUser}
        onApprove={handleApproveRequest}
        onReject={handleRejectRequest}
        onNavigateToRequest={() => setActiveTab('request')}
      />

      {/* 11. Professional Statistics & Analytics Report Modal */}
      <ProfessionalStatsReportModal
        isOpen={isStatsModalOpen}
        onClose={() => setIsStatsModalOpen(false)}
        items={items}
        transactions={transactions}
      />

      {/* 12. Google Sheets Cloud Integration Modal */}
      <GoogleSheetsModal
        isOpen={isGoogleSheetsModalOpen}
        onClose={() => setIsGoogleSheetsModalOpen(false)}
        items={items}
        transactions={transactions}
        loans={loans}
        employees={employees}
        companyName={dashboardConfig.appName || 'GUDANG GA'}
        onImportItems={(newItems, mode) => {
          handleBulkAddItems(newItems, mode);
          setToastMessage({
            text: `Berhasil mengimpor ${newItems.length} data barang dari Google Sheets!`,
            type: 'success',
          });
        }}
        showToast={(text, type) => setToastMessage({ text, type })}
      />

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 mt-auto py-4 text-xs text-slate-600">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-800">Sistem Gudang General Affairs (GA)</span>
            <span>•</span>
            <span className="text-slate-500">Multi-Role RBAC & Barcode Inventory Control</span>
          </div>

          <div className="flex items-center gap-4">
            {currentUser.role === 'MASTER_ADMIN' && (
              <button
                type="button"
                onClick={() => setIsResetSampleConfirmOpen(true)}
                className="text-slate-500 hover:text-rose-600 hover:underline flex items-center gap-1 cursor-pointer font-medium"
              >
                <RotateCcw className="w-3 h-3" /> Reset Sample Data
              </button>
            )}
            <span className="text-slate-300">|</span>
            <span className="font-mono text-slate-500">
              Role: <strong className="text-slate-800">{currentUser.role.replace('_', ' ')}</strong>
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
