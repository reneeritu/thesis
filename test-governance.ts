/**
 * Integration tests — Phase 3D (Tier 3 governance).
 *
 * Run:
 *   npx ts-node test-governance.ts
 * (backend must be running on BASE_URL)
 */

import mongoose from 'mongoose';

import { connectDatabase } from './src/config/database';
import { ChainNode } from './src/models/Node';
import { GovernanceProposal } from './src/models/GovernanceProposal';

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const pw = 'Testpass1!';

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

async function registerNodes(count: number): Promise<{ aliases: string[]; tokens: string[] }> {
  const aliases: string[] = [];
  const tokens: string[] = [];
  for (let i = 0; i < count; i++) {
    const alias = `gov${i}_${uid()}`;
    const r = await api('POST', '/auth/register', { alias, password: pw });
    if (r.status !== 201) throw new Error(`register failed: ${JSON.stringify(r.data)}`);
    aliases.push(alias);
    tokens.push(r.data.token);
  }
  return { aliases, tokens };
}

async function setActiveSnapshotToRemoved(snapshotAliases: string[]): Promise<void> {
  await ChainNode.updateMany(
    { alias: { $in: snapshotAliases }, status: 'active' },
    { $set: { status: 'removed' } },
  );
}

async function restoreSnapshotStatus(aliasesToRestore: string[], status: 'active' | 'suspended' | 'removed'): Promise<void> {
  // Only restoring to a single known status keeps this test simple.
  await ChainNode.updateMany(
    { alias: { $in: aliasesToRestore } },
    { $set: { status } },
  );
}

function computeYesThreshold(eligibleActiveNodes: number, complexityLevel: 3 | 4): number {
  const percent = complexityLevel === 3 ? 51 : 70;
  return Math.ceil((eligibleActiveNodes * percent) / 100);
}

function computeQuorumVotes(eligibleActiveNodes: number): number {
  return Math.ceil((eligibleActiveNodes * 10) / 100);
}

async function fastForwardDiscussion(proposalId: string): Promise<void> {
  await GovernanceProposal.updateOne(
    { _id: proposalId },
    { $set: { discussEndsAt: new Date(Date.now() - 1000) } },
  );
}

async function fastForwardVoting(proposalId: string): Promise<void> {
  await GovernanceProposal.updateOne(
    { _id: proposalId },
    { $set: { votingEndsAt: new Date(Date.now() - 1000) } },
  );
}

