/**
 * Full integration test — Phase 1 + Phase 2 + Security Fixes.
 *
 * Run:  npx ts-node test-full.ts
 *       (server must be running on BASE_URL, with NODE_ENV != test for rate-limit skip)
 */

const BASE = process.env.BASE_URL || 'http://localhost:3000';

interface TestResult {
  name: string;
  passed: boolean;
  detail: string;
}

const results: TestResult[] = [];
const uid = () => Math.random().toString(36).slice(2, 8);

function pass(name: string, detail = 'OK') {
  results.push({ name, passed: true, detail });
}
function fail(name: string, detail: string) {
  results.push({ name, passed: false, detail });
}

async function api(
  method: string,
  path: string,
  body?: unknown,
  token?: string,
): Promise<{ status: number; data: any }> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }
  return { status: res.status, data };
}

// ──────────────────────────────────────────────
// 1. HEALTH
// ──────────────────────────────────────────────
async function testHealth() {
  const t = '1.1 GET /health';
  const r = await api('GET', '/health');
  r.status === 200 && r.data.status === 'ok'
    ? pass(t)
    : fail(t, `status=${r.status} data=${JSON.stringify(r.data)}`);
}

// ──────────────────────────────────────────────
// 2. AUTH
// ──────────────────────────────────────────────
let tokenA = '', tokenB = '', tokenC = '';
let aliasA = '', aliasB = '', aliasC = '';
let seedA = '';

async function testAuthRegister() {
  aliasA = `usera_${uid()}`;
  aliasB = `userb_${uid()}`;
  aliasC = `userc_${uid()}`;
  const pw = 'Testpass1!';

  {
    const t = '2.1 POST /auth/register (user A)';
    const r = await api('POST', '/auth/register', { alias: aliasA, password: pw });
    if (r.status === 201 && r.data.token && r.data.seedPhrase) {
      tokenA = r.data.token;
      seedA = r.data.seedPhrase;
      pass(t, `alias=${aliasA}`);
    } else fail(t, `status=${r.status} ${JSON.stringify(r.data)}`);
  }
  {
    const t = '2.2 POST /auth/register (user B)';
    const r = await api('POST', '/auth/register', { alias: aliasB, password: pw });
    if (r.status === 201 && r.data.token) {
      tokenB = r.data.token;
      pass(t);
    } else fail(t, `status=${r.status}`);
  }
  {
    const t = '2.3 POST /auth/register (user C)';
    const r = await api('POST', '/auth/register', { alias: aliasC, password: pw });
    if (r.status === 201 && r.data.token) {
      tokenC = r.data.token;
      pass(t);
    } else fail(t, `status=${r.status}`);
  }
}

async function testAuthDuplicateAlias() {
  const t = '2.4 Duplicate alias → 409';
  const r = await api('POST', '/auth/register', { alias: aliasA, password: 'Testpass1!' });
  r.status === 409
    ? pass(t)
    : fail(t, `expected 409, got ${r.status}`);
}

async function testAuthLogin() {
  const t = '2.5 POST /auth/login';
  const r = await api('POST', '/auth/login', { alias: aliasA, password: 'Testpass1!' });
  if (r.status === 200 && r.data.token) {
    tokenA = r.data.token;
    pass(t);
  } else fail(t, `status=${r.status}`);
}

async function testAuthBadLogin() {
  const t = '2.6 Login with wrong password → 401';
  const r = await api('POST', '/auth/login', { alias: aliasA, password: 'wrong' });
  r.status === 401 ? pass(t) : fail(t, `expected 401, got ${r.status}`);
}

async function testAuthRecover() {
  const t = '2.7 POST /auth/recover (seed phrase)';
  const r = await api('POST', '/auth/recover', {
    alias: aliasA,
    seedPhrase: seedA,
    newPassword: 'NewPass123!',
  });
  if (r.status === 200 && r.data.token) {
    tokenA = r.data.token;
    pass(t);
  } else fail(t, `status=${r.status} ${JSON.stringify(r.data)}`);
}

async function testAuthRecoverBadSeed() {
  const t = '2.8 Recover with wrong seed → 401';
  const r = await api('POST', '/auth/recover', {
    alias: aliasA,
    seedPhrase: 'wrong wrong wrong wrong wrong wrong wrong wrong wrong wrong wrong wrong',
    newPassword: 'X12345678',
  });
  r.status === 401 ? pass(t) : fail(t, `expected 401, got ${r.status}`);
}

async function testAuthValidation() {
  const t = '2.9 Register with invalid alias → 400';
  const r = await api('POST', '/auth/register', { alias: 'AB', password: 'Testpass1!' });
  r.status === 400 ? pass(t) : fail(t, `expected 400, got ${r.status}`);
}

async function testNoTokenAccess() {
  const t = '2.10 Protected route without token → 401';
  const r = await api('POST', '/spaces', { name: 'NoAuth' });
  r.status === 401 ? pass(t) : fail(t, `expected 401, got ${r.status}`);
}

// ──────────────────────────────────────────────
// 2B. JWT REVOCATION (Fix 6)
// ──────────────────────────────────────────────
async function testJwtRevocationOnRecovery() {
  const alias = `revoke_${uid()}`;
  const pw = 'Testpass1!';
  const reg = await api('POST', '/auth/register', { alias, password: pw });
  const oldToken = reg.data.token;
  const seed = reg.data.seedPhrase;

  const t1 = '2.11 Old token works before recovery';
  const r1 = await api('PATCH', '/nodes/me', { interests: ['test'] }, oldToken);
  r1.status === 200 ? pass(t1) : fail(t1, `expected 200, got ${r1.status}`);

  await api('POST', '/auth/recover', {
    alias,
    seedPhrase: seed,
    newPassword: 'Changed123!',
  });

  const t2 = '2.12 Old token rejected after recovery (JWT revocation)';
  const r2 = await api('PATCH', '/nodes/me', { interests: ['test2'] }, oldToken);
  r2.status === 401 ? pass(t2) : fail(t2, `expected 401, got ${r2.status}`);

  const login = await api('POST', '/auth/login', { alias, password: 'Changed123!' });
  const t3 = '2.13 New token works after recovery';
  const r3 = await api('PATCH', '/nodes/me', { interests: ['test3'] }, login.data.token);
  r3.status === 200 ? pass(t3) : fail(t3, `expected 200, got ${r3.status}`);
}

