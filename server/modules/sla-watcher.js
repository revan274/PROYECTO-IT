// Vigilante de SLA: avisa antes de que un ticket venza.
//
// Es el unico aviso que nadie "acciona": el disparador es el paso del tiempo, asi que hace
// falta revisar cada cierto rato. La logica de QUE tickets avisar esta separada del
// temporizador a proposito, para poder probarla con un reloj fijo y sin esperar.
//
// Dos decisiones que conviene no perder de vista:
//
// 1. El vencimiento ya se calcula en horas habiles, pero el momento de AVISAR se decide
//    con reloj de pared y solo dentro de la jornada. Un aviso a las 3 de la manana no lo
//    lee nadie y ademas entrena a la gente a ignorar el buzon.
// 2. La constancia de "ya avise" vive en una tabla aparte (ver notification-ledger.js),
//    nunca en el documento JSONB, que se reescribe entero bajo lock global.
import { isWithinBusinessHours } from '../../shared/business-calendar.js';
import { CLOSED_STATES } from '../utils/helpers.js';
import { getSlaCalendar } from './sla-calendar.js';
import { avisar, MOTIVOS, destinatariosDeDifusion } from './ticket-notifications.js';

export const TIPO_AVISO_SLA = 'sla-por-vencer';

/** Minutos de reloj antes del vencimiento en los que se avisa. */
export const MINUTOS_DE_AVISO_POR_DEFECTO = 60;

export function leerMinutosDeAviso(valor = process.env.SLA_WARNING_MINUTES) {
  const parsed = Math.trunc(Number(valor));
  if (!Number.isFinite(parsed) || parsed <= 0) return MINUTOS_DE_AVISO_POR_DEFECTO;
  // Un margen mayor a una jornada haria que todo ticket naciera "por vencer".
  return Math.min(parsed, 12 * 60);
}

/**
 * Tickets que merecen aviso ahora mismo: abiertos, con fecha limite, aun no vencidos,
 * y a menos de `minutos` del vencimiento.
 */
export function ticketsPorVencer(tickets, ahoraMs, minutos = MINUTOS_DE_AVISO_POR_DEFECTO) {
  const ventanaMs = minutos * 60_000;
  return (Array.isArray(tickets) ? tickets : []).filter((ticket) => {
    if (!ticket || CLOSED_STATES.has(ticket.estado)) return false;
    if (!ticket.fechaLimite) return false;
    const vence = new Date(ticket.fechaLimite).getTime();
    if (!Number.isFinite(vence)) return false;
    const restante = vence - ahoraMs;
    // Ya vencido no entra: para eso esta la insignia roja en pantalla, y un correo
    // de "se te paso" no ayuda a nadie a llegar a tiempo.
    return restante > 0 && restante <= ventanaMs;
  });
}

/**
 * Una pasada del vigilante. Devuelve un resumen para que el llamador lo registre.
 * Nunca lanza: un fallo aqui no debe tumbar el proceso del API.
 */
export async function revisarSlaUnaVez({
  leerDb,
  ledger,
  ahoraMs = Date.now(),
  minutos = leerMinutosDeAviso(),
  calendario = getSlaCalendar(),
  enviar = avisar,
  log = console.error,
}) {
  try {
    if (!isWithinBusinessHours(ahoraMs, calendario)) {
      return { revisados: 0, avisados: 0, motivo: 'fuera-de-jornada' };
    }

    const db = await leerDb();
    const candidatos = ticketsPorVencer(db?.tickets, ahoraMs, minutos);
    if (candidatos.length === 0) return { revisados: 0, avisados: 0 };

    const difusion = destinatariosDeDifusion(db?.users);
    let avisados = 0;

    for (const ticket of candidatos) {
      let meToca = false;
      try {
        meToca = await ledger.reclamar(ticket.id, TIPO_AVISO_SLA);
      } catch (error) {
        // Si no se puede dejar constancia, NO se envia: preferimos perder un aviso a
        // mandar el mismo correo en cada vuelta del temporizador.
        log(`No se pudo reservar el aviso de SLA del ticket #${ticket.id}:`, error);
        continue;
      }
      if (!meToca) continue;

      const assigneeId = Math.trunc(Number(ticket?.asignadoAId));
      const responsable = (Array.isArray(db?.users) ? db.users : [])
        .find((user) => user
          && user.email
          && (Number.isSafeInteger(assigneeId) && assigneeId > 0
            ? Number(user.id) === assigneeId
            : user.nombre === ticket.asignadoA));
      // Si tiene responsable, es asunto suyo. Si no lo tiene, que lo vea quien pueda tomarlo.
      const destinatarios = responsable ? [responsable.email] : difusion;

      enviar({ ticket, destinatarios, motivo: MOTIVOS.POR_VENCER });
      avisados += 1;
    }

    return { revisados: candidatos.length, avisados };
  } catch (error) {
    log('El vigilante de SLA fallo en esta vuelta:', error);
    return { revisados: 0, avisados: 0, error };
  }
}

/**
 * Arranca la revision periodica. `unref()` para que el temporizador no impida que el
 * proceso termine, igual que en keepAlive.
 */
export function iniciarVigilanteDeSla({
  leerDb,
  ledger,
  intervaloMs = 10 * 60_000,
  log = console.log,
}) {
  const minutos = leerMinutosDeAviso();
  log(`[SLA] Vigilante activo: revision cada ${Math.round(intervaloMs / 60000)} min, `
    + `aviso a ${minutos} min del vencimiento y solo en jornada laboral.`);

  const temporizador = setInterval(() => {
    revisarSlaUnaVez({ leerDb, ledger, minutos }).then((resumen) => {
      if (resumen.avisados > 0) {
        log(`[SLA] ${resumen.avisados} aviso(s) enviado(s) de ${resumen.revisados} ticket(s) por vencer.`);
      }
    });
  }, intervaloMs);

  temporizador.unref();
  return temporizador;
}
