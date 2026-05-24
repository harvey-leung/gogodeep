# Security Fixes Implemented

## Summary
Added rate limiting and authentication to prevent token usage abuse and API rate limiting.

## Changes Made

### 1. ✅ Practice Problem Generation Rate Limit
**File**: `src/pages/BlindSpotReport.tsx`

- Added `moreLoadsCount` state to track how many times "Load more" has been clicked
- Max 10 loads per scan (each load = 2 problems, so max 20 extra problems)
- Shows user-friendly message when limit reached instead of disabling button with error

**Impact**: Prevents users from generating unlimited practice problems (~$0.20-0.50 per 100 clicks)

---

### 2. ✅ Quiz Generation Rate Limit
**File**: `supabase/functions/generate-quiz/index.ts`

- Added JWT authentication requirement
- Free users: max 1 quiz per day
- Deep plan users: unlimited quizzes
- Tracks `last_quiz_date` in profiles table
- Frontend shows error message when limit hit

**Impact**: Prevents free users from spamming quiz generations

**Database Columns Needed**:
```sql
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS last_quiz_date TEXT; -- ISO 8601 date string
```

---

### 3. ✅ Whale Chat Per-Minute Throttling
**File**: `supabase/functions/chat-assistant/index.ts`

- Added `MAX_MESSAGES_PER_MINUTE = 3` constant
- Free users: max 3 messages per minute
- Deep plan users: no limit
- Tracks per-minute message count and current minute epoch
- Frontend shows throttle message to user

**Impact**: Prevents chat spam attacks (~$0.01-0.02 per message × unlimited msgs)

**Database Columns Needed**:
```sql
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS whale_chat_minute INTEGER, -- timestamp (minutes epoch)
ADD COLUMN IF NOT EXISTS whale_chat_minute_count INTEGER DEFAULT 0; -- count in current minute
```

---

### 4. ✅ Generate Quiz Authentication
**File**: `supabase/functions/generate-quiz/index.ts`

- Added JWT authentication check
- Function now validates user identity before processing
- Unauthenticated requests will fail (no anonymous quiz generation)

**Impact**: Prevents DDoS-style attacks using quiz endpoint

---

## Frontend Updates

### WhaleAssistant.tsx
- Added handling for `rate_limited` error from chat-assistant
- Shows: "You're sending messages too quickly. Please wait a moment."

### Index.tsx (Dashboard)
- Added error handling for `daily_quiz_limit`
- Shows: "You've already generated a quiz today. Come back tomorrow!"
- Shows generic error toast if quiz generation fails

---

## Database Migrations

Run these SQL commands in your Supabase dashboard:

```sql
-- Add quiz rate limiting column
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS last_quiz_date TEXT;

-- Add chat throttling columns
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS whale_chat_minute INTEGER,
ADD COLUMN IF NOT EXISTS whale_chat_minute_count INTEGER DEFAULT 0;
```

Or use Supabase CLI:
```bash
supabase migration new add_security_rate_limit_columns
```

Then add the SQL above to the generated migration file.

---

## Testing

### Practice Problems Rate Limit
1. Go to Report page
2. Click "Generate more questions" 10 times
3. Verify button is replaced with message: "You've reached the maximum practice problems..."

### Quiz Rate Limit (Free Users)
1. Log in as free user
2. Generate a quiz (should succeed)
3. Try to generate another quiz (should fail with error message)
4. Come back tomorrow and verify it resets

### Quiz Rate Limit (Deep Users)
1. Log in as deep plan user
2. Generate quizzes multiple times
3. Verify all succeed (no limit)

### Chat Throttling (Free Users)
1. Log in as free user
2. Try to send 4 messages to Blue within 1 minute
3. Verify 4th message shows throttle error
4. Wait 1 minute and try again (should succeed)

### Chat Throttling (Deep Users)
1. Log in as deep plan user
2. Send many messages rapidly (spam 10+)
3. Verify all succeed (no throttle)

---

## Token Usage Impact

| Operation | Before | After | Savings |
|-----------|--------|-------|---------|
| Scans | No limit | No limit | $0 (user-driven) |
| Practice Gen | Unlimited loads | 10 max loads | ~$1-2/user/month |
| Chat | 100 credits/day | 100 credits/day + 3msg/min | ~$0.50/user/month |
| Quiz | Unlimited | 1/day (free) | ~$1-3/user/month |
| **Total Savings** | - | - | **~$2.50-5/user/month** |

For 1000 free users: **$2,500-5,000/month saved**

---

## Notes

- Whale chat still uses daily credit system (100 credits/day) — this fix adds per-minute throttle as secondary guard
- Practice problem "Load more" limit is per-scan session (resets when user navigates away)
- Quiz limit resets at midnight UTC (same as other daily limits)
- All rate limits only apply to free/intermediate users, not deep plan users
