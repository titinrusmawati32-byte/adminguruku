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
  where,
} from 'firebase/firestore';
import { Assessment, UserProfile } from '../types';
import { memoryCache } from './cacheService';
import { db, handleFirestoreError, OperationType } from './firebase';

export const assessmentService = {
  async getAll(currentUser?: UserProfile | null): Promise<Assessment[]> {
    const cached = memoryCache.get<Assessment[]>('assessments:all');
    let results: Assessment[] = cached || [];

    if (!cached) {
      try {
        const q = query(collection(db, 'assessments'), orderBy('date', 'desc'));
        const snap = await getDocs(q);
        results = snap.docs.map((d) => {
          const data = d.data();
          return {
            assessmentId: d.id,
            classId: data.classId || '',
            className: data.className || '',
            subjectId: data.subjectId || '',
            subjectName: data.subjectName || '',
            teacherId: data.teacherId || '',
            type: data.type || 'formatif',
            title: data.title || '',
            date: data.date || '',
            maxScore: data.maxScore || 100,
            scores: data.scores || [],
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt,
            updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : data.updatedAt,
          };
        });
        memoryCache.set('assessments:all', results);
      } catch (err) {
        handleFirestoreError(err, OperationType.LIST, 'assessments');
        return [];
      }
    }

    if (currentUser && currentUser.role === 'guru') {
      const { authorizationService, matchesClassAssignment } = await import('./authorizationService');
      const authorizedKeys = authorizationService.getUserAuthorizedClassKeys(currentUser);
      if (authorizedKeys.length === 0) return [];
      return results.filter((a) => {
        return (
          matchesClassAssignment(a.classId, authorizedKeys) ||
          matchesClassAssignment(a.className || '', authorizedKeys)
        );
      });
    }

    return results;
  },

  async getByClassAndSubject(
    classId: string,
    subjectId?: string,
    currentUser?: UserProfile | null
  ): Promise<Assessment[]> {
    if (currentUser && currentUser.role === 'guru') {
      const { authorizationService } = await import('./authorizationService');
      await authorizationService.assertTeacherAuthorizedForClass(
        currentUser,
        classId,
        'melihat data penilaian rombel ini'
      );
    }

    const cacheKey = `assessments:class:${classId}:${subjectId || 'all'}`;
    const cached = memoryCache.get<Assessment[]>(cacheKey);
    if (cached) return cached;

    try {
      let q = query(collection(db, 'assessments'), where('classId', '==', classId));
      const snap = await getDocs(q);
      const list = snap.docs.map((d) => {
        const data = d.data();
        return {
          assessmentId: d.id,
          classId: data.classId || '',
          className: data.className || '',
          subjectId: data.subjectId || '',
          subjectName: data.subjectName || '',
          teacherId: data.teacherId || '',
          type: data.type || 'formatif',
          title: data.title || '',
          date: data.date || '',
          maxScore: data.maxScore || 100,
          scores: data.scores || [],
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt,
          updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : data.updatedAt,
        };
      });

      const filtered = subjectId ? list.filter((a) => a.subjectId === subjectId) : list;
      memoryCache.set(cacheKey, filtered);
      return filtered;
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, 'assessments');
    }
  },

  async create(
    data: Omit<Assessment, 'createdAt' | 'updatedAt'>,
    currentUser?: UserProfile | null
  ): Promise<string> {
    if (currentUser && currentUser.role === 'guru') {
      const { authorizationService } = await import('./authorizationService');
      await authorizationService.assertTeacherAuthorizedForClass(
        currentUser,
        data.classId,
        'membuat asesmen nilai pada rombel ini'
      );
    }

    try {
      const id = data.assessmentId || `NILAI-${Date.now()}`;
      await setDoc(doc(db, 'assessments', id), {
        ...data,
        assessmentId: id,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      memoryCache.invalidate('assessments');
      return id;
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'assessments');
    }
  },

  async update(assessmentId: string, updates: Partial<Assessment>): Promise<void> {
    try {
      await updateDoc(doc(db, 'assessments', assessmentId), {
        ...updates,
        updatedAt: serverTimestamp(),
      });
      memoryCache.invalidate('assessments');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `assessments/${assessmentId}`);
    }
  },

  async delete(assessmentId: string): Promise<void> {
    try {
      await deleteDoc(doc(db, 'assessments', assessmentId));
      memoryCache.invalidate('assessments');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `assessments/${assessmentId}`);
    }
  },

  calculateStats(scores: { score: number }[], kkm = 75, maxScore = 100) {
    if (!scores || scores.length === 0) {
      return { average: 0, highest: 0, lowest: 0, total: 0, passedCount: 0, passPercentage: 0 };
    }
    const validScores = scores.filter((s) => typeof s.score === 'number' && !isNaN(s.score));
    if (validScores.length === 0) {
      return { average: 0, highest: 0, lowest: 0, total: 0, passedCount: 0, passPercentage: 0 };
    }

    const total = validScores.length;
    const sum = validScores.reduce((acc, curr) => acc + curr.score, 0);
    const average = Math.round((sum / total) * 10) / 10;
    const highest = Math.max(...validScores.map((s) => s.score));
    const lowest = Math.min(...validScores.map((s) => s.score));
    const passedCount = validScores.filter((s) => s.score >= kkm).length;
    const passPercentage = Math.round((passedCount / total) * 100);

    return { average, highest, lowest, total, passedCount, passPercentage };
  },
};
