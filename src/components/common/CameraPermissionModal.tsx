import {
  AlertCircle,
  Camera,
  CheckCircle2,
  ExternalLink,
  HelpCircle,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  SwitchCamera,
  X,
  Zap,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';

interface CameraPermissionModalProps {
  forceOpen?: boolean;
  onClose?: () => void;
  onSuccess?: () => void;
}

export const CameraPermissionModal: React.FC<CameraPermissionModalProps> = ({
  forceOpen = false,
  onClose,
  onSuccess,
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [status, setStatus] = useState<
    'idle' | 'requesting' | 'granted' | 'denied' | 'unsupported'
  >('idle');
  const [errorDetails, setErrorDetails] = useState<string>('');
  const [isInIframe, setIsInIframe] = useState<boolean>(false);

  // Check if running in iframe on mount
  useEffect(() => {
    try {
      setIsInIframe(window.self !== window.top);
    } catch {
      setIsInIframe(true);
    }
  }, []);

  // Determine if modal should open automatically on startup
  useEffect(() => {
    if (forceOpen) {
      setIsOpen(true);
      return;
    }

    // Check if permission was already granted or asked previously
    const existingConsent = localStorage.getItem('admin_guru_camera_consented');
    if (!existingConsent) {
      // First-time visit: show prompt at startup
      const timer = setTimeout(() => {
        setIsOpen(true);
      }, 500);
      return () => clearTimeout(timer);
    } else if (existingConsent === 'granted') {
      // Already granted
      setStatus('granted');
    }
  }, [forceOpen]);

  // Listen for custom event so any page can open this modal
  useEffect(() => {
    const handleOpenEvent = () => {
      setIsOpen(true);
      setStatus('idle');
      setErrorDetails('');
    };
    window.addEventListener('open-camera-permission-modal', handleOpenEvent);
    return () => {
      window.removeEventListener('open-camera-permission-modal', handleOpenEvent);
    };
  }, []);

  const handleRequestCamera = async (facingMode: 'environment' | 'user' = 'environment') => {
    setStatus('requesting');
    setErrorDetails('');

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setStatus('unsupported');
      setErrorDetails('Peramban ini tidak mendukung API kamera web (MediaDevices API).');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });

      // Stop tracks immediately so camera hardware indicator doesn't remain lit
      stream.getTracks().forEach((track) => track.stop());

      localStorage.setItem('admin_guru_camera_consented', 'granted');
      setStatus('granted');

      // Dispatch global event for instant camera startup across pages
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('admin-guru-camera-granted'));
      }

      if (onSuccess) onSuccess();

      // Close swiftly after brief 400ms confirmation (no lagging delay)
      setTimeout(() => {
        setIsOpen(false);
        if (onClose) onClose();
      }, 400);
    } catch (err: any) {
      console.warn('Camera request user error:', err);
      const name = err?.name || '';
      const message = err?.message || String(err);

      let cleanMessage = message;
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError' || message.includes('denied')) {
        cleanMessage =
          'Izin kamera belum diberikan atau diblokir oleh browser. Anda dapat mengizinkannya melalui ikon pengaturan URL atau membuka di tab baru.';
      } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
        cleanMessage = 'Tidak ada perangkat kamera / webcam yang terdeteksi di perangkat ini.';
      } else if (name === 'NotReadableError' || name === 'TrackStartError') {
        cleanMessage =
          'Kamera sedang aktif digunakan aplikasi lain. Tutup aplikasi tersebut lalu coba lagi.';
      }

      setErrorDetails(cleanMessage);
      setStatus('denied');
    }
  };

  const handleDismiss = () => {
    localStorage.setItem('admin_guru_camera_consented', 'dismissed');
    setIsOpen(false);
    if (onClose) onClose();
  };

  const handleOpenInNewTab = () => {
    if (typeof window !== 'undefined') {
      window.open(window.location.href, '_blank');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-white dark:bg-[#0A182E] text-slate-800 dark:text-slate-100 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden p-6 sm:p-8">
        {/* Ambient Top Glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-2 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500" />
        <div className="absolute -top-20 -right-20 w-44 h-44 bg-blue-500/10 dark:bg-blue-500/20 rounded-full blur-2xl pointer-events-none" />

        {/* Close button */}
        <button
          onClick={handleDismiss}
          className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          aria-label="Tutup"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header Icon */}
        <div className="flex items-center gap-4 mb-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-xl shadow-blue-500/25 shrink-0">
            {status === 'granted' ? (
              <CheckCircle2 className="w-8 h-8 text-emerald-300 animate-bounce" />
            ) : status === 'requesting' ? (
              <RefreshCw className="w-7 h-7 text-white animate-spin" />
            ) : (
              <Camera className="w-7 h-7 text-white animate-pulse" />
            )}
          </div>
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 mb-1">
              <Sparkles className="w-3 h-3 text-amber-500" />
              <span>Presensi Siswa Otomatis</span>
            </div>
            <h2 className="text-lg sm:text-xl font-black tracking-tight text-slate-900 dark:text-white">
              Persetujuan Akses Kamera
            </h2>
          </div>
        </div>

        {/* Dynamic Body Content */}
        {status === 'idle' && (
          <div className="space-y-4">
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              Aplikasi <strong>ADMIN GURU</strong> membutuhkan izin akses kamera web untuk fitur pemindaian kartu <strong>QR & Barcode presensi siswa</strong> secara instan dan tanpa sentuh.
            </p>

            {/* Feature Highlights */}
            <div className="space-y-2.5 bg-slate-50 dark:bg-slate-900/80 p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 text-xs">
              <div className="flex items-start gap-2.5">
                <Zap className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <span className="text-slate-700 dark:text-slate-300">
                  <strong>Pemindaian Cepat:</strong> Kamera mendeteksi QR kartu siswa secara terus-menerus dan otomatis mencatat kehadiran.
                </span>
              </div>
              <div className="flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <span className="text-slate-700 dark:text-slate-300">
                  <strong>Privasi Aman:</strong> Gambar hanya diproses langsung di peramban lokal perangkat Anda. Tidak ada video yang direkam atau dikirim ke internet.
                </span>
              </div>
            </div>

            {/* If in iframe, hint that opening in new tab is available */}
            {isInIframe && (
              <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60 text-[11px] text-blue-800 dark:text-blue-300 flex items-center justify-between gap-2">
                <span>Berjalan di panel pratinjau? Buka di tab baru jika kamera terhalang kebijakan peramban.</span>
                <button
                  type="button"
                  onClick={handleOpenInNewTab}
                  className="shrink-0 px-2.5 py-1 rounded-lg bg-blue-600 text-white font-bold text-[10px] hover:bg-blue-500 transition-colors cursor-pointer"
                >
                  Tab Baru ↗
                </button>
              </div>
            )}

            {/* Action Buttons */}
            <div className="pt-2 flex flex-col sm:flex-row gap-2.5">
              <button
                type="button"
                onClick={() => handleRequestCamera('environment')}
                className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-extrabold text-xs sm:text-sm shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 transition-transform active:scale-98 cursor-pointer"
              >
                <Camera className="w-4 h-4" />
                <span>IZINKAN AKSES KAMERA</span>
              </button>
              <button
                type="button"
                onClick={handleDismiss}
                className="py-3 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs transition-colors cursor-pointer"
              >
                Nanti Saja
              </button>
            </div>
          </div>
        )}

        {status === 'requesting' && (
          <div className="py-6 text-center space-y-3">
            <div className="w-12 h-12 border-3 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mx-auto" />
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Menghubungkan ke Kamera...
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
              Silakan klik <strong>&quot;Izinkan&quot; (Allow)</strong> pada dialog peramban Anda untuk mengaktifkan izin kamera.
            </p>
          </div>
        )}

        {status === 'granted' && (
          <div className="py-6 text-center space-y-3">
            <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950/60 border-2 border-emerald-500 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/20">
              <CheckCircle2 className="w-10 h-10 animate-scale" />
            </div>
            <h3 className="text-lg font-black text-emerald-600 dark:text-emerald-400">
              Akses Kamera Berhasil Diaktifkan!
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 max-w-sm mx-auto">
              Fitur Presensi Siswa kini siap digunakan untuk memindai kartu QR secara langsung.
            </p>
          </div>
        )}

        {status === 'denied' && (
          <div className="space-y-4">
            <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="block font-bold">Izin Kamera Belum Diberikan</strong>
                  <span className="text-[11px] mt-0.5 block leading-relaxed">
                    {errorDetails || 'Peramban menolak izin kamera atau akses terhalang setelan sistem.'}
                  </span>
                </div>
              </div>
            </div>

            {/* Guide to unblock */}
            <div className="bg-slate-50 dark:bg-slate-900/80 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs space-y-2">
              <span className="font-bold text-slate-800 dark:text-slate-200 block">
                Solusi Cepat Mengatasi Izin Kamera:
              </span>
              <ol className="list-decimal list-inside space-y-1 text-[11px] text-slate-600 dark:text-slate-400">
                <li>Klik tombol <strong>&quot;Buka di Tab Baru&quot;</strong> di bawah untuk membuka aplikasi di luar bingkai pratinjau.</li>
                <li>Pada bilah alamat (URL), klik ikon gembok / kamera 🔒 / 📷 lalu ubah Camera ke <strong>&quot;Izinkan&quot; (Allow)</strong>.</li>
                <li>Muat ulang (refresh) halaman lalu tekan Coba Lagi.</li>
              </ol>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-2 pt-1">
              <button
                type="button"
                onClick={handleOpenInNewTab}
                className="flex-1 py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-blue-600/30 cursor-pointer"
              >
                <ExternalLink className="w-4 h-4" />
                <span>Buka di Tab Baru (Layar Penuh)</span>
              </button>
              <button
                type="button"
                onClick={() => handleRequestCamera('user')}
                className="py-3 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                title="Coba kamera depan"
              >
                <SwitchCamera className="w-3.5 h-3.5" />
                <span>Kamera Depan</span>
              </button>
              <button
                type="button"
                onClick={handleDismiss}
                className="py-3 px-3 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        )}

        {status === 'unsupported' && (
          <div className="space-y-4">
            <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200 text-xs">
              <p className="font-bold">Peramban Tidak Mendukung Kamera</p>
              <p className="text-[11px] mt-1">{errorDetails}</p>
            </div>
            <button
              type="button"
              onClick={handleDismiss}
              className="w-full py-2.5 rounded-xl bg-slate-800 text-white text-xs font-bold cursor-pointer"
            >
              Mengerti & Lanjutkan
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export const triggerCameraPermissionModal = () => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('open-camera-permission-modal'));
  }
};
