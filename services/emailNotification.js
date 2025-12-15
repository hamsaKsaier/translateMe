// Pro Plan Upgrade Request Service
// This service handles saving Pro plan upgrade requests to Supabase

class ProUpgradeService {
    constructor() {
        this.supabase = null;
        this.initialized = false;
    }

    async init() {
        try {
            console.log('🔍 Initializing ProUpgradeService...');

            // Try to get Supabase client from various sources
            if (typeof window !== 'undefined') {
                console.log('🔍 Checking window.supabase:', !!window.supabase);
                console.log('🔍 Checking window.authService:', !!window.authService);
                console.log('🔍 Checking window.usageTracker:', !!window.usageTracker);

                if (window.supabase) {
                    this.supabase = window.supabase;
                    console.log('✅ Using window.supabase');
                } else if (window.authService && window.authService.supabase) {
                    this.supabase = window.authService.supabase;
                    console.log('✅ Using window.authService.supabase');
                } else if (window.usageTracker && window.usageTracker.supabase) {
                    this.supabase = window.usageTracker.supabase;
                    console.log('✅ Using window.usageTracker.supabase');
                } else {
                    // Try to create a new Supabase client
                    console.log('🔍 Attempting to create new Supabase client...');
                    if (window.supabaseConfig) {
                        const { createClient } = window.supabase;
                        this.supabase = createClient(
                            window.supabaseConfig.url,
                            window.supabaseConfig.anonKey
                        );
                        console.log('✅ Created new Supabase client');
                    }
                }
            }

            if (!this.supabase) {
                console.error('❌ Supabase client not available from any source');
                throw new Error('Supabase client not available');
            }

            // Test the Supabase client
            console.log('🔍 Testing Supabase client...');
            console.log('🔍 this.supabase:', typeof this.supabase);
            console.log('🔍 this.supabase.auth:', typeof this.supabase.auth);
            console.log('🔍 this.supabase.from:', typeof this.supabase.from);

            this.initialized = true;
            console.log('✅ ProUpgradeService initialized successfully');
        } catch (error) {
            console.error('❌ Failed to initialize ProUpgradeService:', error);
            throw error;
        }
    }

    async saveProUpgradeRequest(userEmail, userInfo = {}) {
        try {
            if (!this.initialized) {
                await this.init();
            }

            console.log('💾 Saving Pro upgrade request to Supabase...');

            // Get current user ID
            const { data: { user }, error: userError } = await this.supabase.auth.getUser();
            if (userError || !user) {
                throw new Error('User not authenticated');
            }

            // Prepare request data
            const requestData = {
                user_id: user.id,
                user_email: userEmail,
                user_name: userInfo.name || user.user_metadata?.full_name || 'Unknown',
                current_plan: userInfo.current_plan || 'free',
                scans_used: userInfo.scans_used || 0,
                scans_limit: userInfo.scans_limit || 50,
                trial_days_remaining: userInfo.trial_days_remaining || 0,
                status: 'pending'
            };

            console.log('📊 Pro upgrade request data:', requestData);

            // Save to Supabase
            const { data, error } = await this.supabase
                .from('pro_upgrade_requests')
                .insert([requestData])
                .select();

            if (error) {
                console.error('❌ Supabase error:', error);
                throw new Error(`Failed to save request: ${error.message}`);
            }

            console.log('✅ Pro upgrade request saved successfully:', data);
            return { success: true, data: data[0] };

        } catch (error) {
            console.error('❌ Failed to save Pro upgrade request:', error);
            throw new Error(`Failed to save request: ${error.message}`);
        }
    }

    // Method to check if user already has a pending request
    async hasPendingRequest(userEmail) {
        try {
            if (!this.initialized) {
                await this.init();
            }

            const { data, error } = await this.supabase
                .from('pro_upgrade_requests')
                .select('id, status, request_timestamp')
                .eq('user_email', userEmail)
                .eq('status', 'pending')
                .order('request_timestamp', { ascending: false })
                .limit(1);

            if (error) {
                console.error('❌ Error checking pending requests:', error);
                return false;
            }

            return data && data.length > 0;
        } catch (error) {
            console.error('❌ Failed to check pending requests:', error);
            return false;
        }
    }

    // Method to get user's current email from auth service
    async getUserEmail() {
        try {
            // Initialize Supabase if not already done
            if (!this.initialized) {
                await this.init();
            }

            // Try to get email directly from Supabase auth
            if (this.supabase) {
                const { data: { user }, error } = await this.supabase.auth.getUser();
                if (!error && user && user.email) {
                    console.log('✅ Got user email from Supabase auth:', user.email);
                    return user.email;
                }
            }

            // Fallback: try to get from auth service
            if (typeof window !== 'undefined' && window.authService) {
                const user = await window.authService.getCurrentUser();
                if (user && user.email) {
                    console.log('✅ Got user email from authService:', user.email);
                    return user.email;
                }
            }

            // Fallback: try to get from usage tracker
            if (typeof window !== 'undefined' && window.usageTracker) {
                const stats = window.usageTracker.getUsageStats();
                if (stats && stats.user_email) {
                    console.log('✅ Got user email from usageTracker:', stats.user_email);
                    return stats.user_email;
                }
            }

            console.error('❌ Could not retrieve user email from any source');
            return null;
        } catch (error) {
            console.error('❌ Failed to get user email:', error);
            return null;
        }
    }

    // Method to get user info for the email
    async getUserInfo() {
        try {
            const stats = window.usageTracker?.getUsageStats() || {};
            return {
                name: stats.user_name || 'Unknown',
                current_plan: stats.current_plan || 'free',
                scans_used: stats.scans_used || 0,
                scans_limit: stats.scans_limit || 50,
                trial_days_remaining: stats.trial_days_remaining || 0
            };
        } catch (error) {
            console.error('❌ Failed to get user info:', error);
            return {};
        }
    }
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ProUpgradeService;
} else {
    window.ProUpgradeService = ProUpgradeService;
}
