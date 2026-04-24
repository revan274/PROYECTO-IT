import React from 'react';
import { Ticket, Trash2 } from 'lucide-react';
import { TicketFormModal } from '../modals/TicketFormModal';
import { Badge } from '../ui/Badge';
import { ticketRequiresTravel } from '../../utils/tickets';
import type {
  CatalogBranch,
  FormDataState,
  TicketAttentionType,
  TicketAttachment,
  TicketEstado,
  TicketItem,
  UserItem,
  UserSession,
} from '../../types/app';

type TicketLifecycleFilter = 'TODOS' | 'ABIERTOS' | 'CERRADOS';
type TicketAssignmentFilter = 'TODOS' | 'ASIGNADOS' | 'SIN_ASIGNAR';
type TicketSlaFilter = 'TODOS' | 'VENCIDO';
type TicketFocusAction = 'ABIERTOS' | 'CRITICA' | 'SIN_ASIGNAR' | 'SLA' | 'EN_PROCESO';
type TicketHistoryEntry = NonNullable<TicketItem['historial']>[number];
type TicketAttachmentRow = TicketAttachment;
type TicketRow = TicketItem;
type TechnicianOption = Pick<UserItem, 'id' | 'nombre' | 'rol' | 'activo'>;

interface TicketFormModalConfig {
  isOpen: boolean;
  title: string;
  submitLabel: string;
  formData: FormDataState;
  isSaving: boolean;
  canSubmit: boolean;
  activeTicketBranches: CatalogBranch[];
  ticketAssetOptions: Array<{ tag: string; label: string }>;
  selectedIssueArea: string;
  issueOptionsForSelectedArea: string[];
  selectedTicketAssetContext: {
    branchCode: string;
    locationLabel: string;
    locationTokens: string[];
    typeCode: string;
    suggestedArea: string | null;
  } | null;
  sessionUser: UserSession | null;
  onClose: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void | Promise<void>;
  onChange: (updates: Partial<FormDataState>) => void;
}

interface TicketsViewProps {
  canCreateTickets: boolean;
  canCreateComments: boolean;
  canEdit: boolean;
  canRequesterDelete: boolean;
  openTicketsCount: number;
  criticalTicketsCount: number;
  unassignedTicketsCount: number;
  slaExpiredCount: number;
  ticketLifecycleFilter: TicketLifecycleFilter;
  ticketStateFilter: string;
  ticketPriorityFilter: string;
  ticketAssignmentFilter: TicketAssignmentFilter;
  ticketSlaFilter: TicketSlaFilter;
  filteredTickets: TicketRow[];
  technicians: TechnicianOption[];
  ticketStates: string[];
  ticketAttentionTypes: TicketAttentionType[];
  ticketAttachmentLoadingId: number | null;
  ticketCommentDrafts: Record<number, string>;
  formatTicketBranchFromCatalog: (value?: string) => string;
  formatCargoFromCatalog: (value?: string) => string;
  formatDateTime: (value?: string) => string;
  formatBytes: (value?: number) => string;
  normalizeTicketAttentionType: (value: unknown) => TicketAttentionType | null;
  formatTicketAttentionType: (value: unknown) => string;
  getSlaStatus: (ticket: TicketRow) => { label: string; className: string };
  canDeleteTicket: (ticket: TicketRow) => boolean;
  onOpenTicketModal: () => void;
  onApplyTicketFocus: (focus: TicketFocusAction) => void;
  onTicketLifecycleFilterChange: (value: TicketLifecycleFilter) => void;
  onTicketStateFilterChange: (value: string) => void;
  onTicketPriorityFilterChange: (value: string) => void;
  onTicketAssignmentFilterChange: (value: TicketAssignmentFilter) => void;
  onTicketSlaFilterChange: (value: TicketSlaFilter) => void;
  onResetFilters: () => void;
  onStatusChange: (ticketId: number, estado: TicketEstado) => void;
  onAttentionChange: (ticketId: number, atencionTipo: TicketAttentionType) => void;
  onTravelChange: (ticketId: number, trasladoRequerido: boolean) => void;
  onAssigneeChange: (ticketId: number, asignadoA: string) => void;
  onViewAsset: (tag: string) => void;
  onResolveTicket: (ticketId: number) => void;
  onDeleteTicket: (ticketId: number) => void;
  onUploadAttachment: (ticketId: number, files: FileList | null) => void;
  onDownloadAttachment: (ticketId: number, attachment: TicketAttachmentRow) => void;
  onDeleteAttachment: (ticketId: number, attachment: TicketAttachmentRow) => void;
  onCommentDraftChange: (ticketId: number, value: string) => void;
  onSaveComment: (ticketId: number) => void;
  ticketFormModal: TicketFormModalConfig;
}

