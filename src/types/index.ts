export type UserRole = 'admin' | 'guru';

export interface UserProfile {
  uid: string;
  username: string;
  displayName: string;
  role: UserRole;
  password?: string;
  teacherId?: string;
  nip?: string;
  phone?: string;
  email?: string;
  assignedClasses?: string[];
  assignedSubjects?: string[];
  isHomeroom?: boolean;
  homeroomClass?: string;
  status: 'active' | 'inactive';
  createdAt?: string;
  updatedAt?: string;
}

export interface Student {
  studentId: string;
  nis: string;
  nisn: string;
  name: string;
  gender: 'L' | 'P';
  classId: string;
  className?: string;
  status: 'active' | 'inactive';
  qrCode?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface SchoolClass {
  classId: string;
  name: string;
  grade: string;
  academicYear: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Subject {
  subjectId: string;
  code: string;
  name: string;
  group: string; // e.g. "Kelompok A (Wajib)", "Kelompok B (Umum)", "Muatan Lokal"
  status: 'active' | 'inactive';
  createdAt?: string;
  updatedAt?: string;
}

export type DayOfWeek = 'Senin' | 'Selasa' | 'Rabu' | 'Kamis' | 'Jumat' | 'Sabtu';

export interface Schedule {
  scheduleId: string;
  teacherId: string;
  teacherName?: string;
  classId: string;
  className?: string;
  subjectId: string;
  subjectName?: string;
  day: DayOfWeek;
  startTime: string; // "07:30"
  endTime: string;   // "09:00"
  room: string;
  academicYear: string;
  semester: '1' | '2';
  status: 'active' | 'inactive';
  createdAt?: string;
  updatedAt?: string;
}

export type AttendanceStatus = 'Hadir' | 'Sakit' | 'Izin' | 'Alpa';

export interface AttendanceRecord {
  attendanceId: string;
  scheduleId?: string;
  classId: string;
  className?: string;
  subjectId?: string;
  subjectName?: string;
  teacherId: string;
  date: string; // YYYY-MM-DD
  studentId: string;
  studentName?: string;
  nis?: string;
  status: AttendanceStatus;
  notes?: string;
  method: 'manual' | 'qr';
  createdAt?: string;
  updatedAt?: string;
}

export type AssessmentType = 'tugas' | 'formatif' | 'sumatif';

export interface StudentScore {
  studentId: string;
  studentName?: string;
  nis?: string;
  score: number;
  notes?: string;
}

export interface Assessment {
  assessmentId: string;
  classId: string;
  className?: string;
  subjectId: string;
  subjectName?: string;
  teacherId: string;
  type: AssessmentType;
  title: string;
  date: string; // YYYY-MM-DD
  maxScore: number;
  scores: StudentScore[];
  createdAt?: string;
  updatedAt?: string;
}

export interface TeachingAgenda {
  agendaId: string;
  teacherId: string;
  teacherName?: string;
  scheduleId?: string;
  classId: string;
  className?: string;
  subjectId: string;
  subjectName?: string;
  date: string; // YYYY-MM-DD
  topic: string;
  learningObjective: string;
  activity: string;
  attendanceSummary?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type GuidanceCategory =
  | 'Akademik'
  | 'Kehadiran'
  | 'Perilaku'
  | 'Sosial'
  | 'Prestasi'
  | 'Lainnya';

export type GuidanceStatus = 'open' | 'in_progress' | 'resolved';

export interface Guidance {
  guidanceId: string;
  teacherId: string;
  teacherName?: string;
  studentId: string;
  studentName?: string;
  nis?: string;
  className?: string;
  date: string; // YYYY-MM-DD
  category: GuidanceCategory;
  problem: string;
  action: string;
  followUp: string;
  status: GuidanceStatus;
  createdAt?: string;
  updatedAt?: string;
}

export interface AuditLog {
  logId: string;
  userId: string;
  userName?: string;
  action: string;
  collection: string;
  documentId: string;
  timestamp: string;
  details?: string;
}

export interface AppNotification {
  notificationId: string;
  userId?: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning';
  read: boolean;
  createdAt: string;
}

export interface DatabaseBackup {
  backupId: string;
  timestamp: string;
  createdBy: string;
  totalRecords: number;
  data: {
    users?: UserProfile[];
    students?: Student[];
    classes?: SchoolClass[];
    subjects?: Subject[];
    schedules?: Schedule[];
    attendance?: AttendanceRecord[];
    assessments?: Assessment[];
    teaching_agendas?: TeachingAgenda[];
    guidance?: Guidance[];
  };
}

export interface BannerWallpaperConfig {
  tagText: string;
  sloganText: string;
  headlineMain: string;
  headlineAccent: string;
  subheadline: string;
  card1Title: string;
  card1Badge: string;
  card1Desc: string;
  card2Title: string;
  card2Badge: string;
  card2Desc: string;
  wallpaperTheme: 'default' | 'cyber_blue' | 'cosmic_purple' | 'emerald_modern';
  showPills: boolean;
  isVisible: boolean;
  customImageUrl?: string;
  updatedAt?: string;
}
