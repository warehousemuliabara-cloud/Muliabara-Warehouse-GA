import React, { useState } from 'react';
import { 
  History, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Search, 
  Filter, 
  Printer, 
  Download, 
  FileText, 
  Calendar, 
  Clock, 
  User, 
  Building2, 
  Package, 
  CheckCircle2,
  Share2,
  Trash2,
  AlertTriangle,
  RotateCcw,
  X,
  Undo2
} from 'lucide-react';
import { Transaction, UserAccount, UserRole, UserPermissions } from '../types';
import { BarcodeRenderer } from './BarcodeRenderer';
import { CompanyLogo } from './CompanyLogo';

interface TransactionsHistoryViewProps {
  transactions: Transaction[];
  companyLogo?: string | null;
  currentUser: UserAccount;
  rolePermissions?: Record<UserRole, UserPermissions>;
  onOpenScanner?: () => void;
  onDeleteTransaction: (transactionId: string, revertStock: boolean) => void;
  onClearTransactions: (type: 'ALL' | 'IN' | 'OUT') => void;
}

export const TransactionsHistoryView: React.FC<TransactionsHistoryViewProps> = ({
  transactions,
  companyLogo,
  currentUser,
  rolePermissions,
  onDeleteTransaction,
  onClearTransactions,
}) => {
  // Permissions for transaction actions
  const currentPerms = rolePermissions?.[currentUser.role] || (currentUser.permissions as UserPermissions) || {
    canClearLogs: currentUser.role === 'MASTER_ADMIN',
    canDeleteTransactionHistory: currentUser.role === 'MASTER_ADMIN',
  };

  const canClear = currentPerms.canClearLogs ?? (currentUser.role === 'MASTER_ADMIN');
  const canDeleteTrx = currentPerms.canDeleteTransactionHistory ?? (currentUser.role === 'MASTER_ADMIN');

  const [filterType, setFilterType] = useState<'ALL' | 'IN' | 'OUT'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);

  // Delete transaction confirmation state
  const [deletingTransaction, setDeletingTransaction] = useState<Transaction | null>(null);
  const [revertStockOnDelete, setRevertStockOnDelete] = useState<boolean>(true);

  // Clear all / bulk history modal state
  const [isClearHistoryModalOpen, setIsClearHistoryModalOpen] = useState(false);
  const [clearScope, setClearScope] = useState<'ALL' | 'IN' | 'OUT'>('ALL');

  // Limit display to 10 rows by default
  const [showAllTransactions, setShowAllTransactions] = useState(false);

  const filteredTransactions = transactions
    .filter((trx) => {
      const matchType = filterType === 'ALL' || trx.type === filterType;
      const term = searchTerm.toLowerCase();

      const matchSearch =
        trx.transactionNumber.toLowerCase().includes(term) ||
        (trx.poNumber && trx.poNumber.toLowerCase().includes(term)) ||
        (trx.requesterName && trx.requesterName.toLowerCase().includes(term)) ||
        (trx.requesterPosition && trx.requesterPosition.toLowerCase().includes(term)) ||
        (trx.department && trx.department.toLowerCase().includes(term)) ||
        (trx.supplier && trx.supplier.toLowerCase().includes(term)) ||
        (trx.receivedByOfficer && trx.receivedByOfficer.toLowerCase().includes(term)) ||
        (trx.purposeDescription && trx.purposeDescription.toLowerCase().includes(term)) ||
        trx.items.some(
          (i) =>
            i.itemName.toLowerCase().includes(term) ||
            i.itemCode.toLowerCase().includes(term)
        );

      let matchDate = true;
      const rawDate = trx.date || (trx.timestamp ? trx.timestamp.split(' ')[0] : '') || '';
      const trxDateOnly = rawDate ? rawDate.slice(0, 10) : '';
      if (startDate && trxDateOnly && trxDateOnly < startDate) matchDate = false;
      if (endDate && trxDateOnly && trxDateOnly > endDate) matchDate = false;

      return matchType && matchSearch && matchDate;
    })
    .sort((a, b) => {
      const timeB = new Date(b.date || b.timestamp || 0).getTime();
      const timeA = new Date(a.date || a.timestamp || 0).getTime();
      return timeB - timeA;
    });

  // Limit to maximum 10 rows unless expanded
  const displayedTransactions = showAllTransactions 
    ? filteredTransactions 
    : filteredTransactions.slice(0, 10);

  const handleExportCSV = () => {
    const headers = [
      'No. Transaksi',
      'No. PO',
      'Tipe',
      'Tanggal',
      'Waktu',
      'Petugas / Peminta',
      'Jabatan Peminta',
      'Departemen / Asal',
      'Keperluan / Catatan',
      'Barang & Jumlah',
    ];

    const rows = filteredTransactions.map((trx) => {
      const itemsStr = trx.items
        .map((i) => `${i.itemName} (${i.quantity} ${i.unit})`)
        .join('; ');
      return [
        `"${trx.transactionNumber}"`,
        `"${trx.poNumber || '-'}"`,
        `"${trx.type === 'OUT' ? 'KELUAR / PERMINTAAN' : 'MASUK / RESTOCK'}"`,
        `"${trx.dateFormatted}"`,
        `"${trx.timeFormatted}"`,
        `"${trx.requesterName || trx.receivedByOfficer || '-'}"`,
        `"${trx.requesterPosition || '-'}"`,
        `"${trx.department || trx.supplier || '-'}"`,
        `"${(trx.purposeDescription || trx.notes || '-').replace(/"/g, '""')}"`,
        `"${itemsStr.replace(/"/g, '""')}"`,
      ];
    });

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `Laporan_Transaksi_Gudang_GA_${startDate || 'all'}_sd_${endDate || new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrintSlip = () => {
    window.print();
  };

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-12">
      {/* Header Banner */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl shadow-xs border border-slate-200/90 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wider bg-[#E8F5E9] text-[#1B5E20] border border-[#A5D6A7] rounded-md">
              Log & Mutasi Gudang
            </span>
            <span className="text-xs text-slate-500 font-semibold">General Affairs</span>
          </div>
          <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 mt-1">
            Riwayat Transaksi Keluar & Masuk Barang
          </h2>
          <p className="text-xs text-slate-600 mt-0.5">
            Arsip digital mutasi barang, tanggal otomatis, bukti slip tanda tangan, dan filter periode unduhan.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {canClear && (
            <button
              type="button"
              onClick={() => setIsClearHistoryModalOpen(true)}
              className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-800 text-xs font-bold rounded-xl border border-rose-200 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-600" />
              <span>Bersihkan Log</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleExportCSV}
            className="px-3.5 py-2 bg-[#E8F5E9] hover:bg-[#A5D6A7] text-[#1B5E20] text-xs font-bold rounded-xl border border-[#A5D6A7] flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-[#1B5E20]" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Filter & Search Bar + Date Range */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200/90 shadow-xs space-y-2.5">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5">
          {/* Search */}
          <div className="relative md:col-span-6">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Cari no. transaksi, nama peminta, barang..."
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#66BB6A] bg-slate-50 focus:bg-white"
            />
          </div>

          {/* Date Period Filter - Stacked vertically on mobile, side-by-side on desktop */}
          <div className="md:col-span-6 grid grid-cols-1 sm:grid-cols-2 gap-2">
            {/* Date Period Start */}
            <div className="flex items-center gap-2 bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-300">
              <span className="text-[11px] font-extrabold text-slate-600 whitespace-nowrap w-12 shrink-0">Dari:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full bg-transparent text-xs font-semibold text-slate-800 focus:outline-hidden"
              />
            </div>

            {/* Date Period End */}
            <div className="flex items-center gap-2 bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-300">
              <span className="text-[11px] font-extrabold text-slate-600 whitespace-nowrap w-12 shrink-0">Sampai:</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full bg-transparent text-xs font-semibold text-slate-800 focus:outline-hidden"
              />
            </div>
          </div>
        </div>

        {/* Quick Filter Tabs */}
        <div className="flex items-center justify-between flex-wrap gap-2 pt-2 border-t border-slate-100">
          <div className="flex items-center gap-1.5 overflow-x-auto">
            <button
              type="button"
              onClick={() => setFilterType('ALL')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                filterType === 'ALL'
                  ? 'bg-[#1B5E20] text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Semua ({transactions.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterType('OUT')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                filterType === 'OUT'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Keluar ({transactions.filter((t) => t.type === 'OUT').length})
            </button>
            <button
              type="button"
              onClick={() => setFilterType('IN')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                filterType === 'IN'
                  ? 'bg-[#1B5E20] text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Masuk ({transactions.filter((t) => t.type === 'IN').length})
            </button>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>
              Menampilkan <b>{displayedTransactions.length}</b> dari <b>{filteredTransactions.length}</b> transaksi
            </span>
            {(startDate || endDate) && (
              <button
                type="button"
                onClick={() => {
                  setStartDate('');
                  setEndDate('');
                }}
                className="text-[11px] text-rose-600 font-bold hover:underline"
              >
                Reset Periode
              </button>
            )}
          </div>
        </div>
      </div>

      {/* RESPONSIVE TRANSACTIONS CONTAINER */}

      {/* 1. Mobile Cards Layout (< md screens) */}
      <div className="block md:hidden space-y-2.5">
        {displayedTransactions.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center text-slate-500 border border-slate-200">
            <History className="w-8 h-8 mx-auto text-slate-300 mb-1" />
            <p className="font-bold text-xs">Tidak ada riwayat transaksi</p>
          </div>
        ) : (
          displayedTransactions.map((trx) => {
            const isOut = trx.type === 'OUT';

            return (
              <div
                key={trx.id}
                className="bg-white p-3.5 rounded-2xl border border-slate-200/90 shadow-xs space-y-2.5 transition-all"
              >
                {/* Top row: Type Badge + Transaction Number & PO */}
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wide ${
                      isOut
                        ? 'bg-amber-100 text-amber-900 border border-amber-300'
                        : 'bg-[#E8F5E9] text-[#1B5E20] border border-[#A5D6A7]'
                    }`}
                  >
                    {isOut ? (
                      <>
                        <ArrowUpRight className="w-3 h-3 text-amber-700" />
                        KELUAR
                      </>
                    ) : (
                      <>
                        <ArrowDownLeft className="w-3 h-3 text-[#1B5E20]" />
                        MASUK
                      </>
                    )}
                  </span>

                  <div className="flex flex-col items-end">
                    <span className="font-mono font-bold text-xs text-slate-800">
                      {trx.transactionNumber}
                    </span>
                    {trx.poNumber && (
                      <span className="text-[10px] font-mono font-bold text-sky-700 bg-sky-50 px-1.5 py-0.2 rounded border border-sky-200 mt-0.5">
                        PO: {trx.poNumber}
                      </span>
                    )}
                  </div>
                </div>

                {/* Person & Department */}
                <div className="text-xs">
                  <div className="font-bold text-slate-900 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>{trx.requesterName || trx.receivedByOfficer || 'Petugas GA'}</span>
                    {trx.requesterPosition && (
                      <span className="text-[10px] text-[#1B5E20] font-mono font-semibold">
                        ({trx.requesterPosition})
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5 ml-5 flex items-center justify-between">
                    <span>{trx.department || trx.supplier || '-'}</span>
                    <span className="font-mono text-[10px]">{trx.dateFormatted}, {trx.timeFormatted}</span>
                  </div>
                </div>

                {/* Items List (Full Width, Card Nested) */}
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1 text-xs">
                  <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                    Daftar Barang ({trx.items.length}):
                  </span>
                  {trx.items.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between gap-2 text-[11px]">
                      <span className="font-semibold text-slate-800 truncate">{item.itemName}</span>
                      <span
                        className={`px-1.5 py-0.5 rounded font-mono font-bold shrink-0 ${
                          isOut ? 'bg-amber-100 text-amber-900' : 'bg-[#E8F5E9] text-[#1B5E20] border border-[#A5D6A7]'
                        }`}
                      >
                        {isOut ? '-' : '+'}
                        {item.quantity} {item.unit}
                      </span>
                    </div>
                  ))}
                  {trx.purposeDescription && (
                    <div className="text-[10px] text-slate-500 italic pt-1 border-t border-slate-200">
                      Keperluan: {trx.purposeDescription}
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setSelectedTransaction(trx)}
                    className="px-3 py-1 bg-[#E8F5E9] hover:bg-[#A5D6A7] text-[#1B5E20] rounded-lg font-bold text-xs border border-[#A5D6A7] transition-all flex items-center gap-1 cursor-pointer"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Lihat Slip</span>
                  </button>

                  {canDeleteTrx && (
                    <button
                      type="button"
                      onClick={() => {
                        setDeletingTransaction(trx);
                        setRevertStockOnDelete(true);
                      }}
                      className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg cursor-pointer transition-colors"
                      title="Hapus"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 2. Desktop Table Layout (>= md screens) */}
      <div className="hidden md:block bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-900 text-slate-200 uppercase font-bold tracking-wider text-[11px]">
            <tr>
              <th className="py-3 px-4">Tipe & No. Transaksi</th>
              <th className="py-3 px-4">Nomor PO</th>
              <th className="py-3 px-4">Tanggal & Waktu</th>
              <th className="py-3 px-4">Petugas / Peminta</th>
              <th className="py-3 px-4">Divisi / Asal</th>
              <th className="py-3 px-4">Daftar Barang</th>
              <th className="py-3 px-4">Keperluan</th>
              <th className="py-3 px-4 text-center">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {displayedTransactions.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-12 text-center text-slate-500">
                  <History className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                  <p className="font-semibold text-sm">Tidak ada transaksi yang cocok dengan filter</p>
                </td>
              </tr>
            ) : (
              displayedTransactions.map((trx) => {
                const isOut = trx.type === 'OUT';

                return (
                  <tr key={trx.id} className="hover:bg-slate-50/80 transition-colors">
                    {/* Tipe & No Transaksi */}
                    <td className="py-3 px-4">
                      <div className="flex flex-col items-start gap-1">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wide ${
                            isOut
                              ? 'bg-amber-100 text-amber-900 border border-amber-300'
                              : 'bg-[#E8F5E9] text-[#1B5E20] border border-[#A5D6A7]'
                          }`}
                        >
                          {isOut ? (
                            <>
                              <ArrowUpRight className="w-3 h-3 text-amber-700" />
                              KELUAR
                            </>
                          ) : (
                            <>
                              <ArrowDownLeft className="w-3 h-3 text-[#1B5E20]" />
                              MASUK
                            </>
                          )}
                        </span>
                        <span className="font-mono font-bold text-xs text-slate-800">
                          {trx.transactionNumber}
                        </span>
                      </div>
                    </td>

                    {/* Nomor PO */}
                    <td className="py-3 px-4 font-mono font-bold">
                      {trx.poNumber ? (
                        <span className="px-2 py-1 rounded bg-sky-50 text-sky-800 border border-sky-200 inline-block">
                          {trx.poNumber}
                        </span>
                      ) : (
                        <span className="text-slate-400 font-normal">-</span>
                      )}
                    </td>

                    {/* Automated Date & Time */}
                    <td className="py-3 px-4">
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-900">{trx.dateFormatted}</span>
                        <span className="text-[11px] font-mono text-slate-500">{trx.timeFormatted}</span>
                      </div>
                    </td>

                    {/* Petugas / Peminta */}
                    <td className="py-3 px-4">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="font-bold text-slate-900">
                            {trx.requesterName || trx.receivedByOfficer || 'Petugas GA'}
                          </span>
                        </div>
                        {trx.requesterPosition && (
                          <span className="text-[10px] font-mono font-semibold text-[#1B5E20] mt-0.5 ml-5">
                            {trx.requesterPosition}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Departemen / Supplier */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5 text-slate-700">
                        <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="font-medium">
                          {trx.department || trx.supplier || '-'}
                        </span>
                      </div>
                    </td>

                    {/* Daftar Barang */}
                    <td className="py-3 px-4">
                      <div className="space-y-1 max-w-xs">
                        {trx.items.map((item, idx) => (
                          <div key={idx} className="flex items-center justify-between text-xs gap-2">
                            <span className="font-medium text-slate-800 truncate">{item.itemName}</span>
                            <span
                              className={`px-1.5 py-0.5 rounded font-mono font-bold shrink-0 ${
                                isOut ? 'bg-amber-100 text-amber-900' : 'bg-[#E8F5E9] text-[#1B5E20] border border-[#A5D6A7]'
                              }`}
                            >
                              {isOut ? '-' : '+'}
                              {item.quantity} {item.unit}
                            </span>
                          </div>
                        ))}
                      </div>
                    </td>

                    {/* Keterangan Keperluan */}
                    <td className="py-3 px-4 max-w-xs">
                      <p className="text-xs text-slate-700 leading-relaxed">
                        {trx.purposeDescription || trx.notes || '-'}
                      </p>
                    </td>

                    {/* Aksi */}
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setSelectedTransaction(trx)}
                          className="px-2.5 py-1 bg-[#E8F5E9] hover:bg-[#A5D6A7] text-[#1B5E20] rounded-lg font-bold text-xs border border-[#A5D6A7] transition-all flex items-center justify-center gap-1 cursor-pointer"
                          title="Lihat & Cetak Bukti Slip"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>Slip</span>
                        </button>
                        {canDeleteTrx && (
                          <button
                            type="button"
                            onClick={() => {
                              setDeletingTransaction(trx);
                              setRevertStockOnDelete(true);
                            }}
                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="Hapus Transaksi"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Toggle View More / Max 10 Rows (Requirement 13) */}
      {filteredTransactions.length > 10 && (
        <div className="flex items-center justify-between bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
          <p className="text-xs text-slate-600">
            {showAllTransactions
              ? `Menampilkan semua ${filteredTransactions.length} transaksi.`
              : `Maksimal 10 baris ditampilkan (${filteredTransactions.length - 10} transaksi lainnya disembunyikan/hidden).`}
          </p>
          <button
            type="button"
            onClick={() => setShowAllTransactions(!showAllTransactions)}
            className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer shadow-xs"
          >
            {showAllTransactions ? 'Sembunyikan (Batas 10 Baris)' : `Lihat Semua (${filteredTransactions.length} Baris)`}
          </button>
        </div>
      )}

      {/* Slip Modal Preview & Print */}
      {selectedTransaction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
              <h3 className="font-bold text-sm flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#A5D6A7]" />
                Bukti Transaksi Gudang General Affairs (GA)
              </h3>
              <button
                onClick={() => setSelectedTransaction(null)}
                className="text-slate-400 hover:text-white text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Printable Slip Content */}
            <div className="p-6 sm:p-8 overflow-y-auto space-y-5 bg-white" id="printable-ga-slip">
              {/* Slip Header */}
              <div className="border-b-2 border-slate-900 pb-3 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <CompanyLogo logoUrl={companyLogo} size="lg" />
                  <div>
                    <h2 className="text-base sm:text-lg font-extrabold text-slate-900 tracking-tight">
                      BUKTI {selectedTransaction.type === 'OUT' ? 'PERMINTAAN & PENGAMBILAN' : 'PENERIMAAN'} BARANG
                    </h2>
                    <p className="text-xs text-slate-600 font-medium">
                      DIVISI GENERAL AFFAIRS (GA) & LOGISTIK OPERASIONAL
                    </p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <span className="font-mono text-xs font-bold text-[#1B5E20] bg-[#E8F5E9] px-2.5 py-1 rounded border border-[#A5D6A7]">
                    {selectedTransaction.transactionNumber}
                  </span>
                </div>
              </div>

              {/* Info Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-[#E8F5E9]/40 p-4 rounded-xl border border-[#A5D6A7]">
                <div className="space-y-1">
                  <div className="flex">
                    <span className="w-28 text-slate-600 font-semibold">Tgl & Jam:</span>
                    <span className="font-bold text-slate-900">
                      {selectedTransaction.dateFormatted}, {selectedTransaction.timeFormatted}
                    </span>
                  </div>
                  <div className="flex">
                    <span className="w-28 text-slate-600 font-semibold">
                      {selectedTransaction.type === 'OUT' ? 'Nama Peminta:' : 'Petugas Penerima:'}
                    </span>
                    <span className="font-bold text-slate-900">
                      {selectedTransaction.requesterName || selectedTransaction.receivedByOfficer || '-'}
                    </span>
                  </div>
                  {selectedTransaction.requesterPosition && (
                    <div className="flex">
                      <span className="w-28 text-slate-600 font-semibold">Jabatan:</span>
                      <span className="font-bold font-mono text-[#1B5E20]">
                        {selectedTransaction.requesterPosition}
                      </span>
                    </div>
                  )}
                  <div className="flex">
                    <span className="w-28 text-slate-600 font-semibold">
                      {selectedTransaction.type === 'OUT' ? 'Departemen:' : 'Asal / Supplier:'}
                    </span>
                    <span className="font-medium text-slate-800">
                      {selectedTransaction.department || selectedTransaction.supplier || '-'}
                    </span>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex">
                    <span className="w-28 text-slate-600 font-semibold">Status Sistem:</span>
                    <span className="font-bold text-[#1B5E20] flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#66BB6A]" /> SUDAH DIVERIFIKASI
                    </span>
                  </div>
                  {selectedTransaction.poNumber && (
                    <div className="flex">
                      <span className="w-28 text-slate-600 font-semibold">Nomor PO:</span>
                      <span className="font-mono font-bold text-sky-800 bg-sky-50 px-1.5 py-0.2 rounded border border-sky-200">
                        {selectedTransaction.poNumber}
                      </span>
                    </div>
                  )}
                  {selectedTransaction.documentNumber && (
                    <div className="flex">
                      <span className="w-28 text-slate-600 font-semibold">No. Dokumen:</span>
                      <span className="font-mono text-slate-800">{selectedTransaction.documentNumber}</span>
                    </div>
                  )}
                  <div className="flex">
                    <span className="w-28 text-slate-600 font-semibold">Keperluan:</span>
                    <span className="text-slate-800 italic">
                      {selectedTransaction.purposeDescription || selectedTransaction.notes || '-'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Items Table */}
              <div>
                <table className="w-full text-xs text-left border border-slate-200 rounded-lg overflow-hidden">
                  <thead className="bg-slate-100 text-slate-800 font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-2 px-3">No</th>
                      <th className="py-2 px-3">Kode SKU</th>
                      <th className="py-2 px-3">Nama Barang</th>
                      <th className="py-2 px-3 text-center">Jumlah</th>
                      <th className="py-2 px-3 text-center">Satuan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedTransaction.items.map((it, idx) => (
                      <tr key={idx}>
                        <td className="py-2 px-3 text-slate-600">{idx + 1}</td>
                        <td className="py-2 px-3 font-mono font-bold text-[#1B5E20]">{it.itemCode}</td>
                        <td className="py-2 px-3 font-semibold text-slate-900">{it.itemName}</td>
                        <td className="py-2 px-3 text-center font-bold text-slate-900">{it.quantity}</td>
                        <td className="py-2 px-3 text-center text-slate-600">{it.unit}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Signature Section */}
              <div className="grid grid-cols-2 gap-8 pt-6 text-center text-xs">
                <div>
                  <p className="text-slate-600 font-semibold mb-12">
                    {selectedTransaction.type === 'OUT' ? 'Petugas / Peminta Barang' : 'Asal / Vendor'}
                  </p>
                  <p className="font-bold text-slate-900 border-t border-slate-400 pt-1 mx-6">
                    ( {selectedTransaction.requesterName || selectedTransaction.supplier || '........................'} )
                  </p>
                </div>

                <div>
                  <p className="text-slate-600 font-semibold mb-12">
                    Petugas Gudang General Affairs (GA)
                  </p>
                  <p className="font-bold text-slate-900 border-t border-slate-400 pt-1 mx-6">
                    ( {selectedTransaction.receivedByOfficer || 'Staff Gudang GA'} )
                  </p>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-3.5 bg-slate-50 border-t border-slate-200 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedTransaction(null)}
                  className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-lg cursor-pointer"
                >
                  Tutup
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const trxToDel = selectedTransaction;
                    setSelectedTransaction(null);
                    setDeletingTransaction(trxToDel);
                    setRevertStockOnDelete(true);
                  }}
                  className="px-3 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-lg flex items-center gap-1 transition-colors cursor-pointer border border-rose-200"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Hapus</span>
                </button>
              </div>

              <button
                type="button"
                onClick={handlePrintSlip}
                className="px-4 py-1.5 bg-[#1B5E20] hover:bg-[#66BB6A] text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                Cetak Bukti Slip
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Konfirmasi Hapus Single Transaksi */}
      {deletingTransaction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-rose-600 text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <AlertTriangle className="w-5 h-5" />
                <h3 className="font-bold text-sm">Konfirmasi Hapus Transaksi</h3>
              </div>
              <button
                onClick={() => setDeletingTransaction(null)}
                className="text-white/80 hover:text-white text-sm cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-3">
              <p className="text-xs text-slate-700 leading-relaxed">
                Apakah Anda yakin ingin menghapus catatan transaksi <span className="font-mono font-bold text-slate-900">[{deletingTransaction.transactionNumber}]</span>?
              </p>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Tipe:</span>
                  <span className={`font-bold px-2 py-0.5 rounded text-[10px] ${
                    deletingTransaction.type === 'OUT' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                  }`}>
                    {deletingTransaction.type === 'OUT' ? 'BARANG KELUAR' : 'BARANG MASUK'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Peminta / Petugas:</span>
                  <span className="font-bold text-slate-900">{deletingTransaction.requesterName || deletingTransaction.receivedByOfficer || '-'}</span>
                </div>
              </div>

              <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-xl">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={revertStockOnDelete}
                    onChange={(e) => setRevertStockOnDelete(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded text-[#1B5E20] focus:ring-[#66BB6A] border-slate-300 cursor-pointer"
                  />
                  <div className="flex-1 text-xs">
                    <span className="font-bold text-amber-950 flex items-center gap-1.5">
                      <RotateCcw className="w-3.5 h-3.5 text-amber-700" />
                      Pulihkan Stok Fisik Barang Otomatis
                    </span>
                    <p className="text-[11px] text-amber-800 mt-0.5">
                      {deletingTransaction.type === 'OUT' 
                        ? 'Stok barang akan dikembalikan (bertambah) ke master stok gudang.'
                        : 'Stok barang akan dikurangi kembali dari master stok gudang.'
                      }
                    </p>
                  </div>
                </label>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeletingTransaction(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteTransaction(deletingTransaction.id, revertStockOnDelete);
                  setDeletingTransaction(null);
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Ya, Hapus Transaksi</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Bersihkan / Kosongkan Riwayat Transaksi */}
      {isClearHistoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Trash2 className="w-4 h-4 text-rose-400" />
                <h3 className="font-bold text-sm">Bersihkan Riwayat Transaksi</h3>
              </div>
              <button
                onClick={() => setIsClearHistoryModalOpen(false)}
                className="text-white/70 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-3">
              <p className="text-xs text-slate-600">
                Pilih cakupan riwayat transaksi yang ingin Anda bersihkan dari sistem:
              </p>

              <div className="space-y-2">
                <label 
                  onClick={() => setClearScope('ALL')}
                  className={`flex items-center justify-between p-2.5 rounded-xl border text-xs cursor-pointer transition-all ${
                    clearScope === 'ALL'
                      ? 'border-rose-500 bg-rose-50/60 font-bold text-rose-900'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <input 
                      type="radio" 
                      name="clearScope" 
                      checked={clearScope === 'ALL'} 
                      onChange={() => setClearScope('ALL')}
                      className="text-rose-600"
                    />
                    <span>Hapus Semua Riwayat Transaksi</span>
                  </div>
                  <span className="font-mono text-[11px] px-2 py-0.5 bg-slate-100 rounded-md">
                    {transactions.length} total
                  </span>
                </label>

                <label 
                  onClick={() => setClearScope('OUT')}
                  className={`flex items-center justify-between p-2.5 rounded-xl border text-xs cursor-pointer transition-all ${
                    clearScope === 'OUT'
                      ? 'border-amber-500 bg-amber-50/60 font-bold text-amber-900'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <input 
                      type="radio" 
                      name="clearScope" 
                      checked={clearScope === 'OUT'} 
                      onChange={() => setClearScope('OUT')}
                      className="text-amber-600"
                    />
                    <span>Hanya Transaksi Barang Keluar (OUT)</span>
                  </div>
                  <span className="font-mono text-[11px] px-2 py-0.5 bg-slate-100 rounded-md">
                    {transactions.filter(t => t.type === 'OUT').length}
                  </span>
                </label>

                <label 
                  onClick={() => setClearScope('IN')}
                  className={`flex items-center justify-between p-2.5 rounded-xl border text-xs cursor-pointer transition-all ${
                    clearScope === 'IN'
                      ? 'border-[#66BB6A] bg-[#E8F5E9] font-bold text-[#1B5E20]'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <input 
                      type="radio" 
                      name="clearScope" 
                      checked={clearScope === 'IN'} 
                      onChange={() => setClearScope('IN')}
                      className="text-[#1B5E20]"
                    />
                    <span>Hanya Transaksi Barang Masuk (IN)</span>
                  </div>
                  <span className="font-mono text-[11px] px-2 py-0.5 bg-slate-100 rounded-md">
                    {transactions.filter(t => t.type === 'IN').length}
                  </span>
                </label>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsClearHistoryModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  onClearTransactions(clearScope);
                  setIsClearHistoryModalOpen(false);
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Bersihkan Riwayat</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
