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
import { Guidance, UserProfile } from '../types';
import { authorizationService, matchesClassAssignment } from './authorizationService';
import { memoryCache } from './cacheService';
import { db, handleFirestoreError, OperationType } from './firebase';

export const guidanceService = {
  async getAll(currentUser?: UserProfile | null): Promise<Guidance[]> {
    const cached = memoryCache.get<Guidance[]>('guidance:all');
    let allGuidance = cached;

    if (!allGuidance) {
      try {
        const q = query(collection(db, 'guidance'), orderBy('date', 'desc'));
        const snap = await getDocs(q);
        allGuidance = snap.docs.map((d) => {
          const data = d.data();
          return {
            guidanceId: d.id,
            teacherId: data.teacherId || '',
            teacherName: data.teacherName || '',
            studentId: data.studentId || '',
            studentName: data.studentName || '',
            nis: data.nis || '',
            className: data.className || '',
            date: data.date || '',
            category: data.category || 'Akademik',
            problem: data.problem || '',
            action: data.action || '',
            followUp: data.followUp || '',
            status: data.status || 'open',
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt,
            updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : data.updatedAt,
          };
        });
        memoryCache.set('guidance:all', allGuidance);
      } catch (err) {
        handleFirestoreError(err, OperationType.LIST, 'guidance');
        return [];
      }
    }

    if (currentUser && currentUser.role === 'guru') {
      const authorizedKeys = authorizationService.getUserAuthorizedClassKeys(currentUser);
      if (authorizedKeys.length === 0) return [];
      return allGuidance.filter((item) => {
        return matchesClassAssignment(item.className || '', authorizedKeys);
      });
    }

    return allGuidance;
  },

  async create(
    data: Omit<Guidance, 'createdAt' | 'updatedAt'>,
    currentUser?: UserProfile | null
  ): Promise<string> {
    if (currentUser && currentUser.role === 'guru') {
      await authorizationService.assertTeacherAuthorizedForClass(
        currentUser,
        data.className || '',
        'mencatat bimbingan siswa rombel ini'
      );
    }

    try {
      const id = data.guidanceId || `BIMBINGAN-${Date.now()}`;
      await setDoc(doc(db, 'guidance', id), {
        ...data,
        guidanceId: id,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      memoryCache.invalidate('guidance');
      return id;
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'guidance');
    }
  },

  async update(guidanceId: string, updates: Partial<Guidance>): Promise<void> {
    try {
      await updateDoc(doc(db, 'guidance', guidanceId), {
        ...updates,
        updatedAt: serverTimestamp(),
      });
      memoryCache.invalidate('guidance');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `guidance/${guidanceId}`);
    }
  },

  async delete(guidanceId: string): Promise<void> {
    try {
      await deleteDoc(doc(db, 'guidance', guidanceId));
      memoryCache.invalidate('guidance');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `guidance/${guidanceId}`);
    }
  },
};
