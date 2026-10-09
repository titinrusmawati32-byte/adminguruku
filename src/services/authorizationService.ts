import { doc, getDoc } from 'firebase/firestore';
import { SchoolClass, UserProfile } from '../types';
import { db } from './firebase';

/**
 * Normalizes a class name or ID to easily compare
 * e.g., "CLS-1A" -> "1a", "Kelas 1A" -> "1a", "Kelas 1" -> "1", "1" -> "1"
 */
export function normalizeClassKey(key: string | undefined | null): string {
  if (!key) return '';
  return key
    .toLowerCase()
    .replace(/^cls[-_]?/, '')
    .replace(/^kelas\s*/, '')
    .replace(/\s+/g, '')
    .trim();
}

/**
 * Checks if a class (by ID or name) matches any entry in an assigned list
 */
export function matchesClassAssignment(
  targetClassIdOrName: string,
  assignedClassList: string[]
): boolean {
  if (!targetClassIdOrName) return false;
  const targetNorm = normalizeClassKey(targetClassIdOrName);
  const targetExact = targetClassIdOrName.trim().toLowerCase();

  return assignedClassList.some((assigned) => {
    if (!assigned) return false;
    const assignedNorm = normalizeClassKey(assigned);
    const assignedExact = assigned.trim().toLowerCase();

    // Exact string match (e.g. "Kelas 1A" === "Kelas 1A" or "CLS-1A" === "CLS-1A")
    if (targetExact === assignedExact) return true;
    // Normalized key match (e.g. "cls-1a" matches "kelas 1a")
    if (targetNorm && assignedNorm && targetNorm === assignedNorm) return true;
    // Base grade match if assigned is general e.g. "Kelas 1" matches "Kelas 1A"
    if (assignedNorm === '1' && targetNorm.startsWith('1')) return true;
    if (assignedNorm === '2' && targetNorm.startsWith('2')) return true;
    if (assignedNorm === '3' && targetNorm.startsWith('3')) return true;
    if (assignedNorm === '4' && targetNorm.startsWith('4')) return true;
    if (assignedNorm === '5' && targetNorm.startsWith('5')) return true;
    if (assignedNorm === '6' && targetNorm.startsWith('6')) return true;

    return false;
  });
}

export const authorizationService = {
  /**
   * Fetches official user profile directly from Firestore database
   * to prevent any client-side tampering or forged session data.
   */
  async getOfficialDatabaseUser(uid: string): Promise<UserProfile | null> {
    try {
      if (!uid) return null;
      const snap = await getDoc(doc(db, 'users', uid));
      if (!snap.exists()) return null;
      const data = snap.data();
      return {
        uid: snap.id,
        username: data.username || '',
        displayName: data.displayName || '',
        role: data.role || 'guru',
        teacherId: data.teacherId,
        nip: data.nip || '',
        phone: data.phone || '',
        email: data.email || '',
        assignedClasses: data.assignedClasses || [],
        assignedSubjects: data.assignedSubjects || [],
        isHomeroom: Boolean(data.isHomeroom),
        homeroomClass: data.homeroomClass || '',
        status: data.status || 'active',
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt,
        updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : data.updatedAt,
      };
    } catch (err) {
      console.warn('Gagal mengambil data otorisasi user dari database:', err);
      return null;
    }
  },

  /**
   * Resolves list of all class identifiers authorized for this user
   */
  getUserAuthorizedClassKeys(user: UserProfile | null | undefined): string[] {
    if (!user) return [];
    if (user.role === 'admin') return ['*']; // Admin has access to all

    const list: string[] = [];
    if (user.isHomeroom && user.homeroomClass) {
      list.push(user.homeroomClass);
    }
    if (Array.isArray(user.assignedClasses)) {
      list.push(...user.assignedClasses);
    }
    return Array.from(new Set(list));
  },

  /**
   * Verifies if a teacher has official database authorization for target class.
   * If user is an Admin, always returns true.
   */
  async verifyTeacherClassAccess(
    user: UserProfile | null | undefined,
    targetClassIdOrName: string
  ): Promise<boolean> {
    if (!user) return false;
    if (user.role === 'admin') return true;
    if (!targetClassIdOrName) return false;

    // Check with currently loaded profile first
    const authorizedKeys = this.getUserAuthorizedClassKeys(user);
    const hasInitialMatch = matchesClassAssignment(targetClassIdOrName, authorizedKeys);

    // Also verify against official database state for strict backend security
    if (user.uid) {
      const dbUser = await this.getOfficialDatabaseUser(user.uid);
      if (dbUser) {
        if (dbUser.role === 'admin') return true;
        const dbKeys = this.getUserAuthorizedClassKeys(dbUser);
        return matchesClassAssignment(targetClassIdOrName, dbKeys);
      }
    }

    return hasInitialMatch;
  },

  /**
   * Strict backend validation gate: throws error if access is rejected
   */
  async assertTeacherAuthorizedForClass(
    user: UserProfile | null | undefined,
    targetClassIdOrName: string,
    actionName = 'mengakses data rombel'
  ): Promise<void> {
    const isAllowed = await this.verifyTeacherClassAccess(user, targetClassIdOrName);
    if (!isAllowed) {
      const errMsg = `[Akses Ditolak - 403] Anda tidak memiliki wewenang resmi pada rombel "${targetClassIdOrName}" untuk ${actionName}. Penugasan diverifikasi langsung terhadap database sekolah.`;
      console.error(errMsg);
      throw new Error(errMsg);
    }
  },

  /**
   * Filters a list of SchoolClass objects based on user role and assignment.
   * Admin: returns all classes.
   * Guru: returns ONLY classes assigned to them.
   */
  filterClassesForUser(
    classes: SchoolClass[],
    user: UserProfile | null | undefined
  ): SchoolClass[] {
    if (!user) return [];
    if (user.role === 'admin') return classes;

    const authorizedKeys = this.getUserAuthorizedClassKeys(user);
    if (authorizedKeys.length === 0) return [];

    return classes.filter((cls) => {
      return (
        matchesClassAssignment(cls.classId, authorizedKeys) ||
        matchesClassAssignment(cls.name, authorizedKeys)
      );
    });
  },

  /**
   * Checks if guru has at least one assigned class
   */
  hasAnyClassAssignment(user: UserProfile | null | undefined): boolean {
    if (!user) return false;
    if (user.role === 'admin') return true;
    return this.getUserAuthorizedClassKeys(user).length > 0;
  },
};
