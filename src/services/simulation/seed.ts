import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { entropyToMnemonic } from 'bip39';
import { ChainNode, IReputationCategories } from '../../models/Node';
import { Space } from '../../models/Space';
import { addBlock } from '../chain';
import { encryptSeedPhrase, hashSeed, signToken } from '../auth';
import { simPassword } from './passwords';
import {
  pushEvent,
  recordSpace,
  RunState,
  setHeroAliases,
  setToken,
} from './store';
import { NodeSpec, SimRole, TraitVector } from './types';
import { heroAliasFor } from './world';

/** Valid 12-word mnemonic derived deterministically (BIP39 128-bit entropy). */
function deterministicSeedPhrase(simRunId: string, alias: string): string {
  const buf = crypto.createHash('sha256').update(`${simRunId}\0${alias}`).digest().subarray(0, 16);
  return entropyToMnemonic(buf);
}

function categoriesFromTrait(t: TraitVector, role: SimRole): IReputationCategories {
  const researchBoost = role === 'researcher' ? 0.9 : role === 'pedagogue' ? 0.45 : 0.28;
  return {
    craft: Math.round(t.craftFocus * 200),
    research: Math.round(t.activityLevel * researchBoost * 200),
    collaboration: Math.round(t.endorsementGiveRate * 200),
    pedagogy: Math.round(t.pedagogyFocus * 200),
    consistency: Math.round(t.archiveBias * 200),
    community: Math.round(t.governanceParticipation * 200),
  };
}

function byAlias(nodes: NodeSpec[]): Map<string, NodeSpec> {
  return new Map(nodes.map((n) => [n.alias, n]));
}

async function upsertIdentityNode(params: {
  simRunId: string;
  spec: NodeSpec;
  tokenize: boolean;
  state: RunState;
}): Promise<void> {
  const { simRunId, spec, tokenize, state } = params;
  const { alias, traitVector } = spec;

  const mnemonic = deterministicSeedPhrase(simRunId, alias);
  const seedHash = hashSeed(mnemonic);
  const encryptedSeedPhrase = encryptSeedPhrase(mnemonic);
  const pwd = simPassword(alias, simRunId);
  const hashedPassword = await bcrypt.hash(pwd, 4);

  const block = await addBlock('identity', alias, {
    alias,
    encryptedSeedPhrase: 'sim',
    simRunId,
  });

  const reputationCategories = categoriesFromTrait(traitVector, spec.role);

  const doc = await ChainNode.create({
    alias,
    hashedPassword,
    seedHash,
    encryptedSeedPhrase,
    tokenVersion: 0,
    identityBlockIndex: block.index,
    reputationCategories,
    spaces: [],
  });

  if (tokenize) {
    const token = signToken({
      alias,
      nodeId: String(doc._id),
      tokenVersion: 0,
    });
    setToken(state, alias, token);
  }
}

function memberAliasesForSpace(nodes: NodeSpec[], spaceKey: string): string[] {
  const seen = new Set<string>();
  for (const n of nodes) {
    for (const m of n.spaceMemberships) {
      if (m.spaceKey === spaceKey && !seen.has(n.alias)) {
        seen.add(n.alias);
      }
    }
  }
  return [...seen].sort((a, b) => a.localeCompare(b));
}

function adminAliasesForSpace(nodes: NodeSpec[], spaceKey: string): string[] {
  const out: string[] = [];
  for (const n of nodes) {
    for (const m of n.spaceMemberships) {
      if (m.spaceKey === spaceKey && m.isAdmin) {
        out.push(n.alias);
        break;
      }
    }
  }
  return [...new Set(out)].sort((a, b) => a.localeCompare(b));
}

function resolveCreatorForSpace(
  sortedMembers: string[],
  adminAliases: string[],
  nodeByAlias: Map<string, NodeSpec>,
  simRunId: string,
): string {
  if (adminAliases.length > 0) return adminAliases[0]!;

  for (const a of [...sortedMembers].sort((x, y) => x.localeCompare(y))) {
    const r = nodeByAlias.get(a)?.role;
    if (r === 'pedagogue' || r === 'admin') return a;
  }
  return heroAliasFor(simRunId, 'validator_1');
}

/**
 * Persist scenario nodes (identity blocks + Mongo), then spaces — run once per simulation before arcs.
 */
export async function applyScenario(state: RunState): Promise<void> {
  const scenario = state.scenario;
  if (!scenario) {
    throw new Error('applyScenario: missing scenario on RunState');
  }

  const { simRunId, nodes } = scenario;
  const index = byAlias(nodes);
  const sortedAll = [...nodes].sort((a, b) => a.alias.localeCompare(b.alias));

  const primary = sortedAll.filter((n) => n.tier === 'hero' || n.tier === 'active');

  for (const spec of primary) {
    await upsertIdentityNode({ simRunId, spec, tokenize: true, state });
  }

  const background = sortedAll.filter((n) => n.tier === 'background');
  for (const spec of background) {
    await upsertIdentityNode({ simRunId, spec, tokenize: false, state });
  }

  for (const spec of scenario.spaces) {
    const spaceKey = spec.key;
    const membersSorted = memberAliasesForSpace(nodes, spaceKey);
    const adminAliases = adminAliasesForSpace(nodes, spaceKey);
    const creatorAlias = resolveCreatorForSpace(membersSorted, adminAliases, index, simRunId);

    let parentSpaceId: mongoose.Types.ObjectId | null = null;
    if (spec.parentKey) {
      const pid = state.spaceIdByKey.get(spec.parentKey);
      if (!pid) throw new Error(`applyScenario: parent space not recorded for ${spec.parentKey}`);
      parentSpaceId = new mongoose.Types.ObjectId(pid);
    }

    const settings = spec.settings;

    const space = await Space.create({
      name: spec.title,
      description: '',
      creatorAlias,
      admins: adminAliases.length > 0 ? adminAliases : [creatorAlias],
      members: membersSorted,
      parentSpaceId,
      settings: {
        projectAccess: settings.projectAccess,
        vetoAuthority: settings.vetoAuthority ?? [],
        votingThreshold: 0.5,
        privacyDefault: settings.privacyDefault,
        customContractsAllowed: true,
        contentRestrictions: [],
        minDocRequirements: settings.minDocRequirements ?? [],
        customContracts:
          settings.customContracts?.map((c) => ({
            title: c.title,
            body: c.body,
            authorAlias: c.authorAlias,
            createdAt: new Date(),
          })) ?? [],
        enforceStrictMinDoc: settings.enforceStrictMinDoc ?? false,
      },
      pendingVeto: [],
      inviteCodes: [],
      status: 'active',
    });

    const sid = String(space._id);
    recordSpace(state, spaceKey, sid);

    for (const alias of membersSorted) {
      await ChainNode.updateOne({ alias }, { $addToSet: { spaces: space._id } });
    }
  }

  const heroAliases = nodes.filter((n) => n.tier === 'hero').map((n) => n.alias);
  setHeroAliases(state, [...heroAliases].sort((a, b) => a.localeCompare(b)));

  pushEvent(state, {
    tick: state.currentTick,
    type: 'world:seed_complete',
    human: 'Simulation world seeded.',
  });
}
