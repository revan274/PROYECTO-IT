import { isTicketReopening } from '../../../shared/ticket-rules.js';
import type { TicketWaitReasonValue } from '../../../shared/ticket-wait-policy.js';
import { useCallback, useRef } from 'react';
import { retainTicket } from '../../api/tickets';
import type React from 'react';
import { CLIENT_ATTACHMENT_MAX_BYTES, CLIENT_ATTACHMENT_MAX_COUNT } from '../../constants/app';
import type {
  FormDataState,
  TicketAttachment,
  TicketAttentionType,
  TicketEstado,
  TicketItem,
  UserSession,
} from '../../types/app';
import type {
  RefreshAppData,
  SetTickets,
  ShowConfirm,
  ShowPrompt,
  ShowToast,
} from '../../types/actionDependencies';
import { ApiError, apiRequest, getApiErrorMessage } from '../../utils/api';
import { buildApiUrl, getStoredSessionToken } from '../../utils/app';
import { ticketBelongsToSessionUser } from '../../utils/appHelpers';
import { isRequesterOnlyRole } from '../../utils/roles';
import {
  buildTicketHistoryEntry,
  normalizeTicketAttentionType,
  normalizeTicketTravelRequired,
} from '../../utils/tickets';

interface UseTicketActionsProps {
  sessionUser: UserSession | null;
  backendConnected: boolean;
  refreshAppData: RefreshAppData | null;
  showToast: ShowToast;
  showConfirm: ShowConfirm | null;
  showPrompt?: ShowPrompt | null;
  tickets: TicketItem[];
  setTickets: SetTickets;
  canEdit: boolean;
  canCreateTickets: boolean;
  canCreateComments: boolean;
  isValidTicketBranchValue: (val?: string) => boolean;
  ticketAssetOptionsCount: number;
  ticketAssetOptionsIncludes: (tag: string) => boolean;
  setTicketCommentDrafts: React.Dispatch<React.SetStateAction<Record<number, string>>>;
  ticketCommentDrafts: Record<number, string>;
  setTicketCommentResponseRequests: React.Dispatch<React.SetStateAction<Record<number, boolean>>>;
  ticketCommentResponseRequests: Record<number, boolean>;
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

function createTicketIntentKey(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return `ticket-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function useTicketActions({
  sessionUser,
  backendConnected,
  refreshAppData,
  showToast,
  showConfirm,
  showPrompt,
  tickets,
  setTickets,
  canEdit,
  canCreateTickets,
  canCreateComments,
  isValidTicketBranchValue,
  ticketAssetOptionsCount,
  ticketAssetOptionsIncludes,
  setTicketCommentDrafts,
  ticketCommentDrafts,
  setTicketCommentResponseRequests,
  ticketCommentResponseRequests,
  setTicketAttachmentLoadingId,
}: UseTicketActionsProps) {
  const ticketCreationIntentRef = useRef<{ signature: string; key: string } | null>(null);
  const ensureBackendConnected = useCallback(
    (action: string) => {
      if (backendConnected) return true;
      showToast(`${action} requiere conexión con el backend.`, 'warning');
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
      if (ticket.archivo) return false;
      if (canEdit) return true;
      if (!isRequesterOnlyRole(sessionUser?.rol)) return false;
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
    const tipoSolicitud = formData.tipoSolicitud || 'INCIDENTE_ACTIVO';
    const requiresAsset = tipoSolicitud === 'INCIDENTE_ACTIVO';
    const sucursal = String(formData.sucursal || '').trim().toUpperCase();
    const areaId = String(formData.areaId || '').trim();
    const categoriaId = String(formData.categoriaId || '').trim();
    const atencionTipo = normalizeTicketAttentionType(formData.atencionTipo);
    const trasladoRequerido = normalizeTicketTravelRequired(formData.trasladoRequerido);
    const descripcionBase = String(formData.descripcion || '').trim();
    const prioridad = formData.prioridad || 'MEDIA';
    const requesterUserId = Number(formData.requesterUserId || sessionUser?.id);

    const ticketValidationError = !isValidTicketBranchValue(sucursal)
      ? 'Selecciona una sucursal valida para el ticket'
      : requiresAsset && ticketAssetOptionsCount === 0
        ? 'No hay activos registrados en la sucursal seleccionada'
        : requiresAsset && !activoTag
          ? 'Selecciona un TAG del equipo'
          : activoTag && !ticketAssetOptionsIncludes(activoTag)
            ? 'Selecciona un TAG valido para la sucursal elegida'
            : !areaId
              ? 'Selecciona área afectada'
              : !categoriaId
                ? 'Selecciona la categoría del ticket'
              : !Number.isSafeInteger(requesterUserId) || requesterUserId <= 0
                ? 'Selecciona un solicitante válido'
              : canEdit && !atencionTipo
                ? 'Selecciona el tipo de atención del ticket'
                : !descripcionBase
                  ? 'Agrega la descripción de la falla'
                  : '';

    if (ticketValidationError) {
      showToast(ticketValidationError, 'warning');
      return false;
    }
    if (!ensureBackendConnected('Crear tickets')) return false;

    const payload: Record<string, unknown> = {
      activoTag,
      tipoSolicitud,
      descripcion: descripcionBase,
      areaId,
      categoriaId,
      requesterUserId,
      sucursal,
      prioridad,
    };
    if (canEdit) {
      payload.atencionTipo = atencionTipo;
      if (trasladoRequerido !== undefined) payload.trasladoRequerido = trasladoRequerido;
      payload.asignadoA = formData.asignadoA || '';
    }

    const isAdmin = sessionUser?.rol === 'admin';
    const isHistorical = isAdmin && !!formData.esHistorico;
    let endpoint = '/tickets';

    if (isHistorical) {
      const estadoHistorico = (formData.estadoHistorico || 'Cerrado') as TicketEstado;
      const isClosedHistorico = estadoHistorico === 'Resuelto' || estadoHistorico === 'Cerrado';
      const fechaCreacionRaw = String(formData.fechaHistorica || '').trim();
      const fechaCierreRaw = String(formData.fechaCierreHistorica || '').trim();

      if (!fechaCreacionRaw) {
        showToast('Indica la fecha de creación del ticket pasado', 'warning');
        return false;
      }
      const fechaCreacionDate = new Date(fechaCreacionRaw);
      if (Number.isNaN(fechaCreacionDate.getTime())) {
        showToast('La fecha de creación no es válida', 'warning');
        return false;
      }
      if (fechaCreacionDate.getTime() > Date.now()) {
        showToast('La fecha de creación no puede ser futura', 'warning');
        return false;
      }
      if (isClosedHistorico && !fechaCierreRaw) {
        showToast('Indica la fecha de cierre del ticket pasado', 'warning');
        return false;
      }
      if (isClosedHistorico) {
        const fechaCierreDate = new Date(fechaCierreRaw);
        if (Number.isNaN(fechaCierreDate.getTime())) {
          showToast('La fecha de cierre no es válida', 'warning');
          return false;
        }
        if (fechaCierreDate.getTime() < fechaCreacionDate.getTime()) {
          showToast('La fecha de cierre no puede ser anterior a la de creación', 'warning');
          return false;
        }
        payload[estadoHistorico === 'Resuelto' ? 'fechaResolucion' : 'fechaCierre'] = fechaCierreDate.toISOString();
      }

      payload.fechaCreacion = fechaCreacionDate.toISOString();
      payload.estado = estadoHistorico;
      payload.comentarioResolucion = String(formData.resolucionHistorica || '').trim();
      endpoint = '/tickets/historical';
    }

    const intentSignature = JSON.stringify([endpoint, payload]);
    if (ticketCreationIntentRef.current?.signature !== intentSignature) {
      ticketCreationIntentRef.current = { signature: intentSignature, key: createTicketIntentKey() };
    }
    const idempotencyKey = ticketCreationIntentRef.current.key;

    try {
      await apiRequest(endpoint, {
        method: 'POST',
        headers: { 'Idempotency-Key': idempotencyKey },
        body: JSON.stringify(payload),
      });
      if (ticketCreationIntentRef.current?.signature === intentSignature) {
        ticketCreationIntentRef.current = null;
      }
      await refreshData();
      showToast(isHistorical ? 'Ticket histórico registrado' : 'Ticket creado', 'success');
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
      prioridad?: 'MEDIA' | 'ALTA' | 'CRITICA';
      motivoEspera?: TicketWaitReasonValue;
    },
  ): Promise<boolean> => {
    if (!canEdit) {
      showToast('Tu rol no permite editar tickets', 'warning');
      return false;
    }
    if (!ensureBackendConnected('Actualizar tickets')) return false;
    const currentTicket = tickets.find((ticket) => ticket.id === ticketId);
    let motivoReapertura: string | null = null;
    if (currentTicket && updates.estado && isTicketReopening(currentTicket.estado, updates.estado)) {
      motivoReapertura = showPrompt
        ? await showPrompt('Indica por que necesita nueva atencion.', { title: 'Reabrir ticket' })
        : window.prompt('Motivo de reapertura:');
      if (motivoReapertura === null) return false;
      if (!motivoReapertura.trim() || motivoReapertura.trim().length > 2000) {
        showToast('La reapertura requiere un motivo de 1 a 2000 caracteres', 'warning');
        return false;
      }
    }

    try {
      await apiRequest(`/tickets/${ticketId}`, {
        method: 'PATCH',
        body: JSON.stringify({ ...updates, ...(motivoReapertura ? { motivoReapertura: motivoReapertura.trim() } : {}) }),
      });
      await refreshData();
      showToast('Ticket actualizado', 'success');
      return true;
    } catch (error) {
      showToast(getApiErrorMessage(error) || 'No se pudo actualizar el ticket', 'error');
      return false;
    }
  };

  const resolverTicket = async (id: number, solucionAplicada: string, diagnostico?: string): Promise<boolean> => {
    if (!canEdit) {
      showToast('Tu rol no permite resolver tickets', 'warning');
      return false;
    }
    if (!ensureBackendConnected('Resolver tickets')) return false;

    try {
      await apiRequest(`/tickets/${id}/resolve`, {
        method: 'PATCH',
        body: JSON.stringify({ solucionAplicada, diagnostico }),
      });
      await refreshData();
      showToast('Ticket resuelto', 'success');
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
    const requiereRespuesta = ticketCommentResponseRequests[id] === true;
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
        body: JSON.stringify({ comentario, requiereRespuesta }),
      });
      await refreshData();
      setTicketCommentDrafts((prev) => ({
        ...prev,
        [id]: '',
      }));
      setTicketCommentResponseRequests((prev) => ({ ...prev, [id]: false }));
      showToast(requiereRespuesta ? 'Comentario agregado y aviso solicitado' : 'Comentario agregado', 'success');
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

    const accion = ['Resuelto', 'Cerrado', 'Cancelado'].includes(ticketToDelete.estado) ? 'archivar' : 'cancelar';
    const motivo = showPrompt
      ? await showPrompt('Motivo obligatorio. Se conservaran el historial y las evidencias.', { title: accion === 'cancelar' ? 'Cancelar ticket' : 'Archivar ticket' })
      : window.prompt('Motivo obligatorio para ' + accion + ' el ticket:');
    if (motivo === null) return false;
    if (!motivo.trim() || motivo.trim().length > 2000) {
      showToast('Escribe un motivo de 1 a 2000 caracteres', 'warning');
      return false;
    }
    if (!ensureBackendConnected('Conservar expediente')) return false;
    try {
      await retainTicket(ticketId, accion, motivo.trim());
      await refreshData();
      showToast(accion === 'cancelar' ? 'Ticket cancelado; expediente conservado' : 'Ticket archivado', 'success');
      return true;
    } catch (error) {
      showToast(getApiErrorMessage(error) || 'No se pudo actualizar el expediente', 'error');
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

    const currentAttachmentCount = Array.isArray(target.attachments)
      ? target.attachments.length
      : Math.max(0, Number(target.attachmentCount) || 0);
    if (currentAttachmentCount >= CLIENT_ATTACHMENT_MAX_COUNT) {
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
