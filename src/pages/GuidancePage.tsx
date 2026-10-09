import {
  AlertCircle,
  Award,
  Calendar,
  CheckCircle,
  Clock,
  Edit,
  Eye,
  Filter,
  HeartHandshake,
  Plus,
  Search,
  Trash2,
  User,
  Users,
} from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { EmptyState } from '../components/common/EmptyState';
import { Modal } from '../components/common/Modal';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { assessmentService } from '../services/assessmentService';
import { attendanceService } from '../services/attendanceService';
import { auditService } from '../services/auditService';
import { authorizationService } from '../services/authorizationService';
import { guidanceService } from '../services/guidanceService';
import { studentService } from '../services/studentService';
import {
  Assessment,
  AttendanceRecord,
  Guidance,
  GuidanceCategory,
  GuidanceStatus,
  Student,
} from '../types';

const CATEGORIES: GuidanceCategory[] = [
  'Akademik',
  'Kehadiran',
  'Perilaku',
  'Sosial',
  'Prestasi',
  'Lainnya',
];

export const GuidancePage: React.FC = () => {
  const { profile } = useAuth();
  const { showToast } = useNotification();

  const [guidanceList, setGuidanceList] = useState<Guidance[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);

  // Check if guru has assigned class
  const isAssigned = useMemo(() => {
    return authorizationService.hasAnyClassAssignment(profile);
  }, [profile]);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // Modals
  const [isAddEditOpen, setIsAddEditOpen] = useState(false);
  const [editingGuidance, setEditingGuidance] = useState<Guidance | null>(null);
  const [isStudentProfileOpen, setIsStudentProfileOpen] = useState(false);
  const [profileStudent, setProfileStudent] = useState<Student | null>(null);
  const [studentAttendance, setStudentAttendance] = useState<AttendanceRecord[]>([]);
  const [studentGrades, setStudentGrades] = useState<{ title: string; score: number }[]>([]);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [guidanceToDelete, setGuidanceToDelete] = useState<Guidance | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    studentId: '',
    date: new Date().toISOString().slice(0, 10),
    category: 'Akademik' as GuidanceCategory,
    problem: '',
    action: '',
    followUp: '',
    status: 'in_progress' as GuidanceStatus,
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [gui, stu] = await Promise.all([
        guidanceService.getAll(profile),
        studentService.getAll(profile),
      ]);
      setGuidanceList(gui);
      setStudents(stu.filter((s) => s.status === 'active'));
    } catch (err: any) {
      showToast('Gagal memuat bimbingan: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [profile?.uid, profile?.role]);

  const filteredList = useMemo(() => {
    return guidanceList.filter((item) => {
      const matchSearch =
        (item.studentName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.problem.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.action.toLowerCase().includes(searchQuery.toLowerCase());
      const matchCat = filterCategory === 'all' || item.category === filterCategory;
      const matchStat = filterStatus === 'all' || item.status === filterStatus;
      return matchSearch && matchCat && matchStat;
    });
  }, [guidanceList, searchQuery, filterCategory, filterStatus]);

  const handleOpenAdd = () => {
    setEditingGuidance(null);
    setFormData({
      studentId: students[0]?.studentId || '',
      date: new Date().toISOString().slice(0, 10),
      category: 'Akademik',
      problem: '',
      action: '',
      followUp: '',
      status: 'in_progress',
    });
    setIsAddEditOpen(true);
  };

  const handleOpenEdit = (g: Guidance) => {
    setEditingGuidance(g);
    setFormData({
      studentId: g.studentId,
      date: g.date,
      category: g.category,
      problem: g.problem,
      action: g.action,
      followUp: g.followUp,
      status: g.status,
    });
    setIsAddEditOpen(true);
  };

  const handleOpenStudent360 = async (stuId: string) => {
    const stu = students.find((s) => s.studentId === stuId);
    if (!stu) return;
    setProfileStudent(stu);
    setIsStudentProfileOpen(true);

    try {
      const [allAtt, allAss] = await Promise.all([
        attendanceService.getAll(),
        assessmentService.getAll(),
      ]);

      const stuAtt = allAtt.filter((a) => a.studentId === stuId);
      setStudentAttendance(stuAtt);

      const stuScores: { title: string; score: number }[] = [];
      allAss.forEach((ass) => {
        const sc = ass.scores?.find((s) => s.studentId === stuId);
        if (sc) {
          stuScores.push({ title: ass.title, score: sc.score });
        }
      });
      setStudentGrades(stuScores);
    } catch (e) {
      console.error(e);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.problem.trim() || !formData.action.trim()) {
      showToast('Uraian masalah dan tindakan bimbingan wajib diisi.', 'warning');
      return;
    }

    setActionLoading(true);
    try {
      const stu = students.find((s) => s.studentId === formData.studentId);

      const payload = {
        ...formData,
        teacherId: profile?.teacherId || profile?.uid || 'GURU-001',
        teacherName: profile?.displayName || 'Guru Wali',
        studentName: stu?.name || 'Siswa',
        nis: stu?.nis || '',
        className: stu?.className || stu?.classId || '',
      };

      if (editingGuidance) {
        await guidanceService.update(editingGuidance.guidanceId, payload);
        await auditService.log('Update Bimbingan', 'guidance', editingGuidance.guidanceId, `Mengubah bimbingan ${stu?.name}`);
        showToast('Data bimbingan berhasil diperbarui.', 'success');
      } else {
        const id = await guidanceService.create({
          guidanceId: '',
          ...payload,
        }, profile);
        await auditService.log('Tambah Bimbingan', 'guidance', id, `Menambah bimbingan ${stu?.name}`);
        showToast('Catatan bimbingan berhasil disimpan.', 'success');
      }
      setIsAddEditOpen(false);
      await loadData();
    } catch (err: any) {
      showToast('Gagal menyimpan bimbingan: ' + err.message, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!guidanceToDelete) return;
    setActionLoading(true);
    try {
      await guidanceService.delete(guidanceToDelete.guidanceId);
      await auditService.log('Hapus Bimbingan', 'guidance', guidanceToDelete.guidanceId, `Menghapus catatan bimbingan ${guidanceToDelete.studentName}`);
      showToast('Catatan bimbingan berhasil dihapus.', 'success');
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
      {profile?.role === 'guru' && !isAssigned && (
        <div className="p-4 sm:p-5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-xs flex items-center gap-2.5 shadow-xs">
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
          <div>
            <p className="font-bold">Penugasan Rombel Belum Tersedia</p>
            <p className="text-[11px] mt-0.5">Akun Anda belum memiliki penetapan wali kelas resmi dari Administrator Sekolah.</p>
          </div>
        </div>
      )}

      {/* Top Toolbar */}
      <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari nama siswa, masalah, atau tindakan..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
        </div>

        {/* Filters & Button */}
        <div className="flex flex-wrap items-center gap-2.5">
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-800 dark:text-slate-200"
          >
            <option value="all">Semua Kategori</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-800 dark:text-slate-200"
          >
            <option value="all">Semua Status</option>
            <option value="open">Menunggu (Open)</option>
            <option value="in_progress">Dalam Proses</option>
            <option value="resolved">Selesai (Resolved)</option>
          </select>

          <button
            onClick={handleOpenAdd}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all shadow-blue-500/20"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Bimbingan</span>
          </button>
        </div>
      </div>

      {/* Grid of Guidance Cases */}
      {loading ? (
        <div className="p-12 text-center text-xs text-slate-400">
          Memuat catatan bimbingan guru wali...
        </div>
      ) : filteredList.length === 0 ? (
        <EmptyState
          icon={HeartHandshake}
          title="Belum Ada Catatan Bimbingan"
          description="Catat pendampingan belajar, konseling karakter, atau pembinaan kedisiplinan siswa wali Anda."
          actionLabel="Tambah Catatan Bimbingan"
          onAction={handleOpenAdd}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredList.map((g) => {
            const statusBadge = {
              open: { label: 'Terbuka', bg: 'bg-amber-50 text-amber-700 border-amber-200' },
              in_progress: { label: 'Diproses', bg: 'bg-blue-50 text-blue-700 border-blue-200' },
              resolved: { label: 'Tuntas', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
            }[g.status];

            return (
              <div
                key={g.guidanceId}
                className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs hover:shadow-md transition-all flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg">
                      {g.category}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusBadge.bg}`}
                    >
                      {statusBadge.label}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-bold flex items-center justify-center text-xs">
                      {g.studentName?.charAt(0)}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
                        {g.studentName}
                      </h4>
                      <p className="text-[10px] text-slate-400">
                        NIS: {g.nis} • {g.className}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2 mt-3 text-xs">
                    <div>
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        Permasalahan:
                      </span>
                      <p className="text-slate-600 dark:text-slate-400 line-clamp-2 mt-0.5 leading-relaxed">
                        {g.problem}
                      </p>
                    </div>

                    <div>
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        Tindakan Solusi:
                      </span>
                      <p className="text-slate-600 dark:text-slate-400 line-clamp-2 mt-0.5 leading-relaxed">
                        {g.action}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400">
                    {g.date}
                  </span>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenStudent360(g.studentId)}
                      className="px-2 py-1 rounded-lg text-[11px] font-semibold text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors flex items-center gap-1"
                      title="Lihat Profil 360° Siswa"
                    >
                      <User className="w-3 h-3" />
                      <span>Profil</span>
                    </button>
                    <button
                      onClick={() => handleOpenEdit(g)}
                      className="p-1 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-slate-100 transition-colors"
                      title="Edit"
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        setGuidanceToDelete(g);
                        setIsDeleteOpen(true);
                      }}
                      className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                      title="Hapus"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Guidance Modal */}
      <Modal
        isOpen={isAddEditOpen}
        onClose={() => setIsAddEditOpen(false)}
        title={editingGuidance ? 'Edit Catatan Bimbingan' : 'Tambah Bimbingan Guru Wali'}
        subtitle="Dokumentasikan kasus pembinaan siswa dan rencana tindak lanjut"
        maxWidth="2xl"
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Pilih Siswa *
              </label>
              <select
                value={formData.studentId}
                onChange={(e) => setFormData({ ...formData, studentId: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                {students.map((s) => (
                  <option key={s.studentId} value={s.studentId}>
                    {s.name} ({s.className})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Tanggal Bimbingan *
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
                Kategori Bimbingan *
              </label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value as GuidanceCategory })}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Uraian Masalah / Perilaku *
            </label>
            <textarea
              rows={3}
              value={formData.problem}
              onChange={(e) => setFormData({ ...formData, problem: e.target.value })}
              placeholder="Ceritakan latar belakang kondisi atau kesulitan yang dialami siswa..."
              required
              className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Tindakan Penanganan / Bimbingan *
            </label>
            <textarea
              rows={2}
              value={formData.action}
              onChange={(e) => setFormData({ ...formData, action: e.target.value })}
              placeholder="Langkah konseling, diskusi dengan orang tua, atau strategi bimbingan..."
              required
              className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Rencana Tindak Lanjut (Follow-Up)
              </label>
              <input
                type="text"
                value={formData.followUp}
                onChange={(e) => setFormData({ ...formData, followUp: e.target.value })}
                placeholder="Evaluasi berkala / pemantauan mingguan..."
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Status Kasus
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as GuidanceStatus })}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                <option value="in_progress">Dalam Proses Bimbingan</option>
                <option value="resolved">Tuntas / Teratasi</option>
                <option value="open">Menunggu Tindakan</option>
              </select>
            </div>
          </div>

          <div className="pt-3 flex items-center justify-end gap-2.5 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsAddEditOpen(false)}
              className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={actionLoading}
              className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 disabled:opacity-50"
            >
              {actionLoading && <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
              <span>{editingGuidance ? 'Simpan Perubahan' : 'Simpan Bimbingan'}</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* Student 360° Profile Modal */}
      <Modal
        isOpen={isStudentProfileOpen}
        onClose={() => setIsStudentProfileOpen(false)}
        title="Profil Siswa 360°"
        subtitle="Riwayat terpadu presensi harian, rekap penilaian, dan catatan bimbingan"
        maxWidth="2xl"
      >
        {profileStudent && (
          <div className="space-y-4 text-xs">
            {/* Header info */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-slate-800 dark:to-slate-800/80 border border-blue-100 dark:border-slate-700 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white font-bold text-base flex items-center justify-center">
                  {profileStudent.name.charAt(0)}
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                    {profileStudent.name}
                  </h4>
                  <p className="text-slate-500">
                    NIS: {profileStudent.nis} • NISN: {profileStudent.nisn || '-'} • {profileStudent.className}
                  </p>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-blue-600 text-white font-bold text-[10px]">
                Siswa Aktif
              </span>
            </div>

            {/* Presensi History */}
            <div>
              <h5 className="font-bold text-slate-800 dark:text-slate-200 mb-2">
                Riwayat Presensi Terbaru ({studentAttendance.length} Sesi):
              </h5>
              <div className="max-h-36 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 border rounded-xl p-2 bg-slate-50 dark:bg-slate-800/40">
                {studentAttendance.length === 0 ? (
                  <div className="p-3 text-slate-400 text-center">Belum ada log presensi.</div>
                ) : (
                  studentAttendance.map((a) => (
                    <div key={a.attendanceId} className="py-1.5 flex items-center justify-between">
                      <span className="font-mono text-slate-500">{a.date}</span>
                      <span className="font-semibold">{a.subjectName || 'Harian'}</span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          a.status === 'Hadir'
                            ? 'text-emerald-700 bg-emerald-100'
                            : 'text-amber-700 bg-amber-100'
                        }`}
                      >
                        {a.status}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Nilai / Asesmen */}
            <div>
              <h5 className="font-bold text-slate-800 dark:text-slate-200 mb-2">
                Riwayat Penilaian:
              </h5>
              <div className="max-h-36 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 border rounded-xl p-2 bg-slate-50 dark:bg-slate-800/40">
                {studentGrades.length === 0 ? (
                  <div className="p-3 text-slate-400 text-center">Belum ada riwayat nilai terdata.</div>
                ) : (
                  studentGrades.map((g, i) => (
                    <div key={i} className="py-1.5 flex items-center justify-between">
                      <span className="font-medium text-slate-800 dark:text-slate-200">{g.title}</span>
                      <span className="font-mono font-bold text-blue-600">{g.score}</span>
                    </div>
                  ))
                )}
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
        title="Hapus Catatan Bimbingan?"
        message={`Apakah Anda yakin ingin menghapus catatan bimbingan untuk "${guidanceToDelete?.studentName}"?`}
        loading={actionLoading}
      />
    </div>
  );
};
