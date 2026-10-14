import {
  Eye,
  EyeOff,
  GraduationCap,
  KeyRound,
  Lock,
  LogIn,
  Moon,
  ShieldAlert,
  Sun,
  User,
} from 'lucide-react';
import React, { useState } from 'react';
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
    <div className="min-h-screen w-full flex items-center justify-center p-4 sm:p-6 lg:p-8 bg-[#F5F3ED] dark:bg-[#081426] text-[#172A45] dark:text-[#F5F7FC] font-sans relative selection:bg-[#102A50] selection:text-[#FFD675] transition-colors overflow-hidden">
      {/* Background Subtle Ambient Glows */}
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-[#D9A62E]/10 dark:bg-[#D9A62E]/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-[#102A50]/10 dark:bg-[#10223D]/50 rounded-full blur-[120px] pointer-events-none" />

      {/* Floating Theme Switcher Top-Right */}
      <div className="absolute top-4 right-4 sm:top-6 sm:right-6 z-20">
        <button
          type="button"
          onClick={toggleTheme}
          className="p-2 sm:px-3.5 sm:py-2 rounded-full bg-white dark:bg-[#10223D] border border-[#E0E5EC] dark:border-[#263B58] text-[#172A45] dark:text-[#FFD675] hover:bg-[#ECE9E1] dark:hover:bg-[#172D4B] transition-colors cursor-pointer shadow-sm flex items-center gap-2 text-xs font-medium"
          title={isDark ? 'Beralih ke Mode Terang' : 'Beralih ke Mode Gelap'}
          aria-label={isDark ? 'Mode Terang' : 'Mode Gelap'}
        >
          {isDark ? (
            <>
              <Sun className="w-4 h-4 text-[#FFD675]" />
              <span className="hidden sm:inline text-xs text-[#F5F7FC]">Mode Terang</span>
            </>
          ) : (
            <>
              <Moon className="w-4 h-4 text-[#B8851B]" />
              <span className="hidden sm:inline text-xs text-[#172A45]">Mode Gelap</span>
            </>
          )}
        </button>
      </div>

      {/* Card Login Utama (Hanya Form Tanpa Wallpaper Samping) */}
      <div className="w-full max-w-md relative z-10">
        <div className="bg-white dark:bg-[#10223D] rounded-3xl p-6 sm:p-8 shadow-2xl border border-[#E0E5EC] dark:border-[#263B58] shadow-[#102A50]/10 dark:shadow-[#071225]/80 transition-all">
          
          {/* Header Card: Logo Icon, Judul & Subtitle */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#102A50] text-[#FFD675] border border-[#D9A62E]/40 shadow-lg shadow-[#0B1B33]/25 mb-3">
              <GraduationCap className="w-8 h-8" />
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight text-[#172A45] dark:text-[#F5F7FC]">
              ADMIN GURU
            </h1>
            <p className="text-xs text-[#66758A] dark:text-[#B4C1D4] mt-1 max-w-xs mx-auto leading-relaxed">
              Sistem Informasi dan Administrasi Akademik Guru Terpadu
            </p>
          </div>

          {/* Banner Peringatan / Pesan Kesalahan */}
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
                  autoFocus
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

            {/* Remember Me & Lupa Password */}
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

            {/* Tombol Masuk */}
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
              Akun guru dibuat dan dikelola oleh <span className="font-semibold text-[#102A50] dark:text-[#FFD675]">Admin Sekolah</span>. Hubungi Admin jika Anda belum memiliki akun atau ingin reset password.
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
