export const TICKET_STATES = Object.freeze([
  'Abierto',
  'En Proceso',
  'En Espera',
  'Resuelto',
  'Cerrado',
]);

export const CLOSED_TICKET_STATES = Object.freeze(['Resuelto', 'Cerrado']);

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

const CLOSED_TICKET_STATE_SET = new Set(CLOSED_TICKET_STATES);
const ACTIVE_ASSET_TICKET_STATE_SET = new Set(ACTIVE_ASSET_TICKET_STATES);

export function isClosedTicketState(state) {
  return CLOSED_TICKET_STATE_SET.has(state);
}

export function keepsAssetInFailureState(state) {
  return ACTIVE_ASSET_TICKET_STATE_SET.has(state);
}
