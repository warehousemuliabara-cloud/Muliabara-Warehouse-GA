import React, { useState, useRef } from 'react';
import { Image as ImageIcon, Upload, Trash2, Check, RefreshCw, X, Sparkles } from 'lucide-react';
import { CompanyLogo } from './CompanyLogo';

interface LogoSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentLogo: string | null;
  onSaveLogo: (logoUrl: string | null) => void;
}

export const LogoSettingsModal: React.FC<LogoSettingsModalProps> = ({
  isOpen,
  onClose,
  currentLogo,
  onSaveLogo,
}) => {
  const [logoPreview, setLogoPreview] = useState<string | null>(currentLogo);
  const [urlInput, setUrlInput] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert('Ukuran file maksimal 2MB.');
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        setLogoPreview(base64);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleApplyUrl = () => {
    if (urlInput.trim()) {
      setLogoPreview(urlInput.trim());
      setUrlInput('');
    }
  };

  const handleSave = () => {
    onSaveLogo(logoPreview);
    onClose();
  };

  const handleResetToDefault = () => {
    setLogoPreview(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-slate-900 text-white p-4 px-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 text-blue-400 rounded-lg">
              <ImageIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">Ganti Logo Perusahaan / GA</h3>
              <p className="text-xs text-slate-400">Tampilkan logo resmi pada header, slip & stiker barcode</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white bg-slate-800 p-1.5 rounded-lg cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Logo Preview */}
          <div className="flex flex-col items-center justify-center p-6 bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
              Preview Logo Saat Ini
            </p>
            <div className="p-3 bg-white rounded-2xl shadow-sm border border-slate-200">
              <CompanyLogo logoUrl={logoPreview} size="xl" />
            </div>
            <p className="text-xs text-slate-600 mt-3 font-medium">
              {logoPreview ? 'Logo Kustom Aktif' : 'Logo Bawaan Standar (GA Emblem)'}
            </p>
          </div>

          {/* Upload Button */}
          <div className="space-y-3">
            <label className="block text-xs font-bold text-slate-700">
              1. Unggah Gambar Logo (PNG, JPG, SVG)
            </label>
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              onChange={handleFileUpload}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl border border-slate-300 flex items-center justify-center gap-2 cursor-pointer transition-colors"
            >
              <Upload className="w-4 h-4 text-blue-600" />
              <span>Pilih File Logo dari Perangkat</span>
            </button>
          </div>

          {/* URL Input */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-700">
              2. Atau Masukkan URL Gambar Logo
            </label>
            <div className="flex gap-2">
              <input
                type="url"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="https://example.com/logo.png"
                className="flex-1 px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-hidden"
              />
              <button
                type="button"
                onClick={handleApplyUrl}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl cursor-pointer"
              >
                Terapkan
              </button>
            </div>
          </div>

          {/* Reset button if custom logo exists */}
          {logoPreview && (
            <button
              type="button"
              onClick={handleResetToDefault}
              className="w-full py-2 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 font-bold rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Hapus & Gunakan Logo Default</span>
            </button>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-xl cursor-pointer"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-5 py-2 text-xs font-extrabold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-md cursor-pointer flex items-center gap-1.5"
          >
            <Check className="w-4 h-4" />
            <span>Simpan Perubahan</span>
          </button>
        </div>
      </div>
    </div>
  );
};
