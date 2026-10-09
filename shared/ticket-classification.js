export const DEFAULT_TICKET_AREAS = Object.freeze([
  { id: 'AREA_RECIBOS', nombre: 'Recibos', activo: true },
  { id: 'AREA_GERENCIA', nombre: 'Gerencia', activo: true },
  { id: 'AREA_CAJAS', nombre: 'Línea de cajas', activo: true },
  { id: 'AREA_TIENDA', nombre: 'Tienda', activo: true },
  { id: 'AREA_MANTENIMIENTO', nombre: 'Mantenimiento', activo: true },
]);

export const DEFAULT_TICKET_CATEGORIES = Object.freeze([
  { id: 'CAT_IMPRESION', areaId: 'AREA_RECIBOS', nombre: 'Impresión y recibos', activo: true },
  { id: 'CAT_ACCESO_RECIBOS', areaId: 'AREA_RECIBOS', nombre: 'Acceso a sistema de recibos', activo: true },
  { id: 'CAT_REPORTES', areaId: 'AREA_GERENCIA', nombre: 'Reportes e indicadores', activo: true },
  { id: 'CAT_ADMINISTRATIVO', areaId: 'AREA_GERENCIA', nombre: 'Sistema administrativo', activo: true },
  { id: 'CAT_POS', areaId: 'AREA_CAJAS', nombre: 'Punto de venta', activo: true },
  { id: 'CAT_PERIFERICOS', areaId: 'AREA_CAJAS', nombre: 'Periféricos de caja', activo: true },
  { id: 'CAT_CONECTIVIDAD', areaId: 'AREA_TIENDA', nombre: 'Conectividad de tienda', activo: true },
  { id: 'CAT_OPERACION_TIENDA', areaId: 'AREA_TIENDA', nombre: 'Operación de tienda', activo: true },
  { id: 'CAT_INFRAESTRUCTURA', areaId: 'AREA_MANTENIMIENTO', nombre: 'Infraestructura', activo: true },
  { id: 'CAT_COMUNICACIONES', areaId: 'AREA_MANTENIMIENTO', nombre: 'Redes y comunicaciones', activo: true },
]);

const text = (value) => String(value || '').trim();
const key = (value) => text(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const id = (value, prefix) => text(value).toUpperCase().replace(/[^A-Z0-9_]/g, '_').replace(/_+/g, '_').slice(0, 64) || prefix;

function normalizeRows(rows, defaults, kind) {
  const result = new Map();
  for (const raw of Array.isArray(rows) && rows.length ? rows : defaults) {
    if (!raw || typeof raw !== 'object') continue;
    const normalized = {
      id: id(raw.id, kind),
      nombre: text(raw.nombre || raw.name).slice(0, 120),
      activo: raw.activo !== false,
      ...(kind === 'CAT' ? { areaId: id(raw.areaId, 'AREA') } : {}),
    };
    if (!normalized.id || !normalized.nombre || (kind === 'CAT' && !normalized.areaId)) continue;
    if (!result.has(normalized.id)) result.set(normalized.id, normalized);
  }
  return [...result.values()];
}

export function normalizeTicketClassificationCatalogs(source = {}) {
  const areas = normalizeRows(source.areas, DEFAULT_TICKET_AREAS, 'AREA');
  const areaIds = new Set(areas.map((area) => area.id));
  const categorias = normalizeRows(source.categorias, DEFAULT_TICKET_CATEGORIES, 'CAT')
    .filter((category) => areaIds.has(category.areaId));
  return { areas, categorias };
}

export function resolveTicketClassification(catalogs, raw = {}) {
  const areaById = new Map(catalogs.areas.map((area) => [area.id, area]));
  const categoryById = new Map(catalogs.categorias.map((category) => [category.id, category]));
  const area = areaById.get(id(raw.areaId, ''));
  const category = categoryById.get(id(raw.categoriaId, ''));
  if (!area || !category || category.areaId !== area.id) return null;
  return { areaId: area.id, areaNombre: area.nombre, categoriaId: category.id, categoriaNombre: category.nombre };
}

export function migrateLegacyTicketClassification(ticket, catalogs) {
  if (ticket.areaId || ticket.categoriaId) return ticket;
  const description = text(ticket.descripcion);
  const match = description.match(/^(?:[aá]rea afectada:)\s*([^|]+)\|\s*(.*)$/i);
  if (!match) return { ...ticket, clasificacionPendiente: true };
  const areas = catalogs.areas.filter((area) => key(area.nombre) === key(match[1]));
  if (areas.length !== 1) return { ...ticket, clasificacionPendiente: true };
  const categories = catalogs.categorias.filter((category) => category.areaId === areas[0].id && key(category.nombre) === key(match[2]));
  return {
    ...ticket,
    areaId: areas[0].id,
    areaNombre: areas[0].nombre,
    ...(categories.length === 1 ? { categoriaId: categories[0].id, categoriaNombre: categories[0].nombre } : { clasificacionPendiente: true }),
    descripcion: match[2],
  };
}
