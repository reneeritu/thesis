/**
 * Integration tests — Moderation System (Phase 3B).
 *
 * Run:  npx ts-node test-moderation.ts
 *       (server must be running on BASE_URL)
 */

const BASE = process.env.BASE_URL || 'http://localhost:3000';

interface TestResult { name: string; passed: boolean; detail: string }
const results: TestResult[] = [];
const uid = () => Math.random().toString(36).slice(2, 8);

function pass(name: string, detail = 'OK') { results.push({ name, passed: true, detail }); }
function fail(name: string, detail: string) { results.push({ name, passed: false, detail }); }

async function api(method: string, path: string, body?: unknown, token?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    method, headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data: any;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  return { status: res.status, data };
}

const pw = 'Testpass1!';
let tokens: string[] = [];
let aliases: string[] = [];
let spaceId = '';
let projectId = '';
let nodeIdA = '';

async function setup() {
  const count = 8;
  for (let i = 0; i < count; i++) {
    const alias = `mod${String.fromCharCode(97 + i)}_${uid()}`;
    const r = await api('POST', '/auth/register', { alias, password: pw });
    if (r.status !== 201) throw new Error(`Setup: register ${alias} failed: ${JSON.stringify(r.data)}`);
    tokens.push(r.data.token);
    aliases.push(alias);
    if (i === 0) nodeIdA = r.data.node?._id || '';
  }

  const sr = await api('POST', '/spaces', {
    name: `modspace_${uid()}`,
    projectAccess: 'open',
    vetoAuthority: [aliases[0]],
    votingThreshold: 0.5,
    privacyDefault: 'space_only',
    allowCustomContracts: true,
  }, tokens[0]);
  if (sr.status !== 201) throw new Error(`Setup: create space failed: ${JSON.stringify(sr.data)}`);
  spaceId = sr.data._id;

  for (let i = 1; i < count; i++) {
    await api('POST', `/spaces/${spaceId}/join`, {}, tokens[i]);
  }

  const pr = await api('POST', '/projects', {
    title: `FlagTest_${uid()}`,
    spaceId,
    contributors: [
      { alias: aliases[0], role: 'lead', isPrimary: true },
      { alias: aliases[1], role: 'contributor', isPrimary: false },
    ],
  }, tokens[0]);
  if (pr.status !== 201) throw new Error(`Setup: create project failed: ${JSON.stringify(pr.data)}`);
  projectId = pr.data._id;

  await api('POST', '/traces', { projectId, activityType: 'brainstorm', duration: 30 }, tokens[0]);

  console.log('Setup complete\n');
}

// ──────────────────────────────────────────────
// 1. RAISE FLAGS
// ──────────────────────────────────────────────
let contentFlagId = '';
let contentPanelId = '';

async function testRaiseContentFlag() {
  const t = '1.1 Raise a content flag (harassment)';
  const r = await api('POST', '/flags', {
    flagCategory: 'content',
    flagType: 'harassment',
    targetType: 'node',
    targetId: projectId,
    spaceId,
    reason: 'Test harassment flag',
  }, tokens[2]);

  if (r.status === 201 && r.data.flag && r.data.flag.flagCategory === 'content') {
    contentFlagId = r.data.flag._id;
    pass(t, `flagId=${contentFlagId}`);
  } else {
    fail(t, `status=${r.status} data=${JSON.stringify(r.data)}`);
  }
}

async function testFlagHasPanel() {
  const t = '1.2 Content flag auto-assigns panel';
  const r = await api('GET', `/flags/${contentFlagId}`, undefined, tokens[2]);

  if (r.status === 200 && r.data.panels && r.data.panels.length > 0) {
    contentPanelId = r.data.panels[0]._id;
    pass(t, `panelId=${contentPanelId}, invited=${r.data.panels[0].invitedModerators.length}`);
  } else {
    fail(t, `status=${r.status} panels=${r.data.panels?.length}`);
  }
}

async function testInvalidCategoryType() {
  const t = '1.3 Invalid flagType for category rejected';
  const r = await api('POST', '/flags', {
    flagCategory: 'emergency',
    flagType: 'harassment',
    targetType: 'node',
    targetId: projectId,
    reason: 'Wrong category',
  }, tokens[2]);

  if (r.status === 400) {
    pass(t);
  } else {
    fail(t, `Expected 400, got ${r.status}`);
  }
}

// ──────────────────────────────────────────────
// 2. ACCEPT PANEL
// ──────────────────────────────────────────────
async function testAcceptPanel() {
  const t = '2.1 Invited moderator accepts panel';
  const flagR = await api('GET', `/flags/${contentFlagId}`, undefined, tokens[3]);
  const panel = flagR.data.panels?.[0];
  if (!panel) {
    fail(t, 'No panel found');
    return;
  }

  const invited = panel.invitedModerators;
  let accepted = 0;

  for (let i = 2; i < aliases.length; i++) {
    const isInvited = invited.some((m: any) => m.alias === aliases[i]);
    if (!isInvited) continue;

    const ar = await api('POST', `/flags/${contentFlagId}/accept-panel`, {}, tokens[i]);
    if (ar.status === 200) accepted++;
    if (accepted >= panel.requiredModerators) break;
  }

  if (accepted >= panel.requiredModerators) {
    pass(t, `${accepted} moderators accepted`);
  } else {
    fail(t, `Only ${accepted} of ${panel.requiredModerators} accepted`);
  }
}

async function testPanelUnderReview() {
  const t = '2.2 Panel status is reviewing after enough acceptances';
  const r = await api('GET', `/flags/${contentFlagId}`, undefined, tokens[3]);
  const panel = r.data.panels?.[0];

  if (panel && panel.status === 'reviewing') {
    pass(t);
  } else {
    fail(t, `panelStatus=${panel?.status}`);
  }
}

async function testFlagUnderReview() {
  const t = '2.3 Flag status is under_review';
  const r = await api('GET', `/flags/${contentFlagId}`, undefined, tokens[3]);

  if (r.data.flag?.status === 'under_review') {
    pass(t);
  } else {
    fail(t, `flagStatus=${r.data.flag?.status}`);
  }
}

async function testDoubleAccept() {
  const t = '2.4 Double accept blocked';
  const flagR = await api('GET', `/flags/${contentFlagId}`, undefined, tokens[3]);
  const panel = flagR.data.panels?.[0];
  const acceptedAlias = panel?.acceptedModerators?.[0]?.alias;

  if (!acceptedAlias) {
    fail(t, 'No accepted moderator found');
    return;
  }

  const idx = aliases.indexOf(acceptedAlias);
  if (idx < 0) {
    fail(t, 'Cannot find token for accepted moderator');
    return;
  }

  const r = await api('POST', `/flags/${contentFlagId}/accept-panel`, {}, tokens[idx]);
  if (r.status === 400) {
    pass(t);
  } else {
    fail(t, `Expected 400, got ${r.status}`);
  }
}

// ──────────────────────────────────────────────
// 3. RULING
// ──────────────────────────────────────────────
async function testRuleBeforeTimeLock() {
  const t = '3.1 Cannot rule before time lock expires';
  const flagR = await api('GET', `/flags/${contentFlagId}`, undefined, tokens[3]);
  const panel = flagR.data.panels?.[0];
  const modAlias = panel?.acceptedModerators?.[0]?.alias;

  if (!modAlias) {
    fail(t, 'No accepted moderator');
    return;
  }

  const idx = aliases.indexOf(modAlias);
  const r = await api('POST', `/flags/${contentFlagId}/rule`, {
    decision: 'uphold',
    statement: 'Test ruling',
    actions: [],
  }, tokens[idx]);

  if (r.status === 400) {
    pass(t);
  } else {
    fail(t, `Expected 400 (time lock), got ${r.status}`);
  }
}

// ──────────────────────────────────────────────
// 4. EXCLUSION REQUEST
// ──────────────────────────────────────────────
async function testExclusionRequest() {
  const t = '4.1 Party can submit exclusion request';

  // Use a moderator's token to read the panel (moderators see real aliases at L1-2)
  // First find a moderator who accepted — they can see real aliases
  let targetMod: string | null = null;
  for (let i = 3; i < aliases.length; i++) {
    const flagR = await api('GET', `/flags/${contentFlagId}`, undefined, tokens[i]);
    const panel = flagR.data.panels?.[0];
    const accepted = panel?.acceptedModerators;
    if (accepted && accepted.length > 0 && accepted[0].alias !== 'anonymous') {
      targetMod = accepted[0].alias;
      break;
    }
  }

  if (!targetMod) {
    fail(t, 'Could not find a real moderator alias via moderator view');
    return;
  }

  const r = await api('POST', `/flags/${contentFlagId}/exclude`, {
    targetAlias: targetMod,
    reason: 'Bias suspected',
  }, tokens[2]);

  if (r.status === 201) {
    pass(t);
  } else {
    fail(t, `status=${r.status} data=${JSON.stringify(r.data)}`);
  }
}

async function testDoubleExclusionRequest() {
  const t = '4.2 Double exclusion request blocked';
  const r = await api('POST', `/flags/${contentFlagId}/exclude`, {
    targetAlias: 'anyone',
    reason: 'Another try',
  }, tokens[2]);

  if (r.status === 400) {
    pass(t);
  } else {
    fail(t, `Expected 400, got ${r.status}`);
  }
}

