import jsPDF from 'jspdf';
import {
  Check,
  CheckSquare,
  ChevronDown,
  Download,
  Filter,
  GraduationCap,
  Printer,
  QrCode,
  Square,
  Users,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import React, { useEffect, useMemo, useState } from 'react';
import { EmptyState } from '../components/common/EmptyState';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { authorizationService } from '../services/authorizationService';
import { classService, groupClassesBySDGrade } from '../services/classService';
import { studentService } from '../services/studentService';
import { SchoolClass, Student } from '../types';

export const QrCardPrintPage: React.FC = () => {
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

  const [selectedClassId, setSelectedClassId] = useState<string>('all');
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [stu, cls] = await Promise.all([
          studentService.getAll(profile),
          classService.getAll(),
        ]);
        const activeStu = stu.filter((s) => s.status === 'active');
        setStudents(activeStu);
        setClasses(cls);

        const permitted = profile?.role === 'admin' ? cls : authorizationService.filterClassesForUser(cls, profile);
        if (profile?.role === 'guru') {
          if (permitted.length > 0) {
            setSelectedClassId(permitted[0].classId);
          }
        }
        // Pre-select all students
        setSelectedStudentIds(new Set(activeStu.map((s) => s.studentId)));
      } catch (err: any) {
        showToast('Gagal memuat siswa: ' + err.message, 'error');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [profile?.uid, profile?.role]);

  const filteredStudents = useMemo(() => {
    if (selectedClassId === 'all') return students;
    return students.filter((s) => s.classId === selectedClassId);
  }, [students, selectedClassId]);

  const cardsToPrint = useMemo(() => {
    return filteredStudents.filter((s) => selectedStudentIds.has(s.studentId));
  }, [filteredStudents, selectedStudentIds]);

  const handleToggleStudent = (id: string) => {
    setSelectedStudentIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAll = () => {
    setSelectedStudentIds(new Set(filteredStudents.map((s) => s.studentId)));
  };

  const handleDeselectAll = () => {
    setSelectedStudentIds(new Set());
  };

  const handlePrint = () => {
    if (cardsToPrint.length === 0) {
      showToast('Pilih setidaknya satu kartu siswa untuk dicetak.', 'warning');
      return;
    }
    window.print();
  };

  const handleExportPDF = () => {
    if (cardsToPrint.length === 0) {
      showToast('Pilih setidaknya satu kartu siswa untuk diekspor ke PDF.', 'warning');
      return;
    }

    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const cardWidth = 85;
      const cardHeight = 54;
      const marginX = 15;
      const marginY = 15;
      const gapX = 10;
      const gapY = 10;
      const cols = 2;
      const rows = 4; // 8 cards per A4 page

      let cardIndex = 0;

      cardsToPrint.forEach((stu, i) => {
        if (i > 0 && i % (cols * rows) === 0) {
          doc.addPage();
        }

        const pageItemIndex = i % (cols * rows);
        const col = pageItemIndex % cols;
        const row = Math.floor(pageItemIndex / cols);

        const x = marginX + col * (cardWidth + gapX);
        const y = marginY + row * (cardHeight + gapY);

        // Card Border
        doc.setDrawColor(203, 213, 225);
        doc.setFillColor(255, 255, 255);
        doc.roundedRect(x, y, cardWidth, cardHeight, 3, 3, 'FD');

        // Card Header Strip
        doc.setFillColor(37, 99, 235);
        doc.rect(x, y, cardWidth, 12, 'F');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(255, 255, 255);
        doc.text('KARTU PRESENSI DIGITAL SISWA', x + cardWidth / 2, y + 5, { align: 'center' });
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.5);
        doc.text('SD NEGERI HARAPAN BANGSA', x + cardWidth / 2, y + 9.5, { align: 'center' });

        // Student Info
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(15, 23, 42);
        const nameTrunc = stu.name.length > 22 ? stu.name.slice(0, 20) + '...' : stu.name;
        doc.text(nameTrunc, x + 6, y + 20);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(71, 85, 105);
        doc.text(`NIS   : ${stu.nis}`, x + 6, y + 26);
        doc.text(`NISN : ${stu.nisn || '-'}`, x + 6, y + 31);
        doc.text(`Kelas : ${stu.className || stu.classId}`, x + 6, y + 36);

        // QR Placeholder text / frame
        doc.setDrawColor(148, 163, 184);
        doc.setFillColor(248, 250, 252);
        doc.roundedRect(x + cardWidth - 30, y + 17, 24, 24, 2, 2, 'FD');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7);
        doc.setTextColor(37, 99, 235);
        doc.text('QR CODE', x + cardWidth - 18, y + 27, { align: 'center' });
        doc.setFontSize(6);
        doc.setTextColor(100, 116, 139);
        doc.text(stu.nis, x + cardWidth - 18, y + 33, { align: 'center' });

        // Card Footer
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(6);
        doc.setTextColor(148, 163, 184);
        doc.text('Scan barcode untuk presensi otomatis', x + 6, y + cardHeight - 4);
      });

      doc.save(`KARTU_QR_SISWA_${new Date().toISOString().slice(0, 10)}.pdf`);
      showToast('File PDF Kartu QR berhasil dibuat!', 'success');
    } catch (e: any) {
      showToast('Gagal membuat PDF: ' + e.message, 'error');
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Action Toolbar */}
      <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
        {/* Class Filter */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 font-semibold">
            <Filter className="w-3.5 h-3.5" />
            <span>Pilih Rombel:</span>
          </div>
          {profile?.role === 'guru' && permittedClasses.length === 0 ? (
            <div className="px-3.5 py-2 rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 text-xs font-semibold">
              Penugasan Belum Tersedia
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
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs sm:text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
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
              className="px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs sm:text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              <option value="all">Semua Rombel ({students.length} Siswa)</option>
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

        {/* Selection controls & Export buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleSelectAll}
            className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            Pilih Semua ({filteredStudents.length})
          </button>
          <button
            onClick={handleDeselectAll}
            className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            Batal Pilih
          </button>

          <button
            onClick={handleExportPDF}
            className="px-3.5 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 text-xs font-semibold border border-indigo-200 dark:border-indigo-900/50 flex items-center gap-1.5 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export PDF</span>
          </button>

          <button
            onClick={handlePrint}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
          >
            <Printer className="w-4 h-4" />
            <span>Cetak Kartu ({cardsToPrint.length})</span>
          </button>
        </div>
      </div>

      {/* Info Notice */}
      <div className="px-4 py-3 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/50 text-xs text-blue-700 dark:text-blue-300 flex items-center justify-between print:hidden">
        <div className="flex items-center gap-2">
          <QrCode className="w-4 h-4 shrink-0" />
          <span>
            Setiap kartu siap cetak dengan ukuran standar kartu identitas (ID Card 85 x 54 mm). Barcode QR hanya menyimpan kode acuan siswa untuk keamanan data.
          </span>
        </div>
        <span className="font-bold shrink-0">{cardsToPrint.length} Siswa Terpilih</span>
      </div>

      {/* Printable Cards Grid */}
      {loading ? (
        <div className="p-12 text-center text-xs text-slate-400">
          Memuat kartu siswa...
        </div>
      ) : cardsToPrint.length === 0 ? (
        <EmptyState
          icon={QrCode}
          title="Tidak Ada Kartu Dipilih"
          description="Pilih kelas atau centang siswa yang ingin Anda cetak kartunya."
          actionLabel="Pilih Semua Siswa"
          onAction={handleSelectAll}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 print:grid-cols-2 print:gap-4">
          {filteredStudents.map((stu) => {
            const isChecked = selectedStudentIds.has(stu.studentId);
            return (
              <div
                key={stu.studentId}
                onClick={() => handleToggleStudent(stu.studentId)}
                className={`relative p-4 rounded-2xl border transition-all cursor-pointer select-none bg-white dark:bg-slate-900 ${
                  isChecked
                    ? 'border-blue-500 shadow-md ring-1 ring-blue-500/20'
                    : 'border-slate-200 dark:border-slate-800 opacity-60 hover:opacity-100'
                } print:border-slate-300 print:shadow-none print:opacity-100`}
              >
                {/* Selection Checkbox */}
                <div className="absolute top-3 right-3 print:hidden">
                  {isChecked ? (
                    <div className="w-5 h-5 rounded-md bg-blue-600 text-white flex items-center justify-center">
                      <Check className="w-3.5 h-3.5" />
                    </div>
                  ) : (
                    <div className="w-5 h-5 rounded-md border border-slate-300 dark:border-slate-600" />
                  )}
                </div>

                {/* Card Header Strip */}
                <div className="pb-3 mb-3 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0">
                    <GraduationCap className="w-4 h-4" />
                  </div>
                  <div>
                    <h5 className="text-[11px] font-bold text-slate-900 dark:text-white uppercase leading-none">
                      KARTU IDENTITAS SISWA
                    </h5>
                    <p className="text-[9px] text-slate-400 mt-0.5">
                      SD NEGERI HARAPAN BANGSA
                    </p>
                  </div>
                </div>

                {/* Card Body with QR Code & Info */}
                <div className="flex items-center justify-between gap-3">
                  <div className="space-y-1 min-w-0">
                    <div className="text-xs font-extrabold text-slate-900 dark:text-white truncate">
                      {stu.name}
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400">
                      <span className="font-semibold">NIS:</span> {stu.nis}
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400">
                      <span className="font-semibold">NISN:</span> {stu.nisn || '-'}
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400">
                      <span className="font-semibold">Kelas:</span> {stu.className || stu.classId}
                    </div>
                    <div className="pt-1">
                      <span className="px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 text-[9px] font-bold">
                        AKTIF
                      </span>
                    </div>
                  </div>

                  {/* QR SVG */}
                  <div className="p-2 bg-white rounded-xl border border-slate-100 shadow-xs shrink-0 flex flex-col items-center">
                    <QRCodeSVG
                      value={JSON.stringify({ type: 'student', studentId: stu.studentId })}
                      size={72}
                      level="M"
                      includeMargin={false}
                    />
                    <span className="text-[8px] font-mono text-slate-400 mt-1">
                      {stu.nis}
                    </span>
                  </div>
                </div>

                <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800 text-[8px] text-slate-400 text-center">
                  Gunakan saat absensi harian & peminjaman perpustakaan
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
