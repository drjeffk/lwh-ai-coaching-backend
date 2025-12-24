# Migration Guide: Supabase to Node.js Backend

This guide explains how to update the frontend to use the new Node.js backend instead of Supabase.

## Overview

The new backend provides REST API endpoints that replace:
- Supabase Auth → `/api/auth/*`
- Supabase Database queries → `/api/*` routes
- Supabase Edge Functions → `/api/ai/*` and `/api/stripe/*`

## Step 1: Environment Variables

Add to your frontend `.env` file:

```env
VITE_API_URL=http://localhost:3001/api
```

For production, set this to your backend URL.

## Step 2: Update Authentication

Replace Supabase auth calls with the new API client:

### Before (Supabase):
```typescript
import { supabase } from '@/integrations/supabase/client';

const { data, error } = await supabase.auth.signUp({
  email,
  password,
  options: {
    data: { first_name: firstName, last_name: lastName }
  }
});
```

### After (New API):
```typescript
import { authApi } from '@/utils/api-client';

const data = await authApi.signUp(email, password, firstName, lastName);
```

## Step 3: Update Database Queries

### Before (Supabase):
```typescript
const { data, error } = await supabase
  .from('coaching_sessions')
  .select('*')
  .eq('user_id', userId);
```

### After (New API):
```typescript
import { coachingApi } from '@/utils/api-client';

const sessions = await coachingApi.getSessions();
```

## Step 4: Update Edge Function Calls

### Before (Supabase):
```typescript
const { data, error } = await supabase.functions.invoke('coaching-stream', {
  body: { messages, systemPrompt }
});
```

### After (New API):
```typescript
import { aiApi } from '@/utils/api-client';

await aiApi.coachingStream(
  messages,
  systemPrompt,
  (chunk) => console.log(chunk),
  (data) => console.log('Complete', data),
  (error) => console.error(error)
);
```

## Step 5: Update Auth Context

The `AuthContext` needs to be updated to use the new API. See the example below.

## Step 6: Update All Supabase Client Imports

Search for all files importing from `@/integrations/supabase/client` and replace with `@/utils/api-client`.

## Common Patterns

### Getting Current User
```typescript
// Before
const { data: { user } } = await supabase.auth.getUser();

// After
const { user } = await authApi.getCurrentUser();
```

### Checking Session
```typescript
// Before
const { data: { session } } = await supabase.auth.getSession();

// After
const token = localStorage.getItem('supabase-auth');
const session = token ? JSON.parse(token) : null;
```

### Database Inserts
```typescript
// Before
await supabase.from('emails').insert({ subject, recipient, content });

// After
await emailsApi.create({ subject, recipient, content });
```

### Database Updates
```typescript
// Before
await supabase.from('emails').update({ content }).eq('id', id);

// After
await emailsApi.update(id, { content });
```

### Database Deletes
```typescript
// Before
await supabase.from('emails').delete().eq('id', id);

// After
await emailsApi.delete(id);
```

## Files to Update

1. `src/contexts/AuthContext.tsx` - Update authentication logic
2. `src/pages/Auth.tsx` - Update signup/signin
3. `src/pages/Dashboard.tsx` - Update data fetching
4. `src/utils/ai-assistant.ts` - Update AI function calls
5. All pages that use `supabase.from()` - Replace with API client calls
6. All components using Supabase auth - Replace with API client

## Testing

1. Start the backend: `cd lwh-ai-coaching-backend-app && npm run dev`
2. Start the frontend: `cd lwh-ai-coaching-app && npm run dev`
3. Test authentication flow
4. Test data fetching
5. Test AI functions
6. Test Stripe integration

## Troubleshooting

### CORS Errors
Make sure `CORS_ORIGIN` in backend `.env` matches your frontend URL.

### Authentication Errors
Check that JWT token is being stored and sent correctly in Authorization header.

### Database Errors
Ensure database migrations have been run: `npm run migrate`

### API Connection Errors
Verify `VITE_API_URL` is set correctly and backend is running.

