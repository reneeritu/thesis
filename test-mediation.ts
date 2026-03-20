/**
 * Integration tests — Mediate Flow (Phase 3A).
 *
 * Run:  npx ts-node test-mediation.ts
 *       (server must be running on BASE_URL)
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

// ── Shared state ──
let tokenA = '', tokenB = '', tokenC = '';
let aliasA = '', aliasB = '', aliasC = '';
let spaceId = '';
let projectId1 = ''; // for credit dispute tests
let projectId2 = ''; // for veto dispute tests
let nftId1 = '';
let vetoId = '';
let mediationId1 = ''; // credit dispute mediation
let mediationId2 = ''; // veto dispute mediation
let mediationId3 = ''; // manual trigger mediation

const pw = 'Testpass1!';

// ──────────────────────────────────────────────
// SETUP: Register users, create space, create projects
// ──────────────────────────────────────────────
async function setup() {
  aliasA = `meda_${uid()}`;
  aliasB = `medb_${uid()}`;
  aliasC = `medc_${uid()}`;

  {
    const r = await api('POST', '/auth/register', { alias: aliasA, password: pw });
    if (r.status !== 201) throw new Error(`Setup failed: register A: ${JSON.stringify(r.data)}`);
    tokenA = r.data.token;
  }
  {
    const r = await api('POST', '/auth/register', { alias: aliasB, password: pw });
    if (r.status !== 201) throw new Error(`Setup failed: register B: ${JSON.stringify(r.data)}`);
    tokenB = r.data.token;
  }
  {
    const r = await api('POST', '/auth/register', { alias: aliasC, password: pw });
    if (r.status !== 201) throw new Error(`Setup failed: register C: ${JSON.stringify(r.data)}`);
    tokenC = r.data.token;
  }

  {
    const r = await api('POST', '/spaces', {
      name: `medspace_${uid()}`,
      projectAccess: 'open',
      vetoAuthority: [aliasA],
      votingThreshold: 0.5,
      privacyDefault: 'space_only',
      allowCustomContracts: true,
    }, tokenA);
    if (r.status !== 201) throw new Error(`Setup failed: create space: ${JSON.stringify(r.data)}`);
    spaceId = r.data._id;
  }

  await api('POST', `/spaces/${spaceId}/join`, {}, tokenB);
  await api('POST', `/spaces/${spaceId}/join`, {}, tokenC);

  // Project 1: for credit dispute flow
  {
    const r = await api('POST', '/projects', {
      title: `CreditDispute_${uid()}`,
      spaceId,
      contributors: [
        { alias: aliasA, role: 'lead', isPrimary: true },
        { alias: aliasB, role: 'contributor', isPrimary: false },
        { alias: aliasC, role: 'contributor', isPrimary: false },
      ],
    }, tokenA);
    if (r.status !== 201) throw new Error(`Setup failed: create project 1: ${JSON.stringify(r.data)}`);
    projectId1 = r.data._id;
  }

  // Add a trace so the project has activity
  await api('POST', '/traces', {
    projectId: projectId1,
    activityType: 'brainstorm',
    duration: 60,
  }, tokenA);

  // Project 2: for veto dispute flow
  {
    const r = await api('POST', '/projects', {
      title: `VetoDispute_${uid()}`,
      spaceId,
      contributors: [
        { alias: aliasA, role: 'lead', isPrimary: true },
        { alias: aliasB, role: 'contributor', isPrimary: true },
      ],
    }, tokenA);
    if (r.status !== 201) throw new Error(`Setup failed: create project 2: ${JSON.stringify(r.data)}`);
    projectId2 = r.data._id;
  }

  console.log('Setup complete\n');
}

// ──────────────────────────────────────────────
// 1. CREDIT DISPUTE — auto-created mediation via disputeFlag
// ──────────────────────────────────────────────
async function testCreditDisputeAutoMediation() {
  const t = '1.1 Credit with disputeFlag auto-creates mediation';
  const r = await api('POST', '/credits', {
    projectId: projectId1,
    medium: 'digital',
    disputeFlag: true,
  }, tokenA);

  if (r.status === 201 && r.data.mediation && r.data.mediation.triggerType === 'credit_dispute') {
    nftId1 = r.data.nft._id;
    mediationId1 = r.data.mediation._id;
    pass(t, `mediationId=${mediationId1}`);
  } else {
    fail(t, `status=${r.status} mediation=${JSON.stringify(r.data.mediation)}`);
  }
}

async function testAutoMediationStatus() {
  const t = '1.2 Auto-created mediation has correct status and parties';
  const r = await api('GET', `/mediations/${mediationId1}`, undefined, tokenA);
  if (
    r.status === 200 &&
    r.data.status === 'peer_to_peer' &&
    r.data.parties.length === 3 &&
    r.data.relatedEntityType === 'nft'
  ) {
    pass(t);
  } else {
    fail(t, `status=${r.status} data=${JSON.stringify(r.data)}`);
  }
}

async function testComplexityLevelCredit3Contributors() {
  const t = '1.3 Credit dispute with 3 contributors → complexity level 3 (14-day time lock)';
  const r = await api('GET', `/mediations/${mediationId1}`, undefined, tokenA);
  if (r.status === 200 && r.data.complexityLevel === 3) {
    const deadline = new Date(r.data.peerDeadline);
    const created = new Date(r.data.createdAt);
    const diffHours = (deadline.getTime() - created.getTime()) / (1000 * 60 * 60);
    if (Math.abs(diffHours - 336) < 1) {
      pass(t, `level=3, deadline ~336h (${Math.round(diffHours)}h)`);
    } else {
      fail(t, `level=3 but deadline diff=${Math.round(diffHours)}h, expected ~336h`);
    }
  } else {
    fail(t, `complexityLevel=${r.data.complexityLevel}, expected 3`);
  }
}

// ──────────────────────────────────────────────
// 2. CREDIT SIGN REJECTION — auto-created mediation
// ──────────────────────────────────────────────
async function testSignRejectionAutoMediation() {
  // Project1 already has a mediation from disputeFlag, so rejection should reuse it
  const t = '2.1 Credit sign rejection reuses existing mediation';
  const r = await api('POST', `/credits/${nftId1}/sign`, { accepted: false }, tokenB);
  if (r.status === 200 && r.data.mediation && r.data.mediation._id === mediationId1) {
    pass(t, 'Reused existing mediation');
  } else {
    fail(t, `status=${r.status} data=${JSON.stringify(r.data)}`);
  }
}

// ──────────────────────────────────────────────
// 3. MANUAL MEDIATION TRIGGER
// ──────────────────────────────────────────────
async function testManualTriggerVetoDispute() {
  // First create a veto on project2
  const vr = await api('POST', '/vetos', {
    projectId: projectId2,
    vetoType: 'hard_stop',
    reason: 'Need to stop this',
  }, tokenA);
  // A has veto authority, so this activates immediately
  if (vr.status !== 201) {
    fail('3.0 Setup: create veto', `status=${vr.status}`);
    return;
  }
  vetoId = vr.data._id;

  const t = '3.1 Manual trigger mediation for veto dispute';
  const r = await api('POST', '/mediations', {
    triggerType: 'veto_dispute',
    projectId: projectId2,
    relatedEntityId: vetoId,
    relatedEntityType: 'veto',
    reason: 'I disagree with the hard stop',
  }, tokenB);

  if (r.status === 201 && r.data.status === 'peer_to_peer' && r.data.triggerType === 'veto_dispute') {
    mediationId2 = r.data._id;
    pass(t, `mediationId=${mediationId2}`);
  } else {
    fail(t, `status=${r.status} data=${JSON.stringify(r.data)}`);
  }
}

async function testComplexityLevelVetoDispute() {
  const t = '3.1b Veto dispute with 2 contributors → complexity level 2 (7-day time lock)';
  const r = await api('GET', `/mediations/${mediationId2}`, undefined, tokenA);
  if (r.status === 200 && r.data.complexityLevel === 2) {
    const deadline = new Date(r.data.peerDeadline);
    const created = new Date(r.data.createdAt);
    const diffHours = (deadline.getTime() - created.getTime()) / (1000 * 60 * 60);
    if (Math.abs(diffHours - 168) < 1) {
      pass(t, `level=2, deadline ~168h (${Math.round(diffHours)}h)`);
    } else {
      fail(t, `level=2 but deadline diff=${Math.round(diffHours)}h, expected ~168h`);
    }
  } else {
    fail(t, `complexityLevel=${r.data?.complexityLevel}, expected 2`);
  }
}

async function testDuplicateMediationBlocked() {
  const t = '3.2 Duplicate mediation for same entity blocked';
  const r = await api('POST', '/mediations', {
    triggerType: 'veto_dispute',
    projectId: projectId2,
    relatedEntityId: vetoId,
    relatedEntityType: 'veto',
    reason: 'Another attempt',
  }, tokenB);

  if (r.status === 400) {
    pass(t);
  } else {
    fail(t, `Expected 400, got ${r.status}`);
  }
}

async function testNonContributorCannotTrigger() {
  const t = '3.3 Non-contributor cannot trigger mediation';
  const r = await api('POST', '/mediations', {
    triggerType: 'veto_dispute',
    projectId: projectId2,
    relatedEntityId: vetoId,
    relatedEntityType: 'veto',
    reason: 'I am not part of this',
  }, tokenC);

  if (r.status === 403) {
    pass(t);
  } else {
    fail(t, `Expected 403, got ${r.status}`);
  }
}

// ──────────────────────────────────────────────
// 4. PROPOSALS
// ──────────────────────────────────────────────
async function testSubmitProposal() {
  const t = '4.1 Submit proposal on credit dispute';
  const r = await api('POST', `/mediations/${mediationId1}/propose`, {
    description: 'Revised: A gets 50%, B gets 30%, C gets 20%',
    weightMap: [
      { alias: aliasA, weight: 0.5 },
      { alias: aliasB, weight: 0.3 },
      { alias: aliasC, weight: 0.2 },
    ],
  }, tokenA);

  if (r.status === 201 && r.data.proposals.length === 1) {
    pass(t);
  } else {
    fail(t, `status=${r.status} proposals=${r.data.proposals?.length}`);
  }
}

async function testProposalWeightValidation() {
  const t = '4.2 Proposal with invalid weights rejected';
  const r = await api('POST', `/mediations/${mediationId1}/propose`, {
    description: 'Bad weights',
    weightMap: [
      { alias: aliasA, weight: 0.5 },
      { alias: aliasB, weight: 0.3 },
      // missing aliasC
    ],
  }, tokenA);

  if (r.status === 400) {
    pass(t);
  } else {
    fail(t, `Expected 400, got ${r.status}`);
  }
}

async function testProposalWeightSum() {
  const t = '4.3 Proposal weights must sum to 1';
  const r = await api('POST', `/mediations/${mediationId1}/propose`, {
    description: 'Weights too high',
    weightMap: [
      { alias: aliasA, weight: 0.5 },
      { alias: aliasB, weight: 0.5 },
      { alias: aliasC, weight: 0.5 },
    ],
  }, tokenA);

  if (r.status === 400) {
    pass(t);
  } else {
    fail(t, `Expected 400, got ${r.status}`);
  }
}

async function testVetoProposalNoWeights() {
  const t = '4.4 Veto dispute proposal (no weightMap needed)';
  const r = await api('POST', `/mediations/${mediationId2}/propose`, {
    description: 'Reverse the veto — the project should continue',
  }, tokenB);

  if (r.status === 201 && r.data.proposals.length === 1) {
    pass(t);
  } else {
    fail(t, `status=${r.status}`);
  }
}

async function testNonPartyCannotPropose() {
  const t = '4.5 Non-party cannot propose';
  const r = await api('POST', `/mediations/${mediationId2}/propose`, {
    description: 'I have an opinion',
  }, tokenC);

  if (r.status === 403) {
    pass(t);
  } else {
    fail(t, `Expected 403, got ${r.status}`);
  }
}

// ──────────────────────────────────────────────
// 5. RESPONSES
// ──────────────────────────────────────────────
async function testRespondToProposal() {
  const t = '5.1 Party responds to credit proposal (accept)';
  const r = await api('POST', `/mediations/${mediationId1}/respond`, {
    proposalIndex: 0,
    accepted: true,
  }, tokenA);

  if (r.status === 200 && !r.data.allAccepted) {
    pass(t, 'Partial acceptance');
  } else {
    fail(t, `status=${r.status} allAccepted=${r.data.allAccepted}`);
  }
}

async function testDoubleResponse() {
  const t = '5.2 Double response blocked';
  const r = await api('POST', `/mediations/${mediationId1}/respond`, {
    proposalIndex: 0,
    accepted: true,
  }, tokenA);

  if (r.status === 400) {
    pass(t);
  } else {
    fail(t, `Expected 400, got ${r.status}`);
  }
}

async function testSecondPartyAccepts() {
  const t = '5.3 Second party accepts credit proposal';
  const r = await api('POST', `/mediations/${mediationId1}/respond`, {
    proposalIndex: 0,
    accepted: true,
  }, tokenB);

  if (r.status === 200 && !r.data.allAccepted) {
    pass(t, 'Still waiting for third');
  } else {
    fail(t, `status=${r.status} allAccepted=${r.data.allAccepted}`);
  }
}

async function testAllPartiesAccept() {
  const t = '5.4 Third party accepts — allAccepted=true';
  const r = await api('POST', `/mediations/${mediationId1}/respond`, {
    proposalIndex: 0,
    accepted: true,
  }, tokenC);

  if (r.status === 200 && r.data.allAccepted === true) {
    pass(t);
  } else {
    fail(t, `status=${r.status} allAccepted=${r.data.allAccepted}`);
  }
}

// ──────────────────────────────────────────────
// 6. RESOLVE — credit dispute
// ──────────────────────────────────────────────
async function testResolveCredit() {
  const t = '6.1 Resolve credit dispute with accepted proposal';
  const r = await api('POST', `/mediations/${mediationId1}/resolve`, {
    proposalIndex: 0,
  }, tokenA);

  if (r.status === 200 && r.data.mediation.status === 'resolved') {
    pass(t);
  } else {
    fail(t, `status=${r.status} mediationStatus=${r.data.mediation?.status}`);
  }
}

async function testNFTWeightsUpdated() {
  const t = '6.2 NFT weights updated after resolution';
  const r = await api('GET', `/credits/project/${projectId1}`, undefined, tokenA);

  if (r.status === 200) {
    const nft = r.data.nft;
    const wA = nft.contributors.find((c: any) => c.alias === aliasA)?.weight;
    const wB = nft.contributors.find((c: any) => c.alias === aliasB)?.weight;
    const wC = nft.contributors.find((c: any) => c.alias === aliasC)?.weight;

    if (
      Math.abs(wA - 0.5) < 0.001 &&
      Math.abs(wB - 0.3) < 0.001 &&
      Math.abs(wC - 0.2) < 0.001 &&
      nft.disputed === false
    ) {
      pass(t, `A=${wA} B=${wB} C=${wC}`);
    } else {
      fail(t, `weights: A=${wA} B=${wB} C=${wC} disputed=${nft.disputed}`);
    }
  } else {
    fail(t, `status=${r.status}`);
  }
}

async function testProjectCompletedAfterResolve() {
  const t = '6.3 Project status is completed after resolution';
  const r = await api('GET', `/projects/${projectId1}`, undefined, tokenA);

  if (r.status === 200 && r.data.status === 'completed') {
    pass(t);
  } else {
    fail(t, `status=${r.status} projectStatus=${r.data.status}`);
  }
}

async function testResolveAlreadyClosed() {
  const t = '6.4 Cannot resolve already-closed mediation';
  const r = await api('POST', `/mediations/${mediationId1}/resolve`, {
    proposalIndex: 0,
  }, tokenA);

  if (r.status === 400) {
    pass(t);
  } else {
    fail(t, `Expected 400, got ${r.status}`);
  }
}

// ──────────────────────────────────────────────
// 7. RESOLVE — veto dispute (reverse veto)
// ──────────────────────────────────────────────
async function testVetoDisputeResponses() {
  // Both parties accept proposal 0 (which says "reverse the veto")
  {
    const r = await api('POST', `/mediations/${mediationId2}/respond`, {
      proposalIndex: 0,
      accepted: true,
    }, tokenB);
    if (r.status !== 200) {
      fail('7.0a Setup: B responds', `status=${r.status}`);
      return;
    }
  }
  {
    const r = await api('POST', `/mediations/${mediationId2}/respond`, {
      proposalIndex: 0,
      accepted: true,
    }, tokenA);
    if (r.status !== 200) {
      fail('7.0b Setup: A responds', `status=${r.status}`);
      return;
    }
  }

  const t = '7.1 Resolve veto dispute (reverse)';
  const r = await api('POST', `/mediations/${mediationId2}/resolve`, {
    proposalIndex: 0,
  }, tokenB);

  if (r.status === 200 && r.data.mediation.status === 'resolved') {
    pass(t);
  } else {
    fail(t, `status=${r.status} data=${JSON.stringify(r.data)}`);
  }
}

async function testVetoReversed() {
  const t = '7.2 Veto status set to rejected after reverse';
  const r = await api('GET', `/vetos/project/${projectId2}`, undefined, tokenA);

  if (r.status === 200) {
    const veto = r.data.find((v: any) => v._id === vetoId);
    if (veto && veto.status === 'rejected') {
      pass(t);
    } else {
      fail(t, `vetoStatus=${veto?.status}`);
    }
  } else {
    fail(t, `status=${r.status}`);
  }
}

async function testProjectReactivated() {
  const t = '7.3 Project reactivated after veto reversal';
  const r = await api('GET', `/projects/${projectId2}`, undefined, tokenA);

  if (r.status === 200 && r.data.status === 'active') {
    pass(t);
  } else {
    fail(t, `status=${r.status} projectStatus=${r.data.status}`);
  }
}

// ──────────────────────────────────────────────
// 8. ESCALATION
// ──────────────────────────────────────────────
let projectId3 = '';
let nftId3 = '';

async function testEscalationSetup() {
  // Create a fresh project for escalation testing
  const pr = await api('POST', '/projects', {
    title: `EscTest_${uid()}`,
    spaceId,
    contributors: [
      { alias: aliasA, role: 'lead', isPrimary: true },
      { alias: aliasB, role: 'contributor', isPrimary: true },
    ],
  }, tokenA);
  if (pr.status !== 201) {
    fail('8.0 Setup: create project', `status=${pr.status}`);
    return;
  }
  projectId3 = pr.data._id;

  await api('POST', '/traces', {
    projectId: projectId3,
    activityType: 'iterate',
    duration: 30,
  }, tokenA);

  // Credit with dispute
  const cr = await api('POST', '/credits', {
    projectId: projectId3,
    disputeFlag: true,
  }, tokenA);
  if (cr.status !== 201) {
    fail('8.0 Setup: credit', `status=${cr.status}`);
    return;
  }
  nftId3 = cr.data.nft._id;
  mediationId3 = cr.data.mediation._id;
}

async function testEscalateBeforeDeadline() {
  const t = '8.1 Cannot escalate before deadline (no rejected proposal)';
  const r = await api('POST', `/mediations/${mediationId3}/escalate`, undefined, tokenA);

  if (r.status === 400) {
    pass(t);
  } else {
    fail(t, `Expected 400, got ${r.status}`);
  }
}

async function testEscalateAfterRejection() {
  // Submit a proposal, then reject it
  await api('POST', `/mediations/${mediationId3}/propose`, {
    description: 'Give me 70%',
    weightMap: [
      { alias: aliasA, weight: 0.7 },
      { alias: aliasB, weight: 0.3 },
    ],
  }, tokenA);

  await api('POST', `/mediations/${mediationId3}/respond`, {
    proposalIndex: 0,
    accepted: false,
  }, tokenB);

  const t = '8.2 Escalate to space level after proposal rejection';
  const r = await api('POST', `/mediations/${mediationId3}/escalate`, undefined, tokenA);

  if (r.status === 200 && r.data.mediation.status === 'space_escalated') {
    pass(t);
  } else {
    fail(t, `status=${r.status} mediationStatus=${r.data.mediation?.status}`);
  }
}

async function testEscalateToChainBeforeDeadline() {
  const t = '8.3 Cannot escalate to chain level before space deadline';
  const r = await api('POST', `/mediations/${mediationId3}/escalate`, undefined, tokenA);

  if (r.status === 400) {
    pass(t);
  } else {
    fail(t, `Expected 400, got ${r.status}`);
  }
}

async function testProposeDuringSpaceEscalation() {
  const t = '8.4 Can still propose during space_escalated phase';
  const r = await api('POST', `/mediations/${mediationId3}/propose`, {
    description: 'Equal split: 50/50',
    weightMap: [
      { alias: aliasA, weight: 0.5 },
      { alias: aliasB, weight: 0.5 },
    ],
  }, tokenA);

  if (r.status === 201) {
    pass(t);
  } else {
    fail(t, `status=${r.status}`);
  }
}

// ──────────────────────────────────────────────
// 9. FAIL — mediation failure (equal split enforced)
// ──────────────────────────────────────────────
let projectId4 = '';
let nftId4 = '';
let mediationId4 = '';

async function testFailSetup() {
  const pr = await api('POST', '/projects', {
    title: `FailTest_${uid()}`,
    spaceId,
    contributors: [
      { alias: aliasA, role: 'lead', isPrimary: true },
      { alias: aliasB, role: 'contributor', isPrimary: true },
      { alias: aliasC, role: 'contributor', isPrimary: false },
    ],
  }, tokenA);
  if (pr.status !== 201) {
    fail('9.0 Setup: create project', `status=${pr.status}`);
    return;
  }
  projectId4 = pr.data._id;

  await api('POST', '/traces', {
    projectId: projectId4,
    activityType: 'skillwork',
    duration: 120,
  }, tokenA);

  const cr = await api('POST', '/credits', {
    projectId: projectId4,
    medium: 'sculpture',
    contributors: [
      { alias: aliasA, role: 'lead', weight: 0.6 },
      { alias: aliasB, role: 'contributor', weight: 0.3 },
      { alias: aliasC, role: 'contributor', weight: 0.1 },
    ],
    disputeFlag: true,
  }, tokenA);
  if (cr.status !== 201) {
    fail('9.0 Setup: credit', `status=${cr.status}`);
    return;
  }
  nftId4 = cr.data.nft._id;
  mediationId4 = cr.data.mediation._id;
}

async function testFailNotFromChainEscalated() {
  const t = '9.1 Cannot fail mediation from peer_to_peer status';
  const r = await api('POST', `/mediations/${mediationId4}/fail`, undefined, tokenA);

  if (r.status === 400) {
    pass(t);
  } else {
    fail(t, `Expected 400, got ${r.status}`);
  }
}

async function testFailEscalateToChain() {
  // First propose and reject to allow escalation
  await api('POST', `/mediations/${mediationId4}/propose`, {
    description: 'My proposal',
  }, tokenA);

  await api('POST', `/mediations/${mediationId4}/respond`, {
    proposalIndex: 0,
    accepted: false,
  }, tokenB);

  // Escalate to space
  const e1 = await api('POST', `/mediations/${mediationId4}/escalate`, undefined, tokenA);
  if (e1.status !== 200) {
    fail('9.2 Setup: escalate to space', `status=${e1.status}`);
    return;
  }

  // Manually set spaceDeadline to past for testing
  // We can't easily do this via API, so we'll use a direct DB update workaround:
  // Instead, let's just check the guard exists and test the chain_escalated fail flow
  // by forcing the state. We'll test what we can through the API.

  // Since we can't bypass the deadline through the API, let's verify the guard works
  const t = '9.2 Space deadline blocks premature chain escalation';
  const e2 = await api('POST', `/mediations/${mediationId4}/escalate`, undefined, tokenA);
  if (e2.status === 400) {
    pass(t);
  } else {
    fail(t, `Expected 400, got ${e2.status}`);
  }
}

// ──────────────────────────────────────────────
// 10. LIST AND GET
// ──────────────────────────────────────────────
async function testListByProject() {
  const t = '10.1 List mediations by projectId';
  const r = await api('GET', `/mediations/project/${projectId1}`, undefined, tokenA);

  if (r.status === 200 && Array.isArray(r.data) && r.data.length >= 1) {
    pass(t, `count=${r.data.length}`);
  } else {
    fail(t, `status=${r.status} count=${r.data?.length}`);
  }
}

async function testGetById() {
  const t = '10.2 Get mediation by id';
  const r = await api('GET', `/mediations/${mediationId1}`, undefined, tokenA);

  if (
    r.status === 200 &&
    r.data._id === mediationId1 &&
    r.data.status === 'resolved'
  ) {
    pass(t);
  } else {
    fail(t, `status=${r.status} id=${r.data?._id}`);
  }
}

async function testGetNotFound() {
  const t = '10.3 Get non-existent mediation returns 404';
  const r = await api('GET', '/mediations/000000000000000000000000', undefined, tokenA);

  if (r.status === 404) {
    pass(t);
  } else {
    fail(t, `Expected 404, got ${r.status}`);
  }
}

// ──────────────────────────────────────────────
// 11. EDGE CASES
// ──────────────────────────────────────────────
async function testRespondInvalidProposalIndex() {
  const t = '11.1 Invalid proposal index rejected';
  const r = await api('POST', `/mediations/${mediationId4}/respond`, {
    proposalIndex: 999,
    accepted: true,
  }, tokenA);

  if (r.status === 400) {
    pass(t);
  } else {
    fail(t, `Expected 400, got ${r.status}`);
  }
}

async function testResolveWithoutAllAccepting() {
  const t = '11.2 Cannot resolve without all parties accepting';
  // mediationId4 has proposal 0 where B rejected
  const r = await api('POST', `/mediations/${mediationId4}/resolve`, {
    proposalIndex: 0,
  }, tokenA);

  if (r.status === 400) {
    pass(t);
  } else {
    fail(t, `Expected 400, got ${r.status}`);
  }
}

async function testCannotEscalateFromResolved() {
  const t = '11.3 Cannot escalate from resolved status';
  const r = await api('POST', `/mediations/${mediationId1}/escalate`, undefined, tokenA);

  if (r.status === 400) {
    pass(t);
  } else {
    fail(t, `Expected 400, got ${r.status}`);
  }
}

async function testCannotProposeOnResolved() {
  const t = '11.4 Cannot propose on resolved mediation';
  const r = await api('POST', `/mediations/${mediationId1}/propose`, {
    description: 'Late proposal',
  }, tokenA);

  if (r.status === 400) {
    pass(t);
  } else {
    fail(t, `Expected 400, got ${r.status}`);
  }
}

async function testCannotRespondOnResolved() {
  const t = '11.5 Cannot respond on resolved mediation';
  const r = await api('POST', `/mediations/${mediationId1}/respond`, {
    proposalIndex: 0,
    accepted: true,
  }, tokenA);

  if (r.status === 400) {
    pass(t);
  } else {
    fail(t, `Expected 400, got ${r.status}`);
  }
}

// ──────────────────────────────────────────────
// MAIN
// ──────────────────────────────────────────────
async function main() {
  console.log('='.repeat(65));
  console.log(' MEDIATION FLOW — INTEGRATION TESTS');
  console.log('='.repeat(65));

  await setup();

  // 1. Credit dispute auto-mediation
  await testCreditDisputeAutoMediation();
  await testAutoMediationStatus();
  await testComplexityLevelCredit3Contributors();

  // 2. Sign rejection auto-mediation
  await testSignRejectionAutoMediation();

  // 3. Manual trigger
  await testManualTriggerVetoDispute();
  await testComplexityLevelVetoDispute();
  await testDuplicateMediationBlocked();
  await testNonContributorCannotTrigger();

  // 4. Proposals
  await testSubmitProposal();
  await testProposalWeightValidation();
  await testProposalWeightSum();
  await testVetoProposalNoWeights();
  await testNonPartyCannotPropose();

  // 5. Responses
  await testRespondToProposal();
  await testDoubleResponse();
  await testSecondPartyAccepts();
  await testAllPartiesAccept();

  // 6. Credit resolve
  await testResolveCredit();
  await testNFTWeightsUpdated();
  await testProjectCompletedAfterResolve();
  await testResolveAlreadyClosed();

  // 7. Veto resolve
  await testVetoDisputeResponses();
  await testVetoReversed();
  await testProjectReactivated();

  // 8. Escalation
  await testEscalationSetup();
  await testEscalateBeforeDeadline();
  await testEscalateAfterRejection();
  await testEscalateToChainBeforeDeadline();
  await testProposeDuringSpaceEscalation();

  // 9. Fail path
  await testFailSetup();
  await testFailNotFromChainEscalated();
  await testFailEscalateToChain();

  // 10. List and get
  await testListByProject();
  await testGetById();
  await testGetNotFound();

  // 11. Edge cases
  await testRespondInvalidProposalIndex();
  await testResolveWithoutAllAccepting();
  await testCannotEscalateFromResolved();
  await testCannotProposeOnResolved();
  await testCannotRespondOnResolved();

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
