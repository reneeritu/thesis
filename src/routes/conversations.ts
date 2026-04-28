import { Router, Response } from 'express';
import mongoose from 'mongoose';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
  blockConversationSchema,
  createConversationSchema,
  respondConversationSchema,
  sendMessageSchema,
} from '../schemas/conversation';
import { Conversation } from '../models/Conversation';
import { DmMessage } from '../models/DmMessage';
import { ChainNode } from '../models/Node';
import { Notification } from '../models/Notification';
import { AuthRequest } from '../types';
import { AppError, ForbiddenError, NotFoundError } from '../utils/errors';
import { validateObjectId } from '../utils/validateObjectId';

const router = Router();

function normalizeAlias(a: string): string {
  return a.trim().toLowerCase();
}

function sortedPair(aliasA: string, aliasB: string): [string, string] {
  const a = normalizeAlias(aliasA);
  const b = normalizeAlias(aliasB);
  return a < b ? [a, b] : [b, a];
}

async function notifyDmCollapsed(
  recipientAlias: string,
  conversationId: string,
  senderAlias: string,
  preview: string,
): Promise<void> {
  const recent = await Notification.findOne({
    recipientAlias,
    type: 'dm_message',
    relatedId: conversationId,
    createdAt: { $gte: new Date(Date.now() - 60_000) },
  }).sort({ createdAt: -1 });

  if (recent) {
    await Notification.updateOne(
      { _id: recent._id },
      {
        $set: {
          read: false,
          metadata: {
            ...(typeof recent.metadata === 'object' && recent.metadata != null
              ? (recent.metadata as Record<string, unknown>)
              : {}),
            preview: preview.slice(0, 200),
            senderAlias,
            collapsed: true,
          },
        },
      },
    );
    return;
  }

  await Notification.create({
    recipientAlias,
    type: 'dm_message',
    read: false,
    relatedId: conversationId,
    relatedType: 'conversation',
    metadata: { preview: preview.slice(0, 200), senderAlias },
  });
}

/**
 * POST /conversations
 */
router.post(
  '/',
  requireAuth,
  validate(createConversationSchema),
  async (req: AuthRequest, res: Response) => {
    const initiator = normalizeAlias(req.node!.alias);
    const { recipientAlias, intro } = req.body as { recipientAlias: string; intro: string };
    const recipient = normalizeAlias(recipientAlias);

    if (recipient === initiator) {
      throw new AppError('You cannot message yourself');
    }

    const recipientNode = await ChainNode.findOne({ alias: recipient, status: 'active' });
    if (!recipientNode) {
      throw new NotFoundError('Node');
    }

    const participants = sortedPair(initiator, recipient);

    let conv = await Conversation.findOne({ participants });

    if (conv) {
      if (conv.status === 'blocked') {
        throw new ForbiddenError(
          'This conversation is blocked. Unblock from Messages if you previously blocked it.',
        );
      }
      if (conv.status === 'pending' && conv.initiatorAlias === initiator) {
        conv.introMessage = intro;
        await conv.save();
        res.status(200).json({ conversation: conv, existed: true });
        return;
      }
      if (conv.status === 'pending' && conv.initiatorAlias === recipient) {
        // The other party already invited you — open their request instead
        res.status(200).json({ conversation: conv, existed: true, note: 'They already sent a request' });
        return;
      }
      if (conv.status === 'declined') {
        conv.status = 'pending';
        conv.initiatorAlias = initiator;
        conv.introMessage = intro;
        await conv.save();
        await Notification.create({
          recipientAlias: recipient,
          type: 'dm_request',
          read: false,
          relatedId: String(conv._id),
          relatedType: 'conversation',
          metadata: { initiatorAlias: initiator, introPreview: intro.slice(0, 200) },
        });
        res.status(201).json({ conversation: conv, existed: false });
        return;
      }
      // accepted — return existing thread
      res.status(200).json({ conversation: conv, existed: true });
      return;
    }

    conv = await Conversation.create({
      participants,
      initiatorAlias: initiator,
      status: 'pending',
      introMessage: intro,
      lastMessageAt: null,
    });

    await Notification.create({
      recipientAlias: recipient,
      type: 'dm_request',
      read: false,
      relatedId: String(conv._id),
      relatedType: 'conversation',
      metadata: { initiatorAlias: initiator, introPreview: intro.slice(0, 200) },
    });

    res.status(201).json({ conversation: conv, existed: false });
  },
);

/**
 * GET /conversations
 */
router.get('/', requireAuth, async (req: AuthRequest, res: Response) => {
  const me = normalizeAlias(req.node!.alias);

  const list = await Conversation.find({
    participants: me,
  })
    .sort({ lastMessageAt: -1, updatedAt: -1 })
    .lean();

  const out = await Promise.all(
    list.map(async (c) => {
      const id = String(c._id);
      const other = c.participants[0] === me ? c.participants[1] : c.participants[0];

      const lastMsg = await DmMessage.findOne({ conversationId: c._id })
        .sort({ createdAt: -1 })
        .lean();

      const unread = await DmMessage.countDocuments({
        conversationId: c._id,
        senderAlias: other,
        readByRecipientAt: null,
      });

      let preview = c.introMessage || '';
      if (lastMsg?.body) preview = lastMsg.body;

      return {
        _id: id,
        participants: c.participants,
        otherAlias: other,
        initiatorAlias: c.initiatorAlias,
        status: c.status,
        introMessage: c.introMessage,
        lastMessageAt: c.lastMessageAt,
        preview: preview.slice(0, 220),
        unreadCount: unread,
        updatedAt: c.updatedAt,
      };
    }),
  );

  res.json(out);
});

