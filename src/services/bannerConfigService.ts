import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { BannerWallpaperConfig } from '../types';
import { db } from './firebase';

const LOCAL_STORAGE_KEY = 'admin_guru_banner_wallpaper_config';

export const DEFAULT_BANNER_CONFIG: BannerWallpaperConfig = {
  tagText: 'SaaS EduTech Modern 2027',
  sloganText: '"Guru Hebat, Administrasi Mudah"',
  headlineMain: 'Administrasi Guru',
  headlineAccent: 'Berbasis AI',
  subheadline:
    'Kelola administrasi guru lebih cepat, cerdas, dan terintegrasi dengan teknologi Artificial Intelligence.',
  card1Title: 'AI Assistant Guru',
  card1Badge: 'Aktif',
  card1Desc: 'Otomatisasi RPP, Presensi & Asesmen',
  card2Title: 'Analisis Akademik Pintar',
  card2Badge: '99.4% Presisi',
  card2Desc: 'Barcode QR Presensi & Evaluasi Capaian',
  wallpaperTheme: 'default',
  showPills: true,
  isVisible: true,
  customImageUrl: '',
};

class BannerConfigService {
  private listeners: Array<(config: BannerWallpaperConfig) => void> = [];

  constructor() {
    // Listen for storage events in case of multi-tab edits
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (e) => {
        if (e.key === LOCAL_STORAGE_KEY && e.newValue) {
          try {
            const parsed = JSON.parse(e.newValue);
            this.notifyListeners(parsed);
          } catch {}
        }
      });
    }
  }

  getLocalConfig(): BannerWallpaperConfig {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (stored) {
        return { ...DEFAULT_BANNER_CONFIG, ...JSON.parse(stored) };
      }
    } catch {}
    return { ...DEFAULT_BANNER_CONFIG };
  }

  async getConfig(): Promise<BannerWallpaperConfig> {
    // 1. Try local cache first for instant render
    let currentConfig = this.getLocalConfig();

    // 2. Fetch latest from Firestore
    try {
      const ref = doc(db, 'settings', 'wallpaper_banner');
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const data = snap.data() as Partial<BannerWallpaperConfig>;
        currentConfig = {
          ...DEFAULT_BANNER_CONFIG,
          ...data,
        };
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(currentConfig));
      }
    } catch (err) {
      console.warn('Using local banner wallpaper cache:', err);
    }

    return currentConfig;
  }

  async saveConfig(updates: Partial<BannerWallpaperConfig>): Promise<BannerWallpaperConfig> {
    const existing = this.getLocalConfig();
    const merged: BannerWallpaperConfig = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    // Save locally
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(merged));
    this.notifyListeners(merged);

    // Save to Firestore
    try {
      const ref = doc(db, 'settings', 'wallpaper_banner');
      await setDoc(ref, {
        ...merged,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      console.warn('Could not sync banner wallpaper to Firestore:', err);
    }

    return merged;
  }

  async resetToDefault(): Promise<BannerWallpaperConfig> {
    const def = { ...DEFAULT_BANNER_CONFIG, updatedAt: new Date().toISOString() };
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(def));
    this.notifyListeners(def);

    try {
      const ref = doc(db, 'settings', 'wallpaper_banner');
      await setDoc(ref, {
        ...def,
        updatedAt: serverTimestamp(),
      });
    } catch {}

    return def;
  }

  subscribe(listener: (config: BannerWallpaperConfig) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notifyListeners(config: BannerWallpaperConfig) {
    this.listeners.forEach((listener) => {
      try {
        listener(config);
      } catch (err) {
        console.error('Error in banner config listener:', err);
      }
    });
  }
}

export const bannerConfigService = new BannerConfigService();
