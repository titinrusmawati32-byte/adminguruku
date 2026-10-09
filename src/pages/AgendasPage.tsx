import {
  BookOpen,
  Calendar,
  CheckCircle,
  ClipboardList,
  Edit,
  Eye,
  FileText,
  Filter,
  Plus,
  Search,
  Trash2,
  Users,
} from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { EmptyState } from '../components/common/EmptyState';
import { Modal } from '../components/common/Modal';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { agendaService } from '../services/agendaService';
import { auditService } from '../services/auditService';
import { authorizationService } from '../services/authorizationService';
import { classService, groupClassesBySDGrade } from '../services/classService';
import { scheduleService } from '../services/scheduleService';
import { subjectService } from '../services/subjectService';
import { Schedule, SchoolClass, Subject, TeachingAgenda } from '../types';

export const AgendasPage: React.FC = () => {
  const { profile } = useAuth();
  const { showToast } = useNotification();

  const [agendas, setAgendas] = useState<TeachingAgenda[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
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
  const [searchQuery, setSearchQuery] = useState('');
  const [filterClass, setFilterClass] = useState<string>('all');

  // Modals
  const [isAddEditOpen, setIsAddEditOpen] = useState(false);
  const [editingAgenda, setEditingAgenda] = useState<TeachingAgenda | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [detailAgenda, setDetailAgenda] = useState<TeachingAgenda | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [agendaToDelete, setAgendaToDelete] = useState<TeachingAgenda | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Form
  const [selectedScheduleId, setSelectedScheduleId] = useState<string>('');
  const [formData, setFormData] = useState({
    classId: '',
    subjectId: '',
    date: new Date().toISOString().slice(0, 10),
    topic: '',
    learningObjective: '',
    activity: '',
    attendanceSummary: '',
    notes: '',
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [ag, cls, sub, sch] = await Promise.all([
        agendaService.getAll(profile),
        classService.getAll(),
        subjectService.getAll(),
        scheduleService.getAll(),
      ]);
      setAgendas(ag);
      setClasses(cls);
      setSubjects(sub);
      setSchedules(sch);

      const permitted = profile?.role === 'admin' ? cls : authorizationService.filterClassesForUser(cls, profile);
      if (profile?.role === 'guru') {
        if (permitted.length === 1) {
          setFilterClass(permitted[0].classId);
        } else if (filterClass !== 'all' && !permitted.some((c) => c.classId === filterClass)) {
          setFilterClass(permitted[0]?.classId || 'all');
        }
      }
    } catch (err: any) {
      showToast('Gagal memuat agenda: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [profile?.uid, profile?.role]);

  const filteredAgendas = useMemo(() => {
    return agendas.filter((item) => {
      const matchSearch =
        item.topic.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.activity.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.subjectName || '').toLowerCase().includes(searchQuery.toLowerCase());
      const matchClass = filterClass === 'all' || item.classId === filterClass;
      return matchSearch && matchClass;
    });
  }, [agendas, searchQuery, filterClass]);

  const handleOpenAdd = () => {
    setEditingAgenda(null);
    setSelectedScheduleId('');
    setFormData({
      classId: permittedClasses[0]?.classId || classes[0]?.classId || '',
      subjectId: subjects[0]?.subjectId || '',
      date: new Date().toISOString().slice(0, 10),
      topic: '',
      learningObjective: '',
      activity: '',
      attendanceSummary: 'Semua siswa hadir tertib.',
      notes: '',
    });
    setIsAddEditOpen(true);
  };

  // When schedule selected, auto fill class and subject as mandated by prompt
  const handleScheduleSelectChange = (schId: string) => {
    setSelectedScheduleId(schId);
    if (!schId) return;
    const sch = schedules.find((s) => s.scheduleId === schId);
    if (sch) {
      setFormData((prev) => ({
        ...prev,
        classId: sch.classId,
        subjectId: sch.subjectId,
      }));
    }
  };

  const handleOpenEdit = (ag: TeachingAgenda) => {
    setEditingAgenda(ag);
    setSelectedScheduleId(ag.scheduleId || '');
    setFormData({
      classId: ag.classId,
      subjectId: ag.subjectId,
      date: ag.date,
      topic: ag.topic,
      learningObjective: ag.learningObjective,
      activity: ag.activity,
      attendanceSummary: ag.attendanceSummary || '',
      notes: ag.notes || '',
    });
    setIsAddEditOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.topic.trim()) {
      showToast('Topik pembelajaran wajib diisi.', 'warning');
      return;
    }

    setActionLoading(true);
    try {
      const selectedClass = classes.find((c) => c.classId === formData.classId);
      const selectedSubject = subjects.find((s) => s.subjectId === formData.subjectId);

      const payload = {
        ...formData,
        scheduleId: selectedScheduleId || undefined,
        teacherId: profile?.teacherId || profile?.uid || 'GURU-001',
        teacherName: profile?.displayName || 'Guru Pengampu',
        className: selectedClass?.name || formData.classId,
        subjectName: selectedSubject?.name || formData.subjectId,
      };

      if (editingAgenda) {
        await agendaService.update(editingAgenda.agendaId, payload);
        await auditService.log('Update Agenda', 'teaching_agendas', editingAgenda.agendaId, `Mengubah agenda ${payload.topic}`);
        showToast('Agenda mengajar berhasil diperbarui.', 'success');
      } else {
        const id = await agendaService.create({
          agendaId: '',
          ...payload,
        }, profile);
        await auditService.log('Tambah Agenda', 'teaching_agendas', id, `Menambah agenda ${payload.topic}`);
        showToast('Agenda mengajar berhasil disimpan ke Firestore.', 'success');
      }
      setIsAddEditOpen(false);
      await loadData();
    } catch (err: any) {
      showToast('Gagal menyimpan agenda: ' + err.message, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!agendaToDelete) return;
    setActionLoading(true);
    try {
      await agendaService.delete(agendaToDelete.agendaId);
      await auditService.log('Hapus Agenda', 'teaching_agendas', agendaToDelete.agendaId, `Menghapus agenda ${agendaToDelete.topic}`);
      showToast('Agenda berhasil dihapus.', 'success');
      setIsDeleteOpen(false);
      await loadData();
    } catch (err: any) {
      showToast('Gagal menghapus: ' + err.message, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Toolbar */}
      <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari topik, aktivitas, atau materi agenda..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
        </div>

        {/* Filter & Add */}
        <div className="flex items-center gap-2.5">
          {profile?.role === 'guru' && permittedClasses.length === 0 ? (
            <div className="px-3.5 py-2 rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 text-xs font-semibold flex items-center gap-1.5">
              <span className="truncate">Penugasan Belum Tersedia</span>
            </div>
          ) : profile?.role === 'guru' && permittedClasses.length === 1 ? (
            <div className="px-3.5 py-2 rounded-xl border border-[#D9A62E]/50 bg-amber-50/70 dark:bg-[#172D4B]/70 text-[#102A50] dark:text-[#FFD675] text-xs font-bold flex items-center gap-2 shadow-xs">
              <span>Rombel: {permittedClasses[0].name}</span>
              <span className="text-[10px] uppercase px-1.5 py-0.5 rounded-full bg-[#102A50] text-[#FFD675] font-black">
                Terkunci
              </span>
            </div>
          ) : profile?.role === 'guru' ? (
            <select
              value={filterClass}
              onChange={(e) => setFilterClass(e.target.value)}
              className="px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
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
              className="px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
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

          <button
            onClick={handleOpenAdd}
            className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all shadow-blue-500/20"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Agenda</span>
          </button>
        </div>
      </div>

      {/* Grid of Teaching Agendas */}
      {loading ? (
        <div className="p-12 text-center text-xs text-slate-400">
          Memuat jurnal agenda mengajar...
        </div>
      ) : filteredAgendas.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="Belum Ada Agenda Mengajar"
          description="Catat jurnal materi pokok harian, capaian pembelajaran, dan ringkasan kehadiran siswa di kelas."
          actionLabel="Tulis Agenda Sekarang"
          onAction={handleOpenAdd}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAgendas.map((ag) => (
            <div
              key={ag.agendaId}
              className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs hover:shadow-md transition-all flex flex-col justify-between group"
            >
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2.5 py-0.5 rounded-full">
                    {ag.className}
                  </span>
                  <span className="text-xs text-slate-400 font-mono">
                    {ag.date}
                  </span>
                </div>

                <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                  {ag.subjectName}
                </div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white mt-0.5 leading-snug line-clamp-2">
                  {ag.topic}
                </h4>

                <p className="text-xs text-slate-600 dark:text-slate-300 mt-2 line-clamp-3 leading-relaxed">
                  {ag.activity || ag.learningObjective}
                </p>

                {ag.attendanceSummary && (
                  <div className="mt-3 text-[11px] text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 px-2.5 py-1 rounded-lg">
                    Kehadiran: {ag.attendanceSummary}
                  </div>
                )}
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <span className="text-[11px] text-slate-400">
                  {ag.teacherName || 'Guru Pengampu'}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      setDetailAgenda(ag);
                      setIsDetailOpen(true);
                    }}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    title="Lihat Detail"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleOpenEdit(ag)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    title="Edit Agenda"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => {
                      setAgendaToDelete(ag);
                      setIsDeleteOpen(true);
                    }}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                    title="Hapus Agenda"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Agenda Modal */}
      <Modal
        isOpen={isAddEditOpen}
        onClose={() => setIsAddEditOpen(false)}
        title={editingAgenda ? 'Edit Agenda Mengajar' : 'Tulis Agenda Mengajar'}
        subtitle="Jurnal harian pembelajaran terhubung dengan jadwal dan presensi kelas"
        maxWidth="2xl"
      >
        <form onSubmit={handleSave} className="space-y-4">
          {/* Quick Schedule Pick */}
          <div className="p-3 rounded-xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-900/50">
            <label className="block text-xs font-bold text-blue-900 dark:text-blue-200 mb-1">
              Pilih dari Jadwal Mengajar (Otomatis Isi Kelas & Mapel):
            </label>
            <select
              value={selectedScheduleId}
              onChange={(e) => handleScheduleSelectChange(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg border border-blue-200 dark:border-blue-800 bg-white dark:bg-slate-800 text-xs font-medium text-slate-900 dark:text-white"
            >
              <option value="">-- Isi Manual / Tanpa Jadwal --</option>
              {schedules.map((s) => (
                <option key={s.scheduleId} value={s.scheduleId}>
                  {s.className} - {s.subjectName} ({s.day} {s.startTime})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Tanggal Mengajar *
              </label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                required
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Rombel / Kelas {profile?.role === 'guru' ? 'Binaan' : '(SD Kelas 1 - 6)'} *
              </label>
              {profile?.role === 'guru' && permittedClasses.length === 1 ? (
                <div className="w-full px-3 py-2 rounded-xl border border-[#D9A62E]/50 bg-amber-50 dark:bg-[#172D4B] text-[#102A50] dark:text-[#FFD675] text-xs font-bold flex items-center justify-between">
                  <span>{permittedClasses[0].name} (Rombel Binaan)</span>
                  <span className="text-[10px] uppercase px-1.5 py-0.5 rounded-full bg-[#102A50] text-[#FFD675] font-black">
                    Terkunci
                  </span>
                </div>
              ) : profile?.role === 'guru' ? (
                <select
                  value={formData.classId}
                  onChange={(e) => setFormData({ ...formData, classId: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
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
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
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
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Mata Pelajaran *
              </label>
              <select
                value={formData.subjectId}
                onChange={(e) => setFormData({ ...formData, subjectId: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                {subjects.map((s) => (
                  <option key={s.subjectId} value={s.subjectId}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Materi / Topik Pembelajaran *
            </label>
            <input
              type="text"
              value={formData.topic}
              onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
              placeholder="Contoh: Operasi Hitung Campuran Bilangan Pecahan"
              required
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs sm:text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Tujuan Pembelajaran (TP)
            </label>
            <input
              type="text"
              value={formData.learningObjective}
              onChange={(e) => setFormData({ ...formData, learningObjective: e.target.value })}
              placeholder="Contoh: Peserta didik mampu menyelesaikan masalah kontekstual penjumlahan pecahan"
              className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Aktivitas Pembelajaran / Metode
            </label>
            <textarea
              rows={3}
              value={formData.activity}
              onChange={(e) => setFormData({ ...formData, activity: e.target.value })}
              placeholder="Jelaskan langkah pembelajaran, diskusi kelompok, penugasan, atau presentasi..."
              className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Ringkasan Kehadiran
              </label>
              <input
                type="text"
                value={formData.attendanceSummary}
                onChange={(e) => setFormData({ ...formData, attendanceSummary: e.target.value })}
                placeholder="Contoh: 28 Hadir, 1 Sakit, 1 Izin"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Catatan Guru
              </label>
              <input
                type="text"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Contoh: Pembelajaran tuntas, remedial terjadwal"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
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
              <span>{editingAgenda ? 'Perbarui Agenda' : 'Simpan Agenda'}</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* Detail Modal */}
      <Modal
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        title="Detail Jurnal Mengajar"
        subtitle="Informasi lengkap pelaksanaan aktivitas belajar di kelas"
      >
        {detailAgenda && (
          <div className="space-y-4 text-xs">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 space-y-1">
              <div className="flex justify-between text-slate-500">
                <span>Tanggal: {detailAgenda.date}</span>
                <span className="font-bold text-blue-600">{detailAgenda.className}</span>
              </div>
              <div className="text-sm font-bold text-slate-900 dark:text-white">
                {detailAgenda.subjectName}
              </div>
              <div className="text-slate-400">Guru: {detailAgenda.teacherName}</div>
            </div>

            <div>
              <h5 className="font-bold text-slate-700 dark:text-slate-300 mb-1">
                Topik / Materi:
              </h5>
              <p className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 font-semibold text-slate-900 dark:text-white">
                {detailAgenda.topic}
              </p>
            </div>

            <div>
              <h5 className="font-bold text-slate-700 dark:text-slate-300 mb-1">
                Tujuan Pembelajaran:
              </h5>
              <p className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200">
                {detailAgenda.learningObjective || '-'}
              </p>
            </div>

            <div>
              <h5 className="font-bold text-slate-700 dark:text-slate-300 mb-1">
                Aktivitas Pembelajaran:
              </h5>
              <p className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 leading-relaxed whitespace-pre-wrap">
                {detailAgenda.activity || '-'}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <h5 className="font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Kehadiran:
                </h5>
                <p className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200">
                  {detailAgenda.attendanceSummary || '-'}
                </p>
              </div>
              <div>
                <h5 className="font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Catatan:
                </h5>
                <p className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200">
                  {detailAgenda.notes || '-'}
                </p>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        onConfirm={handleDeleteConfirm}
        title="Hapus Agenda Mengajar?"
        message={`Apakah Anda yakin ingin menghapus agenda "${agendaToDelete?.topic}"?`}
        loading={actionLoading}
      />
    </div>
  );
};
