import { Router, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { Notification } from '../models/Notification';
import { AuthRequest } from '../types';
import { NotFoundError } from '../utils/errors';

const router = Router();

router.get('/', requireAuth, async (req: AuthRequest, res: Response) => {
  const alias = req.node!.alias;
  const notifications = await Notification.find({
    recipientAlias: alias,
  }).sort({ createdAt: -1 });
  res.json(notifications);
});

router.patch('/read-all', requireAuth, async (req: AuthRequest, res: Response) => {
  const alias = req.node!.alias;
  await Notification.updateMany(
    { recipientAlias: alias, read: false },
    { $set: { read: true } },
  );
  res.json({ message: 'All notifications marked as read' });
});

router.patch('/:id/read', requireAuth, async (req: AuthRequest, res: Response) => {
  const alias = req.node!.alias;
  const notification = await Notification.findById(req.params.id);
  if (!notification) throw new NotFoundError('Notification');
  if (notification.recipientAlias !== alias) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  notification.read = true;
  await notification.save();
  res.json(notification);
});

export default router;