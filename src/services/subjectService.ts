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
import { Subject } from '../types';
import { memoryCache } from './cacheService';
import { db, handleFirestoreError, OperationType } from './firebase';

export const subjectService = {
  async getAll(): Promise<Subject[]> {
    const cached = memoryCache.get<Subject[]>('subjects:all');
    if (cached) return cached;

    try {
      const q = query(collection(db, 'subjects'), orderBy('name', 'asc'));
      const snap = await getDocs(q);
      const results = snap.docs.map((d) => ({
        subjectId: d.id,
        code: d.data().code || '',
        name: d.data().name || '',
        group: d.data().group || 'Kelompok A (Wajib)',
        status: d.data().status || 'active',
        createdAt: d.data().createdAt?.toDate ? d.data().createdAt.toDate().toISOString() : d.data().createdAt,
        updatedAt: d.data().updatedAt?.toDate ? d.data().updatedAt.toDate().toISOString() : d.data().updatedAt,
      }));
      memoryCache.set('subjects:all', results);
      return results;
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, 'subjects');
    }
  },

  async create(data: Omit<Subject, 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      const id = data.subjectId || `MAPEL-${Date.now()}`;
      await setDoc(doc(db, 'subjects', id), {
        ...data,
        subjectId: id,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      memoryCache.invalidate('subjects');
      return id;
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'subjects');
    }
  },

  async update(subjectId: string, updates: Partial<Subject>): Promise<void> {
    try {
      await updateDoc(doc(db, 'subjects', subjectId), {
        ...updates,
        updatedAt: serverTimestamp(),
      });
      memoryCache.invalidate('subjects');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `subjects/${subjectId}`);
    }
  },

  async delete(subjectId: string): Promise<void> {
    try {
      await deleteDoc(doc(db, 'subjects', subjectId));
      memoryCache.invalidate('subjects');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `subjects/${subjectId}`);
    }
  },
};
