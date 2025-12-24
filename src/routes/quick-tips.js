import express from 'express';
import pool from '../db/connection.js';

const router = express.Router();

// Get all active quick tips
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

export default router;

