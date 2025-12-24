/**
 * Script to set custom user limits for development testing
 * Usage: node src/db/set-user-limits.js <userId> <emailLimit> <coachingLimit> <conversationLimit>
 * Example: node src/db/set-user-limits.js e00ea7b1-c622-4598-a0c7-5000e1ab1f9b 10 5 3
 */

import pool from './connection.js';

async function setUserLimits(userId, emailLimit, coachingLimit, conversationLimit) {
  const client = await pool.connect();
  
  try {
    console.log(`Setting limits for user ${userId}:`);
    console.log(`  Email: ${emailLimit}`);
    console.log(`  Coaching: ${coachingLimit}`);
    console.log(`  Conversations: ${conversationLimit}`);
    
    await client.query('BEGIN');
    
    // Check if user exists
    const userCheck = await client.query('SELECT id, email FROM users WHERE id = $1', [userId]);
    if (userCheck.rows.length === 0) {
      throw new Error(`User with ID ${userId} not found`);
    }
    
    console.log(`Found user: ${userCheck.rows[0].email}`);
    
    // Check if limits record exists
    const limitsCheck = await client.query('SELECT * FROM users_limits WHERE id = $1', [userId]);
    
    if (limitsCheck.rows.length === 0) {
      // Create limits record
      await client.query(
        `INSERT INTO users_limits (
          id, email_generations_today, email_generations_last_reset,
          coaching_sessions_today, coaching_sessions_last_reset,
          difficult_conversations_today, difficult_conversations_last_reset
        ) VALUES ($1, $2, now(), $3, now(), $4, now())`,
        [userId, emailLimit, coachingLimit, conversationLimit]
      );
      console.log('✅ Created new limits record');
    } else {
      // Update existing limits
      await client.query(
        `UPDATE users_limits SET
          email_generations_today = $1,
          coaching_sessions_today = $2,
          difficult_conversations_today = $3,
          updated_at = now()
        WHERE id = $4`,
        [emailLimit, coachingLimit, conversationLimit, userId]
      );
      console.log('✅ Updated existing limits record');
    }
    
    await client.query('COMMIT');
    
    // Fetch and display updated limits
    const result = await client.query('SELECT * FROM users_limits WHERE id = $1', [userId]);
    console.log('\n📊 Updated limits:');
    console.log(`  Email generations today: ${result.rows[0].email_generations_today}`);
    console.log(`  Coaching sessions today: ${result.rows[0].coaching_sessions_today}`);
    console.log(`  Difficult conversations today: ${result.rows[0].difficult_conversations_today}`);
    
    console.log('\n✅ Limits set successfully!');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error setting limits:', error.message);
    throw error;
  } finally {
    client.release();
  }
}

// Get command line arguments
const args = process.argv.slice(2);

if (args.length < 4) {
  console.log('Usage: node src/db/set-user-limits.js <userId> <emailLimit> <coachingLimit> <conversationLimit>');
  console.log('Example: node src/db/set-user-limits.js e00ea7b1-c622-4598-a0c7-5000e1ab1f9b 10 5 3');
  console.log('\nTo reset all limits to 0:');
  console.log('  node src/db/set-user-limits.js <userId> 0 0 0');
  process.exit(1);
}

const [userId, emailLimit, coachingLimit, conversationLimit] = args;

setUserLimits(userId, parseInt(emailLimit), parseInt(coachingLimit), parseInt(conversationLimit))
  .then(() => {
    console.log('Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });

