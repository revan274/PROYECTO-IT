export interface TicketSearchContext {
  branchLabel?: unknown;
  asset?: object | null;
}

export function normalizeTicketSearchText(value: unknown): string;
export function tokenizeTicketSearchQuery(value: unknown | readonly unknown[]): string[];
export function buildTicketSearchText(
  ticket: unknown,
  context?: TicketSearchContext,
): string;
export function ticketMatchesSearch(
  ticket: unknown,
  query: unknown | readonly unknown[],
  context?: TicketSearchContext,
): boolean;
