#!/usr/bin/env node
// Comprueba la configuracion de correo desde la linea de comandos, sin levantar el API
// ni crear un ticket real.
//
// Existe para poder validar una contrasena de aplicacion ANTES de ponerla en el hosting:
// las credenciales se leen de `.env` (ignorado por git) o del entorno, nunca se escriben
// en ningun lado y nunca se imprimen.
//
//   npm run mail:check                      -> solo comprueba conexion y credenciales
//   npm run mail:check -- tu@correo.com     -> ademas envia un correo de prueba
//
// Sale con codigo 1 si algo impide enviar, para poder encadenarlo en un script.
import 'dotenv/config';

import { getMailSettings, maskEmail, sendMail, verifyMailConnection } from '../modules/mailer.js';

const AYUDA_POR_CODIGO = {
  EAUTH: 'Las credenciales no sirven. Con Gmail: usa una contrasena de aplicacion de 16 '
    + 'caracteres PEGADA SIN ESPACIOS, no la contrasena normal de la cuenta.',
  ETIMEDOUT: 'No hubo respuesta del servidor SMTP. Suele ser un firewall o una red que '
    + 'bloquea el puerto de salida.',
  ECONNREFUSED: 'El servidor SMTP rechazo la conexion. Revisa SMTP_HOST y SMTP_PORT.',
  ENOTFOUND: 'No se resolvio el nombre de SMTP_HOST. Revisa que este bien escrito.',
  ESOCKET: 'Fallo la capa segura. Si usas el puerto 587 necesitas SMTP_SECURE=false; '
    + 'el 465 va con SMTP_SECURE=true.',
};

function linea(etiqueta, valor) {
  console.log(`  ${String(etiqueta).padEnd(22)} ${valor}`);
}

async function main() {
  const destinoDePrueba = String(process.argv[2] || '').trim();
  const settings = getMailSettings();

  console.log('\nConfiguracion de correo');
  linea('Servidor', `${settings.host}:${settings.puerto} (seguro: ${settings.seguro})`);
  linea('Usuario', settings.usuario || '(vacio)');
  linea('Remitente', settings.remitente || '(vacio)');
  linea('Buzon general', settings.buzonGeneral || '(sin configurar)');

  if (!settings.habilitado) {
    console.error(`\nEl correo esta DESHABILITADO. Falta definir: ${settings.faltantes.join(', ')}.`);
    console.error('Definelas en un archivo .env en la raiz del proyecto (git lo ignora) '
      + 'o como variables del hosting.\n');
    process.exit(1);
  }

  console.log('\nComprobando conexion y credenciales (sin enviar nada)...');
  const conexion = await verifyMailConnection();
  if (!conexion.ok) {
    console.error(`  FALLO (${conexion.codigo || conexion.motivo})`);
    if (conexion.detalle) console.error(`  ${conexion.detalle}`);
    const ayuda = AYUDA_POR_CODIGO[conexion.codigo];
    if (ayuda) console.error(`\n  ${ayuda}`);
    console.error('');
    process.exit(1);
  }
  console.log('  OK: el servidor acepto las credenciales.');

  if (!destinoDePrueba) {
    console.log('\nPara enviar ademas un correo de prueba:');
    console.log('  npm run mail:check -- tu@correo.com\n');
    return;
  }

  console.log(`\nEnviando correo de prueba a ${maskEmail(destinoDePrueba)}...`);
  const resultado = await sendMail({
    to: destinoDePrueba,
    subject: '[Mesa IT] Prueba de configuracion de correo',
    text: 'Si recibiste este mensaje, Mesa IT ya puede enviar avisos de tickets.',
    html: '<p>Si recibiste este mensaje, <strong>Mesa IT ya puede enviar avisos de '
      + 'tickets</strong>.</p>',
  });

  if (!resultado.sent) {
    console.error(`  FALLO (${resultado.reason})`);
    if (resultado.error) console.error(`  ${String(resultado.error.message || resultado.error).slice(0, 300)}`);
    console.error('');
    process.exit(1);
  }
  console.log('  Enviado. Revisa la bandeja (y la carpeta de spam).\n');
}

main().catch((error) => {
  console.error('\nEl comprobador fallo:', error?.message || error, '\n');
  process.exit(1);
});
