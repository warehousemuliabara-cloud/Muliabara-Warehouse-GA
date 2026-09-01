import React, { useState, useMemo } from 'react';
import { 
  Bell, 
  Check, 
  X, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  AlertTriangle, 
  FileText, 
  User, 
  Building2, 
  Package, 
  ShieldCheck, 
  Sparkles,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Calendar
} from 'lucide-react';
import { Transaction, UserAccount } from '../types';

interface NotificationApprovalModalProps {
  isOpen: boolean;
  onClose: () => void;
  transactions: Transaction[];
  currentUser: UserAccount;
  onApprove: (trxId: string, notes?: string) => void;
  onReject: (trxId: string, notes?: string) => void;
  onNavigateToRequest?: () => void;
}

export const NotificationApprovalModal: React.FC<NotificationApprovalModalProps> = ({
  isOpen,
  onClose,
  transactions,
  currentUser,
  onApprove,
  onReject,
  onNavigateToRequest,
}) => {
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectionNotes, setRejectionNotes] = useState('');

  // -------------------------------------------------------------
  // Requirement 8: Limit approval notification display to 1 date only,
  // then navigate to next/previous day
  // -------------------------------------------------------------
  const uniqueRequestDates = useMemo(() => {
    const datesSet = new Set<string>();
    transactions.forEach((t) => {
      if (t.type === 'OUT' && t.date) {
        datesSet.add(t.date);
      }
    });
    const sorted = Array.from(datesSet).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
    if (sorted.length === 0) {
      sorted.push(new Date().toISOString().split('T')[0]);
    }
    return sorted;
  }, [transactions]);

  const [selectedDateIdx, setSelectedDateIdx] = useState<number>(0);
  const activeDate = uniqueRequestDates[selectedDateIdx] || uniqueRequestDates[0] || new Date().toISOString().split('T')[0];

  const formatDisplayDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
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

  const canApprove = currentUser.role === 'MASTER_ADMIN' || currentUser.role === 'ADMIN';

  // Pending on selected date
  const pendingRequestsOnDate = useMemo(() => {
    return transactions
      .filter((t) => t.type === 'OUT' && t.status === 'PENDING' && t.date === activeDate)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions, activeDate]);

  // All pending requests across all dates (for badge counter)
  const totalPendingAcrossAllDates = useMemo(() => {
    return transactions.filter((t) => t.type === 'OUT' && t.status === 'PENDING').length;
  }, [transactions]);

  // Resolved on selected date
  const resolvedOnDate = useMemo(() => {
    return transactions
      .filter(
        (t) =>
          t.type === 'OUT' &&
          (t.status === 'APPROVED' || t.status === 'REJECTED' || t.status === 'COMPLETED') &&
          t.date === activeDate
      )
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions, activeDate]);

  if (!isOpen) return null;

  const handleConfirmReject = (trxId: string) => {
    onReject(trxId, rejectionNotes.trim() || 'Ditolak oleh Admin');
    setRejectingId(null);
    setRejectionNotes('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl w-full max-w-xl max-h-[85vh] flex flex-col border border-slate-200 shadow-2xl overflow-hidden">
        {/* Header with Glossy Badge */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white p-4 px-5 flex items-center justify-between border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-b from-amber-400/30 to-amber-600/20 text-amber-400 rounded-xl border border-amber-400/40 shadow-inner ring-1 ring-white/20">
              <Bell className="w-5 h-5 drop-shadow-xs" />
            </div>
            <div>
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <span>Pemberitahuan & Approval Permintaan</span>
                {totalPendingAcrossAllDates > 0 && (
                  <span className="px-2 py-0.5 bg-rose-500 text-white text-[11px] font-mono font-bold rounded-full animate-pulse shadow-xs">
                    {totalPendingAcrossAllDates} Total Menunggu
                  </span>
                )}
              </h3>
              <p className="text-xs text-slate-300">
                {canApprove 
                  ? 'Verifikasi persetujuan pengeluaran barang per tanggal'
                  : 'Status pembaruan pengajuan barang divisi'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Date Navigator Bar (Requirement 8: 1 Tanggal per Tampilan) */}
        <div className="bg-slate-100 p-2.5 px-4 border-b border-slate-200 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
            <Calendar className="w-4 h-4 text-blue-600" />
            <span className="text-slate-900 font-extrabold">{formatDisplayDate(activeDate)}</span>
          </div>

          <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-2xs">
            <button
              type="button"
              onClick={() => setSelectedDateIdx((prev) => Math.min(uniqueRequestDates.length - 1, prev + 1))}
              disabled={selectedDateIdx >= uniqueRequestDates.length - 1}
              title="Tanggal Sebelumnya"
              className="p-1 rounded-lg hover:bg-slate-100 disabled:opacity-30 text-slate-600 cursor-pointer disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-[10px] font-mono font-bold text-slate-500 px-1">
              {selectedDateIdx + 1} / {uniqueRequestDates.length}
            </span>
            <button
              type="button"
              onClick={() => setSelectedDateIdx((prev) => Math.max(0, prev - 1))}
              disabled={selectedDateIdx <= 0}
              title="Tanggal Berikutnya"
              className="p-1 rounded-lg hover:bg-slate-100 disabled:opacity-30 text-slate-600 cursor-pointer disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Pending Section for Selected Date */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-600" />
                <span>Permintaan Menunggu Persetujuan ({pendingRequestsOnDate.length})</span>
              </h4>
            </div>

            {pendingRequestsOnDate.length === 0 ? (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 text-center text-slate-500 text-xs">
                <CheckCircle2 className="w-7 h-7 text-emerald-500 mx-auto mb-1.5" />
                <p className="font-bold text-slate-700">Tidak ada antrian persetujuan pada tanggal ini</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Gunakan tombol panah di atas untuk melihat tanggal lain atau seluruh riwayat.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {pendingRequestsOnDate.map((req) => (
                  <div
                    key={req.id}
                    className="p-4 rounded-xl bg-amber-50/70 border border-amber-200 space-y-2.5 shadow-2xs"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-xs bg-white text-slate-900 px-2 py-0.5 rounded border border-amber-300">
                            {req.transactionNumber}
                          </span>
                          <span className="text-xs font-bold text-slate-900">
                            {req.requesterName}
                          </span>
                          <span className="text-[11px] text-slate-500 font-medium">
                            ({req.department})
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 mt-1">
                          <b>Keperluan:</b> {req.purposeDescription || '-'}
                        </p>
                        <div className="text-[11px] font-mono text-slate-700 bg-white/80 p-1.5 rounded mt-1.5 border border-amber-200/80">
                          {req.items.map((i) => `${i.itemName} (${i.quantity} ${i.unit})`).join(', ')}
                        </div>
                      </div>

                      <div className="text-right text-[11px] text-slate-400 shrink-0">
                        {req.timeFormatted}
                      </div>
                    </div>

                    {/* Rejecting reason input box */}
                    {rejectingId === req.id && (
                      <div className="pt-2 border-t border-amber-200/80 space-y-2">
                        <label className="block text-[11px] font-bold text-slate-700">
                          Alasan Penolakan:
                        </label>
                        <input
                          type="text"
                          value={rejectionNotes}
                          onChange={(e) => setRejectionNotes(e.target.value)}
                          placeholder="Misal: Stok dialokasikan untuk operasional darurat..."
                          className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                        />
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setRejectingId(null);
                              setRejectionNotes('');
                            }}
                            className="px-2.5 py-1 text-xs bg-slate-200 text-slate-700 rounded-lg font-bold cursor-pointer"
                          >
                            Batal
                          </button>
                          <button
                            type="button"
                            onClick={() => handleConfirmReject(req.id)}
                            className="px-3 py-1 text-xs bg-rose-600 text-white rounded-lg font-bold hover:bg-rose-500 cursor-pointer"
                          >
                            Konfirmasi Tolak
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Action buttons if Master Admin / Admin */}
                    {canApprove && rejectingId !== req.id && (
                      <div className="flex items-center justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setRejectingId(req.id)}
                          className="px-3 py-1.5 bg-white hover:bg-rose-50 text-rose-700 border border-rose-300 rounded-xl text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                          <span>Tolak</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => onApprove(req.id, 'Disetujui via Lonceng Notifikasi Header')}
                          className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                          <span>Setujui (Approve)</span>
                        </button>
                      </div>
                    )}

                    {!canApprove && (
                      <div className="text-[11px] font-bold text-rose-700 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        <span>Menunggu verifikasi Admin GA.</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Resolved Activity for Selected Date */}
          {resolvedOnDate.length > 0 && (
            <div className="border-t border-slate-100 pt-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                Riwayat Verifikasi Tanggal Ini ({resolvedOnDate.length})
              </h4>
              <div className="space-y-2">
                {resolvedOnDate.map((trx) => (
                  <div
                    key={trx.id}
                    className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="font-mono font-bold text-slate-800">{trx.transactionNumber}</span>
                      <span className="text-slate-500 ml-1.5">• {trx.requesterName}</span>
                    </div>
                    <div>
                      {trx.status === 'APPROVED' ? (
                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-bold text-[10px]">
                          DISETUJUI
                        </span>
                      ) : trx.status === 'REJECTED' ? (
                        <span className="px-2 py-0.5 bg-rose-100 text-rose-800 rounded font-bold text-[10px]">
                          DITOLAK
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded font-bold text-[10px]">
                          SERAH TERIMA
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between px-5">
          {onNavigateToRequest && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onNavigateToRequest();
              }}
              className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
            >
              <span>Buka Formulir Permintaan Lengkap</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl ml-auto cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