async function main() {
  console.log('='.repeat(70));
  console.log(' PHASE 3D — GOVERNANCE TESTS');
  console.log('='.repeat(70));

  await connectDatabase();

  // Snapshot existing active nodes so denominator is deterministic.
  const activeBefore = await ChainNode.find({ status: 'active' }).select('alias status').lean();
  const activeBeforeAliases = activeBefore.map((n: any) => n.alias as string);

  const N = 30;
  const { aliases, tokens } = await registerNodes(N);

  // Remove all pre-existing active nodes from quorum denominator.
  // Keep test nodes active.
  const testAliasSet = new Set(aliases);
  const toRemove = activeBeforeAliases.filter((a) => !testAliasSet.has(a));
  await setActiveSnapshotToRemoved(toRemove);

  const eligibleActiveNodes = await ChainNode.countDocuments({ status: 'active' });
  if (eligibleActiveNodes !== N) {
    throw new Error(`Expected eligibleActiveNodes=${N} after snapshot removal; got ${eligibleActiveNodes}`);
  }

  // ──────────────────────────────────────────────
  // 1) Invalid proposal key rejected
  // ──────────────────────────────────────────────
  {
    const alias0 = aliases[0];
    const token0 = tokens[0];
    const t = '1.1 Invalid governance change keys rejected';
    const r = await api('POST', '/governance/proposals', { scope: 'parameter', changes: { notAllowedKey: 1 } }, token0);
    if (r.status === 400) pass(t);
    else fail(t, `Expected 400, got ${r.status} data=${JSON.stringify(r.data)}`);
  }

  // ──────────────────────────────────────────────
  // 2) Vote before discussion ends rejected
  // ──────────────────────────────────────────────
  let proposalIdL3 = '';
  {
    const token0 = tokens[0];
    const t = '2.1 Vote before discuss ends rejected';
    const r = await api(
      'POST',
      '/governance/proposals',
      {
        scope: 'parameter',
        changes: { moderatorInviteMultiplier: 3 },
      },
      token0,
    );
    if (r.status !== 201) throw new Error(`proposal create failed: ${JSON.stringify(r.data)}`);
    proposalIdL3 = r.data.proposal._id;

    const v = await api('POST', `/governance/proposals/${proposalIdL3}/vote`, { approve: true }, token0);
    if (v.status === 400) pass(t);
    else fail(t, `Expected 400, got ${v.status} data=${JSON.stringify(v.data)}`);
  }

  // ──────────────────────────────────────────────
  // 3) First vote after discuss ends transitions to voting + records vote
  // ──────────────────────────────────────────────
  {
    const t = '3.1 First vote after discuss ends transitions discussion->voting';
    await fastForwardDiscussion(proposalIdL3);
    const token0 = tokens[0];
    const v = await api(
      'POST',
      `/governance/proposals/${proposalIdL3}/vote`,
      { approve: true },
      token0,
    );
    if (v.status !== 200) {
      fail(t, `Expected 200, got ${v.status} data=${JSON.stringify(v.data)}`);
      return;
    }
    const status = v.data.proposal.status;
    const votesLen = v.data.proposal.votes?.length ?? 0;
    if (status === 'voting' && votesLen === 1) pass(t);
    else fail(t, `Expected status=voting and votes=1; got status=${status} votes=${votesLen}`);
  }

  // ──────────────────────────────────────────────
  // 4) L3 close yields passed when yesVotes>=51% and quorum met
  // ──────────────────────────────────────────────
  {
    const t = '4.1 L3 proposal passes with simple majority + quorum';
    const yesThreshold = computeYesThreshold(eligibleActiveNodes, 3);
    // We already have 1 YES vote from proposalIdL3.
    const alreadyVotes = 1;
    const remainingYes = Math.max(0, yesThreshold - alreadyVotes);

    // Vote remaining yes from tokens[1..]
    const voterTokens: string[] = tokens.slice(1, 1 + remainingYes);
    for (const token of voterTokens) {
      const v = await api(
        'POST',
        `/governance/proposals/${proposalIdL3}/vote`,
        { approve: true },
        token,
      );
      if (v.status >= 400) throw new Error(`vote failed: ${v.status} ${JSON.stringify(v.data)}`);
    }

    await fastForwardVoting(proposalIdL3);
    const close = await api(
      'POST',
      `/governance/proposals/${proposalIdL3}/close`,
      undefined,
      tokens[2],
    );
    if (close.status !== 200) {
      fail(t, `Expected 200 close; got ${close.status} ${JSON.stringify(close.data)}`);
      return;
    }

    if (close.data.result?.decision === 'passed' && close.data.proposal.status === 'passed') {
      pass(t);
    } else {
      fail(t, `Expected passed; got proposal.status=${close.data.proposal.status} decision=${close.data.result?.decision}`);
    }
  }

  // ──────────────────────────────────────────────
  // 5) L3 failed_quorum when quorum not met
  // ──────────────────────────────────────────────
  let proposalIdFailQuorum = '';
  {
    const t = '5.1 L3 failed_quorum when votesCast < 10% quorum';
    const token0 = tokens[0];
    const r = await api(
      'POST',
      '/governance/proposals',
      {
        scope: 'parameter',
        changes: { moderatorInviteMultiplier: 4 },
      },
      token0,
    );
    proposalIdFailQuorum = r.data.proposal._id;

    await fastForwardDiscussion(proposalIdFailQuorum);

    const quorumVotes = computeQuorumVotes(eligibleActiveNodes);
    const votesToCast = Math.max(0, quorumVotes - 1);
    for (let i = 0; i < votesToCast; i++) {
      const v = await api(
        'POST',
        `/governance/proposals/${proposalIdFailQuorum}/vote`,
        { approve: true },
        tokens[i],
      );
      if (v.status >= 400) throw new Error(`vote failed (${i}): ${v.status} ${JSON.stringify(v.data)}`);
    }

    await fastForwardVoting(proposalIdFailQuorum);
    const close = await api(
      'POST',
      `/governance/proposals/${proposalIdFailQuorum}/close`,
      undefined,
      tokens[0],
    );
    if (close.status !== 200) {
      fail(t, `Expected 200 close; got ${close.status} ${JSON.stringify(close.data)}`);
      return;
    }
    if (close.data.result?.decision === 'failed_quorum') pass(t);
    else fail(t, `Expected failed_quorum; got ${close.data.result?.decision}`);
  }

  // ──────────────────────────────────────────────
  // 6) L4 passes with supermajority (70%+)
  // ──────────────────────────────────────────────
  {
    const t = '6.1 L4 passed with supermajority';
    const token0 = tokens[0];
    const r = await api(
      'POST',
      '/governance/proposals',
      {
        scope: 'base_contract',
        changes: { maxAppeals: 2 },
      },
      token0,
    );
    const proposalId = r.data.proposal._id;

    await fastForwardDiscussion(proposalId);

    const yesThreshold = computeYesThreshold(eligibleActiveNodes, 4);
    for (let i = 0; i < yesThreshold; i++) {
      const v = await api(
        'POST',
        `/governance/proposals/${proposalId}/vote`,
        { approve: true },
        tokens[i],
      );
      if (v.status >= 400) throw new Error(`vote failed (${i}): ${v.status} ${JSON.stringify(v.data)}`);
    }

    await fastForwardVoting(proposalId);
    const close = await api(
      'POST',
      `/governance/proposals/${proposalId}/close`,
      undefined,
      tokens[1],
    );

    if (close.status === 200 && close.data.result?.decision === 'passed') {
      pass(t);
    } else {
      fail(t, `Expected passed; got ${close.status} ${JSON.stringify(close.data.result)}`);
    }
  }

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  const total = results.length;

  console.log('\n' + '='.repeat(70));
  console.log(' RESULTS');
  console.log('=' .repeat(70));
  for (const r of results) {
    console.log(`  ${r.passed ? '[PASS]' : '[FAIL]'} ${r.name}${r.passed ? '' : ` — ${r.detail}`}`);
  }
  console.log('='.repeat(70));

  // Restore snapshot: set all pre-existing nodes back to active.
  // (This test assumes pre-existing active nodes were active.)
  await restoreSnapshotStatus(toRemove, activeBefore.length ? 'active' : 'active');

  try {
    await mongoose.disconnect();
  } catch {
    // ignore
  }

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Unhandled:', err);
  process.exit(1);
});