export function TicketsView({
  canCreateTickets,
  canCreateComments,
  canEdit,
  canRequesterDelete,
  openTicketsCount,
  criticalTicketsCount,
  unassignedTicketsCount,
  slaExpiredCount,
  ticketLifecycleFilter,
  ticketStateFilter,
  ticketPriorityFilter,
  ticketAssignmentFilter,
  ticketSlaFilter,
  filteredTickets,
  technicians,
  ticketStates,
  ticketAttentionTypes,
  ticketAttachmentLoadingId,
  ticketCommentDrafts,
  formatTicketBranchFromCatalog,
  formatCargoFromCatalog,
  formatDateTime,
  formatBytes,
  normalizeTicketAttentionType,
  formatTicketAttentionType,
  getSlaStatus,
  canDeleteTicket,
  onOpenTicketModal,
  onApplyTicketFocus,
  onTicketLifecycleFilterChange,
  onTicketStateFilterChange,
  onTicketPriorityFilterChange,
  onTicketAssignmentFilterChange,
  onTicketSlaFilterChange,
  onResetFilters,
  onStatusChange,
  onAttentionChange,
  onTravelChange,
  onAssigneeChange,
  onViewAsset,
  onResolveTicket,
  onDeleteTicket,
  onUploadAttachment,
  onDownloadAttachment,
  onDeleteAttachment,
  onCommentDraftChange,
  onSaveComment,
  ticketFormModal,
}: TicketsViewProps) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Operación y seguimiento</p>
          <h3 className="text-xl font-black uppercase text-slate-800">Tickets IT</h3>
        </div>
        <button
          disabled={!canCreateTickets}
          onClick={onOpenTicketModal}
          className="w-full rounded-3xl bg-slate-800 px-8 py-4 text-xs font-black uppercase text-white disabled:opacity-50 sm:w-auto"
        >
          Nuevo ticket
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <button
          onClick={() => onApplyTicketFocus('ABIERTOS')}
          className="rounded-2xl border border-slate-100 bg-white px-5 py-4 text-left shadow-sm hover:border-slate-200"
        >
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Abiertos</p>
          <p className="text-2xl font-black text-[#F58220] sm:text-3xl">{openTicketsCount}</p>
        </button>
        <button
          onClick={() => onApplyTicketFocus('CRITICA')}
          className="rounded-2xl border border-amber-100 bg-amber-50 px-5 py-4 text-left shadow-sm hover:border-amber-200"
        >
          <p className="text-[10px] font-black uppercase tracking-widest text-amber-600">Críticos</p>
          <p className="text-2xl font-black text-amber-700 sm:text-3xl">{criticalTicketsCount}</p>
        </button>
        <button
          onClick={() => onApplyTicketFocus('SIN_ASIGNAR')}
          className="rounded-2xl border border-indigo-100 bg-indigo-50 px-5 py-4 text-left shadow-sm hover:border-indigo-200"
        >
          <p className="text-[10px] font-black uppercase tracking-widest text-indigo-600">Sin asignar</p>
          <p className="text-2xl font-black text-indigo-700 sm:text-3xl">{unassignedTicketsCount}</p>
        </button>
        <button
          onClick={() => onApplyTicketFocus('SLA')}
          className="rounded-2xl border border-red-100 bg-red-50 px-5 py-4 text-left shadow-sm hover:border-red-200"
        >
          <p className="text-[10px] font-black uppercase tracking-widest text-red-500">SLA vencido</p>
          <p className="text-2xl font-black text-red-600 sm:text-3xl">{slaExpiredCount}</p>
        </button>
      </div>

      <div className="rounded-[2rem] border border-slate-100 bg-white p-4 shadow-sm sm:p-6">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-7">
          <select
            value={ticketLifecycleFilter}
            onChange={(event) => onTicketLifecycleFilterChange(event.target.value as TicketLifecycleFilter)}
            className="rounded-2xl border border-slate-100 bg-white px-4 py-3 text-xs font-black uppercase text-slate-500"
          >
            <option value="TODOS">Ciclo: todos</option>
            <option value="ABIERTOS">Solo abiertos</option>
            <option value="CERRADOS">Solo cerrados</option>
          </select>
          <select
            value={ticketStateFilter}
            onChange={(event) => onTicketStateFilterChange(event.target.value)}
            className="rounded-2xl border border-slate-100 bg-white px-4 py-3 text-xs font-black uppercase text-slate-500"
          >
            <option value="TODOS">Estado: todos</option>
            {ticketStates.map((state) => (
              <option key={state} value={state}>{state}</option>
            ))}
          </select>
          <select
            value={ticketPriorityFilter}
            onChange={(event) => onTicketPriorityFilterChange(event.target.value)}
            className="rounded-2xl border border-slate-100 bg-white px-4 py-3 text-xs font-black uppercase text-slate-500"
          >
            <option value="TODAS">Prioridad: todas</option>
            <option value="MEDIA">Media</option>
            <option value="ALTA">Alta</option>
            <option value="CRITICA">Crítica</option>
          </select>
          <select
            value={ticketAssignmentFilter}
            onChange={(event) => onTicketAssignmentFilterChange(event.target.value as TicketAssignmentFilter)}
            className="rounded-2xl border border-slate-100 bg-white px-4 py-3 text-xs font-black uppercase text-slate-500"
          >
            <option value="TODOS">Asignación: todos</option>
            <option value="ASIGNADOS">Solo asignados</option>
            <option value="SIN_ASIGNAR">Sin asignar</option>
          </select>
          <select
            value={ticketSlaFilter}
            onChange={(event) => onTicketSlaFilterChange(event.target.value as TicketSlaFilter)}
            className="rounded-2xl border border-slate-100 bg-white px-4 py-3 text-xs font-black uppercase text-slate-500"
          >
            <option value="TODOS">SLA: todos</option>
            <option value="VENCIDO">Solo vencido</option>
          </select>
          <button
            onClick={() => onApplyTicketFocus('EN_PROCESO')}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs font-black uppercase text-slate-600 hover:bg-slate-50"
          >
            Ver en proceso
          </button>
          <button
            onClick={onResetFilters}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs font-black uppercase text-slate-600 hover:bg-slate-50"
          >
            Limpiar filtros
          </button>
        </div>
      </div>

      {filteredTickets.map((ticket) => {
        const latestHistory = Array.isArray(ticket.historial) && ticket.historial.length > 0 ? ticket.historial[0] : null;
        const attachments = Array.isArray(ticket.attachments) ? ticket.attachments : [];
        const historyWithComment = (ticket.historial || [])
          .filter((entry): entry is TicketHistoryEntry => String(entry.comentario || '').trim().length > 0)
          .slice(0, 4);

        return (
          <div
            key={ticket.id}
            className="space-y-6 rounded-[2rem] border border-slate-100 bg-white p-4 shadow-xl sm:rounded-[2.5rem] sm:p-6 lg:p-8"
          >
            <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
              <div className="flex min-w-0 items-start gap-4 sm:gap-6">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-3xl bg-orange-50 text-[#F58220] sm:h-16 sm:w-16">
                  <Ticket size={28} />
                </div>
                <div className="min-w-0">
                  <div className="mb-1 flex flex-wrap items-center gap-3">
                    <Badge variant={ticket.prioridad}>{ticket.prioridad}</Badge>
                    <Badge variant={ticket.estado}>{ticket.estado}</Badge>
                    <Badge variant={normalizeTicketAttentionType(ticket.atencionTipo) || 'sin definir'}>
                      {formatTicketAttentionType(ticket.atencionTipo)}
                    </Badge>
                    {ticketRequiresTravel(ticket) && (
                      <Badge variant="traslado">Traslado</Badge>
                    )}
                    <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${getSlaStatus(ticket).className}`}>
                      {getSlaStatus(ticket).label}
                    </span>
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-300">#{ticket.id}</span>
                  </div>
                  <h4 className="break-words text-sm font-black uppercase text-slate-800 sm:text-md">
                    {ticket.activoTag} | {ticket.descripcion}
                  </h4>
                  <p className="mt-2 text-[10px] font-black uppercase text-slate-400">
                    Asignado: {ticket.asignadoA || 'Sin asignar'} | Sucursal: {formatTicketBranchFromCatalog(ticket.sucursal)}
                  </p>
                  <p className="mt-1 text-[10px] font-black uppercase text-slate-400">
                    Creado: {formatDateTime(ticket.fechaCreacion || ticket.fecha)} | Fecha límite: {formatDateTime(ticket.fechaLimite)}
                  </p>
                  <p className="mt-1 text-[10px] font-black uppercase text-slate-400">
                    Solicitó: {ticket.solicitadoPor || 'N/D'} | Cargo: {formatCargoFromCatalog(ticket.departamento)}
                  </p>
                  {latestHistory?.comentario && (
                    <p className="mt-2 line-clamp-2 text-xs font-bold text-slate-500">
                      Último comentario: {latestHistory.comentario}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex w-full flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:items-center xl:w-auto">
                <select
                  disabled={!canEdit}
                  value={ticket.estado}
                  onChange={(event) => onStatusChange(ticket.id, event.target.value as TicketEstado)}
                  className="rounded-2xl border border-slate-100 bg-white px-4 py-3 text-xs font-black uppercase text-slate-500 disabled:opacity-50"
                >
                  {ticketStates.map((state) => (
                    <option key={state} value={state}>{state}</option>
                  ))}
                </select>
                <select
                  disabled={!canEdit}
                  value={normalizeTicketAttentionType(ticket.atencionTipo) || ''}
                  onChange={(event) => {
                    const value = normalizeTicketAttentionType(event.target.value);
                    if (!value) return;
                    onAttentionChange(ticket.id, value);
                  }}
                  className="rounded-2xl border border-slate-100 bg-white px-4 py-3 text-xs font-black uppercase text-slate-500 disabled:opacity-50 sm:min-w-[15rem]"
                >
                  <option value="">Sin definir</option>
                  {ticketAttentionTypes.map((type) => (
                    <option key={type} value={type}>{formatTicketAttentionType(type)}</option>
                  ))}
                </select>
                <label className="flex min-w-[12rem] items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-white px-4 py-3">
                  <span className="text-[10px] font-black uppercase text-slate-500">
                    Se ocupo traslado
                  </span>
                  <span className="relative inline-flex h-6 w-11 shrink-0">
                    <input
                      type="checkbox"
                      disabled={!canEdit}
                      checked={ticketRequiresTravel(ticket)}
                      onChange={(event) => onTravelChange(ticket.id, event.target.checked)}
                      className="peer sr-only"
                    />
                    <span className="absolute inset-0 rounded-full bg-slate-200 transition-colors peer-checked:bg-emerald-500 peer-disabled:opacity-50" />
                    <span className="absolute left-1 top-1 h-4 w-4 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-5" />
                  </span>
                </label>
                <select
                  disabled={!canEdit}
                  value={ticket.asignadoA || ''}
                  onChange={(event) => onAssigneeChange(ticket.id, event.target.value)}
                  className="rounded-2xl border border-slate-100 bg-white px-4 py-3 text-xs font-black uppercase text-slate-500 disabled:opacity-50"
                >
                  <option value="">Sin asignar</option>
                  {technicians
                    .filter((user) => (user.rol === 'tecnico' || user.rol === 'admin') && user.activo !== false)
                    .map((user) => (
                      <option key={user.id} value={user.nombre}>{user.nombre}</option>
                    ))}
                </select>
                <button
                  onClick={() => onViewAsset(ticket.activoTag)}
                  className="rounded-2xl border border-slate-200 px-4 py-3 text-xs font-black uppercase text-slate-600 hover:bg-slate-50"
                >
                  Ver activo
                </button>
                <button
                  disabled={!canEdit || ticket.estado === 'Resuelto' || ticket.estado === 'Cerrado'}
                  onClick={() => onResolveTicket(ticket.id)}
                  className="rounded-2xl bg-[#8CC63F] px-6 py-4 text-[10px] font-black uppercase text-white disabled:opacity-50"
                >
                  Resolver
                </button>
                {(canEdit || canRequesterDelete) && (
                  <button
                    type="button"
                    disabled={!canDeleteTicket(ticket)}
                    onClick={() => onDeleteTicket(ticket.id)}
                    className="flex items-center justify-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-[10px] font-black uppercase text-red-600 hover:bg-red-100 disabled:opacity-40"
                  >
                    <Trash2 size={14} />
                    Eliminar
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <div className="space-y-3 rounded-2xl border border-slate-100 bg-slate-50/40 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Adjuntos ({attachments.length})
                  </p>
                  <label className={`rounded-xl border px-3 py-2 text-[10px] font-black uppercase tracking-wider ${canCreateTickets ? 'cursor-pointer border-slate-200 bg-white text-slate-600 hover:bg-slate-50' : 'cursor-not-allowed border-slate-100 bg-slate-100 text-slate-400'}`}>
                    {ticketAttachmentLoadingId === ticket.id ? 'Subiendo...' : 'Adjuntar archivo'}
                    <input
                      type="file"
                      disabled={!canCreateTickets || ticketAttachmentLoadingId === ticket.id}
                      className="hidden"
                      onChange={(event) => {
                        onUploadAttachment(ticket.id, event.target.files);
                        event.currentTarget.value = '';
                      }}
                    />
                  </label>
                </div>
                <div className="space-y-2">
                  {attachments.map((attachment) => (
                    <div
                      key={`attachment-${ticket.id}-${attachment.id}`}
                      className="flex flex-col gap-2 rounded-xl border border-slate-100 bg-white px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-xs font-black text-slate-700">{attachment.fileName}</p>
                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                          {formatBytes(attachment.size)} | {formatDateTime(attachment.uploadedAt)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 self-end sm:self-auto">
                        <button
                          type="button"
                          onClick={() => onDownloadAttachment(ticket.id, attachment)}
                          className="rounded-lg border border-slate-200 px-2 py-1 text-[10px] font-black uppercase text-slate-600 hover:bg-slate-50"
                        >
                          Descargar
                        </button>
                        <button
                          type="button"
                          disabled={!canEdit}
                          onClick={() => onDeleteAttachment(ticket.id, attachment)}
                          className="rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-[10px] font-black uppercase text-red-600 hover:bg-red-100 disabled:opacity-40"
                        >
                          Eliminar
                        </button>
                      </div>
                    </div>
                  ))}
                  {attachments.length === 0 && (
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                      Sin adjuntos registrados.
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-3 rounded-2xl border border-slate-100 bg-slate-50/40 p-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Comentarios</p>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    type="text"
                    value={ticketCommentDrafts[ticket.id] || ''}
                    disabled={!canCreateComments}
                    onChange={(event) => onCommentDraftChange(ticket.id, event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        onSaveComment(ticket.id);
                      }
                    }}
                    placeholder="Agregar comentario..."
                    className="flex-1 rounded-xl border border-slate-100 bg-white px-3 py-2 text-xs font-bold text-slate-600 outline-none disabled:opacity-50"
                  />
                  <button
                    type="button"
                    disabled={!canCreateComments}
                    onClick={() => onSaveComment(ticket.id)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-[10px] font-black uppercase text-slate-600 hover:bg-slate-50 disabled:opacity-50 sm:w-auto"
                  >
                    Guardar
                  </button>
                </div>
                <div className="space-y-2">
                  {historyWithComment.map((entry, index) => (
                    <div key={`comment-${ticket.id}-${entry.fecha}-${index}`} className="rounded-xl border border-slate-100 bg-white px-3 py-2">
                      <p className="text-xs font-bold text-slate-700">{entry.comentario}</p>
                      <p className="mt-1 text-[10px] font-black uppercase tracking-wider text-slate-400">
                        {entry.usuario} | {formatDateTime(entry.fecha)} | {entry.accion}
                      </p>
                    </div>
                  ))}
                  {historyWithComment.length === 0 && (
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                      Sin comentarios registrados.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}

      {filteredTickets.length === 0 && (
        <div className="glass-panel flex flex-col items-center justify-center rounded-[2rem] border border-white/40 bg-white/90 p-12 text-center opacity-70 transition-opacity hover:opacity-100 sm:rounded-[2.5rem] sm:p-20">
          <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-[2rem] border border-slate-100 bg-slate-50 shadow-inner">
            <span className="inline-block text-4xl hover-lift">🚀</span>
          </div>
          <p className="font-['Outfit'] text-xl font-black uppercase tracking-tight text-slate-800 sm:text-2xl">Buzón limpio</p>
          <p className="mt-2 max-w-sm text-[11px] font-black uppercase tracking-widest text-slate-400 sm:text-xs">
            No hay tickets que requieran tu atención con los filtros actuales.
          </p>
        </div>
      )}

      <TicketFormModal
        isOpen={ticketFormModal.isOpen}
        title={ticketFormModal.title}
        submitLabel={ticketFormModal.submitLabel}
        formData={ticketFormModal.formData}
        isSaving={ticketFormModal.isSaving}
        canSubmit={ticketFormModal.canSubmit}
        canEdit={canEdit}
        activeTicketBranches={ticketFormModal.activeTicketBranches}
        ticketAssetOptions={ticketFormModal.ticketAssetOptions}
        selectedIssueArea={ticketFormModal.selectedIssueArea}
        issueOptionsForSelectedArea={ticketFormModal.issueOptionsForSelectedArea}
        selectedTicketAssetContext={ticketFormModal.selectedTicketAssetContext}
        users={technicians}
        sessionUser={ticketFormModal.sessionUser}
        onClose={ticketFormModal.onClose}
        onSubmit={ticketFormModal.onSubmit}
        onChange={ticketFormModal.onChange}
        formatTicketBranchFromCatalog={formatTicketBranchFromCatalog}
        formatCargoFromCatalog={formatCargoFromCatalog}
        normalizeTicketAttentionType={normalizeTicketAttentionType}
        formatTicketAttentionType={formatTicketAttentionType}
      />
    </div>
  );
}
