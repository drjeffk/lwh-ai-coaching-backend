import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.js';
import subscriptionRoutes from './routes/subscriptions.js';
import coachingRoutes from './routes/coaching.js';
import emailRoutes from './routes/emails.js';
import usageLimitsRoutes from './routes/usage-limits.js';
import aiFunctionsRoutes from './routes/ai-functions.js';
import stripeRoutes from './routes/stripe.js';
import profileRoutes from './routes/profiles.js';
import difficultConversationsRoutes from './routes/difficult-conversations.js';
import quickTipsRoutes from './routes/quick-tips.js';
import emailTestRoutes from './routes/email-test.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:8080',
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/coaching', coachingRoutes);
app.use('/api/emails', emailRoutes);
app.use('/api/usage-limits', usageLimitsRoutes);
app.use('/api/ai', aiFunctionsRoutes);
app.use('/api/stripe', stripeRoutes);
app.use('/api/profiles', profileRoutes);
app.use('/api/difficult-conversations', difficultConversationsRoutes);
app.use('/api/quick-tips', quickTipsRoutes);
app.use('/api/email', emailTestRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

