import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type { Activo, AssetQrResolveResponse, ToastType } from '../types/app';
import { apiRequest, getApiErrorMessage } from '../utils/api';
import { extractSignedQrToken, toActivoFromQrLookup } from '../utils/qrTokens';

interface UseQrScannerOptions {
  activos: Activo[];
  backendConnected: boolean;
  qrManualInput: string;
  showQrScanner: boolean;
  isResolvingQr: boolean;
  setShowQrScanner: Dispatch<SetStateAction<boolean>>;
  setQrManualInput: Dispatch<SetStateAction<string>>;
  setQrScannerStatus: Dispatch<SetStateAction<string>>;
  setIsQrScannerActive: Dispatch<SetStateAction<boolean>>;
  setIsResolvingQr: Dispatch<SetStateAction<boolean>>;
  showToast: (message: string, type?: ToastType) => void;
  onAssetResolved: (asset: Activo) => void;
}

interface BarcodeDetectorLike {
  detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue?: string }>>;
}

interface BarcodeDetectorCtor {
  new (options?: { formats?: string[] }): BarcodeDetectorLike;
}

export function useQrScanner({
  activos,
  backendConnected,
  qrManualInput,
  showQrScanner,
  isResolvingQr,
  setShowQrScanner,
  setQrManualInput,
  setQrScannerStatus,
  setIsQrScannerActive,
  setIsResolvingQr,
  showToast,
  onAssetResolved,
}: UseQrScannerOptions): {
  qrScannerVideoRef: MutableRefObject<HTMLVideoElement | null>;
  isQrCameraSupported: boolean;
  resolveQrFromManualInput: () => Promise<void>;
} {
  const qrScannerVideoRef = useRef<HTMLVideoElement | null>(null);
  const qrScannerStreamRef = useRef<MediaStream | null>(null);
  const qrScannerIntervalRef = useRef<number | null>(null);
  const qrScannerBusyRef = useRef(false);

  const isQrCameraSupported = useMemo(
    () =>
      typeof window !== 'undefined'
      && typeof navigator !== 'undefined'
      && !!navigator.mediaDevices?.getUserMedia
      && 'BarcodeDetector' in window,
    [],
  );

  const stopQrCameraScan = useCallback(() => {
    if (qrScannerIntervalRef.current !== null) {
      window.clearInterval(qrScannerIntervalRef.current);
      qrScannerIntervalRef.current = null;
    }
    const stream = qrScannerStreamRef.current;
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      qrScannerStreamRef.current = null;
    }
    if (qrScannerVideoRef.current) {
      qrScannerVideoRef.current.srcObject = null;
    }
    qrScannerBusyRef.current = false;
    setIsQrScannerActive(false);
  }, [setIsQrScannerActive]);

  const resolveQrPayload = useCallback(async (rawInput: string): Promise<boolean> => {
    const raw = String(rawInput || '').trim();
    if (!raw) {
      showToast('QR vacío. Intenta de nuevo.', 'warning');
      return false;
    }

    const signedToken = extractSignedQrToken(raw);
    if (!signedToken) {
      showToast('QR no reconocido. Solo se aceptan QR firmados (mtiqr1).', 'warning');
      return false;
    }

    if (!backendConnected) {
      showToast('El QR firmado requiere backend online para validación.', 'warning');
      return false;
    }

    setIsResolvingQr(true);
    try {
      const result = await apiRequest<AssetQrResolveResponse>(`/qr/resolve/${encodeURIComponent(signedToken)}`);
      const resolvedFromApi = toActivoFromQrLookup(result.asset || {});
      if (!resolvedFromApi) {
        showToast('QR válido pero sin datos de activo.', 'warning');
        return false;
      }

      const localMatch = activos.find((asset) => Number(asset.id) === Number(resolvedFromApi.id));
      const nextAsset = localMatch || resolvedFromApi;
      onAssetResolved(nextAsset);
      showToast(`Activo ${nextAsset.tag} resuelto por QR`, 'success');
      return true;
    } catch (error) {
      showToast(getApiErrorMessage(error) || 'No se pudo resolver el QR firmado', 'error');
      return false;
    } finally {
      setIsResolvingQr(false);
    }
  }, [activos, backendConnected, onAssetResolved, setIsResolvingQr, showToast]);

  const resolveQrFromManualInput = useCallback(async () => {
    const ok = await resolveQrPayload(qrManualInput);
    if (ok) setShowQrScanner(false);
  }, [qrManualInput, resolveQrPayload, setShowQrScanner]);

  useEffect(() => {
    if (!showQrScanner) {
      stopQrCameraScan();
      setQrScannerStatus('Escanea un QR firmado (mtiqr1).');
      return;
    }

    if (!backendConnected) {
      stopQrCameraScan();
      setQrScannerStatus('La validación QR requiere backend online.');
      return;
    }

    if (!isQrCameraSupported) {
      setQrScannerStatus('Escaneo por cámara no disponible en este navegador. Usa resolución manual.');
      return;
    }

    let cancelled = false;
    setQrScannerStatus('Solicitando acceso a cámara...');

    void (async () => {
      try {
        const media = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
        if (cancelled) {
          media.getTracks().forEach((track) => track.stop());
          return;
        }

        qrScannerStreamRef.current = media;
        const video = qrScannerVideoRef.current;
        if (!video) {
          media.getTracks().forEach((track) => track.stop());
          qrScannerStreamRef.current = null;
          setQrScannerStatus('No se pudo inicializar la vista de cámara.');
          return;
        }

        video.srcObject = media;
        await video.play().catch(() => undefined);

        const detectorCtor = (window as unknown as {
          BarcodeDetector?: BarcodeDetectorCtor;
        }).BarcodeDetector;

        if (!detectorCtor) {
          setQrScannerStatus('Detector QR no disponible en este navegador.');
          return;
        }

        const detector = new detectorCtor({ formats: ['qr_code'] });
        setIsQrScannerActive(true);
        setQrScannerStatus('Apunta la cámara al QR...');

        qrScannerIntervalRef.current = window.setInterval(() => {
          void (async () => {
            const currentVideo = qrScannerVideoRef.current;
            if (!currentVideo || currentVideo.readyState < 2) return;
            if (qrScannerBusyRef.current || isResolvingQr) return;

            qrScannerBusyRef.current = true;
            try {
              const detected = await detector.detect(currentVideo);
              const rawValue = String(detected?.[0]?.rawValue || '').trim();
              if (!rawValue) return;

              setQrManualInput(rawValue);
              setQrScannerStatus('QR detectado, resolviendo...');
              stopQrCameraScan();

              const ok = await resolveQrPayload(rawValue);
              if (ok) {
                setShowQrScanner(false);
              } else {
                setQrScannerStatus('No se pudo resolver. Solo se aceptan QR firmados (mtiqr1).');
              }
            } catch {
              // Ignora errores intermitentes del detector/cámara.
            } finally {
              qrScannerBusyRef.current = false;
            }
          })();
        }, 420);
      } catch {
        setQrScannerStatus('No se pudo acceder a la cámara. Usa resolución manual.');
      }
    })();

    return () => {
      cancelled = true;
      stopQrCameraScan();
    };
  }, [
    backendConnected,
    isQrCameraSupported,
    isResolvingQr,
    resolveQrPayload,
    setIsQrScannerActive,
    setQrManualInput,
    setQrScannerStatus,
    setShowQrScanner,
    showQrScanner,
    stopQrCameraScan,
  ]);

  return {
    qrScannerVideoRef,
    isQrCameraSupported,
    resolveQrFromManualInput,
  };
}
