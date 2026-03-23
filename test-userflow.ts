/**
 * End-to-end user flow test — 4 accounts, all base contracts in order.
 * Run: npx ts-node --transpile-only test-userflow.ts
 * Requires: Node 18+ (fetch), server on http://localhost:3000, MongoDB reachable.
 *
 * Note: Steps 29–30 expect reputation/badge updates from reputationEngine.onTraceCreated
 * (wired in POST /traces). Restart the server after backend changes; `npm start` needs
 * `npm run build` so dist/ matches src/.
 */

import { createHash } from 'node:crypto';

const BASE = process.env.AURA2_BASE ?? 'http://localhost:3000';
const PASSWORD = 'TestUserflow1!'; // 16 chars, satisfies min 8

const REPUTATION_BASE = 100;

type Json = Record<string, unknown>;

interface Account {
  alias: string;
  token: string;
}

const accounts: Record<string, Account> = {};

let spaceId = '';
let projectId = '';
/** Trace from step 13 (primary_research + tool) — targeted by NDA veto */
let traceIdStep13 = '';
let creditNftId = '';
let forkProjectId = '';
let archiveNftId = '';
let archiveProjectId = '';

const results: { step: number; name: string; ok: boolean; error?: string }[] = [];

function errBody(data: unknown, status: number, text: string): string {
  try {
    return `HTTP ${status} ${JSON.stringify(data)}`;
  } catch {
    return `HTTP ${status} ${text}`;
  }
}

/** Load NFT bundle: prefers GET /nfts/:id; falls back to GET /credits/project/:id if route missing (older builds). */
async function fetchNftBundle(
  nftId: string,
  projectIdFallback: string,
  token: string,
): Promise<Json> {
  try {
    return (await api('GET', `/nfts/${nftId}`, { token })) as Json;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '';
    if (msg.includes('404') || msg.includes('Cannot GET /nfts')) {
      return (await api('GET', `/credits/project/${projectIdFallback}`, { token })) as Json;
    }
    throw e;
  }
}

async function api(
  method: string,
  path: string,
  opts?: { token?: string; body?: unknown },
): Promise<unknown> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
  };
  if (opts?.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  if (opts?.token) {
    headers.Authorization = `Bearer ${opts.token}`;
  }
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: opts?.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text) as unknown;
    } catch {
      data = { raw: text };
    }
  }
  if (!res.ok) {
    throw new Error(errBody(data, res.status, text));
  }
  return data;
}

async function runStep(step: number, name: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
    results.push({ step, name, ok: true });
    console.log(`[PASS] Step ${step}: ${name}`);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    results.push({ step, name, ok: false, error: msg });
    console.log(`[FAIL] Step ${step}: ${name}`);
    console.log(`       ${msg}`);
  }
}

function sha256Hex(s: string): string {
  return createHash('sha256').update(s, 'utf8').digest('hex');
}

async function registerOrLogin(alias: string): Promise<string> {
  try {
    const data = (await api('POST', '/auth/register', {
      body: { alias, password: PASSWORD },
    })) as Json;
    const token = data.token as string;
    if (!token) throw new Error('Missing token');
    return token;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '';
    if (msg.includes('409') || msg.includes('Alias already taken')) {
      const data = (await api('POST', '/auth/login', {
        body: { alias, password: PASSWORD },
      })) as Json;
      const token = data.token as string;
      if (!token) throw new Error('Missing token from login');
      return token;
    }
    throw e;
  }
}

