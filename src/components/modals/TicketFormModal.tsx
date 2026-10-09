import React, { useId, useMemo } from 'react';
import { Save } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { TextArea } from '../ui/TextArea';
import { Field } from '../ui/Field';
import { SLA_POLICY, TICKET_ATTENTION_TYPES, TICKET_STATES } from '../../constants/app';
import { isClosedTicketState } from '../../../shared/ticket-rules.js';
import type {
  CatalogBranch,
  FormDataState,
  PrioridadTicket,
  TicketAreaCatalogItem,
  TicketAttentionType,
  TicketCategoryCatalogItem,
  TicketEstado,
  TicketRequestType,
  UserSession,
} from '../../types/app';
import { ModalLayout } from './ModalLayout';

function toDateTimeLocalMax(): string {
  const now = new Date();
  const offsetMs = now.getTimezoneOffset() * 60 * 1000;
  return new Date(now.getTime() - offsetMs).toISOString().slice(0, 16);
}

interface TicketAssetOption {
  tag: string;
  label: string;
}

interface AssignableUser {
  id: number;
  nombre: string;
  rol: string;
  activo?: boolean;
  departamento?: string;
}

interface TicketAssetContext {
  branchCode: string;
  locationLabel: string;
  locationTokens: string[];
  typeCode: string;
  suggestedArea: string | null;
}

interface TicketFormModalProps {
  isOpen: boolean;
  title: string;
  submitLabel: string;
  formData: FormDataState;
  isSaving: boolean;
  canSubmit: boolean;
  canEdit: boolean;
  activeTicketBranches: CatalogBranch[];
  ticketAreas: TicketAreaCatalogItem[];
  ticketCategories: TicketCategoryCatalogItem[];
  ticketAssetOptions: TicketAssetOption[];
  selectedIssueArea: string;
  issueOptionsForSelectedArea: string[];
  selectedTicketAssetContext: TicketAssetContext | null;
  users: AssignableUser[];
  sessionUser: UserSession | null;
  onClose: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void | Promise<void>;
  onChange: (updates: Partial<FormDataState>) => void;
  formatTicketBranchFromCatalog: (value?: string) => string;
  formatCargoFromCatalog: (value?: string) => string;
  normalizeTicketAttentionType: (value: unknown) => TicketAttentionType | null;
  formatTicketAttentionType: (value: unknown) => string;
}

