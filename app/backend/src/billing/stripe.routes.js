import { Router } from 'express';
import Stripe from 'stripe';
import { requireAuth } from '../middleware/requireAuth.js';
import { prisma } from '../db/prisma.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', { apiVersion: '2024-06-20' });
const router = Router();

router.post('/create-checkout-session', requireAuth, async (req, res, next) => {
  try {
    const { planId } = req.body || {};
    if (!planId) return res.status(400).json({ error: 'planId required' });
    const plan = await prisma.plan.findUnique({ where: { id: planId } });
    if (!plan) return res.status(404).json({ error: 'Plan not found' });

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: process.env.STRIPE_PRICE_BASIC, quantity: 1 }],
      success_url: `${process.env.APP_URL}/dashboard?billing=success`,
      cancel_url: `${process.env.APP_URL}/billing?billing=canceled`,
      customer_email: (req.user?.email) || undefined,
      metadata: { userId: req.user.id, planId }
    });
    res.json({ url: session.url });
  } catch (e) { next(e); }
});

export default router;
