import {
  AlertCircle,
  Calendar,
  Camera,
  Check,
  CheckCheck,
  CheckCircle,
  FileSpreadsheet,
  Filter,
  GraduationCap,
  Layers,
  Printer,
  QrCode,
  RefreshCw,
  Save,
  Search,
  Sparkles,
  Table,
  UserCheck,
  Users,
} from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { AttendanceRealtimeFeed } from '../components/attendance/AttendanceRealtimeFeed';
import { QrScannerView } from '../components/attendance/QrScannerView';
import { EmptyState } from '../components/common/EmptyState';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { attendanceService } from '../services/attendanceService';
import { auditService } from '../services/auditService';
import { classService, groupClassesBySDGrade } from '../services/classService';
import { scheduleService } from '../services/scheduleService';
import { studentService } from '../services/studentService';
import {
  AttendanceRecord,
  AttendanceStatus,
  Schedule,
  SchoolClass,
  Student,
} from '../types';
import { authorizationService } from '../services/authorizationService';

export const AttendancePage: React.FC = () => {
  const { profile, role } = useAuth();
  const { showToast } = useNotification();

  // Primary data states
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [existingRecords, setExistingRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Available classes restricted by role and official assignment
  const availableClasses = useMemo(() => {
    if (role === 'admin') return classes;
    return authorizationService.filterClassesForUser(classes, profile);
  }, [classes, role, profile]);

  const groupedSDClasses = useMemo(() => {
    return groupClassesBySDGrade(availableClasses);
  }, [availableClasses]);
  const [saving, setSaving] = useState(false);

  // View Mode: For Admin, always table/monitoring. For Guru, 'scanner' as primary or 'table'
  const [viewMode, setViewMode] = useState<'scanner' | 'table'>(role === 'admin' ? 'table' : 'scanner');

  // If role is admin, force viewMode to table
  useEffect(() => {
    if (role === 'admin') {
      setViewMode('table');
    }
  }, [role]);

  // Session Selections
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedScheduleId, setSelectedScheduleId] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );

  // In-memory Table Attendance State: studentId -> { status, notes, method }
  const [attendanceMap, setAttendanceMap] = useState<
    Record<string, { status: AttendanceStatus; notes: string; method: 'manual' | 'qr' }>
  >({});

  // Search filter for table view
  const [tableSearch, setTableSearch] = useState('');

  // 1. Initial Load: Classes and Schedules
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        const [cls, sch] = await Promise.all([
          classService.getAll(),
          scheduleService.getAll(),
        ]);
        setClasses(cls);
        setSchedules(sch);

        const permitted = role === 'admin' ? cls : authorizationService.filterClassesForUser(cls, profile);

        // Check if there is an active teaching schedule set from Dashboard "Mulai Mengajar"
        const storedSchedule = sessionStorage.getItem('active_teaching_schedule');
        if (storedSchedule) {
          try {
            const schObj = JSON.parse(storedSchedule);
            if (permitted.some((c) => c.classId === schObj.classId)) {
              setSelectedClassId(schObj.classId);
              setSelectedScheduleId(schObj.scheduleId);
            } else if (permitted.length > 0) {
              setSelectedClassId(permitted[0].classId);
            }
            sessionStorage.removeItem('active_teaching_schedule');
          } catch {}
        } else if (permitted.length > 0) {
          setSelectedClassId(permitted[0].classId);
        }
      } catch (err: any) {
        showToast('Gagal memuat jadwal & rombel: ' + err.message, 'error');
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [profile?.uid, role]);

  // Keep selectedClassId valid when availableClasses changes
  useEffect(() => {
    if (availableClasses.length > 0) {
      if (!availableClasses.some((c) => c.classId === selectedClassId)) {
        setSelectedClassId(availableClasses[0].classId);
      }
    } else {
      setSelectedClassId('');
    }
  }, [availableClasses, selectedClassId]);

  // 2. Load Students for selected class with authorization validation
  useEffect(() => {
    if (!selectedClassId) {
      setStudents([]);
      return;
    }

    const loadStudents = async () => {
      try {
        const stuList = await studentService.getByClassId(selectedClassId, profile);
        setStudents(stuList);
      } catch (err: any) {
        console.error('Error loading students:', err);
        setStudents([]);
      }
    };
    loadStudents();
  }, [selectedClassId, profile]);


  // 3. Realtime Firestore Subscription for Attendance Records
  useEffect(() => {
    if (!selectedClassId || !selectedDate) return;

    const currentSchedule = schedules.find((s) => s.scheduleId === selectedScheduleId);

    // Subscribe to realtime changes in Firestore
    const unsubscribe = attendanceService.subscribeByDateAndClass(
      selectedDate,
      selectedClassId,
      (records) => {
        setExistingRecords(records);

        // Sync with attendanceMap
        setAttendanceMap((prev) => {
          const next = { ...prev };
          records.forEach((rec) => {
            next[rec.studentId] = {
              status: rec.status,
              notes: rec.notes || '',
              method: rec.method || 'manual',
            };
          });
          return next;
        });
      },
      currentSchedule?.subjectId
    );

    return () => {
      unsubscribe();
    };
  }, [selectedClassId, selectedDate, selectedScheduleId, schedules]);

  // Active Objects Helpers
  const currentClass = useMemo(() => {
    return classes.find((c) => c.classId === selectedClassId);
  }, [classes, selectedClassId]);

  const currentSchedule = useMemo(() => {
    return schedules.find((s) => s.scheduleId === selectedScheduleId);
  }, [schedules, selectedScheduleId]);

  // Handle Scan QR Success Callback
  const handleRecordSuccess = async (student: Student, scanTime: string) => {
    const docId = `${selectedDate}_${selectedClassId}_${student.studentId}_${currentSchedule?.subjectId || 'general'}`;

    await attendanceService.recordScan({
      scheduleId: selectedScheduleId || undefined,
      classId: selectedClassId,
      className: currentClass?.name || selectedClassId,
      subjectId: currentSchedule?.subjectId,
      subjectName: currentSchedule?.subjectName,
      teacherId: profile?.teacherId || profile?.uid || 'GURU-001',
      date: selectedDate,
      studentId: student.studentId,
      studentName: student.name,
      nis: student.nis,
      status: 'Hadir',
      notes: `Scan QR Presensi Mandiri (${scanTime})`,
      method: 'qr',
    });

    await auditService.log(
      'Scan Presensi QR',
      'attendance',
      docId,
      `Presensi QR berhasil untuk ${student.name} (${student.nis}) di kelas ${currentClass?.name}`
    );

    showToast(`Presensi berhasil: ${student.name} (Hadir)`, 'success');
  };

  // Handle Quick Status Change in Realtime Feed
  const handleQuickStatusChange = async (studentId: string, status: AttendanceStatus, notes?: string) => {
    try {
      const stu = students.find((s) => s.studentId === studentId);
      const docId = `${selectedDate}_${selectedClassId}_${studentId}_${currentSchedule?.subjectId || 'general'}`;

      await attendanceService.saveBatch([
        {
          attendanceId: docId,
          scheduleId: selectedScheduleId || undefined,
          classId: selectedClassId,
          className: currentClass?.name || selectedClassId,
          subjectId: currentSchedule?.subjectId,
          subjectName: currentSchedule?.subjectName,
          teacherId: profile?.teacherId || profile?.uid || 'GURU-001',
          date: selectedDate,
          studentId,
          studentName: stu?.name,
          nis: stu?.nis,
          status,
          notes: notes || `Diperbarui guru pada ${new Date().toLocaleTimeString('id-ID')}`,
          method: 'manual',
        },
      ]);

      showToast(`Status ${stu?.name || 'siswa'} diubah menjadi ${status}`, 'info');
    } catch (err: any) {
      showToast('Gagal mengubah status: ' + err.message, 'error');
    }
  };

  // Handle Mark Student Present from "Belum Presensi" list
  const handleMarkStudentPresent = async (student: Student) => {
    const currentTime = new Date().toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    await handleRecordSuccess(student, currentTime);
  };

  // Table View status update
  const handleStatusChangeInTable = (studentId: string, status: AttendanceStatus) => {
    setAttendanceMap((prev) => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        status,
      },
    }));
  };

  const handleNotesChangeInTable = (studentId: string, notes: string) => {
    setAttendanceMap((prev) => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        notes,
      },
    }));
  };

  const handleMarkAllHadirInTable = () => {
    setAttendanceMap((prev) => {
      const next = { ...prev };
      students.forEach((s) => {
        next[s.studentId] = {
          status: 'Hadir',
          notes: next[s.studentId]?.notes || '',
          method: next[s.studentId]?.method || 'manual',
        };
      });
      return next;
    });
    showToast('Seluruh siswa ditandai Hadir.', 'info');
  };

  // Save all from Table View
  const handleSaveAllFromTable = async () => {
    if (students.length === 0) {
      showToast('Tidak ada siswa di kelas ini.', 'warning');
      return;
    }

    setSaving(true);
    try {
      const recordsToSave: Omit<AttendanceRecord, 'createdAt' | 'updatedAt'>[] = students.map(
        (s) => {
          const item = attendanceMap[s.studentId] || { status: 'Hadir', notes: '', method: 'manual' };
          return {
            attendanceId: `${selectedDate}_${selectedClassId}_${s.studentId}_${currentSchedule?.subjectId || 'general'}`,
            scheduleId: selectedScheduleId || undefined,
            classId: selectedClassId,
            className: currentClass?.name || selectedClassId,
            subjectId: currentSchedule?.subjectId,
            subjectName: currentSchedule?.subjectName,
            teacherId: profile?.teacherId || profile?.uid || 'GURU-001',
            date: selectedDate,
            studentId: s.studentId,
            studentName: s.name,
            nis: s.nis,
            status: item.status,
            notes: item.notes,
            method: item.method,
          };
        }
      );

      await attendanceService.saveBatch(recordsToSave);
      await auditService.log(
        'Simpan Presensi Kelas',
        'attendance',
        `${selectedDate}_${selectedClassId}`,
        `Menyimpan presensi ${students.length} siswa rombel ${currentClass?.name}`
      );

      showToast(`Presensi ${students.length} siswa berhasil disimpan ke Firestore!`, 'success');
    } catch (err: any) {
      showToast('Gagal menyimpan presensi: ' + err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  // Filtered Students for Table
  const filteredStudentsForTable = useMemo(() => {
    if (!tableSearch.trim()) return students;
    const q = tableSearch.toLowerCase();
    return students.filter(
      (s) => s.name.toLowerCase().includes(q) || s.nis.includes(q)
    );
  }, [students, tableSearch]);

  // Overall Counts
  const counts = useMemo(() => {
    let h = 0;
    let s = 0;
    let i = 0;
    let a = 0;
    existingRecords.forEach((rec) => {
      if (rec.status === 'Hadir') h++;
      else if (rec.status === 'Sakit') s++;
      else if (rec.status === 'Izin') i++;
      else if (rec.status === 'Alpa') a++;
    });
    return { h, s, i, a, total: students.length, attended: existingRecords.length };
  }, [students, existingRecords]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Session Selector Strip */}
      <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 flex-1">
          {/* Tanggal */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
              Tanggal Presensi
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Rombel / Kelas */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
              Rombel / Kelas {role === 'guru' ? 'Binaan Anda' : '(SD Kelas 1 - 6)'}
            </label>
            {role === 'guru' && availableClasses.length === 0 ? (
              <div className="px-3 py-2 rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 text-xs font-semibold flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 text-amber-600" />
                <span className="truncate">Penugasan Belum Tersedia</span>
              </div>
            ) : role === 'guru' && availableClasses.length === 1 ? (
              /* If teacher has 1 assigned class, LOCK to that class and HIDE choice of classes 1-6 */
              <div className="px-3 py-2 rounded-xl border border-[#D9A62E]/50 bg-amber-50/70 dark:bg-[#172D4B]/70 text-[#102A50] dark:text-[#FFD675] text-xs font-bold flex items-center justify-between shadow-xs">
                <span>{availableClasses[0].name} (Rombel Binaan)</span>
                <span className="text-[10px] uppercase px-1.5 py-0.5 rounded-full bg-[#102A50] text-[#FFD675] font-black">
                  Terkunci
                </span>
              </div>
            ) : role === 'guru' ? (
              /* If teacher has multiple assigned classes, ONLY list their assigned classes */
              <select
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                {availableClasses.map((c) => (
                  <option key={c.classId} value={c.classId}>
                    {c.name}
                  </option>
                ))}
              </select>
            ) : (
              /* Admin sees full list of classes 1 to 6 */
              <select
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
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
          </div>

          {/* Sesi Jadwal / Mapel */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
              Sesi Jadwal / Mapel
            </label>
            <select
              value={selectedScheduleId}
              onChange={(e) => setSelectedScheduleId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              <option value="">Presensi Umum / Harian</option>
              {schedules
                .filter((s) => s.classId === selectedClassId)
                .map((s) => (
                  <option key={s.scheduleId} value={s.scheduleId}>
                    {s.subjectName} ({s.day} {s.startTime})
                  </option>
                ))}
            </select>
          </div>
        </div>

        {/* View Mode Switcher Toggle - Only for Guru */}
        {role === 'guru' && (
          <div className="flex items-center gap-2 pt-2 lg:pt-0">
            <div className="p-1 rounded-2xl bg-[#ECE9E1]/70 dark:bg-[#071225] border border-[#E0E5EC] dark:border-[#263B58] flex items-center gap-1 shadow-inner">
              <button
                type="button"
                onClick={() => setViewMode('scanner')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                  viewMode === 'scanner'
                    ? 'bg-[#102A50] dark:bg-[#172D4B] text-white shadow-md border border-[#D9A62E]/40 font-bold'
                    : 'text-[#66758A] dark:text-[#B4C1D4] hover:text-[#102A50] dark:hover:text-[#F5F7FC]'
                }`}
              >
                <Camera className={`w-4 h-4 ${viewMode === 'scanner' ? 'text-[#D9A62E] dark:text-[#FFD675]' : ''}`} />
                <span>Pemindai QR</span>
              </button>

              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                  viewMode === 'table'
                    ? 'bg-[#102A50] dark:bg-[#172D4B] text-white shadow-md border border-[#D9A62E]/40 font-bold'
                    : 'text-[#66758A] dark:text-[#B4C1D4] hover:text-[#102A50] dark:hover:text-[#F5F7FC]'
                }`}
              >
                <Table className={`w-4 h-4 ${viewMode === 'table' ? 'text-[#D9A62E] dark:text-[#FFD675]' : ''}`} />
                <span>Tabel Rombel</span>
              </button>
            </div>
          </div>
        )}
        {role === 'admin' && (
          <div className="px-3 py-1.5 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-900/60 text-purple-700 dark:text-purple-300 text-xs font-semibold flex items-center gap-2">
            <span>🛡️ Mode Monitoring (Read-Only)</span>
          </div>
        )}
      </div>

      {/* Real-time Summary Pills */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-slate-500 block">Total Siswa</span>
            <span className="text-lg font-extrabold text-slate-900 dark:text-white">
              {counts.total}
            </span>
          </div>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
            {counts.attended} Tercatat
          </span>
        </div>

        <div className="p-3.5 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/70 dark:border-emerald-900/40 flex items-center justify-between text-emerald-800 dark:text-emerald-300">
          <div>
            <span className="text-[11px] font-semibold block">Hadir (H)</span>
            <span className="text-lg font-extrabold">{counts.h}</span>
          </div>
          <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400 opacity-60" />
        </div>

        <div className="p-3.5 rounded-2xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/70 dark:border-blue-900/40 flex items-center justify-between text-blue-800 dark:text-blue-300">
          <div>
            <span className="text-[11px] font-semibold block">Sakit (S)</span>
            <span className="text-lg font-extrabold">{counts.s}</span>
          </div>
          <Sparkles className="w-5 h-5 text-blue-600 dark:text-blue-400 opacity-60" />
        </div>

        <div className="p-3.5 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/70 dark:border-amber-900/40 flex items-center justify-between text-amber-800 dark:text-amber-300">
          <div>
            <span className="text-[11px] font-semibold block">Izin (I)</span>
            <span className="text-lg font-extrabold">{counts.i}</span>
          </div>
          <Users className="w-5 h-5 text-amber-600 dark:text-amber-400 opacity-60" />
        </div>

        <div className="p-3.5 rounded-2xl bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200/70 dark:border-rose-900/40 flex items-center justify-between text-rose-800 dark:text-rose-300 col-span-2 sm:col-span-1">
          <div>
            <span className="text-[11px] font-semibold block">Alpa (A)</span>
            <span className="text-lg font-extrabold">{counts.a}</span>
          </div>
          <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 opacity-60" />
        </div>
      </div>

      {/* VIEW MODE 1: SCANNER KAMERA QR (PRIMARY FOCUS) */}
      {viewMode === 'scanner' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Live Camera Scanner (60% Desktop / 7 Cols) */}
          <div className="lg:col-span-7">
            <QrScannerView
              students={students}
              existingRecords={existingRecords}
              selectedClassId={selectedClassId}
              selectedClassName={currentClass?.name}
              selectedScheduleId={selectedScheduleId}
              selectedSubjectName={currentSchedule?.subjectName}
              selectedDate={selectedDate}
              onRecordSuccess={handleRecordSuccess}
              onSwitchToTable={() => setViewMode('table')}
            />
          </div>

          {/* Right Column: Real-time Live Attendance Feed (40% Desktop / 5 Cols) */}
          <div className="lg:col-span-5 h-full">
            <AttendanceRealtimeFeed
              students={students}
              records={existingRecords}
              onQuickStatusChange={handleQuickStatusChange}
              onMarkStudentPresent={handleMarkStudentPresent}
            />
          </div>
        </div>
      )}

      {/* VIEW MODE 2: TABEL PRESENSI KELAS MANUAL */}
      {viewMode === 'table' && (
        <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
          {/* Table Header Bar */}
          <div className="p-4 sm:px-6 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Daftar Presensi Kelas {currentClass?.name} ({students.length} Siswa)
                </h3>
                <p className="text-[11px] text-slate-400">
                  Ubah status presensi individual atau simpan presensi manual sekaligus
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input
                  type="text"
                  value={tableSearch}
                  onChange={(e) => setTableSearch(e.target.value)}
                  placeholder="Cari siswa..."
                  className="pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 w-36 sm:w-44"
                />
              </div>

              {/* Actions - Only for Guru */}
              {role === 'guru' && (
                <div className="flex items-center gap-2">
                  {/* Mark All Present */}
                  <button
                    type="button"
                    onClick={handleMarkAllHadirInTable}
                    className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 transition-colors"
                  >
                    <CheckCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Tandai Semua Hadir</span>
                  </button>

                  {/* Save Attendance Batch Button */}
                  <button
                    type="button"
                    onClick={handleSaveAllFromTable}
                    disabled={saving || students.length === 0}
                    className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all shadow-blue-500/25 disabled:opacity-50"
                  >
                    {saving ? (
                      <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <Save className="w-3.5 h-3.5" />
                    )}
                    <span>Simpan Perubahan</span>
                  </button>
                </div>
              )}
              {role === 'admin' && (
                <span className="text-xs font-medium text-slate-400">
                  Data kehadiran dimuat dari catatan operasional guru.
                </span>
              )}
            </div>
          </div>

          {/* Table Contents */}
          {students.length === 0 ? (
            <EmptyState
              icon={Users}
              title="Tidak Ada Siswa di Kelas Ini"
              description="Silakan pilih kelas lain atau tambahkan siswa ke dalam rombel ini terlebih dahulu."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    <th className="py-3 px-4 w-12 text-center">No</th>
                    <th className="py-3 px-4">Nama Siswa</th>
                    <th className="py-3 px-4">NIS</th>
                    <th className="py-3 px-4 text-center">Status Kehadiran</th>
                    <th className="py-3 px-4">Metode</th>
                    <th className="py-3 px-4">Catatan Khusus</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-700 dark:text-slate-300">
                  {filteredStudentsForTable.map((stu, index) => {
                    const item = attendanceMap[stu.studentId] || {
                      status: 'Hadir',
                      notes: '',
                      method: 'manual',
                    };
                    return (
                      <tr
                        key={stu.studentId}
                        className="hover:bg-slate-50/80 dark:hover:bg-slate-800/30 transition-colors"
                      >
                        <td className="py-3 px-4 text-center text-slate-400 font-medium">
                          {index + 1}
                        </td>
                        <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-bold flex items-center justify-center text-[10px] shrink-0">
                              {stu.name.charAt(0)}
                            </div>
                            <span>{stu.name}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-500">
                          {stu.nis}
                        </td>
                        <td className="py-3 px-4">
                          {role === 'guru' ? (
                            <div className="flex items-center justify-center gap-1.5">
                              {(['Hadir', 'Sakit', 'Izin', 'Alpa'] as AttendanceStatus[]).map(
                                (st) => {
                                  const isSelected = item.status === st;
                                  const colors: Record<AttendanceStatus, string> = {
                                    Hadir: isSelected
                                      ? 'bg-emerald-600 text-white font-bold shadow-xs'
                                      : 'text-slate-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30',
                                    Sakit: isSelected
                                      ? 'bg-blue-600 text-white font-bold shadow-xs'
                                      : 'text-slate-600 hover:bg-blue-50 dark:hover:bg-blue-950/30',
                                    Izin: isSelected
                                      ? 'bg-amber-600 text-white font-bold shadow-xs'
                                      : 'text-slate-600 hover:bg-amber-50 dark:hover:bg-amber-950/30',
                                    Alpa: isSelected
                                      ? 'bg-rose-600 text-white font-bold shadow-xs'
                                      : 'text-slate-600 hover:bg-rose-50 dark:hover:bg-rose-950/30',
                                  };
                                  return (
                                    <button
                                      key={st}
                                      type="button"
                                      onClick={() => handleStatusChangeInTable(stu.studentId, st)}
                                      className={`px-2.5 py-1 rounded-lg text-[11px] transition-all font-medium border border-transparent ${colors[st]}`}
                                    >
                                      {st}
                                    </button>
                                  );
                                }
                              )}
                            </div>
                          ) : (
                            <span
                              className={`px-3 py-1 rounded-lg text-[11px] font-bold inline-block ${
                                item.status === 'Hadir'
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                                  : item.status === 'Sakit'
                                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300'
                                  : item.status === 'Izin'
                                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
                                  : 'bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300'
                              }`}
                            >
                              {item.status}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              item.method === 'qr'
                                ? 'bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                            }`}
                          >
                            {item.method === 'qr' ? '⚡ Scan QR' : 'Manual'}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          {role === 'guru' ? (
                            <input
                              type="text"
                              value={item.notes}
                              onChange={(e) => handleNotesChangeInTable(stu.studentId, e.target.value)}
                              placeholder="Catatan surat / alasan..."
                              className="w-full px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none"
                            />
                          ) : (
                            <span className="text-slate-600 dark:text-slate-400 text-xs italic">
                              {item.notes || '-'}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
