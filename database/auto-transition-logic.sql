-- Automatic Transition from Trial to Free Plan
-- This SQL implements the logic to automatically move users to free plan when they reach 100 scans

-- Create function to check and handle trial-to-free transition
CREATE OR REPLACE FUNCTION check_trial_to_free_transition(user_google_id TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    user_record RECORD;
    subscription_record RECORD;
    free_subscription_record RECORD;
    total_scans INTEGER;
    now_timestamp TIMESTAMP WITH TIME ZONE;
    trial_end_date TIMESTAMP WITH TIME ZONE;
BEGIN
    now_timestamp := NOW();
    
    -- Get user record
    SELECT * INTO user_record FROM users WHERE google_id = user_google_id;
    
    IF user_record IS NULL THEN
        RAISE EXCEPTION 'User not found';
    END IF;
    
    -- Only process if user is still on trial plan
    IF user_record.current_plan != 'trial' THEN
        RETURN FALSE; -- Already moved to free plan or other plan
    END IF;
    
    -- Get latest subscription record for trial
    SELECT * INTO subscription_record FROM user_subscriptions 
    WHERE user_id = user_record.id 
    AND plan_type = 'trial'
    ORDER BY created_at DESC 
    LIMIT 1;
    
    -- Count total scans from usage_logs
    SELECT COUNT(*) INTO total_scans FROM usage_logs 
    WHERE user_id = user_record.id;
    
    -- Calculate trial end date (7 days from trial start)
    trial_end_date := user_record.trial_start_date + INTERVAL '7 days';
    
    -- Check if user has reached 100 scans OR 7 days have passed
    IF total_scans >= 100 OR (trial_end_date <= now_timestamp) THEN
        -- Move user to free plan (unlimited - no scan limits)
        UPDATE users 
        SET 
            current_plan = 'free',
            plan_start_date = now_timestamp,
            is_trial_active = false,
            updated_at = now_timestamp
        WHERE google_id = user_google_id;
        
        -- Create or update free plan subscription (unlimited - no end date, no scan limits)
        SELECT * INTO free_subscription_record FROM user_subscriptions
        WHERE user_id = user_record.id AND plan_type = 'free'
        ORDER BY created_at DESC
        LIMIT 1;

        IF free_subscription_record IS NULL THEN
        INSERT INTO user_subscriptions (user_id, plan_type, status, start_date, end_date, scans_included, scans_used, monthly_reset_date)
        VALUES (
            user_record.id,
            'free',
            'active',
            now_timestamp,
                NULL, -- Free plan is forever, no end date
                -1, -- -1 indicates unlimited scans
                0,
                NULL -- No monthly reset needed for unlimited plan
            );
        ELSE
            UPDATE user_subscriptions
            SET status = 'active',
                start_date = now_timestamp,
                end_date = NULL,
                scans_included = -1,
                scans_used = 0,
                monthly_reset_date = NULL,
                updated_at = now_timestamp
            WHERE id = free_subscription_record.id;
        END IF;
        
        -- Update trial subscription status to expired
        UPDATE user_subscriptions 
        SET status = 'expired', updated_at = now_timestamp
        WHERE user_id = user_record.id AND plan_type = 'trial';
        
        IF total_scans >= 100 THEN
        RAISE NOTICE 'User % automatically moved to free plan after reaching % scans', user_google_id, total_scans;
        ELSE
            RAISE NOTICE 'User % automatically moved to free plan after 7-day trial expired', user_google_id;
        END IF;
        RETURN TRUE;
    END IF;
    
    RETURN FALSE; -- No transition needed
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Force move user to free plan regardless of current usage (used when user explicitly selects free plan)
CREATE OR REPLACE FUNCTION force_move_user_to_free_plan(user_google_id TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    user_record RECORD;
    free_subscription_record RECORD;
    now_timestamp TIMESTAMP WITH TIME ZONE := NOW();
BEGIN
    -- Get user record
    SELECT * INTO user_record FROM users WHERE google_id = user_google_id;

    IF user_record IS NULL THEN
        RAISE EXCEPTION 'User not found';
    END IF;

    -- If already on free plan, ensure subscription is active and exit
    IF user_record.current_plan = 'free' THEN
        SELECT * INTO free_subscription_record FROM user_subscriptions
        WHERE user_id = user_record.id AND plan_type = 'free'
        ORDER BY created_at DESC
        LIMIT 1;

        IF free_subscription_record IS NOT NULL THEN
            UPDATE user_subscriptions
            SET status = 'active',
                start_date = now_timestamp,
                end_date = NULL,
                scans_included = -1,
                scans_used = 0,
                monthly_reset_date = NULL,
                updated_at = now_timestamp
            WHERE id = free_subscription_record.id;
        END IF;

        RETURN FALSE;
    END IF;

    -- Move user to free plan
    UPDATE users
    SET current_plan = 'free',
        plan_start_date = now_timestamp,
        is_trial_active = false,
        updated_at = now_timestamp
    WHERE google_id = user_google_id;

    -- Create or update free subscription entry
    SELECT * INTO free_subscription_record FROM user_subscriptions
    WHERE user_id = user_record.id AND plan_type = 'free'
    ORDER BY created_at DESC
    LIMIT 1;

    IF free_subscription_record IS NULL THEN
        INSERT INTO user_subscriptions (user_id, plan_type, status, start_date, end_date, scans_included, scans_used, monthly_reset_date)
        VALUES (
            user_record.id,
            'free',
            'active',
            now_timestamp,
            NULL,
            -1,
            0,
            NULL
        );
    ELSE
        UPDATE user_subscriptions
        SET status = 'active',
            start_date = now_timestamp,
            end_date = NULL,
            scans_included = -1,
            scans_used = 0,
            monthly_reset_date = NULL,
            updated_at = now_timestamp
        WHERE id = free_subscription_record.id;
    END IF;

    -- Expire any active trial subscription
    UPDATE user_subscriptions
    SET status = 'expired', updated_at = now_timestamp
    WHERE user_id = user_record.id AND plan_type = 'trial';

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Insert pro upgrade request safely for users (handles NULL user_id / RLS)
CREATE OR REPLACE FUNCTION insert_pro_upgrade_request(
    p_user_email TEXT,
    p_user_name TEXT,
    p_current_plan TEXT DEFAULT 'free',
    p_scans_used INTEGER DEFAULT 0,
    p_scans_limit INTEGER DEFAULT -1,
    p_trial_days_remaining INTEGER DEFAULT 0
)
RETURNS UUID AS $$
DECLARE
    v_user_id UUID;
    v_request_id UUID;
BEGIN
    -- Try to find auth user by email
    SELECT id INTO v_user_id
    FROM auth.users
    WHERE email = p_user_email
    LIMIT 1;

    INSERT INTO pro_upgrade_requests (
        user_id,
        user_email,
        user_name,
        current_plan,
        scans_used,
        scans_limit,
        trial_days_remaining,
        status
    ) VALUES (
        v_user_id,
        p_user_email,
        p_user_name,
        COALESCE(p_current_plan, 'free'),
        COALESCE(p_scans_used, 0),
        COALESCE(p_scans_limit, -1),
        COALESCE(p_trial_days_remaining, 0),
        'pending'
    ) RETURNING id INTO v_request_id;

    RETURN v_request_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get user plan info with auto-transition check
CREATE OR REPLACE FUNCTION get_user_plan_info_with_transition(user_google_id TEXT)
RETURNS TABLE (
    current_plan TEXT,
    trial_days_remaining INTEGER,
    scans_remaining INTEGER,
    scans_used INTEGER,
    scans_limit INTEGER,
    plan_start_date TIMESTAMP WITH TIME ZONE,
    monthly_reset_date TIMESTAMP WITH TIME ZONE,
    was_transitioned BOOLEAN
) AS $$
DECLARE
    user_record RECORD;
    subscription_record RECORD;
    trial_end_date TIMESTAMP WITH TIME ZONE;
    now_timestamp TIMESTAMP WITH TIME ZONE;
    transition_occurred BOOLEAN := FALSE;
    total_user_scans INTEGER := 0;
BEGIN
    now_timestamp := NOW();
    
    -- Check and perform auto-transition if needed
    SELECT check_trial_to_free_transition(user_google_id) INTO transition_occurred;
    
    -- Get updated user record
    SELECT * INTO user_record FROM users u WHERE u.google_id = user_google_id;
    
    IF user_record IS NULL THEN
        RAISE EXCEPTION 'User not found';
    END IF;
    
    -- Get latest subscription record
    SELECT * INTO subscription_record FROM user_subscriptions s
    WHERE s.user_id = user_record.id 
    ORDER BY s.created_at DESC 
    LIMIT 1;
    
    -- Calculate trial end date
    trial_end_date := user_record.trial_start_date + INTERVAL '7 days';
    
    -- Return plan info based on current plan
    IF user_record.current_plan = 'trial' AND trial_end_date > now_timestamp THEN
        -- Still in trial
        RETURN QUERY SELECT
            'trial'::TEXT,
            GREATEST(0, EXTRACT(days FROM trial_end_date - now_timestamp))::INTEGER,
            GREATEST(0, 100 - COALESCE(subscription_record.scans_used, 0))::INTEGER,
            COALESCE(subscription_record.scans_used, 0)::INTEGER,
            100::INTEGER,
            user_record.trial_start_date,
            trial_end_date,
            transition_occurred;
    ELSIF user_record.current_plan = 'free' THEN
        -- Free plan (FOREVER - unlimited scans)
        -- Count scans from usage_logs for display purposes only
        SELECT COUNT(*) INTO total_user_scans 
        FROM usage_logs 
        WHERE user_id = user_record.id;
        
        RETURN QUERY SELECT
            'free'::TEXT,
            0::INTEGER,
            -1::INTEGER,  -- -1 indicates unlimited scans remaining
            total_user_scans::INTEGER,  -- Total scans for display
            -1::INTEGER,  -- -1 indicates unlimited scans limit
            user_record.plan_start_date,
            NULL::TIMESTAMP WITH TIME ZONE, -- Free plan forever, no monthly reset
            transition_occurred;
    ELSE
        -- Pro/Enterprise plan
        RETURN QUERY SELECT
            user_record.current_plan,
            0::INTEGER,
            GREATEST(0, COALESCE(subscription_record.scans_included, 1000) - COALESCE(subscription_record.scans_used, 0))::INTEGER,
            COALESCE(subscription_record.scans_used, 0)::INTEGER,
            COALESCE(subscription_record.scans_included, 1000)::INTEGER,
            user_record.plan_start_date,
            COALESCE(subscription_record.monthly_reset_date, user_record.plan_start_date + INTERVAL '1 month'),
            transition_occurred;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to record scan with auto-transition
CREATE OR REPLACE FUNCTION record_scan_with_auto_transition(user_google_id TEXT, scan_type TEXT, page_url TEXT, elements_scanned INTEGER)
RETURNS TABLE (
    scan_recorded BOOLEAN,
    was_transitioned BOOLEAN,
    current_plan TEXT,
    scans_used INTEGER,
    scans_limit INTEGER
) AS $$
DECLARE
    user_record RECORD;
    subscription_record RECORD;
    now_timestamp TIMESTAMP WITH TIME ZONE;
    can_scan BOOLEAN := false;
    transition_occurred BOOLEAN := FALSE;
    total_scans INTEGER;
    trial_end_date_check TIMESTAMP WITH TIME ZONE;
BEGIN
    now_timestamp := NOW();
    
    -- Get user record
    SELECT * INTO user_record FROM users u WHERE u.google_id = user_google_id;
    
    IF user_record IS NULL THEN
        RAISE EXCEPTION 'User not found';
    END IF;
    
    -- Count current scans
    SELECT COUNT(*) INTO total_scans FROM usage_logs l
    WHERE l.user_id = user_record.id;
    
    -- Check if this scan would trigger transition (100th scan OR 7 days expired)
    IF user_record.current_plan = 'trial' THEN
        trial_end_date_check := user_record.trial_start_date + INTERVAL '7 days';
        
        -- Check if trial expired or will hit 100 scans
        IF total_scans >= 99 OR (trial_end_date_check <= now_timestamp) THEN
        -- This scan will trigger transition to free plan
        SELECT check_trial_to_free_transition(user_google_id) INTO transition_occurred;
        
        -- Refresh user record after potential transition
        SELECT * INTO user_record FROM users u WHERE u.google_id = user_google_id;
        END IF;
    END IF;
    
    -- Check if user can scan based on their current plan
    IF user_record.current_plan = 'trial' THEN
        -- Trial plan - check if trial is still active and under limit
        trial_end_date_check := user_record.trial_start_date + INTERVAL '7 days';
        IF trial_end_date_check > now_timestamp AND total_scans < 100 THEN
            can_scan := true;
        END IF;
    ELSIF user_record.current_plan = 'free' THEN
        -- Free plan - unlimited scans, always allow
            can_scan := true;
    ELSE
        -- Pro/Enterprise plan - check subscription limits
        SELECT * INTO subscription_record FROM user_subscriptions s
        WHERE s.user_id = user_record.id 
        ORDER BY s.created_at DESC 
        LIMIT 1;
        
        IF subscription_record.scans_used < subscription_record.scans_included THEN
            can_scan := true;
        END IF;
    END IF;
    
    IF can_scan THEN
        -- Record the scan
        INSERT INTO usage_logs (user_id, scan_type, page_url, elements_scanned)
        VALUES (user_record.id, scan_type, page_url, elements_scanned);
        
        -- Update scan counts (only for non-free plans, free plan is unlimited)
        IF user_record.current_plan != 'free' THEN
            UPDATE user_subscriptions s
            SET scans_used = s.scans_used + 1
            WHERE s.user_id = user_record.id
            AND s.id = (
                SELECT s2.id FROM user_subscriptions s2
                WHERE s2.user_id = user_record.id
                ORDER BY s2.created_at DESC
                LIMIT 1
            );
        END IF;
        
        -- Get updated counts
        SELECT * INTO user_record FROM users u WHERE u.google_id = user_google_id;
        
        -- Count total scans for return value
        SELECT COUNT(*) INTO total_scans FROM usage_logs l
        WHERE l.user_id = user_record.id;
        
        IF user_record.current_plan = 'free' THEN
            -- Free plan: unlimited (-1)
            RETURN QUERY SELECT TRUE, transition_occurred, 'free'::TEXT, total_scans::INTEGER, -1::INTEGER;
        ELSE
            SELECT s.scans_used, s.scans_included INTO subscription_record FROM user_subscriptions s
            WHERE s.user_id = (SELECT u.id FROM users u WHERE u.google_id = user_google_id)
            ORDER BY s.created_at DESC LIMIT 1;
            RETURN QUERY SELECT TRUE, transition_occurred, (SELECT u.current_plan FROM users u WHERE u.google_id = user_google_id), subscription_record.scans_used, subscription_record.scans_included;
        END IF;
    ELSE
        -- Cannot scan
        SELECT COUNT(*) INTO total_scans FROM usage_logs l
        WHERE l.user_id = user_record.id;
        
        RETURN QUERY SELECT FALSE, transition_occurred, user_record.current_plan, 
            total_scans::INTEGER,
            CASE WHEN user_record.current_plan = 'trial' THEN 100 ELSE -1 END::INTEGER;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION check_trial_to_free_transition(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION get_user_plan_info_with_transition(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION record_scan_with_auto_transition(TEXT, TEXT, TEXT, INTEGER) TO anon;
GRANT EXECUTE ON FUNCTION force_move_user_to_free_plan(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION insert_pro_upgrade_request(TEXT, TEXT, TEXT, INTEGER, INTEGER, INTEGER) TO anon;
