import {
  BarChart3,
  Bot,
  Brain,
  Cloud,
  FileCheck2,
  FileText,
  Paintbrush,
  Settings2,
  Sparkles,
  TrendingUp,
  Zap,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import heroImg from '../../assets/images/ai_teacher_hero_1791438541470.jpg';
import { useAuth } from '../../context/AuthContext';
import {
  bannerConfigService,
  DEFAULT_BANNER_CONFIG,
} from '../../services/bannerConfigService';
import { BannerWallpaperConfig } from '../../types';
import { ActiveTab } from '../layout/Sidebar';
import { EditBannerModal } from './EditBannerModal';

interface AiHeroBannerProps {
  onSelectTab: (tab: ActiveTab) => void;
  className?: string;
}

export const AiHeroBanner: React.FC<AiHeroBannerProps> = ({ onSelectTab, className = '' }) => {
  const { isAdmin } = useAuth();
  const [config, setConfig] = useState<BannerWallpaperConfig>(() =>
    bannerConfigService.getLocalConfig()
  );
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  useEffect(() => {
    // Initial fetch from Firestore / local
    bannerConfigService.getConfig().then((cfg) => setConfig(cfg));

    // Listen for real-time changes
    const unsubscribe = bannerConfigService.subscribe((newCfg) => {
      setConfig(newCfg);
    });

    return () => unsubscribe();
  }, []);

  if (!config.isVisible) {
    return null;
  }

  // Theme Gradients
  const themeClasses: Record<string, string> = {
    default: 'from-[#071225] via-[#102A50] to-[#0B1B33]',
    cyber_blue: 'from-[#031926] via-[#0b2545] to-[#134074]',
    cosmic_purple: 'from-[#19053B] via-[#2A085C] to-[#45097A]',
    emerald_modern: 'from-[#022c22] via-[#064e3b] to-[#047857]',
  };

  const currentGradient = themeClasses[config.wallpaperTheme] || themeClasses.default;

  return (
    <>
      <div
        className={`relative overflow-hidden rounded-3xl bg-gradient-to-br ${currentGradient} p-6 sm:p-8 md:p-10 text-white shadow-2xl shadow-[#0B1B33]/60 border border-[#D9A62E]/25 ${className}`}
      >
        {/* Ambient Glows */}
        <div className="absolute -top-24 left-1/4 w-[450px] h-[450px] bg-[#D9A62E]/15 rounded-full blur-[130px] pointer-events-none" />
        <div className="absolute -bottom-24 right-10 w-[400px] h-[400px] bg-[#102A50]/40 rounded-full blur-[130px] pointer-events-none" />

        {/* Top Header Badge & Slogan Bar */}
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-3 mb-5">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {/* Left Tag Badge */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-black/30 border border-[#D9A62E]/40 backdrop-blur-md text-xs font-bold text-[#F2C75C] shadow-inner">
              <span className="w-2 h-2 rounded-full bg-[#22C55E] animate-ping" />
              <Bot className="w-4 h-4 text-[#D9A62E]" />
              <span>{config.tagText || DEFAULT_BANNER_CONFIG.tagText}</span>
            </div>

            {/* Right Slogan Badge */}
            <div className="text-xs font-semibold text-[#F2C75C] tracking-wide flex items-center gap-2 bg-[#D9A62E]/15 px-3.5 py-1.5 rounded-full border border-[#D9A62E]/40 shadow-sm backdrop-blur-md">
              <Sparkles className="w-3.5 h-3.5 text-[#F2C75C]" />
              <span className="italic font-bold">
                {config.sloganText || DEFAULT_BANNER_CONFIG.sloganText}
              </span>
            </div>
          </div>

          {/* Admin Edit Wallpaper Button */}
          {isAdmin && (
            <button
              onClick={() => setIsEditModalOpen(true)}
              className="px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-[#D9A62E]/25 active:bg-[#D9A62E]/35 backdrop-blur-md text-white text-xs font-bold transition-all flex items-center gap-2 border border-[#D9A62E]/40 shadow-md cursor-pointer hover:scale-102"
              title="Edit Tampilan Wallpaper & Banner AI ini"
            >
              <Paintbrush className="w-3.5 h-3.5 text-[#F2C75C]" />
              <span>Edit Wallpaper Menu</span>
            </button>
          )}
        </div>

        {/* Main Title & Subheadline */}
        <div className="relative z-10 space-y-2.5 max-w-3xl mb-6">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight leading-[1.15] text-white">
            {config.headlineMain || DEFAULT_BANNER_CONFIG.headlineMain}{' '}
            <span className="bg-gradient-to-r from-[#F2C75C] via-[#FFD675] to-[#D9A62E] bg-clip-text text-transparent">
              {config.headlineAccent || DEFAULT_BANNER_CONFIG.headlineAccent}
            </span>
          </h1>
          <p className="text-sm sm:text-base text-slate-200/90 leading-relaxed max-w-2xl">
            {config.subheadline || DEFAULT_BANNER_CONFIG.subheadline}
          </p>
        </div>

        {/* Hero Visual Card: Classroom with AI Robot, Teacher & Floating Holograms */}
        <div className="relative z-10 rounded-2xl sm:rounded-3xl overflow-hidden border border-white/20 shadow-2xl shadow-[#060D24]/90 bg-gradient-to-tr from-slate-900 to-indigo-950 mb-5 group">
          <img
            src={config.customImageUrl || heroImg}
            alt="Administrasi Guru Berbasis AI Visual Banner"
            className="w-full h-48 sm:h-64 md:h-80 lg:h-96 object-cover object-center transform group-hover:scale-101 transition-transform duration-700"
          />
          {/* Bottom Gradient Shade */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#060D24] via-transparent to-transparent opacity-80" />

          {/* Floating Card Top-Left: AI Assistant Guru */}
          <div className="absolute top-3 left-3 sm:top-5 sm:left-5 p-3 sm:p-3.5 rounded-2xl bg-slate-900/90 backdrop-blur-md border border-white/25 shadow-xl flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#2563EB] to-[#7C3AED] flex items-center justify-center text-white shadow-md shadow-blue-500/30 shrink-0">
              <Brain className="w-5 h-5" />
            </div>
            <div className="pr-1">
              <div className="flex items-center gap-1.5">
                <span className="text-xs sm:text-sm font-bold text-white">
                  {config.card1Title || DEFAULT_BANNER_CONFIG.card1Title}
                </span>
                <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-[#22C55E]/20 text-[#22C55E] border border-[#22C55E]/40">
                  {config.card1Badge || DEFAULT_BANNER_CONFIG.card1Badge}
                </span>
              </div>
              <p className="text-[11px] text-slate-300 mt-0.5">
                {config.card1Desc || DEFAULT_BANNER_CONFIG.card1Desc}
              </p>
            </div>
          </div>

          {/* Floating Card Bottom-Right: Analisis Akademik Pintar */}
          <div className="absolute bottom-3 right-3 sm:bottom-5 sm:right-5 p-3 sm:p-3.5 rounded-2xl bg-slate-900/90 backdrop-blur-md border border-white/25 shadow-xl flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#7C3AED] to-pink-600 flex items-center justify-center text-white shadow-md shadow-purple-500/30 shrink-0">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs sm:text-sm font-bold text-white">
                  {config.card2Title || DEFAULT_BANNER_CONFIG.card2Title}
                </span>
                <span className="text-[10px] font-bold text-[#22C55E]">
                  {config.card2Badge || DEFAULT_BANNER_CONFIG.card2Badge}
                </span>
              </div>
              <p className="text-[11px] text-slate-300 mt-0.5">
                {config.card2Desc || DEFAULT_BANNER_CONFIG.card2Desc}
              </p>
            </div>
          </div>
        </div>

        {/* Quick Clickable Action Pills (Dokumen, Analisis, Otomatisasi, Cloud) */}
        {config.showPills && (
          <div className="relative z-10 flex flex-wrap items-center justify-center gap-2 sm:gap-3 text-xs">
            <button
              onClick={() => onSelectTab('reports')}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 active:bg-white/25 border border-white/15 text-blue-200 transition-all cursor-pointer backdrop-blur-md hover:scale-102"
            >
              <FileCheck2 className="w-3.5 h-3.5 text-[#2563EB]" />
              <span className="font-semibold">Dokumen Digital</span>
            </button>

            <button
              onClick={() => onSelectTab('assessments')}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 active:bg-white/25 border border-white/15 text-purple-200 transition-all cursor-pointer backdrop-blur-md hover:scale-102"
            >
              <BarChart3 className="w-3.5 h-3.5 text-[#7C3AED]" />
              <span className="font-semibold">Analisis Data</span>
            </button>

            <button
              onClick={() => onSelectTab('attendance')}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 active:bg-white/25 border border-white/15 text-emerald-200 transition-all cursor-pointer backdrop-blur-md hover:scale-102"
            >
              <Zap className="w-3.5 h-3.5 text-[#22C55E]" />
              <span className="font-semibold">Otomatisasi Tugas</span>
            </button>

            <button
              onClick={() => onSelectTab('settings')}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 active:bg-white/25 border border-white/15 text-indigo-200 transition-all cursor-pointer backdrop-blur-md hover:scale-102"
            >
              <Cloud className="w-3.5 h-3.5 text-indigo-400" />
              <span className="font-semibold">Cloud Storage Aman</span>
            </button>
          </div>
        )}
      </div>

      {/* Edit Banner Modal for Admins */}
      <EditBannerModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        config={config}
        onSaved={(newCfg) => setConfig(newCfg)}
      />
    </>
  );
};
