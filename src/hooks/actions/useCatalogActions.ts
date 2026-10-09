import { useCallback } from 'react';
import { updateTicketClassificationCatalogs } from '../../api/catalogs';
import type { TicketAreaCatalogItem, TicketCategoryCatalogItem } from '../../types/app';
import type { RefreshAppData, ShowToast } from '../../types/actionDependencies';
import { getApiErrorMessage } from '../../utils/api';

interface UseCatalogActionsProps {
  backendConnected: boolean;
  canManageCatalogs: boolean;
  refreshAppData: RefreshAppData | null;
  showToast: ShowToast;
}

export function useCatalogActions({
  backendConnected,
  canManageCatalogs,
  refreshAppData,
  showToast,
}: UseCatalogActionsProps) {
  const saveTicketClassificationCatalogs = useCallback(async (
    areas: TicketAreaCatalogItem[],
    categorias: TicketCategoryCatalogItem[],
  ): Promise<boolean> => {
    if (!canManageCatalogs) {
      showToast('Solo administradores pueden gestionar catálogos', 'warning');
      return false;
    }
    if (!backendConnected) {
      showToast('Guardar catálogos requiere conexión con el backend', 'warning');
      return false;
    }

    try {
      await updateTicketClassificationCatalogs(areas, categorias);
      await refreshAppData?.({ silent: true, force: true });
      showToast('Catálogos de tickets actualizados', 'success');
      return true;
    } catch (error) {
      showToast(getApiErrorMessage(error) || 'No se pudieron guardar los catálogos', 'error');
      return false;
    }
  }, [backendConnected, canManageCatalogs, refreshAppData, showToast]);

  return { saveTicketClassificationCatalogs };
}
