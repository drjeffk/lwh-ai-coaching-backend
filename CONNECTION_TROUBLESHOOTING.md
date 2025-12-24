# Connection Troubleshooting Guide

## Issue: ENOTFOUND Error

If you're getting `ENOTFOUND db.fspdimppabfgizlzhutu.supabase.co`, the hostname format might be incorrect.

## Solution: Get Exact Connection String from Supabase

1. **Go to Supabase Dashboard:**
   - https://supabase.com/dashboard/project/fspdimppabfgizlzhutu/settings/database

2. **Find "Connection string" section:**
   - Look for "Connection pooling" or "Direct connection"
   - Copy the **exact** connection string shown

3. **Common Supabase Connection Formats:**

   **Option A: Connection Pooling (Recommended for server apps)**
   ```
   postgresql://postgres.fspdimppabfgizlzhutu:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres
   ```
   - Host: `aws-0-[REGION].pooler.supabase.com`
   - Port: `6543`
   - User: `postgres.fspdimppabfgizlzhutu`

   **Option B: Direct Connection**
   ```
   postgresql://postgres:[PASSWORD]@db.fspdimppabfgizlzhutu.supabase.co:5432/postgres
   ```
   - Host: `db.fspdimppabfgizlzhutu.supabase.co`
   - Port: `5432`
   - User: `postgres`

## Try Connection Pooling First

Connection pooling is more reliable for server applications. Update your `.env`:

```env
# Database Configuration - Connection Pooling
DB_HOST=aws-0-[REGION].pooler.supabase.com
DB_PORT=6543
DB_NAME=postgres
DB_USER=postgres.fspdimppabfgizlzhutu
DB_PASSWORD=IamNotFel13$
```

Replace `[REGION]` with your actual region (e.g., `us-east-1`, `eu-west-1`, etc.)

## Or Use Full Connection String

If you get the exact connection string from Supabase dashboard, use it directly:

```env
# Database Configuration
DATABASE_URL=postgresql://postgres.fspdimppabfgizlzhutu:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres
```

Make sure to URL-encode the password if it has special characters:
- `$` becomes `%24`
- `@` becomes `%40`
- etc.

## Verify Your Project

Make sure:
1. Your Supabase project is active (not paused)
2. You're using the correct project reference
3. Database is accessible (check Supabase dashboard)

