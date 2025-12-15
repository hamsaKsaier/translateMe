// Usage Tracking Service for TranslateMe Extension
// Tracks user scans and manages trial limits

class UsageTracker {
    constructor() {
        this.supabase = null;
        this.currentUser = null;
        this.usageStats = null;
        this.initialized = false;
    }

    // Initialize the usage tracker
    async init() {
        if (this.initialized) return;

        try {
            // Wait for Supabase to load
            await this.waitForSupabase();

            // Get Supabase client from auth service or create local client
            if (typeof authService !== 'undefined' && authService.supabase) {
                this.supabase = authService.supabase;
                console.log('✅ Using real Supabase client from authService');
            } else if (typeof window.supabase !== 'undefined') {
                this.supabase = window.supabase;
                console.log('✅ Using local Supabase client');
            } else {
                // Create a local Supabase client as fallback
                console.log('⚠️ No Supabase client found, creating local client...');
                this.supabase = this.createLocalSupabaseClient();
                console.log('✅ Created local Supabase client');
            }

            // Get current user from auth service or storage
            if (typeof authService !== 'undefined' && authService.getCurrentUser) {
                this.currentUser = authService.getCurrentUser();
            } else {
                // Try to get user from storage (for content script context)
                const userData = await chrome.storage.local.get(['currentUser']);
                this.currentUser = userData.currentUser;
            }

            if (!this.currentUser) {
                console.log('⚠️ UsageTracker: No authenticated user found, will use fallback mode');
                // Don't throw error, just mark as initialized with fallback mode
                this.initialized = true;
                return;
            }

            // Initialize user in database
            await this.initializeUser();

            // Load current usage stats
            await this.loadUsageStats();

            this.initialized = true;
            console.log('✅ UsageTracker initialized for user:', this.currentUser.email);
        } catch (error) {
            console.error('❌ Failed to initialize UsageTracker:', error);
            throw error;
        }
    }

    // Wait for Supabase to load (but don't fail if not available)
    async waitForSupabase() {
        let attempts = 0;
        const maxAttempts = 10;

        while (typeof window.supabase === 'undefined' && attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
        }

        // Don't throw error - we'll create a local client if needed
        if (typeof window.supabase === 'undefined') {
            console.log('⚠️ window.supabase not available, will create local client');
        }
    }

