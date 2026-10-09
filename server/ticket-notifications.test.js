import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  MOTIVOS,
  construirCorreoDeTicket,
  destinatariosDeDifusion,
  planDeAvisoAlCrear,
  planDeAvisoAlResolver,
  planDeAvisoDeComentario,
} from './modules/ticket-notifications.js';

const USUARIOS = [
  { id: 1, nombre: 'Ana Admin', rol: 'admin', activo: true, email: 'ana@losgigantes.mx' },
  { id: 2, nombre: 'Tono Tecnico', rol: 'tecnico', activo: true, email: 'tono@losgigantes.mx' },
  { nombre: 'Tecnico Sin Correo', rol: 'tecnico', activo: true, email: '' },
  { nombre: 'Tecnico Inactivo', rol: 'tecnico', activo: false, email: 'baja@losgigantes.mx' },
  { id: 5, nombre: 'Sara Solicitante', rol: 'solicitante', activo: true, email: 'sara@losgigantes.mx' },
];

function ticket(extra = {}) {
  return {
    id: 900,
    prioridad: 'MEDIA',
    activoTag: 'POS-001',
    sucursal: 'TJ01',
    atencionTipo: 'REMOTO',
    descripcion: 'La terminal no responde',
    solicitadoPor: 'Sara Solicitante',
    asignadoA: '',
    fechaLimite: '2026-09-10T14:00:00.000Z',
    ...extra,
  };
}

test('la difusion solo alcanza a quien puede atender tickets y tiene correo', () => {
  const destinos = destinatariosDeDifusion(USUARIOS);

  assert.deepEqual(destinos.sort(), ['ana@losgigantes.mx', 'tono@losgigantes.mx']);
  // Un solicitante no atiende tickets: recibir la difusion seria ruido y fuga de contexto.
  assert.ok(!destinos.includes('sara@losgigantes.mx'));
  assert.ok(!destinos.includes('baja@losgigantes.mx'), 'un usuario dado de baja no debe recibir nada');
});

test('la difusion tolera una lista ausente o corrupta sin lanzar', () => {
  assert.deepEqual(destinatariosDeDifusion(undefined), []);
  assert.deepEqual(destinatariosDeDifusion([null, undefined, {}]), []);
});

test('un ticket critico se difunde aunque ya tenga responsable', () => {
  const { motivo, destinatarios } = planDeAvisoAlCrear(
    ticket({ prioridad: 'CRITICA', asignadoA: 'Tono Tecnico' }),
    USUARIOS,
    'mesa@losgigantes.mx',
  );

  assert.equal(motivo, MOTIVOS.CRITICO);
  assert.ok(destinatarios.includes('ana@losgigantes.mx'));
  assert.ok(destinatarios.includes('tono@losgigantes.mx'));
  assert.ok(destinatarios.includes('mesa@losgigantes.mx'));
});

test('un ticket sin asignar se difunde para que alguien lo tome', () => {
  const { motivo, destinatarios } = planDeAvisoAlCrear(ticket(), USUARIOS, 'mesa@losgigantes.mx');

  assert.equal(motivo, MOTIVOS.SIN_ASIGNAR);
  assert.ok(destinatarios.includes('tono@losgigantes.mx'));
});

test('un ticket normal ya asignado NO se difunde: solo su responsable y el buzon general', () => {
  const { motivo, destinatarios } = planDeAvisoAlCrear(
    ticket({ asignadoA: 'Tono Tecnico' }),
    USUARIOS,
    'mesa@losgigantes.mx',
  );

  assert.equal(motivo, MOTIVOS.ASIGNADO);
  assert.deepEqual(destinatarios.sort(), ['mesa@losgigantes.mx', 'tono@losgigantes.mx']);
  assert.ok(!destinatarios.includes('ana@losgigantes.mx'), 'no debe molestar a quien no le toca');
});

test('el responsable no aparece dos veces cuando ademas hay difusion', () => {
  const { destinatarios } = planDeAvisoAlCrear(
    ticket({ prioridad: 'CRITICA', asignadoA: 'Tono Tecnico' }),
    USUARIOS,
    'mesa@losgigantes.mx',
  );

  const repetidos = destinatarios.filter((d) => d === 'tono@losgigantes.mx');
  assert.equal(repetidos.length, 1);
});

