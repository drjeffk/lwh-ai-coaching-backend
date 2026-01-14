import express from 'express';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import pool from '../db/connection.js';

const router = express.Router();

// Get user's usage limits
router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM users_limits WHERE id = $1`,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      // Create default limits if they don't exist
      await pool.query(
        `INSERT INTO users_limits (
          id, email_generations_today, email_generations_last_reset,
          coaching_sessions_today, coaching_sessions_last_reset,
          difficult_conversations_today, difficult_conversations_last_reset
        ) VALUES ($1, 0, now(), 0, now(), 0, now())`,
        [req.user.id]
      );

      const newResult = await pool.query(
        `SELECT * FROM users_limits WHERE id = $1`,
        [req.user.id]
      );

      return res.json(newResult.rows[0]);
    }

    // Check if we need to reset daily limits
    const limits = result.rows[0];
    const now = new Date();
    const lastReset = new Date(limits.email_generations_last_reset);
    
    // Reset if it's a new day
    if (now.toDateString() !== lastReset.toDateString()) {
      await pool.query(
        `UPDATE users_limits SET
          email_generations_today = 0,
          email_generations_last_reset = now(),
          coaching_sessions_today = 0,
          coaching_sessions_last_reset = now(),
          difficult_conversations_today = 0,
          difficult_conversations_last_reset = now()
        WHERE id = $1`,
        [req.user.id]
      );

      const updatedResult = await pool.query(
        `SELECT * FROM users_limits WHERE id = $1`,
        [req.user.id]
      );

      return res.json(updatedResult.rows[0]);
    }

    res.json(limits);
  } catch (error) {
    console.error('Get usage limits error:', error);
    res.status(500).json({ error: 'Failed to get usage limits' });
  }
});

// Increment usage counter
router.post('/increment', authenticateToken, async (req, res) => {
  try {
    const { type } = req.body; // 'email', 'coaching', or 'difficult_conversation'

    if (!type || !['email', 'coaching', 'difficult_conversation'].includes(type)) {
      return res.status(400).json({ error: 'Invalid type. Must be email, coaching, or difficult_conversation' });
    }

    const fieldMap = {
      email: 'email_generations_today',
      coaching: 'coaching_sessions_today',
      difficult_conversation: 'difficult_conversations_today'
    };

    const field = fieldMap[type];

    const result = await pool.query(
      `UPDATE users_limits 
       SET ${field} = ${field} + 1,
           updated_at = now()
       WHERE id = $1
       RETURNING *`,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usage limits not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Increment usage error:', error);
    res.status(500).json({ error: 'Failed to increment usage' });
  }
});

// Admin: Get all users' usage stats
router.get('/all', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT 
        p.id as user_id,
        p.email,
        p.full_name,
        COALESCE(ul.email_generations_today, 0) as email_generations_today,
        COALESCE(ul.coaching_sessions_today, 0) as coaching_sessions_today,
        COALESCE(ul.difficult_conversations_today, 0) as difficult_conversations_today,
        ul.email_generations_last_reset,
        ul.coaching_sessions_last_reset,
        ul.difficult_conversations_last_reset,
        COALESCE(s.status, 'free') as subscription_status,
        COALESCE(s.plan, 'free') as subscription_plan,
        s.current_period_end as subscription_expires_at
      FROM profiles p
      LEFT JOIN users_limits ul ON p.id = ul.id
      LEFT JOIN subscriptions s ON p.id = s.user_id
      ORDER BY p.email ASC`
    );

    const usersStats = result.rows.map((row) => {
      const subscriptionStatus = row.subscription_status || 'free';
      const subscriptionPlan = row.subscription_plan || 'free';
      const expiresAt = row.subscription_expires_at || null;
      
      // First determine if subscription is PRO based on status/plan
      let isPro = subscriptionStatus === 'active' || subscriptionStatus === 'trialing' || subscriptionPlan === 'pro';
      
      // Only check expiration if subscription is PRO and has an expiration date
      // If expiration date is in the past, downgrade to FREE
      if (isPro && expiresAt) {
        try {
          const expirationDate = new Date(expiresAt);
          const now = new Date();
          // Only downgrade if expiration is in the past (with 1 second buffer for timezone issues)
          if (expirationDate.getTime() < (now.getTime() - 1000)) {
            isPro = false; // Subscription has expired
            console.log(`[UsageLimits] Subscription expired for user ${row.user_id}: ${expirationDate} < ${now}`);
          } else {
            console.log(`[UsageLimits] Subscription still active for user ${row.user_id}: expires at ${expirationDate}`);
          }
        } catch (error) {
          console.error(`[UsageLimits] Error parsing expiration date for user ${row.user_id}:`, error);
          // If we can't parse the date, keep the current status
        }
      }
      
      return {
        userId: row.user_id,
        email: row.email,
        fullName: row.full_name || null,
        emailGenerations: parseInt(row.email_generations_today) || 0,
        coachingSessions: parseInt(row.coaching_sessions_today) || 0,
        difficultConversations: parseInt(row.difficult_conversations_today) || 0,
        lastReset: row.email_generations_last_reset || null,
        subscriptionType: isPro ? 'PRO' : 'FREE',
        subscriptionStatus: subscriptionStatus,
        subscriptionPlan: subscriptionPlan,
        subscriptionExpiresAt: expiresAt,
      };
    });

    res.json(usersStats);
  } catch (error) {
    console.error('Get all users stats error:', error);
    res.status(500).json({ error: 'Failed to get users stats' });
  }
});

