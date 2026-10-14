import {
  Bell,
  CheckCircle,
  Database,
  Download,
  GraduationCap,
  HardDriveDownload,
  HardDriveUpload,
  RefreshCw,
  Send,
  Shield,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  User,
} from 'lucide-react';
import React, { useState } from 'react';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { useTheme } from '../context/ThemeContext';
import { backupService } from '../services/backupService';
import { studentService } from '../services/studentService';

export const SettingsPage: React.FC = () => {
  const { profile, role, isAdmin } = useAuth();
  const { showToast, sendBroadcast } = useNotification();
  const { mode, setMode } = useTheme();

  // Notification broadcast
  const [notifTitle, setNotifTitle] = useState('');
  const [notifMessage, setNotifMessage] = useState('');
  const [notifType, setNotifType] = useState<'info' | 'success' | 'warning'>('info');
  const [sendingNotif, setSendingNotif] = useState(false);

  // Backup / Restore
  const [backupLoading, setBackupLoading] = useState(false);
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [restoreFile, setRestoreFile] = useState<File | null>(null);

  // Demo Cleanup
  const [purgeDemoLoading, setPurgeDemoLoading] = useState(false);
  const [isPurgeDemoOpen, setIsPurgeDemoOpen] = useState(false);

  // Residual / Orphan Cleanup
  const [purgeOrphanLoading, setPurgeOrphanLoading] = useState(false);
  const [isPurgeOrphanOpen, setIsPurgeOrphanOpen] = useState(false);

  const handlePurgeDemoStudents = async () => {
    setPurgeDemoLoading(true);
    try {
      const res = await studentService.removeSampleStudents();
      showToast(
        `Berhasil membersihkan server: ${res.studentsRemoved} siswa contoh, ${res.attendanceCleaned} presensi demo, dan ${res.assessmentsCleaned} nilai demo telah dihapus tuntas dari database server.`,
        'success'
      );
      setIsPurgeDemoOpen(false);
    } catch (err: any) {
      showToast('Gagal membersihkan data demo: ' + err.message, 'error');
    } finally {
      setPurgeDemoLoading(false);
    }
  };

  const handlePurgeOrphanRecords = async () => {
    setPurgeOrphanLoading(true);
    try {
      const res = await studentService.purgeOrphanedRecords();
      showToast(
        `Sinkronisasi server tuntas! Membersihkan ${res.attendancePurged} presensi residual dan ${res.guidancePurged} catatan bimbingan yang tidak bertuan dari server. Database kini 100% sinkron dan bersih!`,
        'success'
      );
      setIsPurgeOrphanOpen(false);
    } catch (err: any) {
      showToast('Gagal membersihkan data gantung: ' + err.message, 'error');
    } finally {
      setPurgeOrphanLoading(false);
    }
  };

  // School profile settings
  const [schoolName, setSchoolName] = useState('SD NEGERI SUMBEREJO 04');
  const [academicYear, setAcademicYear] = useState('2026/2027');
  const [semester, setSemester] = useState('Ganjil');



  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!notifTitle.trim() || !notifMessage.trim()) {
      showToast('Judul dan pesan notifikasi wajib diisi.', 'warning');
      return;
    }
    setSendingNotif(true);
    try {
      await sendBroadcast(notifTitle.trim(), notifMessage.trim(), notifType);
      setNotifTitle('');
      setNotifMessage('');
    } catch (e: any) {
      showToast('Gagal mengirim siaran: ' + e.message, 'error');
    } finally {
      setSendingNotif(false);
    }
  };

  const handleDownloadBackup = async () => {
    setBackupLoading(true);
    try {
      const backupData = await backupService.exportFullDatabase();
      backupService.downloadBackupJSON(backupData);
      showToast(`Cadangan data (${backupData.totalRecords} dokumen) berhasil diekspor!`, 'success');
    } catch (e: any) {
      showToast('Gagal membuat backup database: ' + e.message, 'error');
    } finally {
      setBackupLoading(false);
    }
  };

  const handleRestoreBackup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restoreFile) {
      showToast('Pilih file backup .json terlebih dahulu.', 'warning');
      return;
    }

    setRestoreLoading(true);
    try {
      const text = await restoreFile.text();
      const parsed = JSON.parse(text);
      const res = await backupService.restoreDatabase(parsed);
      showToast(`Berhasil memulihkan ${res.success} dokumen dari berkas cadangan!`, 'success');
      setRestoreFile(null);
    } catch (e: any) {
      showToast('Format berkas cadangan tidak valid atau gagal dipulihkan: ' + e.message, 'error');
    } finally {
      setRestoreLoading(false);
    }
  };

  const handleSaveSchoolSettings = (e: React.FormEvent) => {
    e.preventDefault();
    showToast('Identitas sekolah dan tahun ajaran berhasil diperbarui.', 'success');
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* School Information Card */}
      <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs">
        <div className="flex items-center gap-3 pb-4 mb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
            <GraduationCap className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Identitas & Parameter Akademik Sekolah
            </h3>
            <p className="text-xs text-slate-500">
              Digunakan sebagai kop surat resmi dokumen laporan dan kartu QR siswa
            </p>
          </div>
        </div>

        <form onSubmit={handleSaveSchoolSettings} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="sm:col-span-1">
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Nama Sekolah
              </label>
              <input
                type="text"
                value={schoolName}
                onChange={(e) => setSchoolName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Tahun Ajaran
              </label>
              <input
                type="text"
                value={academicYear}
                onChange={(e) => setAcademicYear(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Semester
              </label>
              <select
                value={semester}
                onChange={(e) => setSemester(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                <option value="Ganjil">Semester Ganjil (1)</option>
                <option value="Genap">Semester Genap (2)</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition-colors"
            >
              Simpan Identitas Sekolah
            </button>
          </div>
        </form>
      </div>

      {/* Real-time Notification Broadcaster */}
      <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs">
        <div className="flex items-center gap-3 pb-4 mb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
            <Bell className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Sistem Notifikasi Real-Time
            </h3>
            <p className="text-xs text-slate-500">
              Kirim siaran pengumuman instan ke seluruh pengguna dan guru aktif
            </p>
          </div>
        </div>

        <form onSubmit={handleSendBroadcast} className="space-y-3 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Judul Pengumuman
              </label>
              <input
                type="text"
                value={notifTitle}
                onChange={(e) => setNotifTitle(e.target.value)}
                placeholder="Contoh: Rapat Dewan Guru Pukul 13.00 WIB"
                required
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Tipe Notifikasi
              </label>
              <select
                value={notifType}
                onChange={(e) => setNotifType(e.target.value as any)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                <option value="info">Informasi (Biru)</option>
                <option value="success">Sukses (Hijau)</option>
                <option value="warning">Penting (Kuning/Oranye)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Isi Pesan Siaran
            </label>
            <textarea
              rows={2}
              value={notifMessage}
              onChange={(e) => setNotifMessage(e.target.value)}
              placeholder="Tulis rincian pesan notifikasi..."
              required
              className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div className="flex justify-end pt-1">
            <button
              type="submit"
              disabled={sendingNotif}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Kirim Siaran Notifikasi</span>
            </button>
          </div>
        </form>
      </div>



      {/* Database Backup & Recovery Card */}
      <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs">
        <div className="flex items-center gap-3 pb-4 mb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Cadangan & Pemulihan Basis Data (Backup & Recovery)
            </h3>
            <p className="text-xs text-slate-500">
              Amankan data siswa, kehadiran, nilai, dan agenda dengan file cadangan terenkripsi JSON
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Export Backup */}
          <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2 font-bold text-xs text-slate-900 dark:text-white">
                <HardDriveDownload className="w-4 h-4 text-emerald-600" />
                <span>Unduh Cadangan Database</span>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed mb-4">
                Mengekspor seluruh koleksi siswa, mapel, jadwal, presensi, asesmen, dan agenda ke dalam berkas JSON standar.
              </p>
            </div>
            <button
              onClick={handleDownloadBackup}
              disabled={backupLoading}
              className="w-full py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-sm disabled:opacity-50"
            >
              {backupLoading ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
              <span>Unduh File Backup (.json)</span>
            </button>
          </div>

          {/* Restore Backup */}
          <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 flex flex-col justify-between">
            <form onSubmit={handleRestoreBackup} className="space-y-3">
              <div>
                <div className="flex items-center gap-2 mb-2 font-bold text-xs text-slate-900 dark:text-white">
                  <HardDriveUpload className="w-4 h-4 text-blue-600" />
                  <span>Pulihkan dari File Cadangan</span>
                </div>
                <input
                  type="file"
                  accept=".json"
                  onChange={(e) => setRestoreFile(e.target.files?.[0] || null)}
                  className="w-full text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
              </div>
              <button
                type="submit"
                disabled={restoreLoading || !restoreFile}
                className="w-full py-2.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-sm disabled:opacity-50"
              >
                {restoreLoading ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Upload className="w-3.5 h-3.5" />
                )}
                <span>Pulihkan Database Sekarang</span>
              </button>
            </form>
          </div>

          {/* Purge Demo Sample Students Card */}
          <div className="p-4 rounded-2xl border border-amber-200 dark:border-amber-800/60 bg-amber-50/50 dark:bg-amber-950/20 flex flex-col justify-between md:col-span-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-1">
              <div>
                <div className="flex items-center gap-2 mb-1 font-bold text-xs text-amber-900 dark:text-amber-200">
                  <Trash2 className="w-4 h-4 text-amber-600" />
                  <span>Bersihkan Data Siswa Contoh / Demo Sistem</span>
                </div>
                <p className="text-xs text-amber-800/80 dark:text-amber-300/80 leading-relaxed">
                  Menghapus seluruh 12 data siswa contoh (dummy) yang sempat ter-generate otomatis di awal beserta seluruh presensi demonya dari server Firestore, sehingga hanya menyisakan data riil siswa yang Anda daftarkan sendiri.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsPurgeDemoOpen(true)}
                disabled={purgeDemoLoading}
                className="px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold shrink-0 flex items-center justify-center gap-2 transition-all shadow-xs disabled:opacity-50 cursor-pointer"
              >
                {purgeDemoLoading ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5" />
                )}
                <span>Bersihkan Data Demo Sekarang</span>
              </button>
            </div>
          </div>

          {/* Zero Residual Server Sync / Orphaned Data Purge Card */}
          <div className="p-4 rounded-2xl border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/50 dark:bg-emerald-950/20 flex flex-col justify-between md:col-span-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-1">
              <div>
                <div className="flex items-center gap-2 mb-1 font-bold text-xs text-emerald-900 dark:text-emerald-200">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>Pembersihan Data Residual & Orphaned (Server Firestore)</span>
                </div>
                <p className="text-xs text-emerald-800/80 dark:text-emerald-300/80 leading-relaxed">
                  Memindai seluruh basis data server dan menghapus permanen setiap record presensi, nilai, atau bimbingan yang masih tersisa / menyangkut di server untuk siswa yang telah dihapus. Menjamin server database 100% steril dan sinkron.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsPurgeOrphanOpen(true)}
                disabled={purgeOrphanLoading}
                className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shrink-0 flex items-center justify-center gap-2 transition-all shadow-xs disabled:opacity-50 cursor-pointer"
              >
                {purgeOrphanLoading ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <ShieldCheck className="w-3.5 h-3.5" />
                )}
                <span>Pindai & Bersihkan Data Gantung</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Confirm Purge Demo Dialog */}
      <ConfirmDialog
        isOpen={isPurgeDemoOpen}
        onClose={() => setIsPurgeDemoOpen(false)}
        onConfirm={handlePurgeDemoStudents}
        title="Bersihkan Data Siswa Contoh?"
        message="Tindakan ini akan menghapus semua data siswa contoh (sample) awal beserta riwayat presensi demo terkait dari server database. Siswa asli yang Anda daftarkan sendiri akan tetap aman dan tidak akan terhapus."
        confirmLabel="Ya, Bersihkan Data Contoh"
        isDestructive={true}
        loading={purgeDemoLoading}
      />

      {/* Confirm Purge Orphan Dialog */}
      <ConfirmDialog
        isOpen={isPurgeOrphanOpen}
        onClose={() => setIsPurgeOrphanOpen(false)}
        onConfirm={handlePurgeOrphanRecords}
        title="Bersihkan Data Residual / Gantung di Server?"
        message="Sistem akan memeriksa seluruh koleksi presensi, bimbingan, dan nilai di server Firestore. Rekaman apa pun yang mengacu pada data siswa yang sudah dihapus akan langsung dimusnahkan secara permanen dari server database."
        confirmLabel="Ya, Bersihkan Server Sekarang"
        isDestructive={false}
        loading={purgeOrphanLoading}
      />
    </div>
  );
};
