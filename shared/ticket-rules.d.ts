export type SharedTicketState = 'Abierto' | 'En Proceso' | 'En Espera' | 'Resuelto' | 'Cerrado';
export type SharedTicketPriority = 'MEDIA' | 'ALTA' | 'CRITICA';

export const TICKET_STATES: readonly SharedTicketState[];
export const CLOSED_TICKET_STATES: readonly SharedTicketState[];
export const ACTIVE_ASSET_TICKET_STATES: readonly SharedTicketState[];
export const SLA_POLICY_HOURS: Readonly<Record<SharedTicketPriority, number>>;

export function isClosedTicketState(state: unknown): boolean;
export function keepsAssetInFailureState(state: unknown): boolean;
