/**
 * Script to check and update user subscription status for testing
 * Usage: node src/db/check-user-subscription.js <userId> [status] [plan]
 * Example: node src/db/check-user-subscription.js e00ea7b1-c622-4598-a0c7-5000e1ab1f9b active pro
 */

import pool from './connection.js';

async function checkUserSubscription(userId, newStatus = null, newPlan = null) {
  const client = await pool.connect();
  
  try {
    console.log(`Checking subscription for user ${userId}...\n`);
    
    // Check if user exists
    const userCheck = await client.query('SELECT id, email FROM users WHERE id = $1', [userId]);
    if (userCheck.rows.length === 0) {
      throw new Error(`User with ID ${userId} not found`);
    }
    
    console.log(`✅ Found user: ${userCheck.rows[0].email}\n`);
    
    // Check current subscription
    const subscriptionCheck = await client.query(
      'SELECT * FROM subscriptions WHERE user_id = $1',
      [userId]
    );
    
    if (subscriptionCheck.rows.length === 0) {
      console.log('❌ No subscription found for this user');
      if (newStatus && newPlan) {
        console.log(`\nCreating subscription with status: ${newStatus}, plan: ${newPlan}...`);
        await client.query(
          'INSERT INTO subscriptions (user_id, status, plan) VALUES ($1, $2, $3)',
          [userId, newStatus, newPlan]
        );
        console.log('✅ Subscription created!');
      }
    } else {
      const sub = subscriptionCheck.rows[0];
      console.log('📊 Current Subscription:');
      console.log(`   Status: ${sub.status}`);
      console.log(`   Plan: ${sub.plan}`);
      console.log(`   Created: ${sub.created_at}`);
      console.log(`   Updated: ${sub.updated_at}`);
      
      if (newStatus && newPlan) {
        console.log(`\n🔄 Updating subscription to status: ${newStatus}, plan: ${newPlan}...`);
        await client.query(
          'UPDATE subscriptions SET status = $1, plan = $2, updated_at = now() WHERE user_id = $3',
          [newStatus, newPlan, userId]
        );
        console.log('✅ Subscription updated!');
      }
    }
    
    // Check usage limits
    const limitsCheck = await client.query(
      'SELECT * FROM users_limits WHERE id = $1',
      [userId]
    );
    
    if (limitsCheck.rows.length > 0) {
      const limits = limitsCheck.rows[0];
      console.log('\n📊 Current Usage Limits:');
      console.log(`   Email generations today: ${limits.email_generations_today}`);
      console.log(`   Coaching sessions today: ${limits.coaching_sessions_today}`);
      console.log(`   Difficult conversations today: ${limits.difficult_conversations_today}`);
    } else {
      console.log('\n⚠️  No usage limits record found');
    }
    
    console.log('\n✅ Done!');
  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    client.release();
  }
}

// Get command line arguments
const args = process.argv.slice(2);

if (args.length < 1) {
  console.log('Usage: node src/db/check-user-subscription.js <userId> [status] [plan]');
  console.log('Example: node src/db/check-user-subscription.js e00ea7b1-c622-4598-a0c7-5000e1ab1f9b');
  console.log('Example: node src/db/check-user-subscription.js e00ea7b1-c622-4598-a0c7-5000e1ab1f9b active pro');
  console.log('\nValid statuses: free, trialing, active, canceled, past_due, incomplete, incomplete_expired');
  console.log('Valid plans: free, pro, enterprise');
  process.exit(1);
}

const [userId, newStatus, newPlan] = args;

checkUserSubscription(userId, newStatus || null, newPlan || null)
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });

