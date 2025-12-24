import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import pool from '../db/connection.js';

const router = express.Router();

// Get profile
router.get('/:id?', authenticateToken, async (req, res) => {
  try {
    const profileId = req.params.id || req.user.id;

    // Users can only view their own profile unless they're admin
    if (profileId !== req.user.id) {
      const adminCheck = await pool.query(
        'SELECT is_admin FROM profiles WHERE id = $1',
        [req.user.id]
      );

      if (!adminCheck.rows[0]?.is_admin) {
        return res.status(403).json({ error: 'Unauthorized' });
      }
    }

    const result = await pool.query(
      `SELECT * FROM profiles WHERE id = $1`,
      [profileId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to get profile' });
  }
});

// Update profile
router.put('/:id?', authenticateToken, async (req, res) => {
  try {
    const profileId = req.params.id || req.user.id;

    // Users can only update their own profile unless they're admin
    if (profileId !== req.user.id) {
      const adminCheck = await pool.query(
        'SELECT is_admin FROM profiles WHERE id = $1',
        [req.user.id]
      );

      if (!adminCheck.rows[0]?.is_admin) {
        return res.status(403).json({ error: 'Unauthorized' });
      }
    }

    const { first_name, last_name, full_name, avatar_url, is_admin } = req.body;

    // Only admins can change is_admin
    if (is_admin !== undefined && profileId !== req.user.id) {
      const adminCheck = await pool.query(
        'SELECT is_admin FROM profiles WHERE id = $1',
        [req.user.id]
      );

      if (!adminCheck.rows[0]?.is_admin) {
        return res.status(403).json({ error: 'Only admins can change admin status' });
      }
    }

    const result = await pool.query(
      `UPDATE profiles SET
        first_name = COALESCE($1, first_name),
        last_name = COALESCE($2, last_name),
        full_name = COALESCE($3, full_name),
        avatar_url = COALESCE($4, avatar_url),
        is_admin = COALESCE($5, is_admin),
        updated_at = now()
      WHERE id = $6
      RETURNING *`,
      [first_name, last_name, full_name, avatar_url, is_admin, profileId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

export default router;

