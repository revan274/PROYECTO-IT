import { Ticket, Trash2 } from 'lucide-react';
import { Badge } from '../ui/Badge';

type TicketLifecycleFilter = 'TODOS' | 'ABIERTOS' | 'CERRADOS';
type TicketAssignmentFilter = 'TODOS' | 'ASIGNADOS' | 'SIN_ASIGNAR';
type TicketSlaFilter = 'TODOS' | 'VENCIDO';
type TicketFocusAction = 'ABIERTOS' | 'CRITICA' | 'SIN_ASIGNAR' | 'SLA' | 'EN_PROCESO';
type PrioridadTicket = 'MEDIA' | 'ALTA' | 'CRITICA';
type TicketEstado = 'Abierto' | 'En Proceso' | 'En Espera' | 'Resuelto' | 'Cerrado';
type TicketAttentionType = 'PRESENCIAL' | 'REMOTO';

interface TicketHistoryEntry {
  fecha: string;
  usuario: string;
  accion: string;
  estado: TicketEstado;
  comentario?: string;
}

interface TicketAttachmentRow {
  id: number;
  fileName: string;
  size?: number;
  uploadedAt?: string;
}

interface TicketRow {
  id: number;
  activoTag: string;
  descripcion: string;
  prioridad: PrioridadTicket;
  estado: TicketEstado;
  atencionTipo?: TicketAttentionType;
  fecha: string;
  fechaCreacion?: string;
  fechaLimite?: string;
  asignadoA?: string;
  solicitadoPor?: string;
  departamento?: string;
  sucursal?: string;
  historial?: TicketHistoryEntry[];
  attachments?: TicketAttachmentRow[];
}

