import {
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  writeBatch,
} from 'firebase/firestore';
import { db, auth, sanitizeFirestoreData } from '../services/firebase';

export { db, auth, sanitizeFirestoreData };

export const COLLECTIONS = {
  LOG_ABSENSI: 'attendance',
  SISWA: 'students',
  MAPEL: 'subjects',
  PENGATURAN: 'settings',
  ROMBEL: 'classes',
} as const;

export async function saveDocument(
  collectionName: string,
  docId: string,
  data: Record<string, any>
): Promise<void> {
  const ref = doc(db, collectionName, docId);
  const payload = sanitizeFirestoreData({
    ...data,
    updatedAt: data.updatedAt || serverTimestamp(),
  });
  await setDoc(ref, payload, { merge: true });
}

export async function batchSaveDocuments(
  collectionName: string,
  items: Array<Record<string, any>>
): Promise<void> {
  if (!items || items.length === 0) return;

  const batch = writeBatch(db);
  for (const item of items) {
    const docId = item.id || item.docId || item.studentId || item.attendanceId;
    if (docId) {
      const ref = doc(db, collectionName, String(docId));
      const sanitized = sanitizeFirestoreData({
        ...item,
        updatedAt: item.updatedAt || serverTimestamp(),
      });
      batch.set(ref, sanitized, { merge: true });
    }
  }
  await batch.commit();
}

export async function getDocument(
  collectionName: string,
  docId: string
): Promise<Record<string, any> | null> {
  const ref = doc(db, collectionName, docId);
  const snap = await getDoc(ref);
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}
