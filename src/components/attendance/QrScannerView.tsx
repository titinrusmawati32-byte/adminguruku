import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import {
  AlertCircle,
  AlertTriangle,
  Camera,
  CheckCircle2,
  Clock,
  ExternalLink,
  Flashlight,
  GraduationCap,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  QrCode,
  RefreshCw,
  Scan,
  Sparkles,
  SwitchCamera,
  Table,
  User,
  Volume2,
  VolumeX,
  Zap,
} from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { AttendanceRecord, Student } from '../../types';

interface QrScannerViewProps {
  students: Student[];
  allStudents?: Student[];
  existingRecords: AttendanceRecord[];
  selectedClassId: string;
  selectedClassName?: string;
  selectedScheduleId?: string;
  selectedSubjectName?: string;
  selectedDate: string;
  onRecordSuccess: (student: Student, scanTime: string) => Promise<{ isDuplicate?: boolean; status?: string } | void>;
  onDuplicateWarning?: (student: Student, existingRecord: AttendanceRecord) => void;
  onSwitchToTable?: () => void;
}

type ScanStatus =
  | 'idle'
  | 'checking'
  | 'scanning'
  | 'qr_detected'
  | 'validating'
  | 'saving'
  | 'success'
  | 'duplicate'
  | 'class_mismatch'
  | 'not_found'
  | 'error';