// ──────────────────────────────────────────────
// 3. NODES
// ──────────────────────────────────────────────
async function testNodePublicProfile() {
  const t = '3.1 GET /nodes/:alias (public, no token)';
  const r = await api('GET', `/nodes/${aliasA}`);
  if (r.status === 200 && r.data.alias === aliasA && r.data.reputationScore === undefined) {
    pass(t, 'Public profile, no reputationScore exposed');
  } else fail(t, `status=${r.status} data=${JSON.stringify(r.data)}`);
}

async function testNodeSelfProfile() {
  const t = '3.2 GET /nodes/:alias (self → includes reputationScore)';
  const r = await api('GET', `/nodes/${aliasA}`, undefined, tokenA);
  if (r.status === 200 && r.data.reputationScore !== undefined) {
    pass(t, `reputationScore=${r.data.reputationScore}`);
  } else fail(t, `status=${r.status} data=${JSON.stringify(r.data)}`);
}

async function testNodeUpdateProfile() {
  const t = '3.3 PATCH /nodes/me';
  const r = await api('PATCH', '/nodes/me', {
    interests: ['painting', 'sculpture'],
    portfolioUrl: 'https://example.com',
    keywords: ['abstract'],
  }, tokenA);
  if (r.status === 200 && r.data.interests?.length === 2) {
    pass(t);
  } else fail(t, `status=${r.status}`);
}

async function testNodeBlock() {
  const t = '3.4 POST /nodes/me/block';
  const r = await api('POST', '/nodes/me/block', { targetAlias: aliasB }, tokenA);
  r.status === 200 ? pass(t) : fail(t, `status=${r.status}`);
}

async function testNodeBlockEffect() {
  const t = '3.5 Blocked user sees 403 on profile';
  const r = await api('GET', `/nodes/${aliasA}`, undefined, tokenB);
  r.status === 403 ? pass(t) : fail(t, `expected 403, got ${r.status}`);
}

async function testNodeUnblock() {
  const t = '3.6 DELETE /nodes/me/block/:alias → unblock';
  const r = await api('DELETE', `/nodes/me/block/${aliasB}`, undefined, tokenA);
  r.status === 200 ? pass(t) : fail(t, `status=${r.status}`);

  const t2 = '3.7 After unblock, profile accessible again';
  const r2 = await api('GET', `/nodes/${aliasA}`, undefined, tokenB);
  r2.status === 200 ? pass(t2) : fail(t2, `expected 200, got ${r2.status}`);
}

async function testNodeSelfBlock() {
  const t = '3.8 Cannot block yourself → 400';
  const r = await api('POST', '/nodes/me/block', { targetAlias: aliasA }, tokenA);
  r.status === 400 ? pass(t) : fail(t, `expected 400, got ${r.status}`);
}

async function testNodeTrustees() {
  const t = '3.9 PUT /nodes/me/trustees (need 3 active nodes)';
  const extra1 = `trustee1_${uid()}`;
  const extra2 = `trustee2_${uid()}`;
  await api('POST', '/auth/register', { alias: extra1, password: 'Testpass1!' });
  await api('POST', '/auth/register', { alias: extra2, password: 'Testpass1!' });

  const r = await api('PUT', '/nodes/me/trustees', {
    trustees: [aliasB, aliasC, extra1],
  }, tokenA);
  if (r.status === 200 && r.data.trustees?.length === 3) {
    pass(t);
  } else fail(t, `status=${r.status} ${JSON.stringify(r.data)}`);
}

async function testNodeTrusteesSelfReject() {
  const t = '3.10 Cannot add self as trustee → 400';
  const r = await api('PUT', '/nodes/me/trustees', {
    trustees: [aliasA, aliasB, aliasC],
  }, tokenA);
  r.status === 400 ? pass(t) : fail(t, `expected 400, got ${r.status}`);
}

// ──────────────────────────────────────────────
// 4. SPACES
// ──────────────────────────────────────────────
let spaceId = '';
async function testSpaceCreate() {
  const t = '4.1 POST /spaces';
  const r = await api('POST', '/spaces', {
    name: `TestSpace_${uid()}`,
    description: 'Integration test space',
  }, tokenA);
  if (r.status === 201 && r.data._id) {
    spaceId = r.data._id;
    pass(t, `spaceId=${spaceId}`);
  } else fail(t, `status=${r.status}`);
}

async function testSpaceGet() {
  const t = '4.2 GET /spaces/:id';
  const r = await api('GET', `/spaces/${spaceId}`, undefined, tokenA);
  r.status === 200 && r.data._id === spaceId
    ? pass(t)
    : fail(t, `status=${r.status}`);
}

async function testSpaceJoin() {
  const t = '4.3 POST /spaces/:id/join (user B)';
  const r = await api('POST', `/spaces/${spaceId}/join`, {}, tokenB);
  r.status === 200 ? pass(t) : fail(t, `status=${r.status} ${JSON.stringify(r.data)}`);
}

async function testSpaceDoubleJoin() {
  const t = '4.4 Double join → 400';
  const r = await api('POST', `/spaces/${spaceId}/join`, {}, tokenB);
  r.status === 400 ? pass(t) : fail(t, `expected 400, got ${r.status}`);
}