async function main(): Promise<void> {
  console.log(`AURA2 userflow test → ${BASE}\n`);

  // --- SETUP ---
  await runStep(1, 'Register maya', async () => {
    accounts.maya = { alias: 'maya', token: await registerOrLogin('maya') };
  });

  await runStep(2, 'Register riku', async () => {
    accounts.riku = { alias: 'riku', token: await registerOrLogin('riku') };
  });

  await runStep(3, 'Register prof', async () => {
    accounts.prof = { alias: 'prof', token: await registerOrLogin('prof') };
  });

  await runStep(4, 'Register collab', async () => {
    accounts.collab = { alias: 'collab', token: await registerOrLogin('collab') };
  });

  // --- SPACES ---
  await runStep(5, 'maya creates space Signal Noise Studio (open, prof veto authority)', async () => {
    const data = (await api('POST', '/spaces', {
      token: accounts.maya.token,
      body: {
        name: 'Signal Noise Studio',
        description: 'Open studio space for userflow test',
        settings: {
          projectAccess: 'open',
          vetoAuthority: ['prof'],
        },
      },
    })) as Json;
    spaceId = String(data._id);
    if (!spaceId) throw new Error('Missing space _id');
  });

  await runStep(6, 'riku joins space', async () => {
    await api('POST', `/spaces/${spaceId}/join`, { token: accounts.riku.token, body: {} });
  });

  await runStep(7, 'prof joins space', async () => {
    await api('POST', `/spaces/${spaceId}/join`, { token: accounts.prof.token, body: {} });
  });

  await runStep(8, 'collab joins space', async () => {
    await api('POST', `/spaces/${spaceId}/join`, { token: accounts.collab.token, body: {} });
  });

  // --- START ---
  await runStep(9, 'maya starts project with riku + prof', async () => {
    const data = (await api('POST', '/projects', {
      token: accounts.maya.token,
      body: {
        title: 'Signal/Noise Installation',
        spaceId,
        mentorAlias: 'prof',
        contributors: [
          { alias: 'riku', role: 'technical' },
          { alias: 'prof', role: 'pedagogical mentor' },
        ],
      },
    })) as Json;
    projectId = String(data._id);
    if (!projectId) throw new Error('Missing project _id');
  });

  // --- TRACES ---
  await runStep(10, 'maya logs brainstorm trace', async () => {
    await api('POST', '/traces', {
      token: accounts.maya.token,
      body: {
        projectId,
        activityType: 'brainstorm',
        mode: 'micro',
        description: 'Initial concept sketch for signal vs noise',
      },
    });
  });

  await runStep(11, 'riku logs fabrication trace', async () => {
    await api('POST', '/traces', {
      token: accounts.riku.token,
      body: {
        projectId,
        activityType: 'fabrication',
        mode: 'micro',
        description: 'Built physical mounting brackets',
      },
    });
  });

  await runStep(12, 'prof logs pedagogy trace', async () => {
    await api('POST', '/traces', {
      token: accounts.prof.token,
      body: {
        projectId,
        activityType: 'pedagogy',
        mode: 'micro',
        description: 'Critique session on material choices',
      },
    });
  });

  await runStep(13, 'maya logs primary_research with tool', async () => {
    const data = (await api('POST', '/traces', {
      token: accounts.maya.token,
      body: {
        projectId,
        activityType: 'primary_research',
        mode: 'micro',
        description: 'Field recordings and spectrum analysis',
        toolSoftware: 'Audacity + custom FFT script',
      },
    })) as Json;
    traceIdStep13 = String(data._id);
    if (!traceIdStep13) throw new Error('Missing trace _id');
  });

  await runStep(14, 'maya logs ai_tool trace', async () => {
    await api('POST', '/traces', {
      token: accounts.maya.token,
      body: {
        projectId,
        activityType: 'ai_tool',
        mode: 'micro',
        description: 'Generated draft layout variants',
        toolSoftware: 'GPT-assisted layout suggestions',
      },
    });
  });

  // --- REFERENCES ---
  await runStep(15, 'maya reference inspired_by URL', async () => {
    await api('POST', '/references', {
      token: accounts.maya.token,
      body: {
        projectId,
        relationshipType: 'inspired_by',
        externalUrl: 'https://example.org/signal-processing-art',
      },
    });
  });

  await runStep(16, 'maya reference ai_generated citation', async () => {
    await api('POST', '/references', {
      token: accounts.maya.token,
      body: {
        projectId,
        relationshipType: 'ai_generated',
        citation: 'Synthetic training notes, internal doc SN-2024-07',
        otherExplanation: 'Disclosure of AI-assisted draft text for wall labels',
      },
    });
  });

  // --- PIVOT ---
  await runStep(17, 'maya records pivot', async () => {
    await api('POST', '/pivots', {
      token: accounts.maya.token,
      body: {
        projectId,
        reason: 'moved from digital projection to physical installation',
      },
    });
  });

  // --- VETOS ---
  await runStep(18, 'prof NDA seal veto on trace step 13', async () => {
    await api('POST', '/vetos', {
      token: accounts.prof.token,
      body: {
        projectId,
        vetoType: 'nda_seal',
        reason: 'Field research audio contains identifiable third-party voices — seal trace pending release',
        targetTraceIds: [traceIdStep13],
      },
    });
  });

  await runStep(19, 'prof scope_limit veto', async () => {
    await api('POST', '/vetos', {
      token: accounts.prof.token,
      body: {
        projectId,
        vetoType: 'scope_limit',
        reason: 'Limit distribution of early brainstorm logs to space members only',
        targetTraceIds: [],
      },
    });
  });

  // --- CREDIT ---
  await runStep(20, 'maya initiates credit with weights + ghost off-chain', async () => {
    const data = (await api('POST', '/credits', {
      token: accounts.maya.token,
      body: {
        projectId,
        medium: 'mixed installation (digital + physical)',
        contributors: [
          { alias: 'maya', role: 'creator', weight: 0.4 },
          { alias: 'riku', role: 'technical', weight: 0.4 },
          { alias: 'prof', role: 'pedagogical mentor', weight: 0.2 },
        ],
        offChainContributors: [{ name: 'ghost', role: 'lighting consultant', portfolio: '' }],
        disputeFlag: false,
      },
    })) as Json;
    const nft = data.nft as Json | undefined;
    creditNftId = nft ? String(nft._id) : '';
    if (!creditNftId) throw new Error('Missing NFT id from credit response');
  });

  await runStep(21, 'riku signs credit', async () => {
    const res = (await api('POST', `/credits/${creditNftId}/sign`, {
      token: accounts.riku.token,
      body: { accepted: true },
    })) as Json;
    if (res.allSigned === true) throw new Error('Expected allSigned false before prof signs');
  });

  await runStep(22, 'prof signs credit', async () => {
    const res = (await api('POST', `/credits/${creditNftId}/sign`, {
      token: accounts.prof.token,
      body: { accepted: true },
    })) as Json;
    if (res.allSigned !== true) throw new Error(`Expected allSigned true, got ${String(res.allSigned)}`);
  });

  await runStep(23, 'Verify NFT minted with correct data', async () => {
    const data = await fetchNftBundle(creditNftId, projectId, accounts.maya.token);
    const nft = data.nft as Json | undefined;
    if (!nft) throw new Error('Missing nft');
    if (String(nft.projectId) !== projectId) throw new Error('NFT projectId mismatch');
    const contribs = nft.contributors as { alias: string; weight: number }[] | undefined;
    if (!contribs || contribs.length !== 3) throw new Error('Expected 3 NFT contributors');
    const byAlias = Object.fromEntries(contribs.map((c) => [c.alias, c.weight]));
    if (Math.abs((byAlias.maya ?? 0) - 0.4) > 0.001) throw new Error('maya weight');
    if (Math.abs((byAlias.riku ?? 0) - 0.4) > 0.001) throw new Error('riku weight');
    if (Math.abs((byAlias.prof ?? 0) - 0.2) > 0.001) throw new Error('prof weight');
  });

  await runStep(24, 'Verify contributor tokens for maya, riku, prof', async () => {
    const data = await fetchNftBundle(creditNftId, projectId, accounts.maya.token);
    const tokens = data.contributorTokens as { alias: string }[] | undefined;
    if (!tokens || tokens.length < 3) throw new Error('Expected at least 3 contributor tokens');
    const aliases = new Set(tokens.map((t) => t.alias));
    for (const a of ['maya', 'riku', 'prof']) {
      if (!aliases.has(a)) throw new Error(`Missing contributor token for ${a}`);
    }
  });

  // --- FORK ---
  await runStep(25, 'riku forks to Signal/Noise — Iteration 2', async () => {
    const data = (await api('POST', '/forks', {
      token: accounts.riku.token,
      body: {
        parentProjectId: projectId,
        title: 'Signal/Noise — Iteration 2',
        forkReason: 'Explore alternate spatial arrangement after first credit',
        inheritedContributors: ['maya', 'prof'],
      },
    })) as Json;
    const forked = data.forkedProject as Json | undefined;
    forkProjectId = forked ? String(forked._id) : '';
    if (!forkProjectId) throw new Error('Missing forked project id');
  });

  await runStep(26, 'Verify fork lineage to parent', async () => {
    const data = (await api('GET', `/forks/parent/${projectId}`, {
      token: accounts.riku.token,
    })) as unknown;
    const list = data as Json[];
    if (!Array.isArray(list) || list.length < 1) throw new Error('Expected fork list');
    const found = list.some((p) => String(p._id) === forkProjectId);
    if (!found) throw new Error('Fork not listed under parent');
  });

  // --- ARCHIVE ---
  await runStep(27, 'maya archives Pre-Chain Work 2022', async () => {
    const evidenceHash = sha256Hex('photos-pre-chain-work-2022-maya');
    const data = (await api('POST', '/archives', {
      token: accounts.maya.token,
      body: {
        title: 'Pre-Chain Work 2022',
        medium: 'mixed media',
        approxDate: '2022',
        spaceId,
        evidence: [
          {
            evidenceType: 'photos_of_work',
            evidenceHash,
          },
        ],
        reconstructionFlag: true,
        originalWorkDeclaration: true,
        contextNote: 'Documented retroactively for provenance',
      },
    })) as Json;
    const nft = data.nft as Json | undefined;
    const project = data.project as Json | undefined;
    archiveNftId = nft ? String(nft._id) : '';
    archiveProjectId = project ? String(project._id) : '';
    if (!archiveNftId) throw new Error('Missing archive NFT id');
  });

  await runStep(28, 'Verify archive NFT minted', async () => {
    let nft: Json | undefined;
    try {
      const data = (await api('GET', `/nfts/${archiveNftId}`, {
        token: accounts.maya.token,
      })) as Json;
      nft = data.nft as Json | undefined;
      if (data.archive == null) {
        throw new Error('Expected archive record on GET /nfts response');
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '';
      if (msg.includes('404') || msg.includes('Cannot GET /nfts')) {
        const data = (await api('GET', `/credits/project/${archiveProjectId}`, {
          token: accounts.maya.token,
        })) as Json;
        nft = data.nft as Json | undefined;
      } else throw e;
    }
    if (!nft) throw new Error('Missing archive NFT');
    const title = String(nft.title ?? '');
    if (!title.includes('ARCHIVE')) throw new Error(`Expected [ARCHIVE] title prefix, got: ${title}`);
  });

  // --- VERIFICATION ---
  await runStep(29, 'maya profile reputation > base (self)', async () => {
    const data = (await api('GET', '/nodes/maya', { token: accounts.maya.token })) as Json;
    const score = data.reputationScore as number | undefined;
    if (score === undefined) throw new Error('reputationScore not returned (need auth as self)');
    if (score <= REPUTATION_BASE) {
      throw new Error(
        `reputationScore ${score} not above base ${REPUTATION_BASE} (is reputationEngine wired to traces?)`,
      );
    }
  });

  await runStep(30, 'riku profile has craft_affirmative badge', async () => {
    const data = (await api('GET', '/nodes/riku', {})) as Json;
    const badges = data.badges as string[] | undefined;
    if (!badges?.includes('craft_affirmative')) {
      throw new Error(
        `badges ${JSON.stringify(badges)} — expected craft_affirmative (fabrication trace hook?)`,
      );
    }
  });

  await runStep(31, 'Final NFT provenance complete', async () => {
    const data = await fetchNftBundle(creditNftId, projectId, accounts.maya.token);
    const nft = data.nft as Json | undefined;
    let project = data.project as Json | undefined;
    if (!nft) throw new Error('Missing nft');
    if (!project) {
      project = (await api('GET', `/projects/${projectId}`, {
        token: accounts.maya.token,
      })) as Json;
    }
    if (!project) throw new Error('Missing project');
    if (!nft.processBlockIndices || (nft.processBlockIndices as unknown[]).length < 1) {
      throw new Error('processBlockIndices empty');
    }
    if (!project.spaceId) throw new Error('project.spaceId missing');
    if (!project.createdAt) throw new Error('project.createdAt missing');
    if (String(project._id) !== projectId) throw new Error('project id mismatch');
  });

  await runStep(32, 'Forked project parentProjectId links to original', async () => {
    const data = (await api('GET', `/projects/${forkProjectId}`, {
      token: accounts.riku.token,
    })) as Json;
    const parent = data.parentProjectId;
    const pid = parent && typeof parent === 'object' && parent !== null && '_id' in parent
      ? String((parent as Json)._id)
      : String(parent ?? '');
    if (pid !== projectId) throw new Error(`parentProjectId ${pid} !== ${projectId}`);
  });

  // --- REPORT ---
  const passed = results.filter((r) => r.ok).length;
  const total = results.length;
  console.log('\n========== SUMMARY ==========');
  for (const r of results) {
    const tag = r.ok ? 'PASS' : 'FAIL';
    console.log(`${tag}  Step ${r.step}: ${r.name}`);
    if (!r.ok && r.error) console.log(`      ${r.error}`);
  }
  console.log(`\nTotal: ${passed} / ${total} passed`);
  if (passed < total) {
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error('Fatal:', e);
  process.exitCode = 1;
});
