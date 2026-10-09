const tagKey = (value) => String(value || '').trim().toUpperCase();

export function resolveAssetBranchCode(asset, validBranchCodes) {
  const department = tagKey(asset?.departamento);
  if (validBranchCodes.has(department)) return department;
  const tokens = tagKey(asset?.ubicacion).split(/[^A-Z0-9]+/).filter(Boolean);
  return tokens.find((token) => validBranchCodes.has(token)) || '';
}

export function ticketReferencesAsset(ticket, asset) {
  return Number(ticket.activoId) === Number(asset.id)
    || (Boolean(tagKey(ticket.activoTag)) && tagKey(ticket.activoTag) === tagKey(asset.tag));
}

// Only unique legacy tags can be migrated. An explicit missing ID must never
// be reassigned to a different asset that happens to reuse its former tag.
export function linkTicketAssets(db) {
  const byId = new Map(db.activos.map((asset) => [Number(asset.id), asset]));
  const byTag = new Map();
  for (const asset of db.activos) {
    const key = tagKey(asset.tag);
    byTag.set(key, byTag.has(key) ? null : asset);
  }
  for (const ticket of db.tickets) {
    const id = Number(ticket.activoId);
    const hasId = Number.isSafeInteger(id) && id > 0;
    const asset = hasId ? byId.get(id) : ticket.activoReferenciaPendiente ? null : byTag.get(tagKey(ticket.activoTag));
    if (asset) {
      ticket.activoId = asset.id;
      ticket.activoTag = asset.tag;
      delete ticket.activoReferenciaPendiente;
    } else if (hasId || ticket.activoTag) {
      ticket.activoId = hasId ? id : null;
      ticket.activoReferenciaPendiente = true;
    }
  }
}
