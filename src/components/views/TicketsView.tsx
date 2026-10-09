import { ticketTransitionTargets } from '../../../shared/ticket-rules.js';
import React from 'react';
import { ChevronDown, ChevronUp, Ticket, Trash2 } from 'lucide-react';
import { TicketFormModal } from '../modals/TicketFormModal';
import { TicketResolutionModal } from '../modals/TicketResolutionModal';
import { TicketWaitModal } from '../modals/TicketWaitModal';
import type { TicketWaitReasonValue } from '../../../shared/ticket-wait-policy.js';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { formatDateTimeCompact } from '../../utils/format';
import { formatHistoryValue, historyChangeValues, sortTicketHistory } from '../../utils/ticketHistory';
import { isTicketClosed, ticketRequiresTravel } from '../../utils/tickets';
import type {
  Activo,
  CatalogBranch,
  FormDataState,
  TicketAttentionType,
  TicketAttachment,
  TicketAreaCatalogItem,
  TicketCategoryCatalogItem,
  TicketEstado,
  TicketItem,
  TicketHistoryEntry,
  PrioridadTicket,
  UserItem,
  UserSession,
} from '../../types/app';

type TicketLifecycleFilter = 'TODOS' | 'ABIERTOS' | 'CERRADOS';
type TicketAssignmentFilter = 'TODOS' | 'ASIGNADOS' | 'SIN_ASIGNAR';
type TicketSlaFilter = 'TODOS' | 'VENCIDO' | 'EN_TIEMPO' | 'CUMPLIDO' | 'INCUMPLIDO' | 'NO_EVALUABLE';
type TicketFocusAction = 'ABIERTOS' | 'CRITICA' | 'SIN_ASIGNAR' | 'SLA' | 'EN_PROCESO';
type TicketAttachmentRow = TicketAttachment;
type TicketRow = TicketItem;
type TechnicianOption = Pick<UserItem, 'id' | 'nombre' | 'username' | 'rol' | 'activo' | 'departamento'>;

