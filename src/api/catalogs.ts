import type { CatalogState, TicketAreaCatalogItem, TicketCategoryCatalogItem } from '../types/app';
import { apiRequest } from '../utils/api';

export function updateTicketClassificationCatalogs(
  areas: TicketAreaCatalogItem[],
  categorias: TicketCategoryCatalogItem[],
) {
  return apiRequest<CatalogState & { updatedAt: string }>('/catalogos', {
    method: 'PATCH',
    body: JSON.stringify({ areas, categorias }),
  });
}
