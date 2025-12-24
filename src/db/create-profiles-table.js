import pool from './connection.js';

async function createProfilesTable() {
  const client = await pool.connect();
  
  try {
    console.log('Creating profiles table...');
    
    await client.query('BEGIN');
    
    // Create profiles table
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.profiles (
        id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
        email TEXT,
        first_name TEXT,
        last_name TEXT,
        full_name TEXT,
        avatar_url TEXT,
        is_admin BOOLEAN DEFAULT false,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);
    
    // Create trigger for updated_at
    await client.query(`
      DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
      CREATE TRIGGER update_profiles_updated_at 
        BEFORE UPDATE ON public.profiles
        FOR EACH ROW 
        EXECUTE FUNCTION update_updated_at_column();
    `);
    
    await client.query('COMMIT');
    console.log('Profiles table created successfully!');
    
    // Verify
    const verify = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'profiles'
      ORDER BY ordinal_position;
    `);
    
    console.log('\nProfiles table columns:');
    verify.rows.forEach(row => {
      console.log(`  - ${row.column_name}: ${row.data_type}`);
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating profiles table:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

createProfilesTable()
  .then(() => {
    console.log('\nDone!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed:', error);
    process.exit(1);
  });

