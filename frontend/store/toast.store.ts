import { create } from 'zustand';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
}

interface ToastState {
  toasts: Toast[];
  add: (type: ToastType, title: string, message?: string) => void;
  remove: (id: string) => void;
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  add: (type, title, message) => {
    const id = Math.random().toString(36).slice(2);
    set(s => ({ toasts: [...s.toasts, { id, type, title, message }] }));
    setTimeout(() => set(s => ({ toasts: s.toasts.filter(t => t.id !== id) })), 4000);
  },
  remove: (id) => set(s => ({ toasts: s.toasts.filter(t => t.id !== id) })),
}));

// Convenience helpers
export const toast = {
  success: (title: string, message?: string) => useToastStore.getState().add('success', title, message),
  error:   (title: string, message?: string) => useToastStore.getState().add('error',   title, message),
  info:    (title: string, message?: string) => useToastStore.getState().add('info',     title, message),
  warn:    (title: string, message?: string) => useToastStore.getState().add('warning',  title, message),
};