// Admin: Set custom limits for testing (development only)
router.put('/:userId', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const {
      email_generations_today,
      coaching_sessions_today,
      difficult_conversations_today,
      reset_all = false
    } = req.body;

    // Check if user exists
    const userCheck = await pool.query('SELECT id FROM users WHERE id = $1', [userId]);
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if limits record exists
    const limitsCheck = await pool.query('SELECT id FROM users_limits WHERE id = $1', [userId]);
    
    if (limitsCheck.rows.length === 0) {
      // Create limits record
      await pool.query(
        `INSERT INTO users_limits (
          id, email_generations_today, email_generations_last_reset,
          coaching_sessions_today, coaching_sessions_last_reset,
          difficult_conversations_today, difficult_conversations_last_reset
        ) VALUES ($1, $2, now(), $3, now(), $4, now())`,
        [
          userId,
          email_generations_today ?? 0,
          coaching_sessions_today ?? 0,
          difficult_conversations_today ?? 0
        ]
      );
    } else {
      // Update limits
      const updateFields = [];
      const updateValues = [];
      let paramIndex = 1;

      if (reset_all) {
        // Reset all counters to 0
        await pool.query(
          `UPDATE users_limits SET
            email_generations_today = 0,
            coaching_sessions_today = 0,
            difficult_conversations_today = 0,
            email_generations_last_reset = now(),
            coaching_sessions_last_reset = now(),
            difficult_conversations_last_reset = now(),
            updated_at = now()
          WHERE id = $1`,
          [userId]
        );
      } else {
        // Update specific fields
        if (email_generations_today !== undefined) {
          updateFields.push(`email_generations_today = $${paramIndex++}`);
          updateValues.push(email_generations_today);
        }
        if (coaching_sessions_today !== undefined) {
          updateFields.push(`coaching_sessions_today = $${paramIndex++}`);
          updateValues.push(coaching_sessions_today);
        }
        if (difficult_conversations_today !== undefined) {
          updateFields.push(`difficult_conversations_today = $${paramIndex++}`);
          updateValues.push(difficult_conversations_today);
        }

        if (updateFields.length > 0) {
          updateValues.push(userId);
          await pool.query(
            `UPDATE users_limits SET
              ${updateFields.join(', ')},
              updated_at = now()
            WHERE id = $${paramIndex}`,
            updateValues
          );
        }
      }
    }

    // Return updated limits
    const result = await pool.query('SELECT * FROM users_limits WHERE id = $1', [userId]);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Set limits error:', error);
    res.status(500).json({ error: 'Failed to set limits' });
  }
});

export default router;

