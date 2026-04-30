import { useCallback, useEffect, useRef, useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import type { ShowConfirmFn, ShowPromptFn } from '../store/useAppStore';

interface ConfirmState {
  message: string;
  title?: string;
  confirmLabel?: string;
  resolve: (value: boolean) => void;
}

interface PromptState {
  message: string;
  title?: string;
  defaultValue?: string;
  resolve: (value: string | null) => void;
}

export interface DialogsState {
  confirmState: ConfirmState | null;
  promptState: PromptState | null;
  onConfirmAccept: () => void;
  onConfirmCancel: () => void;
  onPromptAccept: (value: string) => void;
  onPromptCancel: () => void;
}

export function useDialogs(): DialogsState {
  const setShowConfirm = useAppStore((s) => s.setShowConfirm);
  const setShowPrompt = useAppStore((s) => s.setShowPrompt);

  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const [promptState, setPromptState] = useState<PromptState | null>(null);

  const confirmResolveRef = useRef<((v: boolean) => void) | null>(null);
  const promptResolveRef = useRef<((v: string | null) => void) | null>(null);

  const showConfirm = useCallback<ShowConfirmFn>((message, options) => {
    return new Promise<boolean>((resolve) => {
      confirmResolveRef.current = resolve;
      setConfirmState({ message, title: options?.title, confirmLabel: options?.confirmLabel, resolve });
    });
  }, []);

  const showPrompt = useCallback<ShowPromptFn>((message, options) => {
    return new Promise<string | null>((resolve) => {
      promptResolveRef.current = resolve;
      setPromptState({ message, title: options?.title, defaultValue: options?.defaultValue, resolve });
    });
  }, []);

  useEffect(() => {
    setShowConfirm(showConfirm);
    return () => setShowConfirm(null);
  }, [showConfirm, setShowConfirm]);

  useEffect(() => {
    setShowPrompt(showPrompt);
    return () => setShowPrompt(null);
  }, [showPrompt, setShowPrompt]);

  const onConfirmAccept = useCallback(() => {
    confirmResolveRef.current?.(true);
    setConfirmState(null);
  }, []);

  const onConfirmCancel = useCallback(() => {
    confirmResolveRef.current?.(false);
    setConfirmState(null);
  }, []);

  const onPromptAccept = useCallback((value: string) => {
    promptResolveRef.current?.(value);
    setPromptState(null);
  }, []);

  const onPromptCancel = useCallback(() => {
    promptResolveRef.current?.(null);
    setPromptState(null);
  }, []);

  return { confirmState, promptState, onConfirmAccept, onConfirmCancel, onPromptAccept, onPromptCancel };
}