async function testExclusionVote() {
  const t = '4.3 Panel member can vote on exclusion';

  // Find a moderator who can see the real panel
  let voterAlias: string | null = null;
  let exclusionTarget: string | null = null;

  for (let i = 3; i < aliases.length; i++) {
    const flagR = await api('GET', `/flags/${contentFlagId}`, undefined, tokens[i]);
    const panel = flagR.data.panels?.[0];
    if (!panel || !panel.exclusionRequests || panel.exclusionRequests.length === 0) continue;
    if (!panel.acceptedModerators || panel.acceptedModerators[0]?.alias === 'anonymous') continue;

    exclusionTarget = panel.exclusionRequests[0]?.targetAlias;
    const eligible = panel.acceptedModerators.find(
      (m: any) => m.alias !== exclusionTarget && m.alias === aliases[i],
    );
    if (eligible) {
      voterAlias = eligible.alias;
      break;
    }
  }

  if (!voterAlias) {
    fail(t, 'No eligible voter found');
    return;
  }

  const voterIdx = aliases.indexOf(voterAlias);
  const r = await api('POST', `/flags/${contentFlagId}/exclude/0/vote`, {
    approved: false,
  }, tokens[voterIdx]);

  if (r.status === 200) {
    pass(t);
  } else {
    fail(t, `status=${r.status}`);
  }
}

// ──────────────────────────────────────────────
// 5. EMERGENCY FLAG
// ──────────────────────────────────────────────
let emergencyFlagId = '';

async function testEmergencyFlag() {
  const t = '5.1 Emergency flag (CSAM) triggers auto-action';

  const r = await api('POST', '/flags', {
    flagCategory: 'emergency',
    flagType: 'csam',
    targetType: 'project',
    targetId: projectId,
    reason: 'Emergency test',
  }, tokens[0]);

  if (r.status === 201 && r.data.emergencyActionTaken === true) {
    emergencyFlagId = r.data.flag._id;
    pass(t, `flagId=${emergencyFlagId}`);
  } else {
    fail(t, `status=${r.status} data=${JSON.stringify(r.data)}`);
  }
}

async function testEmergencyPanelCreated() {
  const t = '5.2 Emergency flag has panel assigned';
  if (!emergencyFlagId) { fail(t, 'No emergency flag'); return; }

  const r = await api('GET', `/flags/${emergencyFlagId}`, undefined, tokens[0]);
  if (r.status === 200 && r.data.panels?.length > 0) {
    pass(t, `panels=${r.data.panels.length}`);
  } else {
    fail(t, `status=${r.status} panels=${r.data.panels?.length}`);
  }
}

// ──────────────────────────────────────────────
// 6. DISPUTE FLAG → MEDIATION
// ──────────────────────────────────────────────
let disputeFlagId = '';

async function testDisputeFlag() {
  const t = '6.1 Dispute flag auto-creates mediation';
  const r = await api('POST', '/flags', {
    flagCategory: 'dispute',
    flagType: 'credit_dispute',
    targetType: 'project',
    targetId: projectId,
    spaceId,
    reason: 'Credit disagreement',
  }, tokens[0]);

  if (r.status === 201 && r.data.mediation) {
    disputeFlagId = r.data.flag._id;
    pass(t, `mediationId=${r.data.mediation._id}`);
  } else {
    fail(t, `status=${r.status} mediation=${!!r.data.mediation}`);
  }
}

async function testDisputeFlagHasMediation() {
  const t = '6.2 Dispute flag linked to mediation';
  if (!disputeFlagId) { fail(t, 'No dispute flag'); return; }

  const r = await api('GET', `/flags/${disputeFlagId}`, undefined, tokens[0]);
  if (r.status === 200 && r.data.flag?.mediationId) {
    pass(t, `mediationId=${r.data.flag.mediationId}`);
  } else {
    fail(t, `mediationId=${r.data.flag?.mediationId}`);
  }
}

// ──────────────────────────────────────────────
// 7. APPEAL
// ──────────────────────────────────────────────
let appealFlagId = '';
let appealPanelAccepted: string[] = [];

async function testAppealSetup() {
  const r = await api('POST', '/flags', {
    flagCategory: 'attribution',
    flagType: 'plagiarism',
    targetType: 'project',
    targetId: projectId,
    spaceId,
    reason: 'Appeal test flag',
  }, tokens[1]);
  if (r.status !== 201) {
    fail('7.0 Setup: create flag', `status=${r.status}`);
    return;
  }
  appealFlagId = r.data.flag._id;

  const flagR = await api('GET', `/flags/${appealFlagId}`, undefined, tokens[2]);
  const panel = flagR.data.panels?.[0];
  if (!panel) { fail('7.0 Setup: no panel', ''); return; }

  for (let i = 2; i < aliases.length; i++) {
    const isInvited = panel.invitedModerators.some((m: any) => m.alias === aliases[i]);
    if (!isInvited) continue;

    const ar = await api('POST', `/flags/${appealFlagId}/accept-panel`, {}, tokens[i]);
    if (ar.status === 200) {
      appealPanelAccepted.push(aliases[i]);
      if (appealPanelAccepted.length >= panel.requiredModerators) break;
    }
  }
}

