import {
  collection,
  doc,
  getDocs,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { DatabaseBackup } from '../types';
import { auth, db } from './firebase';

export const backupService = {
  async exportFullDatabase(): Promise<DatabaseBackup> {
    const collectionsToBackup = [
      'users',
      'students',
      'classes',
      'subjects',
      'schedules',
      'attendance',
      'assessments',
      'teaching_agendas',
      'guidance',
    ];

    const data: Record<string, any[]> = {};
    let totalRecords = 0;

    for (const colName of collectionsToBackup) {
      try {
        const snap = await getDocs(collection(db, colName));
        data[colName] = snap.docs.map((d) => ({ ...d.data(), id: d.id }));
        totalRecords += snap.docs.length;
      } catch (e) {
        console.warn(`Could not read collection ${colName} during backup`, e);
        data[colName] = [];
      }
    }

    const backup: DatabaseBackup = {
      backupId: `BACKUP-${Date.now()}`,
      timestamp: new Date().toISOString(),
      createdBy: auth.currentUser?.displayName || auth.currentUser?.email || 'Admin',
      totalRecords,
      data,
    };

    return backup;
  },

  downloadBackupJSON(backup: DatabaseBackup): void {
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ADMIN_GURU_BACKUP_${new Date().toISOString().slice(0, 10)}_${Date.now().toString().slice(-4)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  },

  async restoreDatabase(backupData: DatabaseBackup): Promise<{ success: number; errors: string[] }> {
    let success = 0;
    const errors: string[] = [];

    const colMap: Record<string, string> = {
      users: 'users',
      students: 'students',
      classes: 'classes',
      subjects: 'subjects',
      schedules: 'schedules',
      attendance: 'attendance',
      assessments: 'assessments',
      teaching_agendas: 'teaching_agendas',
      guidance: 'guidance',
    };

    for (const [colKey, items] of Object.entries(backupData.data || {})) {
      const targetCol = colMap[colKey] || colKey;
      if (!Array.isArray(items)) continue;

      for (const item of items) {
        try {
          const anyItem = item as any;
          const docId =
            anyItem.studentId ||
            anyItem.classId ||
            anyItem.subjectId ||
            anyItem.scheduleId ||
            anyItem.attendanceId ||
            anyItem.assessmentId ||
            anyItem.agendaId ||
            anyItem.guidanceId ||
            anyItem.uid ||
            anyItem.id ||
            `RESTORE-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

          await setDoc(doc(db, targetCol, docId), {
            ...item,
            updatedAt: serverTimestamp(),
          });
          success++;
        } catch (err: any) {
          errors.push(`Gagal memulihkan ${colKey} (${(item as any).id || 'unknown'}): ${err?.message}`);
        }
      }
    }

    return { success, errors };
  },
};