test('sin buzon general configurado el aviso sigue saliendo a quien corresponde', () => {
  const { destinatarios } = planDeAvisoAlCrear(ticket(), USUARIOS, '');

  assert.ok(destinatarios.length > 0);
  assert.ok(!destinatarios.includes(''));
});

test('el motivo cambia el asunto y la entrada del mensaje', () => {
  const critico = construirCorreoDeTicket(ticket({ prioridad: 'CRITICA' }), MOTIVOS.CRITICO);
  const asignado = construirCorreoDeTicket(ticket(), MOTIVOS.ASIGNADO);

  assert.match(critico.subject, /CRITICO/);
  assert.match(asignado.subject, /asignaron/i);
  assert.notEqual(critico.text, asignado.text);
});

test('el cuerpo HTML escapa lo que escribe el usuario', () => {
  const { html } = construirCorreoDeTicket(
    ticket({ descripcion: '<script>alert("x")</script>' }),
    MOTIVOS.NUEVO,
  );

  assert.ok(!html.includes('<script>'), 'la descripcion no debe inyectar etiquetas');
  assert.ok(html.includes('&lt;script&gt;'));
});

test('la resolución se dirige solo al solicitante identificado por ID', () => {
  const plan = planDeAvisoAlResolver(ticket({ requesterUserId: 5 }), USUARIOS);

  assert.equal(plan.motivo, MOTIVOS.RESUELTO);
  assert.deepEqual(plan.destinatarios, ['sara@losgigantes.mx']);
  assert.deepEqual(planDeAvisoAlResolver(ticket({ requesterUserId: null }), USUARIOS).destinatarios, []);
});

test('el aviso de resolución contiene solo el resumen operativo solicitado', () => {
  const message = construirCorreoDeTicket(ticket({
    solucionAplicada: 'Se reemplazó el cable.',
    asignadoA: 'Tono Tecnico',
    fechaResolucion: '2026-09-10T12:00:00.000Z',
  }), MOTIVOS.RESUELTO);

  assert.match(message.subject, /Resuelto.*#900/i);
  assert.match(message.text, /Resumen: La terminal no responde/);
  assert.match(message.text, /Solución: Se reemplazó el cable/);
  assert.match(message.text, /Técnico: Tono Tecnico/);
  assert.match(message.text, /Fecha: 2026-09-10/);
  assert.doesNotMatch(message.text, /Fecha límite|Sucursal|Solicitado por|Prioridad/);
});

test('un comentario marcado dirige la respuesta al otro participante sin difusión', () => {
  const assigned = ticket({ requesterUserId: 5, asignadoAId: 2 });
  assert.deepEqual(
    planDeAvisoDeComentario(assigned, USUARIOS, { id: 5 }, 'mesa@losgigantes.mx').destinatarios,
    ['tono@losgigantes.mx'],
  );
  assert.deepEqual(
    planDeAvisoDeComentario(assigned, USUARIOS, { id: 2 }, 'mesa@losgigantes.mx').destinatarios,
    ['sara@losgigantes.mx'],
  );
  assert.deepEqual(
    planDeAvisoDeComentario(assigned, USUARIOS, { id: 1 }, 'mesa@losgigantes.mx').destinatarios,
    ['sara@losgigantes.mx'],
  );
});

test('un solicitante sin técnico usa solo el buzón general y el correo omite datos internos', () => {
  const plan = planDeAvisoDeComentario(ticket({ requesterUserId: 5, asignadoAId: null }), USUARIOS, { id: 5 }, 'mesa@losgigantes.mx');
  assert.deepEqual(plan.destinatarios, ['mesa@losgigantes.mx']);
  const message = construirCorreoDeTicket(ticket({
    comentarioRelevante: 'Confirma si ya puedes ingresar.',
    comentarioAutor: 'Tono Tecnico',
    comentarioFecha: '2026-09-10T13:00:00.000Z',
  }), MOTIVOS.COMENTARIO_RESPUESTA);
  assert.match(message.text, /Comentario: Confirma si ya puedes ingresar/);
  assert.match(message.text, /Autor: Tono Tecnico/);
  assert.doesNotMatch(message.text, /Activo|Sucursal|Fecha límite|Prioridad/);
});
