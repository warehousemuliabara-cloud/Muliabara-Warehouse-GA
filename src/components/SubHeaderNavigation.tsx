import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Package, 
  History, 
  HandHelping,
  Menu,
  X,
  ChevronDown,
  Users,
  Crown,
  ShieldCheck,
  Wrench,
  FileSpreadsheet
} from 'lucide-react';
import { UserAccount } from '../types';

export type MainTabType = 'dashboard' | 'request' | 'incoming' | 'stock' | 'loans' | 'transactions';

interface SubHeaderNavigationProps {
  activeTab: MainTabType;
  onTabChange: (tab: MainTabType) => void;
  pendingApprovalsCount?: number;
  lowStockCount?: number;
  activeLoansCount?: number;
  currentUser: UserAccount;
  employeeCount?: number;
  onOpenEmployeeModal?: () => void;
  onOpenRoleSwitcher?: () => void;
  onOpenGoogleSheets?: () => void;
}

export const SubHeaderNavigation: React.FC<SubHeaderNavigationProps> = ({
  activeTab,
  onTabChange,
  pendingApprovalsCount = 0,
  lowStockCount = 0,
  activeLoansCount = 0,
  currentUser,
  employeeCount = 0,
  onOpenEmployeeModal,
  onOpenRoleSwitcher,
  onOpenGoogleSheets,
}) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const tabs = [
    {
      id: 'dashboard' as MainTabType,
      label: 'Dashboard',
      icon: LayoutDashboard,
      badge: null,
      badgeColor: '',
    },
    {
      id: 'request' as MainTabType,
      label: 'Permintaan',
      icon: ArrowUpRight,
      badge: pendingApprovalsCount > 0 ? `${pendingApprovalsCount}` : null,
      badgeColor: 'bg-amber-500 text-slate-950 font-black',
    },
    {
      id: 'incoming' as MainTabType,
      label: 'Barang Masuk',
      icon: ArrowDownLeft,
      badge: null,
      badgeColor: '',
    },
    {
      id: 'stock' as MainTabType,
      label: 'Stock Master',
      icon: Package,
      badge: lowStockCount > 0 ? `${lowStockCount}` : null,
      badgeColor: 'bg-rose-500 text-white font-bold',
    },
    {
      id: 'loans' as MainTabType,
      label: 'Peminjaman',
      icon: HandHelping,
      badge: activeLoansCount > 0 ? `${activeLoansCount}` : null,
      badgeColor: 'bg-indigo-600 text-white font-bold',
    },
    {
      id: 'transactions' as MainTabType,
      label: 'Riwayat Log',
      icon: History,
      badge: null,
      badgeColor: '',
    },
  ];

  const handleSelectTab = (tabId: MainTabType) => {
    onTabChange(tabId);
    setIsMobileMenuOpen(false);
  };

  const activeTabItem = tabs.find((t) => t.id === activeTab) || tabs[0];
  const ActiveIcon = activeTabItem.icon;

  return (
    <div className="bg-slate-900 border-b border-slate-800 shadow-md">
      <div className="max-w-7xl mx-auto px-2.5 sm:px-6 lg:px-8">
        {/* Desktop Navigation (>= md screens): Full-width evenly spaced tabs with no horizontal scroll */}
        <div className="hidden md:grid md:grid-cols-6 gap-1.5 py-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onTabChange(tab.id)}
                className={`px-2.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer relative group ${
                  isActive
                    ? 'bg-white text-slate-950 shadow-md ring-1 ring-white/50'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800 bg-slate-800/50 border border-slate-700/60'
                }`}
              >
                <div className={`p-1 rounded-lg transition-transform group-hover:scale-105 ${
                  isActive
                    ? 'bg-slate-950 text-white'
                    : 'bg-slate-700/60 text-slate-300 group-hover:text-white'
                }`}>
                  <Icon className="w-3.5 h-3.5" />
                </div>

                <span className="truncate">{tab.label}</span>

                {tab.badge && (
                  <span className={`px-1.5 py-0.2 text-[9px] rounded-full shadow-xs shrink-0 ${tab.badgeColor}`}>
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Mobile Navigation Header (< md screens) - With Dedicated Kelola Akun & Data Personel shortcuts */}
        <div className="md:hidden py-1.5 flex items-center justify-between gap-1.5">
          {/* Active Tab Quick Trigger / Dropdown */}
          <div className="flex items-center gap-1 min-w-0">
            {/* Quick Dashboard Tab Button */}
            <button
              type="button"
              onClick={() => onTabChange('dashboard')}
              title="Dashboard"
              className={`p-2 rounded-lg border text-xs font-bold transition-all flex items-center justify-center cursor-pointer shrink-0 ${
                activeTab === 'dashboard'
                  ? 'bg-white text-slate-950 border-white shadow-xs'
                  : 'bg-slate-800 text-slate-300 border-slate-700 hover:text-white'
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
            </button>

            {/* Quick Mobile Shortcut: Kelola Akun / Ganti Role (Beside Dashboard Icon) */}
            {onOpenRoleSwitcher && (
              <button
                type="button"
                onClick={onOpenRoleSwitcher}
                title={`Kelola Akun: ${currentUser.fullName} (${currentUser.role})`}
                className="flex items-center gap-1 px-2 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 text-amber-300 text-xs font-bold shadow-xs cursor-pointer shrink-0"
              >
                {currentUser.role === 'MASTER_ADMIN' ? (
                  <Crown className="w-3.5 h-3.5 text-amber-400" />
                ) : currentUser.role === 'ADMIN' ? (
                  <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
                ) : (
                  <Wrench className="w-3.5 h-3.5 text-emerald-400" />
                )}
                <span className="text-[10px] font-semibold text-slate-200 truncate max-w-[65px]">
                  {currentUser.fullName.split(' ')[0]}
                </span>
              </button>
            )}

            {/* Quick Mobile Shortcut: Data Personil (Beside Kelola Akun) */}
            {onOpenEmployeeModal && (
              <button
                type="button"
                onClick={onOpenEmployeeModal}
                title="Database Personil"
                className="flex items-center gap-1 px-2 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 text-emerald-300 text-xs font-bold shadow-xs cursor-pointer shrink-0"
              >
                <Users className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-[10px] font-semibold text-slate-200">
                  {employeeCount > 0 ? employeeCount : 'Tim'}
                </span>
              </button>
            )}
          </div>

          {/* Current Active View Pill & Menu Toggle */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-blue-600/90 text-white rounded-lg border border-blue-500 text-[11px] font-bold shadow-xs cursor-pointer"
            >
              <ActiveIcon className="w-3.5 h-3.5" />
              <span className="truncate max-w-[90px]">{activeTabItem.label}</span>
              <ChevronDown className={`w-3 h-3 text-blue-200 transition-transform ${isMobileMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              aria-label="Menu Navigasi Mobile"
              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg border border-slate-700 flex items-center justify-center transition-colors cursor-pointer"
            >
              {isMobileMenuOpen ? (
                <X className="w-4 h-4 text-rose-400" />
              ) : (
                <Menu className="w-4 h-4 text-slate-300" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Expanded Drawer Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden pb-3 pt-1 space-y-1.5 border-t border-slate-800 animate-in slide-in-from-top-2 duration-150">
            <div className="text-[10px] uppercase font-bold text-slate-400 px-1 pt-1">
              Pilih Modul Gudang:
            </div>
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;

              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => handleSelectTab(tab.id)}
                  className={`w-full px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-between cursor-pointer ${
                    isActive
                      ? 'bg-white text-slate-950 shadow-md'
                      : 'text-slate-300 hover:bg-slate-800 bg-slate-800/40 border border-slate-700/60'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div className={`p-1.5 rounded-lg ${isActive ? 'bg-slate-950 text-white' : 'bg-slate-800 text-slate-300'}`}>
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <span>{tab.label}</span>
                  </div>

                  {tab.badge && (
                    <span className={`px-2 py-0.5 text-[10px] rounded-full font-bold ${tab.badgeColor}`}>
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}

            {/* Extra Google Sheets Option in Mobile Drawer */}
            {onOpenGoogleSheets && (
              <button
                type="button"
                onClick={() => {
                  onOpenGoogleSheets();
                  setIsMobileMenuOpen(false);
                }}
                className="w-full px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-between cursor-pointer text-emerald-300 hover:bg-slate-800 bg-slate-800/40 border border-slate-700/60 mt-1"
              >
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400">
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                  </div>
                  <span>Integrasi Google Sheets</span>
                </div>
                <span className="text-[9px] font-mono text-emerald-400">Live API</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
