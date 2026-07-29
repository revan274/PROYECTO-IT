import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';

function importQrModuleInProduction(secret) {
  const baseEnv = { ...process.env };
  delete baseEnv.QR_SIGNING_SECRET;
  delete baseEnv.AUTH_TOKEN_SECRET;

  return spawnSync(
    process.execPath,
    ['--input-type=module', '--eval', "await import('./server/modules/qr-token.js')"],
    {
      cwd: process.cwd(),
      encoding: 'utf8',
      env: {
        ...baseEnv,
        NODE_ENV: 'production',
        ...(secret === undefined ? {} : { QR_SIGNING_SECRET: secret }),
      },
    },
  );
}

test('qr-token falla cerrado en producción sin secreto configurado', () => {
  const result = importQrModuleInProduction(undefined);

  assert.notEqual(result.status, 0);
  assert.match(`${result.stdout}\n${result.stderr}`, /QR_SIGNING_SECRET es obligatorio en producción/);
});

test('qr-token rechaza secretos demasiado cortos en producción', () => {
  const result = importQrModuleInProduction('secreto-corto');

  assert.notEqual(result.status, 0);
  assert.match(`${result.stdout}\n${result.stderr}`, /al menos 32 caracteres/);
});

test('qr-token permite iniciar con un secreto fuerte en producción', () => {
  const result = importQrModuleInProduction('qr-production-secret-with-32-chars-minimum');

  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
});
