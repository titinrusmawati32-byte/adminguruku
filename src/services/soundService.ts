/**
 * Audio feedback service for student attendance in Indonesian.
 * Produces crisp acoustic chime sound and speaks "[Nama Depan Siswa] [Status]", e.g. "Galih Hadir".
 */

class SoundService {
  private isMuted: boolean = false;
  private audioCtx: AudioContext | null = null;
  private cachedIndonesianVoice: SpeechSynthesisVoice | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('attendance_sound_enabled');
      if (saved !== null) {
        this.isMuted = saved === 'false';
      }
      this.initVoices();
    }
  }

  private initVoices(): void {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      const idVoice = voices.find(
        (v) =>
          v.lang.toLowerCase().startsWith('id') ||
          v.lang.toLowerCase().includes('indonesia') ||
          v.name.toLowerCase().includes('indonesia')
      );
      if (idVoice) {
        this.cachedIndonesianVoice = idVoice;
      }
    };
    loadVoices();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }

  public getFirstName(fullName?: string): string {
    if (!fullName) return 'Siswa';
    // Remove brackets, parentheses, dots, symbols, and take the first clean name
    const cleaned = fullName
      .replace(/\(.*?\)/g, '')
      .replace(/\[.*?\]/g, '')
      .replace(/[^a-zA-Z0-9\s]/g, '')
      .trim();
    const parts = cleaned.split(/\s+/).filter(Boolean);
    return parts[0] || 'Siswa';
  }

  public isSoundEnabled(): boolean {
    return !this.isMuted;
  }

  public setSoundEnabled(enabled: boolean): void {
    this.isMuted = !enabled;
    if (typeof window !== 'undefined') {
      localStorage.setItem('attendance_sound_enabled', enabled ? 'true' : 'false');
    }
  }

  public playChime(): void {
    if (this.isMuted || typeof window === 'undefined') return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;

      if (!this.audioCtx || this.audioCtx.state === 'closed') {
        this.audioCtx = new AudioCtx();
      }

      const ctx = this.audioCtx;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      const now = ctx.currentTime;
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = 'sine';
      osc2.type = 'triangle';

      // Harmonic D5 to A5 chime
      osc1.frequency.setValueAtTime(587.33, now);
      osc1.frequency.exponentialRampToValueAtTime(880.0, now + 0.08);

      // Sparkle D6
      osc2.frequency.setValueAtTime(880.0, now);
      osc2.frequency.exponentialRampToValueAtTime(1174.66, now + 0.1);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.25, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.32);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.33);
      osc2.stop(now + 0.33);
    } catch (e) {
      console.warn('Audio chime note:', e);
    }
  }

  /**
   * Main attendance success announcer: speaks "[Nama Depan Siswa] Hadir" in Indonesian
   */
  public speakAttendance(studentName: string, status: string = 'Hadir'): void {
    if (this.isMuted || typeof window === 'undefined') return;

    const firstName = this.getFirstName(studentName);
    const textToSpeak = `${firstName} ${status}`;

    // 1. Play immediate acoustic confirmation chime
    this.playChime();

    // 2. Announce student's first name + status in Indonesian
    if (!('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(textToSpeak);
      utterance.lang = 'id-ID';
      utterance.rate = 1.05;
      utterance.pitch = 1.0;

      if (!this.cachedIndonesianVoice) {
        const voices = window.speechSynthesis.getVoices();
        this.cachedIndonesianVoice =
          voices.find(
            (v) =>
              v.lang.toLowerCase().startsWith('id') ||
              v.lang.toLowerCase().includes('indonesia') ||
              v.name.toLowerCase().includes('indonesia')
          ) || null;
      }

      if (this.cachedIndonesianVoice) {
        utterance.voice = this.cachedIndonesianVoice;
      }

      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.warn('Speech synthesis note:', err);
    }
  }

  public speakText(text: string): void {
    if (this.isMuted || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'id-ID';
      utterance.rate = 1.05;
      utterance.pitch = 1.0;

      if (!this.cachedIndonesianVoice) {
        const voices = window.speechSynthesis.getVoices();
        this.cachedIndonesianVoice =
          voices.find(
            (v) =>
              v.lang.toLowerCase().startsWith('id') ||
              v.lang.toLowerCase().includes('indonesia') ||
              v.name.toLowerCase().includes('indonesia')
          ) || null;
      }

      if (this.cachedIndonesianVoice) {
        utterance.voice = this.cachedIndonesianVoice;
      }

      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.warn('Speech synthesis note:', err);
    }
  }
}

export const soundService = new SoundService();
