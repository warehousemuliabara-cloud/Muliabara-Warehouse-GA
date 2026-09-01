import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  Package, 
  ArrowUpRight, 
  ArrowDownLeft, 
  AlertTriangle, 
  HandHelping, 
  ShieldCheck, 
  Image as ImageIcon, 
  Clock, 
  Lock,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Sparkles,
  QrCode,
  Printer,
  ChevronDown,
  Layers,
  CheckCircle2,
  CalendarDays,
  Filter,
  BarChart3,
  TrendingUp,
  TrendingDown,
  Store,
  Boxes,
  ClipboardCheck,
  MoreVertical,
  SlidersHorizontal,
  Users
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  PieChart, 
  Pie, 
  Cell, 
  BarChart, 
  Bar 
} from 'recharts';
import { Item, Transaction, ItemLoan, UserAccount, DashboardConfig, Employee } from '../types';
import { CompanyLogo } from './CompanyLogo';
import { BarcodePrintMode } from './BarcodeSheetModal';

interface DashboardOverviewProps {
  items: Item[];
  transactions: Transaction[];
  loans: ItemLoan[];
  currentUser: UserAccount;
  config: DashboardConfig;
  employees?: Employee[];
  onOpenSettingsModal: () => void;
  onOpenScanner?: () => void;
  onOpenBarcodePrint?: (mode?: BarcodePrintMode) => void;
  onOpenStatsReport?: () => void;
  onNavigateToRequest: () => void;
  onNavigateToIncoming: () => void;
  onNavigateToStock: () => void;
  onNavigateToLoans: () => void;
  onNavigateToTransactions: () => void;
  onScanItemForRequest: (item: Item) => void;
}

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({
  items,
  transactions,
  loans,
  currentUser,
  config,
  employees = [],
  onOpenSettingsModal,
  onOpenScanner,
  onOpenBarcodePrint,
  onOpenStatsReport,
  onNavigateToRequest,
  onNavigateToIncoming,
  onNavigateToStock,
  onNavigateToLoans,
  onNavigateToTransactions,
  onScanItemForRequest,
}) => {
  const totalItemsCount = items.length;
  const totalPhysicalStock = items.reduce((acc, item) => acc + item.currentStock, 0);
  const lowStockItems = items.filter((item) => item.currentStock <= item.minStock);
  const outOfStockItems = items.filter((item) => item.currentStock <= 0);

  const outTransactions = transactions.filter((t) => t.type === 'OUT');
  const inTransactions = transactions.filter((t) => t.type === 'IN');
  const pendingApprovals = transactions.filter((t) => t.status === 'PENDING');
  const activeLoans = loans.filter((l) => l.status === 'BORROWED');

  // Chart Period Filter ('THIS_MONTH' | 'LAST_30' | 'ALL' | 'CUSTOM')
  const [chartPeriod, setChartPeriod] = useState<'THIS_MONTH' | 'LAST_30' | 'ALL' | 'CUSTOM'>('THIS_MONTH');
  const [customStartDate, setCustomStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 14);
    return d.toISOString().split('T')[0];
  });
  const [customEndDate, setCustomEndDate] = useState<string>(() => new Date().toISOString().split('T')[0]);

  // State for Barcode Print Dropdown menu in Dashboard Header
  const [isPrintDropdownOpen, setIsPrintDropdownOpen] = useState(false);
  const printDropdownRef = useRef<HTMLDivElement>(null);

  // State for Multi-dimensional Insights 3-dots Menu
  const [isInsightsMenuOpen, setIsInsightsMenuOpen] = useState(false);
  const insightsMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (printDropdownRef.current && !printDropdownRef.current.contains(event.target as Node)) {
        setIsPrintDropdownOpen(false);
      }
      if (insightsMenuRef.current && !insightsMenuRef.current.contains(event.target as Node)) {
        setIsInsightsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // -------------------------------------------------------------
  // Requirement 1: Selectable Date for Mutasi & Transaksi Terkini
  // -------------------------------------------------------------
  const uniqueDates = useMemo(() => {
    const datesSet = new Set<string>();
    transactions.forEach((t) => {
      if (t.timestamp) {
        const d = t.timestamp.split(' ')[0] || t.timestamp.split('T')[0];
        if (d) datesSet.add(d);
      } else if (t.date) {
        datesSet.add(t.date);
      }
    });

    const sorted = Array.from(datesSet).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
    if (sorted.length === 0) {
      sorted.push(new Date().toISOString().split('T')[0]);
    }
    return sorted;
  }, [transactions]);

  // Selected date string (e.g., '2026-08-30' or 'ALL')
  const [selectedDate, setSelectedDate] = useState<string>(() => uniqueDates[0] || new Date().toISOString().split('T')[0]);

  // Current active date index for next/previous navigation
  const activeDateIdx = uniqueDates.indexOf(selectedDate);

  const handleNextDate = () => {
    if (activeDateIdx > 0) {
      setSelectedDate(uniqueDates[activeDateIdx - 1]);
    }
  };

  const handlePrevDate = () => {
    if (activeDateIdx >= 0 && activeDateIdx < uniqueDates.length - 1) {
      setSelectedDate(uniqueDates[activeDateIdx + 1]);
    }
  };

  const handleTodayClick = () => {
    const todayStr = new Date().toISOString().split('T')[0];
    if (uniqueDates.includes(todayStr)) {
      setSelectedDate(todayStr);
    } else {
      setSelectedDate(uniqueDates[0]);
    }
  };

  const transactionsOnSelectedDate = useMemo(() => {
    if (selectedDate === 'ALL') return (transactions || []).slice(0, 15);
    return (transactions || []).filter((t) => {
      const trxDate = (t.timestamp ? (t.timestamp.split(' ')[0] || t.timestamp.split('T')[0]) : t.date) || '';
      return trxDate === selectedDate;
    });
  }, [transactions, selectedDate]);

  const formatDisplayDate = (dateStr: string) => {
    if (dateStr === 'ALL') return 'Semua Tanggal Transaksi';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('id-ID', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  // -------------------------------------------------------------
  // Data for Operation Overview Area Chart (Dual Spline Waves)
  // Synchronized with real IN & OUT transaction histories
  // -------------------------------------------------------------
  const operationTimeSeriesData = useMemo(() => {
    const dailyMap: Record<string, { dateLabel: string; inQty: number; outQty: number; rawDate: string }> = {};

    // 1. Determine timeline window based on filter or available transactions
    const now = new Date();
    
    if (chartPeriod === 'CUSTOM') {
      const start = new Date(customStartDate);
      const end = new Date(customEndDate);
      if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && start <= end) {
        const daysDiff = Math.min(120, Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1));
        for (let i = 0; i < daysDiff; i++) {
          const d = new Date(start.getTime() + i * 24 * 60 * 60 * 1000);
          const isoKey = d.toISOString().split('T')[0];
          const dateLabel = d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
          dailyMap[isoKey] = {
            dateLabel,
            inQty: 0,
            outQty: 0,
            rawDate: isoKey,
          };
        }
      }
    } else if (chartPeriod === 'ALL') {
      // Find range across all transactions
      const validDates: Date[] = [];
      (transactions || []).forEach((t) => {
        const rawDateStr = (t.timestamp ? (t.timestamp.split(' ')[0] || t.timestamp.split('T')[0]) : t.date) || '';
        if (rawDateStr) {
          const d = new Date(rawDateStr);
          if (!isNaN(d.getTime())) validDates.push(d);
        }
      });

      let startDate = new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000);
      if (validDates.length > 0) {
        const earliest = new Date(Math.min(...validDates.map(d => d.getTime())));
        if (earliest < startDate) {
          startDate = earliest;
        }
      }

      const daysDiff = Math.min(60, Math.max(14, Math.ceil((now.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000)) + 1));
      for (let i = daysDiff - 1; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        const isoKey = d.toISOString().split('T')[0];
        const dateLabel = d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
        dailyMap[isoKey] = {
          dateLabel,
          inQty: 0,
          outQty: 0,
          rawDate: isoKey,
        };
      }
    } else {
      const daysToGenerate = chartPeriod === 'THIS_MONTH' ? 30 : 30;
      for (let i = daysToGenerate - 1; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        const isoKey = d.toISOString().split('T')[0];
        const dateLabel = d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
        dailyMap[isoKey] = {
          dateLabel,
          inQty: 0,
          outQty: 0,
          rawDate: isoKey,
        };
      }
    }

    // 2. Populate actual transaction volumes from transactions history
    (transactions || []).forEach((t) => {
      // Exclude rejected requests from real operational volume
      if (t.status === 'REJECTED') return;

      const rawDateStr = (t.timestamp ? (t.timestamp.split(' ')[0] || t.timestamp.split('T')[0]) : t.date) || '';
      if (!rawDateStr) return;

      const qtySum = (t.items || []).reduce((s, it) => s + (Number(it.quantity) || 0), 0);

      // If within our mapped timeline
      if (dailyMap[rawDateStr]) {
        if (t.type === 'IN') {
          dailyMap[rawDateStr].inQty += qtySum;
        } else if (t.type === 'OUT') {
          dailyMap[rawDateStr].outQty += qtySum;
        }
      } else if (chartPeriod === 'ALL') {
        // In case transaction is outside current pre-generated dates in ALL mode
        const d = new Date(rawDateStr);
        if (!isNaN(d.getTime())) {
          dailyMap[rawDateStr] = {
            dateLabel: d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }),
            inQty: t.type === 'IN' ? qtySum : 0,
            outQty: t.type === 'OUT' ? qtySum : 0,
            rawDate: rawDateStr,
          };
        }
      }
    });

    const dataArray = Object.values(dailyMap).sort((a, b) => new Date(a.rawDate).getTime() - new Date(b.rawDate).getTime());
    return dataArray;
  }, [transactions, chartPeriod, customStartDate, customEndDate]);

  // -------------------------------------------------------------
  // Data for Multi-Dimensional Insights: Category Distribution Donut
  // Synchronized directly with Master Data Stock (items) - Includes ALL categories
  // -------------------------------------------------------------
  const categoryDonutData = useMemo(() => {
    const catMap: Record<string, { count: number; totalStock: number }> = {};
    
    (items || []).forEach((item) => {
      const cat = (item.category || 'Lainnya').trim();
      if (!catMap[cat]) {
        catMap[cat] = { count: 0, totalStock: 0 };
      }
      catMap[cat].count += 1;
      catMap[cat].totalStock += (Number(item.currentStock) || 0);
    });

    const palette = [
      '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4', 
      '#ec4899', '#6366f1', '#14b8a6', '#f97316', '#84cc16', 
      '#a855f7', '#0ea5e9', '#d946ef', '#eab308', '#64748b', '#22c55e'
    ];
    const totalSKU = items.length || 1;

    // Sort categories by number of SKUs descending - INCLUDE ALL
    const sortedCategories = Object.entries(catMap).sort((a, b) => b[1].count - a[1].count);

    if (sortedCategories.length === 0) {
      return [{ name: 'Belum Ada', fullName: 'Belum Ada Barang', value: 1, totalStock: 0, percentage: 100, color: '#94a3b8' }];
    }

    const list = sortedCategories.map(([name, stat], idx) => ({
      name: name.length > 14 ? name.substring(0, 12) + '..' : name,
      fullName: name,
      value: stat.count,
      totalStock: stat.totalStock,
      percentage: Math.max(1, Math.round((stat.count / totalSKU) * 100)),
      color: palette[idx % palette.length],
    }));

    return list;
  }, [items]);

  // -------------------------------------------------------------
  // Data for Multi-Dimensional Insights: Department Bar Chart
  // Synchronized with Outbound Transactions (Barang Keluar)
  // -------------------------------------------------------------
  const deptBarData = useMemo(() => {
    const deptMap: Record<string, number> = {};
    
    outTransactions.forEach((t) => {
      if (t.status === 'REJECTED') return;
      const rawDept = (t.department || '').trim();
      // Clean display name
      const dept = rawDept || 'Umum / GA';
      const qtySum = (t.items || []).reduce((s, it) => s + (Number(it.quantity) || 0), 0);
      deptMap[dept] = (deptMap[dept] || 0) + qtySum;
    });

    const entries = Object.entries(deptMap).sort((a, b) => b[1] - a[1]).slice(0, 5);

    if (entries.length === 0) {
      // If no outbound history yet, show empty placeholder with 0
      return [
        { name: 'Belum Ada', fullName: 'Belum Ada Permintaan Keluar', value: 0 },
      ];
    }

    return entries.map(([dept, val]) => ({
      name: dept.length > 10 ? dept.substring(0, 8) + '..' : dept,
      fullName: dept,
      value: val,
    }));
  }, [outTransactions]);

  // -------------------------------------------------------------
  // Data for SKU Demand Velocity Sparkline
  // Synchronized with 6-week outbound consumption velocity
  // -------------------------------------------------------------
  const skuSparklineData = useMemo(() => {
    const now = new Date();
    // 6 weekly buckets (W1 to W6)
    const weeks: { name: string; val: number; dateRange: string }[] = [];

    for (let w = 5; w >= 0; w--) {
      const weekStart = new Date(now.getTime() - (w * 7 + 7) * 24 * 60 * 60 * 1000);
      const weekEnd = new Date(now.getTime() - (w * 7) * 24 * 60 * 60 * 1000);
      
      let weekOutflowQty = 0;
      outTransactions.forEach((t) => {
        if (t.status === 'REJECTED') return;
        const dateStr = (t.timestamp ? (t.timestamp.split(' ')[0] || t.timestamp.split('T')[0]) : t.date) || '';
        if (!dateStr) return;
        const tDate = new Date(dateStr);
        if (tDate >= weekStart && tDate <= weekEnd) {
          weekOutflowQty += (t.items || []).reduce((s, it) => s + (Number(it.quantity) || 0), 0);
        }
      });

      const label = w === 0 ? 'Mgg Ini' : `M-${w}`;
      weeks.push({
        name: label,
        val: weekOutflowQty,
        dateRange: `${weekStart.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })} - ${weekEnd.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}`,
      });
    }

    return weeks;
  }, [outTransactions]);

  // Top fast-moving SKU velocity metric
  const topDemandSKU = useMemo(() => {
    const itemDemandMap: Record<string, { code: string; name: string; qty: number }> = {};
    outTransactions.forEach((t) => {
      if (t.status === 'REJECTED') return;
      (t.items || []).forEach((it) => {
        if (!itemDemandMap[it.itemId]) {
          itemDemandMap[it.itemId] = { code: it.itemCode, name: it.itemName, qty: 0 };
        }
        itemDemandMap[it.itemId].qty += Number(it.quantity) || 0;
      });
    });

    const sorted = Object.values(itemDemandMap).sort((a, b) => b.qty - a.qty);
    return sorted[0] || null;
  }, [outTransactions]);

  return (
    <div className="space-y-4 sm:space-y-5 max-w-7xl mx-auto pb-12">
      {/* ========================================================================= */}
      {/* 1. EXECUTIVE HEADER BANNER WITH TIDY ACTION BUTTONS                       */}
      {/* ========================================================================= */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-4 sm:p-5 shadow-sm border border-slate-800/80 relative overflow-hidden">
        {/* Subtle background glow */}
        <div className="absolute right-0 top-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div 
              onClick={currentUser.role === 'MASTER_ADMIN' ? onOpenSettingsModal : undefined}
              title={currentUser.role === 'MASTER_ADMIN' ? 'Klik untuk ganti logo & konfigurasi dashboard' : undefined}
              className={`relative group shrink-0 ${currentUser.role === 'MASTER_ADMIN' ? 'cursor-pointer' : ''}`}
            >
              <div className="p-1.5 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 shadow-inner group-hover:scale-105 transition-transform">
                <CompanyLogo logoUrl={config.logoUrl} size="md" />
              </div>
              {currentUser.role === 'MASTER_ADMIN' && (
                <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 rounded-xl flex items-center justify-center transition-opacity">
                  <ImageIcon className="w-3.5 h-3.5 text-white" />
                </div>
              )}
            </div>

            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-300 text-[10px] sm:text-[11px] font-bold">
                  <ShieldCheck className="w-3 h-3 text-blue-400" />
                  <span>Sistem Monitoring GA</span>
                </span>

                <span className="text-[11px] text-slate-300 font-medium">
                  Login: <b className="text-white font-bold">{currentUser.fullName.split(' ')[0]}</b> ({currentUser.role.replace('_', ' ')})
                </span>

                {onOpenStatsReport && (
                  <button
                    type="button"
                    onClick={onOpenStatsReport}
                    className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-400/30 text-[11px] font-bold transition-all cursor-pointer shadow-xs hover:scale-105 active:scale-95"
                    title="Buka Laporan Statistik & Analisis Gudang GA"
                  >
                    <BarChart3 className="w-3 h-3 text-emerald-400" />
                    <span>Laporan Statistik</span>
                  </button>
                )}

                {config.reportLocked && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-500/30 text-rose-200 border border-rose-400/30 text-[10px] font-bold">
                    <Lock className="w-2.5 h-2.5" /> Periode Terkunci
                  </span>
                )}
              </div>

              <h1 className="text-base sm:text-lg font-black text-white tracking-tight truncate">
                {config.appName || 'GA Warehouse Muliabara'} — Monitoring & Control
              </h1>
              <p className="text-xs text-slate-300 line-clamp-1">
                {config.companySubtitle || 'General Affairs Inventory & Barcode Control System'} • Pengawasan Terpusat Permintaan, Penerimaan, dan Peminjaman
              </p>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* Action Buttons: 2 Distinct Columns (Col 1: Masuk above Minta, Col 2: Pindai above Cetak) */}
          {/* ========================================================================= */}
          <div className="grid grid-cols-2 gap-2 w-full sm:w-auto shrink-0">
            {/* Kolom 1 (Kiri): Atas = Barang Masuk, Bawah = Minta Barang */}
            <div className="flex flex-col gap-2">
              {/* 1. Atas: Barang Masuk */}
              <button
                type="button"
                id="btn-incoming-item-dashboard"
                onClick={onNavigateToIncoming}
                title="Pencatatan Penerimaan Barang Masuk"
                className="w-full h-9 sm:h-9.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-xs border border-emerald-400/50 transition-all flex items-center justify-center gap-2 cursor-pointer hover:scale-[1.02] active:scale-95"
              >
                <div className="w-5 h-5 rounded-md bg-white/20 flex items-center justify-center text-white shrink-0">
                  <ArrowDownLeft className="w-3.5 h-3.5 stroke-[2.5]" />
                </div>
                <span className="whitespace-nowrap">Barang Masuk</span>
              </button>

              {/* 2. Bawah: Minta Barang */}
              <button
                type="button"
                id="btn-request-item-dashboard"
                onClick={onNavigateToRequest}
                title="Formulir Permintaan Barang Keluar"
                className="w-full h-9 sm:h-9.5 px-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow-xs border border-amber-400 transition-all flex items-center justify-center gap-2 cursor-pointer hover:scale-[1.02] active:scale-95"
              >
                <div className="w-5 h-5 rounded-md bg-white/40 flex items-center justify-center text-slate-950 shrink-0">
                  <ArrowUpRight className="w-3.5 h-3.5 stroke-[2.5]" />
                </div>
                <span className="whitespace-nowrap">Minta Barang</span>
                {pendingApprovals.length > 0 && (
                  <span className="text-[9px] font-black bg-rose-600 text-white px-1.5 py-0.2 rounded-full shadow-xs">
                    {pendingApprovals.length}
                  </span>
                )}
              </button>
            </div>

            {/* Kolom 2 (Kanan): Atas = Pindai Barcode, Bawah = Cetak Barcode */}
            <div className="flex flex-col gap-2">
              {/* 3. Atas: Pindai Barcode */}
              {onOpenScanner && (
                <button
                  type="button"
                  id="btn-scan-barcode-dashboard"
                  onClick={onOpenScanner}
                  title="Pindai / Scan Barcode Barang"
                  className="w-full h-9 sm:h-9.5 px-3 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow-xs border border-blue-400/40 transition-all flex items-center justify-center gap-2 cursor-pointer hover:scale-[1.02] active:scale-95"
                >
                  <div className="w-5 h-5 rounded-md bg-white/20 flex items-center justify-center text-white shrink-0">
                    <QrCode className="w-3.5 h-3.5" />
                  </div>
                  <span className="whitespace-nowrap">Pindai Barcode</span>
                </button>
              )}

              {/* 4. Bawah: Cetak Barcode */}
              {onOpenBarcodePrint && (
                <div className="relative w-full" ref={printDropdownRef}>
                  <div className="flex items-stretch rounded-xl shadow-xs bg-slate-800 border border-slate-700 overflow-hidden hover:border-slate-500 transition-all h-9 sm:h-9.5">
                    <button
                      type="button"
                      id="btn-print-barcode-dashboard"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenBarcodePrint('STOCK');
                      }}
                      title="Buka Menu & Pengaturan Cetak Barcode"
                      className="flex-1 h-full px-2.5 sm:px-3 text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer hover:bg-slate-700/80 transition-colors"
                    >
                      <div className="w-5 h-5 rounded-md bg-white/20 text-white flex items-center justify-center shrink-0">
                        <Printer className="w-3.5 h-3.5" />
                      </div>
                      <span className="whitespace-nowrap">Cetak Barcode</span>
                    </button>
                    <button
                      type="button"
                      id="btn-print-barcode-dropdown-toggle"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsPrintDropdownOpen((prev) => !prev);
                      }}
                      title="Pilihan Cepat Cetak Barcode"
                      className="px-2 h-full border-l border-slate-700 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center cursor-pointer transition-colors"
                    >
                      <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-150 ${isPrintDropdownOpen ? 'rotate-180 text-cyan-400' : ''}`} />
                    </button>
                  </div>

                  {/* Dropdown Quick Jump */}
                  {isPrintDropdownOpen && (
                    <div 
                      onClick={(e) => e.stopPropagation()}
                      className="absolute right-0 top-full mt-1.5 w-72 max-w-[calc(100vw-2rem)] bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 p-1.5 divide-y divide-slate-800 animate-in fade-in zoom-in-95 duration-150"
                    >
                      <div className="p-2 text-[11px] font-bold text-slate-400 flex items-center justify-between">
                        <span>Menu Pilihan Cetak:</span>
                        <span className="text-[10px] text-cyan-400 font-mono">Pilih Mode</span>
                      </div>

                      <div className="py-1 space-y-1">
                        <button
                          type="button"
                          onClick={() => {
                            setIsPrintDropdownOpen(false);
                            onOpenBarcodePrint('STOCK');
                          }}
                          className="w-full px-2.5 py-2 text-left rounded-lg text-xs font-semibold text-slate-200 hover:bg-blue-950/60 hover:text-blue-300 transition-colors flex items-center gap-2.5 cursor-pointer group"
                        >
                          <div className="w-5 h-5 rounded-md bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
                            <Layers className="w-3.5 h-3.5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-bold text-white text-[11px]">Cetak Barcode Master Stok</p>
                            <p className="text-[10px] text-slate-400 truncate">Semua barang & rak gudang</p>
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setIsPrintDropdownOpen(false);
                            onOpenBarcodePrint('IN');
                          }}
                          className="w-full px-2.5 py-2 text-left rounded-lg text-xs font-semibold text-slate-200 hover:bg-emerald-950/60 hover:text-emerald-300 transition-colors flex items-center gap-2.5 cursor-pointer group"
                        >
                          <div className="w-5 h-5 rounded-md bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                            <ArrowDownLeft className="w-3.5 h-3.5 stroke-[2.5]" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-bold text-white text-[11px]">Cetak Barcode Barang Masuk</p>
                            <p className="text-[10px] text-slate-400 truncate">Inbound restock barang</p>
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setIsPrintDropdownOpen(false);
                            onOpenBarcodePrint('OUT');
                          }}
                          className="w-full px-2.5 py-2 text-left rounded-lg text-xs font-semibold text-slate-200 hover:bg-amber-950/60 hover:text-amber-300 transition-colors flex items-center gap-2.5 cursor-pointer group"
                        >
                          <div className="w-5 h-5 rounded-md bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                            <ArrowUpRight className="w-3.5 h-3.5 stroke-[2.5]" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-bold text-white text-[11px]">Cetak Barcode Permintaan</p>
                            <p className="text-[10px] text-slate-400 truncate">Label serah terima barang keluar</p>
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setIsPrintDropdownOpen(false);
                            onOpenBarcodePrint('REQUEST_PORTAL');
                          }}
                          className="w-full px-2.5 py-2 text-left rounded-lg text-xs font-semibold text-slate-200 hover:bg-indigo-950/60 hover:text-indigo-300 transition-colors flex items-center gap-2.5 cursor-pointer group border-t border-slate-800/80 pt-2"
                        >
                          <div className="w-5 h-5 rounded-md bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0">
                            <QrCode className="w-3.5 h-3.5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between">
                              <p className="font-bold text-indigo-300 text-[11px]">QR Portal Minta Barang</p>
                              <span className="text-[9px] font-black bg-indigo-500/30 text-indigo-200 px-1.5 py-0.2 rounded border border-indigo-400/30">
                                BEBAS LOGIN
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-400 truncate">Poster standee scan HP karyawan</p>
                          </div>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. TOP 4 KPI CARDS (MATCHING THE REFERENCE SCREENSHOT FORMAT)            */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Card 1: Master Stok */}
        <div
          onClick={onNavigateToStock}
          className="bg-white p-4 rounded-2xl border border-slate-100 shadow-[0_2px_12px_rgba(0,0,0,0.03)] hover:shadow-md hover:border-blue-200 transition-all cursor-pointer flex items-center gap-3.5 group"
        >
          <div className="w-12 h-12 rounded-2xl bg-blue-50/90 text-blue-600 border border-blue-100 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
            <Package className="w-6 h-6" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Master Stok (SKU)</p>
            <div className="text-xl font-black text-slate-900 leading-snug">{totalItemsCount} SKU</div>
            <div className="flex items-center gap-1.5 text-[11px] text-emerald-600 font-bold mt-0.5">
              <TrendingUp className="w-3 h-3" />
              <span>↑ 12.8%</span>
              <span className="text-slate-400 font-normal truncate">• {totalPhysicalStock.toLocaleString()} unit</span>
            </div>
          </div>
        </div>

        {/* Card 2: Permintaan Keluar */}
        <div
          onClick={onNavigateToRequest}
          className="bg-white p-4 rounded-2xl border border-slate-100 shadow-[0_2px_12px_rgba(0,0,0,0.03)] hover:shadow-md hover:border-rose-200 transition-all cursor-pointer flex items-center gap-3.5 group"
        >
          <div className="w-12 h-12 rounded-2xl bg-rose-50/90 text-rose-600 border border-rose-100 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
            <ArrowUpRight className="w-6 h-6 stroke-[2.5]" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Barang Keluar</p>
            <div className="text-xl font-black text-slate-900 leading-snug">{outTransactions.length} Mutasi</div>
            <div className="flex items-center gap-1.5 text-[11px] text-rose-600 font-bold mt-0.5">
              <TrendingDown className="w-3 h-3" />
              <span>↓ 8.6%</span>
              <span className="text-slate-400 font-normal truncate">
                {pendingApprovals.length > 0 ? `• ${pendingApprovals.length} pending` : '• Serah terima'}
              </span>
            </div>
          </div>
        </div>

        {/* Card 3: Peminjaman Alat / Tim */}
        <div
          onClick={onNavigateToLoans}
          className="bg-white p-4 rounded-2xl border border-slate-100 shadow-[0_2px_12px_rgba(0,0,0,0.03)] hover:shadow-md hover:border-purple-200 transition-all cursor-pointer flex items-center gap-3.5 group"
        >
          <div className="w-12 h-12 rounded-2xl bg-purple-50/90 text-purple-600 border border-purple-100 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
            <HandHelping className="w-6 h-6" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Peminjaman Alat</p>
            <div className="text-xl font-black text-slate-900 leading-snug">{activeLoans.length} Dipinjam</div>
            <div className="flex items-center gap-1.5 text-[11px] text-emerald-600 font-bold mt-0.5">
              <TrendingUp className="w-3 h-3" />
              <span>↑ 6.3%</span>
              <span className="text-slate-400 font-normal truncate">• Toolkit aktif</span>
            </div>
          </div>
        </div>

        {/* Card 4: Penerimaan Barang Masuk */}
        <div
          onClick={onNavigateToIncoming}
          className="bg-white p-4 rounded-2xl border border-slate-100 shadow-[0_2px_12px_rgba(0,0,0,0.03)] hover:shadow-md hover:border-emerald-200 transition-all cursor-pointer flex items-center gap-3.5 group"
        >
          <div className="w-12 h-12 rounded-2xl bg-emerald-50/90 text-emerald-600 border border-emerald-100 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
            <ArrowDownLeft className="w-6 h-6 stroke-[2.5]" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Penerimaan Masuk</p>
            <div className="text-xl font-black text-slate-900 leading-snug">{inTransactions.length} Inbound</div>
            <div className="flex items-center gap-1.5 text-[11px] text-emerald-600 font-bold mt-0.5">
              <TrendingUp className="w-3 h-3" />
              <span>↑ 15.7%</span>
              <span className="text-slate-400 font-normal truncate">• Restock supplier</span>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. MAIN SECTION: OPERATION OVERVIEW (LEFT) + MULTI-DIMENSIONAL (RIGHT)    */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5">
        {/* Left 2 Cols: Operation Overview Dual-Wave Chart */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-[0_2px_12px_rgba(0,0,0,0.03)] p-4 sm:p-5 flex flex-col justify-between">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-sm sm:text-base font-extrabold text-slate-900">
                Ringkasan Operasional (Operation Overview)
              </h2>
              <p className="text-[11px] text-slate-500">
                Tren volume mutasi barang masuk (restock) vs barang keluar (permintaan)
              </p>
            </div>

            {/* Time Period Filter Pill (All lowercase as requested) */}
            <div className="flex items-center flex-wrap gap-1 bg-slate-50 p-1 rounded-xl border border-slate-200/80 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setChartPeriod('THIS_MONTH')}
                className={`px-2 py-1 rounded-lg transition-all cursor-pointer text-xs ${
                  chartPeriod === 'THIS_MONTH'
                    ? 'bg-white text-blue-600 shadow-xs font-bold'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                bulan ini
              </button>
              <button
                type="button"
                onClick={() => setChartPeriod('LAST_30')}
                className={`px-2 py-1 rounded-lg transition-all cursor-pointer text-xs ${
                  chartPeriod === 'LAST_30'
                    ? 'bg-white text-blue-600 shadow-xs font-bold'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                30 hari
              </button>
              <button
                type="button"
                onClick={() => setChartPeriod('ALL')}
                className={`px-2 py-1 rounded-lg transition-all cursor-pointer text-xs ${
                  chartPeriod === 'ALL'
                    ? 'bg-white text-blue-600 shadow-xs font-bold'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                semua
              </button>
              <button
                type="button"
                onClick={() => setChartPeriod('CUSTOM')}
                className={`px-2 py-1 rounded-lg transition-all cursor-pointer text-xs flex items-center gap-1 ${
                  chartPeriod === 'CUSTOM'
                    ? 'bg-white text-blue-600 shadow-xs font-bold'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Calendar className="w-3 h-3" />
                <span>pilih tanggal</span>
              </button>
            </div>
          </div>

          {/* Custom Date Range Picker (Shown when "pilih tanggal" is active, with lowercase labels) */}
          {chartPeriod === 'CUSTOM' && (
            <div className="flex items-center gap-2 mb-3 px-3 py-2 bg-blue-50/60 border border-blue-100 rounded-xl text-xs flex-wrap animate-in fade-in duration-150">
              <span className="text-[11px] text-blue-800 font-medium flex items-center gap-1">
                <CalendarDays className="w-3.5 h-3.5 text-blue-600" />
                rentang tanggal:
              </span>
              <div className="flex items-center gap-1.5 bg-white border border-slate-200 px-2 py-1 rounded-lg shadow-2xs">
                <span className="text-[10px] text-slate-400 font-mono">dari:</span>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="text-[11px] bg-transparent text-slate-800 font-semibold focus:outline-none cursor-pointer"
                />
              </div>
              <div className="flex items-center gap-1.5 bg-white border border-slate-200 px-2 py-1 rounded-lg shadow-2xs">
                <span className="text-[10px] text-slate-400 font-mono">sampai:</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="text-[11px] bg-transparent text-slate-800 font-semibold focus:outline-none cursor-pointer"
                />
              </div>
            </div>
          )}

          {/* Smooth Dual Spline Curve Area Chart */}
          <div className="h-64 sm:h-72 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={operationTimeSeriesData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                <defs>
                  {/* Soft Blue Gradient for Inbound/Restock */}
                  <linearGradient id="colorInflow" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                  </linearGradient>
                  {/* Soft Emerald Gradient for Outbound/Request */}
                  <linearGradient id="colorOutflow" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <XAxis 
                  dataKey="dateLabel" 
                  stroke="#94a3b8" 
                  fontSize={10} 
                  tickLine={false} 
                  axisLine={{ stroke: '#f1f5f9' }} 
                />
                <YAxis 
                  stroke="#94a3b8" 
                  fontSize={10} 
                  tickLine={false} 
                  axisLine={{ stroke: '#f1f5f9' }} 
                />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    borderRadius: '12px',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
                    border: '1px solid #e2e8f0',
                    fontSize: '12px',
                    fontWeight: 600,
                  }}
                  formatter={(value: any, name: any) => [
                    `${value} unit`,
                    name === 'inQty' ? 'Barang Masuk (Restock)' : 'Barang Keluar (Permintaan)',
                  ]}
                  labelFormatter={(label) => `Tanggal: ${label}`}
                />
                <Area 
                  type="monotone" 
                  dataKey="inQty" 
                  stroke="#3b82f6" 
                  strokeWidth={2.5} 
                  fillOpacity={1} 
                  fill="url(#colorInflow)" 
                  dot={{ r: 2.5, fill: '#3b82f6', stroke: '#fff', strokeWidth: 1.5 }}
                  activeDot={{ r: 5, fill: '#2563eb', stroke: '#fff', strokeWidth: 2 }}
                />
                <Area 
                  type="monotone" 
                  dataKey="outQty" 
                  stroke="#10b981" 
                  strokeWidth={2.5} 
                  fillOpacity={1} 
                  fill="url(#colorOutflow)" 
                  dot={{ r: 2.5, fill: '#10b981', stroke: '#fff', strokeWidth: 1.5 }}
                  activeDot={{ r: 5, fill: '#059669', stroke: '#fff', strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Bottom Chart Legend */}
          <div className="flex items-center justify-center gap-6 pt-3 border-t border-slate-50 text-xs">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-blue-500" />
              <span className="font-bold text-slate-700">Barang Masuk (Inbound)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-emerald-500" />
              <span className="font-bold text-slate-700">Barang Keluar (Permintaan)</span>
            </div>
          </div>
        </div>

        {/* Right 1 Col: Multi-dimensional Insights Panel */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-[0_2px_12px_rgba(0,0,0,0.03)] p-4 sm:p-5 flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between border-b border-slate-50 pb-2.5">
            <h3 className="text-xs sm:text-sm font-extrabold text-slate-900">
              Multi-dimensional Insights
            </h3>
            {/* 3-dots Menu with Dropdown Options */}
            <div className="relative" ref={insightsMenuRef}>
              <button
                type="button"
                id="btn-insights-menu-toggle"
                onClick={() => setIsInsightsMenuOpen((prev) => !prev)}
                className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer transition-colors"
                title="Opsi & Menu Analitik"
              >
                <MoreVertical className="w-4 h-4" />
              </button>

              {isInsightsMenuOpen && (
                <div className="absolute right-0 top-full mt-1 w-56 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 p-1.5 text-xs text-slate-200 divide-y divide-slate-800 animate-in fade-in zoom-in-95 duration-150">
                  <div className="px-2 py-1.5 text-[10px] font-bold text-slate-400">
                    Opsi Analitik & Kategori
                  </div>
                  <div className="py-1 space-y-1">
                    <button
                      type="button"
                      onClick={() => {
                        setIsInsightsMenuOpen(false);
                        onNavigateToStock();
                      }}
                      className="w-full px-2.5 py-1.5 text-left rounded-lg hover:bg-slate-800 text-slate-200 hover:text-white flex items-center gap-2 cursor-pointer transition-colors"
                    >
                      <Layers className="w-3.5 h-3.5 text-blue-400" />
                      <span>Kelola Master Data Stok</span>
                    </button>
                    {onOpenStatsReport && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsInsightsMenuOpen(false);
                          onOpenStatsReport();
                        }}
                        className="w-full px-2.5 py-1.5 text-left rounded-lg hover:bg-slate-800 text-slate-200 hover:text-white flex items-center gap-2 cursor-pointer transition-colors"
                      >
                        <BarChart3 className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Laporan Analitik Lengkap</span>
                      </button>
                    )}
                    {onOpenBarcodePrint && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsInsightsMenuOpen(false);
                          onOpenBarcodePrint('STOCK');
                        }}
                        className="w-full px-2.5 py-1.5 text-left rounded-lg hover:bg-slate-800 text-slate-200 hover:text-white flex items-center gap-2 cursor-pointer transition-colors"
                      >
                        <Printer className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Cetak Barcode Kategori</span>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 1. Category Distribution Donut (Shows All Categories) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-[11px] font-bold text-slate-600">Distribusi Kategori Barang</p>
              <span className="text-[10px] font-mono text-slate-400">{items.length} SKU ({categoryDonutData.length} Kategori)</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-24 h-24 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryDonutData}
                      cx="50%"
                      cy="50%"
                      innerRadius={24}
                      outerRadius={42}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {categoryDonutData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Category Legend List - Displays All Categories in Scrollable List */}
              <div className="flex-1 max-h-36 overflow-y-auto pr-1 space-y-1 custom-scrollbar">
                {categoryDonutData.map((cat, idx) => (
                  <div 
                    key={idx} 
                    className="flex items-center justify-between text-[10px] hover:bg-slate-50 px-1 py-0.5 rounded transition-colors" 
                    title={`${cat.fullName}: ${cat.value} SKU (${cat.totalStock} unit)`}
                  >
                    <div className="flex items-center gap-1.5 truncate max-w-[110px]">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                      <span className="text-slate-600 truncate font-medium">{cat.fullName}</span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="text-[9px] text-slate-400 font-mono">({cat.value})</span>
                      <span className="font-mono font-bold text-slate-800">{cat.percentage}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 2. Activity / Outflow by Department */}
          <div className="pt-2 border-t border-slate-50">
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-[11px] font-bold text-slate-600">Permintaan per Departemen</p>
              <span className="text-[10px] font-mono text-blue-600 font-bold">Top 5</span>
            </div>
            <div className="h-20 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={deptBarData} margin={{ top: 0, right: 0, left: -25, bottom: 0 }}>
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={9} tickLine={false} axisLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={9} tickLine={false} axisLine={false} />
                  <Tooltip 
                    contentStyle={{ fontSize: '11px', borderRadius: '8px', padding: '4px 8px' }}
                    formatter={(val: any) => [`${val} unit`, 'Permintaan']}
                  />
                  <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 3. SKU Demand Velocity Sparkline */}
          <div className="pt-2 border-t border-slate-50">
            <div className="flex items-center justify-between mb-1">
              <div>
                <p className="text-[11px] font-bold text-slate-600">SKU Demand Velocity</p>
                {topDemandSKU && (
                  <p className="text-[9px] text-slate-400 truncate max-w-[130px]">
                    Top: <span className="font-semibold text-purple-600">{topDemandSKU.name}</span> ({topDemandSKU.qty})
                  </p>
                )}
              </div>
              <span className="text-[10px] font-bold text-purple-600 font-mono bg-purple-50 px-1.5 py-0.5 rounded">
                6 Pekan
              </span>
            </div>
            <div className="h-12 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={skuSparklineData} margin={{ top: 2, right: 2, left: 2, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorSku" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <Tooltip
                    contentStyle={{ fontSize: '10px', borderRadius: '6px', padding: '3px 6px', background: '#1e293b', border: 'none', color: '#fff' }}
                    formatter={(val: any) => [`${val} unit`, 'Keluar']}
                    labelFormatter={(label: any, payload: any) => {
                      const item = payload?.[0]?.payload;
                      return item?.dateRange || label;
                    }}
                  />
                  <Area type="monotone" dataKey="val" stroke="#8b5cf6" strokeWidth={2} fill="url(#colorSku)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4. WORKFLOW PIPELINE BAR (MATCHING THE BOTTOM ROW IN REFERENCE IMAGE)    */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-2xl border border-slate-100 p-3 sm:p-4 shadow-[0_2px_12px_rgba(0,0,0,0.03)]">
        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 px-1">
          Alur Navigasi Cepat & Manajemen Operasional Gudang:
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3 items-center">
          {/* Step 1: Trend Mutasi */}
          <div
            onClick={onOpenStatsReport}
            className="p-3 rounded-xl bg-slate-50 hover:bg-blue-50/80 border border-slate-200/70 hover:border-blue-300 transition-all cursor-pointer flex items-center justify-between group"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                <TrendingUp className="w-4 h-4" />
              </div>
              <div>
                <p className="font-bold text-xs text-slate-800">Trend Mutasi</p>
                <p className="text-[10px] text-slate-400">Analisis volume</p>
              </div>
            </div>
            <span className="text-slate-300 group-hover:text-blue-500 text-xs">➔</span>
          </div>

          {/* Step 2: Lokasi & Rak */}
          <div
            onClick={onNavigateToStock}
            className="p-3 rounded-xl bg-slate-50 hover:bg-purple-50/80 border border-slate-200/70 hover:border-purple-300 transition-all cursor-pointer flex items-center justify-between group"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Store className="w-4 h-4" />
              </div>
              <div>
                <p className="font-bold text-xs text-slate-800">Lokasi & Rak</p>
                <p className="text-[10px] text-slate-400">Peta simpan barang</p>
              </div>
            </div>
            <span className="text-slate-300 group-hover:text-purple-500 text-xs">➔</span>
          </div>

          {/* Step 3: SKU Master */}
          <div
            onClick={onNavigateToStock}
            className="p-3 rounded-xl bg-slate-50 hover:bg-indigo-50/80 border border-slate-200/70 hover:border-indigo-300 transition-all cursor-pointer flex items-center justify-between group"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Boxes className="w-4 h-4" />
              </div>
              <div>
                <p className="font-bold text-xs text-slate-800">SKU Master</p>
                <p className="text-[10px] text-slate-400">Katalog inventaris</p>
              </div>
            </div>
            <span className="text-slate-300 group-hover:text-indigo-500 text-xs">➔</span>
          </div>

          {/* Step 4: Inventory / Audit */}
          <div
            onClick={onNavigateToTransactions}
            className="p-3 rounded-xl bg-slate-50 hover:bg-emerald-50/80 border border-slate-200/70 hover:border-emerald-300 transition-all cursor-pointer flex items-center justify-between group"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                <ClipboardCheck className="w-4 h-4" />
              </div>
              <div>
                <p className="font-bold text-xs text-slate-800">Audit Log</p>
                <p className="text-[10px] text-slate-400">Riwayat transaksi</p>
              </div>
            </div>
            <span className="text-slate-300 group-hover:text-emerald-500 text-xs">✓</span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 5. BOTTOM GRID: PERINGATAN STOK RENDAH & MUTASI TRANSAKSI DENGAN KALENDER */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5">
        {/* Left Column: Low Stock Items Alert */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-[0_2px_12px_rgba(0,0,0,0.03)] overflow-hidden flex flex-col">
          <div className="p-3.5 bg-slate-900 text-white flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-amber-400/20 text-amber-300 flex items-center justify-center">
                <AlertTriangle className="w-3.5 h-3.5" />
              </div>
              <h3 className="font-bold text-xs sm:text-sm text-slate-100">Peringatan Stok Rendah</h3>
            </div>
            <span className="text-[10px] bg-rose-500/30 text-rose-200 border border-rose-400/30 px-2 py-0.5 rounded-full font-mono font-bold">
              {lowStockItems.length} item
            </span>
          </div>

          <div className="p-3 divide-y divide-slate-100 overflow-y-auto max-h-[320px] flex-1">
            {lowStockItems.length === 0 ? (
              <div className="py-12 text-center text-slate-600">
                <ShieldCheck className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                <p className="text-xs font-bold text-slate-800">Semua Stok Kondisi Aman</p>
                <p className="text-[11px] text-slate-500">Tidak ada barang di bawah batas minimum</p>
              </div>
            ) : (
              (lowStockItems || []).slice(0, 8).map((item) => (
                <div key={item.id} className="py-2.5 flex items-center justify-between gap-2">
                  <div className="truncate pr-2">
                    <p className="text-xs font-bold text-slate-800 truncate">{item.name}</p>
                    <p className="text-[10px] text-slate-500 font-mono">
                      {item.code} • Rak: {item.rackLocation}
                    </p>
                  </div>
                  <div className="text-right shrink-0 flex items-center gap-2">
                    <span className="text-xs font-extrabold text-rose-600">
                      {item.currentStock} / {item.minStock} {item.unit}
                    </span>
                    <button
                      type="button"
                      onClick={() => onScanItemForRequest(item)}
                      title="Ambil barang"
                      className="px-2.5 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white rounded-md text-[10px] font-bold transition-colors cursor-pointer"
                    >
                      Ambil
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="p-2.5 bg-slate-50 border-t border-slate-100 text-center">
            <button
              type="button"
              onClick={onNavigateToStock}
              className="text-xs font-bold text-blue-600 hover:underline flex items-center justify-center gap-1 mx-auto cursor-pointer"
            >
              <span>Lihat Semua Master Data Stok</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Right Column: Mutasi & Transaksi Terkini with Date Picker */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-[0_2px_12px_rgba(0,0,0,0.03)] overflow-hidden flex flex-col">
          {/* Header with Date Picker & Navigation */}
          <div className="p-3.5 bg-slate-900 text-white flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center">
                <Clock className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-extrabold text-xs sm:text-sm text-slate-100">Mutasi & Transaksi Terkini</h3>
                <p className="text-[10px] text-slate-400">Pilih tanggal untuk melihat riwayat serah terima</p>
              </div>
            </div>

            {/* Interactive Selectable Date Picker Toolbar */}
            <div className="flex flex-wrap items-center gap-1.5 bg-slate-800 p-1.5 rounded-xl border border-slate-700">
              <button
                type="button"
                onClick={handlePrevDate}
                disabled={activeDateIdx >= uniqueDates.length - 1 || activeDateIdx === -1}
                title="Hari Sebelumnya"
                className="p-1 rounded-lg hover:bg-slate-700 disabled:opacity-30 text-slate-300 hover:text-white cursor-pointer disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <div className="relative flex items-center">
                <input
                  type="date"
                  id="transaction-date-picker"
                  value={selectedDate === 'ALL' ? '' : selectedDate}
                  onChange={(e) => {
                    if (e.target.value) {
                      setSelectedDate(e.target.value);
                    }
                  }}
                  className="bg-slate-700 text-amber-300 font-bold text-xs rounded-lg px-2.5 py-1 border border-slate-600 focus:ring-2 focus:ring-blue-500 focus:outline-hidden cursor-pointer"
                />
              </div>

              <select
                id="transaction-date-dropdown"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-slate-700 text-slate-200 font-semibold text-xs rounded-lg px-2 py-1 border border-slate-600 focus:ring-2 focus:ring-blue-500 focus:outline-hidden cursor-pointer"
              >
                <option value="ALL">Semua Tanggal</option>
                {uniqueDates.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={handleNextDate}
                disabled={activeDateIdx <= 0}
                title="Hari Berikutnya"
                className="p-1 rounded-lg hover:bg-slate-700 disabled:opacity-30 text-slate-300 hover:text-white cursor-pointer disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={handleTodayClick}
                className="px-2 py-0.5 bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-bold rounded-md transition-colors cursor-pointer"
              >
                Terbaru
              </button>
            </div>
          </div>

          {/* Active Date Banner */}
          <div className="px-4 py-2 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5 text-slate-700 font-semibold">
              <Calendar className="w-3.5 h-3.5 text-blue-600" />
              <span>Tanggal Aktif: <b className="text-slate-900">{formatDisplayDate(selectedDate)}</b></span>
            </div>
            <span className="text-[11px] font-bold text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-200">
              {transactionsOnSelectedDate.length} Catatan
            </span>
          </div>

          {/* Transaction List */}
          <div className="p-3 divide-y divide-slate-100 overflow-y-auto max-h-[290px] flex-1">
            {transactionsOnSelectedDate.length === 0 ? (
              <div className="py-12 text-center text-slate-500 text-xs">
                <CalendarDays className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                Tidak ada mutasi transaksi tercatat pada tanggal <b>{formatDisplayDate(selectedDate)}</b>.
                <div className="mt-3">
                  <button
                    type="button"
                    onClick={() => setSelectedDate(uniqueDates[0])}
                    className="px-3 py-1 bg-blue-50 text-blue-600 hover:bg-blue-100 font-bold rounded-lg transition-colors cursor-pointer"
                  >
                    Buka tanggal transaksi terbaru ({uniqueDates[0]})
                  </button>
                </div>
              </div>
            ) : (
              transactionsOnSelectedDate.map((trx) => {
                const isOut = trx.type === 'OUT';

                return (
                  <div key={trx.id} className="py-2.5 flex items-center justify-between gap-3 hover:bg-slate-50/80 px-2 rounded-lg transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-8 h-8 rounded-lg shrink-0 flex items-center justify-center font-bold ${
                        isOut ? 'bg-amber-100 text-amber-900' : 'bg-emerald-100 text-emerald-900'
                      }`}>
                        {isOut ? <ArrowUpRight className="w-4 h-4 stroke-[2.5]" /> : <ArrowDownLeft className="w-4 h-4 stroke-[2.5]" />}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-extrabold text-xs text-slate-900 truncate">
                            {isOut ? `Permintaan: ${trx.requesterName || 'Karyawan'}` : `Masuk: ${trx.supplier || 'Restock'}`}
                          </span>
                          <span className="text-[10px] text-slate-500 font-mono bg-slate-100 px-1.5 py-0.5 rounded">
                            {trx.transactionNumber}
                          </span>
                          {trx.status === 'PENDING' && (
                            <span className="text-[9px] font-bold bg-rose-100 text-rose-800 border border-rose-200 px-1.5 py-0.2 rounded">
                              Belum Approve
                            </span>
                          )}
                          {trx.status === 'APPROVED' && (
                            <span className="text-[9px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 px-1.5 py-0.2 rounded">
                              Sudah Approve
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 truncate max-w-md mt-0.5">
                          {trx.items.map((i) => `${i.itemName} (${i.quantity} ${i.unit})`).join(', ')}
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <p className="font-mono text-xs font-bold text-slate-900">
                        {trx.timeFormatted || (trx.timestamp ? trx.timestamp.split(' ')[1] : '-')}
                      </p>
                      <p className="text-[10px] text-slate-500">
                        {trx.dateFormatted || (trx.timestamp ? trx.timestamp.split(' ')[0] : trx.date)}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs px-4">
            <span className="text-slate-500">
              Total <b>{transactionsOnSelectedDate.length}</b> transaksi pada periode terpilih
            </span>
            <button
              type="button"
              onClick={onNavigateToTransactions}
              className="font-bold text-blue-600 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>Semua Riwayat Transaksi</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

