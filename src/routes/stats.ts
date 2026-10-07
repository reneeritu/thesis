import { Router, Request, Response } from 'express';
import { ChainNode } from '../models/Node';
import { Space } from '../models/Space';
import { Project } from '../models/Project';
import { Block } from '../models/Block';

const router = Router();

const CACHE_MS = 60_000;
let cache: { at: number; body: { nodes: number; spaces: number; projects: number; blocks: number } } | null = null;

router.get('/', async (_req: Request, res: Response) => {
  const now = Date.now();
  if (cache && now - cache.at < CACHE_MS) {
    res.json(cache.body);
    return;
  }
  const [nodes, spaces, projects, blocks] = await Promise.all([
    ChainNode.countDocuments(),
    Space.countDocuments(),
    Project.countDocuments(),
    Block.countDocuments(),
  ]);
  const body = { nodes, spaces, projects, blocks };
  cache = { at: now, body };
  res.json(body);
});

export default router;
