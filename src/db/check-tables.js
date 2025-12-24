import pool from './connection.js';

async function checkTables() {
  try {
    console.log('Checking which tables exist...\n');
    
    // Check if users table exists
    const usersCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'users'
      );
    `);
    console.log('Users table exists:', usersCheck.rows[0].exists);
    
    // Check if profiles table exists
    const profilesCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'profiles'
      );
    `);
    console.log('Profiles table exists:', profilesCheck.rows[0].exists);
    
    // List all tables in public schema
    const allTables = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);
    console.log('\nAll tables in public schema:');
    allTables.rows.forEach(row => {
      console.log('  -', row.table_name);
    });
    
    // Check if auth.users exists (Supabase)
    const authUsersCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'auth' 
        AND table_name = 'users'
      );
    `);
    console.log('\nAuth.users table exists (Supabase):', authUsersCheck.rows[0].exists);
    
    // If profiles exists, check its foreign key
    if (profilesCheck.rows[0].exists) {
      const fkCheck = await pool.query(`
        SELECT 
          tc.constraint_name, 
          ccu.table_schema AS foreign_table_schema,
          ccu.table_name AS foreign_table_name
        FROM information_schema.table_constraints AS tc 
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
        WHERE tc.table_name = 'profiles' 
          AND tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_schema = 'public'
      `);
      console.log('\nProfiles foreign key constraints:');
      fkCheck.rows.forEach(row => {
        console.log(`  - ${row.constraint_name} -> ${row.foreign_table_schema}.${row.foreign_table_name}`);
      });
    }
    
  } catch (error) {
    console.error('Error checking tables:', error);
  } finally {
    await pool.end();
  }
}

checkTables();

