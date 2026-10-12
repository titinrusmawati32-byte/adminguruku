import Swal from 'sweetalert2';

// Custom SweetAlert2 Toast configuration
const Toast = Swal.mixin({
  toast: true,
  position: 'top-end',
  showConfirmButton: false,
  timer: 3000,
  timerProgressBar: true,
  didOpen: (toast) => {
    toast.onmouseenter = Swal.stopTimer;
    toast.onmouseleave = Swal.resumeTimer;
  },
  customClass: {
    popup: 'rounded-2xl shadow-xl font-sans text-xs border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100',
  },
});

export const notifySimpanSuccess = (message: string, title: string = 'Berhasil Disimpan') => {
  return Toast.fire({
    icon: 'success',
    title: message || title,
  });
};

export const notifySimpanError = (message: string, title: string = 'Gagal') => {
  return Toast.fire({
    icon: 'error',
    title: message || title,
  });
};

export const notifyConfirm = async (title: string, text: string) => {
  const result = await Swal.fire({
    title,
    text,
    icon: 'question',
    showCancelButton: true,
    confirmButtonColor: '#2563eb',
    cancelButtonColor: '#64748b',
    confirmButtonText: 'Ya, Lanjutkan',
    cancelButtonText: 'Batal',
    customClass: {
      popup: 'rounded-2xl shadow-2xl font-sans text-sm',
    },
  });
  return result.isConfirmed;
};
