import React, { useState } from 'react';
import { 
  History, 
  Search, 
  Filter, 
  ShieldCheck, 
  Calendar, 
  User, 
  Clock, 
  Download, 
  X,
  Activity,
  Layers
} from 'lucide-react';
import { AuditLogEntry, UserRole } from '../types';

interface AuditTrailModalProps {
  isOpen: boolean;
  onClose: () => void;
  logs: AuditLogEntry[];
}

export const AuditTrailModal: React.FC<AuditTrailModalProps> = ({
  isOpen,
  onClose,
  logs,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterModule, setFilterModule] = useState<string>('ALL');

  if (!isOpen) return null;

  const filteredLogs = logs.filter((log) => {
    const matchesModule = filterModule === 'ALL' || log.targetModule === filterModule;
    const term = searchTerm.toLowerCase();
    const matchesSearch = 
      log.action.toLowerCase().includes(term) ||
      log.details.toLowerCase().includes(term) ||
      log.userName.toLowerCase().includes(term) ||
      log.targetModule.toLowerCase().includes(term);
    return matchesModule && matchesSearch;
  });

  const handleExportLogs = () => {
    const headers = ['Waktu', 'Pengguna', 'Role', 'Modul', 'Aksi', 'Keterangan Detail'];
    const rows = filteredLogs.map((l) => [
      `"${l.timestamp}"`,
      `"${l.userName}"`,
      `"${l.userRole}"`,
      `"${l.targetModule}"`,
      `"${l.action}"`,
      `"${l.details.replace(/"/g, '""')}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csvContent));
    link.setAttribute('download', `Audit_Trail_Log_Gudang_GA_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/20 text-purple-400 rounded-xl border border-purple-400/30">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-white">Log Aktivitas Sistem & Audit Trail Global</h3>
              <p className="text-xs text-slate-300">
                Pencatatan transparan seluruh mutasi stok, approval, peminjaman, dan perubahan konfigurasi sistem
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white bg-slate-800 rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Filters */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Cari aktivitas, pengguna, modul..."
              className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
            <select
              value={filterModule}
              onChange={(e) => setFilterModule(e.target.value)}
              className="px-3 py-1.5 text-xs font-bold border border-slate-300 rounded-lg bg-white"
            >
              <option value="ALL">Semua Modul</option>
              <option value="STOCK">Master Stok</option>
              <option value="TRANSACTIONS">Transaksi & Approval</option>
              <option value="LOANS">Peminjaman</option>
              <option value="USERS">Manajemen User</option>
              <option value="SETTINGS">Pengaturan</option>
              <option value="EMPLOYEES">Database Personil</option>
            </select>

            <button
              type="button"
              onClick={handleExportLogs}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* Logs Table */}
        <div className="p-4 overflow-y-auto flex-1">
          <div className="rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900 text-white text-[11px] font-bold uppercase tracking-wider">
                <tr>
                  <th className="py-2.5 px-3 w-36">Waktu</th>
                  <th className="py-2.5 px-3 w-48">Pengguna & Role</th>
                  <th className="py-2.5 px-3 w-28">Modul</th>
                  <th className="py-2.5 px-3 w-40">Aksi</th>
                  <th className="py-2.5 px-3">Keterangan Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white font-medium">
                {filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-500">
                      Tidak ada data log audit yang sesuai dengan filter
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600">
                        {log.timestamp}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-bold text-slate-900">{log.userName}</div>
                        <span className="text-[10px] text-slate-500 font-mono">[{log.userRole}]</span>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-800 border border-slate-200">
                          {log.targetModule}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-bold text-slate-800">
                        {log.action}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 text-[11px]">
                        {log.details}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs">
          <span className="text-slate-600">
            Total <b>{filteredLogs.length}</b> catatan aktivitas tersimpan dalam audit trail.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 text-white font-bold rounded-xl"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
