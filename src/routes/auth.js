import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import pool from '../db/connection.js';
import { sendWelcomeEmail, sendVerificationEmail } from '../services/emailService.js';

const router = express.Router();

// Sign up
router.post('/signup', async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { email, password, firstName, lastName, isAdmin } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Check if user already exists
    const existingUser = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);
    const userId = uuidv4();

    // Use a transaction to ensure all inserts succeed or fail together
    try {
      await client.query('BEGIN');
      console.log('Transaction started, userId:', userId);
      
      // Create user first - verify it was inserted
      console.log('Attempting to insert user with id:', userId, 'email:', email);
      
      let userResult;
      try {
        userResult = await client.query(
          'INSERT INTO users (id, email, password_hash, email_verified) VALUES ($1, $2, $3, $4) RETURNING id, email',
          [userId, email, passwordHash, true]
        );
      } catch (insertError) {
        console.error('User insert error details:', {
          code: insertError.code,
          detail: insertError.detail,
          constraint: insertError.constraint,
          message: insertError.message,
          stack: insertError.stack
        });
        throw insertError;
      }
      
      if (!userResult.rows || userResult.rows.length === 0) {
        throw new Error('Failed to create user - no rows returned');
      }
      
      const insertedUserId = userResult.rows[0].id;
      console.log('User created successfully:', insertedUserId, 'email:', userResult.rows[0].email);
      
      // Verify user exists in the transaction (within the same transaction)
      const verifyUser = await client.query('SELECT id, email FROM users WHERE id = $1', [insertedUserId]);
      if (verifyUser.rows.length === 0) {
        throw new Error('User verification failed - user not found after insert in transaction');
      }
      console.log('User verified in transaction:', verifyUser.rows[0].id, verifyUser.rows[0].email);

      // Create profile (foreign key references users.id)
      const fullName = firstName && lastName ? `${firstName} ${lastName}` : null;
      console.log('Attempting to create profile with userId:', insertedUserId);
      
      let profileResult;
      try {
        profileResult = await client.query(
          `INSERT INTO profiles (id, email, first_name, last_name, full_name, is_admin) 
           VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
          [insertedUserId, email, firstName || null, lastName || null, fullName, isAdmin || false]
        );
      } catch (profileError) {
        console.error('Profile insert error details:', {
          code: profileError.code,
          detail: profileError.detail,
          constraint: profileError.constraint,
          message: profileError.message
        });
        // Double-check user exists
        const recheckUser = await client.query('SELECT id FROM users WHERE id = $1', [insertedUserId]);
        console.log('Rechecking user after profile error:', recheckUser.rows);
        throw profileError;
      }
      
      if (!profileResult.rows || profileResult.rows.length === 0) {
        throw new Error('Failed to create profile - no rows returned');
      }
      
      console.log('Profile created successfully');

      // Create subscription (free tier)
      const subscriptionResult = await client.query(
        'INSERT INTO subscriptions (user_id, status, plan) VALUES ($1, $2, $3) RETURNING id',
        [insertedUserId, 'free', 'free']
      );
      
      if (!subscriptionResult.rows || subscriptionResult.rows.length === 0) {
        throw new Error('Failed to create subscription - no rows returned');
      }

      // Create usage limits
      const limitsResult = await client.query(
        `INSERT INTO users_limits (id, email_generations_today, email_generations_last_reset, 
          coaching_sessions_today, coaching_sessions_last_reset, 
          difficult_conversations_today, difficult_conversations_last_reset)
         VALUES ($1, 0, now(), 0, now(), 0, now()) RETURNING id`,
        [insertedUserId]
      );
      
      if (!limitsResult.rows || limitsResult.rows.length === 0) {
        throw new Error('Failed to create usage limits - no rows returned');
      }
      
      // Commit the transaction
      await client.query('COMMIT');
      console.log('Transaction committed successfully');
      
      // Generate JWT token
      const token = jwt.sign(
        { userId: insertedUserId, email },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
      );

      // Send welcome email (async, don't wait for it - don't fail signup if email fails)
      sendWelcomeEmail(email, fullName || firstName || email).catch(err => {
        console.error('Failed to send welcome email (non-blocking):', err);
      });

      res.status(201).json({
        user: {
          id: insertedUserId,
          email,
          first_name: firstName,
          last_name: lastName,
          full_name: fullName,
          is_admin: isAdmin || false
        },
        token,
        session: {
          access_token: token,
          token_type: 'bearer',
          expires_in: 604800
        }
      });
    } catch (error) {
      // Rollback transaction on error
      try {
        await client.query('ROLLBACK');
        console.log('Transaction rolled back due to error');
      } catch (rollbackError) {
        console.error('Error during rollback:', rollbackError);
      }
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Signup error:', error);
    const errorMessage = process.env.NODE_ENV === 'development' 
      ? error.message || 'Failed to create user'
      : 'Failed to create user';
    res.status(500).json({ 
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? {
        code: error.code,
        detail: error.detail,
        constraint: error.constraint
      } : undefined
    });
  }
});

// Sign in
router.post('/signin', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Get user
    const userResult = await pool.query(
      'SELECT id, email, password_hash FROM users WHERE email = $1',
      [email]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = userResult.rows[0];

    // Verify password
    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Get profile
    const profileResult = await pool.query(
      'SELECT * FROM profiles WHERE id = $1',
      [user.id]
    );

    const profile = profileResult.rows[0] || {};

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.json({
      user: {
        id: user.id,
        email: user.email,
        ...profile
      },
      token,
      session: {
        access_token: token,
        token_type: 'bearer',
        expires_in: 604800
      }
    });
  } catch (error) {
    console.error('Signin error:', error);
    res.status(500).json({ error: 'Failed to sign in' });
  }
});

// Get current user
router.get('/me', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const result = await pool.query(
      `SELECT u.id, u.email, p.* 
       FROM users u 
       LEFT JOIN profiles p ON u.id = p.id 
       WHERE u.id = $1`,
      [decoded.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user: result.rows[0] });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

export default router;
