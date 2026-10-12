import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import * as XLSX from 'xlsx';
import { Student, UserProfile } from '../types';
import { authorizationService, matchesClassAssignment, normalizeClassKey } from './authorizationService';
import { memoryCache } from './cacheService';
import { db, handleFirestoreError, OperationType } from './firebase';

export const INITIAL_SAMPLE_STUDENTS: Omit<Student, 'createdAt' | 'updatedAt'>[] = [
  // Kelas 1A (Fase A - Binaan Guru 1)
  { studentId: 'STU-1A-01', id: 'STU-1A-01', nis: '24101', nisn: '0165123401', name: 'Ahmad Fauzi Pratama', nama: 'Ahmad Fauzi Pratama', gender: 'L', classId: 'CLS-1A', className: 'Kelas 1A', kelas: 'Kelas 1A', status: 'active', qrCode: 'STU-1A-01' },
  { studentId: 'STU-1A-02', id: 'STU-1A-02', nis: '24102', nisn: '0165123402', name: 'Aisyah Putri Azzahra', nama: 'Aisyah Putri Azzahra', gender: 'P', classId: 'CLS-1A', className: 'Kelas 1A', kelas: 'Kelas 1A', status: 'active', qrCode: 'STU-1A-02' },
  { studentId: 'STU-1A-03', id: 'STU-1A-03', nis: '24103', nisn: '0165123403', name: 'Bima Satria Yudha', nama: 'Bima Satria Yudha', gender: 'L', classId: 'CLS-1A', className: 'Kelas 1A', kelas: 'Kelas 1A', status: 'active', qrCode: 'STU-1A-03' },
  { studentId: 'STU-1A-04', id: 'STU-1A-04', nis: '24104', nisn: '0165123404', name: 'Cantika Dewi Maharani', nama: 'Cantika Dewi Maharani', gender: 'P', classId: 'CLS-1A', className: 'Kelas 1A', kelas: 'Kelas 1A', status: 'active', qrCode: 'STU-1A-04' },
  { studentId: 'STU-1A-05', id: 'STU-1A-05', nis: '24105', nisn: '0165123405', name: 'Danendra Raditya', nama: 'Danendra Raditya', gender: 'L', classId: 'CLS-1A', className: 'Kelas 1A', kelas: 'Kelas 1A', status: 'active', qrCode: 'STU-1A-05' },

  // Kelas 2A (Fase A - Binaan Guru 2)
  { studentId: 'STU-2A-01', id: 'STU-2A-01', nis: '23101', nisn: '0155123401', name: 'Dimas Anggara Saputra', nama: 'Dimas Anggara Saputra', gender: 'L', classId: 'CLS-2A', className: 'Kelas 2A', kelas: 'Kelas 2A', status: 'active', qrCode: 'STU-2A-01' },
  { studentId: 'STU-2A-02', id: 'STU-2A-02', nis: '23102', nisn: '0155123402', name: 'Eka Lestari Ningsih', nama: 'Eka Lestari Ningsih', gender: 'P', classId: 'CLS-2A', className: 'Kelas 2A', kelas: 'Kelas 2A', status: 'active', qrCode: 'STU-2A-02' },
  { studentId: 'STU-2A-03', id: 'STU-2A-03', nis: '23103', nisn: '0155123403', name: 'Fajar Maulana Ramadhan', nama: 'Fajar Maulana Ramadhan', gender: 'L', classId: 'CLS-2A', className: 'Kelas 2A', kelas: 'Kelas 2A', status: 'active', qrCode: 'STU-2A-03' },
  { studentId: 'STU-2A-04', id: 'STU-2A-04', nis: '23104', nisn: '0155123404', name: 'Gita Savitri Kirana', nama: 'Gita Savitri Kirana', gender: 'P', classId: 'CLS-2A', className: 'Kelas 2A', kelas: 'Kelas 2A', status: 'active', qrCode: 'STU-2A-04' },
  { studentId: 'STU-2A-05', id: 'STU-2A-05', nis: '23105', nisn: '0155123405', name: 'Hafiz Al-Farisi', nama: 'Hafiz Al-Farisi', gender: 'L', classId: 'CLS-2A', className: 'Kelas 2A', kelas: 'Kelas 2A', status: 'active', qrCode: 'STU-2A-05' },

  // Kelas 6A (Fase C - Siswa Kelas 6A termasuk Reza)
  { studentId: 'STU-6A-01', id: 'STU-6A-01', nis: '20031', nisn: '0145123401', name: 'Reza', nama: 'Reza', gender: 'L', classId: 'CLS-6A', className: 'Kelas 6A', kelas: 'Kelas 6A', status: 'active', qrCode: '20031' },
  { studentId: 'STU-6A-02', id: 'STU-6A-02', nis: '20032', nisn: '0145123402', name: 'Rania Salsabila Putri', nama: 'Rania Salsabila Putri', gender: 'P', classId: 'CLS-6A', className: 'Kelas 6A', kelas: 'Kelas 6A', status: 'active', qrCode: '20032' },
  { studentId: 'STU-6A-03', id: 'STU-6A-03', nis: '20033', nisn: '0145123403', name: 'Satria Bintang Ramadhan', nama: 'Satria Bintang Ramadhan', gender: 'L', classId: 'CLS-6A', className: 'Kelas 6A', kelas: 'Kelas 6A', status: 'active', qrCode: '20033' },
  { studentId: 'STU-6A-04', id: 'STU-6A-04', nis: '20034', nisn: '0145123404', name: 'Tiara Amanda Kusuma', nama: 'Tiara Amanda Kusuma', gender: 'P', classId: 'CLS-6A', className: 'Kelas 6A', kelas: 'Kelas 6A', status: 'active', qrCode: '20034' },
  { studentId: 'STU-6A-05', id: 'STU-6A-05', nis: '20035', nisn: '0145123405', name: 'Zidane Al-Ghifari', nama: 'Zidane Al-Ghifari', gender: 'L', classId: 'CLS-6A', className: 'Kelas 6A', kelas: 'Kelas 6A', status: 'active', qrCode: '20035' },
];

