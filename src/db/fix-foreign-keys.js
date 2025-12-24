import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from './connection.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function fixForeignKeys() {
  const client = await pool.connect();
  
  try {
    console.log('Fixing foreign key constraints...');
    
    // Check current foreign key constraints on profiles
    const checkFK = await client.query(`
      SELECT 
        tc.constraint_name, 
        tc.table_name, 
        kcu.column_name,
        ccu.table_schema AS foreign_table_schema,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name 
      FROM information_schema.table_constraints AS tc 
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
      WHERE tc.table_name = 'profiles' 
        AND tc.constraint_type = 'FOREIGN KEY'
    `);
    
    console.log('Current foreign key constraints:', checkFK.rows);
    
    // Drop existing constraint if it references wrong table
    if (checkFK.rows.length > 0) {
      for (const fk of checkFK.rows) {
        if (fk.foreign_table_schema !== 'public' || fk.foreign_table_name !== 'users') {
          console.log(`Dropping incorrect foreign key: ${fk.constraint_name}`);
          await client.query(`ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS ${fk.constraint_name}`);
        }
      }
    }
    
    // Add correct foreign key
    console.log('Adding correct foreign key constraint...');
    await client.query(`
      ALTER TABLE public.profiles
      DROP CONSTRAINT IF EXISTS profiles_id_fkey
    `);
    
    await client.query(`
      ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_id_fkey 
      FOREIGN KEY (id) 
      REFERENCES public.users(id) 
      ON DELETE CASCADE
    `);
    
    console.log('Foreign key constraint fixed successfully!');
    
    // Verify
    const verifyFK = await client.query(`
      SELECT 
        tc.constraint_name, 
        ccu.table_schema AS foreign_table_schema,
        ccu.table_name AS foreign_table_name
      FROM information_schema.table_constraints AS tc 
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
      WHERE tc.table_name = 'profiles' 
        AND tc.constraint_type = 'FOREIGN KEY'
        AND tc.constraint_name = 'profiles_id_fkey'
    `);
    
    console.log('Verified foreign key:', verifyFK.rows);
    
  } catch (error) {
    console.error('Error fixing foreign keys:', error);
    throw error;
  } finally {
    client.release();
  }
}

fixForeignKeys()
  .then(() => {
    console.log('Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed:', error);
    process.exit(1);
  });

