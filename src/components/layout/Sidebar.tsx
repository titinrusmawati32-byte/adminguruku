import {
  BookOpen,
  Calendar,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  FileSpreadsheet,
  GraduationCap,
  HeartHandshake,
  LayoutDashboard,
  LogOut,
  Moon,
  QrCode,
  School,
  Settings,
  ShieldCheck,
  Sun,
  User,
  UserCheck,
  UserCog,
  Users,
} from 'lucide-react';
import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { ProfileModal } from '../common/ProfileModal';

export type ActiveTab =
  | 'dashboard'
  | 'rombel'
  | 'schedules'
  | 'attendance'
  | 'assessments'
  | 'agendas'
  | 'guidance'
  | 'reports'
  | 'teachers'
  | 'students'
  | 'qr-cards'
  | 'subjects'
  | 'settings';

interface SidebarProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  isOpenMobile,
  onCloseMobile,
}) => {
  const [collapsed, setCollapsed] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const { profile, role, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();

  const handleNavClick = (tab: ActiveTab) => {
    onSelectTab(tab);
    onCloseMobile();
  };

  // 1. Menu GURU (Pengguna Operasional)
  const guruNavGroups = [
    {
      group: 'UTAMA',
      items: [
        { id: 'dashboard' as ActiveTab, label: 'Dashboard', icon: LayoutDashboard },
      ],
    },
    {
      group: 'DATA ROMBEL & SISWA',
      items: [
        { id: 'rombel' as ActiveTab, label: 'Daftar Rombel', icon: School },
        { id: 'students' as ActiveTab, label: 'Kelola Siswa', icon: Users },
        { id: 'qr-cards' as ActiveTab, label: 'Cetak Kartu QR Siswa', icon: QrCode },
      ],
    },
    {
      group: 'AKTIVITAS MENGAJAR',
      items: [
        { id: 'schedules' as ActiveTab, label: 'Jadwal Mengajar', icon: Calendar },
        { id: 'attendance' as ActiveTab, label: 'Input Absensi', icon: UserCheck },
        { id: 'assessments' as ActiveTab, label: 'Input Penilaian', icon: CheckSquare },
        { id: 'agendas' as ActiveTab, label: 'Agenda Mengajar', icon: ClipboardList },
        { id: 'guidance' as ActiveTab, label: 'Bimbingan Guru Wali', icon: HeartHandshake },
      ],
    },
    {
      group: 'REKAP & LAPORAN',
      items: [
        { id: 'reports' as ActiveTab, label: 'Rekap Laporan', icon: FileSpreadsheet },
      ],
    },
  ];

  // 2. Menu ADMIN (Pengawas & Monitoring Data)
  const adminNavGroups = [
    {
      group: 'UTAMA',
      items: [
        { id: 'dashboard' as ActiveTab, label: 'Dashboard Monitoring', icon: LayoutDashboard },
      ],
    },
    {
      group: 'MASTER DATA & SISTEM',
      items: [
        { id: 'rombel' as ActiveTab, label: 'Daftar Rombel & Penugasan', icon: School },
        { id: 'teachers' as ActiveTab, label: 'Kelola Akun Guru & Penugasan', icon: UserCog },
        { id: 'students' as ActiveTab, label: 'Kelola Data Siswa', icon: Users },
        { id: 'subjects' as ActiveTab, label: 'Mata Pelajaran (Mapel)', icon: BookOpen },
      ],
    },
    {
      group: 'MONITORING & REKAP',
      items: [
        { id: 'reports' as ActiveTab, label: 'Rekap Laporan', icon: FileSpreadsheet },
        { id: 'schedules' as ActiveTab, label: 'Pantau Jadwal Guru', icon: Calendar },
        { id: 'attendance' as ActiveTab, label: 'Monitoring Absensi', icon: UserCheck },
        { id: 'assessments' as ActiveTab, label: 'Monitoring Nilai', icon: CheckSquare },
        { id: 'agendas' as ActiveTab, label: 'Monitoring Agenda', icon: ClipboardList },
        { id: 'guidance' as ActiveTab, label: 'Monitoring Bimbingan', icon: HeartHandshake },
      ],
    },
  ];


  const currentNavGroups = role === 'admin' ? adminNavGroups : guruNavGroups;

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpenMobile && (
        <div
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-40 lg:hidden"
          onClick={onCloseMobile}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed lg:static top-0 bottom-0 left-0 z-40 flex flex-col bg-white dark:bg-[#071225] border-r border-[#E0E5EC] dark:border-[#263B58] transition-all duration-300 ${
          collapsed ? 'lg:w-20' : 'lg:w-64'
        } ${
          isOpenMobile ? 'translate-x-0 w-72' : '-translate-x-full lg:translate-x-0'
        } shadow-sm`}
      >
        {/* Brand Header */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-[#E0E5EC] dark:border-[#263B58] shrink-0">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold shadow-md shrink-0 ${
              role === 'admin'
                ? 'bg-gradient-to-tr from-[#102A50] to-[#0B1B33] border border-[#D9A62E]/40 text-[#F2C75C] shadow-[#102A50]/30'
                : 'bg-gradient-to-tr from-[#102A50] to-[#0B1B33] border border-[#D9A62E]/30 text-[#F2C75C] shadow-[#102A50]/20'
            }`}>
              {role === 'admin' ? <ShieldCheck className="w-6 h-6 text-[#D9A62E]" /> : <GraduationCap className="w-6 h-6 text-[#D9A62E]" />}
            </div>
            {(!collapsed || isOpenMobile) && (
              <div className="flex flex-col min-w-0">
                <span className="text-base font-extrabold tracking-tight text-[#102A50] dark:text-[#F5F7FC] truncate">
                  ADMIN GURU
                </span>
                <span className="text-[10px] uppercase font-bold tracking-wider text-[#D9A62E] dark:text-[#E8B949]">
                  {role === 'admin' ? 'Pengawas & Monitoring' : 'Aktivitas Guru Terpadu'}
                </span>
              </div>
            )}
          </div>

          <button
            onClick={() => setCollapsed(!collapsed)}
            className="hidden lg:flex p-1.5 rounded-lg text-[#66758A] hover:text-[#102A50] dark:hover:text-[#F5F7FC] hover:bg-[#ECE9E1]/50 dark:hover:bg-[#10223D] transition-colors"
            title={collapsed ? 'Perluas sidebar' : 'Ciutkan sidebar'}
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Navigation Items */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
          {currentNavGroups.map((group) => (
            <div key={group.group} className="space-y-1">
              {(!collapsed || isOpenMobile) && (
                <div className="px-3 text-[11px] font-bold text-[#66758A] dark:text-[#B4C1D4]/60 uppercase tracking-wider mb-2">
                  {group.group}
                </div>
              )}
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleNavClick(item.id)}
                    title={collapsed ? item.label : undefined}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group relative ${
                      isActive
                        ? 'bg-white text-[#B8851B] shadow-sm border border-[#D9A62E] font-bold dark:bg-[#102A50] dark:text-[#FFD675] dark:border-[#D9A62E]/50'
                        : 'text-[#172A45] dark:text-[#B4C1D4] hover:bg-amber-50/70 dark:hover:bg-[#10223D] hover:text-[#B8851B] dark:hover:text-[#FFD675]'
                    } ${collapsed && !isOpenMobile ? 'justify-center' : ''}`}
                  >
                    <Icon
                      className={`w-5 h-5 shrink-0 transition-transform group-hover:scale-105 ${
                        isActive
                          ? 'text-[#D9A62E] dark:text-[#FFD675]'
                          : 'text-[#66758A] dark:text-[#B4C1D4] group-hover:text-[#D9A62E] dark:group-hover:text-[#FFD675]'
                      }`}
                    />
                    {(!collapsed || isOpenMobile) && (
                      <span className="truncate">{item.label}</span>
                    )}
                    {isActive && (!collapsed || isOpenMobile) && (
                      <span className="ml-auto w-1.5 h-1.5 rounded-full bg-[#D9A62E] dark:bg-[#FFD675]" />
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* Bottom Section: Theme, Settings, User Profile & Logout */}
        <div className="p-3 border-t border-[#E0E5EC] dark:border-[#263B58] space-y-1.5 shrink-0 bg-[#FAF9F5] dark:bg-[#071225] transition-colors">
          {/* Menu Profil Akun */}
          <button
            onClick={() => setIsProfileModalOpen(true)}
            title="Profil Pengguna"
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium text-[#172A45] dark:text-[#B4C1D4] hover:bg-amber-50/70 dark:hover:bg-[#10223D] transition-colors cursor-pointer ${
              collapsed && !isOpenMobile ? 'justify-center' : ''
            }`}
          >
            <User className="w-5 h-5 shrink-0 text-[#66758A] dark:text-[#B4C1D4]" />
            {(!collapsed || isOpenMobile) && <span>Profil Saya</span>}
          </button>

          {/* Pengaturan */}
          <button
            onClick={() => handleNavClick('settings')}
            title="Pengaturan & Backup"
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-colors cursor-pointer ${
              activeTab === 'settings'
                ? 'bg-white text-[#B8851B] border border-[#D9A62E] font-bold shadow-sm dark:bg-[#102A50] dark:text-[#FFD675] dark:border-[#D9A62E]/50'
                : 'text-[#172A45] dark:text-[#B4C1D4] hover:bg-amber-50/70 dark:hover:bg-[#10223D]'
            } ${collapsed && !isOpenMobile ? 'justify-center' : ''}`}
          >
            <Settings className="w-5 h-5 shrink-0 text-[#66758A] dark:text-[#B4C1D4]" />
            {(!collapsed || isOpenMobile) && <span>Pengaturan & Backup</span>}
          </button>

          {/* Toggle Dark / Light Theme */}
          <button
            type="button"
            onClick={toggleTheme}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer ${
              collapsed && !isOpenMobile ? 'justify-center' : ''
            } text-[#172A45] dark:text-[#B4C1D4] hover:bg-amber-50/70 dark:hover:bg-[#10223D] hover:text-[#B8851B] dark:hover:text-[#FFD675]`}
            title={isDark ? 'Beralih ke Mode Terang (Putih & Gold)' : 'Beralih ke Mode Gelap (Navy & Gold)'}
          >
            {isDark ? (
              <Sun className="w-5 h-5 text-[#FFD675] shrink-0" />
            ) : (
              <Moon className="w-5 h-5 text-[#B8851B] shrink-0" />
            )}
            {(!collapsed || isOpenMobile) && (
              <span>{isDark ? 'Mode Terang' : 'Mode Gelap'}</span>
            )}
          </button>

          {/* User profile row */}
          {(!collapsed || isOpenMobile) && (
            <div className="pt-2 px-1 flex items-center justify-between gap-2 border-t border-[#E0E5EC] dark:border-[#263B58]">
              <div 
                onClick={() => setIsProfileModalOpen(true)}
                className="flex items-center gap-2.5 min-w-0 cursor-pointer hover:opacity-80 transition-opacity"
              >
                <div className={`w-8 h-8 rounded-full font-bold flex items-center justify-center text-xs shrink-0 ${
                  role === 'admin'
                    ? 'bg-[#102A50] text-[#D9A62E] border border-[#D9A62E]/40'
                    : 'bg-[#102A50] text-[#F2C75C] border border-[#F2C75C]/40'
                }`}>
                  {profile?.displayName?.charAt(0) || (role === 'admin' ? 'A' : 'G')}
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-semibold text-[#172A45] dark:text-[#F5F7FC] truncate">
                    {profile?.displayName || (role === 'admin' ? 'Administrator' : 'Guru')}
                  </span>
                  <span className="text-[10px] text-[#66758A] dark:text-[#B4C1D4] truncate font-mono">
                    @{profile?.username}
                  </span>
                </div>
              </div>

              <button
                onClick={logout}
                title="Keluar"
                className="p-1.5 text-[#66758A] hover:text-rose-600 dark:hover:text-rose-400 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors shrink-0"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}

          {collapsed && !isOpenMobile && (
            <button
              onClick={logout}
              title="Keluar"
              className="w-full flex items-center justify-center p-2 rounded-xl text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
            >
              <LogOut className="w-5 h-5" />
            </button>
          )}
        </div>
      </aside>

      {/* Profile Modal */}
      <ProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
      />
    </>
  );
};
