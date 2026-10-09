// Avisos por correo de tickets. Vive fuera de routes/tickets.js porque el armado del
// mensaje y la eleccion de destinatarios son decisiones propias, no parte del manejo
// de la peticion, y asi se pueden probar sin levantar el router.
//
// Regla que no se negocia: un fallo de correo NUNCA debe tumbar ni retrasar la
// operacion que lo dispara. Todo sale en fire-and-forget y el error solo se registra.
import { roleHasPermission } from '../../shared/permissions.js';
import { sendMail, getNotifyTicketEmail, dedupeRecipients } from './mailer.js';

/** Motivos de aviso. El motivo decide el asunto y la primera linea del cuerpo. */
export const MOTIVOS = Object.freeze({
  CRITICO: 'critico',
  SIN_ASIGNAR: 'sin-asignar',
  ASIGNADO: 'asignado',
  POR_VENCER: 'por-vencer',
  NUEVO: 'nuevo',
  RESUELTO: 'resuelto',
  COMENTARIO_RESPUESTA: 'comentario-respuesta',
});

const ENCABEZADO_POR_MOTIVO = Object.freeze({
  [MOTIVOS.CRITICO]: {
    asunto: (t) => `[Mesa IT] CRITICO · Ticket #${t.id}`,
    entrada: 'Se registro un ticket de prioridad CRITICA.',
  },
  [MOTIVOS.SIN_ASIGNAR]: {
    asunto: (t) => `[Mesa IT] Sin asignar · Ticket #${t.id}`,
    entrada: 'Entro un ticket que todavia no tiene tecnico asignado.',
  },
  [MOTIVOS.ASIGNADO]: {
    asunto: (t) => `[Mesa IT] Te asignaron el ticket #${t.id}`,
    entrada: 'Se te asigno un ticket en Mesa IT.',
  },
  [MOTIVOS.POR_VENCER]: {
    asunto: (t) => `[Mesa IT] Por vencer · Ticket #${t.id}`,
    entrada: 'Este ticket esta por agotar su tiempo de atencion (SLA).',
  },
  [MOTIVOS.NUEVO]: {
    asunto: (t) => `[Mesa IT] Nuevo ticket #${t.id} — ${t.prioridad}`,
    entrada: 'Se registro un nuevo ticket en Mesa IT.',
  },
  [MOTIVOS.RESUELTO]: {
    asunto: (t) => `[Mesa IT] Resuelto · Ticket #${t.id}`,
    entrada: 'Tu solicitud fue resuelta por Mesa IT.',
  },
  [MOTIVOS.COMENTARIO_RESPUESTA]: {
    asunto: (t) => `[Mesa IT] Respuesta requerida · Ticket #${t.id}`,
    entrada: 'Hay un comentario que requiere tu respuesta.',
  },
});

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Quien puede atender tickets y tiene correo. Se resuelve por permiso y no por
 * literal de rol, para que un rol nuevo del catalogo entre solo si de verdad
 * puede trabajar tickets.
 */
export function destinatariosDeDifusion(users) {
  const ROLES_AVISO = new Set(['tecnico', 'administrador', 'desarrollador', 'admin']);
  return (Array.isArray(users) ? users : [])
    .filter((user) => {
      if (!user || user.activo === false || !user.email) return false;
      const rol = String(user.rol || '').trim().toLowerCase();
      return ROLES_AVISO.has(rol) || roleHasPermission(user.rol, 'tickets.update');
    })
    .map((user) => user.email);
}

export function construirCorreoDeTicket(ticket, motivo = MOTIVOS.NUEVO) {
  const encabezado = ENCABEZADO_POR_MOTIVO[motivo] || ENCABEZADO_POR_MOTIVO[MOTIVOS.NUEVO];
  const filas = motivo === MOTIVOS.RESUELTO
    ? [
        ['Ticket', `#${ticket.id}`],
        ['Resumen', ticket.descripcion],
        ['Solución', ticket.solucionAplicada],
        ['Técnico', ticket.asignadoA || 'Mesa IT'],
        ['Fecha', ticket.fechaResolucion],
      ]
    : motivo === MOTIVOS.COMENTARIO_RESPUESTA
      ? [
          ['Ticket', `#${ticket.id}`],
          ['Comentario', ticket.comentarioRelevante],
          ['Autor', ticket.comentarioAutor],
          ['Fecha', ticket.comentarioFecha],
        ]
      : [
        ['Ticket', `#${ticket.id}`],
        ['Prioridad', ticket.prioridad],
        ['Activo', ticket.activoTag],
        ['Sucursal', ticket.sucursal],
        ['Tipo de atención', ticket.atencionTipo || 'Sin definir'],
        ['Descripción', ticket.descripcion],
        ['Solicitado por', ticket.solicitadoPor],
        ['Asignado a', ticket.asignadoA || 'Sin asignar'],
        ['Fecha límite (SLA)', ticket.fechaLimite],
      ];
  const subject = encabezado.asunto(ticket);
  const text = [encabezado.entrada, '', ...filas.map(([k, v]) => `${k}: ${v}`)].join('\n');
  const html = `
      <div style="font-family:Arial,sans-serif;font-size:14px;color:#1f2937;">
        <p>${escapeHtml(encabezado.entrada)}</p>
        <table cellpadding="6" cellspacing="0" style="border-collapse:collapse;">
          ${filas.map(([label, value]) => `
            <tr>
              <td style="font-weight:bold;border-bottom:1px solid #e5e7eb;">${escapeHtml(label)}</td>
              <td style="border-bottom:1px solid #e5e7eb;">${escapeHtml(value)}</td>
            </tr>`).join('')}
        </table>
      </div>`;
  return { subject, text, html };
}

