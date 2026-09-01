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
  ChevronDown
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
  onOpenEmployeeModal?: () => void;
  onOpenRoleSwitcher?: () => void;
}

export const SubHeaderNavigation: React.FC<SubHeaderNavigationProps> = ({
  activeTab,
  onTabChange,
  pendingApprovalsCount = 0,
  lowStockCount = 0,
  activeLoansCount = 0,
  currentUser,
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
      label: 'Permintaan Barang',
      icon: ArrowUpRight,
      badge: pendingApprovalsCount > 0 ? `${pendingApprovalsCount} Approval` : null,
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
      label: 'Stock Barang',
      icon: Package,
      badge: lowStockCount > 0 ? `${lowStockCount} Kritis` : null,
      badgeColor: 'bg-rose-500 text-white font-bold',
    },
    {
      id: 'loans' as MainTabType,
      label: 'Peminjaman',
      icon: HandHelping,
      badge: activeLoansCount > 0 ? `${activeLoansCount} Dipinjam` : null,
      badgeColor: 'bg-indigo-600 text-white font-bold',
    },
    {
      id: 'transactions' as MainTabType,
      label: 'Riwayat Transaksi',
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
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
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

        {/* Mobile Navigation Header (< md screens) */}
        <div className="md:hidden py-2 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 rounded-xl border border-slate-700 text-white text-xs font-bold shadow-xs cursor-pointer"
          >
            <div className="p-1 bg-blue-600 rounded-lg text-white">
              <ActiveIcon className="w-3.5 h-3.5" />
            </div>
            <span>{activeTabItem.label}</span>
            <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isMobileMenuOpen ? 'rotate-180' : ''}`} />
          </button>

          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label="Menu Navigasi Mobile"
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl border border-slate-700 flex items-center justify-center transition-colors cursor-pointer"
          >
            {isMobileMenuOpen ? (
              <X className="w-4 h-4 text-rose-400" />
            ) : (
              <Menu className="w-4 h-4 text-slate-300" />
            )}
          </button>
        </div>

        {/* Mobile Expanded Drawer Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden pb-3 pt-1 space-y-1.5 border-t border-slate-800 animate-in slide-in-from-top-2 duration-150">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;

              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => handleSelectTab(tab.id)}
                  className={`w-full px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-between cursor-pointer ${
                    isActive
                      ? 'bg-white text-slate-950 shadow-md'
                      : 'text-slate-300 hover:bg-slate-800 bg-slate-800/40 border border-slate-700/60'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div className={`p-1.5 rounded-lg ${isActive ? 'bg-slate-950 text-white' : 'bg-slate-800 text-slate-300'}`}>
                      <Icon className="w-4 h-4" />
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
          </div>
        )}
      </div>
    </div>
  );
};
