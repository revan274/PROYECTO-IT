export type TicketWaitReasonValue = 'USUARIO' | 'PROVEEDOR' | 'REFACCION' | 'AUTORIZACION';
export interface TicketWaitReasonPolicy {
  value: TicketWaitReasonValue;
  label: string;
  pausaSla: boolean;
}
export const TICKET_WAIT_REASONS: readonly TicketWaitReasonPolicy[];
export function parseTicketWaitReason(value: unknown): TicketWaitReasonPolicy | null;
