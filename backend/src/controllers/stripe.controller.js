const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    price: 99,
    interval: 'month',
    features: ['Up to 5 users', '500 loads/month', 'All core features', 'Email support'],
    maxUsers: 5,
    maxLoads: 500,
    stripePriceId: process.env.STRIPE_PRICE_STARTER,
  },
  {
    id: 'pro',
    name: 'Professional',
    price: 299,
    interval: 'month',
    features: ['Up to 20 users', 'Unlimited loads', 'Load board posting', 'Priority support', 'QuickBooks integration'],
    maxUsers: 20,
    maxLoads: -1,
    stripePriceId: process.env.STRIPE_PRICE_PRO,
    recommended: true,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 799,
    interval: 'month',
    features: ['Unlimited users', 'Unlimited loads', 'EDI integration', 'White-label', 'Dedicated support', 'Custom onboarding'],
    maxUsers: -1,
    maxLoads: -1,
    stripePriceId: process.env.STRIPE_PRICE_ENTERPRISE,
  },
];

function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) return null;
  return require('stripe')(process.env.STRIPE_SECRET_KEY);
}

async function getPlans(_req, res) {
  res.json(PLANS.map(p => ({ ...p, stripePriceId: undefined })));
}

async function createCheckoutSession(req, res) {
  try {
    const stripe = getStripe();
    if (!stripe) return res.status(503).json({ message: 'Stripe not configured. Add STRIPE_SECRET_KEY to your environment.' });

    const { planId } = req.body;
    const plan = PLANS.find(p => p.id === planId);
    if (!plan || !plan.stripePriceId) return res.status(400).json({ message: 'Invalid plan or price not configured' });

    const orgId = req.user.organizationId;
    const org = await prisma.organization.findUnique({ where: { id: orgId } });

    let customerId = org.stripeCustomerId;
    if (!customerId) {
      const user = await prisma.user.findUnique({ where: { id: req.user.id }, select: { email: true, firstName: true, lastName: true } });
      const customer = await stripe.customers.create({
        email: user.email,
        name: `${user.firstName} ${user.lastName}`,
        metadata: { organizationId: orgId, orgName: org.name },
      });
      customerId = customer.id;
      await prisma.organization.update({ where: { id: orgId }, data: { stripeCustomerId: customerId } });
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: plan.stripePriceId, quantity: 1 }],
      success_url: `${process.env.FRONTEND_URL}/settings?billing=success`,
      cancel_url: `${process.env.FRONTEND_URL}/settings?billing=cancelled`,
      metadata: { organizationId: orgId, planId },
      subscription_data: { metadata: { organizationId: orgId, planId } },
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error('createCheckoutSession error:', err);
    res.status(500).json({ message: err.message || 'Internal server error' });
  }
}

async function handleWebhook(req, res) {
  try {
    const stripe = getStripe();
    if (!stripe) return res.status(503).json({ message: 'Stripe not configured' });

    let event;
    try {
      event = stripe.webhooks.constructEvent(req.body, req.headers['stripe-signature'], process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
      return res.status(400).json({ message: `Webhook signature verification failed: ${err.message}` });
    }

    const { type, data } = event;

    if (type === 'checkout.session.completed') {
      const session = data.object;
      const orgId = session.metadata?.organizationId;
      const planId = session.metadata?.planId;
      const plan = PLANS.find(p => p.id === planId);
      if (orgId && plan) {
        await prisma.organization.update({
          where: { id: orgId },
          data: {
            plan: planId,
            subscriptionStatus: 'active',
            stripeSubscriptionId: session.subscription,
            trialEndsAt: null,
            maxUsers: plan.maxUsers === -1 ? 9999 : plan.maxUsers,
            maxLoadsPerMonth: plan.maxLoads === -1 ? 999999 : plan.maxLoads,
          },
        });
      }
    }

    if (type === 'customer.subscription.updated') {
      const sub = data.object;
      const orgId = sub.metadata?.organizationId;
      if (orgId) {
        await prisma.organization.update({
          where: { id: orgId },
          data: { subscriptionStatus: sub.status, stripeSubscriptionId: sub.id },
        });
      }
    }

    if (type === 'customer.subscription.deleted') {
      const sub = data.object;
      const orgId = sub.metadata?.organizationId;
      if (orgId) {
        await prisma.organization.update({
          where: { id: orgId },
          data: { subscriptionStatus: 'canceled', plan: 'trial', maxUsers: 5, maxLoadsPerMonth: 500 },
        });
      }
    }

    res.json({ received: true });
  } catch (err) {
    console.error('handleWebhook error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

async function getPortalSession(req, res) {
  try {
    const stripe = getStripe();
    if (!stripe) return res.status(503).json({ message: 'Stripe not configured' });

    const org = await prisma.organization.findUnique({ where: { id: req.user.organizationId }, select: { stripeCustomerId: true } });
    if (!org?.stripeCustomerId) return res.status(400).json({ message: 'No billing account found. Subscribe first.' });

    const session = await stripe.billingPortal.sessions.create({
      customer: org.stripeCustomerId,
      return_url: `${process.env.FRONTEND_URL}/settings`,
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error('getPortalSession error:', err);
    res.status(500).json({ message: err.message || 'Internal server error' });
  }
}

module.exports = { getPlans, createCheckoutSession, handleWebhook, getPortalSession };
