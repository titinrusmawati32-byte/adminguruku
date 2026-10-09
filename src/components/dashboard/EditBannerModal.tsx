import {
  Check,
  Eye,
  Image,
  Palette,
  RefreshCw,
  RotateCcw,
  Save,
  Sliders,
  Sparkles,
  Type,
  X,
} from 'lucide-react';
import React, { useState } from 'react';
import { useNotification } from '../../context/NotificationContext';
import {
  bannerConfigService,
  DEFAULT_BANNER_CONFIG,
} from '../../services/bannerConfigService';
import { BannerWallpaperConfig } from '../../types';
import { Modal } from '../common/Modal';

interface EditBannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: BannerWallpaperConfig;
  onSaved: (newConfig: BannerWallpaperConfig) => void;
}

export const EditBannerModal: React.FC<EditBannerModalProps> = ({
  isOpen,
  onClose,
  config,
  onSaved,
}) => {
  const { showToast } = useNotification();
  const [formData, setFormData] = useState<BannerWallpaperConfig>({ ...config });
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'text' | 'cards' | 'theme'>('text');

  // Sync state if config prop updates
  React.useEffect(() => {
    setFormData({ ...config });
  }, [config]);

  const handleChange = (key: keyof BannerWallpaperConfig, value: any) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const saved = await bannerConfigService.saveConfig(formData);
      onSaved(saved);
      showToast('Tampilan Wallpaper & Banner AI berhasil diperbarui!', 'success');
      onClose();
    } catch (err: any) {
      showToast('Gagal menyimpan perubahan: ' + err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (confirm('Kembalikan tampilan wallpaper banner ke setelan bawaan seperti screenshot?')) {
      setSaving(true);
      try {
        const def = await bannerConfigService.resetToDefault();
        setFormData(def);
        onSaved(def);
        showToast('Tampilan wallpaper berhasil dikembalikan ke default!', 'success');
        onClose();
      } catch (err: any) {
        showToast('Gagal mereset setelan: ' + err.message, 'error');
      } finally {
        setSaving(false);
      }
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Edit Tampilan Wallpaper & Banner AI"
      subtitle="Kustomisasi teks, kartu floating AI, dan tema visual banner administrasi sekolah"
      maxWidth="2xl"
    >
      <form onSubmit={handleSave} className="space-y-5">
        {/* Sub Tabs */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 -mt-2">
          <button
            type="button"
            onClick={() => setActiveTab('text')}
            className={`py-2.5 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'text'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <Type className="w-3.5 h-3.5" />
            <span>Teks & Slogan</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('cards')}
            className={`py-2.5 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'cards'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Floating Cards AI</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('theme')}
            className={`py-2.5 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'theme'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <Palette className="w-3.5 h-3.5" />
            <span>Tema & Efek</span>
          </button>
        </div>

        {/* Tab 1: Teks & Slogan */}
        {activeTab === 'text' && (
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Tag / Generasi Sistem (Badge Kiri)
                </label>
                <input
                  type="text"
                  value={formData.tagText}
                  onChange={(e) => handleChange('tagText', e.target.value)}
                  placeholder="Contoh: SaaS EduTech Modern 2027"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Slogan Sekolah (Badge Kanan)
                </label>
                <input
                  type="text"
                  value={formData.sloganText}
                  onChange={(e) => handleChange('sloganText', e.target.value)}
                  placeholder='Contoh: "Guru Hebat, Administrasi Mudah"'
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Headline Utama
                </label>
                <input
                  type="text"
                  value={formData.headlineMain}
                  onChange={(e) => handleChange('headlineMain', e.target.value)}
                  placeholder="Contoh: Administrasi Guru"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Headline Aksen Gradien AI
                </label>
                <input
                  type="text"
                  value={formData.headlineAccent}
                  onChange={(e) => handleChange('headlineAccent', e.target.value)}
                  placeholder="Contoh: Berbasis AI"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Subheadline / Deskripsi
              </label>
              <textarea
                rows={2}
                value={formData.subheadline}
                onChange={(e) => handleChange('subheadline', e.target.value)}
                placeholder="Deskripsi singkat mengenai sistem terpadu berbasis AI..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white resize-none"
                required
              />
            </div>
          </div>
        )}

        {/* Tab 2: Floating Cards AI */}
        {activeTab === 'cards' && (
          <div className="space-y-4 text-xs">
            {/* Card 1 */}
            <div className="p-3.5 rounded-2xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/50 space-y-3">
              <div className="font-bold text-blue-900 dark:text-blue-200 flex items-center justify-between">
                <span>Kartu 1 (Kiri Atas - AI Assistant Guru)</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300">
                  Floating Hologram
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Judul Kartu
                  </label>
                  <input
                    type="text"
                    value={formData.card1Title}
                    onChange={(e) => handleChange('card1Title', e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Badge Status
                  </label>
                  <input
                    type="text"
                    value={formData.card1Badge}
                    onChange={(e) => handleChange('card1Badge', e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Keterangan Singkat
                </label>
                <input
                  type="text"
                  value={formData.card1Desc}
                  onChange={(e) => handleChange('card1Desc', e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>
            </div>

            {/* Card 2 */}
            <div className="p-3.5 rounded-2xl bg-purple-50/50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-900/50 space-y-3">
              <div className="font-bold text-purple-900 dark:text-purple-200 flex items-center justify-between">
                <span>Kartu 2 (Kanan Bawah - Analisis Akademik)</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300">
                  Floating Hologram
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Judul Kartu
                  </label>
                  <input
                    type="text"
                    value={formData.card2Title}
                    onChange={(e) => handleChange('card2Title', e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Badge Nilai / Akurasi
                  </label>
                  <input
                    type="text"
                    value={formData.card2Badge}
                    onChange={(e) => handleChange('card2Badge', e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Keterangan Singkat
                </label>
                <input
                  type="text"
                  value={formData.card2Desc}
                  onChange={(e) => handleChange('card2Desc', e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Tema & Efek */}
        {activeTab === 'theme' && (
          <div className="space-y-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-2">
                Pilihan Palet Warna Latar Wallpaper
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {[
                  {
                    id: 'default',
                    label: 'EduTech 2027 (Default)',
                    bg: 'from-[#060D24] via-[#0E163B] to-[#1E0F45]',
                  },
                  {
                    id: 'cyber_blue',
                    label: 'Cyber Ocean',
                    bg: 'from-[#031926] via-[#0b2545] to-[#134074]',
                  },
                  {
                    id: 'cosmic_purple',
                    label: 'Cosmic Royal',
                    bg: 'from-[#19053B] via-[#2A085C] to-[#45097A]',
                  },
                  {
                    id: 'emerald_modern',
                    label: 'Emerald Tech',
                    bg: 'from-[#022c22] via-[#064e3b] to-[#047857]',
                  },
                ].map((th) => (
                  <button
                    key={th.id}
                    type="button"
                    onClick={() => handleChange('wallpaperTheme', th.id)}
                    className={`p-3 rounded-xl border text-left flex flex-col justify-between h-20 transition-all cursor-pointer ${
                      formData.wallpaperTheme === th.id
                        ? 'border-blue-500 ring-2 ring-blue-500/20'
                        : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'
                    }`}
                  >
                    <div
                      className={`w-full h-5 rounded-md bg-gradient-to-r ${th.bg} shadow-inner`}
                    />
                    <span className="font-semibold text-[11px] text-slate-800 dark:text-slate-200 truncate">
                      {th.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-3">
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={formData.showPills}
                  onChange={(e) => handleChange('showPills', e.target.checked)}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300"
                />
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  Tampilkan Menu Pintas Cepat (Dokumen, Analisis, Otomatisasi, Cloud)
                </span>
              </label>

              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={formData.isVisible}
                  onChange={(e) => handleChange('isVisible', e.target.checked)}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300"
                />
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  Aktifkan Wallpaper & Banner AI ini di Dashboard Admin
                </span>
              </label>
            </div>
          </div>
        )}

        {/* Modal Action Buttons */}
        <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <button
            type="button"
            onClick={handleReset}
            disabled={saving}
            className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset ke Screenshot Default</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-bold transition-all flex items-center gap-2 shadow-md shadow-blue-500/25 cursor-pointer disabled:opacity-50"
            >
              {saving ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Save className="w-3.5 h-3.5" />
              )}
              <span>Simpan Perubahan</span>
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
};
