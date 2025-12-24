-- Fix profiles table foreign key to reference public.users instead of auth.users
-- This is needed when migrating from Supabase to our own users table

-- First, check if profiles table exists and what it references
-- If it references auth.users, we need to drop and recreate the constraint

-- Drop the existing foreign key constraint if it exists
ALTER TABLE IF EXISTS public.profiles 
  DROP CONSTRAINT IF EXISTS profiles_id_fkey;

-- Recreate the foreign key to reference public.users
ALTER TABLE IF EXISTS public.profiles
  ADD CONSTRAINT profiles_id_fkey 
  FOREIGN KEY (id) 
  REFERENCES public.users(id) 
  ON DELETE CASCADE;

-- Verify the constraint
SELECT 
  tc.constraint_name, 
  tc.table_name, 
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name 
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.table_name = 'profiles' 
  AND tc.constraint_type = 'FOREIGN KEY';

