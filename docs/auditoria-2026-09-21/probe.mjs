// Auditoría local: datos sintéticos, sin dotenv, correo ni conexiones de producción.
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm, realpath } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';

const outputDir = path.dirname(fileURLToPath(import.meta.url));
const project = path.resolve(outputDir, '../..');
const tempRoot = await realpath(os.tmpdir());
const runtime = await mkdtemp(path.join(tempRoot, 'mesa-it-audit-'));
Object.assign(process.env, {
  NODE_ENV: 'test', DATABASE_URL: '', DB_FILE: path.join(runtime, 'db.json'),
  ATTACHMENTS_DIR: path.join(runtime, 'uploads'), DB_BACKUP_ENABLE: 'false',
  SMTP_HOST: '', SMTP_USER: '', SMTP_PASS: '', VAPID_PRIVATE_KEY: '', VAPID_PUBLIC_KEY: '',
  VAPID_SUBJECT: '', SLA_WATCH_ENABLE: 'false', PUBLIC_URL: '', RATE_LIMIT_MAX: '10000',
});
const { createUserPasswordHash, updateDb, closeStore } = await import('../../server/store.js');
const password = 'LocalAudit.2026.Only';
const users = ['admin', 'tecnico', 'solicitante', 'consulta'].map((rol, i) => ({
  id: i + 1, nombre: `Audit ${rol}`, username: `audit.${rol}`, rol, activo: true,
  departamento: 'IT', passwordHash: createUserPasswordHash(password),
}));
const asset = { id: 10, tag: 'TJ01-DSK-001', tipo: 'DSK', marca: 'Audit',
  ubicacion: 'TJ01 | GER', estado: 'Operativo', serial: 'AUDIT-001', fechaCompra: '2026-01-01' };
