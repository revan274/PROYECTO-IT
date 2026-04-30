import { useCallback } from 'react';
import type React from 'react';
import { CLIENT_ATTACHMENT_MAX_BYTES, CLIENT_ATTACHMENT_MAX_COUNT } from '../../constants/app';
import type {
  FormDataState,
  TicketAttachment,
  TicketAttentionType,
  TicketEstado,
  TicketItem,
} from '../../types/app';
import { useAppStore } from '../../store/useAppStore';
import { ApiError, apiRequest, getApiErrorMessage } from '../../utils/api';
import { buildApiUrl, getStoredSessionToken } from '../../utils/app';
import { ticketBelongsToSessionUser } from '../../utils/appHelpers';
import {
  buildTicketDescription,
  buildTicketHistoryEntry,
  normalizeTicketAttentionType,
  normalizeTicketTravelRequired,
} from '../../utils/tickets';

interface UseTicketActionsProps {
  canEdit: boolean;
  canCreateTickets: boolean;
  canCreateComments: boolean;
  isValidTicketBranchValue: (val?: string) => boolean;
  ticketAssetOptionsCount: number;
  ticketAssetOptionsIncludes: (tag: string) => boolean;
  setTicketCommentDrafts: React.Dispatch<React.SetStateAction<Record<number, string>>>;
  ticketCommentDrafts: Record<number, string>;
  setTicketAttachmentLoadingId: React.Dispatch<React.SetStateAction<number | null>>;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const payload = result.includes(',') ? result.split(',')[1] : result;
      if (!payload) {
        reject(new Error('No se pudo leer el archivo'));
        return;
      }
      resolve(payload);
    };
    reader.onerror = () => reject(reader.error || new Error('No se pudo leer el archivo'));
    reader.readAsDataURL(file);
  });
}

