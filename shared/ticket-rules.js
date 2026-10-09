export const TICKET_STATES = Object.freeze([
  'Abierto',
  'En Proceso',
  'En Espera',
  'Resuelto',
  'Cerrado',
  'Cancelado',
]);

export const CLOSED_TICKET_STATES = Object.freeze(['Resuelto', 'Cerrado', 'Cancelado']);

export const ACTIVE_ASSET_TICKET_STATES = Object.freeze([
  'Abierto',
  'En Proceso',
  'En Espera',
]);

export const SLA_POLICY_HOURS = Object.freeze({
  MEDIA: 24,
  ALTA: 8,
  CRITICA: 2,
});

export const TICKET_REQUEST_TYPES = Object.freeze(['INCIDENTE_ACTIVO', 'SOLICITUD_SERVICIO']);

export function parseTicketRequestType(value) {
  const normalized = typeof value === 'string' ? value.trim().toUpperCase() : '';
  return TICKET_REQUEST_TYPES.includes(normalized) ? normalized : null;
}

export function parseTicketPriority(value) {
  const normalized = typeof value === 'string' ? value.trim().toUpperCase() : '';
  return Object.hasOwn(SLA_POLICY_HOURS, normalized) ? normalized : null;
}

const CLOSED_TICKET_STATE_SET = new Set(CLOSED_TICKET_STATES);
const ACTIVE_ASSET_TICKET_STATE_SET = new Set(ACTIVE_ASSET_TICKET_STATES);

export function isClosedTicketState(state) {
  return CLOSED_TICKET_STATE_SET.has(state);
}

export function keepsAssetInFailureState(state) {
  return ACTIVE_ASSET_TICKET_STATE_SET.has(state);
}

const TRANSITIONS = Object.freeze({
  Abierto: ['En Proceso', 'En Espera', 'Resuelto'],
  'En Proceso': ['En Espera', 'Resuelto'],
  'En Espera': ['En Proceso', 'Resuelto'],
  Resuelto: ['Cerrado', 'Abierto'],
  Cerrado: ['Abierto'],
  Cancelado: [],
});

export function ticketTransitionTargets(state) {
  return [...(TRANSITIONS[state] || [])];
}

export function isTicketReopening(previous, next) {
  return ['Resuelto', 'Cerrado'].includes(previous) && next === 'Abierto';
}

export function canTransitionTicket(previous, next) {
  return previous === next || ticketTransitionTargets(previous).includes(next);
}
