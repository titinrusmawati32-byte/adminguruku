import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { doc, getDocFromServer, getFirestore } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
// CRITICAL: Must pass databaseId from config
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

// Test server connection as mandated by skill
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firestore notice: Connection is currently initializing or offline.', error);
    }
  }
}
testConnection();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export function getFriendlyErrorMessage(error: unknown): string {
  if (!error) return 'Terjadi kesalahan sistem.';
  const str = error instanceof Error ? error.message : String(error);
  if (str.includes('permission-denied') || str.includes('insufficient permissions')) {
    return 'Anda tidak memiliki izin untuk melakukan tindakan ini.';
  }
  if (str.includes('not-found')) {
    return 'Data yang diminta tidak ditemukan.';
  }
  if (str.includes('already-exists')) {
    return 'Data dengan informasi ini sudah ada di sistem.';
  }
  if (str.includes('unavailable') || str.includes('client is offline')) {
    return 'Koneksi ke server database sedang tidak stabil. Coba lagi beberapa saat.';
  }
  if (str.includes('auth/invalid-credential') || str.includes('auth/wrong-password') || str.includes('auth/user-not-found')) {
    return 'Username atau password yang dimasukkan tidak cocok.';
  }
  if (str.includes('auth/operation-not-allowed') || str.includes('operation-not-allowed')) {
    return "Silakan gunakan tombol 'Masuk dengan Google / Belajar.id' atau login dengan akun demo cepat (admin: admin123, guru: guru12345).";
  }
  return str;
}