export const studentService = {
  async seedSampleStudents(): Promise<void> {
    try {
      for (const s of INITIAL_SAMPLE_STUDENTS) {
        await setDoc(doc(db, 'students', s.studentId), {
          ...s,
          id: s.studentId,
          nama: s.name,
          kelas: s.className,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }, { merge: true });
      }
      memoryCache.invalidate('students');
    } catch (e) {
      console.warn('Seed students notice:', e);
    }
  },

  async getAll(currentUser?: UserProfile | null): Promise<Student[]> {
    const cached = memoryCache.get<Student[]>('students:all');
    let allStudents: Student[] = cached || [];

    if (!cached) {
      try {
        const snap = await getDocs(collection(db, 'students'));
        if (snap.empty) {
          await studentService.seedSampleStudents();
          const freshSnap = await getDocs(collection(db, 'students'));
          if (freshSnap.empty) {
            allStudents = [];
            memoryCache.set('students:all', []);
            return [];
          }
          allStudents = freshSnap.docs.map((d) => {
            const data = d.data();
            const sName = data.name || data.nama || '';
            const sClassId = data.classId || data.kelas || '';
            const sClassName = data.className || data.kelas || sClassId;
            return {
              studentId: d.id,
              id: d.id,
              nis: data.nis || '',
              nisn: data.nisn || '',
              name: sName,
              nama: sName,
              gender: data.gender || 'L',
              classId: sClassId,
              className: sClassName,
              kelas: sClassName,
              status: data.status || 'active',
              qrCode: data.qrCode || data.nis || `STU-${d.id}`,
              fotoUrl: data.fotoUrl || '',
              createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt,
              updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : data.updatedAt,
            };
          });
        } else {
          allStudents = snap.docs.map((d) => {
            const data = d.data();
            const sName = data.name || data.nama || '';
            const sClassId = data.classId || data.kelas || '';
            const sClassName = data.className || data.kelas || sClassId;
            return {
              studentId: d.id,
              id: d.id,
              nis: data.nis || '',
              nisn: data.nisn || '',
              name: sName,
              nama: sName,
              gender: data.gender || 'L',
              classId: sClassId,
              className: sClassName,
              kelas: sClassName,
              status: data.status || 'active',
              qrCode: data.qrCode || data.nis || `STU-${d.id}`,
              fotoUrl: data.fotoUrl || '',
              createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt,
              updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : data.updatedAt,
            };
          });
        }
        allStudents.sort((a, b) => a.name.localeCompare(b.name));
        memoryCache.set('students:all', allStudents);
      } catch (err) {
        handleFirestoreError(err, OperationType.LIST, 'students');
      }
    }

    // Role-based security filter: Guru ONLY receives students belonging to their officially assigned rombel
    if (currentUser && currentUser.role === 'guru') {
      const authorizedKeys = authorizationService.getUserAuthorizedClassKeys(currentUser);
      if (authorizedKeys.length === 0) return [];
      return allStudents.filter((s) => {
        return (
          matchesClassAssignment(s.classId, authorizedKeys) ||
          matchesClassAssignment(s.className || '', authorizedKeys)
        );
      });
    }

    return allStudents;
  },

  async getByClassId(classId: string, currentUser?: UserProfile | null): Promise<Student[]> {
    // Backend authorization gate: reject if teacher is unauthorized for target class
    if (currentUser && currentUser.role === 'guru') {
      await authorizationService.assertTeacherAuthorizedForClass(
        currentUser,
        classId,
        'melihat data siswa rombel ini'
      );
    }

    const cacheKey = `students:class:${classId}`;
    const cached = memoryCache.get<Student[]>(cacheKey);
    if (cached) return cached;

    try {
      // Fetch all active students and filter by classId or className flexibly
      const snap = await getDocs(collection(db, 'students'));
      const list = snap.docs
        .map((d) => {
          const data = d.data();
          const sName = data.name || data.nama || '';
          const sClassId = data.classId || data.kelas || '';
          const sClassName = data.className || data.kelas || sClassId;
          return {
            studentId: d.id,
            id: d.id,
            nis: data.nis || '',
            nisn: data.nisn || '',
            name: sName,
            nama: sName,
            gender: data.gender || 'L',
            classId: sClassId,
            className: sClassName,
            kelas: sClassName,
            status: data.status || 'active',
            qrCode: data.qrCode || data.nis || `STU-${d.id}`,
            fotoUrl: data.fotoUrl || '',
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt,
            updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : data.updatedAt,
          };
        })
        .filter((s) => {
          if (s.status !== 'active') return false;
          const targetNorm = normalizeClassKey(classId);
          const sClassNorm = normalizeClassKey(s.classId);
          const sNameNorm = normalizeClassKey(s.className);
          return (
            s.classId === classId ||
            s.className === classId ||
            (targetNorm && sClassNorm && targetNorm === sClassNorm) ||
            (targetNorm && sNameNorm && targetNorm === sNameNorm) ||
            (s.classId && classId && (s.classId.includes(classId) || classId.includes(s.classId)))
          );
        });

      const sorted = list.sort((a, b) => a.name.localeCompare(b.name));
      memoryCache.set(cacheKey, sorted);
      return sorted;
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, 'students');
    }
  },

  async getById(studentId: string): Promise<Student | null> {
    try {
      const snap = await getDoc(doc(db, 'students', studentId));
      if (!snap.exists()) return null;
      const data = snap.data();
      return {
        studentId: snap.id,
        nis: data.nis,
        nisn: data.nisn,
        name: data.name,
        gender: data.gender,
        classId: data.classId,
        className: data.className,
        status: data.status,
        qrCode: data.qrCode || `STU-${snap.id}`,
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt,
        updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : data.updatedAt,
      };
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, `students/${studentId}`);
    }
  },

  // Direct Firestore Lookup for QR Scanner fallback (guarantees student recognition)
  async lookupStudent(identifier: string): Promise<Student | null> {
    if (!identifier) return null;
    const raw = identifier.trim();
    const withoutStu = raw.replace(/^STU-/i, '');
    const withStu = raw.startsWith('STU-') ? raw : `STU-${raw}`;

    const candidateIds = Array.from(new Set([raw, withoutStu, withStu])).filter(Boolean);

    const formatStudent = (docId: string, data: any): Student => {
      const sName = data.name || data.nama || '';
      const sClassId = data.classId || data.kelas || '';
      const sClassName = data.className || data.kelas || sClassId;
      return {
        studentId: docId,
        id: docId,
        nis: data.nis || '',
        nisn: data.nisn || '',
        name: sName,
        nama: sName,
        gender: data.gender || 'L',
        classId: sClassId,
        className: sClassName,
        kelas: sClassName,
        status: data.status || 'active',
        qrCode: data.qrCode || data.nis || `STU-${docId}`,
        fotoUrl: data.fotoUrl || '',
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt,
        updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : data.updatedAt,
      };
    };

    // 1. Direct doc ID lookup
    for (const docId of candidateIds) {
      try {
        const snap = await getDoc(doc(db, 'students', docId));
        if (snap.exists()) {
          return formatStudent(snap.id, snap.data());
        }
      } catch {}
    }

    // 2. Query by qrCode field
    for (const qrVal of candidateIds) {
      try {
        const q = query(collection(db, 'students'), where('qrCode', '==', qrVal));
        const snap = await getDocs(q);
        if (!snap.empty) {
          return formatStudent(snap.docs[0].id, snap.docs[0].data());
        }
      } catch {}
    }

    // 3. Query by studentId property
    for (const sId of candidateIds) {
      try {
        const q = query(collection(db, 'students'), where('studentId', '==', sId));
        const snap = await getDocs(q);
        if (!snap.empty) {
          return formatStudent(snap.docs[0].id, snap.docs[0].data());
        }
      } catch {}
    }

    // 4. Query by NIS
    for (const nisVal of [raw, withoutStu]) {
      try {
        const q = query(collection(db, 'students'), where('nis', '==', nisVal));
        const snap = await getDocs(q);
        if (!snap.empty) {
          return formatStudent(snap.docs[0].id, snap.docs[0].data());
        }
      } catch {}
    }

    // 5. Query by NISN
    for (const nisnVal of [raw, withoutStu]) {
      try {
        const q = query(collection(db, 'students'), where('nisn', '==', nisnVal));
        const snap = await getDocs(q);
        if (!snap.empty) {
          return formatStudent(snap.docs[0].id, snap.docs[0].data());
        }
      } catch {}
    }

    return null;
  },

  async create(
    student: Omit<Student, 'createdAt' | 'updatedAt'>,
    currentUser?: UserProfile | null
  ): Promise<string> {
    // Backend authorization gate: teacher can only add student to their own assigned class
    if (currentUser && currentUser.role === 'guru') {
      await authorizationService.assertTeacherAuthorizedForClass(
        currentUser,
        student.classId,
        'menambahkan siswa ke rombel ini'
      );
    }

    try {
      const id = student.studentId || `SISWA-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const qrCode = student.qrCode || `STU-${id}`;
      await setDoc(doc(db, 'students', id), {
        ...student,
        studentId: id,
        qrCode,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      memoryCache.invalidate('students');
      return id;
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'students');
    }
  },


  async update(studentId: string, updates: Partial<Student>): Promise<void> {
    try {
      await updateDoc(doc(db, 'students', studentId), {
        ...updates,
        updatedAt: serverTimestamp(),
      });
      memoryCache.invalidate('students');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `students/${studentId}`);
    }
  },

  async delete(studentId: string, hardDelete = true): Promise<void> {
    try {
      if (hardDelete) {
        await deleteDoc(doc(db, 'students', studentId));
      } else {
        await updateDoc(doc(db, 'students', studentId), {
          status: 'inactive',
          updatedAt: serverTimestamp(),
        });
      }
      memoryCache.invalidate('students');
      memoryCache.invalidate('students:all');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `students/${studentId}`);
    }
  },

  async importFromExcel(file: File, defaultClassId: string, defaultClassName?: string): Promise<{ success: number; errors: string[] }> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const rows: any[] = XLSX.utils.sheet_to_json(firstSheet);

          let count = 0;
          const errors: string[] = [];

          for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const name = row['Nama'] || row['Nama Siswa'] || row['name'] || row['Name'];
            const nis = String(row['NIS'] || row['nis'] || '').trim();
            const nisn = String(row['NISN'] || row['nisn'] || '').trim();
            const genderRaw = String(row['Jenis Kelamin'] || row['JK'] || row['gender'] || 'L').toUpperCase();
            const gender = genderRaw.startsWith('P') ? 'P' : 'L';
            const classId = row['ID Kelas'] || row['classId'] || defaultClassId;
            const className = row['Kelas'] || row['className'] || defaultClassName || '';

            if (!name) {
              errors.push(`Baris ${i + 2}: Nama siswa wajib diisi.`);
              continue;
            }

            const studentId = `SISWA-${Date.now()}-${i}`;
            await setDoc(doc(db, 'students', studentId), {
              studentId,
              nis: nis || `${24000 + i}`,
              nisn: nisn || `${3000000000 + i}`,
              name,
              gender,
              classId,
              className,
              status: 'active',
              qrCode: `STU-${studentId}`,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
            count++;
          }
          resolve({ success: count, errors });
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = (err) => reject(err);
      reader.readAsArrayBuffer(file);
    });
  },

  exportToExcel(students: Student[], fileName = 'Data_Siswa'): void {
    const exportData = students.map((s, index) => ({
      No: index + 1,
      'NIS': s.nis,
      'NISN': s.nisn,
      'Nama Siswa': s.name,
      'Jenis Kelamin': s.gender === 'L' ? 'Laki-laki' : 'Perempuan',
      'Kelas': s.className || s.classId,
      'Status': s.status === 'active' ? 'Aktif' : 'Non-Aktif',
      'QR Code ID': s.qrCode || `STU-${s.studentId}`,
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    // Auto-fit column widths
    const colWidths = [
      { wch: 6 },
      { wch: 14 },
      { wch: 16 },
      { wch: 28 },
      { wch: 16 },
      { wch: 14 },
      { wch: 12 },
      { wch: 20 },
    ];
    ws['!cols'] = colWidths;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Siswa');
    XLSX.writeFile(wb, `${fileName}_${new Date().toISOString().slice(0, 10)}.xlsx`);
  },
};