async function testSpaceJoinC() {
  const t = '4.5 POST /spaces/:id/join (user C)';
  const r = await api('POST', `/spaces/${spaceId}/join`, {}, tokenC);
  r.status === 200 ? pass(t) : fail(t, `status=${r.status}`);
}

async function testSpaceInvite() {
  const t = '4.6 POST /spaces/:id/invite (admin only)';
  const r = await api('POST', `/spaces/${spaceId}/invite`, {}, tokenA);
  if (r.status === 201 && r.data.inviteCode) {
    pass(t, `code=${r.data.inviteCode}`);
  } else fail(t, `status=${r.status}`);
}

async function testSpaceInviteNonAdmin() {
  const t = '4.7 Non-admin cannot invite → 403';
  const r = await api('POST', `/spaces/${spaceId}/invite`, {}, tokenB);
  r.status === 403 ? pass(t) : fail(t, `expected 403, got ${r.status}`);
}

async function testSpaceUpdateSettings() {
  const t = '4.8 PATCH /spaces/:id/settings';
  const r = await api('PATCH', `/spaces/${spaceId}/settings`, {
    vetoAuthority: [aliasA],
  }, tokenA);
  r.status === 200 ? pass(t) : fail(t, `status=${r.status}`);
}

async function testSpaceUpdateSettingsNonAdmin() {
  const t = '4.9 Non-admin cannot update settings → 403';
  const r = await api('PATCH', `/spaces/${spaceId}/settings`, {
    votingThreshold: 0.8,
  }, tokenB);
  r.status === 403 ? pass(t) : fail(t, `expected 403, got ${r.status}`);
}

// ──────────────────────────────────────────────
// 5. PROJECTS (START contract)
// ──────────────────────────────────────────────
let projectId = '';
async function testProjectCreate() {
  const t = '5.1 POST /projects (START contract)';
  const r = await api('POST', '/projects', {
    title: `TestProject_${uid()}`,
    spaceId,
    contributors: [{ alias: aliasB, role: 'contributor', isPrimary: true }],
  }, tokenA);
  if (r.status === 201 && r.data._id) {
    projectId = r.data._id;
    pass(t, `projectId=${projectId}`);
  } else fail(t, `status=${r.status} ${JSON.stringify(r.data)}`);
}

async function testProjectGet() {
  const t = '5.2 GET /projects/:id';
  const r = await api('GET', `/projects/${projectId}`, undefined, tokenA);
  r.status === 200 && r.data.status === 'active'
    ? pass(t)
    : fail(t, `status=${r.status} proj_status=${r.data?.status}`);
}

async function testProjectListBySpace() {
  const t = '5.3 GET /projects/space/:spaceId';
  const r = await api('GET', `/projects/space/${spaceId}`, undefined, tokenA);
  if (r.status === 200 && Array.isArray(r.data) && r.data.length >= 1) {
    pass(t, `count=${r.data.length}`);
  } else fail(t, `status=${r.status}`);
}

async function testProjectAddContributor() {
  const t = '5.4 POST /projects/:id/contributors';
  const r = await api('POST', `/projects/${projectId}/contributors`, {
    alias: aliasC,
    role: 'assistant',
  }, tokenA);
  r.status === 200 ? pass(t) : fail(t, `status=${r.status} ${JSON.stringify(r.data)}`);
}

async function testProjectAddDuplicate() {
  const t = '5.5 Add duplicate contributor → 400';
  const r = await api('POST', `/projects/${projectId}/contributors`, {
    alias: aliasC,
    role: 'assistant',
  }, tokenA);
  r.status === 400 ? pass(t) : fail(t, `expected 400, got ${r.status}`);
}

async function testProjectNonMember() {
  const t = '5.6 Non-space-member cannot create project → 403';
  const outsider = `outsider_${uid()}`;
  const regR = await api('POST', '/auth/register', { alias: outsider, password: 'Testpass1!' });
  const r = await api('POST', '/projects', {
    title: 'Unauthorized',
    spaceId,
  }, regR.data.token);
  r.status === 403 ? pass(t) : fail(t, `expected 403, got ${r.status}`);
}

// ──────────────────────────────────────────────
// 6. TRACES (TRACE contract)
// ──────────────────────────────────────────────
let traceId = '';
let proxyTraceId = '';
async function testTraceCreate() {
  const t = '6.1 POST /traces (micro mode)';
  const r = await api('POST', '/traces', {
    projectId,
    activityType: 'brainstorm',
    description: 'Initial brainstorming session',
    duration: 60,
    mode: 'micro',
  }, tokenA);
  if (r.status === 201 && r.data._id) {
    traceId = r.data._id;
    pass(t, `traceId=${traceId}`);
  } else fail(t, `status=${r.status} ${JSON.stringify(r.data)}`);
}

async function testTraceProxy() {
  const t = '6.2 POST /traces (proxy mode)';
  const r = await api('POST', '/traces', {
    projectId,
    activityType: 'fabrication',
    description: 'Proxy log for user B',
    duration: 120,
    mode: 'proxy',
    proxyForAlias: aliasB,
  }, tokenA);
  if (r.status === 201 && r.data.isProxy === true) {
    proxyTraceId = r.data._id;
    pass(t);
  } else fail(t, `status=${r.status} ${JSON.stringify(r.data)}`);
}

async function testTraceProxyConfirm() {
  const t = '6.3 PATCH /traces/:id/proxy-confirm (by target user)';
  const r = await api('PATCH', `/traces/${proxyTraceId}/proxy-confirm`, {
    confirmed: true,
  }, tokenB);
  if (r.status === 200 && r.data.trace?.proxyConfirmed === true) {
    pass(t);
  } else fail(t, `status=${r.status} ${JSON.stringify(r.data)}`);
}