export function useTicketActions({
  canEdit,
  canCreateTickets,
  canCreateComments,
  isValidTicketBranchValue,
  ticketAssetOptionsCount,
  ticketAssetOptionsIncludes,
  setTicketCommentDrafts,
  ticketCommentDrafts,
  setTicketAttachmentLoadingId,
}: UseTicketActionsProps) {
  const sessionUser = useAppStore((state) => state.sessionUser);
  const backendConnected = useAppStore((state) => state.backendConnected);
  const refreshAppData = useAppStore((state) => state.refreshAppData);
  const showToast = useAppStore((state) => state.showToast);
  const showConfirm = useAppStore((state) => state.showConfirm);
  const tickets = useAppStore((state) => state.tickets);
  const setTickets = useAppStore((state) => state.setTickets);

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

  const canAccessTicketBySession = useCallback(
    (ticket: TicketItem) => ticketBelongsToSessionUser(ticket, sessionUser),
    [sessionUser],
  );

  const canDeleteTicket = useCallback(
    (ticket: TicketItem) => {
      if (canEdit) return true;
      if (sessionUser?.rol !== 'solicitante') return false;
      if (!canAccessTicketBySession(ticket)) return false;
      return ticket.estado === 'Abierto';
    },
    [canAccessTicketBySession, canEdit, sessionUser?.rol],
  );

  const handleCreateTicket = async (formData: Partial<FormDataState>): Promise<boolean> => {
    if (!canCreateTickets) {
      showToast('Tu rol no permite crear tickets', 'warning');
      return false;
    }

    const activoTag = String(formData.activoTag || '').trim().toUpperCase();
    const sucursal = String(formData.sucursal || '').trim().toUpperCase();
    const areaAfectada = String(formData.areaAfectada || '').trim();
    const atencionTipo = normalizeTicketAttentionType(formData.atencionTipo);
    const trasladoRequerido = normalizeTicketTravelRequired(formData.trasladoRequerido) === true;
    const descripcionBase = String(formData.descripcion || '').trim();
    const prioridad = formData.prioridad || 'MEDIA';

    const ticketValidationError = !isValidTicketBranchValue(sucursal)
      ? 'Selecciona una sucursal valida para el ticket'
      : ticketAssetOptionsCount === 0
        ? 'No hay activos registrados en la sucursal seleccionada'
        : !activoTag
          ? 'Selecciona un TAG del equipo'
          : !ticketAssetOptionsIncludes(activoTag)
            ? 'Selecciona un TAG valido para la sucursal elegida'
            : !areaAfectada
              ? 'Selecciona area afectada'
              : !atencionTipo
                ? 'Selecciona el tipo de atencion del ticket'
                : !descripcionBase
                  ? 'Agrega la descripcion de la falla'
                  : '';

    if (ticketValidationError) {
      showToast(ticketValidationError, 'warning');
      return false;
    }
    if (!ensureBackendConnected('Crear tickets')) return false;

    const descripcionFinal = buildTicketDescription(areaAfectada, descripcionBase);

    try {
      await apiRequest('/tickets', {
        method: 'POST',
        body: JSON.stringify({
          activoTag,
          descripcion: descripcionFinal,
          sucursal,
          prioridad,
          atencionTipo,
          trasladoRequerido,
          asignadoA: canEdit ? (formData.asignadoA || '') : '',
        }),
      });
      await refreshData();
      showToast('Ticket creado', 'success');
      return true;
    } catch (error) {
      showToast(getApiErrorMessage(error) || 'No se pudo crear el ticket', 'error');
      return false;
    }
  };

  const actualizarTicket = async (
    ticketId: number,
    updates: {
      estado?: TicketEstado;
      asignadoA?: string;
      comentario?: string;
      atencionTipo?: TicketAttentionType;
      trasladoRequerido?: boolean;
    },
  ): Promise<boolean> => {
    if (!canEdit) {
      showToast('Tu rol no permite editar tickets', 'warning');
      return false;
    }
    if (!ensureBackendConnected('Actualizar tickets')) return false;

    try {
      await apiRequest(`/tickets/${ticketId}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      });
      await refreshData();
      showToast('Ticket actualizado', 'success');
      return true;
    } catch (error) {
      showToast(getApiErrorMessage(error) || 'No se pudo actualizar el ticket', 'error');
      return false;
    }
  };

  const resolverTicket = async (id: number): Promise<boolean> => {
    if (!canEdit) {
      showToast('Tu rol no permite resolver tickets', 'warning');
      return false;
    }
    if (!ensureBackendConnected('Resolver tickets')) return false;

    try {
      await apiRequest(`/tickets/${id}/resolve`, {
        method: 'PATCH',
      });
      await refreshData();
      showToast('Ticket cerrado', 'success');
      return true;
    } catch (error) {
      showToast(getApiErrorMessage(error) || 'No se pudo cerrar el ticket', 'error');
      return false;
    }
  };

  const agregarComentarioTicket = async (id: number): Promise<boolean> => {
    if (!canCreateComments) {
      showToast('Tu rol no permite comentar tickets', 'warning');
      return false;
    }

    const comentario = String(ticketCommentDrafts[id] || '').trim();
    if (!comentario) {
      showToast('Escribe un comentario para guardar', 'warning');
      return false;
    }

    const target = tickets.find((ticket) => ticket.id === id);
    if (!target) return false;
    if (!canAccessTicketBySession(target)) {
      showToast('Solo puedes comentar tus propios tickets', 'warning');
      return false;
    }
    if (!ensureBackendConnected('Agregar comentarios')) return false;

    try {
      await apiRequest(`/tickets/${id}/comments`, {
        method: 'POST',
        body: JSON.stringify({ comentario }),
      });
      await refreshData();
      setTicketCommentDrafts((prev) => ({
        ...prev,
        [id]: '',
      }));
      showToast('Comentario agregado', 'success');
      return true;
    } catch (error) {
      showToast(getApiErrorMessage(error) || 'No se pudo guardar el comentario', 'error');
      return false;
    }
  };

  const eliminarTicket = async (ticketId: number): Promise<boolean> => {
    const ticketToDelete = tickets.find((ticket) => ticket.id === ticketId);
    if (!ticketToDelete) return false;
    if (!canDeleteTicket(ticketToDelete)) {
      showToast('No autorizado para eliminar este ticket', 'warning');
      return false;
    }

    const confirmed = showConfirm
      ? await showConfirm(`Eliminar ticket #${ticketToDelete.id} (${ticketToDelete.activoTag})? Esta accion no se puede deshacer.`)
      : window.confirm(`Eliminar ticket #${ticketToDelete.id} (${ticketToDelete.activoTag})? Esta accion no se puede deshacer.`);
    if (!confirmed) return false;
    if (!ensureBackendConnected('Eliminar tickets')) return false;

    try {
      await apiRequest(`/tickets/${ticketId}`, {
        method: 'DELETE',
      });
      await refreshData();
      showToast('Ticket eliminado', 'success');
      return true;
    } catch (error) {
      showToast(getApiErrorMessage(error) || 'No se pudo eliminar el ticket', 'error');
      return false;
    }
  };

  const cargarAdjuntoTicket = async (ticketId: number, files: FileList | null): Promise<boolean> => {
    if (!canCreateTickets) {
      showToast('Tu rol no permite adjuntar archivos', 'warning');
      return false;
    }

    const file = files?.[0];
    if (!file) return false;

    const target = tickets.find((ticket) => ticket.id === ticketId);
    if (!target) return false;
    if (!canAccessTicketBySession(target)) {
      showToast('Solo puedes adjuntar archivos a tus propios tickets', 'warning');
      return false;
    }

    const currentAttachments = target.attachments || [];
    if (currentAttachments.length >= CLIENT_ATTACHMENT_MAX_COUNT) {
      showToast(`Limite de ${CLIENT_ATTACHMENT_MAX_COUNT} adjuntos por ticket alcanzado`, 'warning');
      return false;
    }
    if (file.size > CLIENT_ATTACHMENT_MAX_BYTES) {
      const maxMb = Math.round((CLIENT_ATTACHMENT_MAX_BYTES / (1024 * 1024)) * 10) / 10;
      showToast(`Adjunto excede limite de ${maxMb} MB`, 'warning');
      return false;
    }
    if (!ensureBackendConnected('Adjuntar archivos')) return false;

    setTicketAttachmentLoadingId(ticketId);
    try {
      const contentBase64 = await fileToBase64(file);
      await apiRequest(`/tickets/${ticketId}/attachments`, {
        method: 'POST',
        body: JSON.stringify({
          fileName: file.name,
          mimeType: file.type || 'application/octet-stream',
          contentBase64,
        }),
      });
      await refreshData();
      showToast('Adjunto agregado', 'success');
      return true;
    } catch (error) {
      showToast(getApiErrorMessage(error) || 'No se pudo adjuntar el archivo', 'error');
      return false;
    } finally {
      setTicketAttachmentLoadingId(null);
    }
  };

  const descargarAdjuntoTicket = async (ticketId: number, attachment: TicketAttachment): Promise<boolean> => {
    const targetTicket = tickets.find((ticket) => ticket.id === ticketId);
    if (targetTicket && !canAccessTicketBySession(targetTicket)) {
      showToast('Solo puedes descargar adjuntos de tus propios tickets', 'warning');
      return false;
    }

    if (attachment.localUrl) {
      const link = document.createElement('a');
      link.href = attachment.localUrl;
      link.download = attachment.fileName || `adjunto_${attachment.id}`;
      link.click();
      return true;
    }

    if (!ensureBackendConnected('Descargar adjuntos')) return false;

    try {
      const token = getStoredSessionToken();
      const response = await fetch(buildApiUrl(`/tickets/${ticketId}/attachments/${attachment.id}/download`), {
        method: 'GET',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!response.ok) {
        const raw = await response.text();
        throw new ApiError(response.status, raw || `HTTP ${response.status}`);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = attachment.fileName || `adjunto_${attachment.id}`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 2000);
      return true;
    } catch (error) {
      showToast(getApiErrorMessage(error) || 'No se pudo descargar el adjunto', 'error');
      return false;
    }
  };

  const eliminarAdjuntoTicket = async (ticketId: number, attachment: TicketAttachment): Promise<boolean> => {
    if (!canEdit) {
      showToast('Tu rol no permite eliminar adjuntos', 'warning');
      return false;
    }

    const target = tickets.find((ticket) => ticket.id === ticketId);
    if (!target) return false;

    const confirmacion = showConfirm
      ? await showConfirm(`Eliminar adjunto "${attachment.fileName}" del ticket #${ticketId}?`)
      : window.confirm(`Eliminar adjunto "${attachment.fileName}" del ticket #${ticketId}?`);
    if (!confirmacion) return false;

    if (attachment.localOnly) {
      setTickets((prev) =>
        prev.map((ticket) =>
          ticket.id === ticketId
            ? {
              ...ticket,
              attachments: (ticket.attachments || []).filter((item) => item.id !== attachment.id),
              historial: [
                buildTicketHistoryEntry(
                  'Adjunto eliminado',
                  ticket.estado,
                  sessionUser?.nombre || 'Sistema',
                  attachment.fileName,
                ),
                ...(ticket.historial || []),
              ],
            }
            : ticket,
        ),
      );
      showToast('Adjunto eliminado', 'success');
      return true;
    }

    if (!ensureBackendConnected('Eliminar adjuntos')) return false;

    try {
      await apiRequest(`/tickets/${ticketId}/attachments/${attachment.id}`, {
        method: 'DELETE',
      });
      await refreshData();
      showToast('Adjunto eliminado', 'success');
      return true;
    } catch (error) {
      showToast(getApiErrorMessage(error) || 'No se pudo eliminar el adjunto', 'error');
      return false;
    }
  };

  return {
    handleCreateTicket,
    actualizarTicket,
    resolverTicket,
    agregarComentarioTicket,
    eliminarTicket,
    cargarAdjuntoTicket,
    descargarAdjuntoTicket,
    eliminarAdjuntoTicket,
  };
}
