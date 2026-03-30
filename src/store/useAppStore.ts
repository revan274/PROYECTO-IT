import { create } from 'zustand';
import type { ThemeMode, ToastState, UserSession } from '../types/app';
import {
  applyThemeToDocument,
  readStoredSession,
  readStoredTheme,
  writeStoredSession,
  writeStoredTheme,
} from '../utils/app';

interface AppStore {
  sessionUser: UserSession | null;
  setSessionUser: (user: UserSession | null) => void;
  logout: () => void;
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  toast: ToastState | null;
  setToast: (toast: ToastState | null) => void;
}

export const useAppStore = create<AppStore>((set, get) => ({
  sessionUser: readStoredSession()?.user || null,
  setSessionUser: (user) => {
    if (!user) {
      writeStoredSession(null);
      set({ sessionUser: null });
      return;
    }

    const storedSession = readStoredSession();
    if (storedSession?.token) {
      writeStoredSession({
        ...storedSession,
        user,
      });
    }

    set({ sessionUser: user });
  },
  logout: () => {
    writeStoredSession(null);
    set({ sessionUser: null });
  },
  theme: readStoredTheme(),
  setTheme: (theme) => {
    writeStoredTheme(theme);
    applyThemeToDocument(theme);
    set({ theme });
  },
  toggleTheme: () => {
    const current = get().theme;
    const next = current === 'dark' ? 'light' : 'dark';
    get().setTheme(next);
  },
  sidebarOpen: false,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  toast: null,
  setToast: (toast) => set({ toast }),
}));