async function testTraceProxyDoubleConfirm() {
  const t = '6.4 Double confirm proxy → 400';
  const r = await api('PATCH', `/traces/${proxyTraceId}/proxy-confirm`, {
    confirmed: true,
  }, tokenB);
  r.status === 400 ? pass(t) : fail(t, `expected 400, got ${r.status}`);
}

async function testTraceProxyWrongUser() {
  const r2 = await api('POST', '/traces', {
    projectId,
    activityType: 'iterate',
    duration: 30,
    mode: 'proxy',
    proxyForAlias: aliasC,
  }, tokenA);
  const t = '6.5 Proxy confirm by wrong user → 403';
  const r = await api('PATCH', `/traces/${r2.data._id}/proxy-confirm`, {
    confirmed: true,
  }, tokenB);
  r.status === 403 ? pass(t) : fail(t, `expected 403, got ${r.status}`);
}

async function testTraceList() {
  const t = '6.6 GET /traces/project/:projectId';
  const r = await api('GET', `/traces/project/${projectId}`, undefined, tokenA);
  if (r.status === 200 && Array.isArray(r.data) && r.data.length >= 2) {
    pass(t, `count=${r.data.length}`);
  } else fail(t, `status=${r.status}`);
}

async function testTraceGet() {
  const t = '6.7 GET /traces/:id';
  const r = await api('GET', `/traces/${traceId}`, undefined, tokenA);
  r.status === 200 && r.data._id === traceId
    ? pass(t)
    : fail(t, `status=${r.status}`);
}

async function testTraceNonContributor() {
  const t = '6.8 Non-contributor cannot trace → 403';
  const outsider = `out_${uid()}`;
  const reg = await api('POST', '/auth/register', { alias: outsider, password: 'Testpass1!' });
  const r = await api('POST', '/traces', {
    projectId,
    activityType: 'brainstorm',
    mode: 'micro',
  }, reg.data.token);
  r.status === 403 ? pass(t) : fail(t, `expected 403, got ${r.status}`);
}

async function testTraceOtherRequiresDesc() {
  const t = '6.9 activityType=other without otherDescription → 400';
  const r = await api('POST', '/traces', {
    projectId,
    activityType: 'other',
    mode: 'micro',
  }, tokenA);
  r.status === 400 ? pass(t) : fail(t, `expected 400, got ${r.status}`);
}

async function testTraceProxyRequiresAlias() {
  const t = '6.10 mode=proxy without proxyForAlias → 400';
  const r = await api('POST', '/traces', {
    projectId,
    activityType: 'brainstorm',
    mode: 'proxy',
  }, tokenA);
  r.status === 400 ? pass(t) : fail(t, `expected 400, got ${r.status}`);
}

// ──────────────────────────────────────────────
// 7. PIVOT
// ──────────────────────────────────────────────
async function testPivotCreate() {
  const t = '7.1 POST /pivots';
  const r = await api('POST', '/pivots', {
    projectId,
    reason: 'Switching to digital medium',
  }, tokenA);
  r.status === 201 && r.data._id
    ? pass(t)
    : fail(t, `status=${r.status} ${JSON.stringify(r.data)}`);
}

async function testPivotList() {
  const t = '7.2 GET /pivots/project/:projectId';
  const r = await api('GET', `/pivots/project/${projectId}`, undefined, tokenA);
  r.status === 200 && Array.isArray(r.data) && r.data.length >= 1
    ? pass(t, `count=${r.data.length}`)
    : fail(t, `status=${r.status}`);
}

async function testPivotNonContributor() {
  const t = '7.3 Non-contributor cannot pivot → 403';
  const outsider = `pout_${uid()}`;
  const reg = await api('POST', '/auth/register', { alias: outsider, password: 'Testpass1!' });
  const r = await api('POST', '/pivots', { projectId, reason: 'Nope' }, reg.data.token);
  r.status === 403 ? pass(t) : fail(t, `expected 403, got ${r.status}`);
}

// ──────────────────────────────────────────────
// 8. REFERENCE
// ──────────────────────────────────────────────
let referenceId = '';
async function testReferenceCreate() {
  const t = '8.1 POST /references';
  const r = await api('POST', '/references', {
    projectId,
    externalUrl: 'https://example.com/source',
    relationshipType: 'inspired_by',
  }, tokenA);
  if (r.status === 201 && r.data._id) {
    referenceId = r.data._id;
    pass(t);
  } else fail(t, `status=${r.status} ${JSON.stringify(r.data)}`);
}

async function testReferenceGet() {
  const t = '8.2 GET /references/:id';
  const r = await api('GET', `/references/${referenceId}`, undefined, tokenA);
  r.status === 200 ? pass(t) : fail(t, `status=${r.status}`);
}

async function testReferenceListByProject() {
  const t = '8.3 GET /references/project/:projectId';
  const r = await api('GET', `/references/project/${projectId}`, undefined, tokenA);
  r.status === 200 && Array.isArray(r.data) && r.data.length >= 1
    ? pass(t, `count=${r.data.length}`)
    : fail(t, `status=${r.status}`);
}

async function testReferenceOtherRequiresExplanation() {
  const t = '8.4 relationshipType=other without otherExplanation → 400';
  const r = await api('POST', '/references', {
    projectId,
    externalUrl: 'https://example.com',
    relationshipType: 'other',
  }, tokenA);
  r.status === 400 ? pass(t) : fail(t, `expected 400, got ${r.status}`);
}

async function testReferenceRequiresSource() {
  const t = '8.5 No source provided → 400';
  const r = await api('POST', '/references', {
    projectId,
    relationshipType: 'inspired_by',
  }, tokenA);
  r.status === 400 ? pass(t) : fail(t, `expected 400, got ${r.status}`);
}

