import express from 'express';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import pool from '../db/connection.js';

const router = express.Router();

// Get all quick tips (public endpoint - returns only active tips)
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM quick_tips 
       WHERE active = true 
       ORDER BY created_at DESC`
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Get quick tips error:', error);
    res.status(500).json({ error: 'Failed to get quick tips' });
  }
});

// Get all quick tips including inactive (admin only)
router.get('/all', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM quick_tips 
       ORDER BY created_at DESC`
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Get all quick tips error:', error);
    res.status(500).json({ error: 'Failed to get quick tips' });
  }
});

// Create a new quick tip (admin only)
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { title, description, icon, active = true } = req.body;

    if (!title || !description || !icon) {
      return res.status(400).json({ error: 'Title, description, and icon are required' });
    }

    // Validate icon value
    const validIcons = ['authenticity', 'value', 'capability', 'power', 'commitment'];
    if (!validIcons.includes(icon)) {
      return res.status(400).json({ error: 'Invalid icon value' });
    }

    const result = await pool.query(
      `INSERT INTO quick_tips (title, description, icon, active)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [title, description, icon, active]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create quick tip error:', error);
    res.status(500).json({ error: 'Failed to create quick tip' });
  }
});

// Update a quick tip (admin only)
router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, icon, active } = req.body;

    // Validate icon value if provided
    if (icon) {
      const validIcons = ['authenticity', 'value', 'capability', 'power', 'commitment'];
      if (!validIcons.includes(icon)) {
        return res.status(400).json({ error: 'Invalid icon value' });
      }
    }

    const updateFields = [];
    const updateValues = [];
    let paramIndex = 1;

    if (title !== undefined) {
      updateFields.push(`title = $${paramIndex++}`);
      updateValues.push(title);
    }
    if (description !== undefined) {
      updateFields.push(`description = $${paramIndex++}`);
      updateValues.push(description);
    }
    if (icon !== undefined) {
      updateFields.push(`icon = $${paramIndex++}`);
      updateValues.push(icon);
    }
    if (active !== undefined) {
      updateFields.push(`active = $${paramIndex++}`);
      updateValues.push(active);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updateFields.push(`updated_at = now()`);
    updateValues.push(id);
    
    const result = await pool.query(
      `UPDATE quick_tips 
       SET ${updateFields.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING *`,
      updateValues
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Quick tip not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update quick tip error:', error);
    res.status(500).json({ error: 'Failed to update quick tip' });
  }
});

// Delete a quick tip (admin only)
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `DELETE FROM quick_tips 
       WHERE id = $1
       RETURNING id`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Quick tip not found' });
    }

    res.json({ success: true, message: 'Quick tip deleted successfully' });
  } catch (error) {
    console.error('Delete quick tip error:', error);
    res.status(500).json({ error: 'Failed to delete quick tip' });
  }
});

export default router;

