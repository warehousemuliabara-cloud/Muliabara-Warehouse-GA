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
import { 
  subscribeToWarehouseData, 
  pushWarehouseSync, 
  fetchFreshWarehouseData,
  onSyncStatusChange, 
  SyncState,
  WarehouseSyncPayload 
} from './utils/firebaseSync';

const STORAGE_KEY_ITEMS = 'ga_warehouse_items_v8';
const STORAGE_KEY_TRANSACTIONS = 'ga_warehouse_transactions_v8';
const STORAGE_KEY_EMPLOYEES = 'ga_warehouse_employees_v8';
const STORAGE_KEY_USERS = 'ga_warehouse_users_v8';
const STORAGE_KEY_CURRENT_USER = 'ga_warehouse_current_user_v8';
const STORAGE_KEY_LOANS = 'ga_warehouse_loans_v8';
const STORAGE_KEY_AUDIT = 'ga_warehouse_audit_v8';
const STORAGE_KEY_CONFIG = 'ga_warehouse_config_v8';

export default function App() {
  // Helper to ensure all predefined team accounts are present even on fresh devices
  const getMergedUsers = (savedList: UserAccount[]): UserAccount[] => {
    const map = new Map<string, UserAccount>();
    INITIAL_USERS.forEach((u) => map.set(u.username.toLowerCase(), u));
    if (Array.isArray(savedList)) {
      savedList.forEach((u) => {
        if (u && u.username) {
          const existing = map.get(u.username.toLowerCase());
          map.set(u.username.toLowerCase(), existing ? { ...existing, ...u } : u);
        }
      });
    }
    return Array.from(map.values());
  };

  // 1. Core items database
  const [items, setItems] = useState<Item[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_ITEMS) || localStorage.getItem('ga_warehouse_items_v6');
      return saved ? JSON.parse(saved) : INITIAL_ITEMS;
    } catch {
      return INITIAL_ITEMS;
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
        if (Array.isArray(parsed) && parsed.length > 0) {
          return getMergedUsers(parsed);
        }
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

  // Login & Session state (Requirement 4: LoginView entry point)
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('ga_warehouse_is_logged_in');
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
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
    localStorage.setItem(STORAGE_KEY_ROLE_PERMS, JSON.stringify(newPerms));
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    localStorage.setItem('ga_warehouse_is_logged_in', 'false');
  };

  // Active navigation tab
  const [activeTab, setActiveTab] = useState<MainTabType>('dashboard');

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

  // Cross-modal selected item for request
  const [selectedScannedItem, setSelectedScannedItem] = useState<Item | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Toast notification
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'info' | 'warning' } | null>(null);
  const [syncState, setSyncState] = useState<SyncState>('connected');

  // Multi-Device Cloud Synchronization Engine references
  const isInitialCloudLoaded = useRef<boolean>(false);
  const isRemoteUpdate = useRef<boolean>(false);

  // Helper to immediately push latest state to Cloud Firestore
  const syncToCloud = (overrides?: Partial<WarehouseSyncPayload>) => {
    const payload: Partial<WarehouseSyncPayload> & { updatedBy: string } = {
      items: overrides?.items || items,
      transactions: overrides?.transactions || transactions,
      employees: overrides?.employees || employees,
      users: overrides?.users || users,
      loans: overrides?.loans || loans,
      auditLogs: overrides?.auditLogs || auditLogs,
      rolePermissions: overrides?.rolePermissions || rolePermissions,
      dashboardConfig: overrides?.dashboardConfig || dashboardConfig,
      updatedBy: currentUser?.fullName || 'Sistem',
    };
    pushWarehouseSync(payload).catch((err) => {
      console.warn('Immediate Firestore sync error:', err?.message);
    });
  };

  // Manual refresh from Cloud button handler
  const handleManualRefreshCloud = async () => {
    showToast('Menghubungkan & menyinkronkan data Cloud Firestore...', 'info');
    try {
      const cloudData = await fetchFreshWarehouseData();
      if (cloudData) {
        isRemoteUpdate.current = true;
        if (cloudData.items && Array.isArray(cloudData.items)) setItems(cloudData.items);
        if (cloudData.transactions && Array.isArray(cloudData.transactions)) setTransactions(cloudData.transactions);
        if (cloudData.employees && Array.isArray(cloudData.employees)) setEmployees(cloudData.employees);
        if (cloudData.users && Array.isArray(cloudData.users)) setUsers(getMergedUsers(cloudData.users));
        if (cloudData.loans && Array.isArray(cloudData.loans)) setLoans(cloudData.loans);
        if (cloudData.auditLogs && Array.isArray(cloudData.auditLogs)) setAuditLogs(cloudData.auditLogs);
        if (cloudData.rolePermissions) setRolePermissions(cloudData.rolePermissions);
        if (cloudData.dashboardConfig) setDashboardConfig(cloudData.dashboardConfig);
        isInitialCloudLoaded.current = true;
        showToast('Data Cloud berhasil disinkronkan & diperbarui!', 'success');
      } else {
        showToast('Tidak ada data baru di Cloud, data lokal sudah mutakhir.', 'info');
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

  // Subscribe to real-time Firestore database updates
  useEffect(() => {
    const unsubscribe = subscribeToWarehouseData((data) => {
      if (data) {
        isRemoteUpdate.current = true;
        if (data.items && Array.isArray(data.items)) setItems(data.items);
        if (data.transactions && Array.isArray(data.transactions)) setTransactions(data.transactions);
        if (data.employees && Array.isArray(data.employees)) setEmployees(data.employees);
        if (data.users && Array.isArray(data.users)) setUsers(getMergedUsers(data.users));
        if (data.loans && Array.isArray(data.loans)) setLoans(data.loans);
        if (data.auditLogs && Array.isArray(data.auditLogs)) setAuditLogs(data.auditLogs);
        if (data.rolePermissions) setRolePermissions(data.rolePermissions);
        if (data.dashboardConfig) setDashboardConfig(data.dashboardConfig);
        isInitialCloudLoaded.current = true;
      }
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // Sync to Firestore when local master data updates (debounced backup)
  useEffect(() => {
    if (!isInitialCloudLoaded.current) return;
    if (isRemoteUpdate.current) {
      isRemoteUpdate.current = false;
      return;
    }

    const timer = setTimeout(() => {
      pushWarehouseSync({
        items,
        transactions,
        employees,
        users,
        loans,
        auditLogs,
        rolePermissions,
        dashboardConfig,
        updatedBy: currentUser.fullName,
      }).catch((err) => {
        console.warn('Silent Firestore sync error:', err?.message);
      });
    }, 1000);

    return () => clearTimeout(timer);
  }, [items, transactions, employees, users, loans, auditLogs, rolePermissions, dashboardConfig, currentUser.fullName]);

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
    const nextUsers = users.filter((u) => u.id !== userId);
    setUsers(nextUsers);
    try {
      localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(nextUsers));
    } catch (e) {
      console.error('Save users error', e);
    }
    syncToCloud({ users: nextUsers });
    logAudit('Hapus Akun Pengguna', 'USERS', `Menghapus akun ${userToDel?.fullName || userId}`);
    showToast(`Akun "${userToDel?.fullName || userId}" telah dihapus.`, 'warning');
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
    const isPendingApproval = newTrx.type === 'OUT' && newTrx.status === 'PENDING';
    let nextItems = items;

    if (!isPendingApproval) {
      nextItems = items.map((item) => {
        const trxItem = newTrx.items.find((i) => i.itemId === item.id);
        if (trxItem) {
          if (newTrx.type === 'OUT') {
            const newStock = Math.max(0, item.currentStock - trxItem.quantity);
            return { ...item, currentStock: newStock, updatedAt: new Date().toISOString() };
          } else {
            const newStock = item.currentStock + trxItem.quantity;
            return { ...item, currentStock: newStock, updatedAt: new Date().toISOString() };
          }
        }
        return item;
      });
      setItems(nextItems);
    }

    const nextTrx = [newTrx, ...transactions];
    setTransactions(nextTrx);

    // Broadcast immediately to Firestore so other phones/devices see it instantly!
    syncToCloud({ items: nextItems, transactions: nextTrx });

    if (newTrx.type === 'OUT') {
      logAudit(
        isPendingApproval ? 'Pengajuan Permintaan Barang' : 'Barang Keluar',
        'TRANSACTIONS',
        `Permintaan [${newTrx.transactionNumber}] oleh ${newTrx.requesterName} (${newTrx.department}) status: ${newTrx.status || 'COMPLETED'}`
      );
      showToast(
        isPendingApproval 
          ? `Permintaan [${newTrx.transactionNumber}] tersimpan & menunggu verifikasi Admin.` 
          : `Permintaan [${newTrx.transactionNumber}] berhasil diproses! Stok terpotong otomatis.`,
        'success'
      );
    } else {
      logAudit('Barang Masuk', 'TRANSACTIONS', `Penerimaan restock [${newTrx.transactionNumber}] dari ${newTrx.supplier || 'Vendor'}`);
      showToast(`Penerimaan barang [${newTrx.transactionNumber}] berhasil dicatat! Stok bertambah.`, 'success');
    }
  };

  // Approval Handlers with immediate Cloud sync
  const handleApproveRequest = (trxId: string, notes?: string) => {
    const trx = transactions.find(t => t.id === trxId);
    if (!trx) return;

    const nextTrx = transactions.map(t => {
      if (t.id === trxId) {
        return {
          ...t,
          status: 'APPROVED',
          approvalInfo: {
            status: 'APPROVED',
            approvedBy: currentUser.fullName,
            approverRole: currentUser.role,
            approvedAt: new Date().toISOString(),
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

    const nextTrx = transactions.map(t => {
      if (t.id === trxId) {
        return {
          ...t,
          status: 'REJECTED',
          approvalInfo: {
            status: 'REJECTED',
            approvedBy: currentUser.fullName,
            approverRole: currentUser.role,
            approvedAt: new Date().toISOString(),
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

    // Deduct stock upon actual dispatch
    const nextItems = items.map((item) => {
      const trxItem = trx.items.find((i) => i.itemId === item.id);
      if (trxItem) {
        const newStock = Math.max(0, item.currentStock - trxItem.quantity);
        return { ...item, currentStock: newStock, updatedAt: new Date().toISOString() };
      }
      return item;
    });
    setItems(nextItems);

    const nextTrx = transactions.map(t => {
      if (t.id === trxId) {
        return {
          ...t,
          status: 'COMPLETED',
          dispatchedBy: currentUser.fullName,
          dispatchedAt: new Date().toISOString(),
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

    let nextItems = items;
    if (revertStock && trxToDelete.status !== 'REJECTED' && trxToDelete.status !== 'PENDING') {
      nextItems = items.map((item) => {
        const trxItem = trxToDelete.items.find((i) => i.itemId === item.id);
        if (trxItem) {
          if (trxToDelete.type === 'OUT') {
            return {
              ...item,
              currentStock: item.currentStock + trxItem.quantity,
              updatedAt: new Date().toISOString(),
            };
          } else {
            return {
              ...item,
              currentStock: Math.max(0, item.currentStock - trxItem.quantity),
              updatedAt: new Date().toISOString(),
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
    const nextLoans = [newLoan, ...loans];
    setLoans(nextLoans);
    
    // Deduct stock if active
    const nextItems = items.map((it) =>
      it.id === newLoan.itemId
        ? { ...it, currentStock: Math.max(0, it.currentStock - newLoan.quantity) }
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

    const nextLoans = loans.map((l) =>
      l.id === loanId
        ? {
            ...l,
            status: 'RETURNED' as const,
            actualReturnDate: returnDateStr,
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
          ? { ...it, currentStock: it.currentStock + loan.quantity }
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
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-100/90 flex flex-col selection:bg-blue-600 selection:text-white antialiased font-sans">
      {/* 1. Glossy Proportional Header (Non-sticky, responsive and mobile-optimized) */}
      <header className="bg-gradient-to-r from-[#122240] via-[#1a2f57] to-[#122240] text-white shadow-lg shadow-slate-900/10 border-b border-slate-700/60">
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

            {/* Right: Glossy Quick Actions, Notification Bell, Role & Action Icons (Mobile Responsive) */}
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

              {/* Active User Role Glossy Pill */}
              <button
                type="button"
                onClick={() => setIsRoleSwitcherOpen(true)}
                title="Kelola Akun & Ganti Role"
                className="relative p-1.5 sm:px-2.5 sm:py-1 rounded-lg sm:rounded-xl bg-white/10 hover:bg-white/15 border border-white/20 shadow-sm backdrop-blur-xs flex items-center gap-1.5 transition-all cursor-pointer text-left group shrink-0"
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

              {/* Header Icon: Personil Database */}
              <button
                type="button"
                onClick={() => setIsEmployeeModalOpen(true)}
                title={`Database Personil (${employees.length} Karyawan)`}
                className="p-1.5 sm:p-2 text-slate-200 hover:text-white bg-white/10 hover:bg-white/20 rounded-lg sm:rounded-xl border border-white/15 shadow-sm transition-all cursor-pointer flex items-center gap-1 sm:gap-1.5 text-xs font-semibold shrink-0"
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
                  className="p-1.5 sm:p-2 text-slate-200 hover:text-white bg-white/10 hover:bg-white/20 rounded-lg sm:rounded-xl border border-white/15 shadow-sm transition-all cursor-pointer shrink-0"
                >
                  <SlidersHorizontal className="w-4 h-4 text-blue-300" />
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

              {/* Mobile Navigation Menu Toggle */}
              <button
                type="button"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                title="Menu Navigasi Mobile"
                className="p-1.5 sm:p-2 md:hidden text-slate-200 hover:text-white bg-white/10 hover:bg-white/20 rounded-lg sm:rounded-xl border border-white/15 cursor-pointer shrink-0"
              >
                {mobileMenuOpen ? <X className="w-4.5 h-4.5" /> : <Menu className="w-4.5 h-4.5" />}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* 2. Sub-Header Navigation Bar (Placed directly under the header as requested) */}
      <SubHeaderNavigation
        activeTab={activeTab}
        onTabChange={(tab) => setActiveTab(tab)}
        lowStockCount={lowStockCount}
        activeLoansCount={activeLoansCount}
        pendingApprovalsCount={pendingApprovalsCount}
        currentUser={currentUser}
        onOpenEmployeeModal={() => setIsEmployeeModalOpen(true)}
        onOpenRoleSwitcher={() => setIsRoleSwitcherOpen(true)}
      />

      {/* Mobile Drawer Navigation */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-slate-900 text-white px-4 py-3 border-b border-slate-800 space-y-1.5 animate-in slide-in-from-top-2">
          <div className="pb-2 mb-2 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <span>Menu Navigasi Modul</span>
            <span className="text-[11px] font-mono text-blue-400">{currentUser.fullName} ({currentUser.role})</span>
          </div>

          <button
            onClick={() => {
              setActiveTab('dashboard');
              setMobileMenuOpen(false);
            }}
            className={`w-full text-left px-3.5 py-2.5 text-xs font-bold rounded-xl flex items-center gap-2.5 ${
              activeTab === 'dashboard' ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            <LayoutDashboard className="w-4 h-4" /> Dashboard Ringkas
          </button>
          <button
            onClick={() => {
              setActiveTab('request');
              setMobileMenuOpen(false);
            }}
            className={`w-full text-left px-3.5 py-2.5 text-xs font-bold rounded-xl flex items-center justify-between ${
              activeTab === 'request' ? 'bg-amber-500 text-slate-950' : 'text-amber-300 hover:bg-slate-800'
            }`}
          >
            <span className="flex items-center gap-2.5">
              <ArrowUpRight className="w-4 h-4" /> Permintaan Barang
            </span>
            {pendingApprovalsCount > 0 && (
              <span className="px-1.5 py-0.2 text-[10px] bg-rose-500 text-white font-bold rounded-full">
                {pendingApprovalsCount}
              </span>
            )}
          </button>
          <button
            onClick={() => {
              setActiveTab('incoming');
              setMobileMenuOpen(false);
            }}
            className={`w-full text-left px-3.5 py-2.5 text-xs font-bold rounded-xl flex items-center gap-2.5 ${
              activeTab === 'incoming' ? 'bg-emerald-600 text-white' : 'text-emerald-300 hover:bg-slate-800'
            }`}
          >
            <ArrowDownLeft className="w-4 h-4" /> Barang Masuk
          </button>
          <button
            onClick={() => {
              setActiveTab('stock');
              setMobileMenuOpen(false);
            }}
            className={`w-full text-left px-3.5 py-2.5 text-xs font-bold rounded-xl flex items-center justify-between ${
              activeTab === 'stock' ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            <span className="flex items-center gap-2.5">
              <Package className="w-4 h-4" /> Stock Barang ({items.length})
            </span>
            {lowStockCount > 0 && (
              <span className="px-1.5 py-0.2 text-[10px] bg-rose-500 text-white font-bold rounded-full">
                {lowStockCount} Kritis
              </span>
            )}
          </button>
          <button
            onClick={() => {
              setActiveTab('loans');
              setMobileMenuOpen(false);
            }}
            className={`w-full text-left px-3.5 py-2.5 text-xs font-bold rounded-xl flex items-center justify-between ${
              activeTab === 'loans' ? 'bg-purple-600 text-white' : 'text-purple-300 hover:bg-slate-800'
            }`}
          >
            <span className="flex items-center gap-2.5">
              <HandHelping className="w-4 h-4" /> Peminjaman Barang
            </span>
            {activeLoansCount > 0 && (
              <span className="px-1.5 py-0.2 text-[10px] bg-purple-500 text-white font-bold rounded-full">
                {activeLoansCount} Dipinjam
              </span>
            )}
          </button>
          <button
            onClick={() => {
              setActiveTab('transactions');
              setMobileMenuOpen(false);
            }}
            className={`w-full text-left px-3.5 py-2.5 text-xs font-bold rounded-xl flex items-center gap-2.5 ${
              activeTab === 'transactions' ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            <History className="w-4 h-4" /> Riwayat Transaksi ({transactions.length})
          </button>

          <div className="pt-2 mt-2 border-t border-slate-800 space-y-1">
            <button
              onClick={() => {
                setIsEmployeeModalOpen(true);
                setMobileMenuOpen(false);
              }}
              className="w-full text-left px-3.5 py-2 text-xs font-bold rounded-xl flex items-center justify-between text-emerald-300 hover:bg-slate-800"
            >
              <span className="flex items-center gap-2.5">
                <Users className="w-4 h-4" /> Database Personil
              </span>
              <span className="text-[10px] bg-emerald-900/60 text-emerald-300 px-2 py-0.5 rounded-md font-mono">
                {employees.length} Orang
              </span>
            </button>
            <button
              onClick={() => {
                setIsRoleSwitcherOpen(true);
                setMobileMenuOpen(false);
              }}
              className="w-full text-left px-3.5 py-2 text-xs font-bold rounded-xl flex items-center gap-2.5 text-amber-300 hover:bg-slate-800"
            >
              <ShieldCheck className="w-4 h-4" /> Ganti Akun / Role
            </button>
            {currentUser.role === 'MASTER_ADMIN' && (
              <button
                onClick={() => {
                  setIsSettingsModalOpen(true);
                  setMobileMenuOpen(false);
                }}
                className="w-full text-left px-3.5 py-2 text-xs font-bold rounded-xl flex items-center gap-2.5 text-blue-300 hover:bg-slate-800"
              >
                <SlidersHorizontal className="w-4 h-4" /> Konfigurasi Sistem & Branding
              </button>
            )}
            <button
              onClick={() => {
                handleLogout();
                setMobileMenuOpen(false);
              }}
              className="w-full text-left px-3.5 py-2 text-xs font-bold rounded-xl flex items-center gap-2.5 text-rose-300 hover:bg-rose-950/50"
            >
              <LogOut className="w-4 h-4" /> Keluar dari Akun (Logout)
            </button>
          </div>
        </div>
      )}

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
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-5 pb-12">
        {/* Tab: Dashboard Overview (Ramping, Compact metrics & fast workflow) */}
        {activeTab === 'dashboard' && (
          <DashboardOverview
            items={items}
            transactions={transactions}
            loans={loans}
            currentUser={currentUser}
            config={dashboardConfig}
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