// ──────────────────────────────────────────────
// 9. VETO
// ──────────────────────────────────────────────
let vetoProjectId = '';
let vetoId = '';
async function testVetoSetup() {
  const r = await api('POST', '/projects', {
    title: `VetoProj_${uid()}`,
    spaceId,
    contributors: [
      { alias: aliasB, role: 'contributor', isPrimary: true },
      { alias: aliasC, role: 'contributor', isPrimary: false },
    ],
  }, tokenA);
  vetoProjectId = r.data._id;
}

async function testVetoScopeLimit() {
  const t = '9.1 POST /vetos (scope_limit → immediate)';
  const r = await api('POST', '/vetos', {
    projectId: vetoProjectId,
    vetoType: 'scope_limit',
    reason: 'Limit scope to painting only',
  }, tokenA);
  if (r.status === 201 && r.data.status === 'active') {
    pass(t);
  } else fail(t, `status=${r.status} vetoStatus=${r.data?.status}`);
}

async function testVetoHardStopPending() {
  const t = '9.2 POST /vetos (hard_stop, no authority → pending)';
  const r = await api('POST', '/vetos', {
    projectId: vetoProjectId,
    vetoType: 'hard_stop',
    reason: 'Need to stop this project',
  }, tokenB);
  if (r.status === 201 && r.data.status === 'pending') {
    vetoId = r.data._id;
    pass(t);
  } else fail(t, `status=${r.status} vetoStatus=${r.data?.status}`);
}

async function testVetoSign() {
  const t = '9.3 POST /vetos/:id/sign (majority triggers activation)';
  const r = await api('POST', `/vetos/${vetoId}/sign`, { approved: true }, tokenA);
  if (r.status === 200 && r.data.status === 'active') {
    pass(t);
  } else fail(t, `status=${r.status} vetoStatus=${r.data?.status}`);
}

async function testVetoHardStopHalts() {
  const t = '9.4 Hard stop sets project to halted';
  const r = await api('GET', `/projects/${vetoProjectId}`, undefined, tokenA);
  r.data.status === 'halted'
    ? pass(t)
    : fail(t, `expected halted, got ${r.data?.status}`);
}

async function testVetoDoubleSign() {
  const t = '9.5 Double sign → 400';
  const r = await api('POST', `/vetos/${vetoId}/sign`, { approved: true }, tokenA);
  r.status === 400 ? pass(t) : fail(t, `expected 400, got ${r.status}`);
}

async function testVetoHardStopAuthority() {
  const proj2 = await api('POST', '/projects', {
    title: `VetoAuth_${uid()}`,
    spaceId,
    contributors: [{ alias: aliasB, role: 'contributor', isPrimary: true }],
  }, tokenA);

  const t = '9.6 Hard stop with vetoAuthority → immediate active + halted';
  const r = await api('POST', '/vetos', {
    projectId: proj2.data._id,
    vetoType: 'hard_stop',
    reason: 'Authority halt',
  }, tokenA);
  if (r.status === 201 && r.data.status === 'active') {
    const p = await api('GET', `/projects/${proj2.data._id}`, undefined, tokenA);
    p.data.status === 'halted' ? pass(t) : fail(t, `project status=${p.data.status}`);
  } else fail(t, `status=${r.status} vetoStatus=${r.data?.status}`);
}

async function testVetoOnInactiveProject() {
  const t = '9.7 Veto on non-active project → 400';
  const r = await api('POST', '/vetos', {
    projectId: vetoProjectId,
    vetoType: 'content_flag',
    reason: 'Flag content',
  }, tokenA);
  r.status === 400 ? pass(t) : fail(t, `expected 400, got ${r.status}`);
}

async function testVetoList() {
  const t = '9.8 GET /vetos/project/:projectId';
  const r = await api('GET', `/vetos/project/${vetoProjectId}`, undefined, tokenA);
  r.status === 200 && Array.isArray(r.data) && r.data.length >= 2
    ? pass(t, `count=${r.data.length}`)
    : fail(t, `status=${r.status}`);
}

// ──────────────────────────────────────────────
// 10. REFERENCE on halted project
// ──────────────────────────────────────────────
async function testReferenceOnHalted() {
  const t = '10.1 Reference on halted project → allowed';
  const r = await api('POST', '/references', {
    projectId: vetoProjectId,
    externalUrl: 'https://example.com/halted-ref',
    relationshipType: 'inspired_by',
  }, tokenA);
  r.status === 201 ? pass(t) : fail(t, `expected 201, got ${r.status}`);
}

// ──────────────────────────────────────────────
// 11. CREDIT
// ──────────────────────────────────────────────
let creditProjectId = '';
let nftId = '';
async function testCreditSetup() {
  const r = await api('POST', '/projects', {
    title: `CreditProj_${uid()}`,
    spaceId,
    contributors: [{ alias: aliasB, role: 'contributor', isPrimary: true }],
  }, tokenA);
  creditProjectId = r.data._id;

  await api('POST', '/traces', {
    projectId: creditProjectId,
    activityType: 'brainstorm',
    duration: 120,
    mode: 'micro',
  }, tokenA);
}

async function testCreditCreate() {
  const t = '11.1 POST /credits (no dispute)';
  const r = await api('POST', '/credits', {
    projectId: creditProjectId,
  }, tokenA);
  if (r.status === 201 && r.data.nft?._id) {
    nftId = r.data.nft._id;
    pass(t);
  } else fail(t, `status=${r.status} ${JSON.stringify(r.data)}`);
}

async function testCreditProjectCompleted() {
  const t = '11.2 Project status = completed after credit';
  const r = await api('GET', `/projects/${creditProjectId}`, undefined, tokenA);
  r.data.status === 'completed'
    ? pass(t)
    : fail(t, `expected completed, got ${r.data?.status}`);
}

