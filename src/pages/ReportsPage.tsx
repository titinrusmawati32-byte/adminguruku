import {
  BookOpen,
  Calendar,
  CheckSquare,
  ClipboardList,
  Download,
  FileSpreadsheet,
  FileText,
  Filter,
  HeartHandshake,
  Printer,
  Search,
  UserCheck,
  Users,
} from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { EmptyState } from '../components/common/EmptyState';
import { TableSkeleton } from '../components/common/Skeleton';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { agendaService } from '../services/agendaService';
import { assessmentService } from '../services/assessmentService';
import { attendanceService } from '../services/attendanceService';
import { authorizationService } from '../services/authorizationService';
import { classService, groupClassesBySDGrade } from '../services/classService';
import { guidanceService } from '../services/guidanceService';
import { reportService } from '../services/reportService';
import { studentService } from '../services/studentService';
import { subjectService } from '../services/subjectService';
import {
  Assessment,
  AttendanceRecord,
  Guidance,
  SchoolClass,
  Student,
  Subject,
  TeachingAgenda,
} from '../types';

type ReportSubmenu =
  | 'students'
  | 'attendance'
  | 'assessments'
  | 'agendas'
  | 'guidance';

export const ReportsPage: React.FC = () => {
  const { profile } = useAuth();
  const { showToast } = useNotification();

  const [activeSubmenu, setActiveSubmenu] = useState<ReportSubmenu>('attendance');

  // Master Data
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [agendas, setAgendas] = useState<TeachingAgenda[]>([]);
  const [guidanceList, setGuidanceList] = useState<Guidance[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtered classes strictly based on official role & assignments
  const permittedClasses = useMemo(() => {
    if (profile?.role === 'admin') return classes;
    return authorizationService.filterClassesForUser(classes, profile);
  }, [classes, profile]);

  const groupedSDClasses = useMemo(() => {
    return groupClassesBySDGrade(classes);
  }, [classes]);

  // Filters
  const [filterClass, setFilterClass] = useState<string>('all');
  const [filterSubject, setFilterSubject] = useState<string>('all');
  const [filterMonth, setFilterMonth] = useState<string>('');

  const loadAll = async () => {
    setLoading(true);
    try {
      const [cls, sub, stu, att, ass, age, gui] = await Promise.all([
        classService.getAll(),
        subjectService.getAll(),
        studentService.getAll(profile),
        attendanceService.getAll(),
        assessmentService.getAll(profile),
        agendaService.getAll(profile),
        guidanceService.getAll(profile),
      ]);
      setClasses(cls);
      setSubjects(sub);
      setStudents(stu);
      setAttendance(att);
      setAssessments(ass);
      setAgendas(age);
      setGuidanceList(gui);

      const permitted = profile?.role === 'admin' ? cls : authorizationService.filterClassesForUser(cls, profile);
      if (profile?.role === 'guru') {
        if (permitted.length === 1) {
          setFilterClass(permitted[0].classId);
        } else if (filterClass !== 'all' && !permitted.some((c) => c.classId === filterClass)) {
          setFilterClass(permitted[0]?.classId || 'all');
        }
      }
    } catch (e: any) {
      showToast('Gagal memuat data laporan: ' + e.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, [profile?.uid, profile?.role]);

  const submenus = [
    { id: 'students' as ReportSubmenu, label: 'Rekap Siswa', icon: Users },
    { id: 'attendance' as ReportSubmenu, label: 'Rekap Absensi', icon: UserCheck },
    { id: 'assessments' as ReportSubmenu, label: 'Rekap Penilaian', icon: CheckSquare },
    { id: 'agendas' as ReportSubmenu, label: 'Rekap Agenda Mengajar', icon: ClipboardList },
    { id: 'guidance' as ReportSubmenu, label: 'Rekap Bimbingan', icon: HeartHandshake },
  ];

  // Selected Class and Subject Name for headers
  const selectedClassName =
    filterClass === 'all'
      ? 'Semua Kelas'
      : classes.find((c) => c.classId === filterClass)?.name || filterClass;
  const selectedSubjectName =
    filterSubject === 'all'
      ? 'Semua Mapel'
      : subjects.find((s) => s.subjectId === filterSubject)?.name || filterSubject;

  // Build Table Data depending on activeSubmenu
  const reportTableData = useMemo(() => {
    if (activeSubmenu === 'students') {
      const filtered = students.filter(
        (s) => filterClass === 'all' || s.classId === filterClass
      );
      const headers = ['No', 'NIS', 'NISN', 'Nama Siswa', 'JK', 'Kelas', 'Status'];
      const rows = filtered.map((s, idx) => [
        idx + 1,
        s.nis,
        s.nisn || '-',
        s.name,
        s.gender === 'L' ? 'Laki-laki' : 'Perempuan',
        s.className || s.classId,
        s.status === 'active' ? 'Aktif' : 'Non-Aktif',
      ]);
      return { title: 'Laporan Rekapitulasi Data Siswa', headers, rows, count: filtered.length, orientation: 'portrait' as const };
    }

    if (activeSubmenu === 'attendance') {
      const filtered = attendance.filter((a) => {
        const matchClass = filterClass === 'all' || a.classId === filterClass;
        const matchSub = filterSubject === 'all' || a.subjectId === filterSubject;
        const matchMonth = !filterMonth || a.date.startsWith(filterMonth);
        return matchClass && matchSub && matchMonth;
      });

      const headers = ['No', 'Tanggal', 'Nama Siswa', 'NIS', 'Kelas', 'Mapel', 'Status', 'Catatan'];
      const rows = filtered.map((a, idx) => [
        idx + 1,
        a.date,
        a.studentName || '-',
        a.nis || '-',
        a.className || a.classId,
        a.subjectName || 'Harian',
        a.status,
        a.notes || '-',
      ]);
      return { title: 'Laporan Rekapitulasi Presensi Siswa', headers, rows, count: filtered.length, orientation: 'landscape' as const };
    }

    if (activeSubmenu === 'assessments') {
      const filtered = assessments.filter((ass) => {
        const matchClass = filterClass === 'all' || ass.classId === filterClass;
        const matchSub = filterSubject === 'all' || ass.subjectId === filterSubject;
        return matchClass && matchSub;
      });

      // Flatten each assessment student score
      const headers = ['No', 'Tanggal', 'Judul Asesmen', 'Tipe', 'Kelas', 'Mapel', 'Siswa', 'Nilai', 'Catatan'];
      const rows: any[][] = [];
      let rowIdx = 1;
      filtered.forEach((ass) => {
        ass.scores?.forEach((sc) => {
          rows.push([
            rowIdx++,
            ass.date,
            ass.title,
            ass.type.toUpperCase(),
            ass.className,
            ass.subjectName,
            sc.studentName || '-',
            sc.score,
            sc.notes || '-',
          ]);
        });
      });
      return { title: 'Laporan Rekapitulasi Penilaian Hasil Belajar', headers, rows, count: rows.length, orientation: 'landscape' as const };
    }

    if (activeSubmenu === 'agendas') {
      const filtered = agendas.filter((ag) => {
        const matchClass = filterClass === 'all' || ag.classId === filterClass;
        const matchSub = filterSubject === 'all' || ag.subjectId === filterSubject;
        return matchClass && matchSub;
      });
      const headers = ['No', 'Tanggal', 'Kelas', 'Mata Pelajaran', 'Topik / Materi Pokok', 'Tujuan Pembelajaran', 'Kehadiran'];
      const rows = filtered.map((ag, idx) => [
        idx + 1,
        ag.date,
        ag.className,
        ag.subjectName,
        ag.topic,
        ag.learningObjective || '-',
        ag.attendanceSummary || '-',
      ]);
      return { title: 'Laporan Jurnal Agenda Harian Mengajar', headers, rows, count: filtered.length, orientation: 'landscape' as const };
    }

    // Guidance
    const filtered = guidanceList.filter((g) => {
      const matchSearch = true;
      return matchSearch;
    });
    const headers = ['No', 'Tanggal', 'Nama Siswa', 'Kelas', 'Kategori', 'Uraian Masalah', 'Tindakan Penanganan', 'Status'];
    const rows = filtered.map((g, idx) => [
      idx + 1,
      g.date,
      g.studentName || '-',
      g.className || '-',
      g.category,
      g.problem,
      g.action,
      g.status === 'resolved' ? 'Tuntas' : 'Dalam Proses',
    ]);
    return { title: 'Laporan Rekapitulasi Bimbingan & Konseling Guru Wali', headers, rows, count: filtered.length, orientation: 'landscape' as const };
  }, [
    activeSubmenu,
    students,
    attendance,
    assessments,
    agendas,
    guidanceList,
    filterClass,
    filterSubject,
    filterMonth,
  ]);

  const handleExportPDF = () => {
    if (reportTableData.rows.length === 0) {
      showToast('Tidak ada data yang dapat diekspor.', 'warning');
      return;
    }
    reportService.exportToPDF(reportTableData.headers, reportTableData.rows, {
      title: reportTableData.title,
      schoolName: 'SD NEGERI HARAPAN BANGSA',
      teacherName: profile?.displayName || 'Guru Pengampu / Wali Kelas',
      className: selectedClassName,
      subjectName: selectedSubjectName,
      academicYear: '2024/2025',
      semester: 'Ganjil',
      orientation: reportTableData.orientation,
    });
    showToast('File laporan PDF berhasil diunduh.', 'success');
  };

  const handleExportExcel = () => {
    if (reportTableData.rows.length === 0) {
      showToast('Tidak ada data yang dapat diekspor.', 'warning');
      return;
    }
    reportService.exportToExcel(reportTableData.headers, reportTableData.rows, {
      title: reportTableData.title,
      schoolName: 'SD NEGERI HARAPAN BANGSA',
      teacherName: profile?.displayName || 'Guru Pengampu / Wali Kelas',
      className: selectedClassName,
      subjectName: selectedSubjectName,
      academicYear: '2024/2025',
      semester: 'Ganjil',
    });
    showToast('File laporan Excel (.xlsx) berhasil diunduh.', 'success');
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Submenu Pill Tabs */}
      <div className="flex flex-wrap items-center gap-2 p-1.5 rounded-2xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60 print:hidden">
        {submenus.map((item) => {
          const Icon = item.icon;
          const isActive = activeSubmenu === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveSubmenu(item.id)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
                isActive
                  ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* Filter and Export Action Bar */}
      <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
            <Filter className="w-3.5 h-3.5" />
            <span>Filter Laporan:</span>
          </div>

          {profile?.role === 'guru' && permittedClasses.length === 0 ? (
            <div className="px-3 py-1.5 rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 text-xs font-semibold">
              Penugasan Belum Tersedia
            </div>
          ) : profile?.role === 'guru' && permittedClasses.length === 1 ? (
            <div className="px-3 py-1.5 rounded-xl border border-[#D9A62E]/50 bg-amber-50/70 dark:bg-[#172D4B]/70 text-[#102A50] dark:text-[#FFD675] font-bold text-xs flex items-center gap-2 shadow-xs">
              <span>Rombel: {permittedClasses[0].name}</span>
              <span className="text-[10px] uppercase px-1.5 py-0.5 rounded-full bg-[#102A50] text-[#FFD675] font-black">
                Terkunci
              </span>
            </div>
          ) : profile?.role === 'guru' ? (
            <select
              value={filterClass}
              onChange={(e) => setFilterClass(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-800 dark:text-slate-200"
            >
              {permittedClasses.map((c) => (
                <option key={c.classId} value={c.classId}>
                  {c.name}
                </option>
              ))}
            </select>
          ) : (
            <select
              value={filterClass}
              onChange={(e) => setFilterClass(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-800 dark:text-slate-200"
            >
              <option value="all">Semua Rombel (Kelas 1 - 6 SD)</option>
              {groupedSDClasses.map((group) => (
                <optgroup key={group.grade} label={`${group.label} (${group.fase})`}>
                  {group.classes.map((c) => (
                    <option key={c.classId} value={c.classId}>
                      {c.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          )}

          {activeSubmenu !== 'students' && (
            <select
              value={filterSubject}
              onChange={(e) => setFilterSubject(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-800 dark:text-slate-200"
            >
              <option value="all">Semua Mapel</option>
              {subjects.map((s) => (
                <option key={s.subjectId} value={s.subjectId}>
                  {s.name}
                </option>
              ))}
            </select>
          )}

          {activeSubmenu === 'attendance' && (
            <input
              type="month"
              value={filterMonth}
              onChange={(e) => setFilterMonth(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-800 dark:text-slate-200"
            />
          )}
        </div>

        {/* Export Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportPDF}
            className="px-3.5 py-2 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 hover:bg-rose-100 text-xs font-semibold border border-rose-200 dark:border-rose-900/50 flex items-center gap-1.5 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export PDF</span>
          </button>

          <button
            onClick={handleExportExcel}
            className="px-3.5 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 text-xs font-semibold border border-emerald-200 dark:border-emerald-900/50 flex items-center gap-1.5 transition-colors"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Export Excel</span>
          </button>

          <button
            onClick={handlePrint}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
          >
            <Printer className="w-4 h-4" />
            <span>Cetak</span>
          </button>
        </div>
      </div>

      {/* Live Preview Paper */}
      <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm p-6 sm:p-8 space-y-6">
        {/* Kop Surat Header */}
        <div className="text-center pb-4 border-b-2 border-slate-300 dark:border-slate-700 space-y-1">
          <h2 className="text-base sm:text-lg font-extrabold uppercase tracking-wide text-slate-900 dark:text-white">
            SD NEGERI HARAPAN BANGSA
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            SISTEM INFORMASI ADMINISTRASI AKADEMIK GURU TERPADU
          </p>
          <div className="text-sm font-bold text-blue-600 dark:text-blue-400 pt-2 uppercase">
            {reportTableData.title}
          </div>
          <p className="text-xs text-slate-400">
            Tahun Ajaran 2024/2025 • Semester Ganjil • Kelas: {selectedClassName}
          </p>
        </div>

        {/* Table Content */}
        {loading ? (
          <div className="py-6">
            <TableSkeleton rows={5} />
          </div>
        ) : reportTableData.rows.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="Tidak Ada Data Laporan"
            description="Tidak ditemukan entri sesuai parameter filter kelas atau periode yang dipilih."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 bg-blue-50/60 dark:bg-blue-950/40 text-[11px] font-bold text-slate-700 dark:text-slate-300">
                  {reportTableData.headers.map((h, i) => (
                    <th key={i} className="py-2.5 px-3">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                {reportTableData.rows.map((row, rIdx) => (
                  <tr key={rIdx} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30">
                    {row.map((cell: any, cIdx: number) => (
                      <td key={cIdx} className="py-2.5 px-3">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Signature Area */}
        <div className="pt-8 flex justify-end text-xs text-slate-700 dark:text-slate-300">
          <div className="w-64 text-center space-y-1">
            <p>
              Mengetahui,
            </p>
            <p className="font-semibold">Guru Pengampu / Wali Kelas</p>
            <div className="h-16" />
            <p className="font-bold underline">
              {profile?.displayName || 'Bapak/Ibu Guru'}
            </p>
            <p className="text-[11px] text-slate-400">NIP. 19850312 201001 1 015</p>
          </div>
        </div>
      </div>
    </div>
  );
};
