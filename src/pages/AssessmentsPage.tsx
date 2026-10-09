import {
  AlertCircle,
  Award,
  BookOpen,
  Calendar,
  Check,
  CheckSquare,
  ChevronDown,
  Edit,
  Plus,
  Save,
  Search,
  Sparkles,
  Trash2,
  TrendingUp,
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
import { auditService } from '../services/auditService';
import { authorizationService } from '../services/authorizationService';
import { classService, groupClassesBySDGrade } from '../services/classService';
import { studentService } from '../services/studentService';
import { subjectService } from '../services/subjectService';
import {
  Assessment,
  AssessmentType,
  SchoolClass,
  Student,
  Subject,
} from '../types';

export const AssessmentsPage: React.FC = () => {
  const { profile } = useAuth();
  const { showToast } = useNotification();

  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);

  // Filtered classes strictly based on official role & assignments
  const permittedClasses = useMemo(() => {
    if (profile?.role === 'admin') return classes;
    return authorizationService.filterClassesForUser(classes, profile);
  }, [classes, profile]);

  const groupedSDClasses = useMemo(() => {
    return groupClassesBySDGrade(classes);
  }, [classes]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Filter & Active Form
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [assessmentType, setAssessmentType] = useState<AssessmentType>('formatif');
  const [assessmentTitle, setAssessmentTitle] = useState('');
  const [assessmentDate, setAssessmentDate] = useState(new Date().toISOString().slice(0, 10));
  const [maxScore, setMaxScore] = useState<number>(100);
  const [kkm, setKkm] = useState<number>(75);

  // Student Scores Map: studentId -> { score, notes }
  const [scoreMap, setScoreMap] = useState<Record<string, { score: number; notes: string }>>({});

  // History & Edit
  const [editingAssessmentId, setEditingAssessmentId] = useState<string | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [assessmentToDelete, setAssessmentToDelete] = useState<Assessment | null>(null);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        const [cls, sub, ass] = await Promise.all([
          classService.getAll(),
          subjectService.getAll(),
          assessmentService.getAll(profile),
        ]);
        setClasses(cls);
        setSubjects(sub);
        setAssessments(ass);

        const permitted = profile?.role === 'admin' ? cls : authorizationService.filterClassesForUser(cls, profile);
        if (permitted.length > 0) {
          setSelectedClassId(permitted[0].classId);
        }
        if (sub.length > 0) setSelectedSubjectId(sub[0].subjectId);
      } catch (err: any) {
        showToast('Gagal memuat data: ' + err.message, 'error');
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [profile?.uid, profile?.role]);

  // When class changes, fetch students
  useEffect(() => {
    if (!selectedClassId) return;
    const fetchStudents = async () => {
      try {
        const list = await studentService.getByClassId(selectedClassId, profile);
        setStudents(list);

        // Reset score map
        const initial: Record<string, { score: number; notes: string }> = {};
        list.forEach((s) => {
          initial[s.studentId] = { score: 80, notes: '' };
        });
        setScoreMap(initial);
      } catch (e) {
        console.error(e);
      }
    };
    fetchStudents();
  }, [selectedClassId, profile?.uid]);

  const handleScoreChange = (studentId: string, val: string) => {
    const num = Math.max(0, Math.min(maxScore, Number(val) || 0));
    setScoreMap((prev) => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        score: num,
      },
    }));
  };

  const handleNotesChange = (studentId: string, notes: string) => {
    setScoreMap((prev) => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        notes,
      },
    }));
  };

  // Live Statistics
  const stats = useMemo(() => {
    const scoreList = students.map((s) => ({
      score: scoreMap[s.studentId]?.score ?? 0,
    }));
    return assessmentService.calculateStats(scoreList, kkm, maxScore);
  }, [students, scoreMap, kkm, maxScore]);

  const handleSaveAssessment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assessmentTitle.trim()) {
      showToast('Judul penilaian wajib diisi.', 'warning');
      return;
    }
    if (students.length === 0) {
      showToast('Tidak ada siswa di kelas ini untuk dinilai.', 'warning');
      return;
    }

    setSaving(true);
    try {
      const cls = classes.find((c) => c.classId === selectedClassId);
      const sub = subjects.find((s) => s.subjectId === selectedSubjectId);

      const studentScores = students.map((s) => ({
        studentId: s.studentId,
        studentName: s.name,
        nis: s.nis,
        score: scoreMap[s.studentId]?.score ?? 0,
        notes: scoreMap[s.studentId]?.notes ?? '',
      }));

      const payload = {
        classId: selectedClassId,
        className: cls?.name || selectedClassId,
        subjectId: selectedSubjectId,
        subjectName: sub?.name || selectedSubjectId,
        teacherId: profile?.teacherId || profile?.uid || 'GURU-001',
        type: assessmentType,
        title: assessmentTitle.trim(),
        date: assessmentDate,
        maxScore,
        scores: studentScores,
      };

      if (editingAssessmentId) {
        await assessmentService.update(editingAssessmentId, payload);
        await auditService.log('Update Penilaian', 'assessments', editingAssessmentId, `Mengubah ${payload.title}`);
        showToast('Penilaian berhasil diperbarui.', 'success');
      } else {
        const id = await assessmentService.create({
          assessmentId: '',
          ...payload,
        }, profile);
        await auditService.log('Tambah Penilaian', 'assessments', id, `Menambah penilaian ${payload.title}`);
        showToast('Penilaian berhasil disimpan ke Firestore!', 'success');
      }

      setEditingAssessmentId(null);
      setAssessmentTitle('');

      // Refresh assessments list
      const updatedList = await assessmentService.getAll(profile);
      setAssessments(updatedList);
    } catch (err: any) {
      showToast('Gagal menyimpan nilai: ' + err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleLoadAssessmentForEdit = (item: Assessment) => {
    setEditingAssessmentId(item.assessmentId);
    setSelectedClassId(item.classId);
    setSelectedSubjectId(item.subjectId);
    setAssessmentType(item.type);
    setAssessmentTitle(item.title);
    setAssessmentDate(item.date);
    setMaxScore(item.maxScore || 100);

    const newMap: Record<string, { score: number; notes: string }> = {};
    item.scores?.forEach((sc) => {
      newMap[sc.studentId] = {
        score: sc.score,
        notes: sc.notes || '',
      };
    });
    setScoreMap(newMap);
    showToast(`Memuat data penilaian: ${item.title}`, 'info');
  };

  const handleDeleteConfirm = async () => {
    if (!assessmentToDelete) return;
    setSaving(true);
    try {
      await assessmentService.delete(assessmentToDelete.assessmentId);
      await auditService.log('Hapus Penilaian', 'assessments', assessmentToDelete.assessmentId, `Menghapus penilaian ${assessmentToDelete.title}`);
      showToast('Penilaian berhasil dihapus.', 'success');
      setIsDeleteOpen(false);
      const updatedList = await assessmentService.getAll();
      setAssessments(updatedList);
    } catch (err: any) {
      showToast('Gagal menghapus: ' + err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Configuration Header Card */}
      <form onSubmit={handleSaveAssessment} className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 gap-2">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              {editingAssessmentId ? 'Edit Sesi Penilaian' : 'Input Penilaian Kelas Baru'}
            </h3>
            <p className="text-xs text-slate-500">
              Pilih kelas, mata pelajaran, dan masukkan nilai hasil asesmen belajar siswa
            </p>
          </div>

          <div className="flex items-center gap-2">
            {editingAssessmentId && (
              <button
                type="button"
                onClick={() => {
                  setEditingAssessmentId(null);
                  setAssessmentTitle('');
                }}
                className="px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50"
              >
                Batal Edit
              </button>
            )}

            <button
              type="submit"
              disabled={saving || students.length === 0}
              className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all shadow-blue-500/20 disabled:opacity-50"
            >
              {saving ? (
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              <span>{editingAssessmentId ? 'Perbarui Nilai' : 'Simpan Nilai'}</span>
            </button>
          </div>
        </div>

        {/* Form Selectors */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Rombel / Kelas {profile?.role === 'guru' ? 'Binaan' : '(SD Kelas 1 - 6)'}
            </label>
            {profile?.role === 'guru' && permittedClasses.length === 0 ? (
              <div className="px-3 py-2 rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 text-xs font-semibold flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span className="truncate">Penugasan Belum Tersedia</span>
              </div>
            ) : profile?.role === 'guru' && permittedClasses.length === 1 ? (
              <div className="px-3 py-2 rounded-xl border border-[#D9A62E]/50 bg-amber-50/70 dark:bg-[#172D4B]/70 text-[#102A50] dark:text-[#FFD675] text-xs font-bold flex items-center justify-between shadow-xs">
                <span>{permittedClasses[0].name} (Rombel Binaan)</span>
                <span className="text-[10px] uppercase px-1.5 py-0.5 rounded-full bg-[#102A50] text-[#FFD675] font-black">
                  Terkunci
                </span>
              </div>
            ) : profile?.role === 'guru' ? (
              <select
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                {permittedClasses.map((c) => (
                  <option key={c.classId} value={c.classId}>
                    {c.name}
                  </option>
                ))}
              </select>
            ) : (
              <select
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
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
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Mata Pelajaran
            </label>
            <select
              value={selectedSubjectId}
              onChange={(e) => setSelectedSubjectId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              {subjects.map((s) => (
                <option key={s.subjectId} value={s.subjectId}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Jenis Penilaian
            </label>
            <select
              value={assessmentType}
              onChange={(e) => setAssessmentType(e.target.value as AssessmentType)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              <option value="formatif">Asesmen Formatif</option>
              <option value="sumatif">Asesmen Sumatif</option>
              <option value="tugas">Tugas Mandiri / Proyek</option>
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Tanggal Penilaian
            </label>
            <input
              type="date"
              value={assessmentDate}
              onChange={(e) => setAssessmentDate(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Title & Max Score */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="sm:col-span-2">
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Judul / Materi Penilaian *
            </label>
            <input
              type="text"
              value={assessmentTitle}
              onChange={(e) => setAssessmentTitle(e.target.value)}
              placeholder="Contoh: Formatif 2: Operasi Pecahan dan Aljabar"
              required
              className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                KKM Sekolah
              </label>
              <input
                type="number"
                value={kkm}
                onChange={(e) => setKkm(Number(e.target.value) || 75)}
                min="0"
                max="100"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Nilai Maks.
              </label>
              <input
                type="number"
                value={maxScore}
                onChange={(e) => setMaxScore(Number(e.target.value) || 100)}
                min="10"
                max="100"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>
        </div>
      </form>

      {/* Real-time Calculation Statistics Pills */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-500">Rata-Rata Kelas</span>
          <span className="text-lg font-extrabold text-blue-600 dark:text-blue-400 font-mono">
            {stats.average}
          </span>
        </div>
        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-500">Nilai Tertinggi</span>
          <span className="text-lg font-extrabold text-emerald-600 font-mono">
            {stats.highest}
          </span>
        </div>
        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-500">Nilai Terendah</span>
          <span className="text-lg font-extrabold text-rose-600 font-mono">
            {stats.lowest}
          </span>
        </div>
        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-500">Tuntas KKM</span>
          <span className="text-lg font-extrabold text-slate-900 dark:text-white font-mono">
            {stats.passedCount} / {stats.total}
          </span>
        </div>
        <div className="p-3.5 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/70 dark:border-emerald-900/40 flex items-center justify-between text-emerald-800 dark:text-emerald-300 col-span-2 sm:col-span-1">
          <span className="text-xs font-semibold">Ketuntasan</span>
          <span className="text-lg font-extrabold font-mono">
            {stats.passPercentage}%
          </span>
        </div>
      </div>

      {/* Grade Entry Table */}
      <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="p-4 sm:px-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckSquare className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Tabel Input Nilai Siswa ({students.length})
            </h3>
          </div>
          <span className="text-xs text-slate-400">
            Nilai otomatis diverifikasi terhadap KKM {kkm}
          </span>
        </div>

        {students.length === 0 ? (
          <EmptyState
            icon={Users}
            title="Tidak Ada Siswa di Kelas Ini"
            description="Pilih kelas yang memiliki data siswa aktif."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-4 w-12 text-center">No</th>
                  <th className="py-3 px-4">Nama Siswa</th>
                  <th className="py-3 px-4">NIS</th>
                  <th className="py-3 px-4 w-32">Nilai (0 - {maxScore})</th>
                  <th className="py-3 px-4 w-28 text-center">Status KKM</th>
                  <th className="py-3 px-4">Catatan Perkembangan Siswa</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-700 dark:text-slate-300">
                {students.map((stu, index) => {
                  const currentScore = scoreMap[stu.studentId]?.score ?? 0;
                  const isPassed = currentScore >= kkm;
                  return (
                    <tr key={stu.studentId} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 px-4 text-center text-slate-400 font-medium">
                        {index + 1}
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">
                        {stu.name}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-500">
                        {stu.nis}
                      </td>
                      <td className="py-3 px-4">
                        <input
                          type="number"
                          min="0"
                          max={maxScore}
                          value={currentScore}
                          onChange={(e) => handleScoreChange(stu.studentId, e.target.value)}
                          className={`w-24 px-3 py-1.5 rounded-xl border text-center font-bold text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                            isPassed
                              ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50/40 text-emerald-800 dark:text-emerald-200'
                              : 'border-rose-300 dark:border-rose-800 bg-rose-50/40 text-rose-800 dark:text-rose-200'
                          }`}
                        />
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            isPassed
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                              : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                          }`}
                        >
                          {isPassed ? 'Tuntas' : 'Remedial'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <input
                          type="text"
                          value={scoreMap[stu.studentId]?.notes || ''}
                          onChange={(e) => handleNotesChange(stu.studentId, e.target.value)}
                          placeholder="Catatan umpan balik..."
                          className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* History of Saved Assessments */}
      <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
            Riwayat Penilaian Tersimpan ({assessments.length})
          </h3>
          <span className="text-xs text-slate-400">Data penilaian tersimpan di Cloud Firestore</span>
        </div>

        {assessments.length === 0 ? (
          <div className="text-xs text-slate-400 py-4 text-center">
            Belum ada riwayat penilaian. Simpan formulir di atas untuk mencatat asesmen pertama.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {assessments.map((item) => (
              <div
                key={item.assessmentId}
                className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 hover:border-blue-300 transition-colors flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                      {item.type}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {item.date}
                    </span>
                  </div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white leading-snug">
                    {item.title}
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                    {item.className} • {item.subjectName}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {item.scores?.length || 0} Siswa dinilai
                  </p>
                </div>

                <div className="mt-3 pt-2.5 border-t border-slate-200/60 dark:border-slate-800 flex items-center justify-end gap-1.5">
                  <button
                    onClick={() => handleLoadAssessmentForEdit(item)}
                    className="px-2.5 py-1 rounded-lg text-xs font-semibold text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors flex items-center gap-1"
                  >
                    <Edit className="w-3.5 h-3.5" />
                    <span>Edit</span>
                  </button>
                  <button
                    onClick={() => {
                      setAssessmentToDelete(item);
                      setIsDeleteOpen(true);
                    }}
                    className="p-1 rounded-lg text-slate-400 hover:text-rose-600 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        onConfirm={handleDeleteConfirm}
        title="Hapus Rekap Penilaian?"
        message={`Apakah Anda yakin ingin menghapus data penilaian "${assessmentToDelete?.title}"?`}
        loading={saving}
      />
    </div>
  );
};
