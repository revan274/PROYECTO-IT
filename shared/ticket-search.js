const SEARCHABLE_ASSET_FIELDS = Object.freeze([
  'id',
  'tag',
  'tipo',
  'equipo',
  'nombreVisible',
  'marca',
  'modelo',
  'serial',
  'idInterno',
  'ubicacion',
  'responsable',
]);

export function normalizeTicketSearchText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

export function tokenizeTicketSearchQuery(value) {
  const source = Array.isArray(value) ? value.join(' ') : value;
  const normalized = normalizeTicketSearchText(source);
  return normalized ? normalized.split(' ').filter(Boolean) : [];
}

export function buildTicketSearchText(ticket, context = {}) {
  const asset = context.asset && typeof context.asset === 'object' ? context.asset : null;
  const assetFields = asset
    ? SEARCHABLE_ASSET_FIELDS.map((field) => asset[field])
    : [];
  const values = [
    ticket?.id,
    `folio ${ticket?.id ?? ''}`,
    `#${ticket?.id ?? ''}`,
    ticket?.solicitadoPor,
    ticket?.solicitadoPorUsername,
    ticket?.requesterUserId,
    ticket?.asignadoA,
    ticket?.asignadoAId,
    ticket?.activoId,
    ticket?.activoTag,
    ...assetFields,
    ticket?.descripcion,
    ticket?.sucursal,
    context.branchLabel,
    ticket?.categoriaId,
    ticket?.categoriaNombre,
    ticket?.areaId,
    ticket?.areaNombre,
    String(ticket?.atencionTipo || '').replaceAll('_', ' '),
  ];
  return normalizeTicketSearchText(values.filter((value) => value !== null && value !== undefined).join(' '));
}

export function ticketMatchesSearch(ticket, query, context = {}) {
  const tokens = tokenizeTicketSearchQuery(query);
  if (tokens.length === 0) return true;
  const searchable = buildTicketSearchText(ticket, context);
  return tokens.every((token) => searchable.includes(token));
}
