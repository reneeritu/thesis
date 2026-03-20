import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';

import { connectDatabase } from './src/config/database';
import { Media } from './src/models/Media';
import { ModerationPanel } from './src/models/ModerationPanel';

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
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data: any;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  return { status: res.status, data };
}

async function uploadFile(projectId: string, token: string): Promise<any> {
  const boundary = '----FormBoundary' + uid();
  const fileContent = 'fake image data for testing ' + uid();
  const body = [
    `--${boundary}`,
    'Content-Disposition: form-data; name="file"; filename="test.png"',
    'Content-Type: image/png',
    '',
    fileContent,
    `--${boundary}`,
    'Content-Disposition: form-data; name="projectId"',
    '',
    projectId,
    `--${boundary}--`,
  ].join('\r\n');
  const res = await fetch(`${BASE}/upload`, {
    method: 'POST',
    headers: {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'Authorization': `Bearer ${token}`,
    },
    body,
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
let mediaId = '';
let nciiMediaId = '';
let illegalMediaId = '';
let nudityMediaId = '';
let nuditySpaceId = '';

let tokenByAlias = new Map<string, string>();

let csamPathBefore = '';
let csamThumbPathBefore = '';

let nciiPathBefore = '';
let nciiThumbPathBefore = '';
let nciiBackupPath = '';

let illegalPathBefore = '';
let illegalThumbPathBefore = '';

let nudityPathBefore = '';

function thumbPath(filePath: string): string {
  const parsed = path.parse(filePath);
  return path.join(parsed.dir, `${parsed.name}_thumb${parsed.ext}`);
}

async function acceptPanelUntilReview(flagId: string) {
  let panel = await ModerationPanel.findOne({ flagId }).sort({ createdAt: -1 });
  if (!panel) throw new Error(`No ModerationPanel found for flagId=${flagId}`);

  // Tests may run with existing chain state containing moderators we don't have tokens for.
  // To focus on content-safety outcomes, we force the panel into a `reviewing` state and
  // mark a set of our test nodes as accepted moderators.
  const needed = panel.requiredModerators;
  const ourAliases = aliases.slice(0, Math.max(needed, 1));
  if (ourAliases.length < needed) {
    throw new Error(`Not enough local test aliases to fill requiredModerators=${needed}`);
  }

  panel.acceptedModerators = ourAliases.slice(0, needed).map((alias) => ({
    alias,
    acceptedAt: new Date(),
  })) as any;
  panel.status = 'reviewing';
  panel.timeLockExpiry = new Date(Date.now() - 1000);

  await panel.save();
  return panel;
}

async function forceTimeLockPast(panelId: string) {
  await ModerationPanel.updateOne(
    { _id: panelId },
    {
      $set: {
        status: 'reviewing',
        timeLockExpiry: new Date(Date.now() - 1000),
      },
    },
  );
}

async function setup() {
  for (let i = 0; i < 8; i++) {
    const alias = `cs${String.fromCharCode(97 + i)}_${uid()}`;
    const r = await api('POST', '/auth/register', { alias, password: pw });
    if (r.status !== 201) throw new Error(`Setup: register failed: ${JSON.stringify(r.data)}`);
    tokens.push(r.data.token);
    aliases.push(alias);
  }
  tokenByAlias = new Map(aliases.map((a, i) => [a, tokens[i]]));

  const sr = await api('POST', '/spaces', {
    name: `csspace_${uid()}`, projectAccess: 'open',
    vetoAuthority: [aliases[0]], votingThreshold: 0.5,
    privacyDefault: 'space_specific', allowCustomContracts: true,
  }, tokens[0]);
  if (sr.status !== 201) throw new Error('Setup: space failed');
  spaceId = sr.data._id;

  for (let i = 1; i < 8; i++) await api('POST', `/spaces/${spaceId}/join`, {}, tokens[i]);

  const pr = await api('POST', '/projects', {
    title: `CSTest_${uid()}`, spaceId,
    contributors: [
      { alias: aliases[0], role: 'lead', isPrimary: true },
      { alias: aliases[1], role: 'contributor', isPrimary: false },
    ],
  }, tokens[0]);
  if (pr.status !== 201) throw new Error('Setup: project failed');
  projectId = pr.data._id;

  const u1 = await uploadFile(projectId, tokens[0]);
  if (u1.status === 201) mediaId = u1.data.mediaId;

  const u2 = await uploadFile(projectId, tokens[0]);
  if (u2.status === 201) nciiMediaId = u2.data.mediaId;

  const u3 = await uploadFile(projectId, tokens[0]);
  if (u3.status === 201) illegalMediaId = u3.data.mediaId;

  const nsr = await api('POST', '/spaces', {
    name: `nudsp_${uid()}`,
    settings: {
      projectAccess: 'open',
      vetoAuthority: [aliases[0]],
      votingThreshold: 0.5,
      privacyDefault: 'space_specific',
      customContractsAllowed: true,
      contentRestrictions: ['nudity'],
    },
  }, tokens[0]);
  if (nsr.status !== 201) throw new Error('Setup: nudity space failed');
  nuditySpaceId = nsr.data._id;
  for (let i = 1; i < 8; i++) await api('POST', `/spaces/${nuditySpaceId}/join`, {}, tokens[i]);

  const npr = await api('POST', '/projects', {
    title: `NudTest_${uid()}`, spaceId: nuditySpaceId,
    contributors: [{ alias: aliases[0], role: 'lead', isPrimary: true }],
  }, tokens[0]);
  if (npr.status === 201) {
    const nu = await uploadFile(npr.data._id, tokens[0]);
    if (nu.status === 201) nudityMediaId = nu.data.mediaId;
  }

  console.log('Setup complete\n');
}

let csamFlagId = '';
async function testCsamFlag() {
  const t = '1.1 CSAM flag triggers emergency action';
  if (!mediaId) { fail(t, 'No media'); return; }

  const mediaBefore = await Media.findById(mediaId).lean();
  if (!mediaBefore) { fail(t, 'Media doc missing before CSAM'); return; }
  csamPathBefore = mediaBefore.path;
  csamThumbPathBefore = thumbPath(mediaBefore.path);

  const fileExistsBefore = fs.existsSync(csamPathBefore);
  if (!fileExistsBefore) {
    fail(t, `Expected media file to exist before CSAM: ${csamPathBefore}`);
    return;
  }

  const r = await api('POST', '/flags', {
    flagCategory: 'emergency',
    flagType: 'csam',
    targetType: 'media',
    targetId: mediaId,
    reason: 'CSAM test',
  }, tokens[2]);

  if (!(r.status === 201 && r.data.emergencyActionTaken && r.data.flag?._id)) {
    fail(t, `status=${r.status} data=${JSON.stringify(r.data)}`);
    return;
  }

  csamFlagId = r.data.flag._id;

  const mediaAfter = await Media.findById(mediaId).lean();
  const fileExistsAfter = fs.existsSync(csamPathBefore);
  const thumbExistsAfter = fs.existsSync(csamThumbPathBefore);

  if (mediaAfter) {
    fail(t, `Expected Media record to be deleted for CSAM, but it still exists`);
    return;
  }
  if (fileExistsAfter) {
    fail(t, `Expected CSAM media file to be deleted: ${csamPathBefore}`);
    return;
  }
  if (thumbExistsAfter) {
    // Thumbnail may or may not have been created depending on sharp success; still enforce deletion.
    fail(t, `Expected CSAM thumbnail to be deleted: ${csamThumbPathBefore}`);
    return;
  }

  const get = await api('GET', `/media/${mediaId}`);
  if (get.status !== 404) {
    fail(t, `Expected GET /media for removed CSAM to be 404; got ${get.status}`);
    return;
  }

  pass(t);
}

async function testCsamPanel() {
  const t = '1.2 CSAM flag has panel';
  if (!csamFlagId) { fail(t, 'skip'); return; }
  const r = await api('GET', `/flags/${csamFlagId}`, undefined, tokens[2]);
  if (r.status === 200 && r.data.panels?.length > 0) pass(t);
  else fail(t, `panels=${r.data.panels?.length}`);
}

let nciiFlagId = '';
async function testNciiFlag() {
  const t = '2.1 NCII flag hides content';
  if (!nciiMediaId) { fail(t, 'No media'); return; }

  const mediaBefore = await Media.findById(nciiMediaId).lean();
  if (!mediaBefore) { fail(t, 'Media doc missing before NCII'); return; }
  nciiPathBefore = mediaBefore.path;
  nciiThumbPathBefore = thumbPath(mediaBefore.path);

  if (!fs.existsSync(nciiPathBefore)) {
    fail(t, `Expected NCII media file to exist before flag: ${nciiPathBefore}`);
    return;
  }

  const r = await api('POST', '/flags', {
    flagCategory: 'emergency',
    flagType: 'non_consensual_imagery',
    targetType: 'media',
    targetId: nciiMediaId,
    reason: 'NCII test',
  }, tokens[2]);

  if (!(r.status === 201 && r.data.emergencyActionTaken && r.data.flag?._id)) {
    fail(t, `status=${r.status} data=${JSON.stringify(r.data)}`);
    return;
  }

  nciiFlagId = r.data.flag._id;

  const mediaAfter = await Media.findById(nciiMediaId).lean();
  if (!mediaAfter) { fail(t, 'Expected Media doc to still exist after NCII hide'); return; }
  if (mediaAfter.status !== 'hidden') {
    fail(t, `Expected Media.status=hidden after NCII; got ${mediaAfter.status}`);
    return;
  }
  if (!mediaAfter.encryptedBackupPath) {
    fail(t, 'Expected Media.encryptedBackupPath to be set after NCII hide');
    return;
  }

  nciiBackupPath = mediaAfter.encryptedBackupPath;

  if (!fs.existsSync(nciiBackupPath)) {
    fail(t, `Expected encrypted backup file to exist: ${nciiBackupPath}`);
    return;
  }

  // Original user-facing content should be removed.
  if (fs.existsSync(nciiPathBefore)) {
    fail(t, `Expected NCII original media file to be removed: ${nciiPathBefore}`);
    return;
  }

  // File should not be directly retrievable after NCII hide (original content deleted).
  const getPublic = await api('GET', `/media/${nciiMediaId}`);
  if (getPublic.status !== 404) {
    // If the token is attached and server returns 403, that is also acceptable for content-safety.
    if (getPublic.status !== 403) {
      fail(t, `Expected GET /media after NCII hide to block retrieval (404/403); got ${getPublic.status}`);
      return;
    }
  }

  pass(t);
}

async function testNcii24h() {
  const t = '2.2 NCII dismiss restores content and removes backup';
  if (!nciiFlagId) { fail(t, 'skip'); return; }

  // Accept enough moderators to reach `reviewing`.
  const panel = await acceptPanelUntilReview(nciiFlagId);
  await forceTimeLockPast(panel._id.toString());

  if (!panel.acceptedModerators?.length) {
    fail(t, 'Expected at least one accepted moderator for NCII panel');
    return;
  }

  const rulerAlias = panel.acceptedModerators[0].alias;
  const rulerToken = tokenByAlias.get(rulerAlias);
  if (!rulerToken) {
    fail(t, `Missing token for accepted moderator alias=${rulerAlias}`);
    return;
  }

  const beforeBackupPath = nciiBackupPath;
  const r = await api('POST', `/flags/${nciiFlagId}/rule`, {
    decision: 'dismiss',
    statement: 'NCII false flag — restore media',
    actions: ['content_restore'],
  }, rulerToken);

  if (r.status >= 400) {
    fail(t, `Rule dismiss failed: status=${r.status} data=${JSON.stringify(r.data)}`);
    return;
  }

  const mediaAfter = await Media.findById(nciiMediaId).lean();
  if (!mediaAfter) { fail(t, 'Media doc missing after NCII restore'); return; }
  if (mediaAfter.status !== 'active') {
    fail(t, `Expected Media.status=active after restore; got ${mediaAfter.status}`);
    return;
  }
  if (mediaAfter.encryptedBackupPath) {
    fail(t, 'Expected Media.encryptedBackupPath to be null after restore');
    return;
  }

  if (beforeBackupPath && fs.existsSync(beforeBackupPath)) {
    fail(t, `Expected encrypted backup to be removed: ${beforeBackupPath}`);
    return;
  }

  const restoredExists = fs.existsSync(mediaAfter.path);
  if (!restoredExists) {
    fail(t, `Expected restored media file to exist: ${mediaAfter.path}`);
    return;
  }

  pass(t);
}

let illegalFlagId = '';
async function testIllegalFlag() {
  const t = '3.1 Illegal content flag raised';
  if (!illegalMediaId) { fail(t, 'No media'); return; }
  const r = await api('POST', '/flags', {
    flagCategory: 'content', flagType: 'illegal_content',
    targetType: 'media', targetId: illegalMediaId,
    spaceId, reason: 'Illegal test',
  }, tokens[2]);
  if (r.status === 201 && r.data.flag) {
    illegalFlagId = r.data.flag._id;
    pass(t);
  } else fail(t, `status=${r.status}`);
}

async function testIllegalPanel() {
  const t = '3.2 Illegal content upheld removes media';
  if (!illegalFlagId || !illegalMediaId) { fail(t, 'skip'); return; }

  const mediaBefore = await Media.findById(illegalMediaId).lean();
  if (!mediaBefore) { fail(t, 'Illegal Media doc missing'); return; }
  illegalPathBefore = mediaBefore.path;
  illegalThumbPathBefore = thumbPath(mediaBefore.path);

  const panel = await acceptPanelUntilReview(illegalFlagId);
  await forceTimeLockPast(panel._id.toString());

  if (!panel.acceptedModerators?.length) {
    fail(t, 'Expected at least one accepted moderator');
    return;
  }

  const rulerAlias = panel.acceptedModerators[0].alias;
  const rulerToken = tokenByAlias.get(rulerAlias);
  if (!rulerToken) {
    fail(t, `Missing token for accepted moderator alias=${rulerAlias}`);
    return;
  }

  const r = await api('POST', `/flags/${illegalFlagId}/rule`, {
    decision: 'uphold',
    statement: 'Illegal content confirmed — remove media',
    actions: ['content_remove'],
  }, rulerToken);

  if (r.status >= 400) {
    fail(t, `Rule uphold failed: status=${r.status} data=${JSON.stringify(r.data)}`);
    return;
  }

  const mediaAfter = await Media.findById(illegalMediaId).lean();
  if (!mediaAfter) { fail(t, 'Expected Media doc to exist (status removed)'); return; }
  if (mediaAfter.status !== 'removed') {
    fail(t, `Expected Media.status=removed; got ${mediaAfter.status}`);
    return;
  }

  if (fs.existsSync(illegalPathBefore)) {
    fail(t, `Expected illegal media file to be deleted: ${illegalPathBefore}`);
    return;
  }

  const get = await api('GET', `/media/${illegalMediaId}`);
  if (get.status !== 404) {
    fail(t, `Expected public GET /media for removed content to be 404; got ${get.status}`);
    return;
  }

  pass(t);
}

async function testNudityNoSpace() {
  const t = '4.1 Nudity without spaceId rejected';
  const r = await api('POST', '/flags', {
    flagCategory: 'content', flagType: 'nudity',
    targetType: 'media', targetId: nudityMediaId || projectId,
    reason: 'No space',
  }, tokens[2]);
  if (r.status === 400) pass(t);
  else fail(t, `Expected 400, got ${r.status}`);
}

async function testNudityNoRestriction() {
  const t = '4.2 Nudity rejected in unrestricted space';
  const r = await api('POST', '/flags', {
    flagCategory: 'content', flagType: 'nudity',
    targetType: 'project', targetId: projectId,
    spaceId, reason: 'Unrestricted',
  }, tokens[2]);
  if (r.status === 400) pass(t);
  else fail(t, `Expected 400, got ${r.status}`);
}

let nudityFlagId = '';
async function testNudityAccepted() {
  const t = '4.3 Nudity accepted in restricted space';
  const r = await api('POST', '/flags', {
    flagCategory: 'content', flagType: 'nudity',
    targetType: 'media', targetId: nudityMediaId || projectId,
    spaceId: nuditySpaceId, reason: 'Restricted space',
  }, tokens[2]);
  if (r.status === 201 && r.data.flag) {
    nudityFlagId = r.data.flag._id;
    pass(t);
  } else fail(t, `status=${r.status} data=${JSON.stringify(r.data)}`);
}

async function testNudityPanel() {
  const t = '4.4 Nudity uphold hides in space via hiddenInSpaces';
  if (!nudityFlagId) { fail(t, 'skip'); return; }

  if (!nudityMediaId || !nuditySpaceId) {
    fail(t, 'Missing nudityMediaId/nuditySpaceId');
    return;
  }

  const mediaBefore = await Media.findById(nudityMediaId).lean();
  if (!mediaBefore) { fail(t, 'Nudity Media doc missing before ruling'); return; }
  nudityPathBefore = mediaBefore.path;
  if (!fs.existsSync(nudityPathBefore)) {
    fail(t, 'Expected nudity media file to exist before ruling');
    return;
  }

  const panel = await acceptPanelUntilReview(nudityFlagId);
  await forceTimeLockPast(panel._id.toString());

  if (!panel.acceptedModerators?.length) {
    fail(t, 'Expected accepted moderators for nudity panel');
    return;
  }

  const rulerAlias = panel.acceptedModerators[0].alias;
  const rulerToken = tokenByAlias.get(rulerAlias);
  if (!rulerToken) {
    fail(t, `Missing token for accepted moderator alias=${rulerAlias}`);
    return;
  }

  const r = await api('POST', `/flags/${nudityFlagId}/rule`, {
    decision: 'uphold',
    statement: 'Nudity confirmed — hide in this space',
    actions: ['content_hide_in_space'],
  }, rulerToken);

  if (r.status >= 400) {
    fail(t, `Rule uphold failed: status=${r.status} data=${JSON.stringify(r.data)}`);
    return;
  }

  const mediaAfter = await Media.findById(nudityMediaId).lean();
  if (!mediaAfter) { fail(t, 'Media doc missing after nudity ruling'); return; }
  if (!mediaAfter.hiddenInSpaces?.length) {
    fail(t, 'Expected Media.hiddenInSpaces to be updated');
    return;
  }

  const hasSpace = mediaAfter.hiddenInSpaces.some((s: any) => s.toString() === nuditySpaceId);
  if (!hasSpace) {
    fail(t, `Expected hiddenInSpaces to contain nuditySpaceId=${nuditySpaceId}`);
    return;
  }

  // Media should not be deleted for nudity hide-in-space.
  if (!fs.existsSync(mediaAfter.path)) {
    fail(t, `Expected nudity media file to still exist: ${mediaAfter.path}`);
    return;
  }

  // Authenticated nodes in the hidden space should receive 403.
  const getAuth = await api('GET', `/media/${nudityMediaId}`, undefined, tokens[1]);
  if (getAuth.status !== 403) {
    fail(t, `Expected GET /media for nudity-hidden content to be 403; got ${getAuth.status}`);
    return;
  }

  pass(t);
}

async function testDisputeRegression() {
  const t = '5.1 Dispute still creates mediation';
  const r = await api('POST', '/flags', {
    flagCategory: 'dispute', flagType: 'credit_dispute',
    targetType: 'project', targetId: projectId,
    spaceId, reason: 'Regression check',
  }, tokens[0]);
  if (r.status === 201 && r.data.mediation) pass(t);
  else fail(t, `status=${r.status}`);
}

async function testMediaTarget() {
  const t = '6.1 targetType=media accepted';
  const r = await api('POST', '/flags', {
    flagCategory: 'content', flagType: 'harassment',
    targetType: 'media', targetId: projectId,
    spaceId, reason: 'Media target test',
  }, tokens[3]);
  if (r.status === 201) pass(t);
  else fail(t, `status=${r.status}`);
}

async function main() {
  console.log('='.repeat(65));
  console.log(' CONTENT & SAFETY TESTS (Phase 3C)');
  console.log('='.repeat(65));
  await connectDatabase();
  await setup();

  await testCsamFlag();
  await testCsamPanel();
  await testNciiFlag();
  await testNcii24h();
  await testIllegalFlag();
  await testIllegalPanel();
  await testNudityNoSpace();
  await testNudityNoRestriction();
  await testNudityAccepted();
  await testNudityPanel();
  await testDisputeRegression();
  await testMediaTarget();

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const total = results.length;

  console.log('\n' + '='.repeat(65));
  console.log(' RESULTS');
  console.log('='.repeat(65));
  let section = '';
  for (const r of results) {
    const ns = r.name.split(' ')[0];
    if (ns !== section) { section = ns; console.log(''); }
    const sym = r.passed ? '+' : '-';
    const tag = r.passed ? 'PASS' : 'FAIL';
    console.log(`  [${sym}] ${tag}: ${r.name}`);
    if (!r.passed) console.log(`         ${r.detail}`);
  }
  console.log('\n' + '='.repeat(65));
  if (failed === 0) console.log(`  ALL ${total} TESTS PASSED`);
  else console.log(`  ${passed}/${total} PASSED, ${failed} FAILED`);
  console.log('='.repeat(65) + '\n');
  try {
    await mongoose.disconnect();
  } catch {
    // ignore
  }
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => { console.error('Unhandled:', err); process.exit(1); });
