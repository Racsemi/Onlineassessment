import { Request, Response } from 'express';
import prisma from '../utils/db';

export const getSettings = async (req: Request, res: Response) => {
  try {
    let settings = await prisma.platformSettings.findUnique({
      where: { id: 'GLOBAL' }
    });

    if (!settings) {
      settings = await prisma.platformSettings.create({
        data: {
          id: 'GLOBAL',
          instructions: 'Welcome to the platform.',
          rules: '1. No cheating.',
          features: {
            calculator: false,
            ide: false,
            copyPaste: false,
            tabTracking: true,
            rightClick: false,
            keyboardShortcuts: false,
            isProctored: true
          },
          registrationForm: [
            { id: '1', name: 'phone', label: 'Phone Number', type: 'text', required: true }
          ]
        }
      });
    }

    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
};

export const updateSettings = async (req: Request, res: Response) => {
  try {
    const { instructions, rules, registrationForm, features } = req.body;

    const settings = await prisma.platformSettings.upsert({
      where: { id: 'GLOBAL' },
      update: { instructions, rules, registrationForm, features },
      create: { id: 'GLOBAL', instructions, rules, registrationForm, features }
    });

    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update settings' });
  }
};
