export const TICKET_WAIT_REASONS = Object.freeze([
  Object.freeze({ value: 'USUARIO', label: 'En espera del usuario', pausaSla: true }),
  Object.freeze({ value: 'PROVEEDOR', label: 'En espera del proveedor', pausaSla: true }),
  Object.freeze({ value: 'REFACCION', label: 'En espera de refacción', pausaSla: true }),
  Object.freeze({ value: 'AUTORIZACION', label: 'En espera de autorización', pausaSla: false }),
]);

export function parseTicketWaitReason(value) {
  const normalized = typeof value === 'string' ? value.trim().toUpperCase() : '';
  return TICKET_WAIT_REASONS.find((reason) => reason.value === normalized) || null;
}
