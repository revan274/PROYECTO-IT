import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  MOTIVOS,
  construirCorreoDeTicket,
  destinatariosDeDifusion,
  planDeAvisoAlCrear,
} from './modules/ticket-notifications.js';

const USUARIOS = [
  { nombre: 'Ana Admin', rol: 'admin', activo: true, email: 'ana@losgigantes.mx' },
  { nombre: 'Tono Tecnico', rol: 'tecnico', activo: true, email: 'tono@losgigantes.mx' },
  { nombre: 'Tecnico Sin Correo', rol: 'tecnico', activo: true, email: '' },
  { nombre: 'Tecnico Inactivo', rol: 'tecnico', activo: false, email: 'baja@losgigantes.mx' },
  { nombre: 'Sara Solicitante', rol: 'solicitante', activo: true, email: 'sara@losgigantes.mx' },
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