export function TicketFormModal({
  isOpen,
  title,
  submitLabel,
  formData,
  isSaving,
  canSubmit,
  canEdit,
  activeTicketBranches,
  ticketAreas,
  ticketCategories,
  ticketAssetOptions,
  selectedIssueArea,
  issueOptionsForSelectedArea,
  selectedTicketAssetContext,
  users,
  sessionUser,
  onClose,
  onSubmit,
  onChange,
  formatTicketBranchFromCatalog,
  formatCargoFromCatalog,
  normalizeTicketAttentionType,
  formatTicketAttentionType,
}: TicketFormModalProps) {
  const assignableUsers = useMemo(
    () => users.filter((user) => (user.rol === 'tecnico' || user.rol === 'admin') && user.activo !== false),
    [users],
  );
  const requesterUsers = useMemo(() => users.filter((user) => user.activo !== false), [users]);
  const selectedRequester = requesterUsers.find((user) => user.id === Number(formData.requesterUserId || sessionUser?.id)) || sessionUser;
  const isAdmin = sessionUser?.rol === 'admin';
  const isHistorical = isAdmin && !!formData.esHistorico;
  const historicalEstado = formData.estadoHistorico || 'Cerrado';
  const historicalIsClosed = isClosedTicketState(historicalEstado);
  const dateTimeMax = useMemo(() => toDateTimeLocalMax(), []);
  const areaSelectId = useId();
  const categorySelectId = useId();
  const requesterSelectId = useId();
  const creatorNameId = useId();
  const branchNameId = useId();
  const travelRequiredId = useId();
  const historicalToggleId = useId();
  const historicalCreatedAtId = useId();
  const historicalStateId = useId();
  const historicalClosedAtId = useId();
  const requestTypeId = useId();
  const branchSelectId = useId();
  const assetSelectId = useId();
  const attentionSelectId = useId();
  const descriptionId = useId();
  const suggestedIssueId = useId();
  const priorityId = useId();
  const assigneeId = useId();
  const isAssetIncident = (formData.tipoSolicitud || 'INCIDENTE_ACTIVO') === 'INCIDENTE_ACTIVO';

  return (
    <ModalLayout isOpen={isOpen} title={title} onClose={onClose} isBusy={isSaving}>
      <form onSubmit={onSubmit} className="p-10 space-y-4 max-h-[72vh] overflow-y-auto">
        <Field htmlFor={requestTypeId} label="Tipo de solicitud">
          <Select
            id={requestTypeId}
            required
            value={formData.tipoSolicitud || 'INCIDENTE_ACTIVO'}
            onChange={(event) => onChange({
              tipoSolicitud: event.target.value as TicketRequestType,
              ...(event.target.value === 'SOLICITUD_SERVICIO' ? { activoTag: '' } : {}),
            })}
            className="w-full"
          >
            <option value="INCIDENTE_ACTIVO">Incidente de activo</option>
            <option value="SOLICITUD_SERVICIO">Solicitud de servicio</option>
          </Select>
        </Field>
        <Field htmlFor={branchSelectId} label="Sucursal del ticket">
        <Select variant="plain"
          id={branchSelectId}
          required
          className="w-full p-5 bg-slate-50 glass-input rounded-2xl text-sm font-black uppercase outline-none focus:ring-4 focus:ring-blue-100"
          value={formData.sucursal || ''}
          onChange={(e) => onChange({ sucursal: e.target.value.toUpperCase() })}
        >
          {activeTicketBranches.length === 0 ? (
            <option value="">Sin sucursales configuradas</option>
          ) : (
            activeTicketBranches.map((branch) => (
              <option key={branch.code} value={branch.code}>{branch.code} - {branch.name}</option>
            ))
          )}
        </Select>
        </Field>
        <Field htmlFor={assetSelectId} label={isAssetIncident ? 'Activo afectado' : 'Activo relacionado (opcional)'}>
        <Select variant="plain"
          id={assetSelectId}
          required={isAssetIncident}
          disabled={!formData.sucursal || (isAssetIncident && ticketAssetOptions.length === 0)}
          className="w-full p-5 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-black uppercase outline-none disabled:opacity-50"
          value={formData.activoTag || ''}
          onChange={(e) => onChange({ activoTag: e.target.value.toUpperCase() })}
        >
          <option value="">
            {!formData.sucursal
              ? 'Primero selecciona sucursal...'
              : ticketAssetOptions.length === 0 && isAssetIncident
                ? 'Sin activos registrados en esta sucursal'
                : isAssetIncident
                  ? 'Selecciona el equipo (ej. CAJA 1, IMPRESORA)...'
                  : 'Equipo relacionado (opcional)...'}
          </option>
          {ticketAssetOptions.map((assetOption) => (
            <option key={assetOption.tag} value={assetOption.tag}>
              {assetOption.label}
            </option>
          ))}
        </Select>
        </Field>
        <p className="text-[10px] text-slate-400 font-black uppercase">
          Activos en sucursal seleccionada: {ticketAssetOptions.length}{!isAssetIncident ? ' · opcional para servicios' : ''}
        </p>
        {selectedTicketAssetContext && (
          <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4 space-y-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Contexto detectado
            </p>
            <p className="text-xs font-black uppercase text-slate-700">
              Sucursal: {selectedTicketAssetContext.branchCode || 'N/D'} | Lugar: {selectedTicketAssetContext.locationLabel || 'SIN UBICACION'} | Equipo: {selectedTicketAssetContext.typeCode || 'EQUIPO'}
            </p>
            {selectedTicketAssetContext.suggestedArea && !selectedIssueArea && (
              <p className="text-[10px] font-black uppercase tracking-wider text-amber-600">
                Area sugerida: {selectedTicketAssetContext.suggestedArea}
              </p>
            )}
          </div>
        )}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Field htmlFor={areaSelectId} label="Área afectada">
            <Select
              id={areaSelectId}
              required
              value={formData.areaId || ''}
              onChange={(e) => onChange({ areaId: e.target.value, categoriaId: '', fallaComun: '' })}
              className="w-full"
            >
              <option value="">Selecciona área...</option>
              {ticketAreas.map((area) => (
                <option key={area.id} value={area.id}>{area.nombre}</option>
              ))}
            </Select>
          </Field>
          <Field htmlFor={categorySelectId} label="Categoría">
            <Select
              id={categorySelectId}
              required
              disabled={!formData.areaId || ticketCategories.length === 0}
              value={formData.categoriaId || ''}
              onChange={(e) => onChange({ categoriaId: e.target.value })}
              className="w-full"
            >
              <option value="">{formData.areaId ? 'Selecciona categoría...' : 'Selecciona área primero...'}</option>
              {ticketCategories.map((category) => (
                <option key={category.id} value={category.id}>{category.nombre}</option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_13rem]">
          {canEdit && (
            <Field htmlFor={attentionSelectId} label="Tipo de atención">
            <Select variant="plain"
              id={attentionSelectId}
              required
              value={formData.atencionTipo || ''}
              onChange={(e) => {
                const value = normalizeTicketAttentionType(e.target.value);
                const traslado =
                  value === 'PRESENCIAL' || value === 'PRESENCIAL_FUERA_DE_HORARIO'
                    ? true
                    : value === 'REMOTO' || value === 'REMOTO_FUERA_DE_HORARIO'
                      ? false
                      : undefined;
                onChange({
                  atencionTipo: value || undefined,
                  ...(traslado !== undefined ? { trasladoRequerido: traslado } : {}),
                });
              }}
              className="w-full p-5 bg-slate-50 glass-input rounded-2xl text-sm font-black uppercase outline-none focus:ring-4 focus:ring-blue-100"
            >
              <option value="">Tipo de atención...</option>
              {TICKET_ATTENTION_TYPES.map((type) => (
                <option key={`ticket-attention-${type}`} value={type}>{formatTicketAttentionType(type)}</option>
              ))}
            </Select>
            </Field>
          )}
          {canEdit && (
            <label htmlFor={travelRequiredId} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4">
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Traslado
                </p>
                <p className="text-xs font-black uppercase text-slate-700">
                  {formData.trasladoRequerido ? 'Sí' : 'No'}
                </p>
              </div>
              <span className="relative inline-flex h-7 w-12 shrink-0">
                <Input variant="plain"
                  id={travelRequiredId}
                  type="checkbox"
                  checked={!!formData.trasladoRequerido}
                  onChange={(e) => onChange({ trasladoRequerido: e.target.checked })}
                  className="peer sr-only"
                />
                <span className="absolute inset-0 rounded-full bg-slate-200 transition-colors peer-checked:bg-emerald-500" />
                <span className="absolute left-1 top-1 h-5 w-5 rounded-full bg-white toggle-thumb shadow-sm transition-transform peer-checked:translate-x-5" />
              </span>
            </label>
          )}
        </div>
        <Field htmlFor={descriptionId} label="Descripción de la falla">
        <TextArea variant="plain"
          id={descriptionId}
          required
          placeholder="DESCRIPCION DE LA FALLA"
          value={formData.descripcion || ''}
          className="w-full p-5 bg-slate-50 glass-input rounded-2xl text-sm font-black uppercase h-24 outline-none focus:ring-4 focus:ring-blue-100"
          onChange={(e) => onChange({ descripcion: e.target.value })}
        />
        </Field>
        <div className="rounded-2xl border border-slate-100 bg-slate-50/40 p-4 space-y-3">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            Falla sugerida por sucursal y lugar
          </p>
          <Field htmlFor={suggestedIssueId} label="Falla sugerida">
          <Select variant="plain"
            id={suggestedIssueId}
            value={formData.fallaComun || ''}
            disabled={issueOptionsForSelectedArea.length === 0}
            onChange={(e) =>
              onChange({
                fallaComun: e.target.value,
                descripcion: e.target.value,
              })
            }
            className="w-full p-4 bg-white border border-slate-100 rounded-2xl text-sm font-black uppercase outline-none disabled:opacity-50"
          >
            <option value="">
              {issueOptionsForSelectedArea.length === 0
                ? selectedTicketAssetContext
                  ? 'Sin fallas sugeridas para este contexto'
                  : !selectedIssueArea
                    ? 'Selecciona área o TAG primero'
                    : 'Sin fallas configuradas para esta área'
                : 'Selecciona una falla sugerida...'}
            </option>
            {issueOptionsForSelectedArea.map((issue) => (
              <option key={`${selectedIssueArea}-${issue}`} value={issue}>{issue}</option>
            ))}
          </Select>
          </Field>
        </div>

        <Field htmlFor={priorityId} label="Prioridad">
        <Select variant="plain"
          id={priorityId}
          className="w-full p-5 bg-slate-50 glass-input rounded-2xl text-sm font-black uppercase outline-none focus:ring-4 focus:ring-blue-100"
          value={formData.prioridad || 'MEDIA'}
          onChange={(e) => onChange({ prioridad: e.target.value as PrioridadTicket })}
        >
          <option value="MEDIA">Media</option>
          <option value="ALTA">Alta</option>
          <option value="CRITICA">Critica</option>
        </Select>
        </Field>
        {canEdit ? (
          <Field htmlFor={assigneeId} label="Técnico responsable">
          <Select variant="plain"
            id={assigneeId}
            className="w-full p-5 bg-slate-50 glass-input rounded-2xl text-sm font-black uppercase outline-none focus:ring-4 focus:ring-blue-100"
            value={formData.asignadoA || ''}
            onChange={(e) => onChange({ asignadoA: e.target.value })}
          >
            <option value="">Asignar técnico...</option>
            {assignableUsers.map((user) => (
              <option key={user.id} value={user.nombre}>{user.nombre}</option>
            ))}
          </Select>
          </Field>
        ) : (
          <div className="w-full p-5 bg-amber-50 border border-amber-100 rounded-2xl text-xs font-black uppercase text-amber-700">
            El ticket se registrará sin asignación inicial.
          </div>
        )}
        <Field htmlFor={requesterSelectId} label="Solicitante">
          {canEdit ? (
            <Select
              id={requesterSelectId}
              required
              value={String(formData.requesterUserId || sessionUser?.id || '')}
              onChange={(event) => onChange({ requesterUserId: Number(event.target.value) })}
              className="w-full"
            >
              {requesterUsers.map((user) => (
                <option key={user.id} value={user.id}>{user.nombre}</option>
              ))}
            </Select>
          ) : (
            <Input id={requesterSelectId} disabled value={sessionUser?.nombre || ''} className="w-full" />
          )}
        </Field>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field htmlFor={creatorNameId} label="Registrado por">
            <Input id={creatorNameId} disabled value={sessionUser?.nombre || ''} className="w-full" />
          </Field>
          <Field htmlFor={branchNameId} label="Sucursal">
            <Input id={branchNameId} disabled value={formatTicketBranchFromCatalog(formData.sucursal)} className="w-full" />
          </Field>
        </div>
        <p className="text-[10px] text-slate-400 font-black uppercase">
          Cargo solicitante: {formatCargoFromCatalog(selectedRequester?.departamento)}
        </p>
        <p className="text-[10px] text-slate-400 font-black uppercase">
          SLA estimado: {SLA_POLICY[formData.prioridad || 'MEDIA']} horas
        </p>

        {isAdmin && (
          <div className="rounded-2xl border border-indigo-100 bg-indigo-50/50 p-4 space-y-3">
            <label htmlFor={historicalToggleId} className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-widest text-indigo-400">
                  Registro retroactivo
                </p>
                <p className="text-xs font-black uppercase text-indigo-700">
                  Ticket pasado (histórico)
                </p>
              </div>
              <span className="relative inline-flex h-7 w-12 shrink-0">
                <Input variant="plain"
                  id={historicalToggleId}
                  type="checkbox"
                  checked={!!formData.esHistorico}
                  onChange={(e) =>
                    onChange({
                      esHistorico: e.target.checked,
                      ...(e.target.checked
                        ? { estadoHistorico: formData.estadoHistorico || 'Cerrado' }
                        : {}),
                    })
                  }
                  className="peer sr-only"
                />
                <span className="absolute inset-0 rounded-full bg-slate-200 transition-colors peer-checked:bg-indigo-500" />
                <span className="absolute left-1 top-1 h-5 w-5 rounded-full bg-white toggle-thumb shadow-sm transition-transform peer-checked:translate-x-5" />
              </span>
            </label>

            {isHistorical && (
              <div className="space-y-3">
                <div className="space-y-1">
                  <label htmlFor={historicalCreatedAtId} className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Fecha de creación (pasada)
                  </label>
                  <Input variant="plain"
                    id={historicalCreatedAtId}
                    type="datetime-local"
                    required
                    max={dateTimeMax}
                    value={formData.fechaHistorica || ''}
                    onChange={(e) => onChange({ fechaHistorica: e.target.value })}
                    className="w-full p-4 bg-white border border-slate-100 rounded-2xl text-sm font-black uppercase outline-none focus:ring-4 focus:ring-indigo-100"
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor={historicalStateId} className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Estado final
                  </label>
                  <Select variant="plain"
                    id={historicalStateId}
                    value={historicalEstado}
                    onChange={(e) => onChange({ estadoHistorico: e.target.value as TicketEstado })}
                    className="w-full p-4 bg-white border border-slate-100 rounded-2xl text-sm font-black uppercase outline-none focus:ring-4 focus:ring-indigo-100"
                  >
                    {TICKET_STATES.map((state) => (
                      <option key={`hist-estado-${state}`} value={state}>{state}</option>
                    ))}
                  </Select>
                </div>
                {historicalIsClosed && (
                  <div className="space-y-1">
                    <label htmlFor={historicalClosedAtId} className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                      {formData.estadoHistorico === 'Resuelto' ? 'Fecha de resolución' : 'Fecha de cierre'}
                    </label>
                    <Input variant="plain"
                      id={historicalClosedAtId}
                      type="datetime-local"
                      required
                      max={dateTimeMax}
                      min={formData.fechaHistorica || undefined}
                      value={formData.fechaCierreHistorica || ''}
                      onChange={(e) => onChange({ fechaCierreHistorica: e.target.value })}
                      className="w-full p-4 bg-white border border-slate-100 rounded-2xl text-sm font-black uppercase outline-none focus:ring-4 focus:ring-indigo-100"
                    />
                  </div>
                )}
                <Field htmlFor={`${historicalClosedAtId}-solution`} label={historicalIsClosed ? 'Solución aplicada (obligatoria)' : 'Comentario histórico (opcional)'}>
                <TextArea
                  id={`${historicalClosedAtId}-solution`}
                  required={historicalIsClosed}
                  maxLength={8000}
                  value={formData.resolucionHistorica || ''}
                  onChange={(e) => onChange({ resolucionHistorica: e.target.value })}
                  className="w-full h-24"
                />
                </Field>
                <p className="text-[10px] text-indigo-400 font-black uppercase">
                  El ticket se registrará con la fecha indicada y quedará marcado como histórico.
                </p>
              </div>
            )}
          </div>
        )}

        <Button variant="primary" size="cta" className="mt-4" disabled={!canSubmit} type="submit">
          <Save size={18} /> {submitLabel}
        </Button>
      </form>
    </ModalLayout>
  );
}

export default TicketFormModal;
