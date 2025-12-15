// Mock Usage Tracker for Development
// This provides the same interface as the real UsageTracker but with mock data
// Use this when Supabase is not available or for testing

class MockUsageTracker {
    constructor() {
        this.currentUser = null;
        this.usageStats = {
            total_scans: 0,
            manual_scans: 0,
            auto_scans: 0,
            trial_days_remaining: 7,
            scans_remaining: 100
        };
        this.initialized = false;
    }

    async init() {
        console.log('🧪 Initializing Mock Usage Tracker');
        
        // Get current user from auth service
        if (typeof authService !== 'undefined' && authService.getCurrentUser) {
            this.currentUser = authService.getCurrentUser();
        }
        
        this.initialized = true;
        console.log('✅ Mock Usage Tracker initialized');
    }

    async initializeUser() {
        console.log('👤 Mock: Initializing user');
        // Mock user initialization - always successful
    }

    async loadUsageStats() {
        console.log('📊 Mock: Loading usage stats');
        // Mock usage stats - you can modify these for testing
        this.usageStats = {
            total_scans: 15, // Change this to test different scenarios
            manual_scans: 10,
            auto_scans: 5,
            trial_days_remaining: 5, // Change this to test trial expiry
            scans_remaining: 85
        };
        console.log('📊 Mock usage stats:', this.usageStats);
    }

    async recordScan(scanType, pageUrl = '', elementsScanned = 0) {
        console.log(`📝 Mock: Recording ${scanType} scan`);
        
        // Update mock stats
        this.usageStats.total_scans++;
        if (scanType === 'manual') {
            this.usageStats.manual_scans++;
        } else {
            this.usageStats.auto_scans++;
        }
        this.usageStats.scans_remaining = Math.max(0, 100 - this.usageStats.total_scans);
        
        console.log(`✅ Mock scan recorded: ${this.usageStats.total_scans}/100`);
        return true;
    }

    async canScan() {
        console.log('🔍 Mock: Checking if user can scan');
        
        // Check trial days
        if (this.usageStats.trial_days_remaining <= 0) {
            console.log('❌ Mock: Trial expired');
            return false;
        }
        
        // Check scan limit
        if (this.usageStats.scans_remaining <= 0) {
            console.log('❌ Mock: Scan limit reached');
            return false;
        }
        
        console.log('✅ Mock: User can scan');
        return true;
    }

    getUsageStats() {
        return this.usageStats;
    }

    isOnTrial() {
        return this.usageStats.trial_days_remaining > 0;
    }

    hasScansRemaining() {
        return this.usageStats.scans_remaining > 0;
    }

    async updateUserTrialStatus(isActive) {
        console.log(`📝 Mock: Updating trial status to ${isActive ? 'active' : 'expired'}`);
    }

    async getTrialEndDate() {
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + this.usageStats.trial_days_remaining);
        return endDate.toISOString();
    }

    async refreshUsageStats() {
        await this.loadUsageStats();
        return this.getUsageStats();
    }
}

// Create mock instance
const mockUsageTracker = new MockUsageTracker();

// Export for use in other scripts
if (typeof window !== 'undefined') {
    window.mockUsageTracker = mockUsageTracker;
}
