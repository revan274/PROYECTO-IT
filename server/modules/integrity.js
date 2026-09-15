// Auditoría de integridad referencial del documento de estado.
//
// El estado de Mesa IT vive en un único documento JSONB, sin foreign keys ni constraints:
// la base de datos no puede rechazar un ticket que apunta a un activo borrado ni dos
// registros con el mismo id. Esa garantía recae en el código, y este módulo la verifica.
//
// Función pura: recibe el documento y un verificador de existencia de archivos inyectado,
// para poder auditar sin tocar disco (y para que los tests no dependan del sistema real).

const SEVERITY = Object.freeze({
  ALTA: 'alta',
  MEDIA: 'media',
});

function text(value) {
  return String(value ?? '').trim();
}

function nameKey(value) {
  return text(value)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

function findDuplicateIds(rows) {
  const seen = new Set();
  const duplicates = new Set();
  for (const row of rows || []) {
    const id = Number(row?.id);
    if (!Number.isFinite(id)) continue;
    if (seen.has(id)) duplicates.add(id);
    seen.add(id);
  }
  return [...duplicates];
}

/**
 * @param {object} db documento de estado normalizado
 * @param {{ attachmentExists?: (storagePath: string) => boolean }} [options]
 */
export function auditIntegrity(db, options = {}) {
  const attachmentExists = options.attachmentExists || (() => true);
  const issues = [];

  const add = (type, severity, ticketId, detail) => {
    issues.push({ type, severity, ticketId, detail });
  };

  const tickets = Array.isArray(db?.tickets) ? db.tickets : [];
  const activos = Array.isArray(db?.activos) ? db.activos : [];
  const users = Array.isArray(db?.users) ? db.users : [];
  const sucursales = Array.isArray(db?.catalogos?.sucursales) ? db.catalogos.sucursales : [];

  const assetTags = new Set(activos.map((asset) => text(asset?.tag).toUpperCase()).filter(Boolean));
  const userIds = new Set(users.map((user) => Number(user?.id)).filter((id) => Number.isSafeInteger(id) && id > 0));
  const userNames = new Set(users.map((user) => nameKey(user?.nombre)).filter(Boolean));
  const branchCodes = new Set(sucursales.map((branch) => text(branch?.code).toUpperCase()).filter(Boolean));

  for (const ticket of tickets) {
    const ticketId = Number(ticket?.id) || null;

    const activoTag = text(ticket?.activoTag).toUpperCase();
    if (activoTag && !assetTags.has(activoTag)) {
      add('TICKET_ACTIVO_INEXISTENTE', SEVERITY.MEDIA, ticketId,
        `El ticket referencia el activo "${activoTag}", que ya no existe en el inventario.`);
    }

    // Un ticket sin asignar es un estado válido de la operación, no un defecto de integridad.
    const asignadoA = text(ticket?.asignadoA);
    const asignadoAId = Math.trunc(Number(ticket?.asignadoAId));
    const hasAssigneeId = Number.isSafeInteger(asignadoAId) && asignadoAId > 0;
    if (hasAssigneeId && !userIds.has(asignadoAId)) {
      add('TICKET_ASIGNADO_INEXISTENTE', SEVERITY.ALTA, ticketId,
        `El ticket está asignado al usuario #${asignadoAId}, que ya no existe.`);
    } else if (!hasAssigneeId && asignadoA && !userNames.has(nameKey(asignadoA))) {
      add('TICKET_ASIGNADO_INEXISTENTE', SEVERITY.ALTA, ticketId,
        `El ticket está asignado a "${asignadoA}", que no corresponde a ningún usuario actual.`);
    }

    const sucursal = text(ticket?.sucursal).toUpperCase();
    if (sucursal && !branchCodes.has(sucursal)) {
      add('TICKET_SUCURSAL_FUERA_CATALOGO', SEVERITY.MEDIA, ticketId,
        `El ticket usa la sucursal "${sucursal}", ausente del catálogo.`);
    }

    for (const attachment of Array.isArray(ticket?.attachments) ? ticket.attachments : []) {
      const storagePath = text(attachment?.storagePath);
      if (!storagePath || attachmentExists(storagePath)) continue;
      add('ADJUNTO_SIN_ARCHIVO', SEVERITY.ALTA, ticketId,
        `El adjunto "${text(attachment?.fileName) || storagePath}" figura en el ticket pero su archivo no está en disco.`);
    }
  }

  // Fuga inversa: archivos que quedaron en disco tras borrar un ticket o un adjunto.
  // No corrompen registros, pero consumen el volumen indefinidamente y nadie los ve.
  if (typeof options.listStoredFiles === 'function') {
    const referenced = new Set();
    for (const ticket of tickets) {
      for (const attachment of Array.isArray(ticket?.attachments) ? ticket.attachments : []) {
        const stored = text(attachment?.storagePath).replace(/\\/g, '/');
        if (stored) referenced.add(stored.split('/').pop());
      }
    }
    for (const fileName of options.listStoredFiles()) {
      if (referenced.has(fileName)) continue;
      add('ARCHIVO_SIN_REFERENCIA', SEVERITY.MEDIA, null,
        `El archivo "${fileName}" está en el almacenamiento pero ningún ticket lo referencia.`);
    }
  }

  // Sin PRIMARY KEY nada impide dos filas con el mismo id; sería invisible hasta que una
  // actualización afecte al registro equivocado.
  for (const [collection, rows] of [['tickets', tickets], ['activos', activos], ['users', users], ['insumos', db?.insumos]]) {
    for (const id of findDuplicateIds(rows)) {
      add('ID_DUPLICADO', SEVERITY.ALTA, null,
        `La colección "${collection}" tiene más de un registro con id ${id}.`);
    }
  }

  const byType = {};
  for (const issue of issues) {
    byType[issue.type] = (byType[issue.type] || 0) + 1;
  }

  return { issues, counts: { total: issues.length, byType } };
}
