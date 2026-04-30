import { useCallback } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { apiRequest, getApiErrorMessage } from '../../utils/api';
import type { FormDataState } from '../../types/app';

interface UseAssetActionsProps {
  onAfterBulkDelete?: () => void;
}

export function useAssetActions({ onAfterBulkDelete }: UseAssetActionsProps = {}) {
  const sessionUser = useAppStore((state) => state.sessionUser);
  const activos = useAppStore((state) => state.activos);
  const backendConnected = useAppStore((state) => state.backendConnected);
  const refreshAppData = useAppStore((state) => state.refreshAppData);
  const showToast = useAppStore((state) => state.showToast);
  const showConfirm = useAppStore((state) => state.showConfirm);

  const canManageUsers = sessionUser?.rol === 'admin';
  const isReadOnly = sessionUser?.rol !== 'admin' && sessionUser?.rol !== 'tecnico';

  const ensureBackendConnected = useCallback(
    (action: string) => {
      if (backendConnected) return true;
      showToast(`${action} requiere conexion con el backend.`, 'warning');
      return false;
    },
    [backendConnected, showToast],
  );

  const refreshData = useCallback(async () => {
    if (!refreshAppData) return;
    await refreshAppData({ silent: true, force: true });
  }, [refreshAppData]);

  const handleSaveActivo = async (formData: Partial<FormDataState>, editingAssetId: number | null): Promise<boolean> => {
    if (isReadOnly) {
      showToast('Tu rol no permite esta accion', 'warning');
      return false;
    }
    if (!ensureBackendConnected('Guardar activo')) return false;

    const isEditingAsset = editingAssetId !== null;
    const method = isEditingAsset ? 'PATCH' : 'POST';
    const path = isEditingAsset ? `/activos/${editingAssetId}` : '/activos';

    const activoPayload = {
      tag: formData.tag || '',
      tipo: formData.tipo || '',
      marca: formData.marca || '',
      modelo: formData.modelo || '',
      ubicacion: formData.ubicacion || '',
      serial: formData.serial || '',
      fechaCompra: formData.fechaCompra || '',
      estado: formData.estado || 'Operativo',
      idInterno: formData.idInterno || '',
      equipo: formData.equipo || formData.tipo || '',
      cpu: formData.cpu || '',
      ram: formData.ram || '',
      ramTipo: formData.ramTipo || '',
      disco: formData.disco || '',
      tipoDisco: formData.tipoDisco || '',
      macAddress: formData.macAddress || '',
      ipAddress: formData.ipAddress || '',
      responsable: formData.responsable || '',
      departamento: formData.departamento || '',
      anydesk: formData.anydesk || '',
      aniosVida: formData.aniosVida || '',
      comentarios: formData.comentarios || '',
    };

    try {
      await apiRequest(path, {
        method,
        body: JSON.stringify({
          ...activoPayload,
          usuario: sessionUser?.nombre || 'Admin IT',
          rol: sessionUser?.rol || 'admin',
        }),
      });
      await refreshData();
      showToast(isEditingAsset ? 'Activo actualizado' : 'Activo registrado', 'success');
      return true;
    } catch (error) {
      showToast(getApiErrorMessage(error) || 'No se pudo guardar el activo', 'error');
      return false;
    }
  };

  const eliminarActivo = async (id: number): Promise<boolean> => {
    if (isReadOnly) {
      showToast('Tu rol es solo consulta', 'warning');
      return false;
    }

    const activoToDelete = activos.find((asset) => asset.id === id);
    if (!activoToDelete) return false;

    const confirmacion = showConfirm
      ? await showConfirm(`Eliminar activo ${activoToDelete.tag}?`)
      : window.confirm(`Eliminar activo ${activoToDelete.tag}?`);
    if (!confirmacion) return false;
    if (!ensureBackendConnected('Eliminar activos')) return false;

    try {
      await apiRequest(`/activos/${id}`, {
        method: 'DELETE',
        body: JSON.stringify({
          usuario: sessionUser?.nombre || 'Admin IT',
          rol: sessionUser?.rol || 'admin',
        }),
      });
      await refreshData();
      showToast(`Activo ${activoToDelete.tag} dado de baja`, 'success');
      return true;
    } catch (error) {
      showToast(getApiErrorMessage(error) || 'No se pudo eliminar el activo', 'error');
      return false;
    }
  };

  const eliminarTodosActivos = async (): Promise<boolean> => {
    if (!canManageUsers) {
      showToast('Solo administradores pueden borrar todos los activos', 'warning');
      return false;
    }
    if (activos.length === 0) {
      showToast('No hay activos para eliminar', 'warning');
      return false;
    }

    const confirmacionInicial = showConfirm
      ? await showConfirm(`Se eliminaran ${activos.length} activos de forma permanente. Continuar?`)
      : window.confirm(`Se eliminaran ${activos.length} activos de forma permanente. Continuar?`);
    if (!confirmacionInicial) return false;
    const confirmacionFinal = showConfirm
      ? await showConfirm('Esta accion no se puede deshacer. Confirmas borrar TODO el inventario de activos IT?', { confirmLabel: 'Borrar todo' })
      : window.confirm('Esta accion no se puede deshacer. Confirmas borrar TODO el inventario de activos IT?');
    if (!confirmacionFinal) return false;
    if (!ensureBackendConnected('Eliminar el inventario completo')) return false;

    try {
      const response = await apiRequest<{ removedCount?: number }>('/activos', {
        method: 'DELETE',
        body: JSON.stringify({
          usuario: sessionUser?.nombre || 'Admin IT',
          rol: sessionUser?.rol || 'admin',
        }),
      });
      await refreshData();
      onAfterBulkDelete?.();

      const removedCount = response?.removedCount || 0;
      if (removedCount <= 0) {
        showToast('No habia activos para eliminar', 'warning');
      } else {
        showToast(`Se eliminaron ${removedCount} activos`, 'success');
      }
      return true;
    } catch (error) {
      showToast(getApiErrorMessage(error) || 'No se pudo eliminar el inventario de activos', 'error');
      return false;
    }
  };

  return {
    handleSaveActivo,
    eliminarActivo,
    eliminarTodosActivos,
  };
}
