import {
  AlertCircle,
  BookOpen,
  Calendar,
  Check,
  CheckCircle2,
  CheckSquare,
  Clock,
  Crown,
  Download,
  FileSpreadsheet,
  GraduationCap,
  HeartHandshake,
  Layers,
  Plus,
  QrCode,
  RefreshCw,
  School,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  UserCog,
  Users,
  X,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import React, { useEffect, useMemo, useState } from 'react';
import { EmptyState } from '../components/common/EmptyState';
import { Modal } from '../components/common/Modal';
import { ActiveTab } from '../components/layout/Sidebar';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { auditService } from '../services/auditService';
import { authService } from '../services/authService';
import { authorizationService } from '../services/authorizationService';
import { classService, groupClassesBySDGrade } from '../services/classService';
import { studentService } from '../services/studentService';
import { SchoolClass, Student, UserProfile } from '../types';

interface RombelPageProps {
  onSelectTab?: (tab: ActiveTab) => void;
}

export const RombelPage: React.FC<RombelPageProps> = ({ onSelectTab }) => {
  const { profile, role } = useAuth();
  const { showToast } = useNotification();

  // Primary data states
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [teachers, setTeachers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  // Admin filter states
  const [adminGradeFilter, setAdminGradeFilter] = useState<
    'all' | '1' | '2' | '3' | '4' | '5' | '6' | 'fase-a' | 'fase-b' | 'fase-c'
  >('all');
  const [adminSearch, setAdminSearch] = useState('');

  // Selected class for student roster view (Guru auto-selects their class)
  const [selectedRosterClassId, setSelectedRosterClassId] = useState<string>('');
  const [studentSearch, setStudentSearch] = useState('');

  // Modals
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [classToAssign, setClassToAssign] = useState<SchoolClass | null>(null);
  const [selectedHomeroomUid, setSelectedHomeroomUid] = useState<string>('');
  const [selectedTeacherUids, setSelectedTeacherUids] = useState<string[]>([]);
  const [savingAssignment, setSavingAssignment] = useState(false);

  // Student QR Modal
  const [qrModalStudent, setQrModalStudent] = useState<Student | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [allCls, allTch, allStu] = await Promise.all([
        classService.getAll(),
        authService.getAllTeachers(true),
        studentService.getAll(profile),
      ]);

      setClasses(allCls);
      setTeachers(allTch);
      setStudents(allStu);

      // Determine initial class selection
      if (role === 'guru') {
        const guruAssigned = authorizationService.filterClassesForUser(allCls, profile);
        if (guruAssigned.length > 0) {
          setSelectedRosterClassId(guruAssigned[0].classId);
        }
      } else if (allCls.length > 0 && !selectedRosterClassId) {
        setSelectedRosterClassId(allCls[0].classId);
      }
    } catch (err: any) {
      showToast('Gagal memuat data rombel: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [profile?.uid, profile?.role]);

  // Classes available for current view:
  // For Guru: STRICTLY their assigned classes only!
  // For Admin: All SD classes
  const assignedClassesForGuru = useMemo(() => {
    return authorizationService.filterClassesForUser(classes, profile);
  }, [classes, profile]);

  const displayedClasses = useMemo(() => {
    if (role === 'guru') {
      return assignedClassesForGuru;
    }

    // For Admin: filtered by grade filter and search
    let list = classes;
    if (adminGradeFilter === 'fase-a') {
      list = list.filter((c) => ['1', '2'].includes(c.grade || c.name.replace(/\D/g, '')));
    } else if (adminGradeFilter === 'fase-b') {
      list = list.filter((c) => ['3', '4'].includes(c.grade || c.name.replace(/\D/g, '')));
    } else if (adminGradeFilter === 'fase-c') {
      list = list.filter((c) => ['5', '6'].includes(c.grade || c.name.replace(/\D/g, '')));
    } else if (adminGradeFilter !== 'all') {
      list = list.filter((c) => (c.grade || c.name.replace(/\D/g, '')) === adminGradeFilter);
    }

    if (adminSearch.trim()) {
      const q = adminSearch.toLowerCase();
      list = list.filter((c) => c.name.toLowerCase().includes(q) || c.classId.toLowerCase().includes(q));
    }

    return list;
  }, [role, assignedClassesForGuru, classes, adminGradeFilter, adminSearch]);

  // Students in selected roster class
  const studentsInSelectedClass = useMemo(() => {
    if (!selectedRosterClassId) return [];
    const cls = classes.find((c) => c.classId === selectedRosterClassId);
    return students.filter(
      (s) => s.classId === selectedRosterClassId || (cls && s.className === cls.name)
    );
  }, [students, selectedRosterClassId, classes]);

  const filteredRosterStudents = useMemo(() => {
    if (!studentSearch.trim()) return studentsInSelectedClass;
    const q = studentSearch.toLowerCase();
    return studentsInSelectedClass.filter(
      (s) => s.name.toLowerCase().includes(q) || s.nis.includes(q) || s.nisn.includes(q)
    );
  }, [studentsInSelectedClass, studentSearch]);

  // Admin opens modal to assign homeroom & subject teachers
  const handleOpenAssignModal = (cls: SchoolClass) => {
    setClassToAssign(cls);
    const homeroom = teachers.find((t) => t.isHomeroom && t.homeroomClass === cls.name);
    setSelectedHomeroomUid(homeroom ? homeroom.uid : '');

    const assigned = teachers
      .filter((t) => (t.assignedClasses || []).includes(cls.name))
      .map((t) => t.uid);
    setSelectedTeacherUids(assigned);
    setIsAssignModalOpen(true);
  };

  const handleSaveAssignment = async () => {
    if (!classToAssign) return;
    setSavingAssignment(true);
    const className = classToAssign.name;

    try {
      for (const t of teachers) {
        let shouldUpdate = false;
        let newIsHomeroom = t.isHomeroom;
        let newHomeroomClass = t.homeroomClass || '';
        let newAssignedClasses = [...(t.assignedClasses || [])];

        const isNowHomeroom = t.uid === selectedHomeroomUid;
        const isPreviouslyHomeroom = t.isHomeroom && t.homeroomClass === className;

        if (isNowHomeroom && (!t.isHomeroom || t.homeroomClass !== className)) {
          newIsHomeroom = true;
          newHomeroomClass = className;
          if (!newAssignedClasses.includes(className)) {
            newAssignedClasses.push(className);
          }
          shouldUpdate = true;
        } else if (!isNowHomeroom && isPreviouslyHomeroom) {
          newIsHomeroom = false;
          newHomeroomClass = '';
          shouldUpdate = true;
        }

        const shouldTeach = selectedTeacherUids.includes(t.uid);
        const currentlyTeaches = newAssignedClasses.includes(className);

        if (shouldTeach && !currentlyTeaches) {
          newAssignedClasses.push(className);
          shouldUpdate = true;
        } else if (!shouldTeach && currentlyTeaches && !isNowHomeroom) {
          newAssignedClasses = newAssignedClasses.filter((c) => c !== className);
          shouldUpdate = true;
        }

        if (shouldUpdate) {
          await authService.updateUserProfile(t.uid, {
            isHomeroom: newIsHomeroom,
            homeroomClass: newHomeroomClass,
            assignedClasses: newAssignedClasses,
          });
        }
      }

      await auditService.log(
        'PENETAPAN_WALI_ROMBEL',
        'classes',
        classToAssign.classId,
        `Admin menetapkan wali kelas dan penugasan guru untuk rombel SD ${className}`
      );

      showToast(`Penugasan rombel ${className} berhasil disimpan di database!`, 'success');
      setIsAssignModalOpen(false);
      await loadData();
    } catch (err: any) {
      showToast('Gagal menyimpan penugasan rombel: ' + err.message, 'error');
    } finally {
      setSavingAssignment(false);
    }
  };

  const handleExportRoster = () => {
    if (studentsInSelectedClass.length === 0) {
      showToast('Tidak ada data siswa untuk diekspor.', 'warning');
      return;
    }
    const currentCls = classes.find((c) => c.classId === selectedRosterClassId);
    studentService.exportToExcel(
      studentsInSelectedClass,
      `Data_Siswa_${currentCls?.name.replace(/\s+/g, '_') || 'Rombel'}`
    );
    showToast('File Excel data siswa rombel berhasil diunduh.', 'success');
  };

  // Helper to get homeroom teacher for a class
  const getHomeroomForClass = (className: string) => {
    return teachers.find((t) => t.isHomeroom && t.homeroomClass === className);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Banner Gold-Navy */}
      <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-[#102A50] via-[#0B1B33] to-[#071225] border border-[#D9A62E]/30 text-white shadow-xl relative overflow-hidden">
        {/* Subtle background glow */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-[#D9A62E]/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#D9A62E]/20 border border-[#D9A62E]/40 text-[#FFD675] text-xs font-bold uppercase tracking-wider">
              <School className="w-3.5 h-3.5" />
              <span>{role === 'admin' ? 'Monitoring & Master Rombel' : 'Rombongan Belajar Resmi'}</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight text-[#F5F7FC]">
              {role === 'admin'
                ? 'Daftar Rombongan Belajar (Rombel SD Kelas 1 - 6)'
                : 'Daftar Rombongan Belajar yang Ditugaskan'}
            </h2>
            <p className="text-xs sm:text-sm text-[#B4C1D4] leading-relaxed">
              {role === 'admin'
                ? 'Kelola penetapan wali kelas, guru pengampu, serta pantau distribusi siswa di setiap rombongan belajar sekolah.'
                : 'Berikut adalah rombongan belajar yang secara resmi ditetapkan oleh Admin Sekolah untuk Anda ampu pada Tahun Pelajaran 2024/2025.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            {role === 'admin' && (
              <button
                onClick={loadData}
                className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold flex items-center gap-2 border border-white/20 transition-all cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                <span>Segarkan Data</span>
              </button>
            )}

            {role === 'guru' && assignedClassesForGuru.length > 0 && onSelectTab && (
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => onSelectTab('attendance')}
                  className="px-3.5 py-2 rounded-xl bg-[#D9A62E] hover:bg-[#F2C75C] text-[#071225] text-xs font-bold flex items-center gap-1.5 shadow-md transition-all cursor-pointer"
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>Input Presensi</span>
                </button>
                <button
                  onClick={() => onSelectTab('assessments')}
                  className="px-3.5 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-[#FFD675] border border-[#D9A62E]/40 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <CheckSquare className="w-3.5 h-3.5" />
                  <span>Input Nilai</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 1. VIEW UNTUK AKUN GURU: TAMPILKAN HANYA ROMBEL YANG DITUGASKAN */}
      {/* ============================================================== */}
      {role === 'guru' && (
        <div className="space-y-6">
          {/* Kondisi jika Guru BELUM mendapat penugasan rombel */}
          {assignedClassesForGuru.length === 0 ? (
            <div className="rounded-3xl bg-white dark:bg-[#10223D] border border-amber-300 dark:border-amber-800/80 p-8 sm:p-12 shadow-sm text-center space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-700 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto shadow-sm">
                <AlertCircle className="w-9 h-9" />
              </div>
              <div className="max-w-md mx-auto space-y-2">
                <h3 className="text-lg font-extrabold text-[#172A45] dark:text-[#F5F7FC]">
                  Penugasan Rombel Belum Tersedia
                </h3>
                <p className="text-xs sm:text-sm text-[#66758A] dark:text-[#B4C1D4] leading-relaxed">
                  Akun Anda (<strong>{profile?.displayName}</strong>) belum memiliki penetapan rombongan belajar aktif dari Administrator Sekolah.
                </p>
                <div className="pt-2">
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 text-xs font-semibold border border-amber-200 dark:border-amber-800">
                    <ShieldAlert className="w-4 h-4 text-amber-600" />
                    <span>Silakan hubungi Administrator Sekolah atau Operator Kurikulum untuk menetapkan wali kelas/rombel binaan Anda.</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Kartu Rombel Binaan Guru (TIDAK ADA DROPDOWN KELAS LAIN) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {assignedClassesForGuru.map((cls) => {
                  const gradeNum = cls.grade || cls.name.replace(/\D/g, '') || '1';
                  const fase =
                    gradeNum === '1' || gradeNum === '2'
                      ? 'Fase A'
                      : gradeNum === '3' || gradeNum === '4'
                      ? 'Fase B'
                      : 'Fase C';

                  const isHomeroomOfThis = profile?.isHomeroom && profile?.homeroomClass === cls.name;
                  const countStudents = students.filter(
                    (s) => s.classId === cls.classId || s.className === cls.name
                  );
                  const countL = countStudents.filter((s) => s.gender === 'L').length;
                  const countP = countStudents.filter((s) => s.gender === 'P').length;

                  return (
                    <div
                      key={cls.classId}
                      className="rounded-3xl bg-white dark:bg-[#10223D] border-2 border-[#D9A62E]/50 dark:border-[#D9A62E]/40 p-6 shadow-md hover:shadow-lg transition-all space-y-5"
                    >
                      {/* Top Header Card */}
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2.5">
                            <h3 className="text-xl font-black text-[#102A50] dark:text-[#F5F7FC]">
                              {cls.name}
                            </h3>
                            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-[#102A50] text-[#FFD675] border border-[#D9A62E]/40 shadow-xs">
                              {fase}
                            </span>
                          </div>
                          <p className="text-xs text-[#66758A] dark:text-[#B4C1D4] mt-1 font-medium">
                            Tingkat Kelas {gradeNum} Sekolah Dasar • TA {cls.academicYear}
                          </p>
                        </div>

                        <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#102A50] to-[#0B1B33] text-[#FFD675] flex items-center justify-center font-black text-sm shrink-0 border border-[#D9A62E]/40 shadow-md">
                          SD
                        </div>
                      </div>

                      {/* Status Peran Guru Banner */}
                      <div className="p-3.5 rounded-2xl bg-amber-50/80 dark:bg-[#172D4B]/60 border border-[#D9A62E]/40 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-[#102A50] text-[#FFD675] flex items-center justify-center shrink-0">
                          {isHomeroomOfThis ? <Crown className="w-4 h-4 text-[#D9A62E]" /> : <GraduationCap className="w-4 h-4 text-[#D9A62E]" />}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-[#102A50] dark:text-[#FFD675]">
                            {isHomeroomOfThis ? 'Anda adalah Wali Kelas Resmi' : 'Guru Mata Pelajaran Pengampu'}
                          </p>
                          <p className="text-[11px] text-[#66758A] dark:text-[#B4C1D4] truncate">
                            {profile?.displayName} (NIP: {profile?.nip || '-'})
                          </p>
                        </div>
                      </div>

                      {/* Student Breakdown Metrics */}
                      <div className="grid grid-cols-3 gap-2.5 pt-1 text-center">
                        <div className="p-2.5 rounded-2xl bg-slate-50 dark:bg-[#071225]/60 border border-[#E0E5EC] dark:border-[#263B58]">
                          <span className="text-[10px] text-[#66758A] dark:text-[#B4C1D4] block font-semibold">Total Siswa</span>
                          <span className="text-base font-extrabold text-[#102A50] dark:text-[#F5F7FC]">{countStudents.length}</span>
                        </div>
                        <div className="p-2.5 rounded-2xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/40">
                          <span className="text-[10px] text-blue-700 dark:text-blue-300 block font-semibold">Laki-laki (L)</span>
                          <span className="text-base font-extrabold text-blue-700 dark:text-blue-300">{countL}</span>
                        </div>
                        <div className="p-2.5 rounded-2xl bg-pink-50/60 dark:bg-pink-950/30 border border-pink-200 dark:border-pink-900/40">
                          <span className="text-[10px] text-pink-700 dark:text-pink-300 block font-semibold">Perempuan (P)</span>
                          <span className="text-base font-extrabold text-pink-700 dark:text-pink-300">{countP}</span>
                        </div>
                      </div>

                      {/* Quick Navigation Shortcuts for this specific rombel */}
                      {onSelectTab && (
                        <div className="pt-2 border-t border-[#E0E5EC] dark:border-[#263B58] flex flex-wrap gap-1.5">
                          <button
                            onClick={() => onSelectTab('attendance')}
                            className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-[#172A45] dark:text-[#F5F7FC] text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                          >
                            <UserCheck className="w-3.5 h-3.5 text-[#D9A62E]" />
                            <span>Presensi</span>
                          </button>
                          <button
                            onClick={() => onSelectTab('assessments')}
                            className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-[#172A45] dark:text-[#F5F7FC] text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                          >
                            <CheckSquare className="w-3.5 h-3.5 text-[#D9A62E]" />
                            <span>Penilaian</span>
                          </button>
                          <button
                            onClick={() => onSelectTab('agendas')}
                            className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-[#172A45] dark:text-[#F5F7FC] text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                          >
                            <BookOpen className="w-3.5 h-3.5 text-[#D9A62E]" />
                            <span>Agenda</span>
                          </button>
                          <button
                            onClick={() => onSelectTab('guidance')}
                            className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-[#172A45] dark:text-[#F5F7FC] text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                          >
                            <HeartHandshake className="w-3.5 h-3.5 text-[#D9A62E]" />
                            <span>Bimbingan</span>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Roster Siswa Rombel Guru */}
              <div className="rounded-3xl bg-white dark:bg-[#10223D] border border-[#E0E5EC] dark:border-[#263B58] p-5 sm:p-6 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#E0E5EC] dark:border-[#263B58]">
                  <div>
                    <h4 className="text-base font-extrabold text-[#172A45] dark:text-[#F5F7FC] flex items-center gap-2">
                      <Users className="w-4 h-4 text-[#D9A62E]" />
                      <span>Daftar Siswa Terdaftar di Rombel Anda ({assignedClassesForGuru.map((c) => c.name).join(', ')})</span>
                    </h4>
                    <p className="text-xs text-[#66758A] dark:text-[#B4C1D4] mt-0.5">
                      Menampilkan seluruh siswa binaan resmi pada rombongan belajar ini.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleExportRoster}
                      className="px-3.5 py-1.5 rounded-xl border border-[#E0E5EC] dark:border-[#263B58] hover:bg-amber-50 dark:hover:bg-[#172D4B] text-[#172A45] dark:text-[#F5F7FC] text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Ekspor Excel</span>
                    </button>
                  </div>
                </div>

                {/* Search in Student Roster */}
                <div className="relative max-w-sm">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#66758A]" />
                  <input
                    type="text"
                    value={studentSearch}
                    onChange={(e) => setStudentSearch(e.target.value)}
                    placeholder="Cari nama, NIS, atau NISN siswa rombel..."
                    className="w-full pl-10 pr-4 py-2 rounded-xl text-xs bg-[#FAF9F5] dark:bg-[#071225] border border-[#E0E5EC] dark:border-[#263B58] text-[#172A45] dark:text-[#F5F7FC] focus:outline-none focus:ring-2 focus:ring-[#D9A62E]"
                  />
                </div>

                {/* Table of Roster Students */}
                {filteredRosterStudents.length === 0 ? (
                  <div className="py-12 text-center text-xs text-[#66758A] dark:text-[#B4C1D4]">
                    Belum ada data siswa terdaftar di rombel ini atau tidak cocok dengan pencarian.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-[#E0E5EC] dark:border-[#263B58] text-[#66758A] dark:text-[#B4C1D4] uppercase tracking-wider font-semibold">
                          <th className="pb-3 w-12 text-center">No</th>
                          <th className="pb-3">Nama Siswa</th>
                          <th className="pb-3">NIS / NISN</th>
                          <th className="pb-3">L/P</th>
                          <th className="pb-3">Rombel</th>
                          <th className="pb-3 text-center">Status</th>
                          <th className="pb-3 text-center">QR Code</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E0E5EC] dark:divide-[#263B58]">
                        {filteredRosterStudents.map((stu, i) => (
                          <tr key={stu.studentId} className="hover:bg-amber-50/40 dark:hover:bg-[#172D4B]/40 transition-colors">
                            <td className="py-3 text-center font-mono text-[#66758A]">{i + 1}</td>
                            <td className="py-3 font-bold text-[#172A45] dark:text-[#F5F7FC]">
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-lg bg-[#102A50] text-[#FFD675] flex items-center justify-center font-bold text-[10px] shrink-0">
                                  {stu.name.charAt(0)}
                                </div>
                                <span>{stu.name}</span>
                              </div>
                            </td>
                            <td className="py-3 font-mono text-[#66758A] dark:text-[#B4C1D4]">
                              {stu.nis} / {stu.nisn || '-'}
                            </td>
                            <td className="py-3">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  stu.gender === 'L'
                                    ? 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300'
                                    : 'bg-pink-100 dark:bg-pink-950 text-pink-700 dark:text-pink-300'
                                }`}
                              >
                                {stu.gender === 'L' ? 'Laki-laki' : 'Perempuan'}
                              </span>
                            </td>
                            <td className="py-3 font-semibold text-[#102A50] dark:text-[#FFD675]">
                              {stu.className || stu.classId}
                            </td>
                            <td className="py-3 text-center">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                                Aktif
                              </span>
                            </td>
                            <td className="py-3 text-center">
                              <button
                                onClick={() => setQrModalStudent(stu)}
                                className="p-1 rounded-lg text-[#66758A] hover:text-[#D9A62E] transition-colors cursor-pointer"
                                title="Lihat Barcode QR"
                              >
                                <QrCode className="w-4 h-4 mx-auto" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* 2. VIEW UNTUK AKUN ADMIN: KELOLA SELURUH ROMBEL KELAS 1 S/D 6  */}
      {/* ============================================================== */}
      {role === 'admin' && (
        <div className="space-y-6">
          {/* Admin Filter & Action Bar */}
          <div className="p-4 rounded-2xl bg-white dark:bg-[#10223D] border border-[#E0E5EC] dark:border-[#263B58] shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="text-[#66758A] dark:text-[#B4C1D4] font-semibold mr-1">Tingkat SD:</span>
              <button
                onClick={() => setAdminGradeFilter('all')}
                className={`px-3 py-1.5 rounded-xl font-bold cursor-pointer transition-all ${
                  adminGradeFilter === 'all'
                    ? 'bg-[#102A50] text-[#FFD675] shadow-xs border border-[#D9A62E]/40'
                    : 'bg-[#FAF9F5] dark:bg-[#071225] text-[#172A45] dark:text-[#B4C1D4] hover:bg-amber-50'
                }`}
              >
                Semua (Kelas 1 - 6)
              </button>
              <button
                onClick={() => setAdminGradeFilter('fase-a')}
                className={`px-3 py-1.5 rounded-xl font-medium cursor-pointer transition-all ${
                  adminGradeFilter === 'fase-a'
                    ? 'bg-[#102A50] text-[#FFD675] shadow-xs border border-[#D9A62E]/40'
                    : 'bg-[#FAF9F5] dark:bg-[#071225] text-[#172A45] dark:text-[#B4C1D4] hover:bg-amber-50'
                }`}
              >
                Fase A (Kls 1 & 2)
              </button>
              <button
                onClick={() => setAdminGradeFilter('fase-b')}
                className={`px-3 py-1.5 rounded-xl font-medium cursor-pointer transition-all ${
                  adminGradeFilter === 'fase-b'
                    ? 'bg-[#102A50] text-[#FFD675] shadow-xs border border-[#D9A62E]/40'
                    : 'bg-[#FAF9F5] dark:bg-[#071225] text-[#172A45] dark:text-[#B4C1D4] hover:bg-amber-50'
                }`}
              >
                Fase B (Kls 3 & 4)
              </button>
              <button
                onClick={() => setAdminGradeFilter('fase-c')}
                className={`px-3 py-1.5 rounded-xl font-medium cursor-pointer transition-all ${
                  adminGradeFilter === 'fase-c'
                    ? 'bg-[#102A50] text-[#FFD675] shadow-xs border border-[#D9A62E]/40'
                    : 'bg-[#FAF9F5] dark:bg-[#071225] text-[#172A45] dark:text-[#B4C1D4] hover:bg-amber-50'
                }`}
              >
                Fase C (Kls 5 & 6)
              </button>

              <div className="h-4 w-px bg-[#E0E5EC] dark:bg-[#263B58] mx-1 hidden sm:block" />

              {['1', '2', '3', '4', '5', '6'].map((g) => (
                <button
                  key={g}
                  onClick={() => setAdminGradeFilter(g as any)}
                  className={`px-2.5 py-1.5 rounded-xl font-bold cursor-pointer transition-all ${
                    adminGradeFilter === g
                      ? 'bg-[#D9A62E] text-[#071225] shadow-xs font-black'
                      : 'bg-slate-100 dark:bg-slate-800/60 text-[#66758A] dark:text-[#B4C1D4]'
                  }`}
                >
                  Kls {g}
                </button>
              ))}
            </div>

            <div className="relative min-w-[200px]">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#66758A]" />
              <input
                type="text"
                placeholder="Cari rombel..."
                value={adminSearch}
                onChange={(e) => setAdminSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 rounded-xl text-xs bg-[#FAF9F5] dark:bg-[#071225] border border-[#E0E5EC] dark:border-[#263B58] text-[#172A45] dark:text-[#F5F7FC] focus:outline-none focus:ring-1 focus:ring-[#D9A62E]"
              />
            </div>
          </div>

          {/* Grid Cards Rombel SD Kelas 1 s/d 6 */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {displayedClasses.map((cls) => {
              const gradeNum = cls.grade || cls.name.replace(/\D/g, '') || '1';
              const fase =
                gradeNum === '1' || gradeNum === '2'
                  ? 'Fase A'
                  : gradeNum === '3' || gradeNum === '4'
                  ? 'Fase B'
                  : 'Fase C';

              const homeroomTeacher = getHomeroomForClass(cls.name);
              const assignedTeachers = teachers.filter((t) =>
                (t.assignedClasses || []).includes(cls.name)
              );
              const countStudents = students.filter(
                (s) => s.classId === cls.classId || s.className === cls.name
              );

              return (
                <div
                  key={cls.classId}
                  className="rounded-3xl bg-white dark:bg-[#10223D] border border-[#E0E5EC] dark:border-[#263B58] p-5 shadow-xs flex flex-col justify-between gap-4 hover:border-[#D9A62E] transition-all"
                >
                  <div className="space-y-3">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-extrabold text-[#172A45] dark:text-[#F5F7FC]">
                            {cls.name}
                          </h3>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-[#102A50] text-[#FFD675] border border-[#D9A62E]/40">
                            {fase}
                          </span>
                        </div>
                        <p className="text-[11px] text-[#66758A] dark:text-[#B4C1D4] mt-0.5">
                          Tingkat Kelas {gradeNum} SD • TA {cls.academicYear}
                        </p>
                      </div>

                      <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold text-xs shrink-0 border border-amber-200 dark:border-amber-800">
                        SD
                      </div>
                    </div>

                    {/* Wali Kelas Box */}
                    <div className="p-3 rounded-2xl bg-amber-50/70 dark:bg-[#172D4B]/50 border border-amber-200/80 dark:border-amber-800/80">
                      <div className="flex items-center justify-between text-[11px] font-bold text-amber-900 dark:text-amber-200 mb-1">
                        <span className="flex items-center gap-1.5">
                          <Crown className="w-3.5 h-3.5 text-amber-600" />
                          Wali / Guru Kelas:
                        </span>
                      </div>
                      {homeroomTeacher ? (
                        <div className="flex items-center gap-2 mt-1">
                          <div className="w-6 h-6 rounded-lg bg-[#102A50] text-[#FFD675] font-bold text-[10px] flex items-center justify-center shrink-0">
                            {homeroomTeacher.displayName.charAt(0)}
                          </div>
                          <div className="truncate">
                            <p className="text-xs font-bold text-[#172A45] dark:text-[#F5F7FC] truncate">
                              {homeroomTeacher.displayName}
                            </p>
                            <p className="text-[10px] text-[#66758A] dark:text-[#B4C1D4]">
                              NIP: {homeroomTeacher.nip || '-'}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="text-[11px] text-amber-700 dark:text-amber-400 italic">
                          Belum ada Wali Kelas yang ditugaskan
                        </div>
                      )}
                    </div>

                    {/* Detail Rombel & Guru Mengajar */}
                    <div className="text-xs space-y-1.5">
                      <div className="flex items-center justify-between text-[#66758A] dark:text-[#B4C1D4]">
                        <span>Jumlah Siswa Aktif:</span>
                        <span className="font-bold text-[#102A50] dark:text-[#FFD675]">{countStudents.length} Siswa</span>
                      </div>
                      <div className="flex items-center justify-between text-[#66758A] dark:text-[#B4C1D4]">
                        <span>Guru Pengampu:</span>
                        <span className="font-semibold text-blue-600 dark:text-blue-400">{assignedTeachers.length} Guru</span>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons for Admin */}
                  <div className="pt-3 border-t border-[#E0E5EC] dark:border-[#263B58] flex items-center justify-between gap-2">
                    <button
                      onClick={() => {
                        setSelectedRosterClassId(cls.classId);
                        window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
                      }}
                      className="px-2.5 py-1.5 rounded-xl text-xs font-semibold text-[#172A45] dark:text-[#B4C1D4] hover:bg-amber-50 dark:hover:bg-[#172D4B] transition-colors cursor-pointer"
                    >
                      <span>Lihat Siswa</span>
                    </button>

                    <button
                      onClick={() => handleOpenAssignModal(cls)}
                      className="px-3.5 py-1.5 rounded-xl bg-[#102A50] hover:bg-[#0B1B33] text-[#FFD675] font-bold text-xs flex items-center gap-1.5 border border-[#D9A62E]/40 transition-all cursor-pointer shadow-xs"
                    >
                      <UserCog className="w-3.5 h-3.5 text-[#D9A62E]" />
                      <span>Atur Wali Kelas</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Roster Siswa Rombel yang Dipilih (Admin) */}
          {selectedRosterClassId && (
            <div className="rounded-3xl bg-white dark:bg-[#10223D] border border-[#E0E5EC] dark:border-[#263B58] p-5 sm:p-6 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#E0E5EC] dark:border-[#263B58]">
                <div>
                  <h4 className="text-base font-extrabold text-[#172A45] dark:text-[#F5F7FC] flex items-center gap-2">
                    <Users className="w-4 h-4 text-[#D9A62E]" />
                    <span>
                      Daftar Siswa {classes.find((c) => c.classId === selectedRosterClassId)?.name}
                    </span>
                  </h4>
                  <p className="text-xs text-[#66758A] dark:text-[#B4C1D4] mt-0.5">
                    Data siswa aktif yang terdaftar di rombongan belajar ini.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleExportRoster}
                    className="px-3.5 py-1.5 rounded-xl border border-[#E0E5EC] dark:border-[#263B58] hover:bg-amber-50 dark:hover:bg-[#172D4B] text-[#172A45] dark:text-[#F5F7FC] text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Ekspor Excel</span>
                  </button>
                </div>
              </div>

              {studentsInSelectedClass.length === 0 ? (
                <div className="py-10 text-center text-xs text-[#66758A] dark:text-[#B4C1D4]">
                  Belum ada siswa yang dimasukkan ke rombel ini.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-[#E0E5EC] dark:border-[#263B58] text-[#66758A] dark:text-[#B4C1D4] uppercase tracking-wider font-semibold">
                        <th className="pb-3 w-12 text-center">No</th>
                        <th className="pb-3">Nama Siswa</th>
                        <th className="pb-3">NIS / NISN</th>
                        <th className="pb-3">Jenis Kelamin</th>
                        <th className="pb-3">Status</th>
                        <th className="pb-3 text-center">QR Code</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E0E5EC] dark:divide-[#263B58]">
                      {studentsInSelectedClass.map((stu, i) => (
                        <tr key={stu.studentId} className="hover:bg-amber-50/40 dark:hover:bg-[#172D4B]/40 transition-colors">
                          <td className="py-3 text-center font-mono text-[#66758A]">{i + 1}</td>
                          <td className="py-3 font-bold text-[#172A45] dark:text-[#F5F7FC]">
                            {stu.name}
                          </td>
                          <td className="py-3 font-mono text-[#66758A] dark:text-[#B4C1D4]">
                            {stu.nis} / {stu.nisn || '-'}
                          </td>
                          <td className="py-3">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                stu.gender === 'L'
                                  ? 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300'
                                  : 'bg-pink-100 dark:bg-pink-950 text-pink-700 dark:text-pink-300'
                              }`}
                            >
                              {stu.gender === 'L' ? 'Laki-laki' : 'Perempuan'}
                            </span>
                          </td>
                          <td className="py-3">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                              Aktif
                            </span>
                          </td>
                          <td className="py-3 text-center">
                            <button
                              onClick={() => setQrModalStudent(stu)}
                              className="p-1 rounded-lg text-[#66758A] hover:text-[#D9A62E] transition-colors cursor-pointer"
                              title="Lihat Barcode QR"
                            >
                              <QrCode className="w-4 h-4 mx-auto" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: ADMIN TETAPKAN / UBAH WALI KELAS & GURU PENGAMPU        */}
      {/* ============================================================== */}
      <Modal
        isOpen={isAssignModalOpen}
        onClose={() => setIsAssignModalOpen(false)}
        title={`Atur Penugasan Rombel • ${classToAssign?.name || ''}`}
        subtitle="Tetapkan Wali Kelas resmi dan guru pengampu mata pelajaran yang bertugas di rombel ini."
        maxWidth="lg"
      >
        <div className="space-y-5">
          {/* Info Card Rombel Target */}
          <div className="p-3.5 rounded-2xl bg-[#102A50]/10 dark:bg-[#172D4B]/60 border border-[#D9A62E]/30 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-[#102A50] dark:text-[#FFD675]">
                Rombongan Belajar: {classToAssign?.name}
              </p>
              <p className="text-[11px] text-[#66758A] dark:text-[#B4C1D4]">
                Tingkat Kelas {classToAssign?.grade} SD • Tahun Ajaran {classToAssign?.academicYear}
              </p>
            </div>
            <span className="px-2.5 py-1 rounded-xl bg-[#102A50] text-[#FFD675] font-black text-xs">
              SD
            </span>
          </div>

          {/* 1. Pilih Wali Kelas Utama */}
          <div>
            <label className="block text-xs font-bold text-[#172A45] dark:text-[#F5F7FC] mb-1.5 flex items-center gap-1.5">
              <Crown className="w-4 h-4 text-amber-500" />
              <span>Pilih Wali Kelas (Guru Kelas):</span>
            </label>
            <select
              value={selectedHomeroomUid}
              onChange={(e) => {
                const uid = e.target.value;
                setSelectedHomeroomUid(uid);
                if (uid && !selectedTeacherUids.includes(uid)) {
                  setSelectedTeacherUids([...selectedTeacherUids, uid]);
                }
              }}
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#E0E5EC] dark:border-[#263B58] bg-white dark:bg-[#071225] text-[#172A45] dark:text-[#F5F7FC] text-xs sm:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#D9A62E]"
            >
              <option value="">-- Belum Ditugaskan / Kosongkan --</option>
              {teachers.map((t) => (
                <option key={t.uid} value={t.uid}>
                  {t.displayName} (NIP: {t.nip || '-'}) {t.isHomeroom && t.homeroomClass ? `[Wali ${t.homeroomClass}]` : ''}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-[#66758A] dark:text-[#B4C1D4] mt-1">
              Guru yang dipilih sebagai wali kelas akan otomatis memiliki akses eksklusif ke rombel ini.
            </p>
          </div>

          {/* 2. Pilih Guru Pengampu Lainnya di Rombel ini */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-[#172A45] dark:text-[#F5F7FC] flex items-center gap-1.5">
                <Users className="w-4 h-4 text-[#D9A62E]" />
                <span>Guru yang Mengajar di Rombel {classToAssign?.name}:</span>
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedTeacherUids(teachers.map((t) => t.uid))}
                  className="text-[10px] text-[#D9A62E] hover:underline font-bold"
                >
                  Pilih Semua
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedTeacherUids(selectedHomeroomUid ? [selectedHomeroomUid] : [])}
                  className="text-[10px] text-rose-500 hover:underline font-bold"
                >
                  Reset
                </button>
              </div>
            </div>

            <div className="max-h-48 overflow-y-auto divide-y divide-[#E0E5EC] dark:divide-[#263B58] border border-[#E0E5EC] dark:border-[#263B58] rounded-2xl p-2 bg-[#FAF9F5] dark:bg-[#071225]">
              {teachers.map((t) => {
                const isChecked = selectedTeacherUids.includes(t.uid);
                const isHomeroomThis = t.uid === selectedHomeroomUid;

                return (
                  <label
                    key={t.uid}
                    className="flex items-center justify-between p-2 hover:bg-amber-50/60 dark:hover:bg-[#10223D]/60 rounded-xl cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {
                          if (isChecked) {
                            setSelectedTeacherUids(selectedTeacherUids.filter((u) => u !== t.uid));
                            if (isHomeroomThis) setSelectedHomeroomUid('');
                          } else {
                            setSelectedTeacherUids([...selectedTeacherUids, t.uid]);
                          }
                        }}
                        className="w-4 h-4 rounded text-[#102A50] focus:ring-[#D9A62E] border-[#E0E5EC]"
                      />
                      <div className="truncate">
                        <span className="text-xs font-bold text-[#172A45] dark:text-[#F5F7FC] block truncate">
                          {t.displayName}
                        </span>
                        <span className="text-[10px] text-[#66758A] dark:text-[#B4C1D4]">
                          @{t.username} • NIP: {t.nip || '-'}
                        </span>
                      </div>
                    </div>

                    {isHomeroomThis && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 shrink-0">
                        Wali Kelas
                      </span>
                    )}
                  </label>
                );
              })}
            </div>
          </div>

          {/* Modal Action Buttons */}
          <div className="pt-3 border-t border-[#E0E5EC] dark:border-[#263B58] flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={() => setIsAssignModalOpen(false)}
              className="px-4 py-2.5 rounded-xl border border-[#E0E5EC] dark:border-[#263B58] text-xs font-semibold text-[#172A45] dark:text-[#F5F7FC] hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              Batal
            </button>
            <button
              type="button"
              disabled={savingAssignment}
              onClick={handleSaveAssignment}
              className="px-5 py-2.5 rounded-xl bg-[#102A50] hover:bg-[#0B1B33] text-[#FFD675] text-xs font-bold flex items-center gap-2 shadow-md border border-[#D9A62E]/40 cursor-pointer disabled:opacity-50"
            >
              {savingAssignment && (
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              )}
              <span>Simpan Penugasan Rombel</span>
            </button>
          </div>
        </div>
      </Modal>

      {/* QR Code Single Modal */}
      <Modal
        isOpen={Boolean(qrModalStudent)}
        onClose={() => setQrModalStudent(null)}
        title="Kartu QR Siswa"
        subtitle="ID Kode Presensi Digital Siswa"
        maxWidth="sm"
      >
        {qrModalStudent && (
          <div className="flex flex-col items-center text-center p-3">
            <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-inner mb-3">
              <QRCodeSVG value={qrModalStudent.studentId} size={160} level="M" includeMargin />
            </div>
            <h4 className="text-base font-bold text-[#172A45] dark:text-[#F5F7FC]">
              {qrModalStudent.name}
            </h4>
            <p className="text-xs text-[#66758A] dark:text-[#B4C1D4] mt-0.5">
              NIS: {qrModalStudent.nis} • Kelas: {qrModalStudent.className}
            </p>
            <p className="font-mono text-[11px] text-[#102A50] dark:text-[#FFD675] bg-amber-50 dark:bg-amber-950/60 px-3 py-1 rounded-xl mt-3 border border-[#D9A62E]/30">
              ID: {qrModalStudent.studentId}
            </p>
          </div>
        )}
      </Modal>
    </div>
  );
};
