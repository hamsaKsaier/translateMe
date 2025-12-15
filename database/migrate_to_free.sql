-- Migration Script: Move All Users to Free Plan
-- This script updates all existing users from trial to free plan
-- Run this script in your Supabase SQL editor after deploying the free model changes

-- Step 1: Update all users to free plan
UPDATE users 
SET 
    current_plan = 'free',
    plan_start_date = COALESCE(plan_start_date, trial_start_date, NOW()),
    is_trial_active = false,
    updated_at = NOW()
WHERE current_plan = 'trial' OR current_plan IS NULL;

-- Step 2: Update or create free plan subscriptions for all users
-- First, expire all trial subscriptions
UPDATE user_subscriptions
SET 
    status = 'expired',
    updated_at = NOW()
WHERE plan_type = 'trial' AND status = 'active';

-- Step 3: Create or update free plan subscriptions for all users
-- This uses a PostgreSQL upsert (INSERT ... ON CONFLICT)
INSERT INTO user_subscriptions (user_id, plan_type, status, start_date, end_date, scans_included, scans_used, monthly_reset_date, created_at, updated_at)
SELECT 
    u.id,
    'free',
    'active',
    COALESCE(u.plan_start_date, u.trial_start_date, NOW()),
    NULL, -- Free plan is forever, no end date
    -1,   -- -1 indicates unlimited scans
    0,    -- Reset scans used
    NULL, -- No monthly reset needed for unlimited plan
    NOW(),
    NOW()
FROM users u
WHERE u.current_plan = 'free'
  AND NOT EXISTS (
      SELECT 1 
      FROM user_subscriptions us 
      WHERE us.user_id = u.id 
        AND us.plan_type = 'free' 
        AND us.status = 'active'
  )
ON CONFLICT DO NOTHING;

-- Step 4: Update existing free plan subscriptions to ensure they're unlimited
UPDATE user_subscriptions
SET 
    scans_included = -1,  -- Unlimited
    end_date = NULL,      -- No end date
    monthly_reset_date = NULL, -- No monthly reset
    updated_at = NOW()
WHERE plan_type = 'free' 
  AND status = 'active'
  AND (scans_included != -1 OR end_date IS NOT NULL OR monthly_reset_date IS NOT NULL);

-- Verification queries (run these to check the migration)
-- Count users by plan
SELECT current_plan, COUNT(*) as user_count
FROM users
GROUP BY current_plan;

-- Count active subscriptions by plan type
SELECT plan_type, status, COUNT(*) as subscription_count
FROM user_subscriptions
GROUP BY plan_type, status
ORDER BY plan_type, status;

-- Check for any users still on trial
SELECT id, email, current_plan, is_trial_active
FROM users
WHERE current_plan = 'trial' OR is_trial_active = true;

