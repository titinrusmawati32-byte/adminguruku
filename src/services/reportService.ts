import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

export interface ReportMeta {
  title: string;
  schoolName?: string;
  teacherName?: string;
  className?: string;
  subjectName?: string;
  academicYear?: string;
  semester?: string;
  period?: string;
  orientation?: 'portrait' | 'landscape';
}

export const reportService = {
  exportToPDF(
    headers: string[],
    rows: (string | number)[][],
    meta: ReportMeta
  ): void {
    const orientation = meta.orientation || 'portrait';
    const doc = new jsPDF({
      orientation,
      unit: 'mm',
      format: 'a4',
    });

    const school = meta.schoolName || 'SD NEGERI HARAPAN BANGSA';
    const pageWidth = doc.internal.pageSize.getWidth();

    // Header Kop Surat
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(30, 41, 59); // slate-800
    doc.text(school.toUpperCase(), pageWidth / 2, 14, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139); // slate-500
    doc.text('SISTEM INFORMASI ADMINISTRASI GURU TERPADU', pageWidth / 2, 19, { align: 'center' });

    // Header divider line
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.5);
    doc.line(14, 22, pageWidth - 14, 22);

    // Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(15, 23, 42);
    doc.text(meta.title.toUpperCase(), pageWidth / 2, 30, { align: 'center' });

    // Meta Details Box
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(51, 65, 85);

    let startY = 36;
    const metaItems: string[] = [];
    if (meta.teacherName) metaItems.push(`Guru: ${meta.teacherName}`);
    if (meta.className) metaItems.push(`Kelas: ${meta.className}`);
    if (meta.subjectName) metaItems.push(`Mapel: ${meta.subjectName}`);
    if (meta.semester) metaItems.push(`Semester: ${meta.semester}`);
    if (meta.academicYear) metaItems.push(`Tahun Ajaran: ${meta.academicYear}`);
    if (meta.period) metaItems.push(`Periode: ${meta.period}`);

    if (metaItems.length > 0) {
      const metaText = metaItems.join('  |  ');
      doc.text(metaText, pageWidth / 2, startY, { align: 'center' });
      startY += 5;
    }

    // AutoTable Table
    autoTable(doc, {
      head: [headers],
      body: rows,
      startY: startY + 2,
      theme: 'grid',
      headStyles: {
        fillColor: [37, 99, 235], // #2563eb Blue
        textColor: 255,
        fontStyle: 'bold',
        fontSize: 8.5,
        halign: 'center',
        cellPadding: 2.5,
      },
      bodyStyles: {
        fontSize: 8,
        textColor: [51, 65, 85],
        cellPadding: 2,
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
      margin: { left: 14, right: 14, bottom: 35 },
      didDrawPage: (data) => {
        // Footer: Page Number & Print Date
        const pageCount = (doc.internal as any).getNumberOfPages
          ? (doc.internal as any).getNumberOfPages()
          : doc.getNumberOfPages();
        const currentPage = data.pageNumber;

        doc.setFont('helvetica', 'italic');
        doc.setFontSize(7.5);
        doc.setTextColor(148, 163, 184);

        const printDate = new Date().toLocaleDateString('id-ID', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });
        doc.text(`Dicetak pada: ${printDate} WIB | Admin Guru SaaS`, 14, doc.internal.pageSize.getHeight() - 10);
        doc.text(
          `Halaman ${currentPage} dari ${pageCount}`,
          pageWidth - 14,
          doc.internal.pageSize.getHeight() - 10,
          { align: 'right' }
        );
      },
    });

    // Signature Area on the last page
    const finalY = (doc as any).lastAutoTable?.finalY || startY + 40;
    const pageHeight = doc.internal.pageSize.getHeight();

    // If enough room at the bottom of the page, draw signature box
    let sigY = finalY + 12;
    if (sigY + 30 > pageHeight - 15) {
      doc.addPage();
      sigY = 25;
    }

    const todayStr = new Date().toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(30, 41, 59);

    const sigX = pageWidth - 65;
    doc.text(`Mengetahui,`, sigX, sigY);
    doc.text(`Guru Pengampu / Wali Kelas`, sigX, sigY + 5);

    // Signature line
    doc.setDrawColor(100, 116, 139);
    doc.setLineWidth(0.3);
    doc.line(sigX, sigY + 24, sigX + 45, sigY + 24);

    doc.setFont('helvetica', 'bold');
    doc.text(meta.teacherName || '( ................................... )', sigX, sigY + 28);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.text(`NIP. .....................................`, sigX, sigY + 32);

    const cleanFilename = meta.title.replace(/[^a-zA-Z0-9_-]/g, '_');
    doc.save(`${cleanFilename}_${new Date().toISOString().slice(0, 10)}.pdf`);
  },

  exportToExcel(
    headers: string[],
    rows: (string | number)[][],
    meta: ReportMeta
  ): void {
    // Structured excel format with title & metadata at top
    const data: any[][] = [];

    data.push([meta.schoolName || 'SD NEGERI HARAPAN BANGSA']);
    data.push([meta.title.toUpperCase()]);
    data.push([]);

    if (meta.teacherName) data.push(['Guru Pengampu:', meta.teacherName]);
    if (meta.className) data.push(['Kelas:', meta.className]);
    if (meta.subjectName) data.push(['Mata Pelajaran:', meta.subjectName]);
    if (meta.semester) data.push(['Semester:', meta.semester]);
    if (meta.academicYear) data.push(['Tahun Ajaran:', meta.academicYear]);
    if (meta.period) data.push(['Periode:', meta.period]);
    data.push(['Tanggal Cetak:', new Date().toLocaleDateString('id-ID')]);
    data.push([]);

    // Table Header
    data.push(headers);

    // Table Rows
    rows.forEach((r) => data.push(r));

    const ws = XLSX.utils.aoa_to_sheet(data);

    // Styling column widths
    const colWidths = headers.map((h) => ({
      wch: Math.max(h.length + 4, 14),
    }));
    colWidths[0] = { wch: 6 }; // No column
    ws['!cols'] = colWidths;

    const wb = XLSX.utils.book_new();
    const sheetName = (meta.title.slice(0, 25) || 'Rekap').replace(/[\\/?*[\]]/g, '');
    XLSX.utils.book_append_sheet(wb, ws, sheetName);

    const cleanFilename = meta.title.replace(/[^a-zA-Z0-9_-]/g, '_');
    XLSX.writeFile(wb, `${cleanFilename}_${new Date().toISOString().slice(0, 10)}.xlsx`);
  },
};