/**
 * GET /conversations/:id
 */
router.get('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  validateObjectId(req.params.id);
  const me = normalizeAlias(req.node!.alias);

  const conv = await Conversation.findById(req.params.id);
  if (!conv) throw new NotFoundError('Conversation');

  if (!conv.participants.includes(me)) {
    throw new ForbiddenError('Not a participant in this conversation');
  }

  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
  const beforeRaw = req.query.before;
  const before =
    beforeRaw !== undefined && beforeRaw !== null && String(beforeRaw).trim() !== ''
      ? new Date(String(beforeRaw))
      : null;
  if (before && Number.isNaN(before.getTime())) {
    throw new AppError('Invalid before — use an ISO date string');
  }

  const q: {
    conversationId: mongoose.Types.ObjectId;
    createdAt?: { $lt: Date };
  } = { conversationId: conv._id as mongoose.Types.ObjectId };
  if (before) q.createdAt = { $lt: before };

  const msgs = await DmMessage.find(q).sort({ createdAt: -1 }).limit(limit).lean();
  msgs.reverse();

  const nextBefore =
    msgs.length >= limit ? msgs[0]?.createdAt : undefined;

  res.json({
    conversation: conv,
    messages: msgs,
    nextBefore: nextBefore ? nextBefore.toISOString() : null,
  });
});

/**
 * POST /conversations/:id/respond
 */
router.post(
  '/:id/respond',
  requireAuth,
  validate(respondConversationSchema),
  async (req: AuthRequest, res: Response) => {
    validateObjectId(req.params.id);
    const me = normalizeAlias(req.node!.alias);
    const { decision } = req.body as { decision: 'accept' | 'decline' };

    const conv = await Conversation.findById(req.params.id);
    if (!conv) throw new NotFoundError('Conversation');

    if (!conv.participants.includes(me)) {
      throw new ForbiddenError('Not a participant in this conversation');
    }
    if (conv.status !== 'pending') {
      throw new AppError('No pending request to respond to');
    }
    if (conv.initiatorAlias === me) {
      throw new ForbiddenError('Only the recipient can accept or decline');
    }

    conv.status = decision === 'accept' ? 'accepted' : 'declined';
    await conv.save();

    await Notification.create({
      recipientAlias: conv.initiatorAlias,
      type: 'dm_request_response',
      read: false,
      relatedId: String(conv._id),
      relatedType: 'conversation',
      metadata: {
        decision,
        responderAlias: me,
      },
    });

    res.json(conv);
  },
);

/**
 * POST /conversations/:id/messages
 */
router.post(
  '/:id/messages',
  requireAuth,
  validate(sendMessageSchema),
  async (req: AuthRequest, res: Response) => {
    validateObjectId(req.params.id);
    const me = normalizeAlias(req.node!.alias);
    const { body } = req.body as { body: string };

    const conv = await Conversation.findById(req.params.id);
    if (!conv) throw new NotFoundError('Conversation');

    if (!conv.participants.includes(me)) {
      throw new ForbiddenError('Not a participant in this conversation');
    }
    if (conv.status === 'blocked') {
      throw new ForbiddenError('Messaging is paused in this conversation');
    }
    if (conv.status !== 'accepted') {
      throw new ForbiddenError('You can only message after the request is accepted');
    }

    const msg = await DmMessage.create({
      conversationId: conv._id,
      senderAlias: me,
      body,
    });

    conv.lastMessageAt = msg.createdAt;
    await conv.save();

    const other = conv.participants[0] === me ? conv.participants[1] : conv.participants[0];
    await notifyDmCollapsed(other, String(conv._id), me, body);

    res.status(201).json(msg);
  },
);

/**
 * POST /conversations/:id/block
 */
router.post(
  '/:id/block',
  requireAuth,
  validate(blockConversationSchema),
  async (req: AuthRequest, res: Response) => {
    validateObjectId(req.params.id);
    const me = normalizeAlias(req.node!.alias);
    const { block } = req.body as { block: boolean };

    const conv = await Conversation.findById(req.params.id);
    if (!conv) throw new NotFoundError('Conversation');

    if (!conv.participants.includes(me)) {
      throw new ForbiddenError('Not a participant in this conversation');
    }

    if (block) {
      conv.status = 'blocked';
      conv.blockedByAlias = me;
    } else {
      if (conv.status !== 'blocked') {
        throw new AppError('Conversation is not blocked');
      }
      if (conv.blockedByAlias !== me) {
        throw new ForbiddenError('Only the node who blocked can unblock');
      }
      conv.status = 'accepted';
      conv.blockedByAlias = undefined;
    }

    await conv.save();
    res.json(conv);
  },
);

/**
 * POST /conversations/:id/read
 */
router.post('/:id/read', requireAuth, async (req: AuthRequest, res: Response) => {
  validateObjectId(req.params.id);
  const me = normalizeAlias(req.node!.alias);

  const conv = await Conversation.findById(req.params.id);
  if (!conv) throw new NotFoundError('Conversation');

  if (!conv.participants.includes(me)) {
    throw new ForbiddenError('Not a participant in this conversation');
  }

  const other = conv.participants[0] === me ? conv.participants[1] : conv.participants[0];

  const result = await DmMessage.updateMany(
    {
      conversationId: conv._id,
      senderAlias: other,
      readByRecipientAt: null,
    },
    { $set: { readByRecipientAt: new Date() } },
  );

  res.json({ markedRead: result.modifiedCount });
});

export default router;
