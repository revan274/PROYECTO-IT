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
