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
  HelpCircle,
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
  existingRecords: AttendanceRecord[];
  selectedClassId: string;
  selectedClassName?: string;
  selectedScheduleId?: string;
  selectedSubjectName?: string;
  selectedDate: string;
  onRecordSuccess: (student: Student, scanTime: string) => Promise<void>;
  onDuplicateWarning?: (student: Student, existingRecord: AttendanceRecord) => void;
  onSwitchToTable?: () => void;
}

type ScanStatus = 'idle' | 'scanning' | 'success' | 'duplicate' | 'error' | 'class_mismatch';

export const QrScannerView: React.FC<QrScannerViewProps> = ({
  students,
  existingRecords,
  selectedClassId,
  selectedClassName,
  selectedScheduleId,
  selectedSubjectName,
  selectedDate,
  onRecordSuccess,
  onSwitchToTable,
}) => {
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

  // Status overlay states
  const [scanStatus, setScanStatus] = useState<ScanStatus>('idle');
  const [activeStudent, setActiveStudent] = useState<Student | null>(null);
  const [lastScanTime, setLastScanTime] = useState<string>('');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [countdown, setCountdown] = useState<number>(0);

  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const isProcessingRef = useRef<boolean>(false);
  const countdownTimerRef = useRef<any>(null);
  const containerId = 'qr-interactive-camera-box';

  // Check if app is inside an iframe on mount
  useEffect(() => {
    try {
      setIsInIframe(window.self !== window.top);
    } catch {
      setIsInIframe(true);
    }
  }, []);

  // Play pleasant acoustic beep on scan detection
  const playBeep = () => {
    if (!soundEnabled || typeof window === 'undefined') return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime); // Note A5
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.22);
    } catch {}
  };

  // Speak student confirmation voice in Indonesian (id-ID) using Web Speech API
  const speakVoice = (text: string) => {
    if (!soundEnabled || typeof window === 'undefined' || !window.speechSynthesis) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'id-ID';
      utterance.rate = 1.0;
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

  // Request Camera Permission and Detect Hardware Devices with resilient multi-fallback
  const requestCameraAndStart = async (preferredFacing: 'environment' | 'user' = 'environment') => {
    setPermissionState('checking');
    setErrorMessage('');

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setPermissionState('not_found');
        setErrorMessage('Peramban Anda tidak mendukung API kamera (navigator.mediaDevices).');
        return;
      }

      // 1. Probe camera access safely without strict constraints
      let probeStream: MediaStream | null = null;
      try {
        // Try ideal constraint (works on phones/tablets for back camera)
        probeStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: preferredFacing } },
        });
      } catch (errIdeal) {
        // Fallback to basic video: true (works on all laptops/desktops with integrated webcams)
        try {
          probeStream = await navigator.mediaDevices.getUserMedia({ video: true });
        } catch (errBasic: any) {
          throw errBasic;
        }
      }

      // Check torch capabilities on track
      if (probeStream) {
        const track = probeStream.getVideoTracks()[0];
        if (track) {
          const capabilities = (track.getCapabilities && track.getCapabilities()) || {};
          if ((capabilities as any).torch) {
            setTorchSupported(true);
          }
        }
        // Stop probe stream so Html5Qrcode can bind to the device cleanly
        probeStream.getTracks().forEach((t) => t.stop());
      }

      // 2. Enumerate available cameras
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
        console.warn('Enum cameras note:', enumErr);
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

      // 4. Update permission granted and start scanner
      setPermissionState('granted');

      // Allow DOM cycle to render before starting stream
      setTimeout(async () => {
        await startScanner(targetCamId, preferredFacing);
      }, 60);
    } catch (err: any) {
      console.warn('Camera request error:', err);
      const name = err?.name || '';
      const message = err?.message || String(err);
      setErrorMessage(`${name ? name + ': ' : ''}${message}`);

      if (
        name === 'NotAllowedError' ||
        name === 'PermissionDeniedError' ||
        message.includes('Permission denied') ||
        message.includes('Permission dismissed')
      ) {
        setPermissionState('denied');
      } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
        setPermissionState('not_found');
      } else {
        setPermissionState('denied');
      }
    }
  };

  // Start QR Video Feed & Real-time Optical Scanner
  const startScanner = async (
    cameraIdToUse?: string,
    fallbackFacing: 'environment' | 'user' = 'environment'
  ) => {
    try {
      // Ensure container element is in DOM
      const containerEl = document.getElementById(containerId);
      if (!containerEl) {
        console.warn('Container element not ready, waiting...');
        setTimeout(() => startScanner(cameraIdToUse, fallbackFacing), 100);
        return;
      }

      if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
        await html5QrCodeRef.current.stop();
        html5QrCodeRef.current.clear();
      }

      const qrCodeInstance = new Html5Qrcode(containerId, {
        formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
        verbose: false,
      });
      html5QrCodeRef.current = qrCodeInstance;

      const scanConfig = {
        fps: 15,
        qrbox: (w: number, h: number) => {
          const minSize = Math.min(w, h);
          const edge = Math.floor(minSize * 0.72);
          return { width: edge, height: edge };
        },
        aspectRatio: 1.0,
      };

      // Attempt 1: Start with specific camera ID if available, or facingMode
      const targetSource = cameraIdToUse || { facingMode: fallbackFacing };

      try {
        await qrCodeInstance.start(targetSource, scanConfig, handleDecodedText, () => {});
      } catch (firstErr: any) {
        console.warn('Camera start attempt 1 failed, trying fallback mode:', firstErr);
        // Attempt 2: Fallback to opposite facingMode or basic user mode
        const fallbackSource =
          fallbackFacing === 'environment'
            ? { facingMode: 'user' }
            : { facingMode: 'environment' };

        await qrCodeInstance.start(fallbackSource, scanConfig, handleDecodedText, () => {});
      }

      setIsScanning(true);
      setIsPaused(false);
      setScanStatus('scanning');
    } catch (error: any) {
      console.warn('Unable to start camera stream:', error);
      setIsScanning(false);
      setPermissionState('denied');
      setErrorMessage(error?.message || 'Gagal menyalakan video streaming kamera');
    }
  };

  // Stop QR Camera Stream
  const stopScanner = async () => {
    if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
      try {
        await html5QrCodeRef.current.stop();
        html5QrCodeRef.current.clear();
      } catch (e) {
        console.warn('Scanner stop note:', e);
      }
    }
    setIsScanning(false);
    setIsPaused(false);
    setScanStatus('idle');
  };

  // Switch / Flip Camera (Front vs Back)
  const handleFlipCamera = async () => {
    if (cameraDevices.length <= 1) {
      // Toggle between environment and user facingMode
      const nextFacing = selectedCameraId ? 'user' : 'environment';
      await stopScanner();
      await requestCameraAndStart(nextFacing);
      return;
    }

    const currentIndex = cameraDevices.findIndex((c) => c.id === selectedCameraId);
    const nextIndex = (currentIndex + 1) % cameraDevices.length;
    const nextCamera = cameraDevices[nextIndex];
    setSelectedCameraId(nextCamera.id);
    if (isScanning) {
      await stopScanner();
      await startScanner(nextCamera.id);
    }
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
      console.warn('Torch not supported on this track:', e);
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
      } catch {}
    } else {
      try {
        html5QrCodeRef.current.pause();
        setIsPaused(true);
      } catch {}
    }
  };

  // Parse Student Identifier from QR Payload
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

  // Automatic Processing on QR Code Scanned
  const handleDecodedText = async (decodedText: string) => {
    if (isProcessingRef.current) return;
    isProcessingRef.current = true;

    // Temporary pause video scanner stream while verifying
    try {
      if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
        html5QrCodeRef.current.pause();
      }
    } catch {}

    const identifier = parseStudentIdentifier(decodedText);
    const currentTime = new Date().toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    setLastScanTime(currentTime);

    // 1. Search student in registered students collection
    const matched = students.find(
      (s) =>
        s.studentId.toLowerCase() === identifier.toLowerCase() ||
        (s.qrCode && s.qrCode.toLowerCase() === identifier.toLowerCase()) ||
        s.nis === identifier
    );

    // Case: Unregistered Student
    if (!matched) {
      setScanStatus('error');
      setStatusMessage(`QR Siswa tidak dikenali. Kode "${identifier}" tidak terdaftar di sistem.`);
      speakVoice('QR Siswa tidak dikenali');
      triggerResumeCountdown(2.8);
      return;
    }

    setActiveStudent(matched);

    // Case: Class / Rombel Mismatch
    if (selectedClassId && matched.classId && matched.classId !== selectedClassId) {
      setScanStatus('class_mismatch');
      setStatusMessage(
        `${matched.name} terdaftar di rombel ${matched.className || matched.classId}, bukan di ${selectedClassName || selectedClassId}.`
      );
      speakVoice(`Perhatian, siswa dari rombel ${matched.className || matched.classId}`);
      triggerResumeCountdown(3.2);
      return;
    }

    // Case: Duplicate Check (Already scanned in this session / date)
    const alreadyAttended = existingRecords.find((rec) => rec.studentId === matched.studentId);
    if (alreadyAttended) {
      setScanStatus('duplicate');
      setStatusMessage(
        `${matched.name} sudah melakukan presensi hari ini pada jam ${
          alreadyAttended.createdAt
            ? new Date(alreadyAttended.createdAt).toLocaleTimeString('id-ID')
            : 'sesi berjalan'
        } (Status: ${alreadyAttended.status}).`
      );
      speakVoice(`Siswa sudah presensi hari ini, ${matched.name}`);
      triggerResumeCountdown(2.8);
      return;
    }

    // Case: Valid Presensi -> Play Beep + Voice + Save to Firestore
    try {
      playBeep();
      setScanStatus('success');
      setStatusMessage('Presensi berhasil diverifikasi dan disimpan.');

      // Speak student voice
      speakVoice(`Presensi berhasil, ${matched.name}`);

      // Save to Firestore
      await onRecordSuccess(matched, currentTime);

      // Automatic resume countdown (2.5 seconds)
      triggerResumeCountdown(2.5);
    } catch (err: any) {
      console.warn('Note recording attendance:', err);
      setScanStatus('error');
      setStatusMessage(`Gagal mencatat presensi: ${err.message}`);
      triggerResumeCountdown(3);
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
    isProcessingRef.current = false;
    setScanStatus('scanning');
    setActiveStudent(null);
    setStatusMessage('');
    setCountdown(0);

    try {
      if (html5QrCodeRef.current && isScanning) {
        html5QrCodeRef.current.resume();
      }
    } catch (e) {
      console.warn('Resume note:', e);
    }
  };

  // Automatically trigger camera request on mount so the browser/AI Studio immediately pops up the permission dialog
  useEffect(() => {
    const timer = setTimeout(() => {
      requestCameraAndStart('environment');
    }, 200);
    return () => clearTimeout(timer);
  }, []);

  // Cleanup on component unmount
  useEffect(() => {
    return () => {
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
      }
      if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
        html5QrCodeRef.current.stop().catch(() => {});
      }
    };
  }, []);

  return (
    <div className="bg-slate-900 rounded-3xl p-4 sm:p-6 text-white shadow-xl shadow-slate-950/20 border border-slate-800 relative overflow-hidden flex flex-col">
      {/* Background ambient lighting */}
      <div className="absolute -top-24 -left-24 w-80 h-80 bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -right-24 w-80 h-80 bg-purple-600/15 rounded-full blur-3xl pointer-events-none" />

      {/* Header Bar */}
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Camera className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm sm:text-base font-extrabold tracking-tight text-white">
                PRESENSI QR KAMERA
              </h2>
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
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
                  ? 'Meminta Izin Kamera'
                  : 'Siap Pindai'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Pindai kartu barcode / QR siswa langsung melalui lensa kamera perangkat
            </p>
          </div>
        </div>

        {/* Camera Control Toolbar */}
        <div className="flex items-center gap-2">
          {/* Audio Speech Toggle */}
          <button
            type="button"
            onClick={() => setSoundEnabled(!soundEnabled)}
            title={soundEnabled ? 'Suara Presensi Aktif (Klik untuk Bisukan)' : 'Suara Presensi Senyap (Klik untuk Nyalakan)'}
            className={`p-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all ${
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

          {/* Torch / Flashlight Toggle (if supported) */}
          {torchSupported && isScanning && (
            <button
              type="button"
              onClick={handleToggleTorch}
              title="Senter / Flash Kamera"
              className={`p-2 rounded-xl border text-xs flex items-center gap-1.5 transition-all ${
                torchOn
                  ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                  : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <Flashlight className="w-4 h-4" />
              <span className="hidden sm:inline text-[11px]">Flash</span>
            </button>
          )}

          {/* Flip / Switch Camera (Depan / Belakang) */}
          <button
            type="button"
            onClick={handleFlipCamera}
            title="Ganti Kamera Depan / Belakang"
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs flex items-center gap-1.5 transition-all"
          >
            <SwitchCamera className="w-4 h-4 text-cyan-400" />
            <span className="hidden sm:inline text-[11px]">Ganti Kamera</span>
          </button>

          {/* Pause / Resume Scanning */}
          {isScanning && (
            <button
              type="button"
              onClick={handleTogglePause}
              title={isPaused ? 'Lanjutkan Kamera' : 'Jeda Pemindaian'}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs flex items-center gap-1.5 transition-all"
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
              onClick={stopScanner}
              title="Hentikan Kamera"
              className="p-2 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/50 text-rose-300 text-xs flex items-center gap-1.5 transition-all"
            >
              <span className="w-2.5 h-2.5 rounded-xs bg-rose-500" />
              <span className="hidden sm:inline text-[11px]">Stop</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Scanner Container Viewport */}
      <div className="relative z-10 mt-4 flex-1 flex flex-col items-center justify-center min-h-[380px]">
        {/* CRITICAL: The Html5Qrcode video mounting element is ALWAYS present in the DOM */}
        <div
          className={`w-full max-w-md mx-auto relative rounded-3xl overflow-hidden border-2 border-slate-700 bg-black aspect-square shadow-2xl shadow-black/80 flex items-center justify-center ${
            permissionState === 'granted' ? 'block' : 'hidden'
          }`}
        >
          {/* Html5Qrcode video element target */}
          <div id={containerId} className="w-full h-full object-cover" />

          {/* Custom Overlay Framing (Scan Area & Corner Brackets) */}
          <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
            {/* Target Scan Box */}
            <div className="relative w-64 h-64 sm:w-72 sm:h-72 flex items-center justify-center">
              {/* 4 Glowing Corner Brackets */}
              <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-cyan-400 rounded-tl-xl shadow-sm shadow-cyan-400" />
              <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-cyan-400 rounded-tr-xl shadow-sm shadow-cyan-400" />
              <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-cyan-400 rounded-bl-xl shadow-sm shadow-cyan-400" />
              <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-cyan-400 rounded-br-xl shadow-sm shadow-cyan-400" />

              {/* Animated Laser Scanning Line */}
              {scanStatus === 'scanning' && !isPaused && (
                <div className="absolute left-2 right-2 h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_12px_#22d3ee] animate-scan-laser pointer-events-none" />
              )}

              {/* Center Target Reticle */}
              <div className="w-16 h-16 rounded-full border border-cyan-500/20 flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-cyan-400/60" />
              </div>
            </div>

            {/* Bottom Guidance Prompt */}
            <div className="absolute bottom-4 px-4 py-1.5 rounded-full bg-slate-900/85 backdrop-blur-md border border-slate-700/60 text-slate-200 text-[11px] font-medium flex items-center gap-1.5 shadow-lg">
              <QrCode className="w-3.5 h-3.5 text-cyan-400" />
              <span>Arahkan QR siswa ke kamera</span>
            </div>
          </div>

          {/* PAUSED BANNER OVERLAY */}
          {isPaused && (
            <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-xs flex flex-col items-center justify-center p-6 text-center z-20">
              <Pause className="w-12 h-12 text-amber-400 mb-2 animate-pulse" />
              <h4 className="text-sm font-bold text-white">Pemindaian Dijeda</h4>
              <p className="text-xs text-slate-400 mt-1 mb-4">
                Kamera dijeda sementara oleh guru
              </p>
              <button
                type="button"
                onClick={handleTogglePause}
                className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-2"
              >
                <Play className="w-4 h-4 fill-slate-950" />
                <span>Lanjutkan Pemindaian</span>
              </button>
            </div>
          )}

          {/* SUCCESS SCAN OVERLAY */}
          {scanStatus === 'success' && activeStudent && (
            <div className="absolute inset-0 bg-emerald-950/92 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center z-30 transition-all duration-300">
              <div className="w-16 h-16 rounded-3xl bg-emerald-500/20 border-2 border-emerald-400 flex items-center justify-center text-emerald-300 shadow-xl shadow-emerald-500/40 mb-3 animate-bounce">
                <CheckCircle2 className="w-9 h-9 text-emerald-400" />
              </div>

              <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-extrabold tracking-wider uppercase mb-1">
                ✓ PRESENSI BERHASIL
              </span>

              <h3 className="text-lg sm:text-xl font-extrabold text-white mt-1 uppercase tracking-tight">
                {activeStudent.name}
              </h3>

              <p className="text-xs text-emerald-200/90 mt-0.5 font-medium">
                {activeStudent.className || selectedClassName || 'Kelas Siswa'} • NIS: {activeStudent.nis}
              </p>

              <div className="mt-4 flex items-center gap-3 bg-black/40 px-4 py-2 rounded-2xl border border-emerald-500/30">
                <div className="flex items-center gap-1.5 text-xs text-emerald-300 font-bold">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span>Status: Hadir</span>
                </div>
                <div className="w-px h-3.5 bg-emerald-700/50" />
                <div className="flex items-center gap-1 text-xs text-slate-300 font-mono">
                  <Clock className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{lastScanTime}</span>
                </div>
              </div>

              {/* Next Scan Countdown Meter */}
              <div className="mt-5 w-full max-w-xs">
                <div className="flex items-center justify-between text-[10px] text-emerald-300/80 mb-1 font-semibold">
                  <span>Siap membaca siswa berikutnya...</span>
                  <span>{countdown}s</span>
                </div>
                <div className="w-full h-1.5 bg-emerald-950 rounded-full overflow-hidden border border-emerald-800">
                  <div
                    className="h-full bg-emerald-400 rounded-full transition-all duration-500"
                    style={{ width: `${(countdown / 3) * 100}%` }}
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={resumeScanner}
                className="mt-4 text-[11px] font-bold text-emerald-300 hover:text-white underline underline-offset-4"
              >
                Pindai Siswa Berikutnya Sekarang ➔
              </button>
            </div>
          )}

          {/* DUPLICATE WARNING OVERLAY */}
          {scanStatus === 'duplicate' && activeStudent && (
            <div className="absolute inset-0 bg-amber-950/92 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center z-30 transition-all">
              <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border-2 border-amber-400 flex items-center justify-center text-amber-300 mb-3 shadow-lg shadow-amber-500/30">
                <AlertTriangle className="w-8 h-8 text-amber-400" />
              </div>

              <span className="px-3 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-extrabold uppercase">
                SUDAH MELAKUKAN PRESENSI
              </span>

              <h4 className="text-base font-bold text-white mt-2 uppercase">
                {activeStudent.name}
              </h4>
              <p className="text-xs text-amber-200/90 mt-1 max-w-xs">
                {statusMessage}
              </p>

              <div className="mt-4 text-[11px] text-amber-300 font-medium">
                Scanner otomatis aktif kembali dalam {countdown} detik...
              </div>

              <button
                type="button"
                onClick={resumeScanner}
                className="mt-3 px-4 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold"
              >
                Lanjut Siswa Berikutnya
              </button>
            </div>
          )}

          {/* ERROR / NOT FOUND OVERLAY */}
          {scanStatus === 'error' && (
            <div className="absolute inset-0 bg-rose-950/92 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center z-30 transition-all">
              <div className="w-14 h-14 rounded-2xl bg-rose-500/20 border-2 border-rose-400 flex items-center justify-center text-rose-300 mb-3 shadow-lg shadow-rose-500/30">
                <AlertCircle className="w-8 h-8 text-rose-400" />
              </div>

              <span className="px-3 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[10px] font-extrabold uppercase">
                QR SISWA TIDAK DIKENALI
              </span>

              <p className="text-xs text-rose-200 mt-2 max-w-xs leading-relaxed">
                {statusMessage}
              </p>

              <button
                type="button"
                onClick={resumeScanner}
                className="mt-4 px-4 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold"
              >
                Coba Scan Lagi ({countdown}s)
              </button>
            </div>
          )}

          {/* CLASS MISMATCH OVERLAY */}
          {scanStatus === 'class_mismatch' && activeStudent && (
            <div className="absolute inset-0 bg-purple-950/92 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center z-30 transition-all">
              <div className="w-14 h-14 rounded-2xl bg-purple-500/20 border-2 border-purple-400 flex items-center justify-center text-purple-300 mb-3 shadow-lg shadow-purple-500/30">
                <GraduationCap className="w-8 h-8 text-purple-400" />
              </div>

              <span className="px-3 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[10px] font-extrabold uppercase">
                BEDA KELAS / ROMBEL
              </span>

              <h4 className="text-base font-bold text-white mt-2 uppercase">
                {activeStudent.name}
              </h4>
              <p className="text-xs text-purple-200 mt-1 max-w-xs leading-relaxed">
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
                    } catch (e) {
                      resumeScanner();
                    }
                  }}
                  className="px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold"
                >
                  Tetap Catat Hadir
                </button>
                <button
                  type="button"
                  onClick={resumeScanner}
                  className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
                >
                  Lewati
                </button>
              </div>
            </div>
          )}
        </div>

        {/* STATE 1: READY / PROMPT TO START */}
        {permissionState === 'idle_ready' && (
          <div className="w-full max-w-md py-10 px-6 rounded-3xl bg-slate-800/60 border border-slate-700/60 text-center flex flex-col items-center">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-blue-600 to-indigo-600 border-2 border-blue-400/30 flex items-center justify-center text-white mb-4 shadow-xl shadow-blue-600/30">
              <Camera className="w-10 h-10 animate-pulse" />
            </div>

            <h3 className="text-lg font-extrabold text-white mb-1 tracking-tight">
              PRESENSI KAMERA SIAP
            </h3>
            <p className="text-xs text-slate-300 mb-2 font-medium">
              Kelas: <strong className="text-white">{selectedClassName || selectedClassId || 'Pilih Rombel'}</strong>
              {selectedSubjectName && <span> • {selectedSubjectName}</span>}
            </p>
            <p className="text-xs text-slate-400 mb-6 leading-relaxed max-w-xs">
              Siswa berdiri di depan kamera membawa kartu barcode / QR. Tekan tombol di bawah untuk membuka kamera dan mulai presensi.
            </p>

            <div className="flex flex-col sm:flex-row items-center gap-3 w-full justify-center">
              <button
                type="button"
                onClick={() => requestCameraAndStart('environment')}
                className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-extrabold text-sm shadow-xl shadow-blue-600/40 flex items-center justify-center gap-3 transition-all transform hover:scale-[1.02] active:scale-98"
              >
                <Camera className="w-5 h-5" />
                <span>MULAI PRESENSI</span>
              </button>

              <button
                type="button"
                onClick={() => requestCameraAndStart('user')}
                className="w-full sm:w-auto px-4 py-3.5 rounded-2xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 font-semibold text-xs flex items-center justify-center gap-2 transition-all"
                title="Buka menggunakan webcam depan/laptop"
              >
                <SwitchCamera className="w-4 h-4 text-cyan-400" />
                <span>Kamera Laptop / Depan</span>
              </button>
            </div>
          </div>
        )}

        {/* STATE 2: CHECKING PERMISSIONS */}
        {permissionState === 'checking' && (
          <div className="w-full max-w-md py-14 px-6 rounded-3xl bg-slate-800/40 border border-slate-700/40 text-center flex flex-col items-center">
            <div className="w-12 h-12 border-3 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mb-4" />
            <h4 className="text-sm font-bold text-white">Menghubungkan Perangkat Kamera...</h4>
            <p className="text-xs text-slate-400 mt-1 max-w-xs leading-relaxed">
              Silakan klik <strong>&quot;Izinkan&quot; (Allow)</strong> jika muncul dialog konfirmasi kamera di browser.
            </p>
          </div>
        )}

        {/* STATE 3: PERMISSION DENIED (WITH IFRAME DETECTION AND CLEAR RECOVERY OPTIONS) */}
        {permissionState === 'denied' && (
          <div className="w-full max-w-lg p-6 rounded-3xl bg-slate-800/95 border border-slate-700 text-center flex flex-col items-center shadow-2xl">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-3">
              <AlertCircle className="w-7 h-7" />
            </div>

            <h3 className="text-base sm:text-lg font-bold text-white mb-1">
              Kamera Tidak Diizinkan / Akses Dibatasi
            </h3>

            {errorMessage && (
              <div className="mb-3 px-3 py-1.5 rounded-lg bg-black/40 border border-slate-700/70 text-[11px] text-amber-300 font-mono max-w-md break-all">
                {errorMessage}
              </div>
            )}

            {/* IFRAME HELPER: If app is inside preview iframe, browser policies block webcam */}
            {isInIframe && (
              <div className="w-full bg-blue-950/40 border border-blue-500/30 rounded-2xl p-3.5 mb-4 text-left">
                <div className="flex items-start gap-2.5">
                  <ExternalLink className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-bold text-blue-300">
                      Membuka di Dalam Panel Pratinjau (iFrame)?
                    </h4>
                    <p className="text-[11px] text-slate-300 mt-0.5 leading-relaxed">
                      Kebijakan keamanan peramban (Chrome/Edge) memblokir akses webcam langsung di dalam panel pratinjau (iframe). Buka aplikasi di tab baru agar kamera dapat langsung aktif:
                    </p>
                    <a
                      href={typeof window !== 'undefined' ? window.location.href : '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 mt-2.5 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md shadow-blue-600/30 transition-all"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Buka WebApp di Tab Baru (Layar Penuh) ↗</span>
                    </a>
                  </div>
                </div>
              </div>
            )}

            {/* Instruction Steps */}
            <div className="w-full bg-slate-900/90 rounded-2xl p-4 text-left border border-slate-700/80 mb-5 space-y-2.5">
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
                  Klik salah satu tombol hubungkan kamera di bawah ini:
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center justify-center gap-2.5 w-full">
              <button
                type="button"
                onClick={() => requestCameraAndStart('environment')}
                className="px-5 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg shadow-blue-600/30 flex items-center gap-2 transition-all transform active:scale-95"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Coba Kamera Belakang</span>
              </button>

              <button
                type="button"
                onClick={() => requestCameraAndStart('user')}
                className="px-5 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/30 flex items-center gap-2 transition-all transform active:scale-95"
              >
                <Camera className="w-4 h-4" />
                <span>Coba Kamera Depan / Laptop</span>
              </button>

              {onSwitchToTable && (
                <button
                  type="button"
                  onClick={onSwitchToTable}
                  className="px-4 py-2.5 rounded-2xl bg-slate-700 hover:bg-slate-600 text-slate-200 font-semibold text-xs flex items-center gap-2 transition-all"
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
          <div className="w-full max-w-md p-6 rounded-3xl bg-slate-800/90 border border-slate-700 text-center flex flex-col items-center">
            <div className="w-14 h-14 rounded-2xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400 mb-3">
              <Camera className="w-7 h-7" />
            </div>
            <h3 className="text-base font-bold text-white mb-1">
              Kamera Tidak Ditemukan
            </h3>
            <p className="text-xs text-slate-300 mb-4 max-w-sm leading-relaxed">
              Tidak ada webcam atau lensa kamera yang terdeteksi aktif pada perangkat ini. Pastikan kamera terpasang dengan baik.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => requestCameraAndStart('user')}
                className="px-5 py-2.5 rounded-2xl bg-slate-700 hover:bg-slate-600 text-slate-200 font-bold text-xs flex items-center gap-2 transition-all"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Cek Ulang Webcam</span>
              </button>

              {onSwitchToTable && (
                <button
                  type="button"
                  onClick={onSwitchToTable}
                  className="px-4 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-2 transition-all"
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
        <div className="flex items-center gap-1.5">
          <Zap className="w-3.5 h-3.5 text-cyan-400" />
          <span>Pemindaian optik kamera otomatis dengan Web Speech API</span>
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
            Kelas:{' '}
            <strong className="text-slate-200">
              {selectedClassName || selectedClassId || 'Pilih Kelas'}
            </strong>
          </span>
        </div>
      </div>
    </div>
  );
};
