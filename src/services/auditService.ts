import { collection, doc, getDocs, limit, orderBy, query, serverTimestamp, setDoc } from 'firebase/firestore';
import { AuditLog } from '../types';
import { auth, db } from './firebase';

export const auditService = {
  async log(action: string, collectionName: string, documentId: string, details?: string) {
    try {
      const user = auth.currentUser;
      const logId = `LOG-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      await setDoc(doc(db, 'audit_logs', logId), {
        logId,
        userId: user?.uid || 'system',
        userName: user?.displayName || user?.email || 'System',
        action,
        collection: collectionName,
        documentId,
        timestamp: new Date().toISOString(),
        details: details || '',
        createdAt: serverTimestamp(),
      });
    } catch (e) {
      console.warn('Failed to record audit log', e);
    }
  },

  async getRecent(limitCount = 20): Promise<AuditLog[]> {
    try {
      const q = query(collection(db, 'audit_logs'), orderBy('createdAt', 'desc'), limit(limitCount));
      const snap = await getDocs(q);
      return snap.docs.map((d) => {
        const data = d.data();
        return {
          logId: d.id,
          userId: data.userId,
          userName: data.userName,
          action: data.action,
          collection: data.collection,
          documentId: data.documentId,
          timestamp: data.timestamp || (data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : ''),
          details: data.details,
        };
      });
    } catch {
      return [];
    }
  },
};
