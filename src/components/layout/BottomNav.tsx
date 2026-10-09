import {
  Calendar,
  CheckSquare,
  FileSpreadsheet,
  LayoutDashboard,
  Menu,
  School,
  ShieldCheck,
  UserCheck,
  Users,
} from 'lucide-react';
import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { ActiveTab } from './Sidebar';

interface BottomNavProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  onOpenMobileMenu: () => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  onSelectTab,
  onOpenMobileMenu,
}) => {
  const { role } = useAuth();

  // Quick items tailored for Guru vs Admin
  const guruItems = [
    { id: 'dashboard' as ActiveTab, label: 'Beranda', icon: LayoutDashboard },
    { id: 'rombel' as ActiveTab, label: 'Rombel', icon: School },
    { id: 'attendance' as ActiveTab, label: 'Absensi', icon: UserCheck },
    { id: 'assessments' as ActiveTab, label: 'Nilai', icon: CheckSquare },
    { id: 'reports' as ActiveTab, label: 'Rekap', icon: FileSpreadsheet },
  ];

  const adminItems = [
    { id: 'dashboard' as ActiveTab, label: 'Pantau', icon: LayoutDashboard },
    { id: 'rombel' as ActiveTab, label: 'Rombel', icon: School },
    { id: 'students' as ActiveTab, label: 'Siswa', icon: Users },
    { id: 'attendance' as ActiveTab, label: 'Absensi', icon: UserCheck },
    { id: 'reports' as ActiveTab, label: 'Rekap', icon: FileSpreadsheet },
  ];

  const items = role === 'admin' ? adminItems : guruItems;

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/95 dark:bg-[#071225]/95 backdrop-blur-md border-t border-[#E0E5EC] dark:border-[#263B58] px-2 py-1.5 flex items-center justify-around shadow-lg">
      {items.map((item) => {
        const Icon = item.icon;
        const isActive = activeTab === item.id;
        return (
          <button
            key={item.id}
            onClick={() => onSelectTab(item.id)}
            className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-colors min-w-[52px] ${
              isActive
                ? 'text-[#102A50] dark:text-[#FFD675] font-bold'
                : 'text-[#66758A] dark:text-[#B4C1D4] hover:text-[#102A50] dark:hover:text-[#F5F7FC]'
            }`}
          >
            <Icon className={`w-5 h-5 ${isActive ? 'scale-110 text-[#D9A62E] dark:text-[#FFD675]' : ''} transition-transform`} />
            <span className="text-[10px] mt-0.5">{item.label}</span>
          </button>
        );
      })}

      <button
        onClick={onOpenMobileMenu}
        className="flex flex-col items-center justify-center py-1 px-2 rounded-xl text-[#66758A] dark:text-[#B4C1D4] hover:text-[#102A50] dark:hover:text-[#F5F7FC] min-w-[52px]"
      >
        <Menu className="w-5 h-5" />
        <span className="text-[10px] mt-0.5">Semua</span>
      </button>
    </nav>
  );
};
