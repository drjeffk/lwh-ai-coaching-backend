import pool from './connection.js';

async function migrateDifficultConversations() {
  const client = await pool.connect();
  
  try {
    console.log('Starting difficult_conversation_history migration...');
    
    await client.query('BEGIN');
    
    // Add new columns if they don't exist
    const columns = [
      { name: 'relationship_type', type: 'TEXT' },
      { name: 'conversation_topic', type: 'TEXT' },
      { name: 'desired_outcome', type: 'TEXT' },
      { name: 'communication_style', type: 'TEXT' },
      { name: 'additional_context', type: 'TEXT' },
      { name: 'feedback', type: 'TEXT' },
      { name: 'detailed_feedback', type: 'JSONB' },
      { name: 'actionable_next_steps', type: 'JSONB' },
      { name: 'tenets_rating', type: 'JSONB' }
    ];
    
    for (const col of columns) {
      try {
        await client.query(`
          ALTER TABLE difficult_conversation_history 
          ADD COLUMN IF NOT EXISTS ${col.name} ${col.type}
        `);
        console.log(`✅ Added column: ${col.name}`);
      } catch (error) {
        console.error(`Error adding column ${col.name}:`, error.message);
      }
    }
    
    // Make scenario nullable (it was NOT NULL before)
    try {
      await client.query(`
        ALTER TABLE difficult_conversation_history 
        ALTER COLUMN scenario DROP NOT NULL
      `);
      console.log('✅ Made scenario column nullable');
    } catch (error) {
      console.log('Note: scenario column may already be nullable');
    }
    
    await client.query('COMMIT');
    console.log('✅ Migration completed successfully!');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    client.release();
  }
}

migrateDifficultConversations()
  .then(() => {
    console.log('Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration error:', error);
    process.exit(1);
  });

