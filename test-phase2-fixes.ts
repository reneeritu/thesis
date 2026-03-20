/**
 * Phase 2 fix verification script.
 *
 * Tests:
 *   1. VETO hard_stop sets project status to 'halted' (not 'completed')
 *   2. FORK accepts an optional targetSpaceId to place the fork in a different space
 *   3. CREDIT with disputeFlag marks project as 'disputed' (TODO comment verified manually)
 *   4. REFERENCE is allowed on projects with status 'halted'
 *
 * Prerequisites:
 *   - Server running on BASE_URL (default http://localhost:3000)
 *   - MongoDB reachable
 *
 * Run:  npx ts-node test-phase2-fixes.ts
 *        (or: npx tsx test-phase2-fixes.ts)
 */

const BASE = process.env.BASE_URL || 'http://localhost:3000';

interface TestResult {
  name: string;
  passed: boolean;
  detail: string;
}

const results: TestResult[] = [];
const uid = () => Math.random().toString(36).slice(2, 8);

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

async function setup() {
  const aliasA = `testa_${uid()}`;
  const aliasB = `testb_${uid()}`;
  const pw = 'TestPass123!';

  const regA = await api('POST', '/auth/register', { alias: aliasA, password: pw });
  const regB = await api('POST', '/auth/register', { alias: aliasB, password: pw });

  if (regA.status !== 201 || regB.status !== 201) {
    throw new Error(`Registration failed: A=${regA.status} B=${regB.status}`);
  }

  const tokenA = regA.data.token;
  const tokenB = regB.data.token;

  const spaceRes = await api('POST', '/spaces', { name: `TestSpace_${uid()}` }, tokenA);
  if (spaceRes.status !== 201) throw new Error(`Space creation failed: ${spaceRes.status}`);
  const spaceId = spaceRes.data._id;

  await api('POST', `/spaces/${spaceId}/join`, {}, tokenB);

  const projRes = await api(
    'POST',
    '/projects',
    {
      title: `TestProject_${uid()}`,
      spaceId,
      contributors: [{ alias: aliasB, role: 'contributor', isPrimary: true }],
    },
    tokenA,
  );
  if (projRes.status !== 201) throw new Error(`Project creation failed: ${projRes.status}`);
  const projectId = projRes.data._id;

  return { aliasA, aliasB, tokenA, tokenB, spaceId, projectId };
}

async function testVetoHardStop() {
  const name = '1. VETO hard_stop → project status = halted';
  try {
    const { aliasA, tokenA, spaceId, projectId } = await setup();

    await api(
      'PATCH',
      `/spaces/${spaceId}/settings`,
      { vetoAuthority: [aliasA] },
      tokenA,
    );

    const vetoRes = await api(
      'POST',
      '/vetos',
      { projectId, vetoType: 'hard_stop', reason: 'Test halt' },
      tokenA,
    );

    if (vetoRes.status !== 201) {
      results.push({ name, passed: false, detail: `Veto creation returned ${vetoRes.status}` });
      return;
    }

    const projRes = await api('GET', `/projects/${projectId}`, undefined, tokenA);
    const status = projRes.data.status;

    if (status === 'halted') {
      results.push({ name, passed: true, detail: `Project status is '${status}'` });
    } else {
      results.push({ name, passed: false, detail: `Expected 'halted', got '${status}'` });
    }
  } catch (err: any) {
    results.push({ name, passed: false, detail: err.message });
  }
}

async function testForkTargetSpace() {
  const name = '2. FORK with targetSpaceId → project in different space';
  try {
    const { aliasA, tokenA, spaceId, projectId } = await setup();

    const space2Res = await api(
      'POST',
      '/spaces',
      { name: `ForkTarget_${uid()}` },
      tokenA,
    );
    if (space2Res.status !== 201) {
      results.push({ name, passed: false, detail: `Second space creation failed: ${space2Res.status}` });
      return;
    }
    const targetSpaceId = space2Res.data._id;

    const forkRes = await api(
      'POST',
      '/forks',
      {
        parentProjectId: projectId,
        title: `ForkedProject_${uid()}`,
        forkReason: 'Testing cross-space fork',
        targetSpaceId,
      },
      tokenA,
    );

    if (forkRes.status !== 201) {
      results.push({
        name,
        passed: false,
        detail: `Fork returned ${forkRes.status}: ${JSON.stringify(forkRes.data)}`,
      });
      return;
    }

    const forkedSpaceId = forkRes.data.forkedProject.spaceId;
    const returnedTargetSpaceId = forkRes.data.targetSpaceId;

    if (forkedSpaceId === targetSpaceId && returnedTargetSpaceId === targetSpaceId) {
      results.push({
        name,
        passed: true,
        detail: `Forked project landed in target space ${targetSpaceId}`,
      });
    } else {
      results.push({
        name,
        passed: false,
        detail: `Expected spaceId=${targetSpaceId}, got project.spaceId=${forkedSpaceId}`,
      });
    }
  } catch (err: any) {
    results.push({ name, passed: false, detail: err.message });
  }
}

