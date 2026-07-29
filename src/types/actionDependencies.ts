import type {
  StoredSession,
  TicketItem,
  ToastState,
} from './app';

export type StateUpdater<T> = T | ((previous: T) => T);

export type RefreshAppData = (
  options?: boolean | { silent?: boolean; force?: boolean }
) => Promise<void>;

export type ShowToast = (
  message: string,
  type?: ToastState['type']
) => void;

export type ShowConfirm = (
  message: string,
  options?: { title?: string; confirmLabel?: string }
) => Promise<boolean>;

export type ShowPrompt = (
  message: string,
  options?: { title?: string; defaultValue?: string }
) => Promise<string | null>;

export type SetTickets = (value: StateUpdater<TicketItem[]>) => void;
export type SetStoredSession = (session: StoredSession | null) => void;
