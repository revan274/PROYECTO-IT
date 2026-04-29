import { useCallback } from 'react';
import type React from 'react';
import { useAppStore } from '../../store/useAppStore';
import { apiRequest, getApiErrorMessage } from '../../utils/api';
import type { Insumo } from '../../types/app';

interface InsumoValidationResult {
  isValid: boolean;
  firstError: string;
  nombre: string;
  unidad: string;
  categoria: string;
  stock: number | null;
  min: number | null;
}

interface UseSupplyActionsProps {
  setInsumoTouched: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  getSupplyHealthStatus: (item: Insumo) => 'AGOTADO' | 'BAJO' | 'OK';
  setSupplyStockDrafts: React.Dispatch<React.SetStateAction<Record<number, string>>>;
  supplyStockDrafts: Record<number, string>;
}

export function useSupplyActions({
  setInsumoTouched,
  getSupplyHealthStatus,
  setSupplyStockDrafts,
  supplyStockDrafts,
}: UseSupplyActionsProps) {
  const sessionUser = useAppStore((state) => state.sessionUser);
  const insumos = useAppStore((state) => state.insumos);
  const backendConnected = useAppStore((state) => state.backendConnected);
  const refreshAppData = useAppStore((state) => state.refreshAppData);
  const showToast = useAppStore((state) => state.showToast);

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

  const handleSaveInsumo = async (
    validation: InsumoValidationResult,
    editingInsumoId: number | null,
  ): Promise<boolean> => {
    setInsumoTouched({
      nombre: true,
      unidad: true,
      stock: true,
      min: true,
      categoria: true,
    });

    if (isReadOnly) {
      showToast('Tu rol no permite esta accion', 'warning');
      return false;
    }
    if (!validation.isValid) {
      showToast(validation.firstError || 'Completa los campos requeridos', 'warning');
      return false;
    }
    if (!ensureBackendConnected('Guardar insumo')) return false;

    const { nombre, unidad, categoria, stock, min } = validation;
    const isEditingInsumo = editingInsumoId !== null;

    try {
      await apiRequest(isEditingInsumo ? `/insumos/${editingInsumoId}` : '/insumos', {
        method: isEditingInsumo ? 'PATCH' : 'POST',
        body: JSON.stringify({
          nombre,
          unidad,
          stock,
          min,
          categoria,
          usuario: sessionUser?.nombre || 'Admin IT',
          rol: sessionUser?.rol || 'admin',
        }),
      });

      await refreshData();
      showToast(isEditingInsumo ? 'Insumo actualizado' : 'Insumo añadido', 'success');
      return true;
    } catch (error) {
      showToast(getApiErrorMessage(error) || 'No se pudo guardar el insumo', 'error');
      return false;
    }
  };

  const eliminarInsumo = async (id: number): Promise<boolean> => {
    if (isReadOnly) {
      showToast('Tu rol es solo consulta', 'warning');
      return false;
    }

    const itemToDelete = insumos.find((item) => item.id === id);
    if (!itemToDelete) return false;

    const confirmacion = window.confirm(`Estas seguro de eliminar "${itemToDelete.nombre}"?`);
    if (!confirmacion) return false;
    if (!ensureBackendConnected('Eliminar insumos')) return false;

    try {
      await apiRequest(`/insumos/${id}`, {
        method: 'DELETE',
        body: JSON.stringify({
          usuario: sessionUser?.nombre || 'Admin IT',
          rol: sessionUser?.rol || 'admin',
        }),
      });

      await refreshData();
      showToast('Insumo eliminado', 'success');
      return true;
    } catch (error) {
      showToast(getApiErrorMessage(error) || 'No se pudo eliminar el insumo', 'error');
      return false;
    }
  };

  const ajustarStock = async (id: number, cantidad: number) => {
    setSupplyStockDrafts((prev) => {
      if (!(id in prev)) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });

    if (isReadOnly) {
      showToast('Tu rol es solo consulta', 'warning');
      return;
    }
    if (!ensureBackendConnected('Actualizar stock')) return;

    const motivo = window.prompt(`Motivo del ajuste ${cantidad > 0 ? '+' : ''}${cantidad} (Opcional):`);

    try {
      await apiRequest(`/insumos/${id}/stock`, {
        method: 'PATCH',
        body: JSON.stringify({
          delta: cantidad,
          motivo: motivo || undefined,
          usuario: sessionUser?.nombre || 'Admin IT',
          rol: sessionUser?.rol || 'admin',
        }),
      });
      await refreshData();
    } catch (error) {
      showToast(getApiErrorMessage(error) || 'No se pudo actualizar el stock', 'error');
    }
  };

  const reponerCriticos = async (cantidad = 5) => {
    if (isReadOnly) {
      showToast('Tu rol es solo consulta', 'warning');
      return;
    }

    const target = insumos.filter((item) => getSupplyHealthStatus(item) !== 'OK');
    if (target.length === 0) {
      showToast('No hay insumos criticos para reponer', 'warning');
      return;
    }
    if (!ensureBackendConnected('Reponer insumos')) return;

    const results = await Promise.allSettled(
      target.map((item) =>
        apiRequest(`/insumos/${item.id}/stock`, {
          method: 'PATCH',
          body: JSON.stringify({
            delta: cantidad,
            usuario: sessionUser?.nombre || 'Admin IT',
            rol: sessionUser?.rol || 'admin',
          }),
        }),
      ),
    );

    const succeeded = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.length - succeeded;

    await refreshData();

    if (failed === 0) {
      showToast(`Reposicion aplicada a ${succeeded} insumos criticos`, 'success');
    } else if (succeeded === 0) {
      showToast('No se pudo reponer ningún insumo critico', 'error');
    } else {
      showToast(`Reposicion parcial: ${succeeded} ok, ${failed} fallaron`, 'warning');
    }
  };

  const establecerStockManual = async (id: number, valor: string): Promise<boolean> => {
    if (isReadOnly) {
      showToast('Tu rol es solo consulta', 'warning');
      return false;
    }

    const value = parseInt(valor, 10);
    if (!Number.isFinite(value) || value < 0) {
      showToast('El stock debe ser 0 o mayor', 'warning');
      return false;
    }
    if (!ensureBackendConnected('Actualizar stock manual')) return false;

    const motivo = window.prompt(`Motivo de ajuste manual a ${value} (Opcional):`);

    try {
      await apiRequest(`/insumos/${id}/stock`, {
        method: 'PATCH',
        body: JSON.stringify({
          stock: value,
          motivo: motivo || undefined,
          usuario: sessionUser?.nombre || 'Admin IT',
          rol: sessionUser?.rol || 'admin',
        }),
      });
      await refreshData();
      return true;
    } catch (error) {
      showToast(getApiErrorMessage(error) || 'No se pudo actualizar el stock manual', 'error');
      return false;
    }
  };

  const confirmarStockManual = async (id: number) => {
    const draft = supplyStockDrafts[id];
    if (draft === undefined) return;

    const item = insumos.find((supply) => supply.id === id);
    const clearDraft = () =>
      setSupplyStockDrafts((prev) => {
        if (!(id in prev)) return prev;
        const next = { ...prev };
        delete next[id];
        return next;
      });

    if (!item) {
      clearDraft();
      return;
    }

    const normalized = draft.trim();
    if (!normalized) {
      clearDraft();
      return;
    }

    const parsed = Number(normalized);
    if (!Number.isFinite(parsed) || parsed < 0) {
      showToast('Ingresa un stock válido (0 o mayor)', 'warning');
      clearDraft();
      return;
    }

    const nextStock = String(Math.trunc(parsed));
    if (nextStock === String(item.stock)) {
      clearDraft();
      return;
    }

    const updated = await establecerStockManual(id, nextStock);
    if (updated) clearDraft();
  };

  return {
    handleSaveInsumo,
    eliminarInsumo,
    ajustarStock,
    reponerCriticos,
    confirmarStockManual,
  };
}