export const QrScannerView: React.FC<QrScannerViewProps> = ({
  students,
  allStudents = [],
  existingRecords,
  selectedClassId,
  selectedClassName,
  selectedScheduleId,
  selectedSubjectName,
  selectedDate,
  onRecordSuccess,
  onDuplicateWarning,
  onSwitchToTable,
}) => {
  // Permission & Hardware states
  const [permissionState, setPermissionState] = useState<
    'idle_ready' | 'checking' | 'granted' | 'denied' | 'not_found'
  >('idle_ready');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [cameraDevices, setCameraDevices] = useState<Array<{ id: string; label: string }>>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [torchOn, setTorchOn] = useState<boolean>(false);
  const [torchSupported, setTorchSupported] = useState<boolean>(false);
  const [isInIframe, setIsInIframe] = useState<boolean>(false);
  const [fitMode, setFitMode] = useState<'cover' | 'contain'>('cover');

  // Status & Transaction states
  const [scanStatus, setScanStatus] = useState<ScanStatus>('idle');
  const [activeStudent, setActiveStudent] = useState<Student | null>(null);
  const [lastScanTime, setLastScanTime] = useState<string>('');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [countdown, setCountdown] = useState<number>(0);

  // References to guarantee no concurrent / duplicate execution
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const isProcessingRef = useRef<boolean>(false);
  const countdownTimerRef = useRef<any>(null);
  const recentScansMapRef = useRef<Map<string, number>>(new Map());
  const activeStreamRef = useRef<MediaStream | null>(null);
  const containerId = 'qr-interactive-camera-box';

  // Check if app is inside an iframe on mount
  useEffect(() => {
    try {
      setIsInIframe(window.self !== window.top);
    } catch {
      setIsInIframe(true);
    }
  }, []);

  // Check if permission was already granted previously so we can seamlessly start
  useEffect(() => {
    let isMounted = true;
    const checkExistingPermission = async () => {
      if (typeof navigator !== 'undefined' && navigator.permissions && navigator.permissions.query) {
        try {
          const perm = await navigator.permissions.query({ name: 'camera' as any });
          if (perm.state === 'granted' && isMounted) {
            // Camera was already approved by user in this browser session!
            requestCameraAndStart('environment', false);
          }
        } catch {
          // navigator.permissions.query({ name: 'camera' }) not supported on some browsers
        }
      }
    };
    checkExistingPermission();
    return () => {
      isMounted = false;
    };
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
      }
      stopAllStreamsAndScanner();
    };
  }, []);

  // Play pleasant acoustic double-tone chime on successful scan
  const playBeep = () => {
    if (!soundEnabled || typeof window === 'undefined') return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();

      // Primary tone
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(880, ctx.currentTime); // A5
      gain1.gain.setValueAtTime(0.18, ctx.currentTime);
      gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start();
      osc1.stop(ctx.currentTime + 0.15);

      // Harmonious second tone
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(1174.66, ctx.currentTime + 0.08); // D6
      gain2.gain.setValueAtTime(0.16, ctx.currentTime + 0.08);
      gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.26);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(ctx.currentTime + 0.08);
      osc2.stop(ctx.currentTime + 0.26);
    } catch {}
  };

  // Play duplicate alert tone
  const playDuplicateBeep = () => {
    if (!soundEnabled || typeof window === 'undefined') return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.setValueAtTime(330, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.28);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.28);
    } catch {}
  };

  // Speak student confirmation voice in Indonesian (id-ID) using Web Speech API
  const speakVoice = (text: string) => {
    if (!soundEnabled || typeof window === 'undefined' || !window.speechSynthesis) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'id-ID';
      utterance.rate = 1.05;
      utterance.pitch = 1.0;

      const voices = window.speechSynthesis.getVoices();
      const idVoice = voices.find(
        (v) => v.lang.startsWith('id') || v.lang.toLowerCase().includes('indonesia')
      );
      if (idVoice) utterance.voice = idVoice;

      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn('Speech synthesis note:', e);
    }
  };

  // Stop all active streams and the scanner instance cleanly
  const stopAllStreamsAndScanner = async () => {
    try {
      if (activeStreamRef.current) {
        activeStreamRef.current.getTracks().forEach((track) => {
          track.stop();
        });
        activeStreamRef.current = null;
      }

      if (html5QrCodeRef.current) {
        if (html5QrCodeRef.current.isScanning) {
          await html5QrCodeRef.current.stop();
        }
        html5QrCodeRef.current.clear();
        html5QrCodeRef.current = null;
      }
    } catch (e) {
      console.warn('Cleanup scanner notice:', e);
    } finally {
      setIsScanning(false);
      setIsPaused(false);
      setTorchOn(false);
      isProcessingRef.current = false;
    }
  };

  // Request Camera Permission and start optical QR scanner with dual fallback
  const requestCameraAndStart = async (
    preferredFacing: 'environment' | 'user' = 'environment',
    isUserGesture = true
  ) => {
    setPermissionState('checking');
    setScanStatus('checking');
    setErrorMessage('');

    try {
      // 1. Verify Browser Support
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setPermissionState('not_found');
        setScanStatus('error');
        setErrorMessage(
          'Peramban ini tidak mendukung API kamera web (navigator.mediaDevices.getUserMedia).'
        );
        return;
      }

      // Check HTTPS or Localhost
      const isSecure =
        window.location.protocol === 'https:' ||
        window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1';
      if (!isSecure) {
        setPermissionState('denied');
        setScanStatus('error');
        setErrorMessage(
          'Akses kamera memerlukan koneksi aman (HTTPS). Pastikan URL menggunakan https://'
        );
        return;
      }

      // Clean up any stale streams before opening new one
      await stopAllStreamsAndScanner();

      // 2. Enumerate available video inputs
      let cameras: Array<{ id: string; label: string }> = [];
      try {
        const detected = await Html5Qrcode.getCameras();
        if (detected && detected.length > 0) {
          cameras = detected.map((c) => ({
            id: c.id,
            label: c.label || `Kamera ${c.id.slice(0, 5)}`,
          }));
          setCameraDevices(cameras);
        }
      } catch (enumErr) {
        console.warn('Enum cameras notice:', enumErr);
      }

      // 3. Choose camera target
      let targetCamId = '';
      if (cameras.length > 0) {
        if (preferredFacing === 'environment') {
          const backCam = cameras.find(
            (c) =>
              c.label.toLowerCase().includes('back') ||
              c.label.toLowerCase().includes('belakang') ||
              c.label.toLowerCase().includes('environment') ||
              c.label.toLowerCase().includes('rear')
          );
          targetCamId = backCam ? backCam.id : cameras[0].id;
        } else {
          const frontCam = cameras.find(
            (c) =>
              c.label.toLowerCase().includes('front') ||
              c.label.toLowerCase().includes('depan') ||
              c.label.toLowerCase().includes('user')
          );
          targetCamId = frontCam ? frontCam.id : cameras[0].id;
        }
        setSelectedCameraId(targetCamId);
      }

      setPermissionState('granted');

      // 4. Start the interactive scanner inside the DOM container
      await startScannerInstance(targetCamId, preferredFacing);
    } catch (err: any) {
      console.warn('Camera request error:', err);
      const name = err?.name || '';
      const message = err?.message || String(err);

      let friendlyMsg = message;
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError' || message.includes('denied')) {
        friendlyMsg =
          'Izin akses kamera belum diaktifkan di browser. Silakan izinkan akses kamera pada setelan peramban Anda.';
        setPermissionState('denied');
      } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError' || message.includes('not found')) {
        friendlyMsg = 'Perangkat kamera / webcam tidak terdeteksi pada perangkat ini.';
        setPermissionState('not_found');
      } else if (name === 'NotReadableError' || name === 'TrackStartError' || message.includes('in use')) {
        friendlyMsg =
          'Kamera sedang digunakan oleh aplikasi lain (Zoom/Meet/Kamera). Harap tutup aplikasi tersebut dan coba lagi.';
        setPermissionState('denied');
      } else {
        setPermissionState('denied');
      }

      setErrorMessage(friendlyMsg);
      setScanStatus('error');
    }
  };

  // Launch Html5Qrcode inside #qr-interactive-camera-box
  const startScannerInstance = async (
    cameraIdToUse?: string,
    fallbackFacing: 'environment' | 'user' = 'environment'
  ) => {
    const containerEl = document.getElementById(containerId);
    if (!containerEl) {
      setTimeout(() => startScannerInstance(cameraIdToUse, fallbackFacing), 80);
      return;
    }

    try {
      const qrCodeInstance = new Html5Qrcode(containerId, {
        formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
        verbose: false,
        experimentalFeatures: {
          useBarCodeDetectorIfSupported: true, // Uses fast native BarcodeDetector if available
        },
      });
      html5QrCodeRef.current = qrCodeInstance;

      // Generous responsive scanning window (70-75% of view)
      const scanConfig = {
        fps: 22, // Smooth, responsive scanning without freezing UI
        qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
          const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
          const boxSize = Math.floor(minEdge * 0.72);
          return { width: boxSize, height: boxSize };
        },
        aspectRatio: undefined, // Let CSS govern container bounds seamlessly
      };

      const targetSource = cameraIdToUse || { facingMode: { ideal: fallbackFacing } };

      try {
        await qrCodeInstance.start(targetSource, scanConfig, handleDecodedText, () => {});
      } catch (firstErr: any) {
        console.warn('Primary camera stream attempt failed, attempting safe fallback:', firstErr);
        const fallbackSource =
          fallbackFacing === 'environment'
            ? { facingMode: { ideal: 'user' } }
            : { facingMode: { ideal: 'environment' } };

        await qrCodeInstance.start(fallbackSource, scanConfig, handleDecodedText, () => {});
      }

      setIsScanning(true);
      setIsPaused(false);
      setScanStatus('scanning');
      setStatusMessage('Kamera aktif, arahkan kartu QR siswa ke dalam bingkai');

      // Check torch support
      try {
        const capabilities = (qrCodeInstance as any).getRunningTrackCapabilities?.();
        if (capabilities?.torch) {
          setTorchSupported(true);
        }
      } catch {}
    } catch (startError: any) {
      console.warn('Unable to initiate video stream:', startError);
      setIsScanning(false);
      setPermissionState('denied');
      setErrorMessage(startError?.message || 'Gagal memulai streaming video kamera.');
      setScanStatus('error');
    }
  };

  // Switch between available camera devices
  const handleSwitchCamera = async () => {
    if (cameraDevices.length <= 1) {
      // Toggle facing mode
      const nextFacing = selectedCameraId ? 'user' : 'environment';
      await requestCameraAndStart(nextFacing);
      return;
    }

    const currentIndex = cameraDevices.findIndex((c) => c.id === selectedCameraId);
    const nextIndex = (currentIndex + 1) % cameraDevices.length;
    const nextCamera = cameraDevices[nextIndex];
    setSelectedCameraId(nextCamera.id);

    await stopAllStreamsAndScanner();
    setPermissionState('granted');
    setTimeout(() => {
      startScannerInstance(nextCamera.id);
    }, 100);
  };

  // Toggle Torch / Flashlight (if device supports)
  const handleToggleTorch = async () => {
    if (!html5QrCodeRef.current || !isScanning) return;
    try {
      const nextTorch = !torchOn;
      await (html5QrCodeRef.current as any).applyVideoConstraints({
        advanced: [{ torch: nextTorch }],
      });
      setTorchOn(nextTorch);
    } catch (e) {
      console.warn('Torch constraint error:', e);
    }
  };

  // Pause / Resume Scanning
  const handleTogglePause = () => {
    if (!html5QrCodeRef.current) return;
    if (isPaused) {
      try {
        html5QrCodeRef.current.resume();
        setIsPaused(false);
        setScanStatus('scanning');
        setStatusMessage('Kamera aktif, siap memindai');
      } catch {}
    } else {
      try {
        html5QrCodeRef.current.pause();
        setIsPaused(true);
        setStatusMessage('Pemindaian dijeda oleh guru');
      } catch {}
    }
  };

  // Parse Student Identifier from QR Payload safely
  const parseStudentIdentifier = (raw: string): string => {
    const clean = raw.trim();
    if (clean.startsWith('{') && clean.endsWith('}')) {
      try {
        const parsed = JSON.parse(clean);
        if (parsed.studentId) return String(parsed.studentId).trim();
        if (parsed.id) return String(parsed.id).trim();
        if (parsed.nis) return String(parsed.nis).trim();
      } catch {}
    }
    return clean;
  };

  // Continuous Scan Handler with atomic lock and cooldown
  const handleDecodedText = async (decodedText: string) => {
    // 1. Check scan lock
    if (isProcessingRef.current) return;

    const identifier = parseStudentIdentifier(decodedText);
    if (!identifier) return;

    // 2. Cooldown check: prevent immediate re-trigger of the same QR code within 4 seconds
    const now = Date.now();
    const lastScanTimestamp = recentScansMapRef.current.get(identifier.toLowerCase()) || 0;
    if (now - lastScanTimestamp < 4000) {
      return;
    }

    // 3. Acquire scan lock
    isProcessingRef.current = true;
    setScanStatus('qr_detected');
    setStatusMessage('QR terdeteksi, memvalidasi identitas...');

    const currentTime = new Date().toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    setLastScanTime(currentTime);

    // 4. Validate Student
    setScanStatus('validating');

    // Search in current class roster first
    let matched = students.find(
      (s) =>
        s.studentId.toLowerCase() === identifier.toLowerCase() ||
        (s.qrCode && s.qrCode.toLowerCase() === identifier.toLowerCase()) ||
        s.nis === identifier
    );

    // If not found in current class, check if student exists in allStudents
    let otherClassStudent: Student | undefined;
    if (!matched && allStudents.length > 0) {
      otherClassStudent = allStudents.find(
        (s) =>
          s.studentId.toLowerCase() === identifier.toLowerCase() ||
          (s.qrCode && s.qrCode.toLowerCase() === identifier.toLowerCase()) ||
          s.nis === identifier
      );
    }

    // Case: Unregistered Student
    if (!matched && !otherClassStudent) {
      setScanStatus('not_found');
      setStatusMessage(`QR Siswa tidak dikenali. Kode "${identifier}" tidak terdaftar di sistem.`);
      speakVoice('QR Siswa tidak dikenali');
      triggerResumeCountdown(2.6);
      return;
    }

    // Case: Class / Rombel Mismatch
    if (!matched && otherClassStudent) {
      setActiveStudent(otherClassStudent);
      setScanStatus('class_mismatch');
      setStatusMessage(
        `${otherClassStudent.name} terdaftar di rombel ${
          otherClassStudent.className || otherClassStudent.classId
        }, bukan di rombel ${selectedClassName || selectedClassId}.`
      );
      speakVoice(
        `Perhatian, siswa dari rombel ${otherClassStudent.className || otherClassStudent.classId}`
      );
      triggerResumeCountdown(3.2);
      return;
    }

    if (!matched) {
      triggerResumeCountdown(2.0);
      return;
    }

    setActiveStudent(matched);

    // Case: Duplicate Check (Already recorded for this date/session)
    const alreadyAttended = existingRecords.find((rec) => rec.studentId === matched!.studentId);
    if (alreadyAttended) {
      recentScansMapRef.current.set(identifier.toLowerCase(), now);
      playDuplicateBeep();
      setScanStatus('duplicate');
      const timeStr = alreadyAttended.createdAt
        ? new Date(alreadyAttended.createdAt).toLocaleTimeString('id-ID')
        : 'hari ini';
      setStatusMessage(
        `${matched.name} sudah melakukan presensi pada jam ${timeStr} (Status: ${alreadyAttended.status}).`
      );
      speakVoice(`Siswa sudah presensi, ${matched.name}`);
      if (onDuplicateWarning) {
        onDuplicateWarning(matched, alreadyAttended);
      }
      triggerResumeCountdown(2.8);
      return;
    }

    // Case: Save Attendance to Firestore atomically
    setScanStatus('saving');
    setStatusMessage(`Menyimpan presensi untuk ${matched.name}...`);

    try {
      const result = await onRecordSuccess(matched, currentTime);

      // Check if backend transaction flagged duplicate
      if (result && result.isDuplicate) {
        recentScansMapRef.current.set(identifier.toLowerCase(), now);
        playDuplicateBeep();
        setScanStatus('duplicate');
        setStatusMessage(
          `${matched.name} sudah tercatat sebelumnya dengan status ${result.status || 'Hadir'}.`
        );
        speakVoice(`Siswa sudah presensi, ${matched.name}`);
        triggerResumeCountdown(2.6);
        return;
      }

      // Record successful scan in cooldown cache
      recentScansMapRef.current.set(identifier.toLowerCase(), now);

      // Acoustic and speech confirmation
      playBeep();
      setScanStatus('success');
      setStatusMessage('Presensi berhasil dicatat dan disinkronkan.');
      speakVoice(`Presensi berhasil, ${matched.name}`);

      // Auto countdown to unlock scanner for next student
      triggerResumeCountdown(2.0);
    } catch (saveErr: any) {
      console.warn('Error saving attendance:', saveErr);
      setScanStatus('error');
      setStatusMessage(
        `Koneksi bermasalah saat menyimpan: ${saveErr.message || 'Gagal menyimpan ke Firestore'}`
      );
      triggerResumeCountdown(3.0);
    }
  };

  // Automatic Countdown and Reactivation of Scanner
  const triggerResumeCountdown = (seconds: number) => {
    let remaining = seconds;
    setCountdown(Math.ceil(remaining));

    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
    }

    countdownTimerRef.current = setInterval(() => {
      remaining -= 0.5;
      setCountdown(Math.ceil(remaining));

      if (remaining <= 0) {
        clearInterval(countdownTimerRef.current);
        countdownTimerRef.current = null;
        resumeScanner();
      }
    }, 500);
  };

  // Resume Scanner Video Feed for next student
  const resumeScanner = () => {
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }

    isProcessingRef.current = false;
    setScanStatus('scanning');
    setActiveStudent(null);
    setStatusMessage('Kamera aktif, siap memindai');
    setCountdown(0);

    try {
      if (html5QrCodeRef.current && isScanning && isPaused) {
        html5QrCodeRef.current.resume();
        setIsPaused(false);
      }
    } catch (e) {
      console.warn('Resume notice:', e);
    }
  };

  return (
    <div className="bg-slate-900 rounded-3xl p-4 sm:p-5 lg:p-6 text-white shadow-xl shadow-slate-950/20 border border-slate-800 relative overflow-hidden flex flex-col w-full">
      {/* Background ambient lighting */}
      <div className="absolute -top-24 -left-24 w-80 h-80 bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -right-24 w-80 h-80 bg-purple-600/15 rounded-full blur-3xl pointer-events-none" />

      {/* Top Header Bar */}
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20 shrink-0">
            <Camera className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm sm:text-base font-extrabold tracking-tight text-white uppercase">
                PRESENSI QR KAMERA
              </h2>
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border transition-colors ${
                  permissionState === 'granted' && isScanning
                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                    : permissionState === 'checking'
                    ? 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                    : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    permissionState === 'granted' && isScanning
                      ? 'bg-emerald-400 animate-pulse'
                      : 'bg-amber-400'
                  }`}
                />
                {permissionState === 'granted' && isScanning
                  ? 'Kamera Aktif'
                  : permissionState === 'checking'
                  ? 'Menghubungkan...'
                  : 'Kamera Siap'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Pindai kartu QR / barcode siswa secara otomatis dan real-time
            </p>
          </div>
        </div>

        {/* Camera Control Toolbar */}
        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
          {/* Audio Speech Toggle */}
          <button
            type="button"
            onClick={() => setSoundEnabled(!soundEnabled)}
            title={soundEnabled ? 'Suara Presensi Aktif (Klik untuk Bisukan)' : 'Suara Presensi Senyap'}
            className={`p-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              soundEnabled
                ? 'bg-blue-600/20 border-blue-500/40 text-blue-400 hover:bg-blue-600/30'
                : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'
            }`}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            <span className="hidden sm:inline text-[11px]">
              {soundEnabled ? 'Suara ON' : 'Mute'}
            </span>
          </button>

          {/* Fit Mode Toggle (Cover vs Contain) */}
          {isScanning && (
            <button
              type="button"
              onClick={() => setFitMode(fitMode === 'cover' ? 'contain' : 'cover')}
              title={
                fitMode === 'cover'
                  ? 'Mode Layar Penuh (Cover) - Klik untuk Mode Proporsional (Contain)'
                  : 'Mode Proporsional (Contain) - Klik untuk Mode Penuh (Cover)'
              }
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs flex items-center gap-1.5 transition-all cursor-pointer"
            >
              {fitMode === 'cover' ? <Maximize2 className="w-4 h-4 text-cyan-400" /> : <Minimize2 className="w-4 h-4 text-cyan-400" />}
              <span className="hidden md:inline text-[11px]">
                {fitMode === 'cover' ? 'Penuh' : 'Utuh'}
              </span>
            </button>
          )}

          {/* Torch / Flashlight Toggle (if supported) */}
          {torchSupported && isScanning && (
            <button
              type="button"
              onClick={handleToggleTorch}
              title="Senter / Flash Kamera"
              className={`p-2 rounded-xl border text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                torchOn
                  ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                  : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <Flashlight className="w-4 h-4" />
              <span className="hidden sm:inline text-[11px]">Flash</span>
            </button>
          )}

          {/* Switch Camera (Front vs Back) */}
          {isScanning && (
            <button
              type="button"
              onClick={handleSwitchCamera}
              title="Ganti Kamera Depan / Belakang"
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <SwitchCamera className="w-4 h-4 text-cyan-400" />
              <span className="hidden sm:inline text-[11px]">Ganti Kamera</span>
            </button>
          )}

          {/* Pause / Resume */}
          {isScanning && (
            <button
              type="button"
              onClick={handleTogglePause}
              title={isPaused ? 'Lanjutkan Pemindaian' : 'Jeda Pemindaian'}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs flex items-center gap-1.5 transition-all cursor-pointer"
            >
              {isPaused ? <Play className="w-4 h-4 text-emerald-400" /> : <Pause className="w-4 h-4 text-amber-400" />}
              <span className="hidden sm:inline text-[11px]">
                {isPaused ? 'Resume' : 'Pause'}
              </span>
            </button>
          )}

          {/* Stop / Turn Off Camera */}
          {isScanning && (
            <button
              type="button"
              onClick={stopAllStreamsAndScanner}
              title="Tutup Kamera"
              className="p-2 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/50 text-rose-300 text-xs flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <span className="w-2.5 h-2.5 rounded-xs bg-rose-500" />
              <span className="hidden sm:inline text-[11px]">Stop</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Scanner Container Viewport - ENLARGED RESPONSIVE CAMERA AREA */}
      <div className="relative z-10 mt-4 flex-1 flex flex-col items-center justify-center w-full">
        {/* VIDEO BOX CONTAINER - Fills 100% width and 480-600px height on Desktop */}
        <div
          className={`w-full h-[400px] sm:h-[480px] md:h-[520px] lg:h-[550px] xl:h-[580px] relative rounded-3xl overflow-hidden border-2 border-slate-700/80 bg-black shadow-2xl shadow-black/80 flex items-center justify-center ${
            permissionState === 'granted' ? 'block' : 'hidden'
          }`}
        >
          {/* Target Element for Html5Qrcode video mounting */}
          <div
            id={containerId}
            className={`w-full h-full ${fitMode === 'contain' ? 'contain-mode' : ''}`}
          />

          {/* Custom Optical Overlay Framing (Corner Brackets, Laser & Reticle) */}
          <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
            {/* Target Scan Box */}
            <div className="relative w-64 h-64 sm:w-72 sm:h-72 md:w-80 md:h-80 lg:w-84 lg:h-84 flex items-center justify-center">
              {/* 4 Corner Glowing Cyan Brackets */}
              <div className="absolute top-0 left-0 w-9 h-9 border-t-4 border-l-4 border-cyan-400 rounded-tl-2xl shadow-sm shadow-cyan-400" />
              <div className="absolute top-0 right-0 w-9 h-9 border-t-4 border-r-4 border-cyan-400 rounded-tr-2xl shadow-sm shadow-cyan-400" />
              <div className="absolute bottom-0 left-0 w-9 h-9 border-b-4 border-l-4 border-cyan-400 rounded-bl-2xl shadow-sm shadow-cyan-400" />
              <div className="absolute bottom-0 right-0 w-9 h-9 border-b-4 border-r-4 border-cyan-400 rounded-br-2xl shadow-sm shadow-cyan-400" />

              {/* Animated Laser Scanning Line */}
              {scanStatus === 'scanning' && !isPaused && (
                <div className="absolute left-2 right-2 h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_14px_#22d3ee] animate-scan-laser pointer-events-none" />
              )}

              {/* Center Target Reticle */}
              <div className="w-16 h-16 rounded-full border border-cyan-500/20 flex items-center justify-center">
                <div className="w-2.5 h-2.5 rounded-full bg-cyan-400/80 animate-ping" />
              </div>
            </div>

            {/* Bottom Guidance Prompt Bar */}
            <div className="absolute bottom-4 px-4 py-1.5 rounded-full bg-slate-950/85 backdrop-blur-md border border-slate-700/80 text-slate-200 text-xs font-semibold flex items-center gap-2 shadow-xl">
              <QrCode className="w-4 h-4 text-cyan-400" />
              <span>Arahkan kartu QR siswa ke dalam bingkai pemindai</span>
            </div>
          </div>

          {/* PAUSED BANNER OVERLAY */}
          {isPaused && (
            <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-xs flex flex-col items-center justify-center p-6 text-center z-20">
              <Pause className="w-12 h-12 text-amber-400 mb-2 animate-pulse" />
              <h4 className="text-sm font-bold text-white">Pemindaian Kamera Dijeda</h4>
              <p className="text-xs text-slate-400 mt-1 mb-4">
                Kamera sementara dijeda oleh guru. Tekan lanjutkan untuk memindai kembali.
              </p>
              <button
                type="button"
                onClick={handleTogglePause}
                className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-2 cursor-pointer shadow-lg"
              >
                <Play className="w-4 h-4 fill-slate-950" />
                <span>Lanjutkan Pemindaian</span>
              </button>
            </div>
          )}

          {/* SCAN STATUS: DETECTED / VALIDATING / SAVING OVERLAY */}
          {(scanStatus === 'qr_detected' || scanStatus === 'validating' || scanStatus === 'saving') && (
            <div className="absolute inset-0 bg-slate-950/75 backdrop-blur-xs flex flex-col items-center justify-center p-6 text-center z-30 transition-all">
              <div className="w-14 h-14 rounded-2xl bg-blue-500/20 border-2 border-blue-400 flex items-center justify-center text-blue-300 mb-3 shadow-lg shadow-blue-500/30">
                <RefreshCw className="w-7 h-7 text-blue-400 animate-spin" />
              </div>
              <h4 className="text-base font-bold text-white uppercase tracking-tight">
                {scanStatus === 'qr_detected'
                  ? 'QR Terdeteksi'
                  : scanStatus === 'validating'
                  ? 'Memvalidasi Siswa'
                  : 'Menyimpan Presensi'}
              </h4>
              <p className="text-xs text-blue-200 mt-1 max-w-xs">{statusMessage}</p>
            </div>
          )}

          {/* SUCCESS SCAN OVERLAY */}
          {scanStatus === 'success' && activeStudent && (
            <div className="absolute inset-0 bg-emerald-950/92 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center z-30 transition-all duration-300">
              <div className="w-16 h-16 rounded-3xl bg-emerald-500/20 border-2 border-emerald-400 flex items-center justify-center text-emerald-300 shadow-xl shadow-emerald-500/40 mb-3 animate-bounce">
                <CheckCircle2 className="w-9 h-9 text-emerald-400" />
              </div>

              <span className="px-3.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[11px] font-black tracking-wider uppercase mb-1">
                ✓ PRESENSI BERHASIL DICATAT
              </span>

              <h3 className="text-xl sm:text-2xl font-black text-white mt-1 uppercase tracking-tight">
                {activeStudent.name}
              </h3>

              <p className="text-xs sm:text-sm text-emerald-200/90 mt-0.5 font-semibold">
                {activeStudent.className || selectedClassName || 'Kelas Siswa'} • NIS: {activeStudent.nis}
              </p>

              <div className="mt-4 flex items-center gap-3 bg-black/50 px-4 py-2 rounded-2xl border border-emerald-500/40 shadow-inner">
                <div className="flex items-center gap-1.5 text-xs text-emerald-300 font-bold">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span>Status: Hadir</span>
                </div>
                <div className="w-px h-3.5 bg-emerald-700/60" />
                <div className="flex items-center gap-1 text-xs text-slate-300 font-mono">
                  <Clock className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{lastScanTime}</span>
                </div>
              </div>

              {/* Automatic Next Scan Countdown Meter */}
              <div className="mt-5 w-full max-w-xs">
                <div className="flex items-center justify-between text-[11px] text-emerald-300/80 mb-1 font-semibold">
                  <span>Siap memindai siswa berikutnya...</span>
                  <span className="font-mono">{countdown}s</span>
                </div>
                <div className="w-full h-1.5 bg-emerald-950 rounded-full overflow-hidden border border-emerald-800">
                  <div
                    className="h-full bg-emerald-400 rounded-full transition-all duration-300"
                    style={{ width: `${(countdown / 2) * 100}%` }}
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={resumeScanner}
                className="mt-4 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-lg transition-transform active:scale-95 cursor-pointer"
              >
                <span>Pindai Siswa Berikutnya Sekarang ➔</span>
              </button>
            </div>
          )}

          {/* DUPLICATE WARNING OVERLAY */}
          {scanStatus === 'duplicate' && activeStudent && (
            <div className="absolute inset-0 bg-amber-950/92 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center z-30 transition-all">
              <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border-2 border-amber-400 flex items-center justify-center text-amber-300 mb-3 shadow-lg shadow-amber-500/30">
                <AlertTriangle className="w-8 h-8 text-amber-400" />
              </div>

              <span className="px-3.5 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-black uppercase tracking-wider">
                SUDAH MELAKUKAN PRESENSI
              </span>

              <h4 className="text-lg font-bold text-white mt-2 uppercase">
                {activeStudent.name}
              </h4>
              <p className="text-xs text-amber-200 mt-1 max-w-sm leading-relaxed font-medium">
                {statusMessage}
              </p>

              <div className="mt-4 text-[11px] text-amber-300 font-medium">
                Scanner otomatis aktif kembali dalam {countdown} detik...
              </div>

              <button
                type="button"
                onClick={resumeScanner}
                className="mt-3 px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold cursor-pointer transition-all active:scale-95"
              >
                Lanjut Siswa Berikutnya ({countdown}s)
              </button>
            </div>
          )}

          {/* CLASS MISMATCH OVERLAY */}
          {scanStatus === 'class_mismatch' && activeStudent && (
            <div className="absolute inset-0 bg-purple-950/92 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center z-30 transition-all">
              <div className="w-14 h-14 rounded-2xl bg-purple-500/20 border-2 border-purple-400 flex items-center justify-center text-purple-300 mb-3 shadow-lg shadow-purple-500/30">
                <GraduationCap className="w-8 h-8 text-purple-400" />
              </div>

              <span className="px-3.5 py-1 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[10px] font-black uppercase tracking-wider">
                BEDA KELAS / ROMBEL
              </span>

              <h4 className="text-lg font-bold text-white mt-2 uppercase">
                {activeStudent.name}
              </h4>
              <p className="text-xs text-purple-200 mt-1 max-w-sm leading-relaxed font-medium">
                {statusMessage}
              </p>

              <div className="mt-4 flex items-center gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await onRecordSuccess(activeStudent, lastScanTime);
                      setScanStatus('success');
                      triggerResumeCountdown(2);
                    } catch {
                      resumeScanner();
                    }
                  }}
                  className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold cursor-pointer transition-all"
                >
                  Tetap Catat Hadir
                </button>
                <button
                  type="button"
                  onClick={resumeScanner}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
                >
                  Lewati Siswa Ini
                </button>
              </div>
            </div>
          )}

          {/* QR NOT RECOGNIZED OVERLAY */}
          {scanStatus === 'not_found' && (
            <div className="absolute inset-0 bg-rose-950/92 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center z-30 transition-all">
              <div className="w-14 h-14 rounded-2xl bg-rose-500/20 border-2 border-rose-400 flex items-center justify-center text-rose-300 mb-3 shadow-lg shadow-rose-500/30">
                <AlertCircle className="w-8 h-8 text-rose-400" />
              </div>

              <span className="px-3.5 py-1 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[10px] font-black uppercase tracking-wider">
                QR SISWA TIDAK DIKENALI
              </span>

              <p className="text-xs text-rose-200 mt-2 max-w-sm leading-relaxed">
                {statusMessage}
              </p>

              <button
                type="button"
                onClick={resumeScanner}
                className="mt-4 px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold cursor-pointer"
              >
                Coba Scan Lagi ({countdown}s)
              </button>
            </div>
          )}
        </div>

        {/* STATE 1: READY / PROMPT TO ACTIVATE CAMERA (Clean User Activation Step) */}
        {permissionState === 'idle_ready' && (
          <div className="w-full py-10 px-6 sm:px-8 rounded-3xl bg-slate-800/60 border border-slate-700/60 text-center flex flex-col items-center justify-center min-h-[400px]">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-blue-600 to-indigo-600 border-2 border-blue-400/30 flex items-center justify-center text-white mb-4 shadow-xl shadow-blue-600/30">
              <Camera className="w-10 h-10 animate-pulse" />
            </div>

            <h3 className="text-lg sm:text-xl font-extrabold text-white mb-1 tracking-tight uppercase">
              STUDIO PRESENSI QR KAMERA
            </h3>
            <p className="text-xs text-slate-300 mb-2 font-medium">
              Rombel: <strong className="text-white">{selectedClassName || selectedClassId || 'Pilih Rombel'}</strong>
              {selectedSubjectName && <span> • {selectedSubjectName}</span>}
              <span className="text-slate-400 block sm:inline sm:ml-2">({students.length} Siswa Terdaftar)</span>
            </p>
            <p className="text-xs text-slate-400 mb-6 leading-relaxed max-w-md">
              Tekan tombol di bawah untuk mengaktifkan kamera browser. Siswa cukup berdiri di depan kamera membawa kartu barcode / QR untuk presensi instan.
            </p>

            <div className="flex flex-col sm:flex-row items-center gap-3 w-full justify-center max-w-md">
              <button
                type="button"
                onClick={() => requestCameraAndStart('environment', true)}
                className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-extrabold text-sm shadow-xl shadow-blue-600/40 flex items-center justify-center gap-3 transition-all transform hover:scale-[1.02] active:scale-98 cursor-pointer"
              >
                <Camera className="w-5 h-5" />
                <span>AKTIFKAN KAMERA & MULAI</span>
              </button>

              <button
                type="button"
                onClick={() => requestCameraAndStart('user', true)}
                className="w-full sm:w-auto px-5 py-3.5 rounded-2xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 font-semibold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
                title="Buka langsung menggunakan webcam depan/laptop"
              >
                <SwitchCamera className="w-4 h-4 text-cyan-400" />
                <span>Kamera Depan / Laptop</span>
              </button>
            </div>
          </div>
        )}

        {/* STATE 2: CHECKING PERMISSIONS */}
        {permissionState === 'checking' && (
          <div className="w-full py-16 px-6 rounded-3xl bg-slate-800/40 border border-slate-700/40 text-center flex flex-col items-center justify-center min-h-[400px]">
            <div className="w-12 h-12 border-3 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mb-4" />
            <h4 className="text-base font-bold text-white">Menghubungkan Perangkat Kamera...</h4>
            <p className="text-xs text-slate-400 mt-1 max-w-sm leading-relaxed">
              Silakan klik <strong>&quot;Izinkan&quot; (Allow)</strong> jika muncul jendela konfirmasi akses kamera di bilah alamat browser Anda.
            </p>
          </div>
        )}

        {/* STATE 3: PERMISSION DENIED (Comprehensive Recovery UI) */}
        {permissionState === 'denied' && (
          <div className="w-full p-6 sm:p-8 rounded-3xl bg-slate-800/95 border border-slate-700 text-center flex flex-col items-center shadow-2xl min-h-[400px]">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-3 shrink-0">
              <AlertCircle className="w-7 h-7" />
            </div>

            <h3 className="text-base sm:text-lg font-bold text-white mb-1">
              Akses Kamera Dibatasi atau Belum Diizinkan
            </h3>

            {errorMessage && (
              <div className="mb-3 px-3 py-1.5 rounded-lg bg-black/40 border border-slate-700/70 text-[11px] text-amber-300 font-mono max-w-md break-all">
                {errorMessage}
              </div>
            )}

            {/* IFRAME HELPER: If app is inside preview iframe, browser policies block webcam */}
            {isInIframe && (
              <div className="w-full max-w-lg bg-blue-950/40 border border-blue-500/30 rounded-2xl p-4 mb-4 text-left">
                <div className="flex items-start gap-3">
                  <ExternalLink className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-bold text-blue-300">
                      Membuka di Dalam Panel Pratinjau (iFrame)?
                    </h4>
                    <p className="text-[11px] text-slate-300 mt-0.5 leading-relaxed">
                      Kebijakan keamanan peramban (Chrome/Edge) dapat memblokir kamera saat berjalan di dalam panel pratinjau. Anda dapat membuka aplikasi di tab baru agar kamera dapat langsung aktif tanpa batasan:
                    </p>
                    <a
                      href={typeof window !== 'undefined' ? window.location.href : '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 mt-2.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md shadow-blue-600/30 transition-all cursor-pointer"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Buka WebApp di Tab Baru (Layar Penuh) ↗</span>
                    </a>
                  </div>
                </div>
              </div>
            )}

            {/* Instruction Steps */}
            <div className="w-full max-w-lg bg-slate-900/90 rounded-2xl p-4 text-left border border-slate-700/80 mb-5 space-y-2.5">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                Langkah Mengaktifkan Izin Kamera:
              </div>
              <div className="flex items-start gap-2.5 text-xs text-slate-300">
                <span className="w-5 h-5 rounded-full bg-blue-600/30 text-blue-400 font-bold flex items-center justify-center shrink-0 text-[10px]">
                  1
                </span>
                <span>
                  Klik ikon <strong>Gembok 🔒</strong> atau <strong>Setelan Situs / Ikon Kamera</strong> di sebelah kiri bilah alamat (URL bar) browser.
                </span>
              </div>
              <div className="flex items-start gap-2.5 text-xs text-slate-300">
                <span className="w-5 h-5 rounded-full bg-blue-600/30 text-blue-400 font-bold flex items-center justify-center shrink-0 text-[10px]">
                  2
                </span>
                <span>
                  Ubah izin <strong>Kamera</strong> dari <em>Blokir / Tanyakan</em> menjadi <strong>Izinkan (Allow)</strong>.
                </span>
              </div>
              <div className="flex items-start gap-2.5 text-xs text-slate-300">
                <span className="w-5 h-5 rounded-full bg-blue-600/30 text-blue-400 font-bold flex items-center justify-center shrink-0 text-[10px]">
                  3
                </span>
                <span>
                  Klik tombol <strong>Coba Lagi</strong> di bawah untuk membuka kamera.
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center justify-center gap-2.5 w-full">
              <button
                type="button"
                onClick={() => requestCameraAndStart('environment', true)}
                className="px-5 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg shadow-blue-600/30 flex items-center gap-2 transition-all transform active:scale-95 cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Coba Lagi Kamera Belakang</span>
              </button>

              <button
                type="button"
                onClick={() => requestCameraAndStart('user', true)}
                className="px-5 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/30 flex items-center gap-2 transition-all transform active:scale-95 cursor-pointer"
              >
                <Camera className="w-4 h-4" />
                <span>Coba Kamera Depan / Laptop</span>
              </button>

              {onSwitchToTable && (
                <button
                  type="button"
                  onClick={onSwitchToTable}
                  className="px-4 py-2.5 rounded-2xl bg-slate-700 hover:bg-slate-600 text-slate-200 font-semibold text-xs flex items-center gap-2 transition-all cursor-pointer"
                >
                  <Table className="w-4 h-4 text-emerald-400" />
                  <span>Buka Tabel Presensi Kelas</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* STATE 4: CAMERA NOT FOUND */}
        {permissionState === 'not_found' && (
          <div className="w-full max-w-lg p-6 sm:p-8 rounded-3xl bg-slate-800/90 border border-slate-700 text-center flex flex-col items-center min-h-[400px] justify-center">
            <div className="w-14 h-14 rounded-2xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400 mb-3">
              <Camera className="w-7 h-7" />
            </div>
            <h3 className="text-base sm:text-lg font-bold text-white mb-1">
              Perangkat Kamera Tidak Ditemukan
            </h3>
            <p className="text-xs text-slate-300 mb-4 max-w-sm leading-relaxed">
              Tidak ada webcam atau lensa kamera yang terdeteksi aktif pada perangkat ini. Pastikan kamera terpasang dan driver kamera aktif.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => requestCameraAndStart('user', true)}
                className="px-5 py-2.5 rounded-2xl bg-slate-700 hover:bg-slate-600 text-slate-200 font-bold text-xs flex items-center gap-2 transition-all cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Deteksi Ulang Kamera</span>
              </button>

              {onSwitchToTable && (
                <button
                  type="button"
                  onClick={onSwitchToTable}
                  className="px-4 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-2 transition-all cursor-pointer"
                >
                  <Table className="w-4 h-4" />
                  <span>Gunakan Tabel Presensi</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Footer Info Strip */}
      <div className="relative z-10 mt-4 pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between text-[11px] text-slate-400 gap-2">
        <div className="flex items-center gap-2">
          <Zap className="w-3.5 h-3.5 text-cyan-400" />
          <span>Pemindaian optik QR kontinu dengan validasi instan & BarcodeDetector</span>
        </div>
        <div className="flex items-center gap-3">
          <span>
            Kamera:{' '}
            <strong className="text-slate-200">
              {permissionState === 'granted' && isScanning
                ? cameraDevices.find((c) => c.id === selectedCameraId)?.label || 'Aktif'
                : 'Belum Aktif'}
            </strong>
          </span>
          <span className="text-slate-600">•</span>
          <span>
            Rombel:{' '}
            <strong className="text-slate-200">
              {selectedClassName || selectedClassId || 'Pilih Rombel'}
            </strong>
          </span>
        </div>
      </div>
    </div>
  );
};
