import { useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type {
  Activo,
  CatalogBranch,
  FormDataState,
  Insumo,
  InsumoTouchedState,
  ModalType,
  ToastType,
} from '../types/app';
import { createEmptyInsumoTouched } from '../utils/app';
import { buildInitialFormDataForModal } from '../utils/appHelpers';

interface UseModalStateOptions {
  activeTicketBranches: CatalogBranch[];
  canEdit: boolean;
  setShowModal: Dispatch<SetStateAction<ModalType>>;
  setFormData: Dispatch<SetStateAction<FormDataState>>;
  setEditingAssetId: Dispatch<SetStateAction<number | null>>;
  setEditingInsumoId: Dispatch<SetStateAction<number | null>>;
  setIsModalSaving: Dispatch<SetStateAction<boolean>>;
  setInsumoTouched: Dispatch<SetStateAction<InsumoTouchedState>>;
  setSelectedAsset: Dispatch<SetStateAction<Activo | null>>;
  showToast: (message: string, type?: ToastType) => void;
}

export function useModalState({
  activeTicketBranches,
  canEdit,
  setShowModal,
  setFormData,
  setEditingAssetId,
  setEditingInsumoId,
  setIsModalSaving,
  setInsumoTouched,
  setSelectedAsset,
  showToast,
}: UseModalStateOptions) {
  const updateFormData = useCallback((updates: Partial<FormDataState>) => {
    setFormData((prev) => ({ ...prev, ...updates }));
  }, [setFormData]);

  const openModal = useCallback((modal: Exclude<ModalType, null>) => {
    setEditingAssetId(null);
    setEditingInsumoId(null);
    setIsModalSaving(false);
    setInsumoTouched(createEmptyInsumoTouched());
    setFormData(buildInitialFormDataForModal(modal, activeTicketBranches[0]?.code || ''));
    setShowModal(modal);
  }, [
    activeTicketBranches,
    setEditingAssetId,
    setEditingInsumoId,
    setFormData,
    setInsumoTouched,
    setIsModalSaving,
    setShowModal,
  ]);

  const closeModal = useCallback(() => {
    setIsModalSaving(false);
    setShowModal(null);
    setEditingAssetId(null);
    setEditingInsumoId(null);
    setFormData({});
    setInsumoTouched(createEmptyInsumoTouched());
  }, [
    setEditingAssetId,
    setEditingInsumoId,
    setFormData,
    setInsumoTouched,
    setIsModalSaving,
    setShowModal,
  ]);

  const openAssetEditModal = useCallback((asset: Activo) => {
    if (!canEdit) {
      showToast('Tu rol no permite editar activos', 'warning');
      return;
    }

    setEditingInsumoId(null);
    setEditingAssetId(asset.id);
    setFormData({
      tag: asset.tag || '',
      tipo: asset.tipo || '',
      marca: asset.marca || '',
      modelo: asset.modelo || '',
      ubicacion: asset.ubicacion || '',
      serial: asset.serial || '',
      fechaCompra: asset.fechaCompra || '',
      estado: asset.estado || 'Operativo',
      idInterno: asset.idInterno || '',
      equipo: asset.equipo || asset.tipo || '',
      cpu: asset.cpu || '',
      ram: asset.ram || '',
      ramTipo: asset.ramTipo || '',
      disco: asset.disco || '',
      tipoDisco: asset.tipoDisco || '',
      macAddress: asset.macAddress || '',
      ipAddress: asset.ipAddress || '',
      responsable: asset.responsable || '',
      departamento: asset.departamento || '',
      anydesk: asset.anydesk || '',
      aniosVida: asset.aniosVida || '',
      comentarios: asset.comentarios || '',
    });
    setSelectedAsset(null);
    setShowModal('activo');
  }, [
    canEdit,
    setEditingAssetId,
    setEditingInsumoId,
    setFormData,
    setSelectedAsset,
    setShowModal,
    showToast,
  ]);

  const openInsumoEditModal = useCallback((insumo: Insumo) => {
    if (!canEdit) {
      showToast('Tu rol no permite editar insumos', 'warning');
      return;
    }

    setEditingAssetId(null);
    setEditingInsumoId(insumo.id);
    setIsModalSaving(false);
    setInsumoTouched(createEmptyInsumoTouched());
    setFormData({
      nombre: insumo.nombre || '',
      unidad: insumo.unidad || 'Piezas',
      stock: String(insumo.stock),
      min: String(insumo.min),
      categoria: insumo.categoria || '',
      ubicacionInsumo: insumo.ubicacion || '',
      proveedor: insumo.proveedor || '',
    });
    setShowModal('insumo');
  }, [
    canEdit,
    setEditingAssetId,
    setEditingInsumoId,
    setFormData,
    setInsumoTouched,
    setIsModalSaving,
    setShowModal,
    showToast,
  ]);

  return {
    updateFormData,
    openModal,
    closeModal,
    openAssetEditModal,
    openInsumoEditModal,
  };
}
