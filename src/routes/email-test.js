import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { sendEmail, testSMTPConnection } from '../services/emailService.js';
import pool from '../db/connection.js';

const router = express.Router();

// Test SMTP connection (admin only)
router.get('/test-connection', authenticateToken, async (req, res) => {
  try {
    // Check if user is admin
    const adminCheck = await pool.query(
      'SELECT is_admin FROM profiles WHERE id = $1',
      [req.user.id]
    );

    if (!adminCheck.rows[0]?.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const result = await testSMTPConnection();
    res.json(result);
  } catch (error) {
    console.error('Test connection error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Send test email (admin only)
router.post('/test', authenticateToken, async (req, res) => {
  try {
    // Check if user is admin
    const adminCheck = await pool.query(
      'SELECT is_admin FROM profiles WHERE id = $1',
      [req.user.id]
    );

    if (!adminCheck.rows[0]?.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { to, subject, html } = req.body;

    if (!to || !subject || !html) {
      return res.status(400).json({ error: 'to, subject, and html are required' });
    }

    const result = await sendEmail({ to, subject, html });
    res.json(result);
  } catch (error) {
    console.error('Send test email error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;

