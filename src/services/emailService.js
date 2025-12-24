import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

// Create reusable transporter
let transporter = null;

const createTransporter = () => {
  if (transporter) return transporter;

  // Check if SMTP is configured
  if (!process.env.SMTP_HOST && !process.env.SMTP_SERVICE) {
    return null;
  }

  // If using Gmail service
  if (process.env.SMTP_SERVICE === 'gmail') {
    if (!process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
      console.warn('Gmail SMTP configured but missing credentials');
      return null;
    }
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
    });
  } else {
    // Custom SMTP server
    if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
      console.warn('SMTP configured but missing required settings');
      return null;
    }
    const smtpConfig = {
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
    };
    transporter = nodemailer.createTransport(smtpConfig);
  }

  return transporter;
};

/**
 * Send email using SMTP
 * @param {Object} options - Email options
 * @param {string} options.to - Recipient email
 * @param {string} options.subject - Email subject
 * @param {string} options.html - HTML content
 * @param {string} [options.text] - Plain text content (optional)
 * @param {string} [options.from] - Sender email (defaults to SMTP_FROM)
 * @returns {Promise<Object>} - Send result
 */
export const sendEmail = async ({ to, subject, html, text, from }) => {
  try {
    if (!to || !subject || !html) {
      throw new Error('to, subject, and html are required');
    }

    const transporter = createTransporter();
    
    // If no transporter (SMTP not configured), skip silently
    if (!transporter) {
      console.warn('SMTP not configured. Email sending skipped.');
      return { success: true, skipped: true, message: 'SMTP not configured' };
    }

    const mailOptions = {
      from: from || process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      subject,
      html,
      text: text || html.replace(/<[^>]*>/g, ''), // Strip HTML for text version
    };

    const info = await transporter.sendMail(mailOptions);
    
    console.log('Email sent successfully:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending email:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Send welcome email to new user
 */
export const sendWelcomeEmail = async (userEmail, userName) => {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #4F46E5; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background-color: #f9f9f9; }
        .button { display: inline-block; padding: 12px 24px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Welcome to Leading with Heart!</h1>
        </div>
        <div class="content">
          <h2>Hello ${userName || 'there'}!</h2>
          <p>Thank you for joining Leading with Heart AI Coaching. We're excited to have you on board!</p>
          <p>You can now start your leadership journey with our AI-powered coaching tools:</p>
          <ul>
            <li>Leadership coaching sessions</li>
            <li>Email writing assistance</li>
            <li>Difficult conversation practice</li>
            <li>And much more!</li>
          </ul>
          <a href="${process.env.FRONTEND_URL || 'http://localhost:8080'}" class="button">Get Started</a>
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} Leading with Heart. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return await sendEmail({
    to: userEmail,
    subject: 'Welcome to Leading with Heart AI Coaching',
    html,
  });
};

/**
 * Send password reset email
 */
export const sendPasswordResetEmail = async (userEmail, resetToken) => {
  const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:8080'}/reset-password?token=${resetToken}`;
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #4F46E5; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background-color: #f9f9f9; }
        .button { display: inline-block; padding: 12px 24px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        .warning { color: #dc2626; font-size: 12px; margin-top: 20px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Password Reset Request</h1>
        </div>
        <div class="content">
          <p>You requested to reset your password. Click the button below to reset it:</p>
          <a href="${resetUrl}" class="button">Reset Password</a>
          <p>Or copy and paste this link into your browser:</p>
          <p style="word-break: break-all;">${resetUrl}</p>
          <p class="warning">This link will expire in 1 hour. If you didn't request this, please ignore this email.</p>
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} Leading with Heart. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return await sendEmail({
    to: userEmail,
    subject: 'Reset Your Password - Leading with Heart',
    html,
  });
};

/**
 * Send email verification email
 */
export const sendVerificationEmail = async (userEmail, verificationToken) => {
  const verificationUrl = `${process.env.FRONTEND_URL || 'http://localhost:8080'}/verify-email?token=${verificationToken}`;
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #4F46E5; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background-color: #f9f9f9; }
        .button { display: inline-block; padding: 12px 24px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Verify Your Email</h1>
        </div>
        <div class="content">
          <p>Thank you for signing up! Please verify your email address by clicking the button below:</p>
          <a href="${verificationUrl}" class="button">Verify Email</a>
          <p>Or copy and paste this link into your browser:</p>
          <p style="word-break: break-all;">${verificationUrl}</p>
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} Leading with Heart. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return await sendEmail({
    to: userEmail,
    subject: 'Verify Your Email - Leading with Heart',
    html,
  });
};

/**
 * Test SMTP connection
 */
export const testSMTPConnection = async () => {
  try {
    const transporter = createTransporter();
    if (!transporter) {
      return { success: false, error: 'SMTP not configured' };
    }
    await transporter.verify();
    console.log('SMTP server is ready to send emails');
    return { success: true, message: 'SMTP connection successful' };
  } catch (error) {
    console.error('SMTP connection failed:', error);
    return { success: false, error: error.message };
  }
};

