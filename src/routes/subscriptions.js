import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import pool from '../db/connection.js';

const router = express.Router();

// Get user's subscription
router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM subscriptions WHERE user_id = $1`,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      // Return free tier if no subscription found
      return res.json({
        status: 'free',
        plan: 'free',
        current_period_end: null,
        cancel_at_period_end: false,
        trial_end: null
      });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get subscription error:', error);
    res.status(500).json({ error: 'Failed to get subscription' });
  }
});

// Update subscription (admin only, usually via webhook)
router.put('/:userId', authenticateToken, async (req, res) => {
  try {
    // Check if user is admin or updating their own subscription
    const isAdmin = await pool.query(
      'SELECT is_admin FROM profiles WHERE id = $1',
      [req.user.id]
    );

    if (!isAdmin.rows[0]?.is_admin && req.params.userId !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const {
      stripe_customer_id,
      stripe_subscription_id,
      status,
      plan,
      current_period_start,
      current_period_end,
      cancel_at_period_end,
      canceled_at,
      trial_start,
      trial_end,
      expires_at
    } = req.body;

    // Use expires_at if provided, otherwise use current_period_end
    // If expires_at is explicitly null, set current_period_end to null (non-expiring)
    let expirationDate = current_period_end;
    if (expires_at !== undefined) {
      expirationDate = expires_at === null ? null : expires_at;
    }

    // Build the UPDATE clause for current_period_end
    const periodEndUpdate = expires_at !== undefined 
      ? 'current_period_end = EXCLUDED.current_period_end'
      : 'current_period_end = COALESCE(EXCLUDED.current_period_end, subscriptions.current_period_end)';

    const result = await pool.query(
      `INSERT INTO subscriptions (
        user_id, stripe_customer_id, stripe_subscription_id, status, plan,
        current_period_start, current_period_end, cancel_at_period_end,
        canceled_at, trial_start, trial_end
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT (user_id) DO UPDATE SET
        stripe_customer_id = COALESCE(EXCLUDED.stripe_customer_id, subscriptions.stripe_customer_id),
        stripe_subscription_id = COALESCE(EXCLUDED.stripe_subscription_id, subscriptions.stripe_subscription_id),
        status = EXCLUDED.status,
        plan = EXCLUDED.plan,
        current_period_start = COALESCE(EXCLUDED.current_period_start, subscriptions.current_period_start),
        ${periodEndUpdate},
        cancel_at_period_end = COALESCE(EXCLUDED.cancel_at_period_end, subscriptions.cancel_at_period_end),
        canceled_at = COALESCE(EXCLUDED.canceled_at, subscriptions.canceled_at),
        trial_start = COALESCE(EXCLUDED.trial_start, subscriptions.trial_start),
        trial_end = COALESCE(EXCLUDED.trial_end, subscriptions.trial_end),
        updated_at = now()
      RETURNING *`,
      [
        req.params.userId,
        stripe_customer_id,
        stripe_subscription_id,
        status || 'free',
        plan || 'free',
        current_period_start,
        expirationDate,
        cancel_at_period_end !== undefined ? cancel_at_period_end : false,
        canceled_at,
        trial_start,
        trial_end
      ]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update subscription error:', error);
    res.status(500).json({ error: 'Failed to update subscription' });
  }
});

export default router;