interface TicketFormModalConfig {
  isOpen: boolean;
  title: string;
  submitLabel: string;
  formData: FormDataState;
  isSaving: boolean;
  canSubmit: boolean;
  activeTicketBranches: CatalogBranch[];
  ticketAreas: TicketAreaCatalogItem[];
  ticketCategories: TicketCategoryCatalogItem[];
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
  ticketTechnicianFilter: string;
  ticketBranchFilter: string;
  ticketAreaFilter: string;
  ticketCategoryFilter: string;
  ticketRequesterFilter: string;
  ticketAssetFilter: string;
  ticketDateFrom: string;
  ticketDateTo: string;
  filteredTickets: TicketRow[];
  scopedTicketsCount: number;
  technicians: TechnicianOption[];
  ticketBranches: CatalogBranch[];
  ticketAreas: TicketAreaCatalogItem[];
  ticketCategories: TicketCategoryCatalogItem[];
  ticketAssets: Activo[];
  ticketStates: string[];
  ticketAttentionTypes: TicketAttentionType[];
  ticketAttachmentLoadingId: number | null;
  ticketCommentDrafts: Record<number, string>;
  ticketCommentResponseRequests: Record<number, boolean>;
  formatTicketBranchFromCatalog: (value?: string) => string;
  formatCargoFromCatalog: (value?: string) => string;
  formatDateTime: (value?: string | null) => string;
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
  onTicketTechnicianFilterChange: (value: string) => void;
  onTicketBranchFilterChange: (value: string) => void;
  onTicketAreaFilterChange: (value: string) => void;
  onTicketCategoryFilterChange: (value: string) => void;
  onTicketRequesterFilterChange: (value: string) => void;
  onTicketAssetFilterChange: (value: string) => void;
  onTicketDateFromChange: (value: string) => void;
  onTicketDateToChange: (value: string) => void;
  onResetFilters: () => void;
  onStatusChange: (ticketId: number, estado: TicketEstado, motivoEspera?: TicketWaitReasonValue) => Promise<boolean> | void;
  onPriorityChange: (ticketId: number, prioridad: PrioridadTicket) => void;
  onAttentionChange: (ticketId: number, atencionTipo: TicketAttentionType) => void;
  onTravelChange: (ticketId: number, trasladoRequerido: boolean) => void;
  onAssigneeChange: (ticketId: number, asignadoA: string) => void;
  onViewAsset: (tag: string) => void;
  onResolveTicket: (ticketId: number, solution: string, diagnosis: string) => Promise<boolean>;
  onDeleteTicket: (ticketId: number) => void;
  onUploadAttachment: (ticketId: number, files: FileList | null) => void;
  onDownloadAttachment: (ticketId: number, attachment: TicketAttachmentRow) => void;
  onDeleteAttachment: (ticketId: number, attachment: TicketAttachmentRow) => void;
  onCommentDraftChange: (ticketId: number, value: string) => void;
  onCommentResponseRequestChange: (ticketId: number, value: boolean) => void;
  onSaveComment: (ticketId: number) => void;
  onLoadTicketDetail: (ticketId: number) => Promise<TicketItem>;
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
  ticketTechnicianFilter,
  ticketBranchFilter,
  ticketAreaFilter,
  ticketCategoryFilter,
  ticketRequesterFilter,
  ticketAssetFilter,
  ticketDateFrom,
  ticketDateTo,
  filteredTickets,
  scopedTicketsCount,
  technicians,
  ticketBranches,
  ticketAreas,
  ticketCategories,
  ticketAssets,
  ticketStates,
  ticketAttentionTypes,
  ticketAttachmentLoadingId,
  ticketCommentDrafts,
  ticketCommentResponseRequests,
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
  onTicketTechnicianFilterChange,
  onTicketBranchFilterChange,
  onTicketAreaFilterChange,
  onTicketCategoryFilterChange,
  onTicketRequesterFilterChange,
  onTicketAssetFilterChange,
  onTicketDateFromChange,
  onTicketDateToChange,
  onResetFilters,
  onStatusChange,
  onPriorityChange,
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
  onCommentResponseRequestChange,
  onSaveComment,
  onLoadTicketDetail,
  ticketFormModal,
}: TicketsViewProps) {
  // Los paneles de adjuntos y comentarios nacen plegados: con varios cientos de tickets
  // abiertos a la vez la lista se vuelve imposible de recorrer y monta un campo de texto
  // y uno de archivo por ticket aunque estén vacíos. La fila de acciones no se pliega,
  // porque cambiar estado y asignación desde la lista es el flujo diario del técnico.
  const [resolutionTicketId, setResolutionTicketId] = React.useState<number | null>(null);
  const [waitTicketId, setWaitTicketId] = React.useState<number | null>(null);
  const [expandedTickets, setExpandedTickets] = React.useState<ReadonlySet<string>>(() => new Set());
  const [visibleTimelineEvents, setVisibleTimelineEvents] = React.useState<Record<number, number>>({});
  const [ticketDetails, setTicketDetails] = React.useState<Record<number, TicketItem>>({});
  const [loadingTicketDetails, setLoadingTicketDetails] = React.useState<ReadonlySet<number>>(() => new Set());
  const [ticketDetailErrors, setTicketDetailErrors] = React.useState<Record<number, string>>({});
  const [ticketPage, setTicketPage] = React.useState(1);
  const [ticketPageSize, setTicketPageSize] = React.useState(20);
  const pageSizeSelectId = React.useId();

  const totalTicketPages = Math.max(1, Math.ceil(filteredTickets.length / ticketPageSize));
  const safeTicketPage = Math.min(ticketPage, totalTicketPages);
  const firstVisibleTicketIndex = (safeTicketPage - 1) * ticketPageSize;
  const visibleTickets = filteredTickets.slice(firstVisibleTicketIndex, firstVisibleTicketIndex + ticketPageSize);

  React.useEffect(() => {
    setTicketPage(1);
  }, [filteredTickets]);

  const loadTicketDetail = React.useCallback(async (ticketId: number) => {
    setLoadingTicketDetails((current) => new Set(current).add(ticketId));
    setTicketDetailErrors((current) => {
      const next = { ...current };
      delete next[ticketId];
      return next;
    });
    try {
      const detail = await onLoadTicketDetail(ticketId);
      setTicketDetails((current) => ({ ...current, [ticketId]: detail }));
    } catch {
      setTicketDetailErrors((current) => ({ ...current, [ticketId]: 'No se pudo cargar el detalle completo.' }));
    } finally {
      setLoadingTicketDetails((current) => {
        const next = new Set(current);
        next.delete(ticketId);
        return next;
      });
    }
  }, [onLoadTicketDetail]);

  const summaryRevision = React.useMemo(
    () => filteredTickets.map((ticket) => [
      ticket.id,
      ticket.estado,
      ticket.prioridad,
      ticket.asignadoAId ?? ticket.asignadoA,
      ticket.atencionTipo,
      ticket.trasladoRequerido,
      ticket.historialCount,
      ticket.attachmentCount,
      ticket.fechaPrimeraAtencion,
      ticket.fechaResolucion,
      ticket.fechaCierre,
    ].join(':')).join('|'),
    [filteredTickets],
  );
  const previousSummaryRevisionRef = React.useRef(summaryRevision);

  React.useEffect(() => {
    if (previousSummaryRevisionRef.current === summaryRevision) return;
    previousSummaryRevisionRef.current = summaryRevision;
    for (const ticketKey of expandedTickets) {
      void loadTicketDetail(Number(ticketKey));
    }
  }, [expandedTickets, loadTicketDetail, summaryRevision]);

  const toggleTicketDetails = (ticketId: number) => {
    const key = String(ticketId);
    const willExpand = !expandedTickets.has(key);
    setExpandedTickets((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
    if (willExpand && !ticketDetails[ticketId] && !loadingTicketDetails.has(ticketId)) {
      void loadTicketDetail(ticketId);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Operación y seguimiento</p>
          <h3 className="text-xl font-black uppercase text-slate-800">Tickets IT</h3>
        </div>
        <Button
          variant="primary"
          size="bare"
          disabled={!canCreateTickets}
          onClick={onOpenTicketModal}
          className="w-full rounded-3xl px-8 py-4 text-xs sm:w-auto"
        >
          Nuevo ticket
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Button variant="plain" size="bare"
          onClick={() => onApplyTicketFocus('ABIERTOS')}
          className="flex-col items-stretch rounded-2xl border border-slate-100 bg-white px-5 py-4 text-left shadow-sm hover:border-slate-200"
        >
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Abiertos</p>
          <p className="text-2xl font-black text-brand sm:text-3xl">{openTicketsCount}</p>
        </Button>
        <Button variant="plain" size="bare"
          onClick={() => onApplyTicketFocus('CRITICA')}
          className="flex-col items-stretch rounded-2xl border border-amber-100 bg-amber-50 px-5 py-4 text-left shadow-sm hover:border-amber-200"
        >
          <p className="text-[10px] font-black uppercase tracking-widest text-amber-600">Críticos</p>
          <p className="text-2xl font-black text-amber-700 sm:text-3xl">{criticalTicketsCount}</p>
        </Button>
        <Button variant="plain" size="bare"
          onClick={() => onApplyTicketFocus('SIN_ASIGNAR')}
          className="flex-col items-stretch rounded-2xl border border-indigo-100 bg-indigo-50 px-5 py-4 text-left shadow-sm hover:border-indigo-200"
        >
          <p className="text-[10px] font-black uppercase tracking-widest text-indigo-600">Sin asignar</p>
          <p className="text-2xl font-black text-indigo-700 sm:text-3xl">{unassignedTicketsCount}</p>
        </Button>
        <Button variant="plain" size="bare"
          onClick={() => onApplyTicketFocus('SLA')}
          className="flex-col items-stretch rounded-2xl border border-red-100 bg-red-50 px-5 py-4 text-left shadow-sm hover:border-red-200"
        >
          <p className="text-[10px] font-black uppercase tracking-widest text-red-500">SLA vencido</p>
          <p className="text-2xl font-black text-red-600 sm:text-3xl">{slaExpiredCount}</p>
        </Button>
      </div>

      <div className="rounded-[2rem] border border-slate-100 bg-white p-4 shadow-sm sm:p-6">
        <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(12rem,1fr))]">
          <Select
            aria-label="Filtrar por ciclo de vida"
            value={ticketLifecycleFilter}
            onChange={(event) => onTicketLifecycleFilterChange(event.target.value as TicketLifecycleFilter)}
            variant="filter"
          >
            <option value="TODOS">Ciclo: todos</option>
            <option value="ABIERTOS">Solo abiertos</option>
            <option value="CERRADOS">Solo cerrados</option>
          </Select>
          <Select
            aria-label="Filtrar por estado"
            value={ticketStateFilter}
            onChange={(event) => onTicketStateFilterChange(event.target.value)}
            variant="filter"
          >
            <option value="TODOS">Estado: todos</option>
            {ticketStates.map((state) => (
              <option key={state} value={state}>{state}</option>
            ))}
          </Select>
          <Select
            aria-label="Filtrar por prioridad"
            value={ticketPriorityFilter}
            onChange={(event) => onTicketPriorityFilterChange(event.target.value)}
            variant="filter"
          >
            <option value="TODAS">Prioridad: todas</option>
            <option value="MEDIA">Media</option>
            <option value="ALTA">Alta</option>
            <option value="CRITICA">Crítica</option>
          </Select>
          <Select
            aria-label="Filtrar por asignación"
            value={ticketAssignmentFilter}
            onChange={(event) => onTicketAssignmentFilterChange(event.target.value as TicketAssignmentFilter)}
            variant="filter"
          >
            <option value="TODOS">Asignación: todos</option>
            <option value="ASIGNADOS">Solo asignados</option>
            <option value="SIN_ASIGNAR">Sin asignar</option>
          </Select>
          <Select
            aria-label="Filtrar por SLA"
            value={ticketSlaFilter}
            onChange={(event) => onTicketSlaFilterChange(event.target.value as TicketSlaFilter)}
            variant="filter"
          >
            <option value="TODOS">SLA: todos</option>
            <option value="VENCIDO">Solo vencido</option>
            <option value="EN_TIEMPO">Pendiente en tiempo</option>
            <option value="CUMPLIDO">Resuelto dentro de SLA</option>
            <option value="INCUMPLIDO">Resuelto fuera de SLA</option>
            <option value="NO_EVALUABLE">SLA no evaluable</option>
          </Select>
          <Select
            aria-label="Filtrar por técnico"
            value={ticketTechnicianFilter}
            onChange={(event) => onTicketTechnicianFilterChange(event.target.value)}
            variant="filter"
          >
            <option value="TODOS">Técnico: todos</option>
            <option value="SIN_ASIGNAR">Técnico: sin asignar</option>
            {technicians
              .filter((user) => user.rol === 'tecnico' || user.rol === 'admin')
              .map((user) => <option key={user.id} value={user.id}>{user.nombre}</option>)}
          </Select>
          <Select
            aria-label="Filtrar por sucursal"
            value={ticketBranchFilter}
            onChange={(event) => onTicketBranchFilterChange(event.target.value)}
            variant="filter"
          >
            <option value="TODAS">Sucursal: todas</option>
            {ticketBranches.map((branch) => <option key={branch.code} value={branch.code}>{branch.name}</option>)}
          </Select>
          <Select
            aria-label="Filtrar por área"
            value={ticketAreaFilter}
            onChange={(event) => onTicketAreaFilterChange(event.target.value)}
            variant="filter"
          >
            <option value="TODAS">Área: todas</option>
            {ticketAreas.map((area) => <option key={area.id} value={area.id}>{area.nombre}</option>)}
          </Select>
          <Select
            aria-label="Filtrar por categoría"
            value={ticketCategoryFilter}
            onChange={(event) => onTicketCategoryFilterChange(event.target.value)}
            variant="filter"
          >
            <option value="TODAS">Categoría: todas</option>
            {ticketCategories
              .filter((category) => ticketAreaFilter === 'TODAS' || category.areaId === ticketAreaFilter)
              .map((category) => <option key={category.id} value={category.id}>{category.nombre}</option>)}
          </Select>
          <Select
            aria-label="Filtrar por solicitante"
            value={ticketRequesterFilter}
            onChange={(event) => onTicketRequesterFilterChange(event.target.value)}
            variant="filter"
          >
            <option value="TODOS">Solicitante: todos</option>
            {technicians.map((user) => <option key={user.id} value={user.id}>{user.nombre} ({user.username})</option>)}
          </Select>
          <Select
            aria-label="Filtrar por activo"
            value={ticketAssetFilter}
            onChange={(event) => onTicketAssetFilterChange(event.target.value)}
            variant="filter"
          >
            <option value="TODOS">Activo: todos</option>
            <option value="SIN_ACTIVO">Sin activo</option>
            {ticketAssets.map((asset) => <option key={asset.id} value={asset.id}>{asset.tag} · {asset.tipo}</option>)}
          </Select>
          <Input
            aria-label="Fecha inicial de creación"
            type="date"
            variant="filter"
            value={ticketDateFrom}
            max={ticketDateTo || undefined}
            onChange={(event) => onTicketDateFromChange(event.target.value)}
          />
          <Input
            aria-label="Fecha final de creación"
            type="date"
            variant="filter"
            value={ticketDateTo}
            min={ticketDateFrom || undefined}
            onChange={(event) => onTicketDateToChange(event.target.value)}
          />
          <Button onClick={() => onApplyTicketFocus('EN_PROCESO')}>
            Ver en proceso
          </Button>
          <Button onClick={onResetFilters}>
            Limpiar filtros
          </Button>
        </div>
        <p className="mt-4 text-xs font-bold text-slate-500" aria-live="polite">
          Mostrando {filteredTickets.length === 0 ? 0 : firstVisibleTicketIndex + 1}–{Math.min(firstVisibleTicketIndex + ticketPageSize, filteredTickets.length)} de {filteredTickets.length} filtrados · {scopedTicketsCount} accesibles
        </p>
      </div>

      {visibleTickets.map((ticket) => {
        const detailTicket = ticketDetails[ticket.id];
        const attachments = Array.isArray(detailTicket?.attachments) ? detailTicket.attachments : [];
        const timelineEntries = sortTicketHistory(detailTicket?.historial || []);
        const attachmentCount = detailTicket ? attachments.length : Math.max(0, Number(ticket.attachmentCount) || 0);
        const historyCount = detailTicket ? timelineEntries.length : Math.max(0, Number(ticket.historialCount) || 0);
        const visibleEventCount = visibleTimelineEvents[ticket.id] || 10;
        const visibleEvents = timelineEntries.slice(0, visibleEventCount);
        const isExpanded = expandedTickets.has(String(ticket.id));
        const isDetailLoading = loadingTicketDetails.has(ticket.id);
        const detailError = ticketDetailErrors[ticket.id];
        const detailsId = `ticket-detalle-${ticket.id}`;

        return (
          <div
            key={ticket.id}
            className="space-y-6 rounded-[2rem] border border-slate-100 bg-white p-4 shadow-xl sm:rounded-[2.5rem] sm:p-6 lg:p-8"
          >
            <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
              <div className="flex min-w-0 items-start gap-4 sm:gap-6">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-3xl bg-orange-50 text-brand sm:h-16 sm:w-16">
                  <Ticket size={28} />
                </div>
                <div className="min-w-0">
                  {/* Estado, tipo de atencion y traslado ya se leen (y se editan) en los
                      controles de la derecha; repetirlos aqui como insignia gastaba una fila
                      entera sin anadir nada. Quedan las tres que si son unicas: que ticket es,
                      cuanto corre prisa y cuanto SLA queda. */}
                  <div className="mb-1 flex flex-wrap items-center gap-3">
                    <span className="text-xs font-black tracking-wider text-slate-500 tabular-nums">#{ticket.id}</span>
                    <Badge variant={ticket.prioridad}>{ticket.prioridad}</Badge>
                    <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${getSlaStatus(ticket).className}`}>
                      {getSlaStatus(ticket).label}
                    </span>
                  </div>
                  <h4 className="break-words text-sm font-black uppercase text-slate-800 sm:text-md">
                    {ticket.activoTag || 'Solicitud de servicio'} | {ticket.descripcion}
                  </h4>
                  <p className="mt-1 text-[10px] font-black uppercase tracking-wider text-slate-400">
                    {ticket.areaNombre || 'Clasificación pendiente'}
                    {ticket.categoriaNombre ? ` · ${ticket.categoriaNombre}` : ''}
                  </p>
                  {/* En caja normal y no en mayusculas: son datos que se leen, no etiquetas.
                      "Asignado" vive en el selector de la derecha, asi que no se repite. */}
                  {/* Cada par etiqueta+valor no se parte por dentro: una fecha cortada a la
                      mitad, o un "p.m." solo en la linea siguiente, cuesta mas de leer que
                      la linea extra que se ahorra. */}
                  <p className="mt-2 flex flex-wrap gap-x-3 text-xs font-medium text-slate-500">
                    <span className="whitespace-nowrap">
                      <span className="text-slate-400">Sucursal</span>{' '}
                      <span className="font-bold text-slate-600">{formatTicketBranchFromCatalog(ticket.sucursal)}</span>
                    </span>
                    <span className="whitespace-nowrap">
                      <span className="text-slate-400">Solicitó</span>{' '}
                      <span className="font-bold text-slate-600">{ticket.solicitadoPor || 'N/D'}</span>
                      {' '}({formatCargoFromCatalog(ticket.departamento)})
                    </span>
                    {ticket.createdBy && ticket.createdByUserId !== (ticket.requesterUserId ?? ticket.solicitadoPorId) && (
                      <span className="whitespace-nowrap">
                        <span className="text-slate-400">Registró</span>{' '}
                        <span className="font-bold text-slate-600">{ticket.createdBy}</span>
                      </span>
                    )}
                  </p>
                  <p className="mt-1 flex flex-wrap gap-x-3 text-xs font-medium text-slate-500 tabular-nums">
                    <span className="whitespace-nowrap">
                      <span className="text-slate-400">Creado</span>{' '}
                      <span className="font-bold text-slate-600">{formatDateTimeCompact(ticket.fechaCreacion || ticket.fecha)}</span>
                    </span>
                    <span className="whitespace-nowrap">
                      <span className="text-slate-400">Límite</span>{' '}
                      <span className="font-bold text-slate-600">{formatDateTimeCompact(ticket.fechaLimite)}</span>
                    </span>
                  </p>
                  {ticket.ultimoComentario && (
                    <p className="mt-2 line-clamp-2 text-xs font-bold text-slate-500">
                      Último comentario: {ticket.ultimoComentario}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex w-full flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:items-center xl:w-auto">
                <Select
                  disabled={!canEdit || ticket.estado === 'Cancelado' || !!ticket.archivo}
                  value={ticket.estado}
                  onChange={(event) => {
                    if (event.target.value === 'Resuelto') setResolutionTicketId(ticket.id);
                    else if (event.target.value === 'En Espera' && ticket.estado !== 'En Espera') setWaitTicketId(ticket.id);
                    else onStatusChange(ticket.id, event.target.value as TicketEstado);
                  }}
                  variant="filter"
                >
                  {ticketStates.filter((state) => state === ticket.estado || ticketTransitionTargets(ticket.estado).some((target) => target === state)).map((state) => (
                    <option key={state} value={state}>{state}</option>
                  ))}
                </Select>
                <Select
                  aria-label={`Prioridad del ticket ${ticket.id}`}
                  disabled={!canEdit || isTicketClosed(ticket) || !!ticket.archivo}
                  value={ticket.prioridad}
                  onChange={(event) => onPriorityChange(ticket.id, event.target.value as PrioridadTicket)}
                  variant="filter"
                >
                  <option value="MEDIA">Prioridad media</option>
                  <option value="ALTA">Prioridad alta</option>
                  <option value="CRITICA">Prioridad crítica</option>
                </Select>
                <Select
                  disabled={!canEdit || ticket.estado === 'Cerrado' || ticket.estado === 'Cancelado' || !!ticket.archivo}
                  value={normalizeTicketAttentionType(ticket.atencionTipo) || ''}
                  onChange={(event) => {
                    const value = normalizeTicketAttentionType(event.target.value);
                    if (!value) return;
                    onAttentionChange(ticket.id, value);
                  }}
                  variant="filter" className="sm:min-w-[11rem]"
                >
                  <option value="">Sin definir</option>
                  {ticketAttentionTypes.map((type) => (
                    <option key={type} value={type}>{formatTicketAttentionType(type)}</option>
                  ))}
                </Select>
                <label htmlFor={`ticket-travel-${ticket.id}`} className="flex min-w-[12rem] items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-white px-4 py-3">
                  <span className="text-[10px] font-black uppercase text-slate-500">
                    Se ocupo traslado
                  </span>
                  <span className="relative inline-flex h-6 w-11 shrink-0">
                    <Input variant="plain"
                      id={`ticket-travel-${ticket.id}`}
                      type="checkbox"
                      disabled={!canEdit || ticket.estado === 'Cerrado' || ticket.estado === 'Cancelado' || !!ticket.archivo}
                      checked={ticketRequiresTravel(ticket)}
                      onChange={(event) => onTravelChange(ticket.id, event.target.checked)}
                      className="peer sr-only"
                    />
                    <span className="absolute inset-0 rounded-full bg-slate-200 transition-colors peer-checked:bg-emerald-500 peer-disabled:opacity-50" />
                    <span className="absolute left-1 top-1 h-4 w-4 rounded-full bg-white toggle-thumb shadow-sm transition-transform peer-checked:translate-x-5" />
                  </span>
                </label>
                <Select
                  disabled={!canEdit || ticket.estado === 'Cerrado' || ticket.estado === 'Cancelado' || !!ticket.archivo}
                  value={ticket.asignadoA || ''}
                  onChange={(event) => onAssigneeChange(ticket.id, event.target.value)}
                  variant="filter"
                >
                  <option value="">Sin asignar</option>
                  {technicians
                    .filter((user) => (user.rol === 'tecnico' || user.rol === 'admin') && user.activo !== false)
                    .map((user) => (
                      <option key={user.id} value={user.nombre}>{user.nombre}</option>
                    ))}
                </Select>
                {ticket.activoTag && (
                  <Button variant="plain" size="bare"
                    onClick={() => onViewAsset(ticket.activoTag)}
                    className="rounded-2xl border border-slate-200 px-4 py-3 text-xs font-black uppercase text-slate-600 hover:bg-slate-50"
                  >
                    Ver activo
                  </Button>
                )}
                <Button variant="success" size="bare"
                  disabled={!canEdit || isTicketClosed(ticket) || !!ticket.archivo}
                  onClick={() => setResolutionTicketId(ticket.id)}
                  className="rounded-2xl bg-brand-green px-6 py-4 text-[10px] font-black uppercase text-white disabled:opacity-50"
                >
                  Resolver
                </Button>
                {(canEdit || canRequesterDelete) && (
                  <Button variant="plain" size="bare"
                    type="button"
                    disabled={!canDeleteTicket(ticket)}
                    onClick={() => onDeleteTicket(ticket.id)}
                    className="flex items-center justify-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-[10px] font-black uppercase text-red-600 hover:bg-red-100 disabled:opacity-40"
                  >
                    <Trash2 size={14} />
                    {ticket.archivo ? 'Archivado' : isTicketClosed(ticket) ? 'Archivar' : 'Cancelar'}
                  </Button>
                )}
              </div>
            </div>

            <Button
              variant="plain"
              size="bare"
              type="button"
              aria-expanded={isExpanded}
              aria-controls={detailsId}
              onClick={() => toggleTicketDetails(ticket.id)}
              className="flex w-full items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50/40 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-100"
            >
              <span>
                Adjuntos ({attachmentCount}) | Eventos ({historyCount})
              </span>
              <span className="flex items-center gap-2">
                {isExpanded ? 'Ocultar' : 'Ver detalle'}
                {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </span>
            </Button>

            {isExpanded && (isDetailLoading && !detailTicket ? (
              <div id={detailsId} className="rounded-2xl border border-slate-100 bg-slate-50/40 p-6 text-center text-xs font-bold text-slate-500" aria-live="polite">
                Cargando detalle completo...
              </div>
            ) : detailError && !detailTicket ? (
              <div id={detailsId} className="space-y-3 rounded-2xl border border-red-100 bg-red-50 p-6 text-center">
                <p className="text-xs font-bold text-red-700">{detailError}</p>
                <Button type="button" onClick={() => void loadTicketDetail(ticket.id)}>Reintentar</Button>
              </div>
            ) : detailTicket ? (
            <div id={detailsId} className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <dl className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-2 xl:col-span-2">
                {[
                  ['Creación', detailTicket.fechaCreacion],
                  ['Primera atención', detailTicket.fechaPrimeraAtencion],
                  ['Resolución', detailTicket.fechaResolucion],
                  ['Cierre', detailTicket.fechaCierre],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt className="font-bold">{label}</dt>
                    <dd>{formatDateTime(value)}</dd>
                  </div>
                ))}
                {detailTicket.fechaTerminalLegacy && (
                  <div className="sm:col-span-2">
                    <dt className="font-bold">Fecha terminal anterior sin hito confirmado</dt>
                    <dd>{detailTicket.fechaTerminalLegacy}</dd>
                  </div>
                )}
              </dl>
              {!!detailTicket.ciclos?.length && (
                <details className="text-sm xl:col-span-2">
                  <summary className="cursor-pointer font-bold">Ciclos de atención ({detailTicket.ciclos.length})</summary>
                  <ol className="mt-3 space-y-4">
                    {detailTicket.ciclos.map((cycle) => (
                      <li key={cycle.id} className="space-y-1">
                        <p className="font-bold">Ciclo {cycle.numero} · {cycle.estado} · {cycle.asignadoA || 'Sin asignar'}</p>
                        <p>Inicio: {formatDateTime(cycle.fechaInicio)} · Primera atención: {formatDateTime(cycle.fechaPrimeraAtencion)}</p>
                        <p>Resolución: {formatDateTime(cycle.fechaResolucion)} · Cierre: {formatDateTime(cycle.fechaCierre)}</p>
                        <p>Vencimiento comprometido: {formatDateTime(cycle.fechaLimite)} · Prioridad: {cycle.prioridad}</p>
                        {cycle.slaAsignado && (
                          <p>
                            SLA asignado: {cycle.slaAsignado.horasAsignadas ?? 'N/D'} h · Política: {cycle.slaAsignado.versionPolitica || 'N/D'}
                            {cycle.slaAsignado.calendario?.zonaHoraria ? ` · Zona: ${cycle.slaAsignado.calendario.zonaHoraria}` : ''}
                          </p>
                        )}
                        {cycle.slaResultado && <p>Resultado SLA: {cycle.slaResultado.estado} · Evaluado: {formatDateTime(cycle.slaResultado.evaluadoEn)}</p>}
                        {!!cycle.slaRevisiones?.length && <p>Revisiones de SLA en el ciclo: {cycle.slaRevisiones.length}</p>}
                        {!!cycle.esperas?.length && cycle.esperas.map((wait) => (
                          <p key={wait.id}>
                            {wait.etiqueta}: {formatDateTime(wait.fechaInicio)} → {formatDateTime(wait.fechaFin)} · {wait.pausaSla ? `SLA pausado ${wait.minutosPausados ?? 0} min hábiles` : 'SLA sin pausa'}
                          </p>
                        ))}
                        {cycle.solucionAplicada && <p className="whitespace-pre-wrap">Solución: {cycle.solucionAplicada}</p>}
                        {cycle.reapertura && <p>Reabrió {cycle.reapertura.usuario}: {cycle.reapertura.motivo}</p>}
                        {cycle.reconstruccionLegacy && <p>Registro anterior: hitos desconocidos conservados como N/D.</p>}
                      </li>
                    ))}
                  </ol>
                </details>
              )}
              {(detailTicket.solucionAplicada || detailTicket.diagnostico) && (
                <dl className="space-y-3 text-sm xl:col-span-2">
                  {detailTicket.diagnostico && <div><dt className="font-bold">Diagnóstico</dt><dd className="whitespace-pre-wrap">{detailTicket.diagnostico}</dd></div>}
                  {detailTicket.solucionAplicada && <div><dt className="font-bold">Solución aplicada</dt><dd className="whitespace-pre-wrap">{detailTicket.solucionAplicada}</dd></div>}
                </dl>
              )}
              <div className="space-y-3 rounded-2xl border border-slate-100 bg-slate-50/40 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Adjuntos ({attachments.length})
                  </p>
                  <label className={`rounded-xl border px-3 py-2 text-[10px] font-black uppercase tracking-wider focus-within:ring-2 focus-within:ring-brand focus-within:ring-offset-2 ${canCreateTickets ? 'cursor-pointer border-slate-200 bg-white text-slate-600 hover:bg-slate-50' : 'cursor-not-allowed border-slate-100 bg-slate-100 text-slate-400'}`}>
                    {ticketAttachmentLoadingId === ticket.id ? 'Subiendo...' : 'Adjuntar archivo'}
                    <Input variant="plain"
                      type="file"
                      disabled={!canCreateTickets || ticketAttachmentLoadingId === ticket.id}
                      className="sr-only"
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
                        <Button variant="plain" size="bare"
                          type="button"
                          onClick={() => onDownloadAttachment(ticket.id, attachment)}
                          className="rounded-lg border border-slate-200 px-2 py-1 text-[10px] font-black uppercase text-slate-600 hover:bg-slate-50"
                        >
                          Descargar
                        </Button>
                        <Button variant="plain" size="bare"
                          type="button"
                          disabled={!canEdit || ticket.estado === 'Cerrado' || ticket.estado === 'Cancelado' || !!ticket.archivo}
                          onClick={() => onDeleteAttachment(ticket.id, attachment)}
                          className="rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-[10px] font-black uppercase text-red-600 hover:bg-red-100 disabled:opacity-40"
                        >
                          {ticket.archivo ? 'Archivado' : isTicketClosed(ticket) ? 'Archivar' : 'Cancelar'}
                        </Button>
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
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Agregar comentario</p>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input variant="plain"
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
                  <Button variant="plain" size="bare"
                    type="button"
                    disabled={!canCreateComments}
                    onClick={() => onSaveComment(ticket.id)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-[10px] font-black uppercase text-slate-600 hover:bg-slate-50 disabled:opacity-50 sm:w-auto"
                  >
                    Guardar
                  </Button>
                </div>
                <label htmlFor={`ticket-comment-response-${ticket.id}`} className="flex w-fit items-center gap-2 text-xs font-bold text-slate-600">
                  <Input
                    id={`ticket-comment-response-${ticket.id}`}
                    variant="plain"
                    type="checkbox"
                    checked={ticketCommentResponseRequests[ticket.id] === true}
                    disabled={!canCreateComments}
                    onChange={(event) => onCommentResponseRequestChange(ticket.id, event.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand"
                  />
                  Este comentario requiere respuesta y debe notificar al otro participante
                </label>
              </div>

              <section className="space-y-3 rounded-2xl border border-slate-100 bg-slate-50/40 p-4 xl:col-span-2" aria-label={`Cronología del ticket ${ticket.id}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Cronología completa ({timelineEntries.length})</p>
                  <p className="text-[10px] font-bold text-slate-500">Más reciente primero</p>
                </div>
                <ol className="space-y-3">
                  {visibleEvents.map((entry: TicketHistoryEntry, index) => {
                    const changes = historyChangeValues(entry);
                    return (
                      <li key={`timeline-${ticket.id}-${entry.fecha || entry.fechaLegacy || 'sin-fecha'}-${index}`} className="rounded-xl border border-slate-100 bg-white px-4 py-3">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <p className="text-xs font-black text-slate-700">{entry.accion}</p>
                            <p className="text-[10px] font-black uppercase tracking-wider text-brand">{entry.tipo || 'evento'}</p>
                          </div>
                          <p className="text-right text-[10px] font-bold text-slate-500">
                            {entry.nombreMostrado || entry.usuario} · Actor {entry.actorId ?? 'legacy/sistema'}
                          </p>
                        </div>
                        <p className="mt-2 break-all font-mono text-[10px] text-slate-500">
                          {entry.fecha || `Fecha legacy sin confirmar: ${entry.fechaLegacy || 'N/D'}`}
                        </p>
                        {entry.comentario && <p className="mt-2 whitespace-pre-wrap text-xs font-semibold text-slate-700">{entry.comentario}</p>}
                        {entry.diagnostico && <p className="mt-2 whitespace-pre-wrap text-xs text-slate-600"><strong>Diagnóstico:</strong> {entry.diagnostico}</p>}
                        {entry.solucionAplicada && <p className="mt-2 whitespace-pre-wrap text-xs text-slate-600"><strong>Solución:</strong> {entry.solucionAplicada}</p>}
                        {(changes.before !== null && changes.before !== undefined) && (
                          <p className="mt-2 text-xs text-slate-600"><strong>Antes:</strong> {formatHistoryValue(changes.before)}</p>
                        )}
                        {(changes.after !== null && changes.after !== undefined) && (
                          <p className="mt-1 text-xs text-slate-600"><strong>Después:</strong> {formatHistoryValue(changes.after)}</p>
                        )}
                      </li>
                    );
                  })}
                </ol>
                {timelineEntries.length === 0 && <p className="text-xs font-bold text-slate-400">Sin eventos registrados.</p>}
                {visibleEvents.length < timelineEntries.length && (
                  <Button
                    variant="plain"
                    type="button"
                    onClick={() => setVisibleTimelineEvents((current) => ({ ...current, [ticket.id]: visibleEventCount + 10 }))}
                    className="w-full"
                  >
                    Mostrar 10 eventos más
                  </Button>
                )}
              </section>
            </div>
            ) : null)}
          </div>
        );
      })}

      {filteredTickets.length > 0 && (
        <nav className="flex flex-col items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-white p-4 sm:flex-row" aria-label="Paginación de tickets">
          <label htmlFor={pageSizeSelectId} className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wider text-slate-500">
            Por página
            <Select
              id={pageSizeSelectId}
              aria-label="Tickets por página"
              value={String(ticketPageSize)}
              onChange={(event) => {
                setTicketPageSize(Number(event.target.value));
                setTicketPage(1);
              }}
              variant="filter"
            >
              <option value="10">10</option>
              <option value="20">20</option>
              <option value="50">50</option>
            </Select>
          </label>
          <p className="text-xs font-bold text-slate-500">Página {safeTicketPage} de {totalTicketPages}</p>
          <div className="flex w-full gap-2 sm:w-auto">
            <Button className="flex-1 sm:flex-none" disabled={safeTicketPage <= 1} onClick={() => setTicketPage((page) => Math.max(1, page - 1))}>Anterior</Button>
            <Button className="flex-1 sm:flex-none" disabled={safeTicketPage >= totalTicketPages} onClick={() => setTicketPage((page) => Math.min(totalTicketPages, page + 1))}>Siguiente</Button>
          </div>
        </nav>
      )}

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

      {resolutionTicketId !== null && (
        <TicketResolutionModal key={resolutionTicketId} ticketId={resolutionTicketId} onClose={() => setResolutionTicketId(null)} onResolve={onResolveTicket} />
      )}
      {waitTicketId !== null && (
        <TicketWaitModal key={waitTicketId} ticketId={waitTicketId} onClose={() => setWaitTicketId(null)}
          onApply={async (ticketId, reason) => (await onStatusChange(ticketId, 'En Espera', reason)) !== false} />
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
        ticketAreas={ticketFormModal.ticketAreas}
        ticketCategories={ticketFormModal.ticketCategories}
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