async function testAppealNotYetRuled() {
  const t = '7.1 Cannot appeal before ruling';
  const r = await api('POST', `/flags/${appealFlagId}/appeal`, {
    reason: 'Too early',
  }, tokens[1]);

  if (r.status === 400) {
    pass(t);
  } else {
    fail(t, `Expected 400, got ${r.status}`);
  }
}

// ──────────────────────────────────────────────
// 8. SLASH
// ──────────────────────────────────────────────
async function testSlash() {
  const t = '8.1 Slash creates governance flag';
  const r = await api('POST', `/flags/${contentFlagId}/slash`, undefined, tokens[2]);

  if (r.status === 201 && r.data.slashFlag?.flagType === 'moderator_bad_faith') {
    pass(t);
  } else {
    fail(t, `status=${r.status} data=${JSON.stringify(r.data)}`);
  }
}

// ──────────────────────────────────────────────
// 9. LIST AND GET
// ──────────────────────────────────────────────
async function testListByTarget() {
  const t = '9.1 List flags by target';
  const r = await api('GET', `/flags/target/project/${projectId}`, undefined, tokens[0]);

  if (r.status === 200 && Array.isArray(r.data) && r.data.length >= 1) {
    pass(t, `count=${r.data.length}`);
  } else {
    fail(t, `status=${r.status} count=${r.data?.length}`);
  }
}

async function testMyPanels() {
  const t = '9.2 List my panels';
  const modIdx = aliases.indexOf(appealPanelAccepted[0]);
  if (modIdx < 0) {
    fail(t, 'No moderator with accepted panel');
    return;
  }

  const r = await api('GET', '/flags/my-panels', undefined, tokens[modIdx]);

  if (r.status === 200 && Array.isArray(r.data) && r.data.length >= 1) {
    pass(t, `count=${r.data.length}`);
  } else {
    fail(t, `status=${r.status} count=${r.data?.length}`);
  }
}

async function testGetNotFound() {
  const t = '9.3 Get non-existent flag returns 404';
  const r = await api('GET', '/flags/000000000000000000000000', undefined, tokens[0]);
  if (r.status === 404) {
    pass(t);
  } else {
    fail(t, `Expected 404, got ${r.status}`);
  }
}

// ──────────────────────────────────────────────
// 10. ANONYMITY
// ──────────────────────────────────────────────
async function testAnonymityLevel1() {
  const t = '10.1 Level 1-2: party does not see moderator aliases';
  const r = await api('GET', `/flags/${contentFlagId}`, undefined, tokens[2]);

  if (r.status === 200 && r.data.panels?.[0]) {
    const panel = r.data.panels[0];
    const allAnon = panel.acceptedModerators?.every((m: any) => m.alias === 'anonymous');
    if (allAnon) {
      pass(t);
    } else {
      fail(t, `Moderator aliases visible to party: ${JSON.stringify(panel.acceptedModerators)}`);
    }
  } else {
    fail(t, `status=${r.status}`);
  }
}

// ──────────────────────────────────────────────
// MAIN
// ──────────────────────────────────────────────
async function main() {
  console.log('='.repeat(65));
  console.log(' MODERATION SYSTEM — INTEGRATION TESTS');
  console.log('='.repeat(65));

  await setup();

  // 1. Raise flags
  await testRaiseContentFlag();
  await testFlagHasPanel();
  await testInvalidCategoryType();

  // 2. Accept panel
  await testAcceptPanel();
  await testPanelUnderReview();
  await testFlagUnderReview();
  await testDoubleAccept();

  // 3. Ruling (time lock guard)
  await testRuleBeforeTimeLock();

  // 4. Exclusion
  await testExclusionRequest();
  await testDoubleExclusionRequest();
  await testExclusionVote();

  // 5. Emergency
  await testEmergencyFlag();
  await testEmergencyPanelCreated();

  // 6. Dispute → Mediation
  await testDisputeFlag();
  await testDisputeFlagHasMediation();

  // 7. Appeal guards
  await testAppealSetup();
  await testAppealNotYetRuled();

  // 8. Slash
  await testSlash();

  // 9. List / Get
  await testListByTarget();
  await testMyPanels();
  await testGetNotFound();

  // 10. Anonymity
  await testAnonymityLevel1();

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
