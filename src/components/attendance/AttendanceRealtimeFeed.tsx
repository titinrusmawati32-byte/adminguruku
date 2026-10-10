import {
  AlertCircle,
  Check,
  CheckCheck,
  CheckCircle2,
  Clock,
  Edit2,
  HelpCircle,
  MoreVertical,
  QrCode,
  RefreshCw,
  Search,
  Sparkles,
  User,
  UserCheck,
  UserX,
  Users,
} from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { AttendanceRecord, AttendanceStatus, Student } from '../../types';

interface AttendanceRealtimeFeedProps {
  students: Student[];
  records: AttendanceRecord[];
  syncStatus?: 'connected' | 'saving' | 'error';
  onQuickStatusChange: (studentId: string, status: AttendanceStatus, notes?: string) => Promise<void>;
  onMarkStudentPresent: (student: Student) => Promise<void>;
}

export const AttendanceRealtimeFeed: React.FC<AttendanceRealtimeFeedProps> = ({
  students,
  records,
  syncStatus = 'connected',
  onQuickStatusChange,
  onMarkStudentPresent,
}) => {
  const [activeTab, setActiveTab] = useState<'scanned' | 'unscanned'>('scanned');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);

  // Grouped students
  const attendedStudentIds = useMemo(() => new Set(records.map((r) => r.studentId)), [records]);

  const unattendedStudents = useMemo(() => {
    return students.filter((s) => !attendedStudentIds.has(s.studentId));
  }, [students, attendedStudentIds]);

  // Statistics
  const stats = useMemo(() => {
    let h = 0;
    let s = 0;
    let i = 0;
    let a = 0;
    let qrCount = 0;

    records.forEach((rec) => {
      if (rec.status === 'Hadir') h++;
      else if (rec.status === 'Sakit') s++;
      else if (rec.status === 'Izin') i++;
      else if (rec.status === 'Alpa') a++;

      if (rec.method === 'qr') qrCount++;
    });

    const total = students.length;
    const attended = records.length;
    const percent = total > 0 ? Math.round((attended / total) * 100) : 0;

    return { total, attended, unattended: Math.max(0, total - attended), h, s, i, a, qrCount, percent };
  }, [students, records]);

  // Filtered and sorted records: MOST RECENT SCAN ON TOP
  const filteredRecords = useMemo(() => {
    const sorted = [...records].sort((a, b) => {
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return timeB - timeA;
    });

    if (!searchQuery.trim()) return sorted;
    const q = searchQuery.toLowerCase();
    return sorted.filter(
      (r) =>
        (r.studentName && r.studentName.toLowerCase().includes(q)) ||
        (r.nis && r.nis.includes(q))
    );
  }, [records, searchQuery]);

  const filteredUnattended = useMemo(() => {
    if (!searchQuery.trim()) return unattendedStudents;
    const q = searchQuery.toLowerCase();
    return unattendedStudents.filter(
      (s) => s.name.toLowerCase().includes(q) || s.nis.includes(q)
    );
  }, [unattendedStudents, searchQuery]);

  const statusColors: Record<AttendanceStatus, string> = {
    Hadir: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    Sakit: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
    Izin: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    Alpa: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs p-4 sm:p-5 flex flex-col w-full h-full min-h-[460px] lg:h-[630px] xl:h-[660px]">
      {/* Top Header & Sync Indicator */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <UserCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Riwayat Presensi Sesi
              </h3>
              {/* Sync Status Badge */}
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold border ${
                  syncStatus === 'saving'
                    ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800'
                    : syncStatus === 'error'
                    ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-800'
                    : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    syncStatus === 'saving'
                      ? 'bg-amber-500 animate-spin'
                      : syncStatus === 'error'
                      ? 'bg-rose-500'
                      : 'bg-emerald-500 animate-pulse'
                  }`}
                />
                <span>
                  {syncStatus === 'saving'
                    ? 'Menyimpan...'
                    : syncStatus === 'error'
                    ? 'Gagal Sinkron'
                    : 'Tersambung'}
                </span>
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              {stats.attended} dari {stats.total} siswa tercatat kehadiran
            </p>
          </div>
        </div>

        <div className="text-right">
          <span className="text-sm sm:text-base font-black text-blue-600 dark:text-blue-400">
            {stats.percent}%
          </span>
          <span className="text-[10px] text-slate-400 block font-medium">Tingkat Hadir</span>
        </div>
      </div>

      {/* Real-time Summary Pills */}
      <div className="grid grid-cols-4 gap-2 my-3">
        <div className="p-2 rounded-2xl bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-900/40 text-center">
          <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 block">
            Hadir (H)
          </span>
          <span className="text-base sm:text-lg font-black text-emerald-900 dark:text-emerald-100">
            {stats.h}
          </span>
        </div>
        <div className="p-2 rounded-2xl bg-blue-50/80 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-900/40 text-center">
          <span className="text-[10px] font-bold text-blue-700 dark:text-blue-300 block">
            Sakit (S)
          </span>
          <span className="text-base sm:text-lg font-black text-blue-900 dark:text-blue-100">
            {stats.s}
          </span>
        </div>
        <div className="p-2 rounded-2xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-900/40 text-center">
          <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300 block">
            Izin (I)
          </span>
          <span className="text-base sm:text-lg font-black text-amber-900 dark:text-amber-100">
            {stats.i}
          </span>
        </div>
        <div className="p-2 rounded-2xl bg-rose-50/80 dark:bg-rose-950/30 border border-rose-200/60 dark:border-rose-900/40 text-center">
          <span className="text-[10px] font-bold text-rose-700 dark:text-rose-300 block">
            Alpa (A)
          </span>
          <span className="text-base sm:text-lg font-black text-rose-900 dark:text-rose-100">
            {stats.a}
          </span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden mb-3">
        <div
          className="bg-gradient-to-r from-blue-600 via-indigo-600 to-emerald-500 h-full rounded-full transition-all duration-500"
          style={{ width: `${stats.percent}%` }}
        />
      </div>

      {/* Sub Tabs: Sudah Presensi vs Belum Presensi */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex p-0.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('scanned')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              activeTab === 'scanned'
                ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Sudah Presensi ({records.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('unscanned')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              activeTab === 'unscanned'
                ? 'bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 shadow-xs font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Belum Presensi ({unattendedStudents.length})
          </button>
        </div>

        {/* Lightweight Quick Search */}
        <div className="relative flex-1 max-w-[150px] sm:max-w-[180px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari siswa..."
            className="w-full pl-8 pr-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:ring-1 focus:ring-blue-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Live Scrollable Feed */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-1">
        {activeTab === 'scanned' ? (
          filteredRecords.length === 0 ? (
            <div className="py-14 text-center text-xs text-slate-400">
              <QrCode className="w-8 h-8 text-slate-300 dark:text-slate-700 mx-auto mb-2 opacity-50" />
              <p className="font-semibold text-slate-700 dark:text-slate-300">Belum Ada Presensi Masuk</p>
              <p className="text-[11px] mt-0.5 text-slate-400">
                Arahkan kartu QR siswa ke kamera untuk mencatat kehadiran secara instan
              </p>
            </div>
          ) : (
            filteredRecords.map((rec, index) => {
              const timeDisplay = rec.createdAt
                ? new Date(rec.createdAt).toLocaleTimeString('id-ID', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  })
                : 'Tercatat';

              const isEditing = editingRecordId === rec.attendanceId;
              const isFirst = index === 0;

              return (
                <div
                  key={rec.attendanceId}
                  className={`p-3 rounded-2xl border transition-all flex flex-col gap-2 ${
                    isFirst
                      ? 'border-blue-400/50 dark:border-blue-500/40 bg-blue-50/40 dark:bg-blue-950/20 shadow-xs'
                      : 'border-slate-100 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-slate-50/40 dark:bg-slate-800/20'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 text-white font-extrabold text-xs flex items-center justify-center shrink-0 shadow-xs">
                        {rec.studentName?.charAt(0) || 'S'}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                            {rec.studentName}
                          </h4>
                          {isFirst && (
                            <span className="px-1.5 py-0.2 rounded-md bg-blue-600 text-white text-[9px] font-black uppercase tracking-wider shrink-0">
                              Baru
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                          <span>NIS: {rec.nis || '-'}</span>
                          <span>•</span>
                          <span className="flex items-center gap-0.5 font-mono text-slate-500 dark:text-slate-300">
                            <Clock className="w-3 h-3 text-slate-400" />
                            {timeDisplay}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {/* Method Badge */}
                      <span
                        className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase border ${
                          rec.method === 'qr'
                            ? 'bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-300 border-purple-200 dark:border-purple-900'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        {rec.method === 'qr' ? '⚡ QR Scan' : 'Manual'}
                      </span>

                      {/* Status Badge */}
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                          statusColors[rec.status] || statusColors.Hadir
                        }`}
                      >
                        {rec.status}
                      </span>

                      {/* Edit Button */}
                      <button
                        type="button"
                        onClick={() =>
                          setEditingRecordId(isEditing ? null : rec.attendanceId)
                        }
                        title="Ubah status kehadiran"
                        className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Quick Status Override Submenu */}
                  {isEditing && (
                    <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between gap-1 text-[10px]">
                      <span className="text-slate-400 font-semibold">Ubah Status:</span>
                      <div className="flex items-center gap-1">
                        {(['Hadir', 'Sakit', 'Izin', 'Alpa'] as AttendanceStatus[]).map(
                          (st) => (
                            <button
                              key={st}
                              type="button"
                              onClick={async () => {
                                await onQuickStatusChange(rec.studentId, st);
                                setEditingRecordId(null);
                              }}
                              className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                                rec.status === st
                                  ? 'bg-blue-600 text-white shadow-xs'
                                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                              }`}
                            >
                              {st}
                            </button>
                          )
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )
        ) : (
          filteredUnattended.length === 0 ? (
            <div className="py-14 text-center text-xs text-slate-400">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
              <p className="font-semibold text-emerald-600 dark:text-emerald-400">
                Semua Siswa Sudah Hadir!
              </p>
              <p className="text-[11px] mt-0.5 text-slate-400">
                Seluruh siswa di rombel ini telah berhasil melakukan presensi
              </p>
            </div>
          ) : (
            filteredUnattended.map((stu) => (
              <div
                key={stu.studentId}
                className="p-3 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-800/20 flex items-center justify-between gap-2"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold text-xs flex items-center justify-center shrink-0">
                    {stu.name.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                      {stu.name}
                    </h4>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      NIS: {stu.nis} • {stu.className || stu.classId}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => onMarkStudentPresent(stu)}
                    className="px-2.5 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 text-[10px] font-bold border border-emerald-200 dark:border-emerald-900/50 flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <Check className="w-3 h-3" />
                    <span>Hadirkan</span>
                  </button>
                </div>
              </div>
            ))
          )
        )}
      </div>
    </div>
  );
};
