import {
  Bell,
  Check,
  CheckCircle,
  Menu,
  Moon,
  Plus,
  Sparkles,
  Sun,
  UserCheck,
} from 'lucide-react';
import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { useTheme } from '../../context/ThemeContext';
import { ActiveTab } from './Sidebar';

interface HeaderProps {
  activeTab: ActiveTab;
  onOpenMobileSidebar: () => void;
  onSelectTab: (tab: ActiveTab) => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onOpenMobileSidebar,
  onSelectTab,
}) => {
  const { profile } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const { notifications, unreadCount, markNotificationRead } = useNotification();
  const [showNotifMenu, setShowNotifMenu] = useState(false);

  const tabTitles: Record<ActiveTab, { title: string; subtitle: string }> = {
    dashboard: { title: 'Dashboard Utama', subtitle: 'Ikhtisar aktivitas pembelajaran & kehadiran sekolah' },
    rombel: { title: 'Daftar Rombongan Belajar', subtitle: 'Rombongan belajar resmi, wali kelas, & verifikasi otorisasi' },
    students: { title: 'Kelola Data Siswa', subtitle: 'Manajemen basis data siswa, NIS, NISN, dan rombel' },
    'qr-cards': { title: 'Cetak Kartu QR Siswa', subtitle: 'Generate & cetak kartu identitas barcode pintar siswa' },
    subjects: { title: 'Mata Pelajaran (Mapel)', subtitle: 'Kurikulum & daftar mata pelajaran terdaftar' },
    schedules: { title: 'Jadwal Mengajar', subtitle: 'Penyusunan jadwal mingguan dan alokasi ruang kelas' },
    attendance: { title: 'Input Absensi Siswa', subtitle: 'Presensi digital interaktif & scanner barcode QR' },
    assessments: { title: 'Input Penilaian Siswa', subtitle: 'Pencatatan tugas, asesmen formatif, & sumatif' },
    agendas: { title: 'Agenda Mengajar Guru', subtitle: 'Jurnal harian materi, ketercapaian, & aktivitas kelas' },
    guidance: { title: 'Bimbingan Guru Wali', subtitle: 'Konseling & pendampingan karakter siswa terpadu' },
    reports: { title: 'Pusat Rekap Laporan', subtitle: 'Preview visual, ekspor laporan resmi PDF & Excel' },
    teachers: { title: 'Kelola Akun Guru & Penugasan', subtitle: 'Manajemen akun login, NIP, penugasan wali kelas, dan mata pelajaran' },
    settings: { title: 'Pengaturan & Keamanan Data', subtitle: 'Konfigurasi sekolah, siaran notifikasi, dan backup database' },
  };


  const currentInfo = tabTitles[activeTab] || { title: 'Admin Guru', subtitle: '' };

  const todayStr = new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date());

  return (
    <header className="sticky top-0 z-30 h-16 bg-white/90 dark:bg-[#071225]/90 backdrop-blur-md border-b border-[#E0E5EC] dark:border-[#263B58] px-4 sm:px-6 flex items-center justify-between transition-colors">
      {/* Left: Mobile hamburger & breadcrumbs */}
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenMobileSidebar}
          className="lg:hidden p-2 rounded-xl text-[#66758A] hover:text-[#102A50] dark:hover:text-[#F5F7FC] hover:bg-[#ECE9E1]/50 dark:hover:bg-[#10223D] transition-colors"
          aria-label="Buka navigasi"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex flex-col">
          <h1 className="text-base sm:text-lg font-bold text-[#102A50] dark:text-[#F5F7FC] leading-tight">
            {currentInfo.title}
          </h1>
          <span className="hidden sm:inline text-xs text-[#66758A] dark:text-[#B4C1D4]">
            {currentInfo.subtitle}
          </span>
        </div>
      </div>

      {/* Right: Date pill, Quick action & Notifications */}
      <div className="flex items-center gap-2.5 sm:gap-4">
        {/* Date & Academic period pill */}
        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#ECE9E1]/60 dark:bg-[#10223D] text-xs text-[#172A45] dark:text-[#B4C1D4] border border-[#E0E5EC] dark:border-[#263B58]">
          <span className="font-medium">{todayStr}</span>
          <span className="w-1 h-1 rounded-full bg-[#D9A62E] dark:bg-[#E8B949]" />
          <span className="font-semibold text-[#102A50] dark:text-[#E8B949]">Sem. Ganjil 2024/2025</span>
        </div>

        {/* Quick shortcut button */}
        {activeTab !== 'attendance' && (
          <button
            onClick={() => onSelectTab('attendance')}
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#102A50]/10 dark:bg-[#D9A62E]/15 text-[#102A50] dark:text-[#FFD675] hover:bg-[#102A50]/15 dark:hover:bg-[#D9A62E]/25 text-xs font-semibold border border-[#102A50]/20 dark:border-[#D9A62E]/30 transition-colors"
          >
            <UserCheck className="w-3.5 h-3.5 text-[#D9A62E] dark:text-[#FFD675]" />
            <span>Presensi Cepat</span>
          </button>
        )}

        {/* Global Day/Night Theme Toggle in Header */}
        <button
          type="button"
          onClick={toggleTheme}
          className="p-2 rounded-xl text-[#66758A] hover:text-[#B8851B] dark:text-[#FFD675] dark:hover:text-white hover:bg-amber-50/80 dark:hover:bg-[#10223D] border border-transparent hover:border-[#D9A62E]/40 dark:hover:border-[#D9A62E]/40 transition-colors cursor-pointer"
          title={isDark ? 'Beralih ke Mode Terang (Putih & Gold)' : 'Beralih ke Mode Gelap (Navy & Gold)'}
          aria-label={isDark ? 'Mode Terang' : 'Mode Gelap'}
        >
          {isDark ? (
            <Sun className="w-5 h-5 text-[#FFD675]" />
          ) : (
            <Moon className="w-5 h-5 text-[#B8851B]" />
          )}
        </button>

        {/* Real-time Notification Bell */}
        <div className="relative">
          <button
            onClick={() => setShowNotifMenu(!showNotifMenu)}
            className="relative p-2 rounded-xl text-[#66758A] hover:text-[#102A50] dark:text-[#B4C1D4] dark:hover:text-[#F5F7FC] hover:bg-[#ECE9E1]/60 dark:hover:bg-[#10223D] transition-colors"
            aria-label="Notifikasi sistem"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-[#D9A62E] text-[#0B1B33] text-[10px] font-black flex items-center justify-center animate-pulse">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {/* Notification Popover */}
          {showNotifMenu && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-white dark:bg-[#10223D] border border-[#E0E5EC] dark:border-[#263B58] shadow-2xl py-2 z-50 animate-in fade-in zoom-in-95">
              <div className="px-4 py-2 border-b border-[#E0E5EC] dark:border-[#263B58] flex items-center justify-between">
                <span className="text-sm font-semibold text-[#172A45] dark:text-[#F5F7FC]">
                  Notifikasi Real-Time
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-[#D9A62E]/20 text-[#102A50] dark:text-[#FFD675] font-bold">
                  {unreadCount} Baru
                </span>
              </div>

              <div className="max-h-72 overflow-y-auto divide-y divide-[#E0E5EC] dark:divide-[#263B58]">
                {notifications.length === 0 ? (
                  <div className="p-6 text-center text-xs text-[#66758A] dark:text-[#B4C1D4]">
                    Belum ada notifikasi sistem saat ini.
                  </div>
                ) : (
                  notifications.map((item) => (
                    <div
                      key={item.notificationId}
                      className={`p-3.5 flex items-start gap-3 transition-colors ${
                        item.read
                          ? 'opacity-70 bg-transparent'
                          : 'bg-[#102A50]/5 dark:bg-[#172D4B]'
                      }`}
                    >
                      <div className="mt-0.5 w-7 h-7 rounded-lg bg-[#102A50]/10 dark:bg-[#172D4B] text-[#102A50] dark:text-[#E8B949] flex items-center justify-center shrink-0 text-xs">
                        {item.type === 'success' ? (
                          <CheckCircle className="w-4 h-4 text-emerald-500" />
                        ) : (
                          <Sparkles className="w-4 h-4 text-[#D9A62E]" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <p className="text-xs font-semibold text-[#172A45] dark:text-[#F5F7FC] truncate">
                            {item.title}
                          </p>
                          <span className="text-[10px] text-[#66758A] dark:text-[#B4C1D4] shrink-0">
                            {item.createdAt ? new Date(item.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : ''}
                          </span>
                        </div>
                        <p className="text-xs text-[#66758A] dark:text-[#B4C1D4] mt-0.5 line-clamp-2">
                          {item.message}
                        </p>
                        {!item.read && (
                          <button
                            onClick={() => markNotificationRead(item.notificationId)}
                            className="mt-1.5 text-[11px] font-medium text-[#102A50] dark:text-[#E8B949] hover:underline flex items-center gap-1"
                          >
                            <Check className="w-3 h-3" /> Tandai sudah dibaca
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
