import React, { useEffect, useState } from 'react';
import {
  Users,
  Calendar,
  UserCheck,
  UserCog,
  CheckSquare,
  ClipboardList,
  HeartHandshake,
  FileSpreadsheet,
  Settings,
  ShieldAlert,
  ArrowRight,
  TrendingUp,
  Download,
  CheckCircle2,
  Clock,
  Sparkles,
  BarChart3,
  RefreshCw,
  Eye,
  Layers,
  Filter,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { ActiveTab } from '../layout/Sidebar';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { studentService } from '../../services/studentService';
import { scheduleService } from '../../services/scheduleService';
import { attendanceService } from '../../services/attendanceService';
import { assessmentService } from '../../services/assessmentService';
import { agendaService } from '../../services/agendaService';
import { guidanceService } from '../../services/guidanceService';
import { classService } from '../../services/classService';
import { auditService } from '../../services/auditService';
import { authService } from '../../services/authService';
import { getFriendlyErrorMessage } from '../../services/firebase';
import {
  Student,
  Schedule,
  AttendanceRecord,
  Assessment,
  TeachingAgenda,
  Guidance,
  SchoolClass,
  AuditLog,
  UserProfile,
} from '../../types';

interface AdminDashboardViewProps {
  onSelectTab: (tab: ActiveTab) => void;
}

const PIE_COLORS = ['#10B981', '#3B82F6', '#F59E0B', '#EF4444'];

export const AdminDashboardView: React.FC<AdminDashboardViewProps> = ({ onSelectTab }) => {
  const { profile } = useAuth();
  const { showToast } = useNotification();

  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [agendas, setAgendas] = useState<TeachingAgenda[]>([]);
  const [guidanceList, setGuidanceList] = useState<Guidance[]>([]);
  const [teachers, setTeachers] = useState<UserProfile[]>([]);
  const [recentLogs, setRecentLogs] = useState<AuditLog[]>([]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [stu, cls, sch, att, ass, agn, gui, tch, logs] = await Promise.all([
        studentService.getAll(),
        classService.getAll(),
        scheduleService.getAll(),
        attendanceService.getAll(),
        assessmentService.getAll(),
        agendaService.getAll(),
        guidanceService.getAll(),
        authService.getAllTeachers(),
        auditService.getRecent(8),
      ]);
      setStudents(stu);
      setClasses(cls);
      setSchedules(sch);
      setAttendance(att);
      setAssessments(ass);
      setAgendas(agn);
      setGuidanceList(gui);
      setTeachers(tch);
      setRecentLogs(logs);
    } catch (err: any) {
      console.error('Error loading admin monitoring data:', err);
      showToast('Gagal memuat data monitoring: ' + getFriendlyErrorMessage(err), 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const todayStr = new Date().toISOString().slice(0, 10);
  const todayAttendance = attendance.filter((a) => a.date === todayStr);
  const hadirCount = todayAttendance.filter((a) => a.status === 'Hadir').length;
  const sakitCount = todayAttendance.filter((a) => a.status === 'Sakit').length;
  const izinCount = todayAttendance.filter((a) => a.status === 'Izin').length;
  const alpaCount = todayAttendance.filter((a) => a.status === 'Alpa').length;

  const totalSiswa = students.length;
  const persentaseKehadiran = todayAttendance.length > 0 
    ? Math.round((hadirCount / todayAttendance.length) * 100)
    : 100;

  // Audit of teacher activity completion
  const agendaDates = new Set(agendas.map((a) => a.date));
  const isTodayAgendaFilled = agendaDates.has(todayStr);

  return (
    <div className="space-y-6">
      {/* Top Banner: Role Explanation */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#071225] via-[#102A50] to-[#0B1B33] border border-[#D9A62E]/30 p-6 sm:p-8 text-white shadow-xl shadow-[#0B1B33]/40">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#D9A62E]/20 border border-[#D9A62E]/40 text-[#FFD675] text-xs font-bold uppercase tracking-wider">
              <ShieldAlert className="w-3.5 h-3.5 text-[#D9A62E]" />
              <span>Portal Pengawas & Monitoring Admin</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">
              Pusat Verifikasi & Monitoring Data Akademik
            </h2>
            <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
              Halo, <span className="font-bold text-[#FFD675]">{profile?.displayName || 'Administrator'}</span>. 
              Sebagai Admin, Anda bertugas memantau kepatuhan pengisian administrasi guru, memeriksa presensi & penilaian siswa, serta mengelola data master institusi.
            </p>
          </div>

          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5 shrink-0">
            <button
              onClick={loadData}
              className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold flex items-center gap-2 border border-white/20 transition-all cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-[#FFD675] ${loading ? 'animate-spin' : ''}`} />
              <span>Sinkronisasi Data</span>
            </button>
            <button
              onClick={() => onSelectTab('teachers')}
              className="px-4 py-2 rounded-xl bg-[#D9A62E] hover:bg-[#F2C75C] text-[#0B1B33] text-xs font-bold shadow-lg shadow-[#D9A62E]/25 flex items-center gap-2 transition-all cursor-pointer"
            >
              <UserCog className="w-3.5 h-3.5" />
              <span>Kelola Akun Guru</span>
            </button>
            <button
              onClick={() => onSelectTab('reports')}
              className="px-4 py-2 rounded-xl bg-[#172D4B] hover:bg-[#10223D] text-[#FFD675] border border-[#D9A62E]/40 text-xs font-bold shadow-lg flex items-center gap-2 transition-all cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-[#D9A62E]" />
              <span>Buka Rekap Laporan</span>
            </button>
          </div>
        </div>
      </div>

      {/* Key Monitoring Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {/* Total Guru & Penugasan */}
        <div className="p-5 rounded-2xl bg-white dark:bg-[#10223D] border border-[#E0E5EC] dark:border-[#263B58] shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#66758A] dark:text-[#B4C1D4]">
            <span className="text-xs font-bold uppercase tracking-wider text-[#102A50] dark:text-[#E8B949]">Akun Guru</span>
            <div className="w-9 h-9 rounded-xl bg-[#102A50]/10 dark:bg-[#172D4B] text-[#102A50] dark:text-[#FFD675] flex items-center justify-center">
              <UserCog className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-2xl font-extrabold text-[#172A45] dark:text-[#F5F7FC]">
              {teachers.length} <span className="text-xs font-normal text-[#66758A] dark:text-[#B4C1D4]">Guru</span>
            </div>
            <p className="text-[11px] text-[#66758A] dark:text-[#B4C1D4] mt-1 flex items-center gap-1">
              {teachers.filter((t) => t.isHomeroom).length} Wali Kelas Aktif
            </p>
          </div>
          <button
            onClick={() => onSelectTab('teachers')}
            className="mt-4 text-xs font-bold text-[#102A50] dark:text-[#FFD675] hover:underline flex items-center gap-1 cursor-pointer"
          >
            <span>Kelola Guru & Penugasan</span>
            <ArrowRight className="w-3 h-3 text-[#D9A62E]" />
          </button>
        </div>

        {/* Total Siswa */}
        <div className="p-5 rounded-2xl bg-white dark:bg-[#10223D] border border-[#E0E5EC] dark:border-[#263B58] shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#66758A] dark:text-[#B4C1D4]">
            <span className="text-xs font-bold uppercase tracking-wider text-[#102A50] dark:text-[#E8B949]">Data Siswa</span>
            <div className="w-9 h-9 rounded-xl bg-[#102A50]/10 dark:bg-[#172D4B] text-[#102A50] dark:text-[#FFD675] flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-2xl font-extrabold text-[#172A45] dark:text-[#F5F7FC]">
              {totalSiswa} <span className="text-xs font-normal text-[#66758A] dark:text-[#B4C1D4]">Siswa</span>
            </div>
            <p className="text-[11px] text-[#66758A] dark:text-[#B4C1D4] mt-1 flex items-center gap-1">
              Tersebar di {classes.length} rombel kelas
            </p>
          </div>
          <button
            onClick={() => onSelectTab('students')}
            className="mt-4 text-xs font-bold text-[#102A50] dark:text-[#FFD675] hover:underline flex items-center gap-1 cursor-pointer"
          >
            <span>Kelola Siswa</span>
            <ArrowRight className="w-3 h-3 text-[#D9A62E]" />
          </button>
        </div>

        {/* Kehadiran Hari Ini */}
        <div className="p-5 rounded-2xl bg-white dark:bg-[#10223D] border border-[#E0E5EC] dark:border-[#263B58] shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#66758A] dark:text-[#B4C1D4]">
            <span className="text-xs font-bold uppercase tracking-wider text-[#102A50] dark:text-[#E8B949]">Presensi Hari Ini</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <UserCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-2xl font-extrabold text-[#172A45] dark:text-[#F5F7FC]">
              {persentaseKehadiran}%
            </div>
            <p className="text-[11px] text-[#66758A] dark:text-[#B4C1D4] mt-1">
              {hadirCount} Hadir · {sakitCount + izinCount + alpaCount} Tidak Hadir
            </p>
          </div>
          <button
            onClick={() => onSelectTab('reports')}
            className="mt-4 text-xs font-bold text-[#102A50] dark:text-[#FFD675] hover:underline flex items-center gap-1 cursor-pointer"
          >
            <span>Lihat Log Presensi</span>
            <ArrowRight className="w-3 h-3 text-[#D9A62E]" />
          </button>
        </div>

        {/* Total Penilaian */}
        <div className="p-5 rounded-2xl bg-white dark:bg-[#10223D] border border-[#E0E5EC] dark:border-[#263B58] shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#66758A] dark:text-[#B4C1D4]">
            <span className="text-xs font-bold uppercase tracking-wider text-[#102A50] dark:text-[#E8B949]">Penilaian Guru</span>
            <div className="w-9 h-9 rounded-xl bg-[#D9A62E]/15 dark:bg-[#172D4B] text-[#D9A62E] dark:text-[#FFD675] flex items-center justify-center">
              <CheckSquare className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-2xl font-extrabold text-[#172A45] dark:text-[#F5F7FC]">
              {assessments.length} <span className="text-xs font-normal text-[#66758A] dark:text-[#B4C1D4]">Paket</span>
            </div>
            <p className="text-[11px] text-[#66758A] dark:text-[#B4C1D4] mt-1">
              Asesmen Formatif & Sumatif
            </p>
          </div>
          <button
            onClick={() => onSelectTab('reports')}
            className="mt-4 text-xs font-bold text-[#102A50] dark:text-[#FFD675] hover:underline flex items-center gap-1 cursor-pointer"
          >
            <span>Rekap Nilai Siswa</span>
            <ArrowRight className="w-3 h-3 text-[#D9A62E]" />
          </button>
        </div>

        {/* Agenda & Jurnal Guru */}
        <div className="p-5 rounded-2xl bg-white dark:bg-[#10223D] border border-[#E0E5EC] dark:border-[#263B58] shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#66758A] dark:text-[#B4C1D4]">
            <span className="text-xs font-bold uppercase tracking-wider text-[#102A50] dark:text-[#E8B949]">Jurnal Mengajar</span>
            <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <ClipboardList className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-2xl font-extrabold text-[#172A45] dark:text-[#F5F7FC]">
              {agendas.length} <span className="text-xs font-normal text-[#66758A] dark:text-[#B4C1D4]">Jurnal</span>
            </div>
            <p className="text-[11px] text-[#66758A] dark:text-[#B4C1D4] mt-1">
              {isTodayAgendaFilled ? 'Terisi Hari Ini' : 'Belum Ada Entri Hari Ini'}
            </p>
          </div>
          <button
            onClick={() => onSelectTab('reports')}
            className="mt-4 text-xs font-bold text-[#102A50] dark:text-[#FFD675] hover:underline flex items-center gap-1 cursor-pointer"
          >
            <span>Pantau Agenda Guru</span>
            <ArrowRight className="w-3 h-3 text-[#D9A62E]" />
          </button>
        </div>
      </div>

      {/* Grid: Status Kepatuhan Pengisian & Ringkasan Presensi */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Kolom Kiri 2/3: Status Kepatuhan Pengisian Guru */}
        <div className="lg:col-span-2 p-6 rounded-3xl bg-white dark:bg-[#10223D] border border-[#E0E5EC] dark:border-[#263B58] shadow-xs">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-base font-bold text-[#102A50] dark:text-[#F5F7FC] flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                Status Kelengkapan Administrasi Akademik
              </h3>
              <p className="text-xs text-[#66758A] dark:text-[#B4C1D4] mt-0.5">
                Monitoring kepatuhan input aktivitas guru dalam sistem
              </p>
            </div>
            <span className="text-xs px-2.5 py-1 rounded-full bg-[#ECE9E1]/60 dark:bg-[#172D4B] text-[#102A50] dark:text-[#FFD675] font-bold font-mono">
              Periode Aktif
            </span>
          </div>

          <div className="space-y-3">
            {/* Item 1: Presensi Harian Siswa */}
            <div className="p-4 rounded-2xl bg-[#F5F3ED]/40 dark:bg-[#0B1B33]/60 border border-[#E0E5EC] dark:border-[#263B58] flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#102A50]/10 dark:bg-[#172D4B] text-[#102A50] dark:text-[#FFD675] flex items-center justify-center font-bold">
                  <UserCheck className="w-5 h-5 text-[#D9A62E]" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-[#102A50] dark:text-[#F5F7FC]">
                    Input Absensi & Presensi Siswa
                  </h4>
                  <p className="text-xs text-[#66758A] dark:text-[#B4C1D4]">
                    {todayAttendance.length > 0
                      ? `Hari ini telah tercatat ${todayAttendance.length} data presensi siswa`
                      : 'Belum ada presensi yang di-submit untuk hari ini'}
                  </p>
                </div>
              </div>
              <div className="text-right shrink-0">
                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                  todayAttendance.length > 0
                    ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300'
                    : 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300'
                }`}>
                  {todayAttendance.length > 0 ? 'Sedang Berjalan' : 'Menunggu Input Guru'}
                </span>
              </div>
            </div>

            {/* Item 2: Agenda Mengajar Harian */}
            <div className="p-4 rounded-2xl bg-[#F5F3ED]/40 dark:bg-[#0B1B33]/60 border border-[#E0E5EC] dark:border-[#263B58] flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#D9A62E]/15 dark:bg-[#172D4B] text-[#D9A62E] dark:text-[#FFD675] flex items-center justify-center font-bold">
                  <ClipboardList className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-[#102A50] dark:text-[#F5F7FC]">
                    Jurnal & Agenda Mengajar Guru
                  </h4>
                  <p className="text-xs text-[#66758A] dark:text-[#B4C1D4]">
                    {agendas.length} total agenda tersimpan dalam Firestore
                  </p>
                </div>
              </div>
              <div className="text-right shrink-0">
                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                  agendas.length > 0
                    ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300'
                    : 'bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300'
                }`}>
                  {agendas.length > 0 ? 'Tersedia' : 'Belum Ada Data'}
                </span>
              </div>
            </div>

            {/* Item 3: Penilaian Asesmen Formatif & Sumatif */}
            <div className="p-4 rounded-2xl bg-[#F5F3ED]/40 dark:bg-[#0B1B33]/60 border border-[#E0E5EC] dark:border-[#263B58] flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#102A50]/10 dark:bg-[#172D4B] text-[#102A50] dark:text-[#FFD675] flex items-center justify-center font-bold">
                  <CheckSquare className="w-5 h-5 text-[#D9A62E]" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-[#102A50] dark:text-[#F5F7FC]">
                    Input Penilaian Hasil Belajar
                  </h4>
                  <p className="text-xs text-[#66758A] dark:text-[#B4C1D4]">
                    {assessments.length} paket asesmen kelas telah diinput
                  </p>
                </div>
              </div>
              <div className="text-right shrink-0">
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300">
                  {assessments.length} Tersimpan
                </span>
              </div>
            </div>

            {/* Item 4: Bimbingan Konseling Guru Wali */}
            <div className="p-4 rounded-2xl bg-[#F5F3ED]/40 dark:bg-[#0B1B33]/60 border border-[#E0E5EC] dark:border-[#263B58] flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center justify-center font-bold">
                  <HeartHandshake className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-[#102A50] dark:text-[#F5F7FC]">
                    Bimbingan Guru Wali / Konseling Siswa
                  </h4>
                  <p className="text-xs text-[#66758A] dark:text-[#B4C1D4]">
                    {guidanceList.length} catatan bimbingan karakter & masalah belajar
                  </p>
                </div>
              </div>
              <div className="text-right shrink-0">
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300">
                  {guidanceList.length} Catatan
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Kolom Kanan 1/3: Distribusi Presensi Siswa */}
        <div className="p-6 rounded-3xl bg-white dark:bg-[#10223D] border border-[#E0E5EC] dark:border-[#263B58] shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="text-base font-bold text-[#102A50] dark:text-[#F5F7FC] flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-indigo-500" />
              Rekap Presensi Siswa
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Distribusi status kehadiran terkini
            </p>

            <div className="mt-4 space-y-2.5">
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 text-xs">
                <span className="font-semibold text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  Hadir
                </span>
                <span className="font-bold text-emerald-700 dark:text-emerald-300">{hadirCount} Siswa</span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/30 text-xs">
                <span className="font-semibold text-blue-800 dark:text-blue-300 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                  Sakit
                </span>
                <span className="font-bold text-blue-700 dark:text-blue-300">{sakitCount} Siswa</span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 text-xs">
                <span className="font-semibold text-amber-800 dark:text-amber-300 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                  Izin
                </span>
                <span className="font-bold text-amber-700 dark:text-amber-300">{izinCount} Siswa</span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 text-xs">
                <span className="font-semibold text-rose-800 dark:text-rose-300 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                  Alpa / Tanpa Keterangan
                </span>
                <span className="font-bold text-rose-700 dark:text-rose-300">{alpaCount} Siswa</span>
              </div>
            </div>
          </div>

          <div className="pt-4 mt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              onClick={() => onSelectTab('reports')}
              className="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold transition-colors flex items-center justify-center gap-2"
            >
              <FileSpreadsheet className="w-4 h-4 text-indigo-500" />
              <span>Buka Seluruh Laporan Rekap</span>
            </button>
          </div>
        </div>
      </div>

      {/* Log Aktivitas Guru Terkini */}
      <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Clock className="w-5 h-5 text-blue-500" />
              Aktivitas Guru Terkini (Audit Trail)
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Catatan riwayat input dan perubahan data oleh guru di Firestore
            </p>
          </div>
        </div>

        {recentLogs.length === 0 ? (
          <div className="text-center py-8 text-xs text-slate-400">
            Belum ada aktivitas baru yang tercatat.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 uppercase tracking-wider">
                  <th className="pb-3 font-semibold">Waktu</th>
                  <th className="pb-3 font-semibold">Pengguna / Guru</th>
                  <th className="pb-3 font-semibold">Tindakan</th>
                  <th className="pb-3 font-semibold">Rincian</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {recentLogs.map((log) => (
                  <tr key={log.logId} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                    <td className="py-3 text-slate-500 font-mono">
                      {new Date(log.timestamp).toLocaleTimeString('id-ID', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="py-3 font-semibold text-slate-800 dark:text-slate-200">
                      {log.userName}
                    </td>
                    <td className="py-3">
                      <span className="px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 font-semibold text-[11px]">
                        {log.action}
                      </span>
                    </td>
                    <td className="py-3 text-slate-600 dark:text-slate-300">
                      {log.details}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
