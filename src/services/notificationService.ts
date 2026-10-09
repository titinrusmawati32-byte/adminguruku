import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { AppNotification } from '../types';
import { db, handleFirestoreError, OperationType } from './firebase';

export const notificationService = {
  subscribe(callback: (notifications: AppNotification[]) => void) {
    try {
      const q = query(collection(db, 'notifications'), orderBy('createdAt', 'desc'), limit(15));
      return onSnapshot(
        q,
        (snap) => {
          const list: AppNotification[] = snap.docs.map((d) => {
            const data = d.data();
            return {
              notificationId: d.id,
              userId: data.userId,
              title: data.title || '',
              message: data.message || '',
              type: data.type || 'info',
              read: !!data.read,
              createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt || new Date().toISOString(),
            };
          });
          callback(list);
        },
        (err) => {
          if (err.message?.includes('insufficient permissions') || err.message?.includes('permission-denied')) {
            console.warn('Notification listener: auth session pending or denied.');
            callback([]);
            return;
          }
          handleFirestoreError(err, OperationType.GET, 'notifications');
        }
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, 'notifications');
    }
  },

  async send(notification: Omit<AppNotification, 'notificationId' | 'createdAt'>): Promise<void> {
    try {
      const id = `NOTIF-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      await setDoc(doc(db, 'notifications', id), {
        ...notification,
        notificationId: id,
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'notifications');
    }
  },

  async markAsRead(notificationId: string): Promise<void> {
    try {
      await updateDoc(doc(db, 'notifications', notificationId), {
        read: true,
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `notifications/${notificationId}`);
    }
  },
};
