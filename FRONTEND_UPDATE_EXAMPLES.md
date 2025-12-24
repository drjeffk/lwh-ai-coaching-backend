# Frontend Update Examples

This document shows specific examples of how to update frontend code to use the new Node.js backend API.

## 1. AuthProvider Updates

### Key Changes Needed:

Replace Supabase auth calls with API client:

```typescript
// OLD: src/contexts/auth/AuthProvider.tsx
import { supabase } from '@/integrations/supabase/client';

const { data, error } = await supabase.auth.getSession();

// NEW:
import { authApi, subscriptionsApi } from '@/utils/api-client';

// Get current user
const { user } = await authApi.getCurrentUser();

// Check subscription
const subscription = await subscriptionsApi.get();
```

### Updated signIn function:

```typescript
// OLD:
const { data, error } = await supabase.auth.signInWithPassword({
  email,
  password
});

// NEW:
const data = await authApi.signIn(email, password);
// data contains: { user, token, session }
```

### Updated signUp function:

```typescript
// OLD:
const { data, error } = await supabase.auth.signUp({
  email,
  password,
  options: {
    data: { first_name: firstName, last_name: lastName, is_admin: isAdmin }
  }
});

// NEW:
const data = await authApi.signUp(email, password, firstName, lastName, isAdmin);
```

### Updated signOut function:

```typescript
// OLD:
await supabase.auth.signOut();

// NEW:
authApi.signOut();
```

### Updated subscription check:

```typescript
// OLD:
const { data } = await supabase.functions.invoke('get-subscription');

// NEW:
const subscription = await subscriptionsApi.get();
// subscription contains: { status, plan, current_period_end, ... }
```

## 2. Database Query Updates

### Coaching Sessions:

```typescript
// OLD:
const { data, error } = await supabase
  .from('coaching_sessions')
  .select('*')
  .eq('user_id', userId)
  .order('created_at', { ascending: false });

// NEW:
import { coachingApi } from '@/utils/api-client';
const sessions = await coachingApi.getSessions();
```

### Emails:

```typescript
// OLD:
const { data, error } = await supabase
  .from('emails')
  .insert({ subject, recipient, content, type })
  .select()
  .single();

// NEW:
import { emailsApi } from '@/utils/api-client';
const email = await emailsApi.create({ subject, recipient, content, type });
```

### Profiles:

```typescript
// OLD:
const { data, error } = await supabase
  .from('profiles')
  .select('*')
  .eq('id', userId)
  .single();

// NEW:
import { profilesApi } from '@/utils/api-client';
const profile = await profilesApi.get(userId);
```

## 3. AI Function Updates

### Coaching Stream:

```typescript
// OLD:
const { data, error } = await supabase.functions.invoke('coaching-stream', {
  body: { messages, systemPrompt }
});

// NEW:
import { aiApi } from '@/utils/api-client';

await aiApi.coachingStream(
  messages,
  systemPrompt,
  (chunk) => {
    // Handle streaming chunk
    setResponse(prev => prev + chunk);
  },
  (data) => {
    // Handle completion
    console.log('Complete:', data);
  },
  (error) => {
    // Handle error
    console.error('Error:', error);
  }
);
```

### OpenAI Completion:

```typescript
// OLD:
const { data, error } = await supabase.functions.invoke('openai-completion', {
  body: { messages, model, temperature, max_tokens }
});

// NEW:
import { aiApi } from '@/utils/api-client';
const { completion } = await aiApi.openaiCompletion(messages, model, temperature, max_tokens);
```

## 4. Usage Limits Updates

```typescript
// OLD:
const { data, error } = await supabase
  .from('users_limits')
  .select('*')
  .eq('id', userId)
  .single();

// NEW:
import { usageLimitsApi } from '@/utils/api-client';
const limits = await usageLimitsApi.get();

// Increment usage
await usageLimitsApi.increment('email'); // or 'coaching' or 'difficult_conversation'
```

## 5. Stripe Updates

### Create Checkout:

```typescript
// OLD:
const { data, error } = await supabase.functions.invoke('create-checkout', {
  body: { priceId, userId, userEmail }
});

// NEW:
import { stripeApi } from '@/utils/api-client';
const { sessionId, url } = await stripeApi.createCheckout(priceId, userId, userEmail);
window.location.href = url;
```

### Customer Portal:

```typescript
// OLD:
const { data, error } = await supabase.functions.invoke('customer-portal', {
  body: { customerId }
});

// NEW:
import { stripeApi } from '@/utils/api-client';
const { url } = await stripeApi.getCustomerPortal(customerId);
window.location.href = url;
```

## 6. Session Management

The new API uses JWT tokens stored in localStorage. The token is automatically included in API requests via the `Authorization` header.

```typescript
// Token is stored automatically after signIn/signUp
// No manual token management needed

// To check if user is authenticated:
const token = localStorage.getItem('supabase-auth');
const isAuthenticated = !!token;
```

## 7. Error Handling

The new API client throws errors that need to be caught:

```typescript
// OLD:
const { data, error } = await supabase.from('emails').select('*');
if (error) {
  console.error(error);
}

// NEW:
try {
  const emails = await emailsApi.getAll();
} catch (error) {
  console.error(error.message);
}
```

## 8. Type Updates

You may need to update TypeScript types. The API returns the same data structures, but you might need to adjust:

```typescript
// User type (similar to Supabase User but simplified)
interface User {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  full_name?: string;
  is_admin?: boolean;
}

// Session type
interface Session {
  access_token: string;
  token_type: 'bearer';
  expires_in: number;
}
```

## Migration Checklist

- [ ] Update `src/contexts/auth/AuthProvider.tsx`
- [ ] Update `src/pages/Auth.tsx`
- [ ] Update `src/pages/Dashboard.tsx`
- [ ] Update `src/utils/ai-assistant.ts`
- [ ] Update all pages using `supabase.from()`
- [ ] Update all components using `supabase.auth`
- [ ] Update all edge function calls
- [ ] Update environment variables
- [ ] Test authentication flow
- [ ] Test data fetching
- [ ] Test AI functions
- [ ] Test Stripe integration