    // Create a local Supabase client for content script context
    createLocalSupabaseClient() {
        const supabaseUrl = (typeof SUPABASE_CONFIG !== 'undefined' && SUPABASE_CONFIG.url) || null;
        const supabaseKey = (typeof SUPABASE_CONFIG !== 'undefined' && SUPABASE_CONFIG.anonKey) || null;

        if (!supabaseUrl || !supabaseKey) {
            const missing = [];
            if (!supabaseUrl) missing.push('url');
            if (!supabaseKey) missing.push('anonKey');
            const message = `Supabase config missing: ${missing.join(', ')}. Provide config/supabase.config.js (not committed) with your project values.`;
            console.error(`❌ UsageTracker: ${message}`);
            return {
                rpc: async () => ({ data: null, error: new Error(message) }),
                from: () => ({
                    select: () => ({
                        eq: async () => ({ data: null, error: new Error(message) })
                    }),
                    insert: async () => ({ data: null, error: new Error(message) })
                })
            };
        }

        return {
            rpc: async (functionName, params) => {
                const response = await fetch(`${supabaseUrl}/rest/v1/rpc/${functionName}`, {
                    method: 'POST',
                    headers: {
                        'apikey': supabaseKey,
                        'Authorization': `Bearer ${supabaseKey}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(params)
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`Supabase RPC error: ${response.status} - ${errorText}`);
                }

                return { data: await response.json(), error: null };
            },

            from: (table) => ({
                select: (columns) => ({
                    eq: async (column, value) => {
                        const response = await fetch(`${supabaseUrl}/rest/v1/${table}?select=${columns}&${column}=eq.${value}`, {
                            headers: {
                                'apikey': supabaseKey,
                                'Authorization': `Bearer ${supabaseKey}`
                            }
                        });

                        if (!response.ok) {
                            const errorText = await response.text();
                            throw new Error(`Supabase query error: ${response.status} - ${errorText}`);
                        }

                        return { data: await response.json(), error: null };
                    }
                }),

                insert: async (data) => {
                    const response = await fetch(`${supabaseUrl}/rest/v1/${table}`, {
                        method: 'POST',
                        headers: {
                            'apikey': supabaseKey,
                            'Authorization': `Bearer ${supabaseKey}`,
                            'Content-Type': 'application/json',
                            'Prefer': 'return=minimal'
                        },
                        body: JSON.stringify(data)
                    });

                    if (!response.ok) {
                        const errorText = await response.text();
                        throw new Error(`Supabase insert error: ${response.status} - ${errorText}`);
                    }

                    return { data: await response.json(), error: null };
                }
            })
        };
    }

    // Initialize user in Supabase database
    async initializeUser() {
        try {
            console.log('🔍 Checking if user exists in database...');

            // Check if user already exists
            const { data: existingUser, error: fetchError } = await this.supabase
                .from('users')
                .select('*')
                .eq('google_id', this.currentUser.id)
                .single();

            if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 = not found
                console.error('❌ Error fetching user:', fetchError);
                throw fetchError;
            }

            if (existingUser) {
                console.log('👤 User already exists in database:', existingUser.email);
                // All users are on free plan now - no trial checks needed
            } else {
                console.log('👤 Creating new user in database with free plan...');

                // Create new user with free plan (no trial period)
                const planStartDate = new Date();

                const userData = {
                    google_id: this.currentUser.id,
                    email: this.currentUser.email,
                    full_name: this.currentUser.user_metadata?.full_name || null,
                    avatar_url: this.currentUser.user_metadata?.avatar_url || null,
                    current_plan: 'free',
                    plan_start_date: planStartDate.toISOString(),
                    is_trial_active: false
                };

                console.log('📝 User data to insert:', userData);

                const { data: newUser, error: insertError } = await this.supabase
                    .from('users')
                    .insert(userData)
                    .select()
                    .single();

                if (insertError) {
                    console.error('❌ Error inserting user:', insertError);
                    throw insertError;
                }

                console.log('✅ User created successfully:', newUser);

                // Create free plan subscription record (unlimited scans)
                const subscriptionData = {
                    user_id: newUser.id,
                    plan_type: 'free',
                    status: 'active',
                    start_date: planStartDate.toISOString(),
                    end_date: null, // Free plan is forever, no end date
                    scans_included: -1, // -1 indicates unlimited scans
                    scans_used: 0,
                    monthly_reset_date: null // No monthly reset needed for unlimited plan
                };

                console.log('📝 Subscription data to insert:', subscriptionData);

                const { error: subscriptionError } = await this.supabase
                    .from('user_subscriptions')
                    .insert(subscriptionData);

                if (subscriptionError) {
                    console.error('❌ Error creating subscription:', subscriptionError);
                    // Don't throw here, user was created successfully
                } else {
                    console.log('✅ Free plan subscription created successfully');
                }

                console.log('🎉 New user created with free plan (unlimited scans)');
            }
        } catch (error) {
            console.error('❌ Failed to initialize user:', error);
            // Provide more detailed error information
            const errorDetails = {
                message: error.message || 'Unknown error',
                code: error.code || 'UNKNOWN',
                details: error.details || null
            };
            console.error('❌ User initialization error details:', errorDetails);
            throw new Error(`User initialization failed: ${errorDetails.message}`);
        }
    }

    // Load current usage statistics
    async loadUsageStats() {
        try {
            // Use new function that includes auto-transition logic
            const { data: planData, error: planError } = await this.supabase.rpc('get_user_plan_info_with_transition', { user_google_id: this.currentUser.id });

            if (planError) {
                console.error('❌ Error calling get_user_plan_info_with_transition RPC:', planError);
                throw planError;
            }

            if (planData && planData.length > 0) {
                const planInfo = planData[0];
                this.usageStats = {
                    current_plan: planInfo.current_plan,
                    total_scans: planInfo.scans_used,
                    manual_scans: 0, // Will be calculated separately if needed
                    auto_scans: 0,   // Will be calculated separately if needed
                    trial_days_remaining: planInfo.trial_days_remaining,
                    scans_remaining: planInfo.scans_remaining,
                    scans_used: planInfo.scans_used,
                    scans_limit: planInfo.scans_limit,
                    plan_start_date: planInfo.plan_start_date,
                    monthly_reset_date: planInfo.monthly_reset_date,
                    was_transitioned: planInfo.was_transitioned
                };
                console.log('📊 Loaded fresh plan-based usage stats:', this.usageStats);
                console.log(`📊 Current plan: ${this.usageStats.current_plan}`);
                console.log(`📊 Scans: ${this.usageStats.scans_used}/${this.usageStats.scans_limit}`);

                if (planInfo.was_transitioned) {
                    console.log('🎉 User was automatically moved to free plan!');
                }
            } else {
                // No usage yet
                this.usageStats = {
                    current_plan: 'trial',
                    total_scans: 0,
                    manual_scans: 0,
                    auto_scans: 0,
                    trial_days_remaining: 7,
                    scans_remaining: 100,
                    scans_used: 0,
                    scans_limit: 100
                };
            }
        } catch (error) {
            console.error('❌ Failed to load usage stats:', error);
            // Provide more detailed error information
            const errorDetails = {
                message: error.message || 'Unknown error',
                code: error.code || 'UNKNOWN',
                details: error.details || null
            };
            console.error('❌ Usage stats error details:', errorDetails);

            // Set default stats on error
            this.usageStats = {
                total_scans: 0,
                manual_scans: 0,
                auto_scans: 0,
                trial_days_remaining: 7,
                scans_remaining: 100
            };
        }
    }

    // Record a scan
    async recordScan(scanType, pageUrl = '', elementsScanned = 0) {
        try {
            if (!this.initialized) {
                console.log('🔄 Usage tracker not initialized, initializing...');
                await this.init();
            }

            console.log(`📝 Recording ${scanType} scan for user ${this.currentUser.id}`);

            // Record the scan using the new RPC function with auto-transition
            const { data, error } = await this.supabase.rpc('record_scan_with_auto_transition', {
                user_google_id: this.currentUser.id,
                scan_type: scanType,
                page_url: pageUrl,
                elements_scanned: elementsScanned
            });

            if (error) {
                console.error('❌ Error recording scan:', error);

                // If user doesn't exist, try to initialize them
                if (error.message && error.message.includes('User not found')) {
                    console.log('🔄 User not found, attempting to initialize...');
                    await this.init();

                    // Try recording scan again
                    return await this.recordScan(scanType, pageUrl, elementsScanned);
                }

                throw error;
            }

            if (data && data.length > 0) {
                const result = data[0];

                if (result.scan_recorded) {
                    console.log('✅ Scan recorded successfully');

                    if (result.was_transitioned) {
                        console.log('🎉 User was automatically moved to free plan!');
                        console.log(`📊 New plan: ${result.current_plan}`);
                        console.log(`📊 New scans: ${result.scans_used}/${result.scans_limit}`);
                    }

                    // Reload usage stats to get updated counts
                    await this.loadUsageStats();

                    console.log(`✅ Scan recorded: ${scanType}, Total: ${this.usageStats.scans_used}/${this.usageStats.scans_limit}`);
                    return true;
                } else {
                    console.log('❌ Scan was not recorded (limit reached or other restriction)');
                    console.log(`📊 Current plan: ${result.current_plan}`);
                    console.log(`📊 Current scans: ${result.scans_used}/${result.scans_limit}`);
                    return false;
                }
            } else {
                console.log('❌ No data returned from scan recording');
                return false;
            }
        } catch (error) {
            console.error('❌ Failed to record scan:', error);
            // Provide more detailed error information
            const errorDetails = {
                message: error.message || 'Unknown error',
                code: error.code || 'UNKNOWN',
                details: error.details || null
            };
            console.error('❌ Error details:', errorDetails);
            throw new Error(`Database error: ${errorDetails.message}`);
        }
    }

    // Check if user can perform a scan
    async canScan() {
        try {
            if (!this.usageStats) {
                await this.loadUsageStats();
            }

            const stats = this.usageStats;

            // Check based on current plan
            if (stats.current_plan === 'trial') {
                // Trial plan: check if trial is still active and has scans remaining
                if (stats.trial_days_remaining <= 0) {
                    console.log('❌ Trial expired');
                    return false;
                }
                if (stats.scans_used >= stats.scans_limit) {
                    console.log('❌ Trial scan limit reached');
                    return false;
                }
            } else if (stats.current_plan === 'free') {
                // Free plan: unlimited scans (no limit check)
                console.log('✅ Free plan: unlimited scans available');
                return true;
            } else {
                // Pro/Enterprise plan: check subscription limits
                if (stats.scans_used >= stats.scans_limit) {
                    console.log('❌ Plan limit reached');
                    return false;
                }
            }

            console.log(`✅ Can scan: ${stats.scans_used}/${stats.scans_limit} (${stats.current_plan} plan)`);
            return true;
        } catch (error) {
            console.error('❌ Error checking scan permission:', error);
            return false;
        }
    }

    // Check if user is authenticated
    isAuthenticated() {
        return this.currentUser !== null && this.currentUser !== undefined;
    }

    // Get current usage statistics
    getUsageStats() {
        if (!this.isAuthenticated()) {
            // Return fallback stats for unauthenticated users
            return {
                total_scans: 0,
                manual_scans: 0,
                auto_scans: 0,
                trial_days_remaining: 7,
                scans_remaining: 100,
                current_plan: 'trial',
                user_email: null,
                user_name: null
            };
        }

        return this.usageStats || {
            total_scans: 0,
            manual_scans: 0,
            auto_scans: 0,
            trial_days_remaining: 7,
            scans_remaining: 100,
            current_plan: 'trial',
            user_email: this.currentUser?.email || null,
            user_name: this.currentUser?.name || null
        };
    }

    // Check if user is on trial
    isOnTrial() {
        return this.usageStats && this.usageStats.trial_days_remaining > 0;
    }

    // Check if user has scans remaining
    hasScansRemaining() {
        return this.usageStats && this.usageStats.scans_remaining > 0;
    }

    // Update user trial status
    async updateUserTrialStatus(isActive) {
        try {
            const { error } = await this.supabase
                .from('users')
                .update({ is_trial_active: isActive })
                .eq('google_id', this.currentUser.id);

            if (error) {
                throw error;
            }

            console.log(`📝 User trial status updated: ${isActive ? 'active' : 'expired'}`);
        } catch (error) {
            console.error('❌ Failed to update trial status:', error);
            throw error;
        }
    }

    // Get trial end date
    async getTrialEndDate() {
        try {
            const { data: user, error } = await this.supabase
                .from('users')
                .select('trial_end_date')
                .eq('google_id', this.currentUser.id)
                .single();

            if (error) {
                throw error;
            }

            return user.trial_end_date;
        } catch (error) {
            console.error('❌ Failed to get trial end date:', error);
            return null;
        }
    }

    // Refresh usage stats
    async refreshUsageStats() {
        await this.loadUsageStats();
        return this.getUsageStats();
    }
}

// Create singleton instance
const usageTracker = new UsageTracker();

// Export for use in other scripts
if (typeof window !== 'undefined') {
    window.usageTracker = usageTracker;
    window.UsageTracker = UsageTracker; // Export the class as well
}
