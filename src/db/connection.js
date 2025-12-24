import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

// Helper function to encode password for URL if needed
const encodePassword = (password) => {
  if (!password) return '';
  // URL encode special characters in password
  return encodeURIComponent(password);
};

// Build connection config
let connectionConfig;

if (process.env.DATABASE_URL) {
  // Use DATABASE_URL directly (password should already be URL-encoded if needed)
  connectionConfig = {
    connectionString: process.env.DATABASE_URL,
  };
} else {
  // Build from individual fields (pg library handles special chars in password field)
  connectionConfig = {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  };
}

const pool = new Pool({
  ...connectionConfig,
  // Supabase requires SSL for all connections
  ssl: process.env.DB_HOST?.includes('supabase.co') || process.env.DATABASE_URL?.includes('supabase.co') 
    ? { rejectUnauthorized: false } 
    : (process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false),
});

// Test connection
pool.on('connect', () => {
  console.log('Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

export default pool;