async function testCreditDisputeFlag() {
  const name = '3. CREDIT with disputeFlag → project status = disputed';
  try {
    const { aliasA, tokenA, projectId } = await setup();

    const creditRes = await api(
      'POST',
      '/credits',
      { projectId, disputeFlag: true },
      tokenA,
    );

    if (creditRes.status !== 201) {
      results.push({
        name,
        passed: false,
        detail: `Credit returned ${creditRes.status}: ${JSON.stringify(creditRes.data)}`,
      });
      return;
    }

    const projRes = await api('GET', `/projects/${projectId}`, undefined, tokenA);
    const status = projRes.data.status;

    if (status === 'disputed') {
      results.push({ name, passed: true, detail: `Project status is '${status}'` });
    } else {
      results.push({ name, passed: false, detail: `Expected 'disputed', got '${status}'` });
    }
  } catch (err: any) {
    results.push({ name, passed: false, detail: err.message });
  }
}

async function testReferenceOnHaltedProject() {
  const name = '4. REFERENCE on halted project → allowed';
  try {
    const { aliasA, tokenA, spaceId, projectId } = await setup();

    await api(
      'PATCH',
      `/spaces/${spaceId}/settings`,
      { vetoAuthority: [aliasA] },
      tokenA,
    );

    await api(
      'POST',
      '/vetos',
      { projectId, vetoType: 'hard_stop', reason: 'Halt for ref test' },
      tokenA,
    );

    const projCheck = await api('GET', `/projects/${projectId}`, undefined, tokenA);
    if (projCheck.data.status !== 'halted') {
      results.push({
        name,
        passed: false,
        detail: `Setup failed: project status is '${projCheck.data.status}' instead of 'halted'`,
      });
      return;
    }

    const refRes = await api(
      'POST',
      '/references',
      {
        projectId,
        externalUrl: 'https://example.com/inspiration',
        relationshipType: 'inspired_by',
      },
      tokenA,
    );

    if (refRes.status === 201) {
      results.push({ name, passed: true, detail: 'Reference created on halted project' });
    } else {
      results.push({
        name,
        passed: false,
        detail: `Expected 201, got ${refRes.status}: ${JSON.stringify(refRes.data)}`,
      });
    }
  } catch (err: any) {
    results.push({ name, passed: false, detail: err.message });
  }
}

async function main() {
  console.log('='.repeat(60));
  console.log(' Phase 2 Fix Verification');
  console.log('='.repeat(60));
  console.log(`Target: ${BASE}\n`);

  const healthCheck = await fetch(`${BASE}/health`).catch(() => null);
  if (!healthCheck || healthCheck.status !== 200) {
    console.error('FATAL: Server not reachable at', BASE);
    process.exit(1);
  }
  console.log('Server is up.\n');

  await testVetoHardStop();
  await testForkTargetSpace();
  await testCreditDisputeFlag();
  await testReferenceOnHaltedProject();

  console.log('\n' + '='.repeat(60));
  console.log(' Results');
  console.log('='.repeat(60));

  let allPassed = true;
  for (const r of results) {
    const tag = r.passed ? 'PASS' : 'FAIL';
    const symbol = r.passed ? '+' : '-';
    console.log(`  [${symbol}] ${tag}: ${r.name}`);
    console.log(`         ${r.detail}`);
    if (!r.passed) allPassed = false;
  }

  console.log('\n' + '='.repeat(60));
  console.log(
    allPassed
      ? '  ALL TESTS PASSED'
      : `  ${results.filter((r) => !r.passed).length}/${results.length} TESTS FAILED`,
  );
  console.log('='.repeat(60) + '\n');

  process.exit(allPassed ? 0 : 1);
}

main().catch((err) => {
  console.error('Unhandled error:', err);
  process.exit(1);
});
