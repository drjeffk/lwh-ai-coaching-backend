import express from 'express';
import Stripe from 'stripe';
import pool from '../db/connection.js';

const router = express.Router();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
});

// Create checkout session
router.post('/create-checkout', async (req, res) => {
  try {
    const { priceId, userId, userEmail } = req.body;

    if (!priceId || !userId || !userEmail) {
      return res.status(400).json({ error: 'priceId, userId, and userEmail are required' });
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      customer_email: userEmail,
      success_url: `${process.env.FRONTEND_URL || 'http://localhost:8080'}/pricing?success=true`,
      cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:8080'}/pricing?canceled=true`,
      metadata: {
        userId,
      },
    });

    res.json({ sessionId: session.id, url: session.url });
  } catch (error) {
    console.error('Create checkout error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Customer portal
router.post('/customer-portal', async (req, res) => {
  try {
    const { customerId } = req.body;

    if (!customerId) {
      return res.status(400).json({ error: 'customerId is required' });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${process.env.FRONTEND_URL || 'http://localhost:8080'}/settings`,
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error('Customer portal error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Stripe webhook
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        
        if (session.mode === 'subscription' && session.subscription) {
          const subscription = await stripe.subscriptions.retrieve(session.subscription);
          const customerId = session.customer;
          const userEmail = session.customer_email || session.customer_details?.email;
          const userId = session.metadata?.userId;

          if (!userEmail && !userId) {
            console.error('No email or userId found in checkout session');
            break;
          }

          // Find user by email or userId
          let userResult;
          if (userId) {
            userResult = await pool.query('SELECT id, email FROM users WHERE id = $1', [userId]);
          } else {
            userResult = await pool.query('SELECT id, email FROM users WHERE email = $1', [userEmail]);
          }

          if (userResult.rows.length === 0) {
            console.error('User not found for email:', userEmail);
            break;
          }

          const user = userResult.rows[0];
          const plan = 'pro'; // Default to pro for paid subscriptions

          await pool.query(
            `INSERT INTO subscriptions (
              user_id, stripe_customer_id, stripe_subscription_id, status, plan,
              current_period_start, current_period_end, cancel_at_period_end,
              trial_start, trial_end
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            ON CONFLICT (user_id) DO UPDATE SET
              stripe_customer_id = EXCLUDED.stripe_customer_id,
              stripe_subscription_id = EXCLUDED.stripe_subscription_id,
              status = EXCLUDED.status,
              plan = EXCLUDED.plan,
              current_period_start = EXCLUDED.current_period_start,
              current_period_end = EXCLUDED.current_period_end,
              cancel_at_period_end = EXCLUDED.cancel_at_period_end,
              trial_start = EXCLUDED.trial_start,
              trial_end = EXCLUDED.trial_end,
              updated_at = now()`,
            [
              user.id,
              customerId,
              subscription.id,
              subscription.status,
              plan,
              new Date(subscription.current_period_start * 1000).toISOString(),
              new Date(subscription.current_period_end * 1000).toISOString(),
              subscription.cancel_at_period_end,
              subscription.trial_start ? new Date(subscription.trial_start * 1000).toISOString() : null,
              subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null,
            ]
          );

          console.log(`Subscription created/updated for user ${user.id}`);
        }
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        const customer = await stripe.customers.retrieve(subscription.customer);
        
        if (!customer.email) {
          console.error('No email found for customer');
          break;
        }

        const userResult = await pool.query('SELECT id FROM users WHERE email = $1', [customer.email]);
        
        if (userResult.rows.length === 0) {
          console.error('User not found for email:', customer.email);
          break;
        }

        const user = userResult.rows[0];
        const plan = 'pro';

        await pool.query(
          `INSERT INTO subscriptions (
            user_id, stripe_customer_id, stripe_subscription_id, status, plan,
            current_period_start, current_period_end, cancel_at_period_end,
            canceled_at, trial_start, trial_end
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          ON CONFLICT (user_id) DO UPDATE SET
            stripe_customer_id = EXCLUDED.stripe_customer_id,
            stripe_subscription_id = EXCLUDED.stripe_subscription_id,
            status = EXCLUDED.status,
            plan = EXCLUDED.plan,
            current_period_start = EXCLUDED.current_period_start,
            current_period_end = EXCLUDED.current_period_end,
            cancel_at_period_end = EXCLUDED.cancel_at_period_end,
            canceled_at = EXCLUDED.canceled_at,
            trial_start = EXCLUDED.trial_start,
            trial_end = EXCLUDED.trial_end,
            updated_at = now()`,
          [
            user.id,
            subscription.customer,
            subscription.id,
            subscription.status,
            subscription.status === 'active' || subscription.status === 'trialing' ? plan : 'free',
            new Date(subscription.current_period_start * 1000).toISOString(),
            new Date(subscription.current_period_end * 1000).toISOString(),
            subscription.cancel_at_period_end,
            subscription.canceled_at ? new Date(subscription.canceled_at * 1000).toISOString() : null,
            subscription.trial_start ? new Date(subscription.trial_start * 1000).toISOString() : null,
            subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null,
          ]
        );

        console.log(`Subscription updated for user ${user.id}: ${subscription.status}`);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        const customer = await stripe.customers.retrieve(subscription.customer);
        
        if (!customer.email) {
          console.error('No email found for customer');
          break;
        }

        const userResult = await pool.query('SELECT id FROM users WHERE email = $1', [customer.email]);
        
        if (userResult.rows.length === 0) {
          console.error('User not found for email:', customer.email);
          break;
        }

        const user = userResult.rows[0];

        await pool.query(
          `UPDATE subscriptions SET
            stripe_subscription_id = NULL,
            status = 'free',
            plan = 'free',
            current_period_start = NULL,
            current_period_end = NULL,
            cancel_at_period_end = false,
            canceled_at = now(),
            trial_start = NULL,
            trial_end = NULL,
            updated_at = now()
          WHERE user_id = $1`,
          [user.id]
        );

        console.log(`Subscription canceled for user ${user.id}`);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Webhook processing error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;

