import { Request } from 'express';

export interface AuthPayload {
  alias: string;
  nodeId: string;
  tokenVersion: number;
}

export interface AuthRequest extends Request {
  node?: AuthPayload;
}
