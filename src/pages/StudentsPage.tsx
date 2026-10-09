import {
  AlertCircle,
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  Edit,
  FileSpreadsheet,
  Filter,
  MoreVertical,
  Plus,
  QrCode,
  Search,
  Trash2,
  Upload,
  User,
  Users,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import React, { useEffect, useMemo, useState } from 'react';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { EmptyState } from '../components/common/EmptyState';
import { Modal } from '../components/common/Modal';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { authorizationService } from '../services/authorizationService';
import { auditService } from '../services/auditService';
import { classService, groupClassesBySDGrade } from '../services/classService';
import { studentService } from '../services/studentService';
import { SchoolClass, Student } from '../types';

export const StudentsPage: React.FC = () => {
  const { profile } = useAuth();
  const { showToast } = useNotification();

  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtered classes strictly based on official role & assignments
  const permittedClasses = useMemo(() => {
    if (profile?.role === 'admin') return classes;
    return authorizationService.filterClassesForUser(classes, profile);
  }, [classes, profile]);

  const groupedSDClasses = useMemo(() => {
    return groupClassesBySDGrade(classes);
  }, [classes]);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [filterClass, setFilterClass] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'name' | 'nis' | 'class'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Modals
  const [isAddEditOpen, setIsAddEditOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [studentToDelete, setStudentToDelete] = useState<Student | null>(null);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [studentForQr, setStudentForQr] = useState<Student | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importClassId, setImportClassId] = useState('');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    nis: '',
    nisn: '',
    name: '',
    gender: 'L' as 'L' | 'P',
    classId: '',
    status: 'active' as 'active' | 'inactive',
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [stu, cls] = await Promise.all([
        studentService.getAll(profile),
        classService.getAll(),
      ]);
      setStudents(stu);
      setClasses(cls);

      const permitted = profile?.role === 'admin' ? cls : authorizationService.filterClassesForUser(cls, profile);
      if (permitted.length > 0) {
        if (!importClassId || !permitted.some((c) => c.classId === importClassId)) {
          setImportClassId(permitted[0].classId);
        }
        if (profile?.role === 'guru') {
          if (permitted.length === 1) {
            setFilterClass(permitted[0].classId);
          } else if (filterClass !== 'all' && !permitted.some((c) => c.classId === filterClass)) {
            setFilterClass(permitted[0].classId);
          }
        }
      }
    } catch (err: any) {
      showToast('Gagal memuat data siswa: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [profile?.uid, profile?.role]);

  // Filtered & Sorted list
  const filteredStudents = useMemo(() => {
    return students
      .filter((s) => {
        const matchesSearch =
          s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          s.nis.includes(searchQuery) ||
          s.nisn.includes(searchQuery);
        const matchesClass = filterClass === 'all' || s.classId === filterClass;
        const matchesStatus = filterStatus === 'all' || s.status === filterStatus;
        return matchesSearch && matchesClass && matchesStatus;
      })
      .sort((a, b) => {
        let comp = 0;
        if (sortBy === 'name') comp = a.name.localeCompare(b.name);
        else if (sortBy === 'nis') comp = a.nis.localeCompare(b.nis);
        else if (sortBy === 'class') comp = (a.className || '').localeCompare(b.className || '');
        return sortOrder === 'asc' ? comp : -comp;
      });
  }, [students, searchQuery, filterClass, filterStatus, sortBy, sortOrder]);

  const totalPages = Math.ceil(filteredStudents.length / pageSize) || 1;
  const paginatedStudents = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredStudents.slice(start, start + pageSize);
  }, [filteredStudents, currentPage, pageSize]);

  const handleOpenAdd = () => {
    setEditingStudent(null);
    setFormData({
      nis: '',
      nisn: '',
      name: '',
      gender: 'L',
      classId: permittedClasses[0]?.classId || classes[0]?.classId || '',
      status: 'active',
    });
    setIsAddEditOpen(true);
  };

  const handleOpenEdit = (stu: Student) => {
    setEditingStudent(stu);
    setFormData({
      nis: stu.nis,
      nisn: stu.nisn,
      name: stu.name,
      gender: stu.gender,
      classId: stu.classId,
      status: stu.status,
    });
    setIsAddEditOpen(true);
  };

  const handleSaveStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.nis.trim()) {
      showToast('Nama dan NIS wajib diisi.', 'warning');
      return;
    }

    setActionLoading(true);
    try {
      const selectedClass = classes.find((c) => c.classId === formData.classId);
      const className = selectedClass ? selectedClass.name : formData.classId;

      if (editingStudent) {
        await studentService.update(editingStudent.studentId, {
          ...formData,
          className,
        });
        await auditService.log('Update Siswa', 'students', editingStudent.studentId, `Mengubah data ${formData.name}`);
        showToast('Data siswa berhasil diperbarui.', 'success');
      } else {
        const newId = await studentService.create({
          studentId: '',
          ...formData,
          className,
        }, profile);
        await auditService.log('Tambah Siswa', 'students', newId, `Menambah siswa baru ${formData.name}`);
        showToast('Siswa baru berhasil ditambahkan.', 'success');
      }
      setIsAddEditOpen(false);
      await loadData();
    } catch (err: any) {
      showToast('Gagal menyimpan data: ' + err.message, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!studentToDelete) return;
    setActionLoading(true);
    try {
      await studentService.delete(studentToDelete.studentId, true);
      await auditService.log(
        'Hapus Siswa',
        'students',
        studentToDelete.studentId,
        `Menghapus siswa ${studentToDelete.name} secara permanen dari server`
      );
      showToast(`Data siswa "${studentToDelete.name}" berhasil dihapus dari server.`, 'success');
      setStudents((prev) => prev.filter((s) => s.studentId !== studentToDelete.studentId));
      setIsDeleteOpen(false);
      setStudentToDelete(null);
      await loadData();
    } catch (err: any) {
      showToast('Gagal menghapus siswa: ' + err.message, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importFile) {
      showToast('Pilih file Excel (.xlsx) terlebih dahulu.', 'warning');
      return;
    }

    setActionLoading(true);
    try {
      const cls = classes.find((c) => c.classId === importClassId);
      const res = await studentService.importFromExcel(importFile, importClassId, cls?.name);
      showToast(`Berhasil mengimpor ${res.success} siswa!`, 'success');
      if (res.errors.length > 0) {
        showToast(`${res.errors.length} baris gagal/dilewati.`, 'warning');
      }
      setIsImportModalOpen(false);
      setImportFile(null);
      await loadData();
    } catch (err: any) {
      showToast('Gagal mengimpor file: ' + err.message, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleExportExcel = () => {
    if (filteredStudents.length === 0) {
      showToast('Tidak ada data siswa untuk diekspor.', 'warning');
      return;
    }
    studentService.exportToExcel(filteredStudents, 'Data_Siswa');
    showToast('File Excel berhasil diunduh.', 'success');
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Action Toolbar */}
      <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Cari nama, NIS, atau NISN siswa..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all placeholder-slate-400"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setIsImportModalOpen(true)}
            className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <Upload className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span>Import Excel</span>
          </button>

          <button
            onClick={handleExportExcel}
            className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Export Excel</span>
          </button>

          <button
            onClick={handleOpenAdd}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all shadow-blue-500/20"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Siswa</span>
          </button>
        </div>
      </div>

      {/* Filter & Sorting Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 font-medium">
            <Filter className="w-3.5 h-3.5" />
            <span>Filter:</span>
          </div>

          {/* Filter Class */}
          {profile?.role === 'guru' && permittedClasses.length === 0 ? (
            <div className="px-3 py-1.5 rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 text-xs font-semibold flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
              <span>Penugasan Belum Tersedia</span>
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
              onChange={(e) => {
                setFilterClass(e.target.value);
                setCurrentPage(1);
              }}
              className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-medium focus:outline-none focus:ring-1 focus:ring-blue-500"
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
              onChange={(e) => {
                setFilterClass(e.target.value);
                setCurrentPage(1);
              }}
              className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-medium focus:outline-none focus:ring-1 focus:ring-blue-500"
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

          {/* Filter Status */}
          <select
            value={filterStatus}
            onChange={(e) => {
              setFilterStatus(e.target.value);
              setCurrentPage(1);
            }}
            className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-medium focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="all">Semua Status</option>
            <option value="active">Aktif</option>
            <option value="inactive">Non-Aktif</option>
          </select>
        </div>

        {/* Sort Controls */}
        <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
          <span>Urutkan:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-medium"
          >
            <option value="name">Nama Siswa</option>
            <option value="nis">NIS</option>
            <option value="class">Kelas</option>
          </select>
          <button
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold"
          >
            {sortOrder === 'asc' ? '↑ A-Z' : '↓ Z-A'}
          </button>
        </div>
      </div>

      {/* Main Table / Mobile Cards */}
      <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-400">
            <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            Memuat data siswa dari Firestore...
          </div>
        ) : filteredStudents.length === 0 ? (
          <EmptyState
            icon={Users}
            title="Tidak Ada Data Siswa"
            description="Tidak ditemukan data siswa sesuai filter atau database belum memiliki entri."
            actionLabel="Tambah Siswa Baru"
            onAction={handleOpenAdd}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  <th className="py-3.5 px-4 w-12 text-center">No</th>
                  <th className="py-3.5 px-4">Nama Siswa</th>
                  <th className="py-3.5 px-4">NIS / NISN</th>
                  <th className="py-3.5 px-4">JK</th>
                  <th className="py-3.5 px-4">Kelas</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-center">QR Code</th>
                  <th className="py-3.5 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs text-slate-700 dark:text-slate-300">
                {paginatedStudents.map((stu, index) => {
                  const num = (currentPage - 1) * pageSize + index + 1;
                  return (
                    <tr
                      key={stu.studentId}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/30 transition-colors group"
                    >
                      <td className="py-3.5 px-4 text-center font-medium text-slate-400">
                        {num}
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-white">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-bold flex items-center justify-center text-[11px] shrink-0">
                            {stu.name.charAt(0)}
                          </div>
                          <span>{stu.name}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-500 dark:text-slate-400">
                        {stu.nis} / {stu.nisn || '-'}
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${
                            stu.gender === 'L'
                              ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400'
                              : 'bg-pink-50 dark:bg-pink-950/40 text-pink-600 dark:text-pink-400'
                          }`}
                        >
                          {stu.gender === 'L' ? 'Laki-laki' : 'Perempuan'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-medium">
                        {stu.className || stu.classId}
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            stu.status === 'active'
                              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400'
                              : 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400'
                          }`}
                        >
                          {stu.status === 'active' ? 'Aktif' : 'Non-Aktif'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <button
                          onClick={() => {
                            setStudentForQr(stu);
                            setIsQrModalOpen(true);
                          }}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors"
                          title="Lihat QR Code"
                        >
                          <QrCode className="w-4 h-4 mx-auto" />
                        </button>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleOpenEdit(stu)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            title="Edit Data"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              setStudentToDelete(stu);
                              setIsDeleteOpen(true);
                            }}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                            title="Hapus / Nonaktifkan"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {!loading && filteredStudents.length > 0 && (
          <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>
              Menampilkan {paginatedStudents.length} dari {filteredStudents.length} siswa
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="font-semibold px-2">
                {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add / Edit Student Modal */}
      <Modal
        isOpen={isAddEditOpen}
        onClose={() => setIsAddEditOpen(false)}
        title={editingStudent ? 'Edit Data Siswa' : 'Tambah Siswa Baru'}
        subtitle="Pastikan data identitas siswa sesuai Dapodik / buku induk sekolah"
      >
        <form onSubmit={handleSaveStudent} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Nama Lengkap Siswa *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Contoh: Muhammad Farhan"
              required
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                NIS (Nomor Induk Siswa) *
              </label>
              <input
                type="text"
                value={formData.nis}
                onChange={(e) => setFormData({ ...formData, nis: e.target.value })}
                placeholder="24101"
                required
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                NISN (10 Digit)
              </label>
              <input
                type="text"
                value={formData.nisn}
                onChange={(e) => setFormData({ ...formData, nisn: e.target.value })}
                placeholder="0089123411"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Jenis Kelamin
              </label>
              <select
                value={formData.gender}
                onChange={(e) => setFormData({ ...formData, gender: e.target.value as any })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                <option value="L">Laki-laki (L)</option>
                <option value="P">Perempuan (P)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Rombel / Kelas {profile?.role === 'guru' ? 'Binaan' : '(SD Kelas 1 - 6)'} *
              </label>
              {profile?.role === 'guru' && permittedClasses.length === 1 ? (
                <div className="w-full px-3.5 py-2.5 rounded-xl border border-[#D9A62E]/50 bg-amber-50 dark:bg-[#172D4B] text-[#102A50] dark:text-[#FFD675] text-xs sm:text-sm font-bold flex items-center justify-between">
                  <span>{permittedClasses[0].name} (Rombel Binaan Anda)</span>
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
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Status Siswa
            </label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              <option value="active">Aktif</option>
              <option value="inactive">Non-Aktif / Pindah</option>
            </select>
          </div>

          <div className="pt-4 flex items-center justify-end gap-2.5 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsAddEditOpen(false)}
              className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={actionLoading}
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 disabled:opacity-50"
            >
              {actionLoading && <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
              <span>{editingStudent ? 'Simpan Perubahan' : 'Tambahkan Siswa'}</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* QR Code Single Modal */}
      <Modal
        isOpen={isQrModalOpen}
        onClose={() => setIsQrModalOpen(false)}
        title="Barcode QR Code Siswa"
        subtitle="Gunakan ID QR ini untuk pemindaian presensi otomatis"
        maxWidth="sm"
      >
        {studentForQr && (
          <div className="flex flex-col items-center text-center p-2">
            <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-inner mb-4">
              <QRCodeSVG
                value={studentForQr.studentId}
                size={160}
                level="M"
                includeMargin
              />
            </div>
            <h4 className="text-base font-bold text-slate-900 dark:text-white">
              {studentForQr.name}
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              NIS: {studentForQr.nis} • Kelas: {studentForQr.className}
            </p>
            <p className="font-mono text-[11px] text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2.5 py-1 rounded-lg mt-3">
              ID: {studentForQr.studentId}
            </p>
          </div>
        )}
      </Modal>

      {/* Import Excel Modal */}
      <Modal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        title="Import Data Siswa dari Excel"
        subtitle="Unggah file .xlsx berisi kolom Nama, NIS, NISN, dan Jenis Kelamin"
      >
        <form onSubmit={handleImportSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Masukkan ke Kelas / Rombel Tujuan {profile?.role === 'guru' ? 'Binaan' : '(SD Kelas 1 - 6)'}:
            </label>
            {profile?.role === 'guru' && permittedClasses.length === 1 ? (
              <div className="w-full px-3.5 py-2.5 rounded-xl border border-[#D9A62E]/50 bg-amber-50 dark:bg-[#172D4B] text-[#102A50] dark:text-[#FFD675] text-xs sm:text-sm font-bold flex items-center justify-between">
                <span>{permittedClasses[0].name} (Rombel Binaan Anda)</span>
                <span className="text-[10px] uppercase px-1.5 py-0.5 rounded-full bg-[#102A50] text-[#FFD675] font-black">
                  Terkunci
                </span>
              </div>
            ) : profile?.role === 'guru' ? (
              <select
                value={importClassId}
                onChange={(e) => setImportClassId(e.target.value)}
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
                value={importClassId}
                onChange={(e) => setImportClassId(e.target.value)}
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
              Pilih Berkas Excel (.xlsx / .xls)
            </label>
            <input
              type="file"
              accept=".xlsx, .xls"
              onChange={(e) => setImportFile(e.target.files?.[0] || null)}
              required
              className="w-full text-xs text-slate-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-blue-50 dark:file:bg-blue-950 file:text-blue-700 dark:file:text-blue-300 hover:file:bg-blue-100"
            />
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 text-xs space-y-1">
            <span className="font-semibold block text-slate-800 dark:text-slate-200">
              Format Kolom Excel yang Didukung:
            </span>
            <p>1. <code>Nama Siswa</code> atau <code>Nama</code> (Wajib)</p>
            <p>2. <code>NIS</code> (Opsional/Otomatis)</p>
            <p>3. <code>NISN</code> (Opsional)</p>
            <p>4. <code>Jenis Kelamin</code> atau <code>JK</code> (L/P)</p>
          </div>

          <div className="pt-3 flex items-center justify-end gap-2.5 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsImportModalOpen(false)}
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
              <span>Mulai Impor Siswa</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={isDeleteOpen}
        onClose={() => {
          setIsDeleteOpen(false);
          setStudentToDelete(null);
        }}
        onConfirm={handleDeleteConfirm}
        title="Hapus Siswa dari Server?"
        message={`Apakah Anda yakin ingin menghapus data siswa "${studentToDelete?.name}"? Data siswa ini akan dihilangkan secara permanen dari server database.`}
        confirmLabel="Ya, Hapus Permanen"
        isDestructive={true}
        loading={actionLoading}
      />
    </div>
  );
};