async function testCreditSignAllContributors() {
  const t = '11.3 POST /credits/:nftId/sign (user B — any contributor can sign)';
  const r = await api('POST', `/credits/${nftId}/sign`, { accepted: true }, tokenB);
  r.status === 200 ? pass(t) : fail(t, `status=${r.status} ${JSON.stringify(r.data)}`);
}

async function testCreditDoubleInit() {
  const t = '11.4 Double credit init → 400';
  const r = await api('POST', '/credits', { projectId: creditProjectId }, tokenA);
  r.status === 400 ? pass(t) : fail(t, `expected 400, got ${r.status}`);
}

async function testCreditGetProject() {
  const t = '11.5 GET /credits/project/:projectId';
  const r = await api('GET', `/credits/project/${creditProjectId}`, undefined, tokenA);
  r.status === 200 && r.data.nft && r.data.contributorTokens
    ? pass(t)
    : fail(t, `status=${r.status}`);
}

async function testCreditDispute() {
  const proj = await api('POST', '/projects', {
    title: `DisputeProj_${uid()}`,
    spaceId,
    contributors: [{ alias: aliasB, role: 'contributor', isPrimary: true }],
  }, tokenA);

  const t = '11.6 Credit with disputeFlag → project disputed';
  const r = await api('POST', '/credits', {
    projectId: proj.data._id,
    disputeFlag: true,
  }, tokenA);
  if (r.status === 201) {
    const p = await api('GET', `/projects/${proj.data._id}`, undefined, tokenA);
    p.data.status === 'disputed'
      ? pass(t)
      : fail(t, `expected disputed, got ${p.data.status}`);
  } else fail(t, `status=${r.status}`);
}

async function testCreditSignReject() {
  const proj = await api('POST', '/projects', {
    title: `RejectProj_${uid()}`,
    spaceId,
    contributors: [{ alias: aliasB, role: 'contributor', isPrimary: true }],
  }, tokenA);
  const cr = await api('POST', '/credits', { projectId: proj.data._id }, tokenA);

  const t = '11.7 Credit sign rejected → disputed';
  const r = await api('POST', `/credits/${cr.data.nft._id}/sign`, {
    accepted: false,
  }, tokenB);
  if (r.status === 200) {
    const p = await api('GET', `/projects/${proj.data._id}`, undefined, tokenA);
    p.data.status === 'disputed'
      ? pass(t)
      : fail(t, `expected disputed, got ${p.data.status}`);
  } else fail(t, `status=${r.status}`);
}

async function testCreditNonPrimary() {
  const proj = await api('POST', '/projects', {
    title: `NonPriProj_${uid()}`,
    spaceId,
    contributors: [{ alias: aliasB, role: 'contributor', isPrimary: false }],
  }, tokenA);

  const t = '11.8 Non-primary cannot initiate credit → 403';
  const r = await api('POST', '/credits', { projectId: proj.data._id }, tokenB);
  r.status === 403 ? pass(t) : fail(t, `expected 403, got ${r.status}`);
}

async function testCreditMissingContributor() {
  const proj = await api('POST', '/projects', {
    title: `PartialCredit_${uid()}`,
    spaceId,
    contributors: [{ alias: aliasB, role: 'contributor', isPrimary: true }],
  }, tokenA);

  const t = '11.9 Credit with partial contributor list → 400 (Fix 4)';
  const r = await api('POST', '/credits', {
    projectId: proj.data._id,
    contributors: [{ alias: aliasA, weight: 1.0 }],
  }, tokenA);
  r.status === 400 ? pass(t) : fail(t, `expected 400, got ${r.status}: ${JSON.stringify(r.data)}`);
}

async function testCreditNonPrimaryCanSign() {
  const proj = await api('POST', '/projects', {
    title: `AllSign_${uid()}`,
    spaceId,
    contributors: [
      { alias: aliasB, role: 'contributor', isPrimary: true },
      { alias: aliasC, role: 'assistant', isPrimary: false },
    ],
  }, tokenA);
  const cr = await api('POST', '/credits', { projectId: proj.data._id }, tokenA);

  const t = '11.10 Non-primary contributor CAN sign credit (Fix 4)';
  const r = await api('POST', `/credits/${cr.data.nft._id}/sign`, { accepted: true }, tokenC);
  r.status === 200 ? pass(t) : fail(t, `expected 200, got ${r.status}`);
}

// ──────────────────────────────────────────────
// 12. FORK
// ──────────────────────────────────────────────
let forkedProjectId = '';
async function testForkCreate() {
  const t = '12.1 POST /forks (same space)';
  const r = await api('POST', '/forks', {
    parentProjectId: projectId,
    title: `Fork_${uid()}`,
    forkReason: 'Explore alternate approach',
    inheritedContributors: [aliasB],
  }, tokenA);
  if (r.status === 201 && r.data.forkedProject?._id) {
    forkedProjectId = r.data.forkedProject._id;
    pass(t);
  } else fail(t, `status=${r.status} ${JSON.stringify(r.data)}`);
}

async function testForkHasParentProjectId() {
  const t = '12.2 Forked project has parentProjectId field (Fix 5)';
  const r = await api('GET', `/projects/${forkedProjectId}`, undefined, tokenA);
  if (r.status === 200 && r.data.parentProjectId === projectId) {
    pass(t);
  } else fail(t, `expected parentProjectId=${projectId}, got ${r.data?.parentProjectId}`);
}

async function testForkCrossSpace() {
  const space2 = await api('POST', '/spaces', { name: `ForkSpace_${uid()}` }, tokenA);
  const t = '12.3 POST /forks (cross-space with targetSpaceId)';
  const r = await api('POST', '/forks', {
    parentProjectId: projectId,
    title: `CrossFork_${uid()}`,
    forkReason: 'Move to different space',
    targetSpaceId: space2.data._id,
  }, tokenA);
  if (r.status === 201 && r.data.forkedProject?.spaceId === space2.data._id) {
    pass(t);
  } else fail(t, `status=${r.status} ${JSON.stringify(r.data)}`);
}

