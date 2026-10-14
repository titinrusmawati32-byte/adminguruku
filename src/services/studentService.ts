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
import { SchoolClass, Student, UserProfile } from '../types';
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

  async removeSampleStudents(): Promise<{
    studentsRemoved: number;
    attendanceCleaned: number;
    assessmentsCleaned: number;
    guidanceCleaned: number;
  }> {
    try {
      const snap = await getDocs(collection(db, 'students'));
      const sampleIds = new Set(INITIAL_SAMPLE_STUDENTS.map((s) => s.studentId));
      const sampleNis = new Set(INITIAL_SAMPLE_STUDENTS.map((s) => s.nis));
      const sampleNames = new Set(INITIAL_SAMPLE_STUDENTS.map((s) => s.name.toLowerCase()));

      let studentsRemoved = 0;
      let attendanceCleaned = 0;
      let assessmentsCleaned = 0;
      let guidanceCleaned = 0;

      for (const d of snap.docs) {
        const id = d.id;
        const data = d.data();
        const isSample =
          sampleIds.has(id) ||
          sampleIds.has(data.studentId) ||
          sampleIds.has(data.id) ||
          id.startsWith('STU-1A-') ||
          id.startsWith('STU-2A-') ||
          id.startsWith('STU-6A-') ||
          (data.studentId &&
            (data.studentId.startsWith('STU-1A-') ||
              data.studentId.startsWith('STU-2A-') ||
              data.studentId.startsWith('STU-6A-'))) ||
          INITIAL_SAMPLE_STUDENTS.some(
            (s) =>
              s.nis === data.nis ||
              s.name.toLowerCase() === (data.name || data.nama || '').toLowerCase()
          );

        if (isSample) {
          sampleIds.add(id);
          if (data.studentId) sampleIds.add(data.studentId);
          if (data.nis) sampleNis.add(data.nis);
          if (data.name) sampleNames.add(data.name.toLowerCase());
          await deleteDoc(doc(db, 'students', id));
          studentsRemoved++;
        }
      }

      // Purge attendance records for sample students from Firestore server
      try {
        const attSnap = await getDocs(collection(db, 'attendance'));
        for (const ad of attSnap.docs) {
          const aData = ad.data();
          const isSampleAtt =
            sampleIds.has(aData.studentId) ||
            sampleNis.has(aData.nis) ||
            sampleNames.has((aData.studentName || '').toLowerCase()) ||
            (aData.studentId &&
              (aData.studentId.startsWith('STU-1A-') ||
                aData.studentId.startsWith('STU-2A-') ||
                aData.studentId.startsWith('STU-6A-')));

          if (isSampleAtt) {
            await deleteDoc(doc(db, 'attendance', ad.id));
            attendanceCleaned++;
          }
        }
      } catch (attErr) {
        console.warn('Attendance cleanup notice:', attErr);
      }

      // Clean assessments records for sample students from Firestore server
      try {
        const assSnap = await getDocs(collection(db, 'assessments'));
        for (const asd of assSnap.docs) {
          const asData = asd.data();
          if (Array.isArray(asData.scores) && asData.scores.some((s: any) => sampleIds.has(s.studentId))) {
            const updatedScores = asData.scores.filter((s: any) => !sampleIds.has(s.studentId));
            await updateDoc(doc(db, 'assessments', asd.id), {
              scores: updatedScores,
              updatedAt: serverTimestamp(),
            });
            assessmentsCleaned++;
          }
        }
      } catch (assErr) {
        console.warn('Assessments cleanup notice:', assErr);
      }

      // Purge guidance records for sample students from Firestore server
      try {
        const guiSnap = await getDocs(collection(db, 'guidance'));
        for (const gd of guiSnap.docs) {
          const gData = gd.data();
          const isSampleGui =
            sampleIds.has(gData.studentId) ||
            sampleNis.has(gData.nis) ||
            sampleNames.has((gData.studentName || '').toLowerCase()) ||
            (gData.studentId &&
              (gData.studentId.startsWith('STU-1A-') ||
                gData.studentId.startsWith('STU-2A-') ||
                gData.studentId.startsWith('STU-6A-')));

          if (isSampleGui) {
            await deleteDoc(doc(db, 'guidance', gd.id));
            guidanceCleaned++;
          }
        }
      } catch (guiErr) {
        console.warn('Guidance cleanup notice:', guiErr);
      }

      memoryCache.clear();
      return {
        studentsRemoved,
        attendanceCleaned,
        assessmentsCleaned,
        guidanceCleaned,
      };
    } catch (e) {
      console.error('Error removing sample students:', e);
      return {
        studentsRemoved: 0,
        attendanceCleaned: 0,
        assessmentsCleaned: 0,
        guidanceCleaned: 0,
      };
    }
  },

  async getAll(currentUser?: UserProfile | null): Promise<Student[]> {
    const cached = memoryCache.get<Student[]>('students:all');
    let allStudents: Student[] = cached || [];

    if (!cached) {
      try {
        const snap = await getDocs(collection(db, 'students'));
        if (snap.empty) {
          allStudents = [];
          memoryCache.set('students:all', []);
          return [];
        }

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

  async delete(
    studentId: string,
    hardDelete = true,
    extraIdentifiers?: { id?: string; nis?: string; name?: string }
  ): Promise<{
    studentDeleted: boolean;
    attendanceCleaned: number;
    assessmentsCleaned: number;
    guidanceCleaned: number;
  }> {
    let attendanceCleaned = 0;
    let assessmentsCleaned = 0;
    let guidanceCleaned = 0;

    try {
      if (hardDelete) {
        // 1. Direct delete by ID
        await deleteDoc(doc(db, 'students', studentId)).catch(() => {});

        // 2. Direct delete by alternate ID if different
        if (extraIdentifiers?.id && extraIdentifiers.id !== studentId) {
          await deleteDoc(doc(db, 'students', extraIdentifiers.id)).catch(() => {});
        }

        // 3. Purge all documents in 'students' collection matching studentId, id, or nis
        const targetIds = new Set([studentId, extraIdentifiers?.id].filter(Boolean) as string[]);
        const studentSnap = await getDocs(collection(db, 'students'));
        for (const d of studentSnap.docs) {
          const sData = d.data();
          const matches =
            targetIds.has(d.id) ||
            targetIds.has(sData.studentId) ||
            targetIds.has(sData.id) ||
            (extraIdentifiers?.nis && sData.nis && sData.nis === extraIdentifiers.nis);
          if (matches) {
            await deleteDoc(doc(db, 'students', d.id)).catch(() => {});
          }
        }

        // 4. Cascade delete all attendance records for this student from Firestore server
        try {
          const attSnap = await getDocs(collection(db, 'attendance'));
          for (const ad of attSnap.docs) {
            const aData = ad.data();
            const matches =
              targetIds.has(aData.studentId) ||
              (extraIdentifiers?.nis && aData.nis && aData.nis === extraIdentifiers.nis) ||
              (extraIdentifiers?.name &&
                aData.studentName &&
                aData.studentName.toLowerCase() === extraIdentifiers.name.toLowerCase());
            if (matches) {
              await deleteDoc(doc(db, 'attendance', ad.id)).catch(() => {});
              attendanceCleaned++;
            }
          }
        } catch (attErr) {
          console.warn('Attendance cascade cleanup notice:', attErr);
        }

        // 5. Cascade delete all guidance records for this student from Firestore server
        try {
          const guiSnap = await getDocs(collection(db, 'guidance'));
          for (const gd of guiSnap.docs) {
            const gData = gd.data();
            const matches =
              targetIds.has(gData.studentId) ||
              (extraIdentifiers?.nis && gData.nis && gData.nis === extraIdentifiers.nis) ||
              (extraIdentifiers?.name &&
                gData.studentName &&
                gData.studentName.toLowerCase() === extraIdentifiers.name.toLowerCase());
            if (matches) {
              await deleteDoc(doc(db, 'guidance', gd.id)).catch(() => {});
              guidanceCleaned++;
            }
          }
        } catch (guiErr) {
          console.warn('Guidance cascade cleanup notice:', guiErr);
        }

        // 6. Cascade clean student scores inside assessments from Firestore server
        try {
          const assSnap = await getDocs(collection(db, 'assessments'));
          for (const asd of assSnap.docs) {
            const asData = asd.data();
            if (
              Array.isArray(asData.scores) &&
              asData.scores.some((s: any) => targetIds.has(s.studentId))
            ) {
              const updatedScores = asData.scores.filter(
                (s: any) => !targetIds.has(s.studentId)
              );
              await updateDoc(doc(db, 'assessments', asd.id), {
                scores: updatedScores,
                updatedAt: serverTimestamp(),
              }).catch(() => {});
              assessmentsCleaned++;
            }
          }
        } catch (assErr) {
          console.warn('Assessments cascade cleanup notice:', assErr);
        }
      } else {
        await updateDoc(doc(db, 'students', studentId), {
          status: 'inactive',
          updatedAt: serverTimestamp(),
        });
      }

      memoryCache.clear();

      return {
        studentDeleted: true,
        attendanceCleaned,
        assessmentsCleaned,
        guidanceCleaned,
      };
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `students/${studentId}`);
      return {
        studentDeleted: false,
        attendanceCleaned,
        assessmentsCleaned,
        guidanceCleaned,
      };
    }
  },

  async purgeOrphanedRecords(): Promise<{
    attendancePurged: number;
    guidancePurged: number;
    assessmentsPurged: number;
    studentsPurged: number;
  }> {
    try {
      // 1. Get all current real student IDs and NIS
      const studentSnap = await getDocs(collection(db, 'students'));
      const validStudentIds = new Set<string>();
      const validNis = new Set<string>();
      const validNames = new Set<string>();

      for (const d of studentSnap.docs) {
        const data = d.data();
        validStudentIds.add(d.id);
        if (data.studentId) validStudentIds.add(data.studentId);
        if (data.id) validStudentIds.add(data.id);
        if (data.nis) validNis.add(data.nis);
        if (data.name) validNames.add(data.name.toLowerCase());
        if (data.nama) validNames.add(data.nama.toLowerCase());
      }

      let attendancePurged = 0;
      let guidancePurged = 0;
      let assessmentsPurged = 0;
      let studentsPurged = 0;

      // 2. Scan and purge orphaned attendance records from Firestore
      const attSnap = await getDocs(collection(db, 'attendance'));
      for (const ad of attSnap.docs) {
        const aData = ad.data();
        const hasValidStudent =
          (aData.studentId && validStudentIds.has(aData.studentId)) ||
          (aData.nis && validNis.has(aData.nis)) ||
          (aData.studentName && validNames.has(aData.studentName.toLowerCase()));

        // Also check if it's a sample/demo record prefix
        const isDemo =
          aData.studentId &&
          (aData.studentId.startsWith('STU-1A-') ||
            aData.studentId.startsWith('STU-2A-') ||
            aData.studentId.startsWith('STU-6A-'));

        if (!hasValidStudent || isDemo) {
          await deleteDoc(doc(db, 'attendance', ad.id));
          attendancePurged++;
        }
      }

      // 3. Scan and purge orphaned guidance records from Firestore
      const guiSnap = await getDocs(collection(db, 'guidance'));
      for (const gd of guiSnap.docs) {
        const gData = gd.data();
        const hasValidStudent =
          (gData.studentId && validStudentIds.has(gData.studentId)) ||
          (gData.nis && validNis.has(gData.nis)) ||
          (gData.studentName && validNames.has(gData.studentName.toLowerCase()));

        if (!hasValidStudent) {
          await deleteDoc(doc(db, 'guidance', gd.id));
          guidancePurged++;
        }
      }

      // 4. Scan and clean assessments records from Firestore
      const assSnap = await getDocs(collection(db, 'assessments'));
      for (const asd of assSnap.docs) {
        const asData = asd.data();
        if (Array.isArray(asData.scores)) {
          const originalLen = asData.scores.length;
          const cleaned = asData.scores.filter(
            (s: any) =>
              validStudentIds.has(s.studentId) ||
              (s.studentName && validNames.has(s.studentName.toLowerCase()))
          );
          if (cleaned.length !== originalLen) {
            await updateDoc(doc(db, 'assessments', asd.id), {
              scores: cleaned,
              updatedAt: serverTimestamp(),
            });
            assessmentsPurged += originalLen - cleaned.length;
          }
        }
      }

      memoryCache.clear();

      return {
        attendancePurged,
        guidancePurged,
        assessmentsPurged,
        studentsPurged,
      };
    } catch (e) {
      console.error('Error in purgeOrphanedRecords:', e);
      return {
        attendancePurged: 0,
        guidancePurged: 0,
        assessmentsPurged: 0,
        studentsPurged: 0,
      };
    }
  },

  downloadTemplate(defaultClassName = 'Kelas 1A'): void {
    const templateData = [
      {
        'No': 1,
        'NIS': '24101',
        'NISN': '0165123401',
        'Nama Siswa': 'Ahmad Pratama (Contoh - Ganti/Hapus baris ini)',
        'Jenis Kelamin (L/P)': 'L',
        'Kelas': defaultClassName,
        'Status': 'Aktif',
      },
      {
        'No': 2,
        'NIS': '24102',
        'NISN': '0165123402',
        'Nama Siswa': 'Siti Aisyah (Contoh - Ganti/Hapus baris ini)',
        'Jenis Kelamin (L/P)': 'P',
        'Kelas': defaultClassName,
        'Status': 'Aktif',
      },
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    ws['!cols'] = [
      { wch: 6 },
      { wch: 14 },
      { wch: 16 },
      { wch: 45 },
      { wch: 22 },
      { wch: 16 },
      { wch: 14 },
    ];

    const guideData = [
      { 'Panduan Pengisian Template Import Siswa': '1. Kolom "Nama Siswa" WAJIB diisi nama lengkap peserta didik.' },
      { 'Panduan Pengisian Template Import Siswa': '2. Kolom "NIS" diisi Nomor Induk Siswa di sekolah (angka/teks unik).' },
      { 'Panduan Pengisian Template Import Siswa': '3. Kolom "NISN" diisi Nomor Induk Siswa Nasional 10 digit (opsional).' },
      { 'Panduan Pengisian Template Import Siswa': '4. Kolom "Jenis Kelamin (L/P)" diisi "L" (Laki-laki) atau "P" (Perempuan).' },
      { 'Panduan Pengisian Template Import Siswa': `5. Kolom "Kelas" diisi nama kelas rombel (contoh: ${defaultClassName}). Jika dikosongkan, otomatis menggunakan rombel tujuan di aplikasi.` },
      { 'Panduan Pengisian Template Import Siswa': '6. Kolom "Status" diisi "Aktif" atau "Non-Aktif" (bila dikosongkan otomatis "Aktif").' },
      { 'Panduan Pengisian Template Import Siswa': '7. Anda dapat mengganti atau menghapus 2 baris contoh di lembar pertama sebelum mengunggah.' },
    ];
    const wsGuide = XLSX.utils.json_to_sheet(guideData);
    wsGuide['!cols'] = [{ wch: 90 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template_Siswa');
    XLSX.utils.book_append_sheet(wb, wsGuide, 'Petunjuk_Pengisian');
    const safeName = defaultClassName.replace(/\s+/g, '_');
    XLSX.writeFile(wb, `Template_Data_Siswa_${safeName}.xlsx`);
  },

  async parseExcelPreview(file: File): Promise<{
    totalRows: number;
    previewRows: Array<{
      no: number;
      nis: string;
      nisn: string;
      name: string;
      gender: 'L' | 'P';
      className: string;
      status: string;
    }>;
    errors: string[];
  }> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const targetSheetName =
            workbook.SheetNames.find((s) => s.toLowerCase().includes('siswa') || s.toLowerCase().includes('data')) ||
            workbook.SheetNames[0];
          const sheet = workbook.Sheets[targetSheetName];
          const rawRows: any[] = XLSX.utils.sheet_to_json(sheet);

          const validRows: Array<{
            no: number;
            nis: string;
            nisn: string;
            name: string;
            gender: 'L' | 'P';
            className: string;
            status: string;
          }> = [];
          const errors: string[] = [];

          let idx = 1;
          for (let i = 0; i < rawRows.length; i++) {
            const row = rawRows[i];
            const name = String(
              row['Nama Siswa'] ||
                row['Nama'] ||
                row['nama_siswa'] ||
                row['name'] ||
                row['Name'] ||
                row['NAMA'] ||
                ''
            ).trim();

            // Skip guide rows or empty rows
            if (!name) continue;
            if (
              name.toLowerCase().includes('(contoh') ||
              name.toLowerCase().includes('hapus baris ini')
            ) {
              continue;
            }

            const nis = String(row['NIS'] || row['nis'] || row['No Induk'] || '').trim();
            const nisn = String(row['NISN'] || row['nisn'] || '').trim();
            const genderRaw = String(
              row['Jenis Kelamin (L/P)'] ||
                row['Jenis Kelamin'] ||
                row['JK'] ||
                row['gender'] ||
                row['jk'] ||
                row['L/P'] ||
                'L'
            ).trim().toUpperCase();
            const gender: 'L' | 'P' =
              genderRaw.startsWith('P') || genderRaw === 'PEREMPUAN' || genderRaw === 'WANITA' ? 'P' : 'L';
            const className = String(
              row['Kelas'] || row['className'] || row['ID Kelas'] || row['classId'] || row['Rombel'] || ''
            ).trim();
            const statusRaw = String(row['Status'] || row['status'] || 'Aktif').trim().toLowerCase();
            const status =
              statusRaw.includes('non') || statusRaw.includes('tidak') || statusRaw.includes('inact')
                ? 'Non-Aktif'
                : 'Aktif';

            validRows.push({
              no: idx++,
              nis,
              nisn,
              name,
              gender,
              className,
              status,
            });
          }

          resolve({
            totalRows: validRows.length,
            previewRows: validRows.slice(0, 10),
            errors,
          });
        } catch (err: any) {
          reject(err);
        }
      };
      reader.onerror = (err) => reject(err);
      reader.readAsArrayBuffer(file);
    });
  },

  async importFromExcel(
    file: File,
    defaultClassId: string,
    defaultClassName?: string,
    availableClasses?: SchoolClass[]
  ): Promise<{ success: number; errors: string[] }> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const targetSheetName =
            workbook.SheetNames.find((s) => s.toLowerCase().includes('siswa') || s.toLowerCase().includes('data')) ||
            workbook.SheetNames[0];
          const sheet = workbook.Sheets[targetSheetName];
          const rows: any[] = XLSX.utils.sheet_to_json(sheet);

          let count = 0;
          const errors: string[] = [];

          for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const name = String(
              row['Nama Siswa'] ||
                row['Nama'] ||
                row['nama_siswa'] ||
                row['name'] ||
                row['Name'] ||
                row['NAMA'] ||
                ''
            ).trim();

            if (!name) {
              continue; // Skip blank rows
            }

            // Skip example instruction rows if not deleted by user
            if (
              name.toLowerCase().includes('(contoh') ||
              name.toLowerCase().includes('hapus baris ini')
            ) {
              continue;
            }

            const nis = String(row['NIS'] || row['nis'] || row['No Induk'] || '').trim();
            const nisn = String(row['NISN'] || row['nisn'] || '').trim();
            const genderRaw = String(
              row['Jenis Kelamin (L/P)'] ||
                row['Jenis Kelamin'] ||
                row['JK'] ||
                row['gender'] ||
                row['jk'] ||
                row['L/P'] ||
                'L'
            ).trim().toUpperCase();
            const gender: 'L' | 'P' =
              genderRaw.startsWith('P') || genderRaw === 'PEREMPUAN' || genderRaw === 'WANITA' ? 'P' : 'L';

            // Match class from row or fallback to default class
            let classId = defaultClassId;
            let className = defaultClassName || '';

            const rowClass = String(
              row['Kelas'] || row['className'] || row['ID Kelas'] || row['classId'] || row['Rombel'] || ''
            ).trim();

            if (rowClass && availableClasses && availableClasses.length > 0) {
              const matched = availableClasses.find(
                (c) =>
                  c.classId.toLowerCase() === rowClass.toLowerCase() ||
                  c.name.toLowerCase() === rowClass.toLowerCase() ||
                  c.name.toLowerCase().replace(/\s+/g, '') === rowClass.toLowerCase().replace(/\s+/g, '')
              );
              if (matched) {
                classId = matched.classId;
                className = matched.name;
              }
            }

            const statusRaw = String(row['Status'] || row['status'] || 'Aktif').trim().toLowerCase();
            const status: 'active' | 'inactive' =
              statusRaw.includes('non') || statusRaw.includes('tidak') || statusRaw.includes('inact')
                ? 'inactive'
                : 'active';

            const cleanNis = nis || `${24000 + i + Math.floor(Math.random() * 500)}`;
            const studentId = `SISWA-${cleanNis}-${Date.now().toString().slice(-4)}-${i}`;

            await setDoc(doc(db, 'students', studentId), {
              studentId,
              id: studentId,
              nis: cleanNis,
              nisn: nisn || '',
              name,
              nama: name,
              gender,
              classId,
              className,
              kelas: className,
              status,
              qrCode: cleanNis || studentId,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            }, { merge: true });
            count++;
          }

          memoryCache.invalidate('students');
          memoryCache.clear();

          resolve({ success: count, errors });
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = (err) => reject(err);
      reader.readAsArrayBuffer(file);
    });
  },

  exportToExcel(students: Student[], fileName = 'Data_Siswa', defaultClassName = 'Kelas 1A'): void {
    if (!students || students.length === 0) {
      // If there are no students to export, automatically download the ready-to-fill template
      this.downloadTemplate(defaultClassName);
      return;
    }

    const exportData = students.map((s, index) => ({
      No: index + 1,
      'NIS': s.nis || '',
      'NISN': s.nisn || '',
      'Nama Siswa': s.name || s.nama || '',
      'Jenis Kelamin (L/P)': (s.gender || 'L').toUpperCase().startsWith('P') ? 'P' : 'L',
      'Kelas': s.className || s.kelas || s.classId || defaultClassName,
      'Status': s.status === 'inactive' ? 'Non-Aktif' : 'Aktif',
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const colWidths = [
      { wch: 6 },
      { wch: 14 },
      { wch: 16 },
      { wch: 36 },
      { wch: 22 },
      { wch: 16 },
      { wch: 14 },
    ];
    ws['!cols'] = colWidths;

    const guideData = [
      { 'Format Template Import Siswa': 'File ini berformat template resmi. Anda dapat mengedit data siswa di sheet "Data_Siswa" lalu mengimpornya kembali ke sistem.' },
      { 'Format Template Import Siswa': 'Kolom yang didukung: No, NIS, NISN, Nama Siswa, Jenis Kelamin (L/P), Kelas, Status.' },
    ];
    const wsGuide = XLSX.utils.json_to_sheet(guideData);
    wsGuide['!cols'] = [{ wch: 90 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Data_Siswa');
    XLSX.utils.book_append_sheet(wb, wsGuide, 'Petunjuk');
    XLSX.writeFile(wb, `${fileName}_${new Date().toISOString().slice(0, 10)}.xlsx`);
  },
};
