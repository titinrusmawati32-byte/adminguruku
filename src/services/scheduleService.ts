import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { Schedule } from '../types';
import { memoryCache } from './cacheService';
import { db, handleFirestoreError, OperationType } from './firebase';

function isTimeOverlap(start1: string, end1: string, start2: string, end2: string): boolean {
  return start1 < end2 && start2 < end1;
}

export const scheduleService = {
  async getAll(): Promise<Schedule[]> {
    const cached = memoryCache.get<Schedule[]>('schedules:all');
    if (cached) return cached;

    try {
      const q = query(collection(db, 'schedules'), orderBy('startTime', 'asc'));
      const snap = await getDocs(q);
      const results = snap.docs.map((d) => {
        const data = d.data();
        return {
          scheduleId: d.id,
          teacherId: data.teacherId || '',
          teacherName: data.teacherName || '',
          classId: data.classId || '',
          className: data.className || '',
          subjectId: data.subjectId || '',
          subjectName: data.subjectName || '',
          day: data.day || 'Senin',
          startTime: data.startTime || '07:30',
          endTime: data.endTime || '09:00',
          room: data.room || 'Ruang 1',
          academicYear: data.academicYear || '2024/2025',
          semester: data.semester || '1',
          status: data.status || 'active',
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt,
          updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : data.updatedAt,
        };
      });
      memoryCache.set('schedules:all', results);
      return results;
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, 'schedules');
    }
  },

  async create(data: Omit<Schedule, 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      // Validate conflict
      const allSchedules = await this.getAll();
      const conflict = allSchedules.find(
        (s) =>
          s.status === 'active' &&
          s.day === data.day &&
          (s.teacherId === data.teacherId || s.classId === data.classId) &&
          isTimeOverlap(s.startTime, s.endTime, data.startTime, data.endTime)
      );

      if (conflict) {
        if (conflict.teacherId === data.teacherId) {
          throw new Error(
            `Jadwal bentrok! Guru sudah memiliki jadwal mengajar di kelas ${conflict.className} pada ${data.day} pukul ${conflict.startTime} - ${conflict.endTime}`
          );
        } else {
          throw new Error(
            `Jadwal bentrok! Kelas ${conflict.className} sudah memiliki jadwal mapel ${conflict.subjectName} pada ${data.day} pukul ${conflict.startTime} - ${conflict.endTime}`
          );
        }
      }

      const id = data.scheduleId || `JADWAL-${Date.now()}`;
      await setDoc(doc(db, 'schedules', id), {
        ...data,
        scheduleId: id,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      memoryCache.invalidate('schedules');
      return id;
    } catch (err) {
      if (err instanceof Error && err.message.includes('Jadwal bentrok')) {
        throw err;
      }
      handleFirestoreError(err, OperationType.CREATE, 'schedules');
    }
  },

  async update(scheduleId: string, updates: Partial<Schedule>): Promise<void> {
    try {
      await updateDoc(doc(db, 'schedules', scheduleId), {
        ...updates,
        updatedAt: serverTimestamp(),
      });
      memoryCache.invalidate('schedules');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `schedules/${scheduleId}`);
    }
  },

  async delete(scheduleId: string): Promise<void> {
    try {
      await deleteDoc(doc(db, 'schedules', scheduleId));
      memoryCache.invalidate('schedules');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `schedules/${scheduleId}`);
    }
  },
};
