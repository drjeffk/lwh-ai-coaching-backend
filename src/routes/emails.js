import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import pool from '../db/connection.js';

const router = express.Router();

// Get all emails for user
router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM emails 
       WHERE user_id = $1 
       ORDER BY created_at DESC`,
      [req.user.id]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Get emails error:', error);
    res.status(500).json({ error: 'Failed to get emails' });
  }
});

// Get single email
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM emails 
       WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Email not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get email error:', error);
    res.status(500).json({ error: 'Failed to get email' });
  }
});

// Create email
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { subject, recipient, content, type } = req.body;

    if (!subject || !recipient || !content) {
      return res.status(400).json({ error: 'Subject, recipient, and content are required' });
    }

    const result = await pool.query(
      `INSERT INTO emails (user_id, subject, recipient, content, type)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [req.user.id, subject, recipient, content, type || 'general']
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create email error:', error);
    res.status(500).json({ error: 'Failed to create email' });
  }
});

// Update email
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { subject, recipient, content, type } = req.body;

    const result = await pool.query(
      `UPDATE emails SET
        subject = COALESCE($1, subject),
        recipient = COALESCE($2, recipient),
        content = COALESCE($3, content),
        type = COALESCE($4, type)
      WHERE id = $5 AND user_id = $6
      RETURNING *`,
      [subject, recipient, content, type, req.params.id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Email not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update email error:', error);
    res.status(500).json({ error: 'Failed to update email' });
  }
});

// Delete email
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `DELETE FROM emails 
       WHERE id = $1 AND user_id = $2
       RETURNING id`,
      [req.params.id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Email not found' });
    }

    res.json({ message: 'Email deleted successfully' });
  } catch (error) {
    console.error('Delete email error:', error);
    res.status(500).json({ error: 'Failed to delete email' });
  }
});

export default router;

