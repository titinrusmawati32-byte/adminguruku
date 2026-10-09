import { GraduationCap } from 'lucide-react';
import React from 'react';
import { Layout } from './components/layout/Layout';
import { AuthProvider, useAuth } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import { ThemeProvider } from './context/ThemeContext';
import { LoginPage } from './pages/LoginPage';

const AppContent: React.FC = () => {
  const { firebaseUser, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-[#F5F3ED] dark:bg-[#081426] text-[#172A45] dark:text-[#F5F7FC] gap-4">
        <div className="w-14 h-14 rounded-2xl bg-[#102A50] dark:bg-[#071225] border border-[#D9A62E]/40 flex items-center justify-center text-[#FFD675] shadow-xl shadow-[#0B1B33]/30 animate-pulse">
          <GraduationCap className="w-8 h-8" />
        </div>
        <div className="text-center">
          <h2 className="text-base font-bold tracking-tight text-[#172A45] dark:text-[#F5F7FC]">ADMIN GURU</h2>
          <p className="text-xs text-[#66758A] dark:text-[#B4C1D4] mt-1">Memuat sistem administrasi terpadu...</p>
        </div>
        <div className="w-6 h-6 border-2 border-[#D9A62E] border-t-transparent rounded-full animate-spin mt-2" />
      </div>
    );
  }

  if (!firebaseUser && !profile) {
    return <LoginPage />;
  }

  return <Layout />;
};

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <NotificationProvider>
          <AppContent />
        </NotificationProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
