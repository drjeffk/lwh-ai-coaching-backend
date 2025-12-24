import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import pool from '../db/connection.js';

const router = express.Router();

// Get all coaching sessions for user
router.get('/sessions', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM coaching_sessions 
       WHERE user_id = $1 
       ORDER BY created_at DESC`,
      [req.user.id]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Get coaching sessions error:', error);
    res.status(500).json({ error: 'Failed to get coaching sessions' });
  }
});

// Get single coaching session
router.get('/sessions/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM coaching_sessions 
       WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get coaching session error:', error);
    res.status(500).json({ error: 'Failed to get coaching session' });
  }
});

// Create coaching session
router.post('/sessions', authenticateToken, async (req, res) => {
  try {
    const {
      session_type,
      challenge,
      desired_outcome,
      insights,
      action_items,
      feedback,
      session_duration
    } = req.body;

    const result = await pool.query(
      `INSERT INTO coaching_sessions (
        user_id, session_type, challenge, desired_outcome,
        insights, action_items, feedback, session_duration
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *`,
      [
        req.user.id,
        session_type || 'general',
        challenge || '',
        desired_outcome || '',
        insights || [],
        action_items || [],
        feedback || null,
        session_duration || null
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create coaching session error:', error);
    res.status(500).json({ error: 'Failed to create coaching session' });
  }
});

// Update coaching session
router.put('/sessions/:id', authenticateToken, async (req, res) => {
  try {
    const {
      session_type,
      challenge,
      desired_outcome,
      insights,
      action_items,
      feedback,
      session_duration
    } = req.body;

    const result = await pool.query(
      `UPDATE coaching_sessions SET
        session_type = COALESCE($1, session_type),
        challenge = COALESCE($2, challenge),
        desired_outcome = COALESCE($3, desired_outcome),
        insights = COALESCE($4, insights),
        action_items = COALESCE($5, action_items),
        feedback = COALESCE($6, feedback),
        session_duration = COALESCE($7, session_duration)
      WHERE id = $8 AND user_id = $9
      RETURNING *`,
      [
        session_type,
        challenge,
        desired_outcome,
        insights,
        action_items,
        feedback,
        session_duration,
        req.params.id,
        req.user.id
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update coaching session error:', error);
    res.status(500).json({ error: 'Failed to update coaching session' });
  }
});

// Delete coaching session
router.delete('/sessions/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `DELETE FROM coaching_sessions 
       WHERE id = $1 AND user_id = $2
       RETURNING id`,
      [req.params.id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    res.json({ message: 'Session deleted successfully' });
  } catch (error) {
    console.error('Delete coaching session error:', error);
    res.status(500).json({ error: 'Failed to delete coaching session' });
  }
});

// Get coaching conversations
router.get('/conversations', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM coaching_conversations 
       WHERE user_id = $1 
       ORDER BY last_message_at DESC NULLS LAST, created_at DESC`,
      [req.user.id]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({ error: 'Failed to get conversations' });
  }
});

// Create or update coaching conversation
router.post('/conversations', authenticateToken, async (req, res) => {
  try {
    const {
      assistant_id,
      thread_id,
      conversation_state,
      is_active,
      last_message_at
    } = req.body;

    const result = await pool.query(
      `INSERT INTO coaching_conversations (
        user_id, assistant_id, thread_id, conversation_state, is_active, last_message_at
      ) VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (id) DO UPDATE SET
        conversation_state = EXCLUDED.conversation_state,
        is_active = EXCLUDED.is_active,
        last_message_at = EXCLUDED.last_message_at,
        updated_at = now()
      RETURNING *`,
      [
        req.user.id,
        assistant_id,
        thread_id,
        conversation_state || {},
        is_active !== undefined ? is_active : true,
        last_message_at || new Date().toISOString()
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create conversation error:', error);
    res.status(500).json({ error: 'Failed to create conversation' });
  }
});

export default router;

