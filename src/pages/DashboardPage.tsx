import {
  AlertCircle,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Calendar,
  CheckCircle,
  CheckCircle2,
  CheckSquare,
  ChevronRight,
  Clock,
  Database,
  GraduationCap,
  HeartHandshake,
  Layers,
  Play,
  Plus,
  RefreshCw,
  Sparkles,
  TrendingUp,
  UserCheck,
  Users,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ActiveTab } from '../components/layout/Sidebar';
import { AdminDashboardView } from '../components/dashboard/AdminDashboardView';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { agendaService } from '../services/agendaService';
import { assessmentService } from '../services/assessmentService';
import { attendanceService } from '../services/attendanceService';
import { auditService } from '../services/auditService';
import { guidanceService } from '../services/guidanceService';
import { scheduleService } from '../services/scheduleService';
import { studentService } from '../services/studentService';
import { subjectService } from '../services/subjectService';
import {
  Assessment,
  AttendanceRecord,
  AuditLog,
  Guidance,
  Schedule,
  Student,
  Subject,
  TeachingAgenda,
} from '../types';

interface DashboardPageProps {
  onSelectTab: (tab: ActiveTab) => void;
}

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444']; // Hadir, Sakit, Izin, Alpa

export const DashboardPage: React.FC<DashboardPageProps> = ({ onSelectTab }) => {
  const { profile, role, isAdmin } = useAuth();
  const { showToast } = useNotification();

  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState<Student[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [agendas, setAgendas] = useState<TeachingAgenda[]>([]);
  const [guidanceList, setGuidanceList] = useState<Guidance[]>([]);
  const [recentLogs, setRecentLogs] = useState<AuditLog[]>([]);

  const loadData = async () => {
    // If role is admin, AdminDashboardView handles its own optimized data loading
    if (role === 'admin') {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [stu, sub, sch, att, ass, age, gui, logs] = await Promise.all([
        studentService.getAll(),
        subjectService.getAll(),
        scheduleService.getAll(),
        attendanceService.getAll(),
        assessmentService.getAll(),
        agendaService.getAll(),
        guidanceService.getAll(),
        auditService.getRecent(5),
      ]);
      setStudents(stu);
      setSubjects(sub);
      setSchedules(sch);
      setAttendance(att);
      setAssessments(ass);
      setAgendas(age);
      setGuidanceList(gui);
      setRecentLogs(logs);
    } catch (err) {
      console.error('Error loading dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [role]);

  // If user is ADMIN, render the Admin Monitoring & Verification View directly
  if (role === 'admin') {
    return (
      <div className="space-y-6 max-w-7xl mx-auto pb-12">
        {/* Admin Monitoring Dashboard */}
        <AdminDashboardView onSelectTab={onSelectTab} />
      </div>
    );
  }

  // Otherwise, user is GURU (Operasional Guru Akademik)
  // Calculations for Today
  const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const todayDayName = dayNames[new Date().getDay()];
  const todayDateStr = new Date().toISOString().slice(0, 10);

  const todaySchedules = schedules.filter((s) => s.day === todayDayName && s.status === 'active');
  const todayAttendance = attendance.filter((a) => a.date === todayDateStr);

  const hadirCount = todayAttendance.filter((a) => a.status === 'Hadir').length;
  const sakitCount = todayAttendance.filter((a) => a.status === 'Sakit').length;
  const izinCount = todayAttendance.filter((a) => a.status === 'Izin').length;
  const alpaCount = todayAttendance.filter((a) => a.status === 'Alpa').length;
  const totalPresensi = todayAttendance.length;
  const attendanceRate = totalPresensi > 0 ? Math.round((hadirCount / totalPresensi) * 100) : 100;

  // Chart Data: Attendance Distribution
  const attendanceDistributionData = [
    { name: 'Hadir', value: hadirCount || (totalPresensi === 0 ? 25 : 0) },
    { name: 'Sakit', value: sakitCount || (totalPresensi === 0 ? 2 : 0) },
    { name: 'Izin', value: izinCount || (totalPresensi === 0 ? 1 : 0) },
    { name: 'Alpa', value: alpaCount || (totalPresensi === 0 ? 0 : 0) },
  ].filter((item) => item.value > 0);

  // Chart Data: Attendance Trend (grouped by last 7 recorded dates)
  const dateGroups: Record<string, { hadir: number; total: number }> = {};
  attendance.forEach((a) => {
    if (!dateGroups[a.date]) dateGroups[a.date] = { hadir: 0, total: 0 };
    dateGroups[a.date].total++;
    if (a.status === 'Hadir') dateGroups[a.date].hadir++;
  });

  const attendanceTrendData = Object.entries(dateGroups)
    .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
    .slice(-7)
    .map(([date, counts]) => ({
      tanggal: date.slice(5),
      kehadiran: Math.round((counts.hadir / counts.total) * 100),
    }));

  if (attendanceTrendData.length === 0) {
    attendanceTrendData.push(
      { tanggal: 'Senin', kehadiran: 96 },
      { tanggal: 'Selasa', kehadiran: 94 },
      { tanggal: 'Rabu', kehadiran: 98 },
      { tanggal: 'Kamis', kehadiran: 92 },
      { tanggal: 'Jumat', kehadiran: 95 }
    );
  }

  // Chart Data: Subject Average Scores
  const subjectScoresData = subjects.slice(0, 6).map((sub) => {
    const subAss = assessments.filter((a) => a.subjectId === sub.subjectId);
    let avg = 0;
    if (subAss.length > 0) {
      let sum = 0;
      let count = 0;
      subAss.forEach((a) => {
        a.scores?.forEach((s) => {
          sum += s.score;
          count++;
        });
      });
      avg = count > 0 ? Math.round(sum / count) : 80;
    } else {
      avg = 82; // representative placeholder
    }
    return {
      mapel: sub.name.length > 12 ? sub.name.slice(0, 10) + '...' : sub.name,
      rataRata: avg,
    };
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Guru Welcome Bar - Sederhana, Elegan & Bersih (Gold & Navy) */}
      <div className="rounded-2xl bg-white dark:bg-[#10223D] border border-[#E0E5EC] dark:border-[#263B58] p-4 sm:p-5 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-[#102A50]/10 dark:bg-[#D9A62E]/15 text-[#102A50] dark:text-[#FFD675] flex items-center justify-center shrink-0 border border-[#102A50]/20 dark:border-[#D9A62E]/30 shadow-xs">
            <GraduationCap className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base sm:text-lg font-bold text-[#172A45] dark:text-[#F5F7FC]">
                Selamat Bertugas, {profile?.displayName || 'Bapak/Ibu Guru'}
              </h3>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-[#D9A62E]/15 text-[#102A50] dark:text-[#FFD675] border border-[#D9A62E]/30">
                Guru Pengampu
              </span>
            </div>
            <p className="text-xs text-[#66758A] dark:text-[#B4C1D4] mt-0.5 flex items-center gap-1.5">
              <span>Tahun Pelajaran 2024/2025</span>
              <span className="w-1 h-1 rounded-full bg-[#D9A62E]" />
              <span className="font-medium text-[#102A50] dark:text-[#E8B949]">Semester Ganjil</span>
              <span className="w-1 h-1 rounded-full bg-[#D9A62E]" />
              <span>Terkoneksi Cloud Firestore</span>
            </p>
          </div>
        </div>

        {/* Status Sinkronisasi Bersih Tanpa Duplikasi Navigasi */}
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#ECE9E1]/60 dark:bg-[#071225] border border-[#E0E5EC] dark:border-[#263B58] text-xs font-semibold text-[#102A50] dark:text-[#FFD675]">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Sesi Aktif</span>
        </div>
      </div>

      {/* ALUR KERJA UTAMA GURU (Visual Linear Flowchart - Gold & Navy) */}
      <div className="p-5 sm:p-6 rounded-3xl bg-[#102A50]/5 dark:bg-[#10223D]/60 border border-[#D9A62E]/25 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm sm:text-base font-bold text-[#172A45] dark:text-[#F5F7FC] flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#D9A62E] dark:text-[#FFD675]" />
              Alur Urutan Kerja Guru Akademik Terpadu
            </h3>
            <p className="text-xs text-[#66758A] dark:text-[#B4C1D4] mt-0.5">
              Jadwal mengajar sebagai pusat konteks. Klik setiap tahapan untuk langsung membuka menu kerja:
            </p>
          </div>
          <span className="hidden sm:inline-block text-[11px] font-semibold text-[#102A50] dark:text-[#FFD675] bg-[#D9A62E]/15 px-2.5 py-1 rounded-full border border-[#D9A62E]/30">
            5 Langkah Terintegrasi
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
          {/* Langkah 1: Jadwal Mengajar */}
          <div
            onClick={() => onSelectTab('schedules')}
            className="p-3.5 rounded-2xl bg-white dark:bg-[#10223D] border border-[#E0E5EC] dark:border-[#263B58] shadow-xs hover:border-[#D9A62E] hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-[#102A50]/10 dark:bg-[#172D4B] text-[#102A50] dark:text-[#FFD675]">
                  Langkah 1
                </span>
                <Calendar className="w-4 h-4 text-[#102A50] dark:text-[#FFD675] group-hover:scale-110 transition-transform" />
              </div>
              <h4 className="text-xs font-bold text-[#172A45] dark:text-[#F5F7FC] group-hover:text-[#D9A62E] dark:group-hover:text-[#FFD675] transition-colors">
                Jadwal Mengajar
              </h4>
              <p className="text-[11px] text-[#66758A] dark:text-[#B4C1D4] mt-1 leading-snug">
                Pilih kelas & jam pelajaran yang akan diajar.
              </p>
            </div>
            <div className="mt-3 pt-2 border-t border-[#E0E5EC] dark:border-[#263B58] flex items-center justify-between text-[11px] font-semibold text-[#102A50] dark:text-[#FFD675]">
              <span>Buka Jadwal</span>
              <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          {/* Langkah 2: Input Absensi */}
          <div
            onClick={() => onSelectTab('attendance')}
            className="p-3.5 rounded-2xl bg-white dark:bg-[#10223D] border border-[#E0E5EC] dark:border-[#263B58] shadow-xs hover:border-emerald-500 hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  Langkah 2
                </span>
                <UserCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform" />
              </div>
              <h4 className="text-xs font-bold text-[#172A45] dark:text-[#F5F7FC] group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                Input Absensi
              </h4>
              <p className="text-[11px] text-[#66758A] dark:text-[#B4C1D4] mt-1 leading-snug">
                Presensi QR kamera siswa atau presensi rombel kelas.
              </p>
            </div>
            <div className="mt-3 pt-2 border-t border-[#E0E5EC] dark:border-[#263B58] flex items-center justify-between text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
              <span>Mulai Absen</span>
              <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          {/* Langkah 3: Input Penilaian */}
          <div
            onClick={() => onSelectTab('assessments')}
            className="p-3.5 rounded-2xl bg-white dark:bg-[#10223D] border border-[#E0E5EC] dark:border-[#263B58] shadow-xs hover:border-[#D9A62E] hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-[#D9A62E]/15 text-[#102A50] dark:text-[#FFD675]">
                  Langkah 3
                </span>
                <CheckSquare className="w-4 h-4 text-[#D9A62E] dark:text-[#FFD675] group-hover:scale-110 transition-transform" />
              </div>
              <h4 className="text-xs font-bold text-[#172A45] dark:text-[#F5F7FC] group-hover:text-[#D9A62E] dark:group-hover:text-[#FFD675] transition-colors">
                Input Penilaian
              </h4>
              <p className="text-[11px] text-[#66758A] dark:text-[#B4C1D4] mt-1 leading-snug">
                Asesmen formatif, sumatif, atau tugas harian.
              </p>
            </div>
            <div className="mt-3 pt-2 border-t border-[#E0E5EC] dark:border-[#263B58] flex items-center justify-between text-[11px] font-semibold text-[#102A50] dark:text-[#FFD675]">
              <span>Isi Nilai</span>
              <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          {/* Langkah 4: Agenda Mengajar */}
          <div
            onClick={() => onSelectTab('agendas')}
            className="p-3.5 rounded-2xl bg-white dark:bg-[#10223D] border border-[#E0E5EC] dark:border-[#263B58] shadow-xs hover:border-amber-500 hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400">
                  Langkah 4
                </span>
                <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400 group-hover:scale-110 transition-transform" />
              </div>
              <h4 className="text-xs font-bold text-[#172A45] dark:text-[#F5F7FC] group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                Agenda Mengajar
              </h4>
              <p className="text-[11px] text-[#66758A] dark:text-[#B4C1D4] mt-1 leading-snug">
                Catat topik materi, kegiatan kelas, & ketercapaian.
              </p>
            </div>
            <div className="mt-3 pt-2 border-t border-[#E0E5EC] dark:border-[#263B58] flex items-center justify-between text-[11px] font-semibold text-amber-600 dark:text-amber-400">
              <span>Isi Jurnal</span>
              <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          {/* Langkah 5: Bimbingan Guru Wali */}
          <div
            onClick={() => onSelectTab('guidance')}
            className="p-3.5 rounded-2xl bg-white dark:bg-[#10223D] border border-[#E0E5EC] dark:border-[#263B58] shadow-xs hover:border-rose-500 hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400">
                  Langkah 5
                </span>
                <HeartHandshake className="w-4 h-4 text-rose-600 dark:text-rose-400 group-hover:scale-110 transition-transform" />
              </div>
              <h4 className="text-xs font-bold text-[#172A45] dark:text-[#F5F7FC] group-hover:text-rose-600 dark:group-hover:text-rose-400 transition-colors">
                Bimbingan Wali
              </h4>
              <p className="text-[11px] text-[#66758A] dark:text-[#B4C1D4] mt-1 leading-snug">
                Konseling karakter & tindak lanjut masalah siswa.
              </p>
            </div>
            <div className="mt-3 pt-2 border-t border-[#E0E5EC] dark:border-[#263B58] flex items-center justify-between text-[11px] font-semibold text-rose-600 dark:text-rose-400">
              <span>Bimbingan</span>
              <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>
        </div>
      </div>

      {/* Database Empty Banner (Helpful for First-Time Setup) */}
      {students.length === 0 && !loading && (
        <div className="p-4 sm:p-5 rounded-2xl bg-[#D9A62E]/10 border border-[#D9A62E]/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#D9A62E]/20 text-[#102A50] dark:text-[#FFD675] flex items-center justify-center shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-[#172A45] dark:text-[#F5F7FC]">
                Belum Ada Data Siswa
              </h4>
              <p className="text-xs text-[#66758A] dark:text-[#B4C1D4]">
                Mulai kelola kelas dengan menambahkan daftar siswa melalui menu Kelola Siswa.
              </p>
            </div>
          </div>
          <button
            onClick={() => onSelectTab('students')}
            className="px-4 py-2 rounded-xl bg-[#102A50] hover:bg-[#0B1B33] active:bg-[#071225] text-white dark:bg-[#D9A62E] dark:text-[#0B1B33] dark:hover:bg-[#F2C75C] text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-sm shrink-0 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Kelola Siswa</span>
          </button>
        </div>
      )}

      {/* 5 Statistic Cards Guru - Gold & Navy */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5 sm:gap-4">
        {/* Total Siswa */}
        <div
          onClick={() => onSelectTab('reports')}
          className="p-4 rounded-2xl bg-white dark:bg-[#10223D] border border-[#E0E5EC] dark:border-[#263B58] shadow-xs hover:border-[#D9A62E] hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="w-9 h-9 rounded-xl bg-[#102A50]/10 dark:bg-[#172D4B] text-[#102A50] dark:text-[#FFD675] flex items-center justify-center group-hover:scale-105 transition-transform">
              <Users className="w-4.5 h-4.5" />
            </div>
            <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-full">
              Aktif
            </span>
          </div>
          <div className="text-2xl font-extrabold text-[#172A45] dark:text-[#F5F7FC] tracking-tight">
            {students.length}
          </div>
          <div className="text-xs text-[#66758A] dark:text-[#B4C1D4] mt-0.5">
            Siswa Terdaftar
          </div>
        </div>

        {/* Jadwal Hari Ini */}
        <div
          onClick={() => onSelectTab('schedules')}
          className="p-4 rounded-2xl bg-white dark:bg-[#10223D] border border-[#E0E5EC] dark:border-[#263B58] shadow-xs hover:border-[#D9A62E] hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="w-9 h-9 rounded-xl bg-[#D9A62E]/15 dark:bg-[#D9A62E]/20 text-[#102A50] dark:text-[#FFD675] flex items-center justify-center group-hover:scale-105 transition-transform">
              <Calendar className="w-4.5 h-4.5" />
            </div>
            <span className="text-[10px] font-semibold text-[#102A50] dark:text-[#FFD675] bg-[#D9A62E]/20 px-1.5 py-0.5 rounded-full">
              {todayDayName}
            </span>
          </div>
          <div className="text-2xl font-extrabold text-[#172A45] dark:text-[#F5F7FC] tracking-tight">
            {todaySchedules.length}
          </div>
          <div className="text-xs text-[#66758A] dark:text-[#B4C1D4] mt-0.5">
            Jadwal Hari Ini
          </div>
        </div>

        {/* Kehadiran Hari Ini */}
        <div
          onClick={() => onSelectTab('attendance')}
          className="p-4 rounded-2xl bg-white dark:bg-[#10223D] border border-[#E0E5EC] dark:border-[#263B58] shadow-xs hover:border-emerald-500 hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center group-hover:scale-105 transition-transform">
              <UserCheck className="w-4.5 h-4.5" />
            </div>
            <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-full">
              Terkini
            </span>
          </div>
          <div className="text-2xl font-extrabold text-[#172A45] dark:text-[#F5F7FC] tracking-tight">
            {attendanceRate}%
          </div>
          <div className="text-xs text-[#66758A] dark:text-[#B4C1D4] mt-0.5">
            Presensi Hadir
          </div>
        </div>

        {/* Agenda Mengajar */}
        <div
          onClick={() => onSelectTab('agendas')}
          className="p-4 rounded-2xl bg-white dark:bg-[#10223D] border border-[#E0E5EC] dark:border-[#263B58] shadow-xs hover:border-amber-500 hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center group-hover:scale-105 transition-transform">
              <Clock className="w-4.5 h-4.5" />
            </div>
            <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded-full">
              Jurnal
            </span>
          </div>
          <div className="text-2xl font-extrabold text-[#172A45] dark:text-[#F5F7FC] tracking-tight">
            {agendas.length}
          </div>
          <div className="text-xs text-[#66758A] dark:text-[#B4C1D4] mt-0.5">
            Jurnal Agenda
          </div>
        </div>

        {/* Kasus Bimbingan */}
        <div
          onClick={() => onSelectTab('guidance')}
          className="p-4 rounded-2xl bg-white dark:bg-[#10223D] border border-[#E0E5EC] dark:border-[#263B58] shadow-xs hover:border-rose-500 hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="w-9 h-9 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center group-hover:scale-105 transition-transform">
              <HeartHandshake className="w-4.5 h-4.5" />
            </div>
            <span className="text-[10px] font-semibold text-rose-600 dark:text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded-full">
              Wali Kelas
            </span>
          </div>
          <div className="text-2xl font-extrabold text-[#172A45] dark:text-[#F5F7FC] tracking-tight">
            {guidanceList.length}
          </div>
          <div className="text-xs text-[#66758A] dark:text-[#B4C1D4] mt-0.5">
            Bimbingan Siswa
          </div>
        </div>
      </div>

      {/* Main Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Line Chart: Kehadiran Tren */}
        <div className="lg:col-span-2 p-5 sm:p-6 rounded-3xl bg-white dark:bg-[#10223D] border border-[#E0E5EC] dark:border-[#263B58] shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm sm:text-base font-bold text-[#172A45] dark:text-[#F5F7FC]">
                Tren Kehadiran Siswa (%)
              </h3>
              <p className="text-xs text-[#66758A] dark:text-[#B4C1D4]">
                Persentase presensi harian per periode aktif
              </p>
            </div>
            <span className="text-xs text-[#102A50] dark:text-[#FFD675] font-semibold bg-[#D9A62E]/15 px-2.5 py-1 rounded-lg border border-[#D9A62E]/25">
              Rata-rata 95%
            </span>
          </div>
          <div className="h-64 sm:h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={attendanceTrendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" opacity={0.2} />
                <XAxis dataKey="tanggal" stroke="#64748b" fontSize={11} />
                <YAxis domain={[60, 100]} stroke="#64748b" fontSize={11} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#071225',
                    borderColor: '#263B58',
                    borderRadius: '12px',
                    color: '#F5F7FC',
                    fontSize: '12px',
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="kehadiran"
                  stroke="#D9A62E"
                  strokeWidth={3}
                  dot={{ r: 4, fill: '#D9A62E' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pie Chart: Status Presensi Hari Ini */}
        <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-[#10223D] border border-[#E0E5EC] dark:border-[#263B58] shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="text-sm sm:text-base font-bold text-[#172A45] dark:text-[#F5F7FC]">
              Presensi Hari Ini
            </h3>
            <p className="text-xs text-[#66758A] dark:text-[#B4C1D4]">
              Total {totalPresensi} presensi tercatat
            </p>

            <div className="h-52 w-full mt-2">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={attendanceDistributionData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {attendanceDistributionData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#071225',
                      borderColor: '#263B58',
                      borderRadius: '12px',
                      color: '#F5F7FC',
                      fontSize: '12px',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#E0E5EC] dark:border-[#263B58]">
            <div className="flex items-center gap-2 text-xs text-[#172A45] dark:text-[#F5F7FC]">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <span>Hadir: {hadirCount}</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-[#172A45] dark:text-[#F5F7FC]">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
              <span>Sakit: {sakitCount}</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-[#172A45] dark:text-[#F5F7FC]">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
              <span>Izin: {izinCount}</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-[#172A45] dark:text-[#F5F7FC]">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
              <span>Alpa: {alpaCount}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Secondary Row: Subject Averages + Today's Schedule & Quick Action */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Bar Chart: Rata-Rata Nilai Mapel */}
        <div className="lg:col-span-2 p-5 sm:p-6 rounded-3xl bg-white dark:bg-[#10223D] border border-[#E0E5EC] dark:border-[#263B58] shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm sm:text-base font-bold text-[#172A45] dark:text-[#F5F7FC]">
                Rata-Rata Penilaian Mata Pelajaran
              </h3>
              <p className="text-xs text-[#66758A] dark:text-[#B4C1D4]">
                Pencapaian KKM (Kriteria Ketuntasan Minimal 75)
              </p>
            </div>
            <button
              onClick={() => onSelectTab('assessments')}
              className="text-xs text-[#102A50] dark:text-[#FFD675] hover:underline font-semibold flex items-center gap-1 cursor-pointer"
            >
              Lihat Detail <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={subjectScoresData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" opacity={0.2} />
                <XAxis dataKey="mapel" stroke="#64748b" fontSize={11} />
                <YAxis domain={[50, 100]} stroke="#64748b" fontSize={11} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#071225',
                    borderColor: '#263B58',
                    borderRadius: '12px',
                    color: '#F5F7FC',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="rataRata" fill="#102A50" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Today's Schedule & "Mulai Mengajar" Card */}
        <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-[#10223D] border border-[#E0E5EC] dark:border-[#263B58] shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm sm:text-base font-bold text-[#172A45] dark:text-[#F5F7FC]">
                Jadwal Hari Ini ({todayDayName})
              </h3>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#102A50]/10 dark:bg-[#172D4B] text-[#102A50] dark:text-[#FFD675]">
                {todaySchedules.length} Sesi
              </span>
            </div>

            <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
              {todaySchedules.length === 0 ? (
                <div className="text-center py-8 text-xs text-[#66758A] dark:text-[#B4C1D4]">
                  Tidak ada jadwal mengajar pada hari {todayDayName}.
                </div>
              ) : (
                todaySchedules.map((sch) => (
                  <div
                    key={sch.scheduleId}
                    className="p-3 rounded-2xl bg-[#ECE9E1]/50 dark:bg-[#071225] border border-[#E0E5EC] dark:border-[#263B58] flex items-center justify-between gap-3 group hover:border-[#D9A62E] transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-[#102A50] text-[#FFD675] font-bold flex items-center justify-center text-xs shrink-0">
                        {sch.className?.replace('Kelas ', '') || '7A'}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-[#172A45] dark:text-[#F5F7FC]">
                          {sch.subjectName}
                        </div>
                        <div className="text-[11px] text-[#66758A] dark:text-[#B4C1D4]">
                          {sch.startTime} - {sch.endTime} • {sch.room}
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => onSelectTab('attendance')}
                      className="px-2.5 py-1.5 rounded-xl bg-[#102A50] hover:bg-[#0B1B33] text-[#FFD675] text-[11px] font-semibold flex items-center gap-1 shadow-xs transition-colors shrink-0 cursor-pointer"
                      title="Mulai mengajar dan input absensi"
                    >
                      <Play className="w-3 h-3 fill-current" />
                      <span>Mulai</span>
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Quick link button to view all weekly schedules */}
          <button
            onClick={() => onSelectTab('schedules')}
            className="w-full mt-4 py-2.5 px-3 rounded-xl border border-[#E0E5EC] dark:border-[#263B58] text-xs font-semibold text-[#172A45] dark:text-[#F5F7FC] hover:bg-[#ECE9E1]/50 dark:hover:bg-[#172D4B] flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <span>Buka Kalender Jadwal Mingguan</span>
            <ArrowUpRight className="w-3.5 h-3.5 text-[#66758A] dark:text-[#B4C1D4]" />
          </button>
        </div>
      </div>

      {/* Recent Activities Feed */}
      <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-[#10223D] border border-[#E0E5EC] dark:border-[#263B58] shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-[#D9A62E] dark:text-[#FFD675]" />
            <h3 className="text-sm sm:text-base font-bold text-[#172A45] dark:text-[#F5F7FC]">
              Aktivitas Sistem Terkini
            </h3>
          </div>
          <span className="text-xs text-[#66758A] dark:text-[#B4C1D4]">Sinkronisasi Realtime Firestore</span>
        </div>

        <div className="divide-y divide-[#E0E5EC] dark:divide-[#263B58]">
          {recentLogs.length === 0 ? (
            <div className="text-xs text-[#66758A] dark:text-[#B4C1D4] py-3">
              Belum ada log transaksi yang dicatat. Sistem siap digunakan.
            </div>
          ) : (
            recentLogs.map((log) => (
              <div key={log.logId} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2.5">
                  <span className="w-2 h-2 rounded-full bg-[#D9A62E]" />
                  <span className="font-semibold text-[#172A45] dark:text-[#F5F7FC]">
                    {log.userName}
                  </span>
                  <span className="text-[#66758A] dark:text-[#B4C1D4]">
                    {log.action} pada <code className="text-[#102A50] dark:text-[#FFD675] font-mono">{log.collection}</code>
                  </span>
                </div>
                <span className="text-[#66758A] dark:text-[#B4C1D4] text-[11px] shrink-0">
                  {log.timestamp ? new Date(log.timestamp).toLocaleTimeString('id-ID') : ''}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
