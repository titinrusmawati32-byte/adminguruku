import {
  BarChart3,
  Bot,
  Brain,
  CheckCircle2,
  Clock,
  Cloud,
  Eye,
  EyeOff,
  FileCheck2,
  FileText,
  GraduationCap,
  KeyRound,
  Lock,
  LogIn,
  Moon,
  ShieldAlert,
  Sparkles,
  Sun,
  TrendingUp,
  User,
  Zap,
} from 'lucide-react';
import React, { useState } from 'react';
import heroImg from '../assets/images/ai_teacher_hero_1791438541470.jpg';
import { Modal } from '../components/common/Modal';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { useTheme } from '../context/ThemeContext';
import { getFriendlyErrorMessage } from '../services/firebase';

export const LoginPage: React.FC = () => {
  const { loginWithUsername } = useAuth();
  const { showToast } = useNotification();
  const { isDark, toggleTheme } = useTheme();

  // Form State
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isForgotOpen, setIsForgotOpen] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setErrorMessage('Harap isi username dan kata sandi.');
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    try {
      const user = await loginWithUsername(username.trim(), password);
      showToast(`Selamat datang, ${user.displayName}!`, 'success');
    } catch (err: any) {
      setErrorMessage(getFriendlyErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen lg:h-screen w-full flex flex-col lg:flex-row overflow-x-hidden bg-[#F5F3ED] dark:bg-[#081426] text-[#172A45] dark:text-[#F5F7FC] font-sans relative selection:bg-[#102A50] selection:text-[#FFD675] transition-colors">
      {/* Background Subtle Accent Glow Orbs */}
      <div className="absolute -top-24 left-1/4 w-[550px] h-[550px] bg-[#D9A62E]/10 dark:bg-[#D9A62E]/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute -bottom-24 left-10 w-[450px] h-[450px] bg-[#102A50]/10 dark:bg-[#071225]/80 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute top-1/2 right-1/4 w-[400px] h-[400px] bg-[#102A50]/5 dark:bg-[#172D4B]/30 rounded-full blur-[150px] pointer-events-none" />

      {/* ========================================================= */}
      {/* KOLOM KIRI (60% Desktop, Full Mobile): HERO SECTION BANNER */}
      {/* ========================================================= */}
      <section className="w-full lg:w-[60%] lg:h-full p-6 sm:p-10 lg:p-12 xl:p-16 flex flex-col justify-between overflow-y-auto relative z-10 border-b lg:border-b-0 lg:border-r border-[#E0E5EC] dark:border-[#263B58] bg-white/60 dark:bg-[#071225]/80 backdrop-blur-md">
        
        {/* Top Header Badge & Slogan */}
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-white dark:bg-[#10223D] border border-[#E0E5EC] dark:border-[#263B58] text-xs font-semibold text-[#102A50] dark:text-[#FFD675] shadow-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              <Bot className="w-4 h-4 text-[#D9A62E]" />
              <span className="tracking-wide">SaaS EduTech Modern</span>
            </div>

            {/* Slogan Badge & Theme Toggle */}
            <div className="flex items-center gap-2">
              <div className="text-xs font-semibold text-[#102A50] dark:text-[#FFD675] tracking-wide flex items-center gap-2 bg-[#D9A62E]/15 px-3.5 py-1.5 rounded-full border border-[#D9A62E]/30 shadow-xs">
                <Sparkles className="w-3.5 h-3.5 text-[#D9A62E]" />
                <span className="italic font-bold">"Guru Hebat, Administrasi Mudah"</span>
              </div>

              {/* Day / Night Theme Toggle */}
              <button
                type="button"
                onClick={toggleTheme}
                className="p-2 rounded-full bg-white dark:bg-[#10223D] border border-[#E0E5EC] dark:border-[#263B58] text-[#172A45] dark:text-[#FFD675] hover:bg-[#ECE9E1] dark:hover:bg-[#172D4B] transition-colors cursor-pointer shadow-xs"
                title={isDark ? 'Beralih ke Mode Terang (Putih & Gold)' : 'Beralih ke Mode Gelap (Navy & Gold)'}
                aria-label={isDark ? 'Mode Terang' : 'Mode Gelap'}
              >
                {isDark ? (
                  <Sun className="w-4 h-4 text-[#FFD675]" />
                ) : (
                  <Moon className="w-4 h-4 text-[#B8851B]" />
                )}
              </button>
            </div>
          </div>

          {/* Headline Besar & Subheadline */}
          <div className="space-y-3 pt-1">
            <h1 className="text-3xl sm:text-4xl xl:text-5xl font-extrabold tracking-tight leading-[1.15] text-[#102A50] dark:text-[#F5F7FC]">
              Administrasi Guru <br />
              <span className="bg-gradient-to-r from-[#102A50] via-[#0B1B33] to-[#D9A62E] dark:from-[#FFD675] dark:via-[#E8B949] dark:to-[#FFFFFF] bg-clip-text text-transparent">
                Berbasis AI Terpadu
              </span>
            </h1>
            <p className="text-sm sm:text-base text-[#66758A] dark:text-[#B4C1D4] max-w-2xl leading-relaxed">
              Kelola administrasi akademik guru lebih cepat, rapi, dan terintegrasi realtime antara Guru dan Admin Sekolah.
            </p>
          </div>
        </div>

        {/* Ilustrasi & Floating Cards Visual Section */}
        <div className="my-5 lg:my-6 relative group">
          {/* Main Hero Image Container */}
          <div className="relative rounded-3xl overflow-hidden border border-[#E0E5EC] dark:border-[#263B58] shadow-2xl shadow-[#102A50]/15 dark:shadow-[#071225]/80 bg-gradient-to-tr from-[#102A50] to-[#071225]">
            <img
              src={heroImg}
              alt="Guru profesional menggunakan laptop bersama Asisten AI Robot Edukasi"
              className="w-full h-44 sm:h-60 lg:h-68 object-cover object-center transform group-hover:scale-101 transition-transform duration-700 opacity-95"
            />
            {/* Subtle Gradient Shade Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#0B1B33] via-transparent to-transparent opacity-80" />

            {/* Floating Card AI: Top Left (AI Assistant Robot) */}
            <div className="absolute top-3 left-3 sm:top-4 sm:left-4 p-3 rounded-2xl bg-white/95 dark:bg-[#10223D]/95 backdrop-blur-md border border-[#E0E5EC] dark:border-[#263B58] shadow-xl flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#102A50] text-[#FFD675] border border-[#D9A62E]/30 flex items-center justify-center shadow-md">
                <Brain className="w-5 h-5" />
              </div>
              <div className="pr-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-[#172A45] dark:text-[#F5F7FC]">AI Assistant Guru</span>
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                    Aktif
                  </span>
                </div>
                <p className="text-[11px] text-[#66758A] dark:text-[#B4C1D4] mt-0.5">
                  Otomatisasi RPP, Presensi & Asesmen
                </p>
              </div>
            </div>

            {/* Floating Card AI: Bottom Right (Analisis Data & Akurasi) */}
            <div className="absolute bottom-3 right-3 sm:bottom-4 sm:right-4 p-3 rounded-2xl bg-white/95 dark:bg-[#10223D]/95 backdrop-blur-md border border-[#E0E5EC] dark:border-[#263B58] shadow-xl flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#D9A62E] text-[#0B1B33] flex items-center justify-center shadow-md font-bold">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-[#172A45] dark:text-[#F5F7FC]">Analisis Akademik Pintar</span>
                  <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">99.4% Presisi</span>
                </div>
                <p className="text-[11px] text-[#66758A] dark:text-[#B4C1D4] mt-0.5">
                  Barcode QR Presensi & Evaluasi Capaian
                </p>
              </div>
            </div>
          </div>

          {/* Quick Floating Mini Pills: Dokumen, Analisis, Otomatisasi, Cloud */}
          <div className="flex flex-wrap items-center justify-center gap-2 mt-3 text-xs">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-white dark:bg-[#10223D] border border-[#E0E5EC] dark:border-[#263B58] text-[#172A45] dark:text-[#B4C1D4]">
              <FileCheck2 className="w-3.5 h-3.5 text-[#102A50] dark:text-[#FFD675]" />
              <span>Dokumen Digital</span>
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-white dark:bg-[#10223D] border border-[#E0E5EC] dark:border-[#263B58] text-[#172A45] dark:text-[#B4C1D4]">
              <BarChart3 className="w-3.5 h-3.5 text-[#D9A62E]" />
              <span>Analisis Data</span>
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-white dark:bg-[#10223D] border border-[#E0E5EC] dark:border-[#263B58] text-[#172A45] dark:text-[#B4C1D4]">
              <Zap className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Otomatisasi Tugas</span>
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-white dark:bg-[#10223D] border border-[#E0E5EC] dark:border-[#263B58] text-[#172A45] dark:text-[#B4C1D4]">
              <Cloud className="w-3.5 h-3.5 text-[#102A50] dark:text-[#FFD675]" />
              <span>Cloud Storage Aman</span>
            </span>
          </div>
        </div>

        {/* 4 Fitur Utama Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-3.5 my-2">
          {/* Fitur 1 */}
          <div className="p-3.5 rounded-2xl bg-white dark:bg-[#10223D] hover:border-[#D9A62E] border border-[#E0E5EC] dark:border-[#263B58] transition-all duration-300 flex items-start gap-3 shadow-xs">
            <div className="w-9 h-9 rounded-xl bg-[#102A50]/10 dark:bg-[#172D4B] text-[#102A50] dark:text-[#FFD675] flex items-center justify-center shrink-0">
              <FileText className="w-4.5 h-4.5" />
            </div>
            <div>
              <h4 className="text-xs sm:text-sm font-bold text-[#172A45] dark:text-[#F5F7FC]">
                1. Pengelolaan Dokumen Otomatis
              </h4>
              <p className="text-[11px] sm:text-xs text-[#66758A] dark:text-[#B4C1D4] mt-0.5 leading-snug">
                AI membantu menyusun dan memeriksa dokumen administrasi guru.
              </p>
            </div>
          </div>

          {/* Fitur 2 */}
          <div className="p-3.5 rounded-2xl bg-white dark:bg-[#10223D] hover:border-[#D9A62E] border border-[#E0E5EC] dark:border-[#263B58] transition-all duration-300 flex items-start gap-3 shadow-xs">
            <div className="w-9 h-9 rounded-xl bg-[#D9A62E]/15 text-[#102A50] dark:text-[#FFD675] flex items-center justify-center shrink-0">
              <Clock className="w-4.5 h-4.5" />
            </div>
            <div>
              <h4 className="text-xs sm:text-sm font-bold text-[#172A45] dark:text-[#F5F7FC]">
                2. Hemat Waktu & Tenaga
              </h4>
              <p className="text-[11px] sm:text-xs text-[#66758A] dark:text-[#B4C1D4] mt-0.5 leading-snug">
                Mengurangi pekerjaan administratif berulang secara efisien.
              </p>
            </div>
          </div>

          {/* Fitur 3 */}
          <div className="p-3.5 rounded-2xl bg-white dark:bg-[#10223D] hover:border-[#D9A62E] border border-[#E0E5EC] dark:border-[#263B58] transition-all duration-300 flex items-start gap-3 shadow-xs">
            <div className="w-9 h-9 rounded-xl bg-[#102A50]/10 dark:bg-[#172D4B] text-[#102A50] dark:text-[#FFD675] flex items-center justify-center shrink-0">
              <Sparkles className="w-4.5 h-4.5 text-[#D9A62E]" />
            </div>
            <div>
              <h4 className="text-xs sm:text-sm font-bold text-[#172A45] dark:text-[#F5F7FC]">
                3. Rekomendasi Pintar
              </h4>
              <p className="text-[11px] sm:text-xs text-[#66758A] dark:text-[#B4C1D4] mt-0.5 leading-snug">
                Memberikan saran berbasis kebutuhan pembelajaran guru.
              </p>
            </div>
          </div>

          {/* Fitur 4 */}
          <div className="p-3.5 rounded-2xl bg-white dark:bg-[#10223D] hover:border-[#D9A62E] border border-[#E0E5EC] dark:border-[#263B58] transition-all duration-300 flex items-start gap-3 shadow-xs">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <Cloud className="w-4.5 h-4.5" />
            </div>
            <div>
              <h4 className="text-xs sm:text-sm font-bold text-[#172A45] dark:text-[#F5F7FC]">
                4. Akses Kapan Saja
              </h4>
              <p className="text-[11px] sm:text-xs text-[#66758A] dark:text-[#B4C1D4] mt-0.5 leading-snug">
                Data tersimpan aman di Cloud Firestore & dapat diakses fleksibel.
              </p>
            </div>
          </div>
        </div>

        {/* Statistik Modern 4 Poin */}
        <div className="pt-3.5 border-t border-[#E0E5EC] dark:border-[#263B58] flex flex-wrap items-center justify-between gap-3 text-xs text-[#66758A] dark:text-[#B4C1D4]">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 font-medium">
            <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-4 h-4" /> Aman & Terpercaya
            </span>
            <span className="flex items-center gap-1.5 text-[#102A50] dark:text-[#FFD675]">
              <CheckCircle2 className="w-4 h-4" /> Meningkatkan Produktivitas
            </span>
            <span className="flex items-center gap-1.5 text-[#102A50] dark:text-[#F5F7FC]">
              <CheckCircle2 className="w-4 h-4" /> Mendukung Profesionalisme Guru
            </span>
            <span className="flex items-center gap-1.5 text-[#D9A62E]">
              <CheckCircle2 className="w-4 h-4" /> Pendidikan Berkualitas
            </span>
          </div>

          <div className="text-[11px] text-[#66758A] dark:text-[#B4C1D4] font-mono hidden xl:block">
            Target: Guru • Kepala Sekolah • Operator • Admin
          </div>
        </div>
      </section>

      {/* ========================================================= */}
      {/* KOLOM KANAN (40% Desktop, Full Mobile): FORM LOGIN CARD */}
      {/* ========================================================= */}
      <section className="w-full lg:w-[40%] lg:h-full p-6 sm:p-8 lg:p-10 xl:p-12 flex flex-col justify-center items-center overflow-y-auto relative z-20 bg-[#ECE9E1]/30 dark:bg-[#081426]">
        <div className="w-full max-w-md my-auto">
          {/* Card Login Modern dengan Border Radius Besar & Gold-Navy */}
          <div className="bg-white dark:bg-[#10223D] rounded-[32px] p-6 sm:p-8 shadow-2xl border border-[#E0E5EC] dark:border-[#263B58] shadow-[#102A50]/10 dark:shadow-[#071225]/80 transition-all">
            
            {/* Bagian Atas: Logo Aplikasi, Judul, Subtitle */}
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#102A50] text-[#FFD675] border border-[#D9A62E]/40 shadow-lg shadow-[#0B1B33]/30 mb-3">
                <GraduationCap className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-extrabold tracking-tight text-[#172A45] dark:text-[#F5F7FC]">
                ADMIN GURU
              </h2>
              <p className="text-xs text-[#66758A] dark:text-[#B4C1D4] mt-1 max-w-xs mx-auto leading-relaxed">
                Sistem Informasi dan Administrasi Akademik Guru Terpadu
              </p>
            </div>

            {/* Error Banner jika ada */}
            {errorMessage && (
              <div className="mb-4 p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 text-xs flex items-start gap-2 animate-in fade-in">
                <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
                <span className="leading-snug">{errorMessage}</span>
              </div>
            )}

            {/* Form Input Username & Password */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#172A45] dark:text-[#F5F7FC] mb-1.5">
                  Username
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#66758A] dark:text-[#B4C1D4]">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Masukkan username Anda..."
                    required
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-[#E0E5EC] dark:border-[#263B58] bg-white dark:bg-[#172D4B] text-[#172A45] dark:text-[#F5F7FC] placeholder-[#66758A]/60 dark:placeholder-[#B4C1D4]/50 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#D9A62E] transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#172A45] dark:text-[#F5F7FC] mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#66758A] dark:text-[#B4C1D4]">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full pl-10 pr-10 py-3 rounded-xl border border-[#E0E5EC] dark:border-[#263B58] bg-white dark:bg-[#172D4B] text-[#172A45] dark:text-[#F5F7FC] placeholder-[#66758A]/60 dark:placeholder-[#B4C1D4]/50 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#D9A62E] transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-[#66758A] hover:text-[#102A50] dark:text-[#B4C1D4] dark:hover:text-[#F5F7FC] cursor-pointer"
                    title={showPassword ? 'Sembunyikan password' : 'Lihat password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Remember Me & Forgot Password */}
              <div className="flex items-center justify-between text-xs pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-[#172A45] dark:text-[#B4C1D4] select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded text-[#102A50] focus:ring-[#D9A62E] border-[#E0E5EC]"
                  />
                  <span>Remember Me</span>
                </label>

                <button
                  type="button"
                  onClick={() => setIsForgotOpen(true)}
                  className="font-semibold text-[#102A50] dark:text-[#FFD675] hover:underline cursor-pointer"
                >
                  Lupa Password?
                </button>
              </div>

              {/* Tombol Login "Masuk" Navy & Gold */}
              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 py-3 px-4 rounded-xl bg-[#102A50] hover:bg-[#0B1B33] active:scale-98 text-[#FFD675] font-bold text-xs sm:text-sm shadow-md shadow-[#102A50]/20 border border-[#D9A62E]/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                {loading ? (
                  <span className="w-4 h-4 border-2 border-[#FFD675]/30 border-t-[#FFD675] rounded-full animate-spin" />
                ) : (
                  <>
                    <LogIn className="w-4 h-4" />
                    <span>Masuk</span>
                  </>
                )}
              </button>
            </form>

            {/* Keterangan Akun Guru */}
            <div className="mt-4 p-3 rounded-2xl bg-[#F5F3ED]/80 dark:bg-[#172D4B]/40 border border-[#E0E5EC] dark:border-[#263B58] text-center">
              <p className="text-[11px] text-[#66758A] dark:text-[#B4C1D4] leading-relaxed">
                Akun guru dibuat dan dikelola oleh <span className="font-semibold text-[#102A50] dark:text-[#FFD675]">Admin Sekolah</span>. Hubungi Admin jika Anda belum memiliki akun atau lupa password.
              </p>
            </div>

            {/* Footer Versi Aplikasi */}
            <div className="mt-6 pt-4 border-t border-[#E0E5EC] dark:border-[#263B58] text-center">
              <p className="text-[11px] font-medium text-[#66758A] dark:text-[#B4C1D4]">
                ADMIN GURU SaaS • Versi 2027 v2.5.0
              </p>
              <p className="text-[10px] text-[#66758A] dark:text-[#B4C1D4] mt-0.5">
                AI-Powered Smart Education Platform
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Forgot Password Modal */}
      <Modal
        isOpen={isForgotOpen}
        onClose={() => setIsForgotOpen(false)}
        title="Bantuan Reset Kata Sandi"
        subtitle="Petunjuk pemulihan akun guru dan administrator sekolah"
        maxWidth="sm"
      >
        <div className="space-y-4 text-xs text-[#172A45] dark:text-[#B4C1D4]">
          <div className="p-3.5 rounded-xl bg-[#D9A62E]/10 border border-[#D9A62E]/30 flex items-start gap-2.5">
            <KeyRound className="w-5 h-5 text-[#D9A62E] shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-[#102A50] dark:text-[#FFD675]">
                Akun Dikelola oleh Admin Sekolah
              </p>
              <p className="text-[11px] text-[#172A45] dark:text-[#B4C1D4] mt-0.5">
                Seluruh akun guru dan administrator dibuat serta dikelola langsung oleh Admin melalui menu Manajemen Akun. Jika Anda lupa password, silakan hubungi Administrator Sekolah Anda.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <p className="font-semibold text-[#172A45] dark:text-[#F5F7FC]">
              Pemulihan Akun:
            </p>
            <p className="text-[11px] text-[#66758A] dark:text-[#B4C1D4] leading-relaxed">
              Hubungi Administrator Sistem atau Operator Data Sekolah Anda untuk pengaturan ulang kata sandi akun Anda.
            </p>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={() => setIsForgotOpen(false)}
              className="px-4 py-2 rounded-xl bg-[#102A50] text-[#FFD675] border border-[#D9A62E]/30 font-semibold text-xs cursor-pointer hover:bg-[#0B1B33]"
            >
              Mengerti
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
