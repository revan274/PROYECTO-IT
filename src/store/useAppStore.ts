import { create } from 'zustand';
import type {
  Activo,
  CatalogState,
  RegistroAuditoria,
  StoredSession,
  ThemeMode,
  ToastState,
  UserItem,
  UserSession,
  Insumo,
  TicketItem,
} from '../types/app';
import { DEFAULT_CATALOGS } from '../constants/app';
import {
  applyThemeToDocument,
  readStoredSession,
  readStoredTheme,
  writeStoredSession,
  writeStoredTheme,
} from '../utils/app';

type StoreUpdater<T> = T | ((prev: T) => T);
type RefreshAppDataFn = (options?: boolean | { silent?: boolean; force?: boolean }) => Promise<void>;
export type ShowConfirmFn = (message: string, options?: { title?: string; confirmLabel?: string }) => Promise<boolean>;
export type ShowPromptFn = (message: string, options?: { title?: string; defaultValue?: string }) => Promise<string | null>;

const resolveUpdater = <T>(value: StoreUpdater<T>, prev: T): T =>
  typeof value === 'function' ? (value as (prev: T) => T)(prev) : value;

interface AppStore {
  sessionUser: UserSession | null;
  setStoredSession: (session: StoredSession | null) => void;
  setSessionUser: (user: UserSession | null) => void;
  logout: () => void;
  globalSearchTerm: string;
  setGlobalSearchTerm: (term: string) => void;
  clearGlobalSearchTerm: () => void;
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  activos: Activo[];
  setActivos: (value: StoreUpdater<Activo[]>) => void;
  insumos: Insumo[];
  setInsumos: (value: StoreUpdater<Insumo[]>) => void;
  tickets: TicketItem[];
  setTickets: (value: StoreUpdater<TicketItem[]>) => void;
  users: UserItem[];
  setUsers: (value: StoreUpdater<UserItem[]>) => void;
  catalogos: CatalogState;
  setCatalogos: (value: StoreUpdater<CatalogState>) => void;
  auditoria: RegistroAuditoria[];
  setAuditoria: (value: StoreUpdater<RegistroAuditoria[]>) => void;
  setCoreData: (payload: {
    activos?: Activo[];
    insumos?: Insumo[];
    tickets?: TicketItem[];
    users?: UserItem[];
    catalogos?: CatalogState;
    auditoria?: RegistroAuditoria[];
  }) => void;
  resetCoreData: () => void;
  isSyncing: boolean;
  setIsSyncing: (value: boolean) => void;
  backendConnected: boolean;
  setBackendConnected: (value: boolean) => void;
  lastSync: string | null;
  setLastSync: (value: string | null) => void;
  resetSyncStatus: () => void;
  refreshAppData: RefreshAppDataFn | null;
  setRefreshAppData: (handler: RefreshAppDataFn | null) => void;
  showConfirm: ShowConfirmFn | null;
  setShowConfirm: (handler: ShowConfirmFn | null) => void;
  showPrompt: ShowPromptFn | null;
  setShowPrompt: (handler: ShowPromptFn | null) => void;
  toast: ToastState | null;
  setToast: (toast: ToastState | null) => void;
  showToast: (message: string, type?: ToastState['type']) => void;
  clearToast: () => void;
}

export const useAppStore = create<AppStore>((set, get) => ({
  sessionUser: readStoredSession()?.user || null,
  setStoredSession: (session) => {
    writeStoredSession(session);
    set({ sessionUser: session?.user || null });
  },
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
    get().setStoredSession(null);
  },
  globalSearchTerm: '',
  setGlobalSearchTerm: (term) => set({ globalSearchTerm: term }),
  clearGlobalSearchTerm: () => set({ globalSearchTerm: '' }),
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
  activos: [],
  setActivos: (value) => set((state) => ({ activos: resolveUpdater(value, state.activos) })),
  insumos: [],
  setInsumos: (value) => set((state) => ({ insumos: resolveUpdater(value, state.insumos) })),
  tickets: [],
  setTickets: (value) => set((state) => ({ tickets: resolveUpdater(value, state.tickets) })),
  users: [],
  setUsers: (value) => set((state) => ({ users: resolveUpdater(value, state.users) })),
  catalogos: DEFAULT_CATALOGS,
  setCatalogos: (value) => set((state) => ({ catalogos: resolveUpdater(value, state.catalogos) })),
  auditoria: [],
  setAuditoria: (value) => set((state) => ({ auditoria: resolveUpdater(value, state.auditoria) })),
  setCoreData: (payload) =>
    set((state) => ({
      activos: payload.activos ?? state.activos,
      insumos: payload.insumos ?? state.insumos,
      tickets: payload.tickets ?? state.tickets,
      users: payload.users ?? state.users,
      catalogos: payload.catalogos ?? state.catalogos,
      auditoria: payload.auditoria ?? state.auditoria,
    })),
  resetCoreData: () =>
    set({
      activos: [],
      insumos: [],
      tickets: [],
      users: [],
      catalogos: DEFAULT_CATALOGS,
      auditoria: [],
    }),
  isSyncing: false,
  setIsSyncing: (value) => set({ isSyncing: value }),
  backendConnected: false,
  setBackendConnected: (value) => set({ backendConnected: value }),
  lastSync: null,
  setLastSync: (value) => set({ lastSync: value }),
  resetSyncStatus: () => set({ isSyncing: false, backendConnected: false, lastSync: null }),
  refreshAppData: null,
  setRefreshAppData: (handler) => set({ refreshAppData: handler }),
  showConfirm: null,
  setShowConfirm: (handler) => set({ showConfirm: handler }),
  showPrompt: null,
  setShowPrompt: (handler) => set({ showPrompt: handler }),
  toast: null,
  setToast: (toast) => set({ toast }),
  showToast: (message, type = 'success') => set({ toast: { message, type } }),
  clearToast: () => set({ toast: null }),
}));
