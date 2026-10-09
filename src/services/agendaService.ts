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
import { TeachingAgenda, UserProfile } from '../types';
import { authorizationService, matchesClassAssignment } from './authorizationService';
import { memoryCache } from './cacheService';
import { db, handleFirestoreError, OperationType } from './firebase';

export const agendaService = {
  async getAll(currentUser?: UserProfile | null): Promise<TeachingAgenda[]> {
    const cached = memoryCache.get<TeachingAgenda[]>('agendas:all');
    let allAgendas = cached;

    if (!allAgendas) {
      try {
        const q = query(collection(db, 'teaching_agendas'), orderBy('date', 'desc'));
        const snap = await getDocs(q);
        allAgendas = snap.docs.map((d) => {
          const data = d.data();
          return {
            agendaId: d.id,
            teacherId: data.teacherId || '',
            teacherName: data.teacherName || '',
            scheduleId: data.scheduleId,
            classId: data.classId || '',
            className: data.className || '',
            subjectId: data.subjectId || '',
            subjectName: data.subjectName || '',
            date: data.date || '',
            topic: data.topic || '',
            learningObjective: data.learningObjective || '',
            activity: data.activity || '',
            attendanceSummary: data.attendanceSummary || '',
            notes: data.notes || '',
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt,
            updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : data.updatedAt,
          };
        });
        memoryCache.set('agendas:all', allAgendas);
      } catch (err) {
        handleFirestoreError(err, OperationType.LIST, 'teaching_agendas');
        return [];
      }
    }

    if (currentUser && currentUser.role === 'guru') {
      const authorizedKeys = authorizationService.getUserAuthorizedClassKeys(currentUser);
      if (authorizedKeys.length === 0) return [];
      return allAgendas.filter((item) => {
        return (
          matchesClassAssignment(item.classId, authorizedKeys) ||
          matchesClassAssignment(item.className || '', authorizedKeys)
        );
      });
    }

    return allAgendas;
  },

  async create(
    data: Omit<TeachingAgenda, 'createdAt' | 'updatedAt'>,
    currentUser?: UserProfile | null
  ): Promise<string> {
    if (currentUser && currentUser.role === 'guru') {
      await authorizationService.assertTeacherAuthorizedForClass(
        currentUser,
        data.classId,
        'membuat agenda mengajar di rombel ini'
      );
    }

    try {
      const id = data.agendaId || `AGENDA-${Date.now()}`;
      await setDoc(doc(db, 'teaching_agendas', id), {
        ...data,
        agendaId: id,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      memoryCache.invalidate('agendas');
      return id;
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'teaching_agendas');
    }
  },

  async update(agendaId: string, updates: Partial<TeachingAgenda>): Promise<void> {
    try {
      await updateDoc(doc(db, 'teaching_agendas', agendaId), {
        ...updates,
        updatedAt: serverTimestamp(),
      });
      memoryCache.invalidate('agendas');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `teaching_agendas/${agendaId}`);
    }
  },

  async delete(agendaId: string): Promise<void> {
    try {
      await deleteDoc(doc(db, 'teaching_agendas', agendaId));
      memoryCache.invalidate('agendas');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `teaching_agendas/${agendaId}`);
    }
  },
};