/**
 * Decide motivo y destinatarios para un ticket recien creado, en UN solo correo.
 * Un critico sin asignar cumple dos condiciones a la vez; mandar dos mensajes por
 * el mismo ticket es la via rapida a que dejen de leerlos.
 */
export function planDeAvisoAlCrear(ticket, users, buzonGeneral = getNotifyTicketEmail()) {
  const esCritico = String(ticket?.prioridad || '').trim().toUpperCase() === 'CRITICA';
  const sinAsignar = !String(ticket?.asignadoA || '').trim();
  const assigneeId = Math.trunc(Number(ticket?.asignadoAId));
  const asignado = (Array.isArray(users) ? users : [])
    .find((user) => user
      && user.email
      && (Number.isSafeInteger(assigneeId) && assigneeId > 0
        ? Number(user.id) === assigneeId
        : user.nombre === ticket?.asignadoA));

  let motivo = MOTIVOS.NUEVO;
  if (esCritico) motivo = MOTIVOS.CRITICO;
  else if (sinAsignar) motivo = MOTIVOS.SIN_ASIGNAR;
  else if (asignado) motivo = MOTIVOS.ASIGNADO;

  // La difusion se reserva para lo que de verdad requiere que alguien reaccione:
  // un critico, o trabajo que nadie ha tomado. Un ticket normal ya asignado solo
  // molesta a su responsable y al buzon general.
  const difunde = esCritico || sinAsignar;
  // Se deduplica aqui y no solo al enviar: el responsable suele estar tambien en la
  // lista de difusion, y un plan con destinatarios repetidos es un plan que miente.
  const destinatarios = dedupeRecipients([
    buzonGeneral,
    ...(difunde ? destinatariosDeDifusion(users) : []),
    asignado?.email,
  ].filter(Boolean));

  return { motivo, destinatarios };
}

export function planDeAvisoAlResolver(ticket, users) {
  const requesterId = Math.trunc(Number(ticket?.requesterUserId || ticket?.solicitadoPorId));
  if (!Number.isSafeInteger(requesterId) || requesterId <= 0) {
    return { motivo: MOTIVOS.RESUELTO, destinatarios: [] };
  }
  const requester = (Array.isArray(users) ? users : [])
    .find((user) => Number(user?.id) === requesterId && user?.activo !== false && user?.email);
  return {
    motivo: MOTIVOS.RESUELTO,
    destinatarios: dedupeRecipients([requester?.email].filter(Boolean)),
  };
}

export function planDeAvisoDeComentario(ticket, users, actor, buzonGeneral = getNotifyTicketEmail()) {
  const actorId = Math.trunc(Number(actor?.id));
  const requesterId = Math.trunc(Number(ticket?.requesterUserId || ticket?.solicitadoPorId));
  const assigneeId = Math.trunc(Number(ticket?.asignadoAId));
  const actorIsRequester = Number.isSafeInteger(requesterId) && requesterId > 0 && actorId === requesterId;
  const targetId = actorIsRequester ? assigneeId : requesterId;
  const target = (Array.isArray(users) ? users : [])
    .find((user) => Number(user?.id) === targetId && user?.activo !== false && user?.email && Number(user.id) !== actorId);
  const fallback = actorIsRequester && (!Number.isSafeInteger(assigneeId) || assigneeId <= 0)
    ? buzonGeneral
    : '';
  return {
    motivo: MOTIVOS.COMENTARIO_RESPUESTA,
    destinatarios: dedupeRecipients([target?.email, fallback].filter(Boolean)),
  };
}

/** Envia sin esperar. Devuelve la promesa solo para que las pruebas puedan aguardarla. */
export function avisar({ ticket, destinatarios, motivo, log = console.error }) {
  const finales = dedupeRecipients(destinatarios);
  if (finales.length === 0) return Promise.resolve({ sent: false, reason: 'SIN_DESTINATARIOS' });

  const { subject, text, html } = construirCorreoDeTicket(ticket, motivo);
  return sendMail({ to: finales, subject, text, html })
    .then((resultado) => {
      if (!resultado.sent && resultado.reason === 'SEND_ERROR') {
        log(`No se pudo avisar del ticket #${ticket.id} por correo:`, resultado.error);
      }
      return resultado;
    })
    .catch((error) => {
      log(`No se pudo avisar del ticket #${ticket.id} por correo:`, error);
      return { sent: false, reason: 'SEND_ERROR', error };
    });
}
