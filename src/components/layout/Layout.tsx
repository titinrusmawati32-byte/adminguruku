import React, { Suspense, useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { PageLoadingFallback } from '../common/Skeleton';
import { BottomNav } from './BottomNav';
import { Header } from './Header';
import { ActiveTab, Sidebar } from './Sidebar';

// Code-split pages so massive libraries (jsPDF, xlsx, qrcode, html5-qrcode) only load when visited!
const AgendasPage = React.lazy(() =>
  import('../../pages/AgendasPage').then((m) => ({ default: m.AgendasPage }))
);
const AssessmentsPage = React.lazy(() =>
  import('../../pages/AssessmentsPage').then((m) => ({ default: m.AssessmentsPage }))
);
const AttendancePage = React.lazy(() =>
  import('../../pages/AttendancePage').then((m) => ({ default: m.AttendancePage }))
);
const DashboardPage = React.lazy(() =>
  import('../../pages/DashboardPage').then((m) => ({ default: m.DashboardPage }))
);
const GuidancePage = React.lazy(() =>
  import('../../pages/GuidancePage').then((m) => ({ default: m.GuidancePage }))
);
const QrCardPrintPage = React.lazy(() =>
  import('../../pages/QrCardPrintPage').then((m) => ({ default: m.QrCardPrintPage }))
);
const ReportsPage = React.lazy(() =>
  import('../../pages/ReportsPage').then((m) => ({ default: m.ReportsPage }))
);
const RombelPage = React.lazy(() =>
  import('../../pages/RombelPage').then((m) => ({ default: m.RombelPage }))
);
const SchedulesPage = React.lazy(() =>
  import('../../pages/SchedulesPage').then((m) => ({ default: m.SchedulesPage }))
);
const SettingsPage = React.lazy(() =>
  import('../../pages/SettingsPage').then((m) => ({ default: m.SettingsPage }))
);
const StudentsPage = React.lazy(() =>
  import('../../pages/StudentsPage').then((m) => ({ default: m.StudentsPage }))
);
const SubjectsPage = React.lazy(() =>
  import('../../pages/SubjectsPage').then((m) => ({ default: m.SubjectsPage }))
);
const TeachersPage = React.lazy(() =>
  import('../../pages/TeachersPage').then((m) => ({ default: m.TeachersPage }))
);

export const Layout: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const { role } = useAuth();
  const { showToast } = useNotification();

  // Guard against unauthorized role access
  useEffect(() => {
    if (role === 'guru' && activeTab === 'teachers') {
      showToast('Akses ditolak: Menu Kelola Akun Guru khusus untuk Admin Sekolah.', 'error');
      setActiveTab('dashboard');
    }
  }, [role, activeTab, showToast]);

  const renderActiveContent = () => {
    if (role === 'guru' && activeTab === 'teachers') {
      return <DashboardPage onSelectTab={setActiveTab} />;
    }

    switch (activeTab) {
      case 'dashboard':
        return <DashboardPage onSelectTab={setActiveTab} />;
      case 'rombel':
        return <RombelPage onSelectTab={setActiveTab} />;
      case 'teachers':
        return <TeachersPage onSelectTab={setActiveTab} />;
      case 'students':
        return <StudentsPage />;
      case 'qr-cards':
        return <QrCardPrintPage />;
      case 'subjects':
        return <SubjectsPage />;
      case 'schedules':
        return <SchedulesPage onSelectTab={setActiveTab} />;
      case 'attendance':
        return <AttendancePage />;
      case 'assessments':
        return <AssessmentsPage />;
      case 'agendas':
        return <AgendasPage />;
      case 'guidance':
        return <GuidancePage />;
      case 'reports':
        return <ReportsPage />;
      case 'settings':
        return <SettingsPage />;
      default:
        return <DashboardPage onSelectTab={setActiveTab} />;
    }
  };

  return (
    <div className="flex h-screen w-full bg-[#F5F3ED] dark:bg-[#081426] text-[#172A45] dark:text-[#F5F7FC] overflow-hidden font-sans">
      {/* Collapsible Modern Sidebar */}
      <Sidebar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        isOpenMobile={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
      />

      {/* Main View Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Sticky Glass Top Header */}
        <Header
          activeTab={activeTab}
          onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)}
          onSelectTab={setActiveTab}
        />

        {/* Scrollable Main Content with Suspense */}
        <main className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 pb-24 lg:pb-8">
          <Suspense fallback={<PageLoadingFallback />}>
            {renderActiveContent()}
          </Suspense>
        </main>

        {/* Mobile Bottom Navigation */}
        <BottomNav
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          onOpenMobileMenu={() => setIsMobileSidebarOpen(true)}
        />
      </div>
    </div>
  );
};