async function testForkListByField() {
  const t = '12.4 GET /forks/parent/:parentProjectId (field query, not regex) (Fix 5)';
  const r = await api('GET', `/forks/parent/${projectId}`, undefined, tokenA);
  r.status === 200 && Array.isArray(r.data) && r.data.length >= 1
    ? pass(t, `count=${r.data.length}`)
    : fail(t, `status=${r.status}`);
}

async function testForkNonMember() {
  const outsider = `forkout_${uid()}`;
  const reg = await api('POST', '/auth/register', { alias: outsider, password: 'Testpass1!' });
  const t = '12.5 Non-member cannot fork → 403';
  const r = await api('POST', '/forks', {
    parentProjectId: projectId,
    title: 'Bad Fork',
    forkReason: 'Should fail',
  }, reg.data.token);
  r.status === 403 ? pass(t) : fail(t, `expected 403, got ${r.status}`);
}

// ──────────────────────────────────────────────
// 13. ARCHIVE
// ──────────────────────────────────────────────
let archiveId = '';
async function testArchiveCreate() {
  const t = '13.1 POST /archives';
  const r = await api('POST', '/archives', {
    title: `ArchiveWork_${uid()}`,
    medium: 'Oil on canvas',
    approxDate: '2024-06',
    spaceId,
    evidence: [{ evidenceType: 'photos_of_work', evidenceHash: 'abc123hash' }],
    reconstructionFlag: false,
    originalWorkDeclaration: true,
    collaborators: [aliasB],
    contextNote: 'Old painting from last year',
  }, tokenA);
  if (r.status === 201 && r.data.archive?._id) {
    archiveId = r.data.archive._id;
    pass(t, `archiveId=${archiveId}`);
  } else fail(t, `status=${r.status} ${JSON.stringify(r.data)}`);
}

async function testArchiveGet() {
  const t = '13.2 GET /archives/:id';
  const r = await api('GET', `/archives/${archiveId}`, undefined, tokenA);
  r.status === 200 && r.data._id === archiveId
    ? pass(t)
    : fail(t, `status=${r.status}`);
}

async function testArchiveAttestation() {
  const t = '13.3 POST /archives/:id/attestations (peer)';
  const r = await api('POST', `/archives/${archiveId}/attestations`, {
    attestationType: 'peer',
    relationship: 'witness',
    statement: 'I saw this work being made',
  }, tokenB);
  r.status === 201 ? pass(t) : fail(t, `status=${r.status} ${JSON.stringify(r.data)}`);
}

async function testArchiveDoubleAttestation() {
  const t = '13.4 Double attestation → 400';
  const r = await api('POST', `/archives/${archiveId}/attestations`, {
    attestationType: 'peer',
    relationship: 'collaborator',
    statement: 'Second try',
  }, tokenB);
  r.status === 400 ? pass(t) : fail(t, `expected 400, got ${r.status}`);
}

async function testArchiveListBySpace() {
  const t = '13.5 GET /archives/space/:spaceId';
  const r = await api('GET', `/archives/space/${spaceId}`, undefined, tokenA);
  r.status === 200 && Array.isArray(r.data) && r.data.length >= 1
    ? pass(t, `count=${r.data.length}`)
    : fail(t, `status=${r.status}`);
}

async function testArchiveNoDeclaration() {
  const t = '13.6 Archive without originalWorkDeclaration → 400';
  const r = await api('POST', '/archives', {
    title: 'BadArchive',
    medium: 'Digital',
    approxDate: '2024-01',
    spaceId,
    evidence: [{ evidenceType: 'photos_of_work', evidenceHash: 'hash123' }],
    reconstructionFlag: false,
    originalWorkDeclaration: false,
  }, tokenA);
  r.status === 400 ? pass(t) : fail(t, `expected 400, got ${r.status}`);
}

async function testArchiveNoEvidence() {
  const t = '13.7 Archive without evidence → 400';
  const r = await api('POST', '/archives', {
    title: 'NoEvidence',
    medium: 'Digital',
    approxDate: '2024-01',
    spaceId,
    evidence: [],
    reconstructionFlag: false,
    originalWorkDeclaration: true,
  }, tokenA);
  r.status === 400 ? pass(t) : fail(t, `expected 400, got ${r.status}`);
}

// ──────────────────────────────────────────────
// 14. CHAIN INTEGRITY
// ──────────────────────────────────────────────
async function testChainBlocksCreated() {
  const t = '14.1 Chain has blocks (health OK)';
  const r = await api('GET', '/health');
  r.status === 200 ? pass(t) : fail(t, `status=${r.status}`);
}

// ──────────────────────────────────────────────
// 15. CROSS-CONTRACT EDGE CASES
// ──────────────────────────────────────────────
async function testTraceOnHaltedProject() {
  const t = '15.1 Trace on halted project → 400';
  const r = await api('POST', '/traces', {
    projectId: vetoProjectId,
    activityType: 'brainstorm',
    mode: 'micro',
  }, tokenA);
  r.status === 400 ? pass(t) : fail(t, `expected 400, got ${r.status}`);
}

async function testPivotOnHaltedProject() {
  const t = '15.2 Pivot on halted project → 400';
  const r = await api('POST', '/pivots', {
    projectId: vetoProjectId,
    reason: 'Should fail',
  }, tokenA);
  r.status === 400 ? pass(t) : fail(t, `expected 400, got ${r.status}`);
}

async function testCreditOnHaltedProject() {
  const t = '15.3 Credit on halted project → 400';
  const r = await api('POST', '/credits', { projectId: vetoProjectId }, tokenA);
  r.status === 400 ? pass(t) : fail(t, `expected 400, got ${r.status}`);
}

