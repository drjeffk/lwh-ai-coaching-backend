import pool from './connection.js';

async function fixAllForeignKeys() {
  const client = await pool.connect();
  
  try {
    console.log('Fixing all foreign key constraints...\n');
    
    // List of tables that should reference public.users
    const tablesToFix = [
      { table: 'profiles', column: 'id' },
      { table: 'users_limits', column: 'id' },
      { table: 'subscriptions', column: 'user_id' },
      { table: 'coaching_sessions', column: 'user_id' },
      { table: 'coaching_conversations', column: 'user_id' },
      { table: 'follow_up_sessions', column: 'user_id' },
      { table: 'emails', column: 'user_id' },
      { table: 'difficult_conversation_history', column: 'user_id' },
      { table: 'documents', column: 'user_id' },
      { table: 'resource_documents', column: 'user_id' }
    ];
    
    for (const { table, column } of tablesToFix) {
      try {
        // Check if table exists
        const tableExists = await client.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = $1
          );
        `, [table]);
        
        if (!tableExists.rows[0].exists) {
          console.log(`⚠️  Table ${table} does not exist, skipping...`);
          continue;
        }
        
        // Get ALL foreign key constraints for this table (not just for the column)
        const allFKs = await client.query(`
          SELECT 
            tc.constraint_name,
            kcu.column_name,
            ccu.table_schema AS foreign_table_schema,
            ccu.table_name AS foreign_table_name
          FROM information_schema.table_constraints AS tc 
          JOIN information_schema.key_column_usage AS kcu
            ON tc.constraint_name = kcu.constraint_name
            AND tc.table_schema = kcu.table_schema
          JOIN information_schema.constraint_column_usage AS ccu
            ON ccu.constraint_name = tc.constraint_name
          WHERE tc.table_schema = 'public'
            AND tc.table_name = $1
            AND tc.constraint_type = 'FOREIGN KEY'
        `, [table]);
        
        console.log(`\n📋 Table: ${table}, Column: ${column}`);
        
        // Find and drop foreign keys for this specific column
        const columnFKs = allFKs.rows.filter(fk => fk.column_name === column);
        
        // Drop ALL existing foreign keys for this column (we'll recreate them)
        for (const fk of columnFKs) {
          console.log(`  🗑️  Dropping FK: ${fk.constraint_name} -> ${fk.foreign_table_schema}.${fk.foreign_table_name}`);
          await client.query(`ALTER TABLE public.${table} DROP CONSTRAINT IF EXISTS ${fk.constraint_name}`);
        }
        
        // Also try dropping by common constraint name patterns
        const commonNames = [
          `${table}_${column}_fkey`,
          `${table}_${column}_users_id_fkey`,
          `${table}_user_id_fkey`
        ];
        
        for (const name of commonNames) {
          try {
            await client.query(`ALTER TABLE public.${table} DROP CONSTRAINT IF EXISTS ${name}`);
          } catch (e) {
            // Ignore if doesn't exist
          }
        }
        
        // Add correct foreign key
        const constraintName = `${table}_${column}_fkey`;
        console.log(`  ➕ Adding correct FK: ${constraintName} -> public.users`);
        
        await client.query(`
          ALTER TABLE public.${table}
          ADD CONSTRAINT ${constraintName}
          FOREIGN KEY (${column})
          REFERENCES public.users(id)
          ON DELETE CASCADE
        `);
        console.log(`  ✅ Created constraint: ${constraintName}`);
        
      } catch (error) {
        console.error(`  ❌ Error fixing ${table}:`, error.message);
      }
    }
    
    console.log('\n✅ All foreign key constraints fixed!');
    
  } catch (error) {
    console.error('Error fixing foreign keys:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

fixAllForeignKeys()
  .then(() => {
    console.log('\nDone!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed:', error);
    process.exit(1);
  });

