import jsQR from 'jsqr';
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
  Sparkles,
  SwitchCamera,
  Table,
  Volume2,
  VolumeX,
} from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { soundService } from '../../services/soundService';
import { studentService } from '../../services/studentService';
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
  onRecordSuccess: (
    student: Student,
    scanTime: string
  ) => Promise<{ isDuplicate?: boolean; status?: string } | void>;
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
    'checking' | 'granted' | 'denied' | 'not_found'
  >('checking');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [cameraDevices, setCameraDevices] = useState<Array<{ id: string; label: string }>>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const [currentFacing, setCurrentFacing] = useState<'environment' | 'user'>('environment');
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(soundService.isSoundEnabled());
  const [torchOn, setTorchOn] = useState<boolean>(false);
  const [torchSupported, setTorchSupported] = useState<boolean>(false);
  const [isInIframe, setIsInIframe] = useState<boolean>(false);
  const [fitMode, setFitMode] = useState<'cover' | 'contain'>('cover');

  // Status & Transaction states
  const [scanStatus, setScanStatus] = useState<ScanStatus>('checking');
  const [activeStudent, setActiveStudent] = useState<Student | null>(null);
  const [lastScanTime, setLastScanTime] = useState<string>('');
  const [statusMessage, setStatusMessage] = useState<string>('Menyiapkan kamera...');
  const [countdown, setCountdown] = useState<number>(0);

  // References for ultra-responsive continuous scanning
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const activeStreamRef = useRef<MediaStream | null>(null);
  const scanLoopIdRef = useRef<number | null>(null);
  const isScanningRef = useRef<boolean>(false);
  const isPausedRef = useRef<boolean>(false);
  const isProcessingRef = useRef<boolean>(false);
  const countdownTimerRef = useRef<any>(null);
  const recentScansMapRef = useRef<Map<string, number>>(new Map());
  const barcodeDetectorRef = useRef<any>(null);

  // Check iframe status
  useEffect(() => {
    try {
      setIsInIframe(window.self !== window.top);
    } catch {
      setIsInIframe(true);
    }
  }, []);

  // Initialize native BarcodeDetector if browser supports it
  useEffect(() => {
    if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
      try {
        barcodeDetectorRef.current = new (window as any).BarcodeDetector({
          formats: ['qr_code'],
        });
      } catch (e) {
        console.warn('Native BarcodeDetector init note:', e);
      }
    }
  }, []);

  // AUTOMATIC CAMERA START:
  // When user opens QR Scanner, open the camera IMMEDIATELY without waiting or requiring extra clicks!
  useEffect(() => {
    let isMounted = true;

    // Start instantly
    requestCameraAndStart('environment');

    // Also listen for permission granted from any global trigger
    const handleGrantedEvent = () => {
      if (isMounted && !isScanningRef.current) {
        requestCameraAndStart('environment');
      }
    };

    window.addEventListener('admin-guru-camera-granted', handleGrantedEvent);
    return () => {
      isMounted = false;
      window.removeEventListener('admin-guru-camera-granted', handleGrantedEvent);
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
      stopAllStreamsAndScanner();
    };
  }, []);

  // Play pleasant acoustic chime on successful scan (0ms latency Web Audio)
  const playBeep = () => {
    if (!soundEnabled || typeof window === 'undefined') return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();

      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(880, ctx.currentTime);
      gain1.gain.setValueAtTime(0.18, ctx.currentTime);
      gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start();
      osc1.stop(ctx.currentTime + 0.15);

      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(1174.66, ctx.currentTime + 0.08);
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

  // Speak student confirmation voice in Indonesian (id-ID)
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

  // Stop camera stream cleanly
  const stopAllStreamsAndScanner = () => {
    if (scanLoopIdRef.current) {
      cancelAnimationFrame(scanLoopIdRef.current);
      scanLoopIdRef.current = null;
    }

    if (activeStreamRef.current) {
      try {
        activeStreamRef.current.getTracks().forEach((track) => track.stop());
      } catch {}
      activeStreamRef.current = null;
    }

    if (videoRef.current) {
      try {
        videoRef.current.srcObject = null;
      } catch {}
    }

    isScanningRef.current = false;
    isPausedRef.current = false;
    isProcessingRef.current = false;
    setIsScanning(false);
    setIsPaused(false);
    setTorchOn(false);
    setTorchSupported(false);
  };

  // ULTRA-FAST NATIVE CAMERA LAUNCHER:
  // Starts hardware stream directly in <100ms
  const requestCameraAndStart = async (
    preferredFacing: 'environment' | 'user' = 'environment',
    specificDeviceId?: string
  ) => {
    setPermissionState('checking');
    setScanStatus('checking');
    setErrorMessage('');
    setCurrentFacing(preferredFacing);

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setPermissionState('not_found');
        setScanStatus('error');
        setErrorMessage('Peramban tidak mendukung API kamera (navigator.mediaDevices.getUserMedia).');
        return;
      }

      // Stop previous stream
      stopAllStreamsAndScanner();

      const constraints: MediaStreamConstraints = {
        audio: false,
        video: specificDeviceId
          ? { deviceId: { exact: specificDeviceId } }
          : {
              facingMode: preferredFacing === 'environment' ? { ideal: 'environment' } : { ideal: 'user' },
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
      };

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (firstErr) {
        // Fallback with minimal constraints
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: true,
        });
      }

      activeStreamRef.current = stream;

      // Attach stream to Video element
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        try {
          await videoRef.current.play();
        } catch {}
      }

      isScanningRef.current = true;
      isPausedRef.current = false;
      setIsScanning(true);
      setIsPaused(false);
      setPermissionState('granted');
      setScanStatus('scanning');
      setStatusMessage('Kamera aktif, arahkan kartu QR siswa ke dalam bingkai');
      localStorage.setItem('admin_guru_camera_consented', 'granted');

      // Check Torch capability
      try {
        const track = stream.getVideoTracks()[0];
        const capabilities: any = track?.getCapabilities?.();
        if (capabilities?.torch) {
          setTorchSupported(true);
        }
      } catch {}

      // Enumerate available video inputs in background
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoInputs = devices
          .filter((d) => d.kind === 'videoinput')
          .map((d, idx) => ({
            id: d.deviceId,
            label: d.label || `Kamera ${idx + 1}`,
          }));
        if (videoInputs.length > 0) {
          setCameraDevices(videoInputs);
        }
      } catch {}

      // Start the ultra-fast continuous QR decoding loop
      startHighSpeedScanningLoop();
    } catch (err: any) {
      console.warn('Camera request error:', err);
      const name = err?.name || '';
      const message = err?.message || String(err);

      if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
        setPermissionState('not_found');
        setErrorMessage('Tidak ada perangkat kamera / webcam yang terdeteksi.');
      } else {
        setPermissionState('denied');
        if (name === 'NotAllowedError' || message.includes('denied')) {
          setErrorMessage('Izin kamera ditolak oleh browser. Klik tombol di bawah untuk mengizinkan akses.');
        } else {
          setErrorMessage('Kamera belum aktif. Klik tombol di bawah untuk membuka kamera.');
        }
      }
      setScanStatus('error');
    }
  };

  // HIGH-SPEED DUAL SCANNING ENGINE:
  // 1. Hardware-accelerated BarcodeDetector (Chrome/Edge/Android - 0ms overhead)
  // 2. jsQR on downscaled 400px offscreen canvas (instant 3ms fallback on ANY browser)
  // Runs smoothly on requestAnimationFrame (~28 FPS)
  const startHighSpeedScanningLoop = () => {
    let lastScanTimestamp = 0;

    const scanFrame = async (timestamp: number) => {
      if (!isScanningRef.current) return;

      if (!isPausedRef.current && !isProcessingRef.current && videoRef.current && videoRef.current.readyState >= 2) {
        // Throttle to ~35ms (~28 scans/sec) for optimal balance of speed and 0 UI stutter
        if (timestamp - lastScanTimestamp >= 35) {
          lastScanTimestamp = timestamp;

          let detectedText: string | null = null;

          // Attempt 1: Native BarcodeDetector (Hardware Accelerated)
          if (barcodeDetectorRef.current) {
            try {
              const barcodes = await barcodeDetectorRef.current.detect(videoRef.current);
              if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
                detectedText = barcodes[0].rawValue;
              }
            } catch {}
          }

          // Attempt 2: High-speed jsQR on offscreen canvas
          if (!detectedText && videoRef.current) {
            try {
              const video = videoRef.current;
              const vWidth = video.videoWidth;
              const vHeight = video.videoHeight;

              if (vWidth > 0 && vHeight > 0) {
                // Downscale for peak performance: max 420px width
                const scale = Math.min(1, 420 / vWidth);
                const targetW = Math.floor(vWidth * scale);
                const targetH = Math.floor(vHeight * scale);

                if (!canvasRef.current) {
                  canvasRef.current = document.createElement('canvas');
                }
                const canvas = canvasRef.current;
                if (canvas.width !== targetW || canvas.height !== targetH) {
                  canvas.width = targetW;
                  canvas.height = targetH;
                }

                const ctx = canvas.getContext('2d', { willReadFrequently: true });
                if (ctx) {
                  ctx.drawImage(video, 0, 0, targetW, targetH);
                  const imgData = ctx.getImageData(0, 0, targetW, targetH);
                  const qrResult = jsQR(imgData.data, targetW, targetH, {
                    inversionAttempts: 'dontInvert',
                  });

                  if (qrResult && qrResult.data) {
                    detectedText = qrResult.data;
                  }
                }
              }
            } catch {}
          }

          // Process detected QR code
          if (detectedText) {
            handleDecodedText(detectedText);
          }
        }
      }

      if (isScanningRef.current) {
        scanLoopIdRef.current = requestAnimationFrame(scanFrame);
      }
    };

    scanLoopIdRef.current = requestAnimationFrame(scanFrame);
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

  // Continuous Scan Handler with atomic lock & instant optimistic responsiveness
  const handleDecodedText = async (decodedText: string) => {
    // 1. Check scan lock
    if (isProcessingRef.current) return;

    const identifier = parseStudentIdentifier(decodedText);
    if (!identifier) return;

    // 2. Cooldown check: prevent duplicate scans for the SAME student within 3 seconds
    const now = Date.now();
    const lastScanTimestamp = recentScansMapRef.current.get(identifier.toLowerCase()) || 0;
    if (now - lastScanTimestamp < 3000) {
      return;
    }

    // 3. Acquire atomic lock immediately
    isProcessingRef.current = true;
    setScanStatus('qr_detected');
    setStatusMessage('QR terdeteksi, memvalidasi data...');

    const currentTime = new Date().toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    setLastScanTime(currentTime);

    // 4. Validate Student with flexible prefix-agnostic matching
    setScanStatus('validating');

    const matchesIdentifier = (s: Student, idStr: string): boolean => {
      if (!s) return false;
      const clean = idStr.trim();
      const cleanLower = clean.toLowerCase();
      const withoutStu = clean.replace(/^STU-/i, '').toLowerCase();
      const withStu = ('STU-' + withoutStu).toLowerCase();

      const sId = (s.studentId || '').trim();
      const sIdLower = sId.toLowerCase();
      const sIdWithoutStu = sIdLower.replace(/^STU-/i, '');

      const sQr = (s.qrCode || '').trim();
      const sQrLower = sQr.toLowerCase();
      const sQrWithoutStu = sQrLower.replace(/^STU-/i, '');

      const sNis = (s.nis || '').trim();
      const sNisn = (s.nisn || '').trim();

      return (
        sIdLower === cleanLower ||
        sIdLower === withoutStu ||
        sIdWithoutStu === withoutStu ||
        sQrLower === cleanLower ||
        sQrLower === withStu ||
        sQrWithoutStu === withoutStu ||
        sNis === clean ||
        sNis === withoutStu ||
        (Boolean(sNisn) && (sNisn === clean || sNisn === withoutStu))
      );
    };

    let matched = students.find((s) => matchesIdentifier(s, identifier));

    let otherClassStudent: Student | undefined;
    if (!matched && allStudents.length > 0) {
      otherClassStudent = allStudents.find((s) => matchesIdentifier(s, identifier));
    }

    // Fallback: If not found in memory (e.g. freshly imported or cache delay), query Firestore directly!
    if (!matched && !otherClassStudent) {
      try {
        const found = await studentService.lookupStudent(identifier);
        if (found) {
          const isCurrentClass =
            found.classId === selectedClassId ||
            (Boolean(selectedClassName) && Boolean(found.className) && (found.className || '').toLowerCase() === (selectedClassName || '').toLowerCase()) ||
            (Boolean(found.classId) && Boolean(selectedClassId) && (found.classId.includes(selectedClassId) || selectedClassId.includes(found.classId)));

          if (isCurrentClass) {
            matched = found;
          } else {
            otherClassStudent = found;
          }
        }
      } catch (lookupErr) {
        console.warn('Direct student lookup fallback note:', lookupErr);
      }
    }

    // Case A: Unregistered Student
    if (!matched && !otherClassStudent) {
      setScanStatus('not_found');
      setStatusMessage(`QR "${identifier}" tidak terdaftar dalam sistem.`);
      speakVoice('QR Siswa tidak dikenali');
      triggerResumeCountdown(2.0);
      return;
    }

    // Case B: Cross-Class Student Match (e.g. Reza in Kelas 6A)
    if (!matched && otherClassStudent) {
      matched = otherClassStudent;
      setStatusMessage(`${matched.name} (${matched.className || matched.classId}) terdeteksi, memproses presensi...`);
    }

    if (!matched) {
      triggerResumeCountdown(1.5);
      return;
    }

    setActiveStudent(matched);

    // Case C: Duplicate Check (Already recorded)
    const alreadyAttended = existingRecords.find((rec) => rec.studentId === matched!.studentId);
    if (alreadyAttended) {
      recentScansMapRef.current.set(identifier.toLowerCase(), now);
      playDuplicateBeep();
      setScanStatus('duplicate');
      const timeStr = alreadyAttended.createdAt
        ? new Date(alreadyAttended.createdAt).toLocaleTimeString('id-ID')
        : 'hari ini';
      setStatusMessage(
        `${matched.name} sudah melakukan presensi jam ${timeStr} (${alreadyAttended.status}).`
      );
      const firstName = soundService.getFirstName(matched.name);
      soundService.speakText(`${firstName} sudah presensi`);
      if (onDuplicateWarning) {
        onDuplicateWarning(matched, alreadyAttended);
      }
      triggerResumeCountdown(2.2);
      return;
    }

    // Case D: Record Attendance
    setScanStatus('saving');
    setStatusMessage(`Menyimpan presensi untuk ${matched.name}...`);

    try {
      // Immediate feedback: play sound and announce "[Nama Depan] Hadir" in Indonesian
      recentScansMapRef.current.set(identifier.toLowerCase(), now);
      setScanStatus('success');
      setStatusMessage(`Presensi berhasil dicatat pada ${currentTime}`);
      soundService.speakAttendance(matched.name, 'Hadir');

      // Asynchronous background database save
      const result = await onRecordSuccess(matched, currentTime);

      if (result && result.isDuplicate) {
        playDuplicateBeep();
        setScanStatus('duplicate');
        setStatusMessage(`${matched.name} sudah tercatat sebelumnya.`);
        triggerResumeCountdown(2.0);
        return;
      }

      // Automatically ready for next student after swift 1.4s
      triggerResumeCountdown(1.4);
    } catch (saveErr: any) {
      console.warn('Failed recording attendance:', saveErr);
      setScanStatus('error');
      setStatusMessage(saveErr?.message || 'Gagal menyimpan presensi. Periksa koneksi.');
      triggerResumeCountdown(2.5);
    }
  };

  // Automatic countdown before clearing overlay and resuming continuous scanning
  const triggerResumeCountdown = (seconds: number) => {
    setCountdown(Math.ceil(seconds));
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
    }

    let remaining = seconds;
    countdownTimerRef.current = setInterval(() => {
      remaining -= 0.5;
      setCountdown(Math.max(0, Math.ceil(remaining)));
      if (remaining <= 0) {
        clearInterval(countdownTimerRef.current);
        countdownTimerRef.current = null;
        resumeScanner();
      }
    }, 500);
  };

  // Instantly resume scanning for next student
  const resumeScanner = () => {
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    setActiveStudent(null);
    setScanStatus('scanning');
    setStatusMessage('Kamera aktif, siap memindai siswa berikutnya');
    setCountdown(0);
    isProcessingRef.current = false;
  };

  // Switch between front and back camera
  const handleSwitchCamera = async () => {
    const nextFacing = currentFacing === 'environment' ? 'user' : 'environment';
    setCurrentFacing(nextFacing);

    if (cameraDevices.length > 1) {
      const currentIndex = cameraDevices.findIndex((c) => c.id === selectedCameraId);
      const nextIndex = (currentIndex + 1) % cameraDevices.length;
      const nextCamera = cameraDevices[nextIndex];
      setSelectedCameraId(nextCamera.id);
      await requestCameraAndStart(nextFacing, nextCamera.id);
    } else {
      await requestCameraAndStart(nextFacing);
    }
  };

  // Toggle Torch / Flashlight
  const handleToggleTorch = async () => {
    if (!activeStreamRef.current) return;
    try {
      const track = activeStreamRef.current.getVideoTracks()[0];
      const nextTorch = !torchOn;
      await (track as any).applyConstraints({
        advanced: [{ torch: nextTorch }],
      });
      setTorchOn(nextTorch);
    } catch (e) {
      console.warn('Torch toggle error:', e);
    }
  };

  // Pause / Resume Scanning
  const handleTogglePause = () => {
    if (isPaused) {
      isPausedRef.current = false;
      setIsPaused(false);
      setScanStatus('scanning');
      setStatusMessage('Kamera aktif, siap memindai');
    } else {
      isPausedRef.current = true;
      setIsPaused(true);
      setStatusMessage('Pemindaian dijeda oleh guru');
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-5 shadow-2xl relative overflow-hidden text-white">
      {/* Background Accent Gradients */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-80 h-80 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top Header & Hardware Controls */}
      <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-blue-600/30">
            <Camera className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-extrabold text-white tracking-tight">
                Presensi QR Kamera
              </h3>
              <span
                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                  isScanning && !isPaused
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : isPaused
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    : 'bg-slate-800 text-slate-400 border border-slate-700'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    isScanning && !isPaused
                      ? 'bg-emerald-400 animate-pulse'
                      : isPaused
                      ? 'bg-amber-400'
                      : 'bg-slate-500'
                  }`}
                />
                {isScanning && !isPaused ? 'Aktif Memindai' : isPaused ? 'Dijeda' : 'Menyiapkan'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Pindai kartu QR siswa otomatis • Respon instan • Rombel:{' '}
              <strong className="text-slate-200">{selectedClassName || selectedClassId}</strong>
            </p>
          </div>
        </div>

        {/* Camera Control Toolbar */}
        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
          {/* Audio Speech Toggle */}
          <button
            type="button"
            onClick={() => {
              const next = !soundEnabled;
              setSoundEnabled(next);
              soundService.setSoundEnabled(next);
            }}
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

          {/* Fit Mode Toggle */}
          {isScanning && (
            <button
              type="button"
              onClick={() => setFitMode(fitMode === 'cover' ? 'contain' : 'cover')}
              title={
                fitMode === 'cover'
                  ? 'Mode Layar Penuh (Cover) - Klik untuk Mode Proporsional'
                  : 'Mode Proporsional (Contain) - Klik untuk Mode Penuh'
              }
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs flex items-center gap-1.5 transition-all cursor-pointer"
            >
              {fitMode === 'cover' ? (
                <Maximize2 className="w-4 h-4 text-cyan-400" />
              ) : (
                <Minimize2 className="w-4 h-4 text-cyan-400" />
              )}
              <span className="hidden md:inline text-[11px]">
                {fitMode === 'cover' ? 'Penuh' : 'Utuh'}
              </span>
            </button>
          )}

          {/* Torch / Flashlight Toggle */}
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

          {/* Switch Camera */}
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
        </div>
      </div>

      {/* Main Scanner Container Viewport - ENLARGED RESPONSIVE CAMERA AREA */}
      <div className="relative z-10 mt-4 flex-1 flex flex-col items-center justify-center w-full">
        {/* VIDEO BOX CONTAINER - Fills 100% width and 480-600px height on Desktop */}
        <div className="w-full h-[400px] sm:h-[480px] md:h-[520px] lg:h-[550px] xl:h-[580px] relative rounded-3xl overflow-hidden border-2 border-slate-700/80 bg-black shadow-2xl shadow-black/80 flex items-center justify-center">
          {/* Native HTML5 Video Element (Hardware-Accelerated Stream) */}
          <video
            ref={videoRef}
            playsInline
            muted
            autoPlay
            className={`w-full h-full ${
              fitMode === 'cover' ? 'object-cover' : 'object-contain'
            } ${permissionState === 'granted' ? 'opacity-100' : 'opacity-0'}`}
          />

          {/* Custom Optical Overlay Framing (Corner Brackets, Laser & Reticle) */}
          {permissionState === 'granted' && (
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
                <span>Arahkan kartu QR siswa ke dalam bingkai</span>
              </div>
            </div>
          )}

          {/* SUCCESS MODAL OVERLAY */}
          {permissionState === 'granted' && scanStatus === 'success' && activeStudent && (
            <div className="absolute inset-0 bg-emerald-950/92 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center z-30 transition-all animate-in fade-in duration-150">
              <div className="w-16 h-16 rounded-3xl bg-emerald-500/20 border-2 border-emerald-400 flex items-center justify-center text-emerald-300 mb-3 shadow-xl shadow-emerald-500/30">
                <CheckCircle2 className="w-10 h-10 text-emerald-400" />
              </div>

              <span className="px-3.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-black uppercase tracking-wider">
                PRESENSI BERHASIL DICATAT
              </span>

              <h4 className="text-xl sm:text-2xl font-black text-white mt-2 uppercase tracking-tight">
                {activeStudent.name}
              </h4>

              <div className="flex items-center gap-3 text-xs text-emerald-200 mt-1 font-semibold">
                <span>NIS: {activeStudent.nis}</span>
                <span>•</span>
                <span>{lastScanTime} WIB</span>
                <span>•</span>
                <span className="text-white font-bold">HADIR</span>
              </div>

              <p className="text-xs text-emerald-100/80 mt-2 max-w-sm">
                Data presensi otomatis tersimpan ke server.
              </p>

              <button
                type="button"
                onClick={resumeScanner}
                className="mt-5 px-6 py-2.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs shadow-lg shadow-emerald-500/30 cursor-pointer flex items-center gap-1.5 transition-transform active:scale-95"
              >
                <span>Siap Siswa Berikutnya ({countdown}s)</span>
              </button>
            </div>
          )}

          {/* DUPLICATE WARNING OVERLAY */}
          {permissionState === 'granted' && scanStatus === 'duplicate' && activeStudent && (
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
              <p className="text-xs text-amber-200 mt-1 max-w-sm leading-relaxed">
                {statusMessage}
              </p>

              <button
                type="button"
                onClick={resumeScanner}
                className="mt-4 px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold cursor-pointer"
              >
                Lanjutkan ({countdown}s)
              </button>
            </div>
          )}

          {/* CLASS MISMATCH OVERLAY */}
          {permissionState === 'granted' && scanStatus === 'class_mismatch' && activeStudent && (
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
          {permissionState === 'granted' && scanStatus === 'not_found' && (
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

          {/* STATE: CHECKING / OPENING CAMERA (Smooth indicator without freezing) */}
          {permissionState === 'checking' && (
            <div className="absolute inset-0 z-20 bg-slate-900/95 backdrop-blur-sm p-6 flex flex-col items-center justify-center text-center">
              <div className="w-12 h-12 border-3 border-cyan-500/30 border-t-cyan-400 rounded-full animate-spin mb-3" />
              <h4 className="text-base font-bold text-white tracking-tight">
                Membuka Kamera Presensi...
              </h4>
              <p className="text-xs text-slate-400 mt-1 max-w-xs">
                Mengaktifkan sensor kamera perangkat untuk presensi instan.
              </p>
            </div>
          )}

          {/* STATE: PERMISSION DENIED / BLOCKED - Clean, Single-Click Trigger, No Complicated Questions */}
          {permissionState === 'denied' && (
            <div className="absolute inset-0 z-20 bg-slate-900/95 backdrop-blur-sm p-6 sm:p-8 flex flex-col items-center justify-center text-center">
              <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border-2 border-amber-400/40 flex items-center justify-center text-amber-300 mb-3 shadow-lg">
                <Camera className="w-7 h-7" />
              </div>

              <h3 className="text-base sm:text-lg font-bold text-white mb-1">
                Kamera Belum Diizinkan
              </h3>
              <p className="text-xs text-slate-300 mb-4 max-w-sm leading-relaxed">
                {errorMessage || 'Izin akses kamera diperlukan agar guru dapat memindai kartu QR siswa.'}
              </p>

              <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full justify-center max-w-sm">
                <button
                  type="button"
                  onClick={() => requestCameraAndStart('environment')}
                  className="w-full sm:w-auto px-6 py-2.5 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-extrabold text-xs shadow-lg shadow-blue-600/40 flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <Camera className="w-4 h-4" />
                  <span>BUKA KAMERA SEKARANG</span>
                </button>

                {onSwitchToTable && (
                  <button
                    type="button"
                    onClick={onSwitchToTable}
                    className="w-full sm:w-auto px-4 py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer border border-slate-700"
                  >
                    <Table className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Tabel Presensi</span>
                  </button>
                )}
              </div>

              {isInIframe && (
                <div className="mt-4">
                  <a
                    href={typeof window !== 'undefined' ? window.location.href : '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-cyan-400 hover:text-cyan-300 inline-flex items-center gap-1 font-semibold"
                  >
                    <ExternalLink className="w-3 h-3" />
                    <span>Buka WebApp di Tab Baru (Layar Penuh) ↗</span>
                  </a>
                </div>
              )}
            </div>
          )}

          {/* STATE: CAMERA NOT DETECTED */}
          {permissionState === 'not_found' && (
            <div className="absolute inset-0 z-20 bg-slate-900/95 backdrop-blur-sm p-6 flex flex-col items-center justify-center text-center">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400 mb-2">
                <Camera className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-white mb-1">
                Kamera Tidak Terdeteksi
              </h3>
              <p className="text-xs text-slate-300 mb-4 max-w-sm">
                Tidak ada sensor kamera aktif pada perangkat ini. Silakan gunakan tabel presensi manual.
              </p>

              <div className="flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => requestCameraAndStart('user')}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Deteksi Ulang</span>
                </button>

                {onSwitchToTable && (
                  <button
                    type="button"
                    onClick={onSwitchToTable}
                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Table className="w-3.5 h-3.5" />
                    <span>Gunakan Tabel Presensi</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer Info Strip */}
      <div className="relative z-10 mt-3 flex flex-wrap items-center justify-between text-[11px] text-slate-400 border-t border-slate-800/80 pt-3 gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
          <span>Pemindaian optik QR kontinu super cepat (jsQR + Hardware BarcodeDetector)</span>
        </div>
        <div className="flex items-center gap-3">
          <span>
            Kamera:{' '}
            <strong className={isScanning ? 'text-emerald-400' : 'text-slate-300'}>
              {isScanning ? (currentFacing === 'environment' ? 'Belakang' : 'Depan') : 'Menyiapkan'}
            </strong>
          </span>
          <span>•</span>
          <span>
            Rombel: <strong className="text-slate-200">{selectedClassName || selectedClassId}</strong>
          </span>
        </div>
      </div>
    </div>
  );
};