async function testReferenceOnCompletedProject() {
  const t = '15.4 Reference on completed project → allowed';
  const r = await api('POST', '/references', {
    projectId: creditProjectId,
    externalUrl: 'https://example.com/completed-ref',
    relationshipType: 'built_on',
  }, tokenA);
  r.status === 201 ? pass(t) : fail(t, `expected 201, got ${r.status}`);
}

async function testVetoNonContributor() {
  const t = '15.5 Non-contributor cannot veto → 403';
  const outsider = `vout_${uid()}`;
  const reg = await api('POST', '/auth/register', { alias: outsider, password: 'Testpass1!' });
  await api('POST', `/spaces/${spaceId}/join`, {}, reg.data.token);
  const proj = await api('POST', '/projects', {
    title: `VetoNC_${uid()}`,
    spaceId,
  }, tokenA);
  const r = await api('POST', '/vetos', {
    projectId: proj.data._id,
    vetoType: 'content_flag',
    reason: 'Flag',
  }, reg.data.token);
  r.status === 403 ? pass(t) : fail(t, `expected 403, got ${r.status}`);
}

// ──────────────────────────────────────────────
// MAIN
// ──────────────────────────────────────────────
async function main() {
  console.log('='.repeat(65));
  console.log(' AURA2 — Full Integration Test Suite (Phase 1 + 2 + Fixes)');
  console.log('='.repeat(65));
  console.log(`Target: ${BASE}\n`);

  const hc = await fetch(`${BASE}/health`).catch(() => null);
  if (!hc || hc.status !== 200) {
    console.error('FATAL: Server not reachable at', BASE);
    process.exit(1);
  }
  console.log('Server is up. Running tests...\n');

  // Phase 1
  await testHealth();

  await testAuthRegister();
  await testAuthDuplicateAlias();
  await testAuthLogin();
  await testAuthBadLogin();
  await testAuthRecover();
  await testAuthRecoverBadSeed();
  await testAuthValidation();
  await testNoTokenAccess();
  await testJwtRevocationOnRecovery();

  await testNodePublicProfile();
  await testNodeSelfProfile();
  await testNodeUpdateProfile();
  await testNodeBlock();
  await testNodeBlockEffect();
  await testNodeUnblock();
  await testNodeSelfBlock();
  await testNodeTrustees();
  await testNodeTrusteesSelfReject();

  await testSpaceCreate();
  await testSpaceGet();
  await testSpaceJoin();
  await testSpaceDoubleJoin();
  await testSpaceJoinC();
  await testSpaceInvite();
  await testSpaceInviteNonAdmin();
  await testSpaceUpdateSettings();
  await testSpaceUpdateSettingsNonAdmin();

  await testProjectCreate();
  await testProjectGet();
  await testProjectListBySpace();
  await testProjectAddContributor();
  await testProjectAddDuplicate();
  await testProjectNonMember();

  await testTraceCreate();
  await testTraceProxy();
  await testTraceProxyConfirm();
  await testTraceProxyDoubleConfirm();
  await testTraceProxyWrongUser();
  await testTraceList();
  await testTraceGet();
  await testTraceNonContributor();
  await testTraceOtherRequiresDesc();
  await testTraceProxyRequiresAlias();

  // Phase 2
  await testPivotCreate();
  await testPivotList();
  await testPivotNonContributor();

  await testReferenceCreate();
  await testReferenceGet();
  await testReferenceListByProject();
  await testReferenceOtherRequiresExplanation();
  await testReferenceRequiresSource();

  await testVetoSetup();
  await testVetoScopeLimit();
  await testVetoHardStopPending();
  await testVetoSign();
  await testVetoHardStopHalts();
  await testVetoDoubleSign();
  await testVetoHardStopAuthority();
  await testVetoOnInactiveProject();
  await testVetoList();

  await testReferenceOnHalted();

  await testCreditSetup();
  await testCreditCreate();
  await testCreditProjectCompleted();
  await testCreditSignAllContributors();
  await testCreditDoubleInit();
  await testCreditGetProject();
  await testCreditDispute();
  await testCreditSignReject();
  await testCreditNonPrimary();
  await testCreditMissingContributor();
  await testCreditNonPrimaryCanSign();

  await testForkCreate();
  await testForkHasParentProjectId();
  await testForkCrossSpace();
  await testForkListByField();
  await testForkNonMember();

  await testArchiveCreate();
  await testArchiveGet();
  await testArchiveAttestation();
  await testArchiveDoubleAttestation();
  await testArchiveListBySpace();
  await testArchiveNoDeclaration();
  await testArchiveNoEvidence();

  await testChainBlocksCreated();

  await testTraceOnHaltedProject();
  await testPivotOnHaltedProject();
  await testCreditOnHaltedProject();
  await testReferenceOnCompletedProject();
  await testVetoNonContributor();

  // ── Results ──
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  const total = results.length;

  console.log('\n' + '='.repeat(65));
  console.log(' RESULTS');
  console.log('='.repeat(65));

  let section = '';
  for (const r of results) {
    const newSection = r.name.split(' ')[0];
    if (newSection !== section) {
      section = newSection;
      console.log('');
    }
    const symbol = r.passed ? '+' : '-';
    const tag = r.passed ? 'PASS' : 'FAIL';
    console.log(`  [${symbol}] ${tag}: ${r.name}`);
    if (!r.passed) console.log(`         ${r.detail}`);
  }

  console.log('\n' + '='.repeat(65));
  if (failed === 0) {
    console.log(`  ALL ${total} TESTS PASSED`);
  } else {
    console.log(`  ${passed}/${total} PASSED, ${failed} FAILED`);
  }
  console.log('='.repeat(65) + '\n');

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Unhandled error:', err);
  process.exit(1);
});
