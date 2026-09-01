import React, { useState } from 'react';
import { 
  Package, 
  Search, 
  Filter, 
  Plus, 
  RotateCcw, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  Calendar, 
  User, 
  Building2, 
  FileText, 
  Printer, 
  Download, 
  Trash2, 
  Send, 
  ArrowUpRight, 
  Undo2, 
  Phone, 
  Sparkles,
  Layers,
  Check,
  X
} from 'lucide-react';
import { Item, ItemLoan, Employee, UserAccount, LoanStatus } from '../types';
import { DEPARTMENTS } from '../data/initialData';
import { BarcodeRenderer } from './BarcodeRenderer';
import { ConfirmationModal } from './ConfirmationModal';
import { playScanBeep } from '../utils/helpers';

interface ItemLoanViewProps {
  loans: ItemLoan[];
  items: Item[];
  employees: Employee[];
  currentUser: UserAccount;
  onAddLoan: (loan: ItemLoan) => void;
  onReturnLoan: (loanId: string, returnCondition: 'BAIK' | 'RUSAK_RINGAN' | 'RUSAK_BERAT' | 'HILANG', notes: string) => void;
  onDeleteLoan: (loanId: string) => void;
}

export const ItemLoanView: React.FC<ItemLoanViewProps> = ({
  loans,
  items,
  employees,
  currentUser,
  onAddLoan,
  onReturnLoan,
  onDeleteLoan,
}) => {
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  // Modal State for New Loan
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  
  // Modal State for Returning Loan
  const [returningLoan, setReturningLoan] = useState<ItemLoan | null>(null);
  const [returnCondition, setReturnCondition] = useState<'BAIK' | 'RUSAK_RINGAN' | 'RUSAK_BERAT' | 'HILANG'>('BAIK');
  const [returnNotes, setReturnNotes] = useState('');

  // Loan detail print modal
  const [loanToPrint, setLoanToPrint] = useState<ItemLoan | null>(null);

  // Delete loan confirmation
  const [loanToDelete, setLoanToDelete] = useState<ItemLoan | null>(null);

  // Form State for New Loan
  const [selectedItemId, setSelectedItemId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [borrowerName, setBorrowerName] = useState('');
  const [borrowerPosition, setBorrowerPosition] = useState('');
  const [borrowerDept, setBorrowerDept] = useState(DEPARTMENTS[0]);
  const [borrowerPhone, setBorrowerPhone] = useState('');
  const [loanDate, setLoanDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [expectedReturnDate, setExpectedReturnDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    return d.toISOString().slice(0, 10);
  });
  const [purpose, setPurpose] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const selectedItemObj = items.find((i) => i.id === selectedItemId);
  const todayStr = new Date().toISOString().slice(0, 10);

  // Filtered Loans
  const filteredLoans = loans.filter((loan) => {
    const isOverdue = loan.status === 'BORROWED' && loan.expectedReturnDate < todayStr;
    
    let matchesStatus = true;
    if (filterStatus === 'BORROWED') matchesStatus = loan.status === 'BORROWED';
    else if (filterStatus === 'RETURNED') matchesStatus = loan.status === 'RETURNED';
    else if (filterStatus === 'OVERDUE') matchesStatus = isOverdue;

    const term = searchKeyword.toLowerCase();
    const matchesSearch = 
      loan.loanNumber.toLowerCase().includes(term) ||
      loan.itemName.toLowerCase().includes(term) ||
      loan.itemCode.toLowerCase().includes(term) ||
      loan.borrowerName.toLowerCase().includes(term) ||
      loan.borrowerDepartment.toLowerCase().includes(term) ||
      loan.purpose.toLowerCase().includes(term);

    let matchesDate = true;
    if (startDate && loan.loanDate < startDate) matchesDate = false;
    if (endDate && loan.loanDate > endDate) matchesDate = false;

    return matchesStatus && matchesSearch && matchesDate;
  }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const activeLoansCount = loans.filter((l) => l.status === 'BORROWED').length;
  const overdueLoansCount = loans.filter((l) => l.status === 'BORROWED' && l.expectedReturnDate < todayStr).length;

  const handleSelectEmployee = (empId: string) => {
    const emp = employees.find((e) => e.id === empId);
    if (emp) {
      setBorrowerName(emp.name);
      setBorrowerPosition(emp.position);
      if (emp.department) setBorrowerDept(emp.department);
      if (emp.phone) setBorrowerPhone(emp.phone);
    }
  };

  const handleCreateLoan = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!selectedItemObj) {
      setFormError('Silakan pilih barang/alat yang akan dipinjam.');
      return;
    }
    if (quantity <= 0) {
      setFormError('Jumlah peminjaman harus lebih dari 0.');
      return;
    }
    if (selectedItemObj.currentStock < quantity) {
      setFormError(`Stok tidak mencukupi. Sisa stok "${selectedItemObj.name}" adalah ${selectedItemObj.currentStock} ${selectedItemObj.unit}.`);
      return;
    }
    if (!borrowerName.trim()) {
      setFormError('Nama peminjam harus diisi.');
      return;
    }

    const todayCount = loans.length + 1;
    const yearMonth = todayStr.replace(/-/g, '').slice(0, 6);
    const newLoanNumber = `PINJAM-${yearMonth}-${String(todayCount).padStart(3, '0')}`;

    const newLoan: ItemLoan = {
      id: `loan-${Date.now()}`,
      loanNumber: newLoanNumber,
      itemId: selectedItemObj.id,
      itemCode: selectedItemObj.code,
      itemName: selectedItemObj.name,
      category: selectedItemObj.category,
      unit: selectedItemObj.unit,
      quantity,
      borrowerName: borrowerName.trim().toUpperCase(),
      borrowerPosition: borrowerPosition.trim().toUpperCase() || 'STAF',
      borrowerDepartment: borrowerDept,
      borrowerPhone: borrowerPhone.trim() || undefined,
      loanDate,
      expectedReturnDate,
      purpose: purpose.trim(),
      status: 'BORROWED',
      issuedBy: currentUser.fullName,
      approvedBy: currentUser.role !== 'USER_OPERATIONAL' ? currentUser.fullName : undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    onAddLoan(newLoan);
    playScanBeep(true);
    setIsAddModalOpen(false);

    setSelectedItemId('');
    setQuantity(1);
    setBorrowerName('');
    setBorrowerPosition('');
    setBorrowerPhone('');
    setPurpose('');
  };

  const handleConfirmReturn = () => {
    if (!returningLoan) return;
    onReturnLoan(returningLoan.id, returnCondition, returnNotes.trim());
    setReturningLoan(null);
    setReturnNotes('');
  };

  const handleExportCSV = () => {
    const headers = [
      'No. Pinjam',
      'Kode Barang',
      'Nama Barang',
      'Jumlah',
      'Satuan',
      'Peminjam',
      'Jabatan',
      'Departemen',
      'Tgl Pinjam',
      'Estimasi Kembali',
      'Realisasi Kembali',
      'Status',
      'Kondisi Kembali',
      'Keperluan',
    ];

    const rows = filteredLoans.map((l) => [
      `"${l.loanNumber}"`,
      `"${l.itemCode}"`,
      `"${l.itemName}"`,
      `"${l.quantity}"`,
      `"${l.unit}"`,
      `"${l.borrowerName}"`,
      `"${l.borrowerPosition}"`,
      `"${l.borrowerDepartment}"`,
      `"${l.loanDate}"`,
      `"${l.expectedReturnDate}"`,
      `"${l.actualReturnDate || '-'}"`,
      `"${l.status}"`,
      `"${l.returnCondition || '-'}"`,
      `"${l.purpose.replace(/"/g, '""')}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csvContent));
    link.setAttribute('download', `Rekap_Peminjaman_Gudang_GA_${startDate || 'all'}_sd_${endDate || todayStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-12">
      {/* Header Banner */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl shadow-xs border border-slate-200/90 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wider bg-[#E8F5E9] text-[#1B5E20] border border-[#A5D6A7] rounded-md">
              Aset & Alat Kerja GA
            </span>
            <span className="text-xs text-slate-500 font-semibold">Borrow & Return Control</span>
          </div>
          <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 mt-1">
            Peminjaman Barang & Peralatan Operasional
          </h2>
          <p className="text-xs text-slate-600 mt-0.5">
            Pencatatan peminjaman alat kantor, proyektor, toolkit, dan peralatan kerja dengan monitoring tanggal kembali.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportCSV}
            className="px-3 py-2 bg-[#E8F5E9] hover:bg-[#A5D6A7] text-[#1B5E20] font-bold text-xs rounded-xl border border-[#A5D6A7] transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Download className="w-3.5 h-3.5 text-[#1B5E20]" />
            <span>Export CSV</span>
          </button>

          <button
            type="button"
            onClick={() => setIsAddModalOpen(true)}
            className="px-4 py-2 bg-[#1B5E20] hover:bg-[#66BB6A] text-white font-extrabold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4 text-[#A5D6A7]" />
            <span>Pinjamkan Barang</span>
          </button>
        </div>
      </div>

      {/* Metric Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-500 uppercase">Total Peminjaman</span>
            <div className="text-lg font-black text-slate-900 mt-0.5">{loans.length} Catatan</div>
          </div>
          <div className="p-2 bg-[#E8F5E9] text-[#1B5E20] rounded-xl border border-[#A5D6A7]">
            <Layers className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-amber-700 uppercase">Sedang Dipinjam (Aktif)</span>
            <div className="text-lg font-black text-amber-900 mt-0.5">{activeLoansCount} Barang</div>
          </div>
          <div className="p-2 bg-amber-50 text-amber-600 rounded-xl border border-amber-200">
            <Clock className="w-4 h-4" />
          </div>
        </div>

        <div className={`p-3.5 rounded-xl border shadow-xs flex items-center justify-between ${
          overdueLoansCount > 0 ? 'bg-rose-50 border-rose-200' : 'bg-white border-slate-200'
        }`}>
          <div>
            <span className={`text-[10px] font-bold uppercase ${overdueLoansCount > 0 ? 'text-rose-800' : 'text-slate-500'}`}>
              Jatuh Tempo / Terlambat
            </span>
            <div className={`text-lg font-black mt-0.5 ${overdueLoansCount > 0 ? 'text-rose-900' : 'text-slate-900'}`}>
              {overdueLoansCount} Barang
            </div>
          </div>
          <div className={`p-2 rounded-xl ${overdueLoansCount > 0 ? 'bg-rose-200 text-rose-700' : 'bg-slate-100 text-slate-600'}`}>
            <AlertTriangle className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Filter & Search Bar + Date Period Filter */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200/90 shadow-xs space-y-2.5">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5">
          {/* Search */}
          <div className="relative md:col-span-6">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              placeholder="Cari peminjam, barang, no. pinjam..."
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#66BB6A] bg-slate-50 focus:bg-white"
            />
          </div>

          {/* Date Period Filter - Stacked vertically (atas-bawah) on mobile, side-by-side on desktop */}
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

        {/* Status Filter Buttons */}
        <div className="flex items-center justify-between flex-wrap gap-2 pt-2 border-t border-slate-100">
          <div className="flex items-center gap-1.5 overflow-x-auto">
            <button
              type="button"
              onClick={() => setFilterStatus('ALL')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                filterStatus === 'ALL' ? 'bg-[#1B5E20] text-white' : 'bg-slate-100 text-slate-600'
              }`}
            >
              Semua ({loans.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterStatus('BORROWED')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                filterStatus === 'BORROWED' ? 'bg-amber-600 text-white' : 'bg-slate-100 text-slate-600'
              }`}
            >
              Dipinjam ({activeLoansCount})
            </button>
            <button
              type="button"
              onClick={() => setFilterStatus('OVERDUE')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                filterStatus === 'OVERDUE' ? 'bg-rose-600 text-white' : 'bg-slate-100 text-slate-600'
              }`}
            >
              Terlambat ({overdueLoansCount})
            </button>
            <button
              type="button"
              onClick={() => setFilterStatus('RETURNED')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                filterStatus === 'RETURNED' ? 'bg-[#1B5E20] text-white' : 'bg-slate-100 text-slate-600'
              }`}
            >
              Kembali
            </button>
          </div>

          {(startDate || endDate) && (
            <button
              type="button"
              onClick={() => {
                setStartDate('');
                setEndDate('');
              }}
              className="text-[11px] text-rose-600 hover:underline font-bold"
            >
              Reset Periode
            </button>
          )}
        </div>
      </div>

      {/* RESPONSIVE LOANS CONTAINER (Requirement 9: No Horizontal Scroll on Mobile) */}

      {/* 1. Mobile Card Layout (< md screens) */}
      <div className="block md:hidden space-y-2.5">
        {filteredLoans.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center text-slate-500 border border-slate-200">
            <Clock className="w-8 h-8 mx-auto text-slate-300 mb-1" />
            <p className="font-bold text-xs">Tidak ada catatan peminjaman</p>
          </div>
        ) : (
          filteredLoans.map((loan) => {
            const isOverdue = loan.status === 'BORROWED' && loan.expectedReturnDate < todayStr;
            const isReturned = loan.status === 'RETURNED';

            return (
              <div
                key={loan.id}
                className={`bg-white p-3.5 rounded-2xl border transition-all space-y-2 ${
                  isOverdue ? 'border-rose-300 bg-rose-50/20' : 'border-slate-200/90'
                }`}
              >
                {/* Header row: Loan Number & Status */}
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono font-bold text-xs text-[#1B5E20] bg-[#E8F5E9] px-2 py-0.5 rounded border border-[#A5D6A7]">
                    {loan.loanNumber}
                  </span>
                  {isReturned ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Dikembalikan
                    </span>
                  ) : isOverdue ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 animate-pulse">
                      <AlertTriangle className="w-3 h-3 text-rose-600" /> Terlambat
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                      <Clock className="w-3 h-3 text-amber-600" /> Dipinjam
                    </span>
                  )}
                </div>

                {/* Item Details */}
                <div>
                  <div className="font-bold text-xs text-slate-900">{loan.itemName}</div>
                  <div className="text-[11px] text-slate-500 font-mono">
                    {loan.itemCode} • <span className="font-bold text-[#1B5E20]">{loan.quantity} {loan.unit}</span>
                  </div>
                </div>

                {/* Borrower & Dates */}
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-[11px] space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Peminjam:</span>
                    <span className="font-bold text-slate-800">{loan.borrowerName} ({loan.borrowerDepartment})</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Tgl Pinjam:</span>
                    <span className="font-mono text-slate-700">{loan.loanDate}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Est. Kembali:</span>
                    <span className={`font-mono font-bold ${isOverdue ? 'text-rose-600' : 'text-slate-700'}`}>
                      {loan.expectedReturnDate}
                    </span>
                  </div>
                  {isReturned && loan.actualReturnDate && (
                    <div className="flex justify-between text-emerald-700 font-medium">
                      <span>Real Kembali:</span>
                      <span>{loan.actualReturnDate} ({loan.returnCondition || 'Baik'})</span>
                    </div>
                  )}
                  {loan.purpose && (
                    <div className="text-[10px] text-slate-500 italic pt-0.5 border-t border-slate-200">
                      Keperluan: {loan.purpose}
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setLoanToPrint(loan)}
                    className="text-[11px] font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1 cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5 text-slate-400" />
                    <span>Cetak Slip</span>
                  </button>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setLoanToDelete(loan)}
                      className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg cursor-pointer"
                      title="Hapus"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>

                    {!isReturned && (
                      <button
                        type="button"
                        onClick={() => {
                          setReturningLoan(loan);
                          setReturnCondition('BAIK');
                          setReturnNotes('');
                        }}
                        className="px-2.5 py-1 bg-[#1B5E20] hover:bg-[#66BB6A] text-white text-xs font-bold rounded-lg transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
                      >
                        <Undo2 className="w-3 h-3" />
                        <span>Kembalikan</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 2. Desktop Table Layout (>= md screens) */}
      <div className="hidden md:block bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-900 text-white text-[11px] font-bold uppercase tracking-wider">
            <tr>
              <th className="py-3 px-4">No. Peminjaman</th>
              <th className="py-3 px-4">Barang & Qty</th>
              <th className="py-3 px-4">Peminjam / Divisi</th>
              <th className="py-3 px-4">Jadwal Pinjam</th>
              <th className="py-3 px-4 text-center">Status</th>
              <th className="py-3 px-4 text-center w-36">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredLoans.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-slate-500">
                  <Clock className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                  <p className="font-bold text-xs text-slate-700">Tidak ada catatan peminjaman</p>
                  <p className="text-[11px] text-slate-500">Klik "Pinjamkan Barang" untuk mencatat peminjaman baru</p>
                </td>
              </tr>
            ) : (
              filteredLoans.map((loan) => {
                const isOverdue = loan.status === 'BORROWED' && loan.expectedReturnDate < todayStr;
                const isReturned = loan.status === 'RETURNED';

                return (
                  <tr key={loan.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-mono font-bold text-[#1B5E20]">{loan.loanNumber}</div>
                      <div className="text-[10px] text-slate-500">{loan.purpose}</div>
                    </td>

                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900">{loan.itemName}</div>
                      <div className="text-[11px] text-slate-500 font-mono">
                        {loan.itemCode} • <span className="font-bold text-[#1B5E20]">{loan.quantity} {loan.unit}</span>
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900">{loan.borrowerName}</div>
                      <div className="text-[10px] text-slate-600">
                        {loan.borrowerPosition} • {loan.borrowerDepartment}
                      </div>
                      {loan.borrowerPhone && (
                        <div className="text-[10px] text-slate-500 font-mono flex items-center gap-1 mt-0.5">
                          <Phone className="w-2.5 h-2.5 text-slate-400" /> {loan.borrowerPhone}
                        </div>
                      )}
                    </td>

                    <td className="py-3 px-4">
                      <div className="text-slate-800">Pinjam: <b className="font-mono">{loan.loanDate}</b></div>
                      <div className={`text-[11px] ${isOverdue ? 'text-rose-600 font-bold' : 'text-slate-600'}`}>
                        Kembali: <span className="font-mono">{loan.expectedReturnDate}</span>
                      </div>
                      {isReturned && loan.actualReturnDate && (
                        <div className="text-[10px] text-emerald-700 font-medium">
                          Real: {loan.actualReturnDate} ({loan.returnCondition || 'Baik'})
                        </div>
                      )}
                    </td>

                    <td className="py-3 px-4 text-center">
                      {isReturned ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Dikembalikan
                        </span>
                      ) : isOverdue ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 animate-pulse">
                          <AlertTriangle className="w-3 h-3 text-rose-600" /> Terlambat
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                          <Clock className="w-3 h-3 text-amber-600" /> Dipinjam
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {!isReturned && (
                          <button
                            type="button"
                            onClick={() => {
                              setReturningLoan(loan);
                              setReturnCondition('BAIK');
                              setReturnNotes('');
                            }}
                            title="Proses Pengembalian Barang"
                            className="px-2 py-1 bg-[#E8F5E9] hover:bg-[#A5D6A7] text-[#1B5E20] font-bold text-[11px] rounded-lg border border-[#A5D6A7] transition-colors cursor-pointer inline-flex items-center gap-1"
                          >
                            <Undo2 className="w-3 h-3" />
                            <span>Kembali</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => setLoanToPrint(loan)}
                          title="Cetak Bukti Peminjaman"
                          className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => setLoanToDelete(loan)}
                          title="Hapus Catatan"
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Add New Loan */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
            <div className="bg-slate-900 text-white p-4 sm:p-5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-[#66BB6A]/20 text-[#A5D6A7] rounded-xl border border-[#66BB6A]/30">
                  <Plus className="w-5 h-5 text-[#A5D6A7]" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-white">Formulir Peminjaman Barang / Aset</h3>
                  <p className="text-xs text-slate-300">Catat peminjaman perlengkapan GA ke personil kantor</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white bg-slate-800 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateLoan} className="p-5 overflow-y-auto space-y-3.5">
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-bold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Select Item */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Pilih Barang / Alat GA yang Dipinjam <span className="text-rose-500">*</span>
                </label>
                <select
                  required
                  value={selectedItemId}
                  onChange={(e) => setSelectedItemId(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#66BB6A] bg-white font-medium text-slate-800"
                >
                  <option value="">-- Pilih Barang dari Master Stok --</option>
                  {items.map((it) => (
                    <option key={it.id} value={it.id} disabled={it.currentStock <= 0}>
                      {it.name} ({it.code}) — Stok: {it.currentStock} {it.unit} {it.currentStock <= 0 ? '(HABIS)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Quantity */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Jumlah Dipinjam <span className="text-rose-500">*</span></label>
                  <input
                    type="number"
                    min={1}
                    max={selectedItemObj ? selectedItemObj.currentStock : 999}
                    value={quantity}
                    onChange={(e) => setQuantity(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs font-bold border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#66BB6A]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Satuan</label>
                  <input
                    type="text"
                    disabled
                    value={selectedItemObj?.unit || 'Pcs / Unit'}
                    className="w-full px-3 py-2 text-xs font-mono font-bold bg-slate-100 border border-slate-200 rounded-xl text-slate-600"
                  />
                </div>
              </div>

              {/* Quick Pick Employee */}
              <div className="p-3.5 bg-[#E8F5E9]/50 rounded-xl border border-[#A5D6A7] space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold uppercase text-[#1B5E20]">Data Peminjam</span>
                  <span className="text-[10px] text-slate-500 font-medium">Pilih cepat dari {employees.length} personil</span>
                </div>

                <div>
                  <select
                    onChange={(e) => handleSelectEmployee(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white font-medium"
                  >
                    <option value="">-- Cari Nama Karyawan --</option>
                    {employees.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.name} — {e.position} ({e.department || 'Kantor'})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-0.5">Nama Lengkap Peminjam <span className="text-rose-500">*</span></label>
                    <input
                      type="text"
                      required
                      value={borrowerName}
                      onChange={(e) => setBorrowerName(e.target.value)}
                      placeholder="Nama Peminjam"
                      className="w-full px-3 py-1.5 text-xs font-bold uppercase border border-slate-300 rounded-lg bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-0.5">Jabatan / Posisi</label>
                    <input
                      type="text"
                      value={borrowerPosition}
                      onChange={(e) => setBorrowerPosition(e.target.value)}
                      placeholder="Jabatan"
                      className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white uppercase"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-0.5">Divisi / Departemen</label>
                    <select
                      value={borrowerDept}
                      onChange={(e) => setBorrowerDept(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white font-medium"
                    >
                      {DEPARTMENTS.map((dept) => (
                        <option key={dept} value={dept}>{dept}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-0.5">No. Kontak / WA</label>
                    <input
                      type="text"
                      value={borrowerPhone}
                      onChange={(e) => setBorrowerPhone(e.target.value)}
                      placeholder="0812-xxxx-xxxx"
                      className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Tanggal Pinjam</label>
                  <input
                    type="date"
                    required
                    value={loanDate}
                    onChange={(e) => setLoanDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Estimasi Tanggal Kembali</label>
                  <input
                    type="date"
                    required
                    value={expectedReturnDate}
                    onChange={(e) => setExpectedReturnDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white font-bold text-[#1B5E20]"
                  />
                </div>
              </div>

              {/* Purpose */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Keperluan Peminjaman <span className="text-rose-500">*</span></label>
                <textarea
                  required
                  rows={2}
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  placeholder="Contoh: Meeting presentasi klien / pekerjaan instalasi..."
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white"
                />
              </div>

              <div className="p-4 bg-slate-50 border-t border-slate-200 -mx-5 -mb-5 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-200 bg-slate-100 rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-extrabold text-white bg-[#1B5E20] hover:bg-[#66BB6A] rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span>Simpan & Keluarkan Pinjaman</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Return Loan */}
      {returningLoan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-[#66BB6A]/20 text-[#A5D6A7] rounded-xl">
                  <Undo2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-white">Konfirmasi Pengembalian Barang</h3>
                  <p className="text-xs text-slate-300">Verifikasi fisik barang dan pulihkan stok</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setReturningLoan(null)}
                className="p-1.5 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                <div className="text-xs font-bold text-slate-900">{returningLoan.itemName}</div>
                <div className="text-[11px] text-slate-600 font-mono">
                  {returningLoan.loanNumber} • Jumlah: <b>{returningLoan.quantity} {returningLoan.unit}</b>
                </div>
                <div className="text-[11px] text-slate-600">
                  Peminjam: <b>{returningLoan.borrowerName}</b> ({returningLoan.borrowerDepartment})
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Kondisi Fisik Barang Saat Kembali:
                </label>
                <select
                  value={returnCondition}
                  onChange={(e) => setReturnCondition(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs font-bold border border-slate-300 rounded-xl bg-white"
                >
                  <option value="BAIK">Kondisi Baik & Berfungsi Normal</option>
                  <option value="RUSAK_RINGAN">Rusak Ringan (Perlu Servis Ringan)</option>
                  <option value="RUSAK_BERAT">Rusak Berat (Tidak Berfungsi)</option>
                  <option value="HILANG">Barang Hilang / Tidak Kembali</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Catatan Pemeriksaan:</label>
                <textarea
                  rows={2}
                  value={returnNotes}
                  onChange={(e) => setReturnNotes(e.target.value)}
                  placeholder="Kelengkapan aksesoris, kondisi..."
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white"
                />
              </div>

              <div className="p-3 bg-slate-50 border-t border-slate-200 -mx-4 -mb-4 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setReturningLoan(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-200 bg-slate-100 rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleConfirmReturn}
                  className="px-4 py-2 text-xs font-extrabold text-white bg-[#1B5E20] hover:bg-[#66BB6A] rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Konfirmasi Terima Barang</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Printable Slip Modal */}
      {loanToPrint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Printer className="w-4 h-4 text-[#A5D6A7]" />
                <h3 className="font-bold text-sm">Surat Bukti Peminjaman Barang GA</h3>
              </div>
              <button
                type="button"
                onClick={() => setLoanToPrint(null)}
                className="p-1 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-3 bg-white text-slate-900" id="printable-loan-slip">
              <div className="text-center border-b pb-2">
                <h4 className="font-extrabold text-sm uppercase tracking-tight">SURAT BUKTI PEMINJAMAN BARANG / ALAT</h4>
                <p className="text-[11px] text-slate-500 font-mono">{loanToPrint.loanNumber}</p>
              </div>

              <div className="flex justify-center py-1">
                <BarcodeRenderer value={loanToPrint.itemCode} height={35} />
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-slate-500 text-[10px] block">NAMA BARANG:</span>
                  <strong className="text-slate-900">{loanToPrint.itemName}</strong>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px] block">JUMLAH PINJAM:</span>
                  <strong className="text-[#1B5E20] font-bold">{loanToPrint.quantity} {loanToPrint.unit}</strong>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px] block">NAMA PEMINJAM:</span>
                  <strong>{loanToPrint.borrowerName}</strong>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px] block">DIVISI / JABATAN:</span>
                  <span>{loanToPrint.borrowerDepartment} ({loanToPrint.borrowerPosition})</span>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px] block">TANGGAL PINJAM:</span>
                  <span>{loanToPrint.loanDate}</span>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px] block">ESTIMASI KEMBALI:</span>
                  <strong className="text-rose-700">{loanToPrint.expectedReturnDate}</strong>
                </div>
              </div>

              <div className="pt-1">
                <span className="text-slate-500 text-[10px] block">KEPERLUAN:</span>
                <p className="text-xs italic bg-slate-50 p-2 rounded border border-slate-200">{loanToPrint.purpose}</p>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4 text-center text-xs">
                <div>
                  <p className="text-[10px] text-slate-500 mb-8">Peminjam Barang,</p>
                  <p className="font-bold border-t pt-1">({loanToPrint.borrowerName})</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 mb-8">Petugas Gudang GA,</p>
                  <p className="font-bold border-t pt-1">({loanToPrint.issuedBy})</p>
                </div>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 border-t flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setLoanToPrint(null)}
                className="px-3 py-1.5 text-xs font-bold text-slate-700 bg-slate-200 rounded-xl"
              >
                Tutup
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="px-4 py-1.5 text-xs font-extrabold text-white bg-[#1B5E20] hover:bg-[#66BB6A] rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Cetak Lembar Bukti</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={Boolean(loanToDelete)}
        title="Hapus Catatan Peminjaman"
        message={`Apakah Anda yakin ingin menghapus catatan peminjaman [${loanToDelete?.loanNumber}] untuk barang "${loanToDelete?.itemName}" (${loanToDelete?.borrowerName})?`}
        confirmText="Ya, Hapus Data"
        isDestructive={true}
        onConfirm={() => {
          if (loanToDelete) {
            onDeleteLoan(loanToDelete.id);
            setLoanToDelete(null);
          }
        }}
        onCancel={() => setLoanToDelete(null)}
      />
    </div>
  );
};
