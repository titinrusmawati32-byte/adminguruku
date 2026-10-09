import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Calendar as CalendarIcon,
  CheckCircle,
  Clock,
  Edit,
  Filter,
  List,
  Play,
  Plus,
  Trash2,
  Users,
} from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { EmptyState } from '../components/common/EmptyState';
import { Modal } from '../components/common/Modal';
import { ActiveTab } from '../components/layout/Sidebar';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { auditService } from '../services/auditService';
import { authorizationService, matchesClassAssignment } from '../services/authorizationService';
import { authService } from '../services/authService';
import { classService, groupClassesBySDGrade } from '../services/classService';
import { scheduleService } from '../services/scheduleService';
import { subjectService } from '../services/subjectService';
import { DayOfWeek, Schedule, SchoolClass, Subject, UserProfile } from '../types';

interface SchedulesPageProps {
  onSelectTab: (tab: ActiveTab) => void;
  onStartTeaching?: (schedule: Schedule) => void;
}

const DAYS: DayOfWeek[] = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

export const SchedulesPage: React.FC<SchedulesPageProps> = ({
  onSelectTab,
  onStartTeaching,
}) => {
  const { profile } = useAuth();
  const { showToast } = useNotification();

  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [teachers, setTeachers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtered classes strictly based on official role & assignments
  const permittedClasses = useMemo(() => {
    if (profile?.role === 'admin') return classes;
    return authorizationService.filterClassesForUser(classes, profile);
  }, [classes, profile]);

  const groupedSDClasses = useMemo(() => {
    return groupClassesBySDGrade(classes);
  }, [classes]);

  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');
  const [filterClass, setFilterClass] = useState<string>('all');
  const [filterSubject, setFilterSubject] = useState<string>('all');

  const [isAddEditOpen, setIsAddEditOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [scheduleToDelete, setScheduleToDelete] = useState<Schedule | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [conflictError, setConflictError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    teacherId: '',
    teacherName: '',
    classId: '',
    subjectId: '',
    day: 'Senin' as DayOfWeek,
    startTime: '07:30',
    endTime: '09:00',
    room: 'Ruang 1',
    academicYear: '2024/2025',
    semester: '1' as '1' | '2',
    status: 'active' as 'active' | 'inactive',
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [sch, cls, sub, tch] = await Promise.all([
        scheduleService.getAll(),
        classService.getAll(),
        subjectService.getAll(),
        authService.getAllTeachers(),
      ]);
      setSchedules(sch);
      setClasses(cls);
      setSubjects(sub);
      setTeachers(tch);

      const permitted = profile?.role === 'admin' ? cls : authorizationService.filterClassesForUser(cls, profile);
      if (profile?.role === 'guru') {
        if (permitted.length === 1) {
          setFilterClass(permitted[0].classId);
        } else if (filterClass !== 'all' && !permitted.some((c) => c.classId === filterClass)) {
          setFilterClass(permitted[0]?.classId || 'all');
        }
      }
    } catch (err: any) {
      showToast('Gagal memuat jadwal: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [profile?.uid, profile?.role]);

  const filteredSchedules = useMemo(() => {
    let list = schedules;
    if (profile?.role === 'guru') {
      const authorizedKeys = authorizationService.getUserAuthorizedClassKeys(profile);
      list = list.filter((s) => {
        const isMyClass = matchesClassAssignment(s.classId, authorizedKeys) || matchesClassAssignment(s.className || '', authorizedKeys);
        const isMyTeacher = (s.teacherId && (s.teacherId === profile.teacherId || s.teacherId === profile.uid));
        return isMyClass || isMyTeacher;
      });
    }
    return list.filter((s) => {
      const matchClass = filterClass === 'all' || s.classId === filterClass;
      const matchSub = filterSubject === 'all' || s.subjectId === filterSubject;
      return matchClass && matchSub;
    });
  }, [schedules, filterClass, filterSubject, profile]);

  const handleOpenAdd = () => {
    setEditingSchedule(null);
    setConflictError(null);
    const defaultCls = permittedClasses[0] || classes[0];
    setFormData({
      teacherId: profile?.teacherId || profile?.uid || 'GURU-001',
      teacherName: profile?.displayName || 'Guru Pengampu',
      classId: defaultCls?.classId || '',
      subjectId: subjects[0]?.subjectId || '',
      day: 'Senin',
      startTime: '07:30',
      endTime: '09:00',
      room: defaultCls?.name ? `Ruang ${defaultCls.name.replace('Kelas ', '')}` : 'Ruang Kelas',
      academicYear: '2024/2025',
      semester: '1',
      status: 'active',
    });
    setIsAddEditOpen(true);
  };

  const handleOpenEdit = (s: Schedule) => {
    setEditingSchedule(s);
    setConflictError(null);
    setFormData({
      teacherId: s.teacherId,
      teacherName: s.teacherName || '',
      classId: s.classId,
      subjectId: s.subjectId,
      day: s.day,
      startTime: s.startTime,
      endTime: s.endTime,
      room: s.room,
      academicYear: s.academicYear,
      semester: s.semester,
      status: s.status,
    });
    setIsAddEditOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.startTime || !formData.endTime) {
      showToast('Waktu mulai dan selesai wajib diisi.', 'warning');
      return;
    }
    if (formData.startTime >= formData.endTime) {
      setConflictError('Waktu selesai harus lebih besar dari waktu mulai.');
      return;
    }

    setActionLoading(true);
    setConflictError(null);
    try {
      const selectedClass = classes.find((c) => c.classId === formData.classId);
      const selectedSubject = subjects.find((s) => s.subjectId === formData.subjectId);

      const payload = {
        ...formData,
        className: selectedClass?.name || formData.classId,
        subjectName: selectedSubject?.name || formData.subjectId,
      };

      if (editingSchedule) {
        await scheduleService.update(editingSchedule.scheduleId, payload);
        await auditService.log('Update Jadwal', 'schedules', editingSchedule.scheduleId, `Mengubah jadwal ${payload.subjectName}`);
        showToast('Jadwal berhasil diperbarui.', 'success');
      } else {
        const id = await scheduleService.create({
          scheduleId: '',
          ...payload,
        });
        await auditService.log('Tambah Jadwal', 'schedules', id, `Menambah jadwal ${payload.subjectName} di ${payload.className}`);
        showToast('Jadwal baru berhasil disimpan.', 'success');
      }
      setIsAddEditOpen(false);
      await loadData();
    } catch (err: any) {
      setConflictError(err.message);
      showToast('Gagal menyimpan jadwal: ' + err.message, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!scheduleToDelete) return;
    setActionLoading(true);
    try {
      await scheduleService.delete(scheduleToDelete.scheduleId);
      await auditService.log('Hapus Jadwal', 'schedules', scheduleToDelete.scheduleId, `Menghapus jadwal ${scheduleToDelete.subjectName}`);
      showToast('Jadwal berhasil dihapus.', 'success');
      setIsDeleteOpen(false);
      await loadData();
    } catch (err: any) {
      showToast('Gagal menghapus jadwal: ' + err.message, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleStartTeaching = (sch: Schedule) => {
    // Save selected active session for attendance & agenda
    sessionStorage.setItem('active_teaching_schedule', JSON.stringify(sch));
    if (onStartTeaching) onStartTeaching(sch);
    onSelectTab('attendance');
    showToast(`Sesi mengajar dibuka: ${sch.subjectName} di ${sch.className}`, 'info');
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Toolbar */}
      <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
            <Filter className="w-3.5 h-3.5" />
            <span>Filter:</span>
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
              className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-800 dark:text-slate-200"
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
              className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-800 dark:text-slate-200"
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

          <select
            value={filterSubject}
            onChange={(e) => setFilterSubject(e.target.value)}
            className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-800 dark:text-slate-200"
          >
            <option value="all">Semua Mapel</option>
            {subjects.map((s) => (
              <option key={s.subjectId} value={s.subjectId}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        {/* View Mode Toggle & Add Button */}
        <div className="flex items-center gap-2">
          <div className="flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60">
            <button
              onClick={() => setViewMode('calendar')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                viewMode === 'calendar'
                  ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <CalendarIcon className="w-3.5 h-3.5" />
              <span>Mingguan</span>
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                viewMode === 'list'
                  ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>Daftar</span>
            </button>
          </div>

          <button
            onClick={handleOpenAdd}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all shadow-blue-500/20"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Jadwal</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="p-12 text-center text-xs text-slate-400">
          Memuat jadwal mengajar...
        </div>
      ) : filteredSchedules.length === 0 ? (
        <EmptyState
          icon={CalendarIcon}
          title="Belum Ada Jadwal Mengajar"
          description="Tambahkan jadwal pertama Anda untuk mulai menghubungkan presensi dan agenda mengajar kelas."
          actionLabel="Tambah Jadwal Pertama"
          onAction={handleOpenAdd}
        />
      ) : viewMode === 'calendar' ? (
        /* Calendar / Weekly View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5">
          {DAYS.map((day) => {
            const daySchedules = filteredSchedules.filter((s) => s.day === day);
            return (
              <div
                key={day}
                className="flex flex-col rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 overflow-hidden shadow-xs"
              >
                {/* Day Header */}
                <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <span className="font-bold text-xs text-slate-900 dark:text-white">
                    {day}
                  </span>
                  <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-1.5 py-0.5 rounded-full">
                    {daySchedules.length}
                  </span>
                </div>

                {/* Day Cards */}
                <div className="p-2.5 flex-1 space-y-2.5 min-h-[140px]">
                  {daySchedules.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-[11px] text-slate-400 py-6">
                      Kosong
                    </div>
                  ) : (
                    daySchedules.map((sch) => (
                      <div
                        key={sch.scheduleId}
                        className="p-3 rounded-xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 hover:border-blue-400 dark:hover:border-blue-600 transition-colors group flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-center justify-between gap-1 mb-1">
                            <span className="text-[10px] font-mono text-blue-600 dark:text-blue-400 font-bold bg-blue-50 dark:bg-blue-950/60 px-1.5 py-0.5 rounded">
                              {sch.startTime} - {sch.endTime}
                            </span>
                            <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300">
                              {sch.className}
                            </span>
                          </div>
                          <div className="text-xs font-bold text-slate-900 dark:text-white leading-tight">
                            {sch.subjectName}
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            {sch.room}
                          </div>
                        </div>

                        {/* Card Action Strip */}
                        <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
                          <button
                            onClick={() => handleStartTeaching(sch)}
                            className="px-2 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold flex items-center gap-1 shadow-xs transition-colors"
                            title="Mulai mengajar dan buka absensi"
                          >
                            <Play className="w-2.5 h-2.5 fill-current" />
                            <span>Mulai</span>
                          </button>

                          <div className="flex items-center gap-0.5">
                            <button
                              onClick={() => handleOpenEdit(sch)}
                              className="p-1 rounded text-slate-400 hover:text-blue-600 transition-colors"
                              title="Edit"
                            >
                              <Edit className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => {
                                setScheduleToDelete(sch);
                                setIsDeleteOpen(true);
                              }}
                              className="p-1 rounded text-slate-400 hover:text-rose-600 transition-colors"
                              title="Hapus"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* List View */
        <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                <th className="py-3.5 px-4">Hari</th>
                <th className="py-3.5 px-4">Waktu</th>
                <th className="py-3.5 px-4">Rombel</th>
                <th className="py-3.5 px-4">Mata Pelajaran</th>
                <th className="py-3.5 px-4">Ruang</th>
                <th className="py-3.5 px-4">Guru</th>
                <th className="py-3.5 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-700 dark:text-slate-300">
              {filteredSchedules.map((sch) => (
                <tr key={sch.scheduleId} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/30 transition-colors">
                  <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white">
                    {sch.day}
                  </td>
                  <td className="py-3.5 px-4 font-mono font-semibold text-blue-600 dark:text-blue-400">
                    {sch.startTime} - {sch.endTime}
                  </td>
                  <td className="py-3.5 px-4 font-semibold">
                    {sch.className}
                  </td>
                  <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-white">
                    {sch.subjectName}
                  </td>
                  <td className="py-3.5 px-4">{sch.room}</td>
                  <td className="py-3.5 px-4 text-slate-500">{sch.teacherName || 'Bapak/Ibu Guru'}</td>
                  <td className="py-3.5 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => handleStartTeaching(sch)}
                        className="px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold flex items-center gap-1 shadow-xs transition-colors"
                      >
                        <Play className="w-3 h-3 fill-current" />
                        <span>Mulai</span>
                      </button>
                      <button
                        onClick={() => handleOpenEdit(sch)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-slate-100 transition-colors"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          setScheduleToDelete(sch);
                          setIsDeleteOpen(true);
                        }}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add / Edit Schedule Modal */}
      <Modal
        isOpen={isAddEditOpen}
        onClose={() => setIsAddEditOpen(false)}
        title={editingSchedule ? 'Edit Jadwal Mengajar' : 'Tambah Jadwal Mengajar'}
        subtitle="Sistem akan memeriksa bentrok ruangan dan waktu secara otomatis"
      >
        <form onSubmit={handleSave} className="space-y-4">
          {conflictError && (
            <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900/60 flex items-start gap-2.5 text-rose-700 dark:text-rose-300 text-xs">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{conflictError}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Hari *
              </label>
              <select
                value={formData.day}
                onChange={(e) => setFormData({ ...formData, day: e.target.value as DayOfWeek })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                {DAYS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Ruangan / Lab
              </label>
              <input
                type="text"
                value={formData.room}
                onChange={(e) => setFormData({ ...formData, room: e.target.value })}
                placeholder="Contoh: Ruang 7A"
                required
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Jam Mulai *
              </label>
              <input
                type="time"
                value={formData.startTime}
                onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                required
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Jam Selesai *
              </label>
              <input
                type="time"
                value={formData.endTime}
                onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                required
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Rombel / Kelas {profile?.role === 'guru' ? 'Binaan' : '(SD Kelas 1 - 6)'} *
              </label>
              {profile?.role === 'guru' && permittedClasses.length === 1 ? (
                <div className="w-full px-3.5 py-2.5 rounded-xl border border-[#D9A62E]/50 bg-amber-50 dark:bg-[#172D4B] text-[#102A50] dark:text-[#FFD675] text-xs sm:text-sm font-bold flex items-center justify-between">
                  <span>{permittedClasses[0].name} (Rombel Binaan)</span>
                  <span className="text-[10px] uppercase px-1.5 py-0.5 rounded-full bg-[#102A50] text-[#FFD675] font-black">
                    Terkunci
                  </span>
                </div>
              ) : profile?.role === 'guru' ? (
                <select
                  value={formData.classId}
                  onChange={(e) => setFormData({ ...formData, classId: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  {permittedClasses.map((c) => (
                    <option key={c.classId} value={c.classId}>
                      {c.name}
                    </option>
                  ))}
                </select>
              ) : (
                <select
                  value={formData.classId}
                  onChange={(e) => setFormData({ ...formData, classId: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
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
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Mata Pelajaran *
              </label>
              <select
                value={formData.subjectId}
                onChange={(e) => setFormData({ ...formData, subjectId: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                {subjects.map((s) => (
                  <option key={s.subjectId} value={s.subjectId}>
                    {s.name} ({s.code})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Guru Pengampu
            </label>
            <input
              type="text"
              value={formData.teacherName}
              onChange={(e) => setFormData({ ...formData, teacherName: e.target.value })}
              placeholder="Nama Guru Pengampu"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div className="pt-3 flex items-center justify-end gap-2.5 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsAddEditOpen(false)}
              className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={actionLoading}
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 disabled:opacity-50"
            >
              {actionLoading && <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
              <span>{editingSchedule ? 'Simpan Perubahan' : 'Tambahkan'}</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        onConfirm={handleDeleteConfirm}
        title="Hapus Jadwal Mengajar?"
        message={`Apakah Anda yakin ingin menghapus jadwal ${scheduleToDelete?.subjectName} di ${scheduleToDelete?.className} (${scheduleToDelete?.day} ${scheduleToDelete?.startTime})?`}
        loading={actionLoading}
      />
    </div>
  );
};