await writeFile(process.env.DB_FILE, JSON.stringify({
  meta: { nextId: 1000 }, users, activos: [asset], tickets: [], insumos: [], auditoria: [],
  catalogos: { sucursales: [{ code: 'TJ01', name: 'Audit uno', activo: true },
    { code: 'TJ02', name: 'Audit dos', activo: true }], cargos: ['IT'],
    roles: users.map(u => ({ value: u.rol, label: u.rol, activo: true })) },
}));
const { createApp } = await import('../../server/index.js');
const server = createApp().listen(0, '127.0.0.1');
await new Promise(resolve => server.once('listening', resolve));
const base = `http://127.0.0.1:${server.address().port}/api`;
const results = [];
const tokens = {};
async function req(route, method = 'GET', body, role = 'admin') {
  const response = await fetch(base + route, { method, headers: {
    'Content-Type': 'application/json', ...(tokens[role] ? { Authorization: `Bearer ${tokens[role]}` } : {}),
  }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  return { status: response.status, data: await response.json() };
}
function record(id, observation) { results.push({ id, ...observation }); }
const input = { activoTag: asset.tag, sucursal: 'TJ01', descripcion: 'Auditoría: impresión ñ á é í ó ú',
  prioridad: 'MEDIA', atencionTipo: 'REMOTO' };
async function create(extra = {}, role = 'admin') {
  const r = await req('/tickets', 'POST', { ...input, ...extra }, role);
  assert.equal(r.status, 201, JSON.stringify(r)); return r.data;
}
try {
  for (const u of users) {
    const login = await req('/auth/login', 'POST', { username: u.username, password }, 'none');
    assert.equal(login.status, 200); tokens[u.rol] = login.data.token;
  }
  const flow = await create();
  const assigned = await req(`/tickets/${flow.id}`, 'PATCH', { asignadoA: 'audit.tecnico' });
  const working = await req(`/tickets/${flow.id}`, 'PATCH', { estado: 'En Proceso' }, 'tecnico');
  const resolved = await req(`/tickets/${flow.id}/resolve`, 'PATCH', { comentario: 'Cable sustituido' }, 'tecnico');
  const closed = await req(`/tickets/${flow.id}`, 'PATCH', { estado: 'Cerrado' }, 'tecnico');
  record('F1', { statuses: [201, assigned.status, working.status, resolved.status, closed.status],
    states: [flow.estado, assigned.data.estado, working.data.estado, resolved.data.estado, closed.data.estado],
    sameResolutionAndClosureDate: resolved.data.fechaCierre === closed.data.fechaCierre,
    firstResponseDate: closed.data.fechaPrimeraAtencion ?? null, resolutionDate: closed.data.fechaResolucion ?? null });
  const critical = await create({ prioridad: 'CRITICA' });
  const criticalResolved = await req(`/tickets/${critical.id}/resolve`, 'PATCH', {});
  record('F2', { created: 201, deadline: critical.fechaLimite, resolved: criticalResolved.status,
    emptySolutionAccepted: criticalResolved.data.historial[0].comentario });
  const reassigned = await req(`/tickets/${flow.id}`, 'PATCH', { asignadoA: 'audit.admin' });
  record('F3-F6', { closedTicketReassignmentStatus: reassigned.status,
    assignee: reassigned.data.asignadoA, history: reassigned.data.historial[0] });
  const reopen = await req(`/tickets/${flow.id}`, 'PATCH', { estado: 'Abierto' });
  record('F7', { status: reopen.status, state: reopen.data.estado,
    closureRemoved: !reopen.data.fechaCierre, oldDeadlineRetained: reopen.data.fechaLimite === flow.fechaLimite });
  const linked = (await req('/bootstrap')).data.tickets.filter(t => t.activoTag === asset.tag);
  record('F4', { linkedTickets: linked.length, assetTag: asset.tag });
  const overdue = await create();
  await updateDb(db => { db.tickets.find(t => t.id === overdue.id).fechaLimite = new Date(Date.now() - 60000).toISOString(); });
  const summary = await req('/summary');
  record('F5', { fixtureClock: 'deadline set to now minus 60 seconds', status: summary.status,
    overdueCount: summary.data.ticketsSlaVencido });
  record('F8', { requesterUsers: (await req('/users', 'GET', undefined, 'solicitante')).status,
    requesterUpdate: (await req(`/tickets/${flow.id}`, 'PATCH', { estado: 'Cerrado' }, 'solicitante')).status,
    readonlyCreate: (await req('/tickets', 'POST', input, 'consulta')).status,
    unauthenticated: (await req('/tickets', 'GET', undefined, 'none')).status });
  await create({}, 'solicitante');
  record('VALIDATION', {
    noDescription: (await req('/tickets', 'POST', { ...input, descripcion: '' })).status,
    noAsset: (await req('/tickets', 'POST', { ...input, activoTag: '' })).status,
    missingAsset: (await req('/tickets', 'POST', { ...input, activoTag: 'NO-EXISTE' })).status,
    missingAssignee: (await req('/tickets', 'POST', { ...input, asignadoA: 'NO-EXISTE' })).status,
    invalidPriorityNormalizedTo: (await create({ prioridad: 'INVALIDA' })).prioridad,
    wrongBranchAccepted: (await create({ sucursal: 'TJ02' })).sucursal,
    deleteRequesterWithTickets: (await req('/users/3', 'DELETE')).status,
    patchPriorityOnly: (await req(`/tickets/${overdue.id}`, 'PATCH', { prioridad: 'CRITICA' })).status,
  });
  const double = await Promise.all([create({ descripcion: 'Duplicate audit request' }), create({ descripcion: 'Duplicate audit request' })]);
  record('DUPLICATE', { count: double.length, distinctIds: new Set(double.map(t => t.id)).size });
  record('SEARCH_API', { byId: (await req(`/tickets?search=${overdue.id}`)).data.length,
    byRequester: (await req('/tickets?search=Audit%20admin')).data.length });
  const branchRemoval = await req('/catalogos', 'PATCH', { sucursales: [{ code: 'TJ02', name: 'Audit dos', activo: true }] });
  record('BRANCH_REMOVAL', { status: branchRemoval.status, referencedBranch: 'TJ01' });
  const rename = await req('/activos/10', 'PATCH', { ...asset, tag: 'TJ01-DSK-RENAMED' });
  const afterRename = (await req('/bootstrap')).data;
  record('ASSET_RENAME', { status: rename.status, assetTag: afterRename.activos[0]?.tag,
    ticketRetainsOldTag: afterRename.tickets.find(t => t.id === overdue.id)?.activoTag });
  record('ASSET_DELETE', { status: (await req('/activos/10', 'DELETE')).status,
    remainingTickets: (await req('/bootstrap')).data.tickets.length });
  const deleteTicket = await req(`/tickets/${critical.id}`, 'DELETE', undefined, 'tecnico');
  record('TICKET_DELETE', { technicianDeletesResolved: deleteTicket.status,
    stillInTickets: (await req('/bootstrap')).data.tickets.some(t => t.id === critical.id) });
  record('FORMER_TECH_DELETE', { status: (await req('/users/2', 'DELETE')).status,
    note: 'El técnico intervino y fue reasignado; ya no es responsable actual.' });
  const { normalizePushSubscription } = await import('../../server/modules/push-notifications.js');
  record('PUSH_ENDPOINT', { localhostAccepted: !!normalizePushSubscription({ endpoint: 'https://localhost/push',
    keys: { p256dh: 'a'.repeat(88), auth: 'b'.repeat(24) } }, { userId: 2, username: 'audit.tecnico' }),
    networkRequestMade: false });
  const bundle = await build({ stdin: { contents: `
    export { deriveReportKpiData } from './src/hooks/useReportKpiData';
    export { deriveTicketDirectoryData } from './src/hooks/useTicketDirectoryData';
    export { useDashboardMetrics } from './src/hooks/useDashboardMetrics';
    export { getSlaStatus } from './src/utils/tickets';
    export { apiRequest } from './src/utils/app';
    export { formatDateTime } from './src/utils/format';
    export { TicketFormModal } from './src/components/modals/TicketFormModal';
    export { useAppNavigation } from './src/hooks/useAppNavigation';
    export { MemoryRouter } from 'react-router-dom';
    export { createElement } from 'react';
    export { renderToString } from 'react-dom/server';
    `, resolveDir: project, loader: 'ts' }, bundle: true, write: false, platform: 'node', format: 'esm', jsx: 'automatic',
    define: { 'import.meta.env': '{"VITE_API_TIMEOUT_MS":"20"}' }, logLevel: 'silent' });
  // Bundle can use CommonJS internally; createRequire supplies Node builtins for SSR.
  const moduleFile = path.join(runtime, 'frontend.mjs');
  await writeFile(moduleFile, "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);\n" + bundle.outputFiles[0].text);
  const front = await import((await import('node:url')).pathToFileURL(moduleFile).href);
  const late = { ...flow, id: 99991, solicitadoPor: 'UniqueRequester', estado: 'Cerrado',
    fechaCreacion: '2026-09-21T08:00:00Z', fechaLimite: '2026-09-21T10:00:00Z', fechaCierre: '2026-09-21T12:00:00Z' };
  const clock = Date.parse('2026-09-21T18:00:00Z');
  const kpi = front.deriveReportKpiData({ reportTickets: [late], reportPreviousTickets: [], hasComparisonWindow: false, liveNow: clock });
  record('SLA_KPI', { lateByHours: 2, reportedCompliancePct: kpi.reportSlaCompliancePct,
    slaLabel: front.getSlaStatus(late, clock).label });
  const searchOptions = { tickets: [late], sessionUser: users[0], isRequesterOnlyUser: false, canEdit: true,
    liveNow: clock, lifecycleFilter: 'TODOS', stateFilter: 'TODOS', priorityFilter: 'TODAS',
    assignmentFilter: 'TODOS', slaFilter: 'TODOS', formatTicketBranch: v => v };
  record('SEARCH_UI', { byId: front.deriveTicketDirectoryData({ ...searchOptions, searchTokens: ['99991'] }).filteredTickets.length,
    byRequester: front.deriveTicketDirectoryData({ ...searchOptions, searchTokens: ['uniquerequester'] }).filteredTickets.length,
    accentPartial: front.deriveTicketDirectoryData({ ...searchOptions, searchTokens: ['impresion'] }).filteredTickets.length });
  let dashboard;
  function DashboardProbe() { dashboard = front.useDashboardMetrics({ scopedTickets: [{ ...late, estado: 'Abierto',
    fechaCreacion: '2026-08-01T08:00:00Z' }], dashboardRange: '7D', liveNow: clock,
    isDashboardView: true, formatTicketBranch: v => v }); return null; }
  front.renderToString(front.createElement(DashboardProbe));
  record('DASHBOARD_OLD_BACKLOG', { oldOpenTicketsInput: 1, displayedOpenTickets: dashboard.dashboardOpenTicketsCurrent.length });
  const routes = {};
  for (const pathname of ['/users', '/inventory', '/admin', '/tickets/123', '/tickets']) {
    function RouteProbe() { routes[pathname] = front.useAppNavigation({ canManageUsers: false, isRequesterOnlyUser: true }).view; return null; }
    front.renderToString(front.createElement(front.MemoryRouter, { initialEntries: [pathname] }, front.createElement(RouteProbe)));
  }
  record('ROUTES_REQUESTER_SSR', { routes, visualBrowserTest: false });
  const html = front.renderToString(front.createElement(front.TicketFormModal, {
    isOpen: true, title: 'Auditoría', submitLabel: 'Guardar', formData: {}, isSaving: false,
    canSubmit: true, canEdit: true, activeTicketBranches: [{ code: 'TJ01', name: 'Audit' }],
    ticketAssetOptions: [], selectedIssueArea: '', issueOptionsForSelectedArea: [],
    selectedTicketAssetContext: null, users, sessionUser: users[0], onClose: () => {},
    onSubmit: () => {}, onChange: () => {}, formatTicketBranchFromCatalog: v => v,
    formatCargoFromCatalog: v => v, normalizeTicketAttentionType: () => 'REMOTO',
    formatTicketAttentionType: v => v,
  }));
  const dom = new JSDOM(html);
  const missingLabels = [...dom.window.document.querySelectorAll('input,select,textarea')]
    .filter(el => !el.labels?.length && !el.getAttribute('aria-label') && !el.getAttribute('aria-labelledby'));
  record('FORM_LABELS_SSR', { controlsWithoutAccessibleLabel: missingLabels.length,
    tags: missingLabels.map(el => ({ tag: el.tagName, placeholder: el.getAttribute('placeholder') })) });
  dom.window.close();
  record('HISTORY_DATE', { raw: '9/10/2026, 14:00:00', intendedDayMonth: '9 de octubre',
    parsedMonthByJavascript: new Date('9/10/2026, 14:00:00').getMonth() + 1,
    dayOver12Parses: Number.isFinite(Date.parse('21/9/2026, 14:00:00')) });
  const actualFetch = globalThis.fetch;
  const errorResults = [];
  try {
    for (const status of [401, 403, 404, 500]) {
      globalThis.fetch = async () => new Response(JSON.stringify({ error: 'Audit failure' }), {
        status, headers: { 'Content-Type': 'application/json' },
      });
      try { await front.apiRequest('/tickets'); } catch (e) { errorResults.push({ input: status, caughtStatus: e.status }); }
    }
    globalThis.fetch = async () => { throw new TypeError('Failed to fetch'); };
    try { await front.apiRequest('/tickets'); } catch (e) { errorResults.push({ input: 'offline', message: e.message }); }
    globalThis.fetch = (_url, options) => new Promise((_resolve, reject) => {
      options.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
    });
    try { await front.apiRequest('/tickets'); } catch (e) { errorResults.push({ input: 'timeout', message: e.message }); }
  } finally { globalThis.fetch = actualFetch; }
  record('HTTP_CLIENT_ERRORS', { injectedResponses: errorResults, visualFeedbackTested: false });
  await writeFile(path.join(outputDir, 'resultados.json'), JSON.stringify({
    executedAt: new Date().toISOString(), node: process.version, environment: 'isolated local JSON fixture', results,
  }, null, 2) + '\n');
  console.log(JSON.stringify(results, null, 2));
} finally {
  await new Promise(resolve => server.close(resolve));
  await closeStore();
  const resolvedRuntime = await realpath(runtime);
  assert.equal(path.dirname(resolvedRuntime).toLowerCase(), tempRoot.toLowerCase());
  assert.ok(path.basename(resolvedRuntime).startsWith('mesa-it-audit-'));
  await rm(resolvedRuntime, { recursive: true, force: true });
}