interface TechnicianOption {
  id: number;
  nombre: string;
  rol: string;
  activo?: boolean;
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
  ticketAttentionTypes: string[];
  ticketAttachmentLoadingId: number | null;
  ticketCommentDrafts: Record<number, string>;
  formatTicketBranchFromCatalog: (value?: string) => string;
  formatCargoFromCatalog: (value?: string) => string;
  formatDateTime: (value?: string) => string;
  formatBytes: (value?: number) => string;
  normalizeTicketAttentionType: (value: unknown) => string | null;
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
  onStatusChange: (ticketId: number, estado: string) => void;
  onAttentionChange: (ticketId: number, atencionTipo: string) => void;
  onAssigneeChange: (ticketId: number, asignadoA: string) => void;
  onViewAsset: (tag: string) => void;
  onResolveTicket: (ticketId: number) => void;
  onDeleteTicket: (ticketId: number) => void;
  onUploadAttachment: (ticketId: number, files: FileList | null) => void;
  onDownloadAttachment: (ticketId: number, attachment: TicketAttachmentRow) => void;
  onDeleteAttachment: (ticketId: number, attachment: TicketAttachmentRow) => void;
  onCommentDraftChange: (ticketId: number, value: string) => void;
  onSaveComment: (ticketId: number) => void;
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
  onAssigneeChange,
  onViewAsset,
  onResolveTicket,
  onDeleteTicket,
  onUploadAttachment,
  onDownloadAttachment,
  onDeleteAttachment,
  onCommentDraftChange,
  onSaveComment,
}: TicketsViewProps) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Operación y Seguimiento</p>
          <h3 className="font-black text-slate-800 uppercase text-xl">Tickets IT</h3>
        </div>
        <button
          disabled={!canCreateTickets}
          onClick={onOpenTicketModal}
          className="w-full sm:w-auto bg-slate-800 text-white px-8 py-4 rounded-3xl font-black text-xs uppercase disabled:opacity-50"
        >
          Nuevo Ticket
        </button>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <button onClick={() => onApplyTicketFocus('ABIERTOS')} className="text-left bg-white border border-slate-100 rounded-2xl px-5 py-4 shadow-sm hover:border-slate-200">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Abiertos</p>
          <p className="text-2xl sm:text-3xl font-black text-[#F58220]">{openTicketsCount}</p>
        </button>
        <button onClick={() => onApplyTicketFocus('CRITICA')} className="text-left bg-amber-50 border border-amber-100 rounded-2xl px-5 py-4 shadow-sm hover:border-amber-200">
          <p className="text-[10px] font-black uppercase tracking-widest text-amber-600">Críticos</p>
          <p className="text-2xl sm:text-3xl font-black text-amber-700">{criticalTicketsCount}</p>
        </button>
        <button onClick={() => onApplyTicketFocus('SIN_ASIGNAR')} className="text-left bg-indigo-50 border border-indigo-100 rounded-2xl px-5 py-4 shadow-sm hover:border-indigo-200">
          <p className="text-[10px] font-black uppercase tracking-widest text-indigo-600">Sin Asignar</p>
          <p className="text-2xl sm:text-3xl font-black text-indigo-700">{unassignedTicketsCount}</p>
        </button>
        <button onClick={() => onApplyTicketFocus('SLA')} className="text-left bg-red-50 border border-red-100 rounded-2xl px-5 py-4 shadow-sm hover:border-red-200">
          <p className="text-[10px] font-black uppercase tracking-widest text-red-500">SLA Vencido</p>
          <p className="text-2xl sm:text-3xl font-black text-red-600">{slaExpiredCount}</p>
        </button>
      </div>

      <div className="bg-white border border-slate-100 rounded-[2rem] p-4 sm:p-6 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-7 gap-3">
          <select
            value={ticketLifecycleFilter}
            onChange={(e) => onTicketLifecycleFilterChange(e.target.value as TicketLifecycleFilter)}
            className="px-4 py-3 rounded-2xl border border-slate-100 bg-white text-xs font-black uppercase text-slate-500"
          >
            <option value="TODOS">Ciclo: Todos</option>
            <option value="ABIERTOS">Solo Abiertos</option>
            <option value="CERRADOS">Solo Cerrados</option>
          </select>
          <select
            value={ticketStateFilter}
            onChange={(e) => onTicketStateFilterChange(e.target.value)}
            className="px-4 py-3 rounded-2xl border border-slate-100 bg-white text-xs font-black uppercase text-slate-500"
          >
            <option value="TODOS">Estado: Todos</option>
            {ticketStates.map((state) => (
              <option key={state} value={state}>{state}</option>
            ))}
          </select>
          <select
            value={ticketPriorityFilter}
            onChange={(e) => onTicketPriorityFilterChange(e.target.value)}
            className="px-4 py-3 rounded-2xl border border-slate-100 bg-white text-xs font-black uppercase text-slate-500"
          >
            <option value="TODAS">Prioridad: Todas</option>
            <option value="MEDIA">Media</option>
            <option value="ALTA">Alta</option>
            <option value="CRITICA">Crítica</option>
          </select>
          <select
            value={ticketAssignmentFilter}
            onChange={(e) => onTicketAssignmentFilterChange(e.target.value as TicketAssignmentFilter)}
            className="px-4 py-3 rounded-2xl border border-slate-100 bg-white text-xs font-black uppercase text-slate-500"
          >
            <option value="TODOS">Asignación: Todos</option>
            <option value="ASIGNADOS">Solo Asignados</option>
            <option value="SIN_ASIGNAR">Sin Asignar</option>
          </select>
          <select
            value={ticketSlaFilter}
            onChange={(e) => onTicketSlaFilterChange(e.target.value as TicketSlaFilter)}
            className="px-4 py-3 rounded-2xl border border-slate-100 bg-white text-xs font-black uppercase text-slate-500"
          >
            <option value="TODOS">SLA: Todos</option>
            <option value="VENCIDO">Solo Vencido</option>
          </select>
          <button
            onClick={() => onApplyTicketFocus('EN_PROCESO')}
            className="px-4 py-3 rounded-2xl border border-slate-200 bg-white text-xs font-black uppercase text-slate-600 hover:bg-slate-50"
          >
            Ver En Proceso
          </button>
          <button
            onClick={onResetFilters}
            className="px-4 py-3 rounded-2xl border border-slate-200 bg-white text-xs font-black uppercase text-slate-600 hover:bg-slate-50"
          >
            Limpiar Filtros
          </button>
        </div>
      </div>

      {filteredTickets.map((ticket) => {
        const latestHistory = Array.isArray(ticket.historial) && ticket.historial.length > 0 ? ticket.historial[0] : null;
        const attachments = Array.isArray(ticket.attachments) ? ticket.attachments : [];
        const historyWithComment = (ticket.historial || [])
          .filter((entry) => String(entry.comentario || '').trim().length > 0)
          .slice(0, 4);

        return (
          <div key={ticket.id} className="bg-white p-4 sm:p-6 lg:p-8 rounded-[2rem] sm:rounded-[2.5rem] border border-slate-100 shadow-xl space-y-6">
            <div className="flex flex-col xl:flex-row xl:justify-between xl:items-start gap-6">
              <div className="flex items-start gap-4 sm:gap-6 min-w-0">
                <div className="w-12 h-12 sm:w-16 sm:h-16 bg-orange-50 rounded-3xl flex items-center justify-center text-[#F58220] shrink-0"><Ticket size={28} /></div>
                <div className="min-w-0">
                  <div className="flex items-center gap-3 mb-1 flex-wrap">
                    <Badge variant={ticket.prioridad}>{ticket.prioridad}</Badge>
                    <Badge variant={ticket.estado}>{ticket.estado}</Badge>
                    <Badge variant={normalizeTicketAttentionType(ticket.atencionTipo) || 'sin definir'}>
                      {formatTicketAttentionType(ticket.atencionTipo)}
                    </Badge>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black border uppercase tracking-wider ${getSlaStatus(ticket).className}`}>
                      {getSlaStatus(ticket).label}
                    </span>
                    <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">#{ticket.id}</span>
                  </div>
                  <h4 className="font-black text-slate-800 uppercase text-sm sm:text-md break-words">{ticket.activoTag} | {ticket.descripcion}</h4>
                  <p className="text-[10px] font-black text-slate-400 uppercase mt-2">
                    Asignado: {ticket.asignadoA || 'Sin asignar'} | Sucursal: {formatTicketBranchFromCatalog(ticket.sucursal)}
                  </p>
                  <p className="text-[10px] font-black text-slate-400 uppercase mt-1">
                    Creado: {formatDateTime(ticket.fechaCreacion || ticket.fecha)} | Fecha limite: {formatDateTime(ticket.fechaLimite)}
                  </p>
                  <p className="text-[10px] font-black text-slate-400 uppercase mt-1">
                    Solicitó: {ticket.solicitadoPor || 'N/D'} | Cargo: {formatCargoFromCatalog(ticket.departamento)}
                  </p>
                  {latestHistory?.comentario && (
                    <p className="text-xs font-bold text-slate-500 mt-2 line-clamp-2">
                      Ultimo comentario: {latestHistory.comentario}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center w-full xl:w-auto">
                <select
                  disabled={!canEdit}
                  value={ticket.estado}
                  onChange={(e) => onStatusChange(ticket.id, e.target.value)}
                  className="px-4 py-3 rounded-2xl border border-slate-100 bg-white text-xs font-black uppercase text-slate-500 disabled:opacity-50"
                >
                  {ticketStates.map((state) => (
                    <option key={state} value={state}>{state}</option>
                  ))}
                </select>
                <select
                  disabled={!canEdit}
                  value={normalizeTicketAttentionType(ticket.atencionTipo) || ''}
                  onChange={(e) => {
                    const value = normalizeTicketAttentionType(e.target.value);
                    if (!value) return;
                    onAttentionChange(ticket.id, value);
                  }}
                  className="px-4 py-3 rounded-2xl border border-slate-100 bg-white text-xs font-black uppercase text-slate-500 disabled:opacity-50"
                >
                  <option value="">Sin definir</option>
                  {ticketAttentionTypes.map((type) => (
                    <option key={type} value={type}>{formatTicketAttentionType(type)}</option>
                  ))}
                </select>
                <select
                  disabled={!canEdit}
                  value={ticket.asignadoA || ''}
                  onChange={(e) => onAssigneeChange(ticket.id, e.target.value)}
                  className="px-4 py-3 rounded-2xl border border-slate-100 bg-white text-xs font-black uppercase text-slate-500 disabled:opacity-50"
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
                  className="px-4 py-3 rounded-2xl border border-slate-200 text-xs font-black uppercase text-slate-600 hover:bg-slate-50"
                >
                  Ver Activo
                </button>
                <button
                  disabled={!canEdit || ticket.estado === 'Resuelto' || ticket.estado === 'Cerrado'}
                  onClick={() => onResolveTicket(ticket.id)}
                  className="bg-[#8CC63F] text-white px-6 py-4 rounded-2xl text-[10px] font-black uppercase disabled:opacity-50"
                >
                  Resolver
                </button>
                {(canEdit || canRequesterDelete) && (
                  <button
                    type="button"
                    disabled={!canDeleteTicket(ticket)}
                    onClick={() => onDeleteTicket(ticket.id)}
                    className="px-4 py-3 rounded-2xl border border-red-200 text-[10px] font-black uppercase text-red-600 bg-red-50 hover:bg-red-100 disabled:opacity-40 flex items-center justify-center gap-2"
                  >
                    <Trash2 size={14} /> Eliminar
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <div className="rounded-2xl border border-slate-100 bg-slate-50/40 p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Adjuntos ({attachments.length})
                  </p>
                  <label className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider border ${canCreateTickets ? 'bg-white border-slate-200 text-slate-600 cursor-pointer hover:bg-slate-50' : 'bg-slate-100 border-slate-100 text-slate-400 cursor-not-allowed'}`}>
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
                    <div key={`attachment-${ticket.id}-${attachment.id}`} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-xl border border-slate-100 bg-white px-3 py-2">
                      <div className="min-w-0">
                        <p className="text-xs font-black text-slate-700 truncate">{attachment.fileName}</p>
                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                          {formatBytes(attachment.size)} | {formatDateTime(attachment.uploadedAt)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 self-end sm:self-auto">
                        <button
                          type="button"
                          onClick={() => onDownloadAttachment(ticket.id, attachment)}
                          className="px-2 py-1 rounded-lg border border-slate-200 text-[10px] font-black uppercase text-slate-600 hover:bg-slate-50"
                        >
                          Descargar
                        </button>
                        <button
                          type="button"
                          disabled={!canEdit}
                          onClick={() => onDeleteAttachment(ticket.id, attachment)}
                          className="px-2 py-1 rounded-lg border border-red-200 text-[10px] font-black uppercase text-red-600 bg-red-50 hover:bg-red-100 disabled:opacity-40"
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

              <div className="rounded-2xl border border-slate-100 bg-slate-50/40 p-4 space-y-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Comentarios</p>
                <div className="flex flex-col sm:flex-row gap-2">
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
                    className="flex-1 px-3 py-2 rounded-xl border border-slate-100 bg-white text-xs font-bold text-slate-600 outline-none disabled:opacity-50"
                  />
                  <button
                    type="button"
                    disabled={!canCreateComments}
                    onClick={() => onSaveComment(ticket.id)}
                    className="w-full sm:w-auto px-3 py-2 rounded-xl border border-slate-200 bg-white text-[10px] font-black uppercase text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                  >
                    Guardar
                  </button>
                </div>
                <div className="space-y-2">
                  {historyWithComment.map((entry, index) => (
                    <div key={`comment-${ticket.id}-${entry.fecha}-${index}`} className="rounded-xl border border-slate-100 bg-white px-3 py-2">
                      <p className="text-xs font-bold text-slate-700">{entry.comentario}</p>
                      <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mt-1">
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
        <div className="glass-panel bg-white/90 border border-white/40 rounded-[2rem] sm:rounded-[2.5rem] p-12 sm:p-20 text-center flex flex-col items-center justify-center opacity-70 hover:opacity-100 transition-opacity">
          <div className="w-24 h-24 mb-6 rounded-[2rem] bg-slate-50 border border-slate-100 flex items-center justify-center shadow-inner">
            <span className="text-4xl hover-lift inline-block">🚀</span>
          </div>
          <p className="font-black font-['Outfit'] uppercase tracking-tight text-slate-800 text-xl sm:text-2xl">Buzón Limpio</p>
          <p className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-400 mt-2 max-w-sm">No hay tickets que requieran tu atención con los filtros actuales.</p>
        </div>
      )}
    </div>
  );
}
