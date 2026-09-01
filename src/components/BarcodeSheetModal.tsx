import React, { useState, useMemo } from 'react';
import { 
  Printer, 
  Download, 
  QrCode, 
  CheckSquare, 
  Square, 
  Filter, 
  Layers, 
  ArrowDownLeft, 
  ArrowUpRight, 
  Search, 
  X,
  Tag,
  CheckCircle2,
  SlidersHorizontal,
  FileSpreadsheet,
  Grid
} from 'lucide-react';
import { Item, Transaction } from '../types';
import { BarcodeRenderer } from './BarcodeRenderer';
import { CompanyLogo } from './CompanyLogo';

export type BarcodePrintMode = 'STOCK' | 'IN' | 'OUT' | 'ALL' | 'CUSTOM';

interface BarcodeSheetModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: Item[];
  transactions?: Transaction[];
  companyLogo?: string | null;
  initialMode?: BarcodePrintMode;
}

export const BarcodeSheetModal: React.FC<BarcodeSheetModalProps> = ({
  isOpen,
  onClose,
  items,
  transactions = [],
  companyLogo,
  initialMode = 'STOCK',
}) => {
  const [printMode, setPrintMode] = useState<BarcodePrintMode>(initialMode);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedRack, setSelectedRack] = useState<string>('ALL');
  const [labelsPerRow, setLabelsPerRow] = useState<number>(3);
  const [showQrCode, setShowQrCode] = useState<boolean>(false);
  const [selectedIds, setSelectedIds] = useState<string[]>(() => items.map((i) => i.id));

  // Update mode when opened
  React.useEffect(() => {
    if (isOpen) {
      setPrintMode(initialMode || 'STOCK');
      // By default select all items in master stock
      setSelectedIds(items.map((i) => i.id));
    }
  }, [isOpen, initialMode, items]);

  // Unique categories & racks for filter dropdowns
  const categories = useMemo(() => {
    const set = new Set<string>();
    items.forEach((i) => {
      if (i.category) set.add(i.category);
    });
    return Array.from(set).sort();
  }, [items]);

  const racks = useMemo(() => {
    const set = new Set<string>();
    items.forEach((i) => {
      if (i.rackLocation) set.add(i.rackLocation);
    });
    return Array.from(set).sort();
  }, [items]);

  // Derive relevant items based on printMode and filters
  const filteredItems = useMemo(() => {
    let list = items;

    if (printMode === 'IN') {
      const inItemIds = new Set<string>();
      transactions.filter((t) => t.type === 'IN').forEach((t) => {
        t.items.forEach((it) => inItemIds.add(it.itemId));
      });
      if (inItemIds.size > 0) {
        list = items.filter((i) => inItemIds.has(i.id));
      }
    } else if (printMode === 'OUT') {
      const outItemIds = new Set<string>();
      transactions.filter((t) => t.type === 'OUT').forEach((t) => {
        t.items.forEach((it) => outItemIds.add(it.itemId));
      });
      if (outItemIds.size > 0) {
        list = items.filter((i) => outItemIds.has(i.id));
      }
    }

    if (selectedCategory !== 'ALL') {
      list = list.filter((i) => i.category === selectedCategory);
    }

    if (selectedRack !== 'ALL') {
      list = list.filter((i) => i.rackLocation === selectedRack);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (i) =>
          i.name.toLowerCase().includes(q) ||
          i.code.toLowerCase().includes(q) ||
          (i.category && i.category.toLowerCase().includes(q)) ||
          (i.rackLocation && i.rackLocation.toLowerCase().includes(q))
      );
    }

    return list;
  }, [items, printMode, transactions, selectedCategory, selectedRack, searchQuery]);

  if (!isOpen) return null;

  const toggleSelectAll = () => {
    const currentFilteredIds = filteredItems.map((i) => i.id);
    const allSelected = currentFilteredIds.every((id) => selectedIds.includes(id));
    if (allSelected) {
      setSelectedIds((prev) => prev.filter((id) => !currentFilteredIds.includes(id)));
    } else {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...currentFilteredIds])));
    }
  };

  const selectLowStockOnly = () => {
    const lowIds = filteredItems.filter((i) => i.currentStock <= i.minStock).map((i) => i.id);
    setSelectedIds(lowIds);
  };

  const toggleItem = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handlePrint = () => {
    window.print();
  };

  const selectedCount = filteredItems.filter((i) => selectedIds.includes(i.id)).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-5xl rounded-2xl shadow-2xl border border-slate-200/80 overflow-hidden flex flex-col max-h-[95vh]">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-white/10 border border-white/20 shadow-inner shrink-0">
              <CompanyLogo logoUrl={companyLogo} size="sm" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-base sm:text-lg text-white">Menu & Pengaturan Cetak Barcode</h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30">
                  Label Stiker & QR
                </span>
              </div>
              <p className="text-xs text-slate-300">
                Pilih jenis barcode yang ingin dicetak, filter per kategori/rak, dan sesuaikan tata letak stiker.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup jendela cetak"
            className="self-end sm:self-center p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Selector Cards (4 Pilihan Menu Cetak) */}
        <div className="p-3 sm:p-4 bg-slate-50 border-b border-slate-200">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
            1. Pilih Sumber / Kategori Barcode:
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {/* Opsi 1: Master Stok */}
            <button
              type="button"
              onClick={() => {
                setPrintMode('STOCK');
                setSelectedIds(items.map((i) => i.id));
              }}
              className={`p-2.5 sm:p-3 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-2.5 ${
                printMode === 'STOCK' || printMode === 'ALL'
                  ? 'bg-blue-50/90 border-blue-500 ring-2 ring-blue-500/20 shadow-xs'
                  : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/80'
              }`}
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                printMode === 'STOCK' || printMode === 'ALL' ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-600'
              }`}>
                <Layers className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <p className="font-bold text-xs text-slate-900">Barcode Master Stok</p>
                  <span className="text-[10px] font-mono font-bold text-blue-700 bg-blue-100/70 px-1.5 py-0.2 rounded">
                    {items.length} SKU
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 truncate mt-0.5">Label master rak & katalog barang gudang</p>
              </div>
            </button>

            {/* Opsi 2: Barang Masuk */}
            <button
              type="button"
              onClick={() => {
                setPrintMode('IN');
                const inIds = new Set<string>();
                transactions.filter((t) => t.type === 'IN').forEach((t) => t.items.forEach((it) => inIds.add(it.itemId)));
                setSelectedIds(Array.from(inIds));
              }}
              className={`p-2.5 sm:p-3 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-2.5 ${
                printMode === 'IN'
                  ? 'bg-emerald-50/90 border-emerald-500 ring-2 ring-emerald-500/20 shadow-xs'
                  : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/80'
              }`}
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                printMode === 'IN' ? 'bg-emerald-600 text-white' : 'bg-emerald-50 text-emerald-600'
              }`}>
                <ArrowDownLeft className="w-4 h-4 stroke-[2.5]" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <p className="font-bold text-xs text-slate-900">Barcode Barang Masuk</p>
                  <span className="text-[10px] font-mono font-bold text-emerald-700 bg-emerald-100/70 px-1.5 py-0.2 rounded">
                    Inbound
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 truncate mt-0.5">Label penerimaan restock dari supplier</p>
              </div>
            </button>

            {/* Opsi 3: Permintaan Barang */}
            <button
              type="button"
              onClick={() => {
                setPrintMode('OUT');
                const outIds = new Set<string>();
                transactions.filter((t) => t.type === 'OUT').forEach((t) => t.items.forEach((it) => outIds.add(it.itemId)));
                setSelectedIds(Array.from(outIds));
              }}
              className={`p-2.5 sm:p-3 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-2.5 ${
                printMode === 'OUT'
                  ? 'bg-amber-50/90 border-amber-500 ring-2 ring-amber-500/20 shadow-xs'
                  : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/80'
              }`}
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                printMode === 'OUT' ? 'bg-amber-500 text-slate-950' : 'bg-amber-50 text-amber-600'
              }`}>
                <ArrowUpRight className="w-4 h-4 stroke-[2.5]" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <p className="font-bold text-xs text-slate-900">Barcode Permintaan Keluar</p>
                  <span className="text-[10px] font-mono font-bold text-amber-800 bg-amber-100/70 px-1.5 py-0.2 rounded">
                    Outbound
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 truncate mt-0.5">Label serah terima barang ke pemohon/divisi</p>
              </div>
            </button>
          </div>
        </div>

        {/* Filter & Toolbar Settings */}
        <div className="p-3 sm:p-4 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 flex-1">
            {/* Search Input */}
            <div className="relative min-w-[180px] flex-1 sm:flex-none">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari nama, SKU, atau rak..."
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              />
            </div>

            {/* Category Filter */}
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 font-semibold text-slate-800 text-xs focus:bg-white focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">Semua Kategori ({categories.length})</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>

            {/* Rack Filter */}
            <select
              value={selectedRack}
              onChange={(e) => setSelectedRack(e.target.value)}
              className="bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 font-semibold text-slate-800 text-xs focus:bg-white focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">Semua Rak ({racks.length})</option>
              {racks.map((r) => (
                <option key={r} value={r}>
                  Rak {r}
                </option>
              ))}
            </select>

            {/* Select All Toggle */}
            <button
              type="button"
              onClick={toggleSelectAll}
              className="px-2.5 py-1.5 bg-slate-100 border border-slate-300 rounded-lg font-semibold text-slate-700 flex items-center gap-1.5 hover:bg-slate-200 cursor-pointer"
            >
              {selectedCount === filteredItems.length && filteredItems.length > 0 ? (
                <CheckSquare className="w-3.5 h-3.5 text-blue-600" />
              ) : (
                <Square className="w-3.5 h-3.5 text-slate-400" />
              )}
              <span>Pilih Semua ({filteredItems.length})</span>
            </button>

            {/* Select Low Stock Only */}
            <button
              type="button"
              onClick={selectLowStockOnly}
              className="px-2.5 py-1.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg font-semibold hover:bg-rose-100 cursor-pointer hidden md:flex items-center gap-1"
            >
              <span>Hanya Stok Rendah</span>
            </button>
          </div>

          {/* Right Toolbar: Layout & Action */}
          <div className="flex items-center gap-2">
            <span className="text-slate-500 font-semibold hidden lg:inline">Kolom:</span>
            <select
              value={labelsPerRow}
              onChange={(e) => setLabelsPerRow(parseInt(e.target.value))}
              className="bg-slate-50 border border-slate-300 rounded-lg px-2 py-1.5 font-semibold text-slate-800 text-xs"
            >
              <option value={2}>2 Kolom (Besar)</option>
              <option value={3}>3 Kolom (Standar A4)</option>
              <option value={4}>4 Kolom (Kompak)</option>
            </select>

            <button
              type="button"
              onClick={handlePrint}
              disabled={selectedCount === 0}
              className="px-4 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-40 text-white font-extrabold rounded-lg flex items-center gap-1.5 shadow-md shadow-blue-600/20 cursor-pointer transition-all hover:scale-105 active:scale-95"
            >
              <Printer className="w-4 h-4" />
              <span>Cetak Sekarang ({selectedCount})</span>
            </button>
          </div>
        </div>

        {/* Printable Grid Content */}
        <div className="p-4 sm:p-5 overflow-y-auto bg-slate-50/80 flex-1">
          {filteredItems.length === 0 ? (
            <div className="text-center py-16 text-slate-500 text-xs">
              <Tag className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              Tidak ada barang yang cocok dengan filter atau pilihan sumber saat ini.
            </div>
          ) : (
            <div
              className={`grid gap-3 ${
                labelsPerRow === 2
                  ? 'grid-cols-1 sm:grid-cols-2'
                  : labelsPerRow === 4
                  ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
                  : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
              }`}
            >
              {filteredItems.map((item) => {
                const isChecked = selectedIds.includes(item.id);
                return (
                  <div
                    key={item.id}
                    onClick={() => toggleItem(item.id)}
                    className={`p-3.5 bg-white rounded-xl border transition-all cursor-pointer relative text-center flex flex-col items-center justify-between shadow-2xs hover:shadow-xs ${
                      isChecked
                        ? 'border-blue-500 ring-2 ring-blue-500/20'
                        : 'border-slate-200 opacity-40 hover:opacity-80'
                    }`}
                  >
                    {/* Header Label */}
                    <div className="w-full flex items-center justify-between mb-1.5">
                      <span className={`text-[8.5px] font-black tracking-wider uppercase px-1.5 py-0.5 rounded ${
                        printMode === 'IN'
                          ? 'bg-emerald-100 text-emerald-800'
                          : printMode === 'OUT'
                          ? 'bg-amber-100 text-amber-900'
                          : 'bg-blue-100 text-blue-900'
                      }`}>
                        {printMode === 'IN' ? 'BARANG MASUK (IN)' : printMode === 'OUT' ? 'PERMINTAAN (OUT)' : 'MASTER STOK'}
                      </span>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {}}
                        className="rounded text-blue-600 focus:ring-0 cursor-pointer"
                      />
                    </div>

                    {/* Item Information */}
                    <p className="font-bold text-xs text-slate-900 line-clamp-1 w-full text-center">
                      {item.name}
                    </p>
                    <p className="text-[10px] text-slate-500 font-mono">
                      Lokasi: <span className="font-bold text-slate-700">{item.rackLocation}</span>
                    </p>

                    {/* Barcode Graphic */}
                    <div className="my-2 py-1 px-2 bg-slate-50 rounded-lg border border-slate-100 w-full flex justify-center shadow-inner">
                      <BarcodeRenderer value={item.code} width={1.4} height={36} fontSize={10} />
                    </div>

                    {/* Footer Info */}
                    <div className="w-full flex items-center justify-between text-[9px] text-slate-500 pt-1.5 border-t border-slate-100">
                      <span className="font-semibold text-slate-700 truncate max-w-[120px]">
                        {item.category}
                      </span>
                      <span className="font-mono font-bold text-slate-900">
                        Stok: {item.currentStock} {item.unit}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal Footer Info */}
        <div className="p-3 sm:p-4 bg-white border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-2 text-xs">
          <div className="flex items-center gap-2 text-slate-600 text-[11px]">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <span>
              Total <b>{selectedCount}</b> barcode label siap dicetak. Gunakan opsi <b>"Save as PDF"</b> atau kirim ke printer stiker label.
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold transition-colors cursor-pointer"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handlePrint}
              disabled={selectedCount === 0}
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-bold rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Cetak Barcode</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
