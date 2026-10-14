import {
  AlertCircle,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Edit,
  FileCheck,
  FileSpreadsheet,
  FileText,
  Filter,
  MoreVertical,
  Plus,
  QrCode,
  Search,
  Sparkles,
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
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [previewData, setPreviewData] = useState<{
    totalRows: number;
    previewRows: Array<{
      no: number;
      nis: string;
      nisn: string;
      name: string;
      gender: 'L' | 'P';
      className: string;
      status: string;
    }>;
    errors: string[];
  } | null>(null);
  const [parsingPreview, setParsingPreview] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    nis: '',
    nisn: '',
    name: '',
    gender: 'L' as 'L' | 'P',
    classId: '',
    status: 'active' as 'active' | 'inactive',
  });

  const [isPurgeSampleModalOpen, setIsPurgeSampleModalOpen] = useState(false);

  // Detect system demo/sample students
  const sampleStudentsCount = useMemo(() => {
    return students.filter(
      (s) =>
        s.studentId.startsWith('STU-1A-') ||
        s.studentId.startsWith('STU-2A-') ||
        s.studentId.startsWith('STU-6A-') ||
        ['24101', '24102', '24103', '24104', '24105', '23101', '23102', '23103', '23104', '23105', '20031', '20032', '20033', '20034', '20035'].includes(s.nis)
    ).length;
  }, [students]);

  const handlePurgeSampleStudents = async () => {
    setActionLoading(true);
    try {
      const res = await studentService.removeSampleStudents();
      showToast(
        `Berhasil membersihkan server: ${res.studentsRemoved} siswa contoh, ${res.attendanceCleaned} presensi contoh, dan ${res.assessmentsCleaned} nilai terkait telah dihapus tuntas dari database server.`,
        'success'
      );
      await auditService.log(
        'Bersihkan Data Demo',
        'students',
        'all',
        `Menghapus ${res.studentsRemoved} siswa demo, ${res.attendanceCleaned} presensi demo secara permanen dari server`
      );
      await loadData();
    } catch (err: any) {
      showToast('Gagal membersihkan data contoh: ' + err.message, 'error');
    } finally {
      setActionLoading(false);
      setIsPurgeSampleModalOpen(false);
    }
  };

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
      const res = await studentService.delete(studentToDelete.studentId, true, {
        id: studentToDelete.id,
        nis: studentToDelete.nis,
        name: studentToDelete.name,
      });
      await auditService.log(
        'Hapus Siswa',
        'students',
        studentToDelete.studentId,
        `Menghapus siswa ${studentToDelete.name} (${studentToDelete.studentId}) secara permanen dari server beserta data terkait (${res.attendanceCleaned} presensi, ${res.assessmentsCleaned} nilai)`
      );
      const detailInfo =
        res.attendanceCleaned > 0 || res.assessmentsCleaned > 0
          ? ` (${res.attendanceCleaned} presensi & ${res.assessmentsCleaned} nilai terkait ikut dibersihkan)`
          : '';
      showToast(
        `Data siswa "${studentToDelete.name}" berhasil dihapus permanen dari server database${detailInfo}.`,
        'success'
      );
      setStudents((prev) =>
        prev.filter(
          (s) =>
            s.studentId !== studentToDelete.studentId && s.id !== studentToDelete.id
        )
      );
      setIsDeleteOpen(false);
      setStudentToDelete(null);
      await loadData();
    } catch (err: any) {
      showToast('Gagal menghapus siswa: ' + err.message, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const getSelectedClassName = () => {
    if (filterClass !== 'all') {
      const c = classes.find((cls) => cls.classId === filterClass);
      if (c) return c.name;
    }
    if (permittedClasses.length > 0) {
      return permittedClasses[0].name;
    }
    return 'Kelas 1A';
  };

  const handleDownloadTemplate = () => {
    const clsName = getSelectedClassName();
    studentService.downloadTemplate(clsName);
    showToast(`Template Excel resmi (${clsName}) berhasil diunduh. Silakan isi dan kirim melalui menu Import Excel.`, 'success');
    setIsExportMenuOpen(false);
  };

  const handleExportDataExcel = () => {
    const clsName = getSelectedClassName();
    if (filteredStudents.length === 0) {
      studentService.downloadTemplate(clsName);
      showToast('Data siswa kosong. Mengunduh format Template Excel kosong untuk Anda isi...', 'info');
      setIsExportMenuOpen(false);
      return;
    }
    studentService.exportToExcel(
      filteredStudents,
      `Data_Siswa_${clsName.replace(/\s+/g, '_')}`,
      clsName
    );
    showToast(`File Excel format template (${filteredStudents.length} siswa) berhasil diunduh.`, 'success');
    setIsExportMenuOpen(false);
  };

  const handleFileChange = async (file: File | null) => {
    setImportFile(file);
    setPreviewError(null);
    if (!file) {
      setPreviewData(null);
      return;
    }
    setParsingPreview(true);
    try {
      const res = await studentService.parseExcelPreview(file);
      setPreviewData(res);
      if (res.totalRows === 0) {
        setPreviewError('Tidak ada baris data siswa yang terdeteksi. Pastikan kolom "Nama Siswa" terisi.');
      }
    } catch (err: any) {
      setPreviewError('Gagal membaca file Excel: ' + (err.message || 'Pastikan file berekstensi .xlsx atau .xls'));
      setPreviewData(null);
    } finally {
      setParsingPreview(false);
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
      const res = await studentService.importFromExcel(importFile, importClassId, cls?.name, classes);
      showToast(`Berhasil mengirim & mengimpor ${res.success} siswa ke server database!`, 'success');
      if (res.errors.length > 0) {
        showToast(`${res.errors.length} baris dilewati karena format tidak sesuai.`, 'warning');
      }
      setIsImportModalOpen(false);
      setImportFile(null);
      setPreviewData(null);
      setPreviewError(null);
      await loadData();
    } catch (err: any) {
      showToast('Gagal mengimpor file: ' + err.message, 'error');
    } finally {
      setActionLoading(false);
    }
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
          {/* Import Excel */}
          <button
            onClick={() => {
              setPreviewData(null);
              setPreviewError(null);
              setImportFile(null);
              setIsImportModalOpen(true);
            }}
            className="px-3.5 py-2 rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/60 dark:bg-blue-950/40 hover:bg-blue-100/70 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-300 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Import data siswa dari template file Excel"
          >
            <Upload className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span>Import Excel</span>
          </button>

          {/* Export Excel with Dropdown */}
          <div className="relative">
            <div className="inline-flex rounded-xl shadow-xs border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/60 dark:bg-emerald-950/40">
              <button
                type="button"
                onClick={handleExportDataExcel}
                className="px-3.5 py-2 hover:bg-emerald-100/70 dark:hover:bg-emerald-900/50 text-emerald-800 dark:text-emerald-200 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer rounded-l-xl"
                title="Export seluruh data siswa saat ini dalam format template Excel resmi"
              >
                <Download className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Export Excel</span>
              </button>
              <button
                type="button"
                onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
                className="px-2 py-2 hover:bg-emerald-100/70 dark:hover:bg-emerald-900/50 text-emerald-800 dark:text-emerald-200 transition-colors border-l border-emerald-200/80 dark:border-emerald-800 cursor-pointer rounded-r-xl"
                title="Pilihan Format: Export Data atau Unduh Template Kosong"
              >
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Dropdown Options */}
            {isExportMenuOpen && (
              <div
                className="absolute right-0 mt-1.5 w-72 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 py-1.5 z-50 text-xs animate-in fade-in slide-in-from-top-1 duration-150"
                onMouseLeave={() => setIsExportMenuOpen(false)}
              >
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  className="w-full px-3.5 py-2.5 text-left hover:bg-emerald-50 dark:hover:bg-emerald-950/50 flex items-start gap-2.5 transition-colors group cursor-pointer"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5 group-hover:scale-110 transition-transform" />
                  <div>
                    <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <span>Unduh Template Excel</span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 font-bold">
                        Format Baku
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                      Format resmi kosong siap diisi untuk dikirim/diunggah kembali ke sistem
                    </div>
                  </div>
                </button>

                <div className="my-1 border-t border-slate-100 dark:border-slate-800" />

                <button
                  type="button"
                  onClick={handleExportDataExcel}
                  className="w-full px-3.5 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800/60 flex items-start gap-2.5 transition-colors group cursor-pointer"
                >
                  <Download className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5 group-hover:scale-110 transition-transform" />
                  <div>
                    <div className="font-bold text-slate-900 dark:text-white">
                      Export Data Siswa Saat Ini
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                      Ekspor {filteredStudents.length} siswa dalam format template (bisa diedit & diimpor kembali)
                    </div>
                  </div>
                </button>
              </div>
            )}
          </div>

          {sampleStudentsCount > 0 && (
            <button
              onClick={() => setIsPurgeSampleModalOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Bersihkan data siswa contoh demo"
            >
              <Trash2 className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              <span>Bersihkan Data Demo ({sampleStudentsCount})</span>
            </button>
          )}

          <button
            onClick={handleOpenAdd}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all shadow-blue-500/20"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Siswa</span>
          </button>
        </div>
      </div>

      {/* Banner Penjelasan Angka Total Siswa & Data Contoh / Demo */}
      {sampleStudentsCount > 0 && (
        <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-amber-50 via-amber-50/70 to-orange-50/80 dark:from-amber-950/40 dark:via-amber-950/30 dark:to-orange-950/30 border border-amber-300/80 dark:border-amber-700/60 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0 mt-0.5 border border-amber-400/30">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-extrabold text-amber-950 dark:text-amber-200">
                  Penjelasan Total {students.length} Siswa di Sistem
                </h4>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-200/80 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200">
                  {sampleStudentsCount} Siswa Contoh Bawaan
                </span>
              </div>
              <p className="text-xs text-amber-900/80 dark:text-amber-300/80 mt-1 leading-relaxed">
                Angka <strong>{students.length} siswa</strong> di aplikasi terdiri dari <strong>{students.length - sampleStudentsCount} siswa yang Anda daftarkan</strong> ditambah <strong>{sampleStudentsCount} data siswa simulasi/contoh</strong> bawaan awal. Anda dapat menghapus data contoh ini dengan satu klik agar hanya siswa asli Anda yang tampil di semua grafik, rombel, dan absensi.
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsPurgeSampleModalOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-bold text-xs shrink-0 flex items-center gap-2 shadow-xs transition-all cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
            <span>Hapus {sampleStudentsCount} Siswa Contoh</span>
          </button>
        </div>
      )}

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
        onClose={() => {
          setIsImportModalOpen(false);
          setImportFile(null);
          setPreviewData(null);
          setPreviewError(null);
        }}
        title="Import Data Siswa dari Template Excel"
        subtitle="Kirim berkas template Excel untuk mendaftarkan data siswa secara instan ke server database"
        maxWidth="2xl"
      >
        <form onSubmit={handleImportSubmit} className="space-y-4">
          {/* Banner Unduh Template Resmi */}
          <div className="p-3.5 sm:p-4 rounded-2xl bg-gradient-to-r from-emerald-50 via-emerald-50/70 to-teal-50/60 dark:from-emerald-950/40 dark:via-emerald-950/30 dark:to-teal-950/30 border border-emerald-200/90 dark:border-emerald-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0 mt-0.5">
                <FileSpreadsheet className="w-4 h-4" />
              </div>
              <div>
                <h5 className="text-xs font-bold text-emerald-950 dark:text-emerald-200">
                  Format Baku Import Excel
                </h5>
                <p className="text-[11px] text-emerald-900/80 dark:text-emerald-300/80 mt-0.5 leading-relaxed">
                  Belum memiliki format file? Unduh template resmi kami yang telah terstruktur rapi.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-xs flex items-center justify-center gap-1.5 shrink-0 shadow-xs transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Unduh Template (.xlsx)</span>
            </button>
          </div>

          {/* Rombel Tujuan */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Rombel / Kelas Tujuan Utama {profile?.role === 'guru' ? 'Binaan' : '(SD Kelas 1 - 6)'}:
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
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              Catatan: Jika kolom <code>Kelas</code> di dalam file Excel telah diisi nama rombel, data otomatis diarahkan ke kelas tersebut.
            </p>
          </div>

          {/* Input File */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Pilih Berkas Template Excel (.xlsx / .xls)
            </label>
            <input
              type="file"
              accept=".xlsx, .xls"
              onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
              required
              className="w-full text-xs text-slate-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-blue-50 dark:file:bg-blue-950 file:text-blue-700 dark:file:text-blue-300 hover:file:bg-blue-100 cursor-pointer border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800/50"
            />
          </div>

          {/* Loading parsing state */}
          {parsingPreview && (
            <div className="p-3.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/50 flex items-center gap-2.5 text-xs text-blue-800 dark:text-blue-300">
              <span className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin shrink-0" />
              <span>Sedang membaca dan memvalidasi struktur berkas Excel...</span>
            </div>
          )}

          {/* Error alert */}
          {previewError && (
            <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/50 flex items-center gap-2.5 text-xs text-red-800 dark:text-red-300">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{previewError}</span>
            </div>
          )}

          {/* Preview Data Siswa */}
          {previewData && previewData.totalRows > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Terdeteksi {previewData.totalRows} Siswa Siap Diimpor</span>
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  Pratinjau {Math.min(5, previewData.totalRows)} baris pertama
                </span>
              </div>

              <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs">
                <table className="w-full text-left">
                  <thead className="bg-slate-100 dark:bg-slate-800 text-[11px] text-slate-700 dark:text-slate-300 font-bold sticky top-0">
                    <tr>
                      <th className="px-3 py-2">No</th>
                      <th className="px-3 py-2">NIS</th>
                      <th className="px-3 py-2">NISN</th>
                      <th className="px-3 py-2">Nama Siswa</th>
                      <th className="px-3 py-2">JK</th>
                      <th className="px-3 py-2">Kelas</th>
                      <th className="px-3 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-800 dark:text-slate-200">
                    {previewData.previewRows.slice(0, 5).map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td className="px-3 py-1.5 text-slate-500">{row.no}</td>
                        <td className="px-3 py-1.5 font-mono">{row.nis || '-'}</td>
                        <td className="px-3 py-1.5 font-mono">{row.nisn || '-'}</td>
                        <td className="px-3 py-1.5 font-semibold">{row.name}</td>
                        <td className="px-3 py-1.5">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              row.gender === 'L'
                                ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-300'
                                : 'bg-pink-100 text-pink-800 dark:bg-pink-900/60 dark:text-pink-300'
                            }`}
                          >
                            {row.gender}
                          </span>
                        </td>
                        <td className="px-3 py-1.5 text-slate-600 dark:text-slate-400">
                          {row.className || 'Ikuti Pilihan'}
                        </td>
                        <td className="px-3 py-1.5">
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300 font-semibold">
                            {row.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="pt-3 flex items-center justify-end gap-2.5 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => {
                setIsImportModalOpen(false);
                setImportFile(null);
                setPreviewData(null);
                setPreviewError(null);
              }}
              className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={actionLoading || !importFile || (previewData !== null && previewData.totalRows === 0)}
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 disabled:opacity-50 cursor-pointer shadow-blue-500/20"
            >
              {actionLoading && <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
              <span>
                {previewData && previewData.totalRows > 0
                  ? `Kirim & Simpan ${previewData.totalRows} Siswa ke Database`
                  : 'Kirim Template Excel ke Server'}
              </span>
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

      {/* Purge Demo Students Confirmation Dialog */}
      <ConfirmDialog
        isOpen={isPurgeSampleModalOpen}
        onClose={() => setIsPurgeSampleModalOpen(false)}
        onConfirm={handlePurgeSampleStudents}
        title="Bersihkan Semua Siswa Contoh / Demo?"
        message={`Sistem akan menghapus ${sampleStudentsCount} data siswa contoh bawaan awal dari server database. Hanya siswa riil yang Anda daftarkan sendiri yang akan dipertahankan. Seluruh data grafik presensi, kartu QR, dan rombel akan otomatis menyesuaikan secara akurat.`}
        confirmLabel={`Ya, Bersihkan (${sampleStudentsCount} Siswa)`}
        isDestructive={true}
        loading={actionLoading}
      />
    </div>
  );
};
