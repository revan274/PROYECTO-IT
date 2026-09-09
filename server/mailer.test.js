import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';

// mailer.js lee sus variables de entorno una sola vez al importarse, así que cada escenario
// se ejecuta en un subproceso propio con su propio entorno (mismo patrón que qr-token.test.js).
function runMailerScript(env, script) {
  return spawnSync(
    process.execPath,
    ['--input-type=module', '--eval', script],
    {
      cwd: process.cwd(),
      encoding: 'utf8',
      env: { ...process.env, ...env },
    },
  );
}

test('mailer queda deshabilitado sin SMTP_USER/SMTP_PASS y sendMail no intenta enviar', () => {
  const result = runMailerScript(
    { SMTP_USER: '', SMTP_PASS: '', NOTIFY_TICKET_EMAIL: '' },
    `
      const mod = await import('./server/modules/mailer.js');
      console.log(JSON.stringify({
        enabled: mod.isMailEnabled(),
        send: await mod.sendMail({ to: 'destino@ejemplo.com', subject: 'x', text: 'x' }),
      }));
    `,
  );

  assert.equal(result.status, 0, result.stderr);
  const parsed = JSON.parse(result.stdout.trim());
  assert.equal(parsed.enabled, false);
  assert.equal(parsed.send.sent, false);
  assert.equal(parsed.send.reason, 'MAIL_DISABLED');
});

test('mailer habilitado pero sin destinatarios válidos no intenta conectar por SMTP', () => {
  const result = runMailerScript(
    { SMTP_USER: 'bot@ejemplo.com', SMTP_PASS: 'clave-app', MAIL_FROM: 'Mesa IT <bot@ejemplo.com>' },
    `
      const mod = await import('./server/modules/mailer.js');
      console.log(JSON.stringify({
        enabled: mod.isMailEnabled(),
        send: await mod.sendMail({ to: ['no-es-un-correo', ''], subject: 'x', text: 'x' }),
      }));
    `,
  );

  assert.equal(result.status, 0, result.stderr);
  const parsed = JSON.parse(result.stdout.trim());
  assert.equal(parsed.enabled, true);
  assert.equal(parsed.send.sent, false);
  assert.equal(parsed.send.reason, 'NO_VALID_RECIPIENTS');
});

test('dedupeRecipients filtra inválidos y deduplica sin distinguir mayúsculas', async () => {
  const { dedupeRecipients } = await import('./modules/mailer.js');
  const result = dedupeRecipients(['A@Ejemplo.com', 'a@ejemplo.com', 'no-valido', '', 'b@ejemplo.com']);
  assert.deepEqual(result, ['a@ejemplo.com', 'b@ejemplo.com']);
});

test('getNotifyTicketEmail refleja NOTIFY_TICKET_EMAIL', () => {
  const result = runMailerScript(
    { NOTIFY_TICKET_EMAIL: '  it@ejemplo.com  ' },
    `
      const mod = await import('./server/modules/mailer.js');
      console.log(mod.getNotifyTicketEmail());
    `,
  );

  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), 'it@ejemplo.com');
});

test('maskEmail deja reconocer la cuenta sin revelarla', async () => {
  const { maskEmail } = await import('./modules/mailer.js');

  assert.equal(maskEmail('jramospalomares274@gmail.com'), 'jr***74@gmail.com');
  assert.equal(maskEmail('ana@losgigantes.mx'), 'a***@losgigantes.mx');
  assert.equal(maskEmail(''), '');
  assert.equal(maskEmail('sin-arroba'), '***');
});

test('getMailSettings nombra las variables que faltan y NUNCA expone la contrasena', () => {
  const result = runMailerScript(
    { SMTP_USER: 'bot@ejemplo.com', SMTP_PASS: '', MAIL_FROM: '', NOTIFY_TICKET_EMAIL: '' },
    `
      const mod = await import('./server/modules/mailer.js');
      console.log(JSON.stringify(mod.getMailSettings()));
    `,
  );

  assert.equal(result.status, 0, result.stderr);
  const settings = JSON.parse(result.stdout.trim());
  assert.equal(settings.habilitado, false);
  // MAIL_FROM cae por defecto a SMTP_USER, asi que no se reporta como faltante: en la
  // practica basta configurar SMTP_USER y SMTP_PASS para que el correo salga.
  assert.deepEqual(settings.faltantes, ['SMTP_PASS']);
  // El diagnostico viaja por HTTP: una contrasena de aplicacion de Gmail da acceso a
  // la cuenta entera, asi que no puede aparecer bajo ninguna clave.
  assert.ok(!JSON.stringify(settings).includes('SMTP_PASS='));
  assert.equal(Object.keys(settings).includes('contrasena'), false);
});

test('el diagnostico enmascara usuario y buzon general', () => {
  const result = runMailerScript(
    {
      SMTP_USER: 'bot.mesait@ejemplo.com',
      SMTP_PASS: 'clave-de-aplicacion',
      MAIL_FROM: 'Mesa IT <bot.mesait@ejemplo.com>',
      NOTIFY_TICKET_EMAIL: 'soporte@losgigantes.mx',
    },
    `
      const mod = await import('./server/modules/mailer.js');
      console.log(JSON.stringify(mod.getMailSettings()));
    `,
  );

  assert.equal(result.status, 0, result.stderr);
  const settings = JSON.parse(result.stdout.trim());
  assert.equal(settings.habilitado, true);
  assert.deepEqual(settings.faltantes, []);
  assert.ok(!settings.usuario.includes('bot.mesait'), 'el usuario no debe ir completo');
  assert.ok(settings.usuario.endsWith('@ejemplo.com'), 'pero el dominio si, para reconocerlo');
  assert.ok(!settings.buzonGeneral.includes('soporte'));
  assert.ok(!JSON.stringify(settings).includes('clave-de-aplicacion'));
});

test('verifyMailConnection responde MAIL_DISABLED sin intentar conectar', () => {
  const result = runMailerScript(
    { SMTP_USER: '', SMTP_PASS: '', MAIL_FROM: '' },
    `
      const mod = await import('./server/modules/mailer.js');
      console.log(JSON.stringify(await mod.verifyMailConnection()));
    `,
  );

  assert.equal(result.status, 0, result.stderr);
  const parsed = JSON.parse(result.stdout.trim());
  assert.deepEqual(parsed, { ok: false, motivo: 'MAIL_DISABLED' });
});
