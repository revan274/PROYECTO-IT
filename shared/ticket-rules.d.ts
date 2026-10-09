export type SharedTicketState = 'Abierto' | 'En Proceso' | 'En Espera' | 'Resuelto' | 'Cerrado' | 'Cancelado';
export type SharedTicketPriority = 'MEDIA' | 'ALTA' | 'CRITICA';
export type SharedTicketRequestType = 'INCIDENTE_ACTIVO' | 'SOLICITUD_SERVICIO';

export const TICKET_STATES: readonly SharedTicketState[];
export const CLOSED_TICKET_STATES: readonly SharedTicketState[];
export const ACTIVE_ASSET_TICKET_STATES: readonly SharedTicketState[];
export const SLA_POLICY_HOURS: Readonly<Record<SharedTicketPriority, number>>;
export const TICKET_REQUEST_TYPES: readonly SharedTicketRequestType[];
export function parseTicketRequestType(value: unknown): SharedTicketRequestType | null;
export function parseTicketPriority(value: unknown): SharedTicketPriority | null;

export function isClosedTicketState(state: unknown): boolean;
export function keepsAssetInFailureState(state: unknown): boolean;
export function ticketTransitionTargets(state: string): SharedTicketState[];
export function isTicketReopening(previous: string, next: string): boolean;
export function canTransitionTicket(previous: string, next: string): boolean;
