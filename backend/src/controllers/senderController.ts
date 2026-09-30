import { Response } from 'express';
import { AuthenticatedRequest } from '../types';
import prisma from '../config/db';

const senderSelect = { id: true, email: true, name: true, avatar: true, isDefault: true } as const;

export const listSenders = async (req: AuthenticatedRequest, res: Response) => {
  const owner = req.sender!;
  const senders = await prisma.sender.findMany({
    where: { OR: [{ id: owner.id }, { ownerId: owner.id }] },
    select: senderSelect,
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
  });
  res.json(senders);
};

export const createSender = async (req: AuthenticatedRequest, res: Response) => {
  const owner = req.sender!;
  const email = String(req.body.email || '').trim().toLowerCase();
  const name = String(req.body.name || '').trim() || null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    res.status(400).json({ error: 'Validation Error', message: 'A valid sender email is required.' });
    return;
  }
  const existing = await prisma.sender.findUnique({ where: { email } });
  if (existing) {
    res.status(409).json({ error: 'Conflict', message: 'That sender email already exists.' });
    return;
  }
  const sender = await prisma.sender.create({
    data: { email, name, ownerId: owner.id, isDefault: false },
    select: senderSelect,
  });
  res.status(201).json(sender);
};

export const deleteSender = async (req: AuthenticatedRequest, res: Response) => {
  const owner = req.sender!;
  const sender = await prisma.sender.findFirst({ where: { id: req.params.id, ownerId: owner.id } });
  if (!sender) {
    res.status(404).json({ error: 'Not Found', message: 'Sender not found.' });
    return;
  }
  await prisma.sender.delete({ where: { id: sender.id } });
  res.status(204).send();
};

export const setDefaultSender = async (req: AuthenticatedRequest, res: Response) => {
  const owner = req.sender!;
  const sender = await prisma.sender.findFirst({ where: { id: req.params.id, OR: [{ id: owner.id }, { ownerId: owner.id }] } });
  if (!sender) {
    res.status(404).json({ error: 'Not Found', message: 'Sender not found.' });
    return;
  }
  await prisma.$transaction([
    prisma.sender.updateMany({ where: { OR: [{ id: owner.id }, { ownerId: owner.id }] }, data: { isDefault: false } }),
    prisma.sender.update({ where: { id: sender.id }, data: { isDefault: true } }),
  ]);
  res.json({ ...sender, isDefault: true });
};