import React, { useState } from 'react';
import {
  User,
  Mail,
  Shield,
  KeyRound,
  Save,
  CheckCircle2,
  Calendar,
  Sparkles,
} from 'lucide-react';
import { Modal } from './Modal';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { authService } from '../../services/authService';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({ isOpen, onClose }) => {
  const { profile, role, refreshProfile } = useAuth();
  const { showToast } = useNotification();

  const [displayName, setDisplayName] = useState(profile?.displayName || '');
  const [email, setEmail] = useState(profile?.email || '');
  const [teacherId, setTeacherId] = useState(profile?.teacherId || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.uid) return;

    setSaving(true);
    try {
      await authService.updateUserProfile(profile.uid, {
        displayName: displayName.trim(),
        email: email.trim(),
        teacherId: teacherId.trim(),
      });
      await refreshProfile();
      showToast('Profil pengguna berhasil diperbarui!', 'success');
      onClose();
    } catch (err: any) {
      showToast('Gagal memperbarui profil: ' + err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Profil Pengguna"
      maxWidth="md"
    >
      <form onSubmit={handleSave} className="space-y-4">
        {/* Profile Card Header */}
        <div className="flex items-center gap-4 p-4 rounded-2xl bg-gradient-to-r from-[#102A50]/10 to-[#D9A62E]/10 border border-[#D9A62E]/25">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#102A50] to-[#0B1B33] border border-[#D9A62E]/40 flex items-center justify-center text-[#F2C75C] font-extrabold text-xl shadow-md shrink-0">
            {profile?.displayName?.charAt(0) || (role === 'admin' ? 'A' : 'G')}
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="font-bold text-[#102A50] dark:text-[#F5F7FC] truncate">
              {profile?.displayName || 'Nama Pengguna'}
            </h4>
            <div className="flex items-center gap-2 mt-1">
              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                role === 'admin'
                  ? 'bg-[#102A50] text-[#D9A62E] border border-[#D9A62E]/40'
                  : 'bg-[#102A50] text-[#F2C75C] border border-[#F2C75C]/40'
              }`}>
                <Shield className="w-3 h-3 text-[#D9A62E]" />
                {role === 'admin' ? 'ADMIN SEKOLAH' : 'GURU PENGAMPU'}
              </span>
              <span className="text-xs text-[#66758A] dark:text-[#B4C1D4] font-mono">
                @{profile?.username}
              </span>
            </div>
          </div>
        </div>

        {/* Form fields */}
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
              Nama Lengkap & Gelar
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
                className="w-full pl-10 pr-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Contoh: Budi Santoso, S.Pd"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
              Email Akun (Belajar.id / Pribadi)
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="nama@guru.sd.belajar.id"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
              {role === 'admin' ? 'ID Administrator' : 'NIP / ID Guru'}
            </label>
            <input
              type="text"
              value={teacherId}
              onChange={(e) => setTeacherId(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              placeholder="198501012010011001"
            />
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400 space-y-1">
            <div className="flex justify-between">
              <span>Peran Sistem:</span>
              <strong className="text-slate-800 dark:text-slate-200 uppercase">
                {role === 'admin' ? 'Admin / Pengawas' : 'Guru Operasional'}
              </strong>
            </div>
            <div className="flex justify-between">
              <span>Status Akun:</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Aktif
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1.5 shadow-sm shadow-blue-600/30 transition-all disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{saving ? 'Menyimpan...' : 'Simpan Perubahan'}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
};
