// Enhanced Popup Script for TranslateMe Extension
class TranslateMePopup {
    constructor() {
        this.issues = [];
        this.isScanning = false;
        this.autoScanToggle = null;
        this.targetLanguage = 'en'; // Default language
        this.currentFilter = 'static'; // Default to Static filter
        this.clearBtn = null;
        this.exportBtn = null;
        this.authService = authService;
        this.currentUser = null;
        // Use real usage tracker with Supabase
        this.usageTracker = usageTracker;
        this.init();
    }

    async init() {
        // Check for auth success flag first
        await this.checkAuthSuccess();

        // Check authentication
        await this.checkAuthentication();
    }

    async checkAuthSuccess() {
        try {
            const result = await chrome.storage.local.get(['authSuccess']);
            if (result.authSuccess) {
                // Clear the flag
                await chrome.storage.local.remove(['authSuccess']);
                console.log('✅ Auth success detected, proceeding with normal flow');
            }
        } catch (error) {
            console.log('📝 No auth success flag found');
        }
    }

    async checkAuthentication() {
        const authCheckContainer = document.getElementById('auth-check-container');
        const mainContainer = document.getElementById('main-container');

        // Show loading state
        authCheckContainer.style.display = 'flex';
        mainContainer.style.display = 'none';

        try {
            // Initialize auth service
            await this.authService.init();

            // Check if user is authenticated
            const isAuthenticated = await this.authService.isAuthenticated();

            if (!isAuthenticated) {
                // Redirect to auth page
                console.log('❌ User not authenticated, redirecting to auth page');
                window.location.href = '../auth/auth.html';
                return;
            }

            // User is authenticated, proceed with initialization
            this.currentUser = this.authService.getCurrentUser();
            console.log('✅ User authenticated:', this.currentUser.email);

            // Store current user in storage for background script access
            await chrome.storage.local.set({ currentUser: this.currentUser });
            console.log('✅ Current user stored in storage for background access');

            // Show main container
            authCheckContainer.style.display = 'none';
            mainContainer.style.display = 'block';

            // Initialize the rest of the popup
            this.initializeUI();
            this.setupEventListeners();
            this.setupMessageListener();

            // Setup Pro plan upgrade handlers with a small delay to ensure DOM is ready
            setTimeout(() => {
                this.setupProPlanUpgradeHandlers();
                this.addTestFunctions();
            }, 100);

            this.loadPersistentIssues();
            this.loadLanguageSettings();
            this.loadAutoScanSettings();
            this.loadFilterSettings();
            this.updateButtonStates();
            this.displayUserInfo();
            this.initializeUsageTracking();

        } catch (error) {
            console.error('❌ Authentication check failed:', error);
            // Redirect to auth page on error
            window.location.href = '../auth/auth.html';
        }
    }

    initializeUI() {
        console.log('🔧 Initializing popup UI');
        this.autoScanToggle = document.getElementById('auto-scan-toggle');
        this.clearBtn = document.getElementById('clear-btn');
        this.exportBtn = document.getElementById('export-btn');
        this.signOutBtn = document.getElementById('sign-out-btn');
    }

    displayUserInfo() {
        const userEmail = document.getElementById('user-email');
        if (userEmail && this.currentUser) {
            userEmail.textContent = this.currentUser.email;
        }
    }

    async initializeUsageTracking() {
        try {
            // Initialize usage tracker
            await this.usageTracker.init();

            // Display usage counter
            this.displayUsageCounter();

            // Check for usage warnings
            this.checkUsageWarnings();

            console.log('✅ Usage tracking initialized');
        } catch (error) {
            console.error('❌ Failed to initialize usage tracking:', error);
        }
    }

    displayUsageCounter() {
        const usageCounter = document.getElementById('usage-counter');
        const freePlanForever = document.getElementById('free-plan-forever');
        const proPlanUpgrade = document.getElementById('pro-plan-upgrade');

        // All users are on free plan now - hide the banner message
        if (usageCounter) usageCounter.style.display = 'none';
        if (freePlanForever) freePlanForever.style.display = 'none'; // Hidden - no need to show this message
        if (proPlanUpgrade) proPlanUpgrade.style.display = 'none'; // Hidden by default

        const stats = this.usageTracker.getUsageStats();
        console.log('📊 Displaying usage stats (all users on free plan):', stats);

        // Store current plan in storage for content script access (always 'free')
        chrome.storage.local.set({
            currentPlan: 'free',
            lastPlanUpdate: Date.now()
        }).then(() => {
            console.log(`📊 Stored current plan in storage: ${stats.current_plan}`);
        }).catch(error => {
            console.error('❌ Failed to store plan in storage:', error);
        });

        // Update auto-scan availability (now enabled for all users)
        this.updateAutoScanForPlan(stats.current_plan);

        console.log(`📊 Updated UI: ${stats.scans_used || stats.total_scans || 0}/${stats.scans_limit || 100} scans, Plan: ${stats.current_plan}`);
    }

    updateAutoScanForPlan(currentPlan) {
        if (!this.autoScanToggle) return;

        // Auto-scan is now available for all users (free plan included)
        this.autoScanToggle.disabled = false;
        this.autoScanToggle.title = 'Enable automatic scanning of page changes';

        // Remove visual indication
        const autoScanLabel = document.querySelector('label[for="auto-scan-toggle"]');
        if (autoScanLabel) {
            autoScanLabel.style.opacity = '1';
            autoScanLabel.style.cursor = 'pointer';
        }

        console.log('✅ Auto-scan enabled for all users');
    }

    showProPlanUpgrade() {
        const upgradeSection = document.getElementById('pro-plan-upgrade');
        if (upgradeSection) {
            upgradeSection.style.display = 'block';
            console.log('🚀 Showing pro plan upgrade section');
        }
    }

    hideProPlanUpgrade() {
        const upgradeSection = document.getElementById('pro-plan-upgrade');
        if (upgradeSection) {
            upgradeSection.style.display = 'none';
            console.log('🚀 Hiding pro plan upgrade section');
        }
    }

    setupProPlanUpgradeHandlers() {
        console.log('🔧 Setting up Pro plan upgrade handlers...');

        const sendRequestBtn = document.getElementById('send-upgrade-request-btn');
        const dismissBtn = document.getElementById('dismiss-upgrade-btn');
        const emailInput = document.getElementById('upgrade-email');

        console.log('🔍 Send request button found:', !!sendRequestBtn);
        console.log('🔍 Dismiss button found:', !!dismissBtn);
        console.log('🔍 Email input found:', !!emailInput);

        if (sendRequestBtn) {
            console.log('✅ Adding click listener to send request button');
            sendRequestBtn.addEventListener('click', async (e) => {
                console.log('🖱️ Send request button clicked!');
                e.preventDefault();
                e.stopPropagation();
                await this.handleSimpleUpgradeRequest();
            });
        } else {
            console.error('❌ Send request button not found!');
        }

        if (dismissBtn) {
            console.log('✅ Adding click listener to dismiss button');
            dismissBtn.addEventListener('click', (e) => {
                console.log('🖱️ Dismiss button clicked!');
                e.preventDefault();
                e.stopPropagation();
                this.hideProPlanUpgrade();
            });
        } else {
            console.error('❌ Dismiss button not found!');
        }

        // Auto-fill email if available
        if (emailInput) {
            this.autoFillEmail(emailInput);
        }
    }

    async autoFillEmail(emailInput) {
        try {
            // Try to get email from various sources
            let userEmail = null;

            if (typeof window !== 'undefined') {
                // Method 1: Try authService
                if (window.authService) {
                    try {
                        const currentUser = await window.authService.getCurrentUser();
                        if (currentUser && currentUser.email) {
                            userEmail = currentUser.email;
                            console.log('✅ Got email from authService for auto-fill:', userEmail);
                        }
                    } catch (error) {
                        console.log('❌ authService failed for auto-fill:', error);
                    }
                }

                // Method 2: Try usageTracker
                if (!userEmail && window.usageTracker) {
                    try {
                        const stats = window.usageTracker.getUsageStats();
                        if (stats && stats.user_email) {
                            userEmail = stats.user_email;
                            console.log('✅ Got email from usageTracker for auto-fill:', userEmail);
                        }
                    } catch (error) {
                        console.log('❌ usageTracker failed for auto-fill:', error);
                    }
                }

                // Method 3: Try displayed email
                if (!userEmail) {
                    const displayedEmail = document.getElementById('user-email')?.textContent?.trim();
                    if (displayedEmail && displayedEmail.includes('@')) {
                        userEmail = displayedEmail;
                        console.log('✅ Got email from displayed element for auto-fill:', userEmail);
                    }
                }
            }

            if (userEmail) {
                emailInput.value = userEmail;
                console.log('✅ Auto-filled email input:', userEmail);
            }
        } catch (error) {
            console.error('❌ Failed to auto-fill email:', error);
        }
    }

    async handleSimpleUpgradeRequest() {
        console.warn('⚠️ handleSimpleUpgradeRequest() is deprecated. Redirecting to handleUpgradeRequest().');
        return this.handleUpgradeRequest();
    }

    addTestFunctions() {
        // Add test functions to window for debugging
        window.testProUpgrade = () => {
            console.log('🧪 Testing Pro upgrade functionality...');
            console.log('🔍 Upgrade section element:', document.getElementById('pro-plan-upgrade'));
            console.log('🔍 Upgrade button element:', document.getElementById('upgrade-to-pro-btn'));
            console.log('🔍 Dismiss button element:', document.getElementById('dismiss-upgrade-btn'));

            // Test showing the upgrade section
            this.showProPlanUpgrade();
            console.log('✅ Upgrade section should now be visible');
        };

        window.testUpgradeClick = () => {
            console.log('🧪 Testing upgrade button click...');
            const upgradeBtn = document.getElementById('upgrade-to-pro-btn');
            if (upgradeBtn) {
                upgradeBtn.click();
                console.log('✅ Upgrade button clicked programmatically');
            } else {
                console.error('❌ Upgrade button not found');
            }
        };

        window.testUpgradeMethod = () => {
            console.log('🧪 Testing handleUpgradeToPro method directly...');
            this.handleUpgradeToPro();
        };

        window.testSupabaseStatus = () => {
            console.log('🧪 Testing Supabase client status...');
            console.log('🔍 window.supabase:', typeof window.supabase);
            console.log('🔍 window.supabase.auth:', typeof window.supabase?.auth);
            console.log('🔍 window.authService:', typeof window.authService);
            console.log('🔍 window.authService.supabase:', typeof window.authService?.supabase);
            console.log('🔍 window.usageTracker:', typeof window.usageTracker);
            console.log('🔍 window.usageTracker.supabase:', typeof window.usageTracker?.supabase);

            if (window.supabase && window.supabase.auth) {
                console.log('✅ Primary Supabase client is available');
                return 'primary';
            } else if (window.authService && window.authService.supabase && window.authService.supabase.auth) {
                console.log('✅ Supabase via authService is available');
                return 'authService';
            } else if (window.usageTracker && window.usageTracker.supabase && window.usageTracker.supabase.auth) {
                console.log('✅ Supabase via usageTracker is available');
                return 'usageTracker';
            } else {
                console.log('❌ No Supabase client found');
                return 'none';
            }
        };

        window.testSimpleUpgrade = () => {
            console.log('🧪 Testing simple upgrade handler...');
            const emailInput = document.getElementById('upgrade-email');
            if (emailInput) {
                emailInput.value = 'test@example.com';
                console.log('✅ Email input found and filled');
                // Test the simple upgrade request
                this.handleSimpleUpgradeRequest();
                return true;
            } else {
                console.log('❌ Email input not found');
                return false;
            }
        };

        window.testDatabaseConnection = async () => {
            console.log('🧪 Testing database connection...');
            try {
                if (window.supabase && window.supabase.auth) {
                    console.log('✅ Supabase client available');

                    // Test authentication
                    const { data: { user }, error: userError } = await window.supabase.auth.getUser();
                    if (userError || !user) {
                        console.log('❌ User not authenticated:', userError);
                        console.log('🔍 This might be why requests aren\'t being saved');
                        return false;
                    }
                    console.log('✅ User authenticated:', user.email);

                    // Test table access
                    const { data, error } = await window.supabase
                        .from('pro_upgrade_requests')
                        .select('*')
                        .limit(5);

                    if (error) {
                        console.log('❌ Database table error:', error);
                        console.log('🔍 Error details:', error.message);
                        return false;
                    }

                    console.log('✅ Database table accessible');
                    console.log('📊 Current requests in database:', data);
                    console.log('📊 Total requests found:', data.length);
                    return true;
                } else {
                    console.log('❌ Supabase client not available');
                    return false;
                }
            } catch (error) {
                console.log('❌ Database test failed:', error);
                return false;
            }
        };

        window.testProUpgradeSave = async () => {
            console.log('🧪 Testing Pro upgrade save directly...');
            try {
                if (!window.supabase || !window.supabase.auth) {
                    console.log('❌ Supabase client not available');
                    return false;
                }

                // Test data
                const testData = {
                    user_id: 'test-user-id-' + Date.now(),
                    user_email: 'test@example.com',
                    user_name: 'Test User',
                    current_plan: 'free',
                    scans_used: 10,
                    scans_limit: 50,
                    trial_days_remaining: 0,
                    status: 'pending'
                };

                console.log('📊 Attempting to save test data:', testData);

                const { data, error } = await window.supabase
                    .from('pro_upgrade_requests')
                    .insert([testData])
                    .select();

                if (error) {
                    console.log('❌ Save failed:', error);
                    console.log('🔍 Error details:', error.message);
                    return false;
                }

                console.log('✅ Test save successful:', data);
                return true;
            } catch (error) {
                console.log('❌ Test save failed:', error);
                return false;
            }
        };

        console.log('🧪 Test functions added:');
        console.log('🧪 - testProUpgrade() - Show upgrade section');
        console.log('🧪 - testUpgradeClick() - Click upgrade button');
        console.log('🧪 - testUpgradeMethod() - Call method directly');
        console.log('🧪 - testSupabaseStatus() - Check Supabase client status');
        console.log('🧪 - testSimpleUpgrade() - Test simple upgrade handler');
        console.log('🧪 - testDatabaseConnection() - Test database connection');
        console.log('🧪 - testProUpgradeSave() - Test direct database save');
    }

    async handleUpgradeRequest() {
        console.log('🚀 handleUpgradeRequest() called!');
        try {
            // Get email from input
            const emailInput = document.getElementById('upgrade-email');
            if (!emailInput) {
                throw new Error('Email input not found');
            }

            const userEmail = emailInput.value.trim();
            if (!userEmail) {
                throw new Error('Please enter your email address');
            }

            // Basic email validation
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(userEmail)) {
                throw new Error('Please enter a valid email address');
            }

            this.updateStatus('Processing your Pro plan request...', 'info');
            console.log('🚀 User submitted upgrade request with email:', userEmail);

            // Get user info for the request
            console.log('🔍 Getting user info...');
            let userInfo = {};

            // Try multiple methods to get user email
            if (typeof window !== 'undefined') {
                // Method 1: Try authService
                if (window.authService) {
                    try {
                        const currentUser = await window.authService.getCurrentUser();
                        console.log('🔍 Current user from authService:', currentUser);
                        if (currentUser && currentUser.email) {
                            userEmail = currentUser.email;
                            console.log('✅ Got email from authService:', userEmail);
                        }
                    } catch (error) {
                        console.log('❌ authService failed:', error);
                    }
                }

                // Method 2: Try usageTracker
                if (!userEmail && window.usageTracker) {
                    try {
                        const stats = window.usageTracker.getUsageStats();
                        if (stats && stats.user_email) {
                            userEmail = stats.user_email;
                            console.log('✅ Got email from usageTracker:', userEmail);
                        }
                    } catch (error) {
                        console.log('❌ usageTracker failed:', error);
                    }
                }

                // Method 3: Try displayed email
                if (!userEmail) {
                    const displayedEmail = document.getElementById('user-email')?.textContent?.trim();
                    if (displayedEmail && displayedEmail.includes('@')) {
                        userEmail = displayedEmail;
                        console.log('✅ Got email from displayed element:', userEmail);
                    }
                }
            }

            console.log('📧 Final user email result:', userEmail);

            // Get user info
            console.log('🔍 Getting user info...');
            if (typeof window !== 'undefined' && window.usageTracker) {
                try {
                    userInfo = window.usageTracker.getUsageStats() || {};
                    console.log('📧 User info result:', userInfo);
                } catch (error) {
                    console.log('❌ Failed to get user info:', error);
                    userInfo = {};
                }
            }

            if (!userEmail) {
                console.error('❌ No user email found. Available services:');
                console.error('❌ window.authService:', typeof window !== 'undefined' ? !!window.authService : 'undefined');
                console.error('❌ window.usageTracker:', typeof window !== 'undefined' ? !!window.usageTracker : 'undefined');
                console.error('❌ window.supabase:', typeof window !== 'undefined' ? !!window.supabase : 'undefined');
                throw new Error('Unable to get user email. Please sign in again.');
            }

            // Try to save to Supabase first, fallback to console logging
            let savedToSupabase = false;

            try {
                console.log('🔍 Attempting to save pro request via Supabase RPC...');

                let supabaseClient = null;

                if (typeof window !== 'undefined') {
                    if (window.authService?.supabase) {
                        supabaseClient = window.authService.supabase;
                        console.log('✅ Using authService Supabase client');
                    } else if (window.supabase) {
                        supabaseClient = window.supabase;
                        console.log('✅ Using window.supabase client');
                    } else if (window.usageTracker?.supabase) {
                        supabaseClient = window.usageTracker.supabase;
                        console.log('✅ Using usageTracker Supabase client');
                    }
                }

                if (!supabaseClient || !supabaseClient.rpc) {
                    throw new Error('Supabase client not available');
                }

                const requestPayload = {
                    p_user_email: userEmail,
                    p_user_name: userInfo.name || userEmail.split('@')[0],
                    p_current_plan: userInfo.current_plan || 'free',
                    p_scans_used: userInfo.scans_used || 0,
                    p_scans_limit: userInfo.scans_limit ?? -1,
                    p_trial_days_remaining: userInfo.trial_days_remaining || 0
                };

                console.log('📊 Calling insert_pro_upgrade_request RPC with payload:', requestPayload);

                const { data: rpcResult, error: rpcError } = await supabaseClient.rpc('insert_pro_upgrade_request', requestPayload);

                if (rpcError) {
                    throw rpcError;
                }

                console.log('✅ Pro upgrade request saved via RPC. Request ID:', rpcResult);
                savedToSupabase = true;

            } catch (supabaseError) {
                console.error('❌ Supabase save failed:', supabaseError);
                console.log('📧 FALLBACK: Pro Upgrade Request Details:');
                console.log('📧 User Email:', userEmail);
                console.log('📧 User Name:', userInfo.name || userEmail.split('@')[0]);
                console.log('📧 Current Plan:', userInfo.current_plan || 'free');
                console.log('📧 Scans Used:', userInfo.scans_used || 0);
                console.log('📧 Scans Limit:', userInfo.scans_limit || 0);
                console.log('📧 Trial Days Remaining:', userInfo.trial_days_remaining || 0);
                console.log('📧 Request Time:', new Date().toLocaleString());
                console.log('📧 Request ID:', 'req_' + Date.now());
            }

            // Show success message to user
            if (savedToSupabase) {
                this.updateStatus('✅ Request saved to database! We\'ll email you as soon as the Pro plan is available.', 'success');
                console.log('✅ Pro upgrade request saved to Supabase successfully');
            } else {
                this.updateStatus('✅ Request received! We\'ll email you as soon as the Pro plan is available.', 'success');
                console.log('✅ Pro upgrade request logged to console (fallback)');
            }

            // Hide upgrade section after successful submission
            setTimeout(() => {
                this.hideProPlanUpgrade();
                this.updateStatus('Ready to scan', 'info');
            }, 3000);

        } catch (error) {
            console.error('❌ Pro upgrade request failed:', error);
            this.updateStatus(`❌ ${error.message}`, 'error');

            // Show fallback message
            setTimeout(() => {
                this.updateStatus('Please try again or contact support.', 'error');
            }, 2000);
        }
    }

    checkUsageWarnings() {
        const stats = this.usageTracker.getUsageStats();

        // Remove existing warnings
        const existingWarning = document.querySelector('.usage-warning');
        const existingLimitReached = document.querySelector('.limit-reached');

        if (existingWarning) existingWarning.remove();
        if (existingLimitReached) existingLimitReached.remove();

        console.log(`🔍 Checking usage warnings for ${stats.current_plan} plan: ${stats.scans_used}/${stats.scans_limit}`);

        // Free plan now has unlimited scans - no limit check needed
        if (stats.current_plan === 'free') {
            console.log('✅ Free plan: unlimited scans available');
            return;
        }

        // Check if user is on trial and has reached limit
        if (stats.current_plan === 'trial' && stats.scans_used >= stats.scans_limit) {
            console.log('🚫 Trial limit reached');
            this.showTrialLimitReachedMessage();
            this.disableScanning();
            return;
        }

        // Check if trial expired
        if (stats.current_plan === 'trial' && stats.trial_days_remaining <= 0) {
            console.log('⏰ Trial expired');
            this.showTrialExpiredMessage();
            this.disableScanning();
            return;
        }

        // Free plan now has unlimited scans - no warning needed

        // Check if trial expiring soon (1 day or less)
        if (stats.current_plan === 'trial' && stats.trial_days_remaining <= 1 && stats.trial_days_remaining > 0) {
            console.log('⚠️ Trial expiring soon');
            this.showTrialExpiringWarning();
        }

        console.log('✅ No warnings needed');
    }

    showUsageWarning(scansRemaining) {
        const container = document.querySelector('.container');
        const header = document.querySelector('.header');

        const warning = document.createElement('div');
        warning.className = 'usage-warning';
        warning.innerHTML = `
            ⚠️ Only ${scansRemaining} scans remaining in your trial!
        `;

        container.insertBefore(warning, header.nextSibling);
    }

    showTrialExpiringWarning() {
        const container = document.querySelector('.container');
        const header = document.querySelector('.header');

        const warning = document.createElement('div');
        warning.className = 'usage-warning';
        warning.innerHTML = `
            ⏰ Your trial expires soon! Upgrade to continue using AI-powered scanning.
        `;

        container.insertBefore(warning, header.nextSibling);
    }

    showTrialLimitReachedMessage() {
        const container = document.querySelector('.container');
        const header = document.querySelector('.header');

        // Remove any existing limit messages
        const existingLimit = document.querySelector('.limit-reached');
        if (existingLimit) existingLimit.remove();

        const limitMessage = document.createElement('div');
        limitMessage.className = 'limit-reached';
        limitMessage.innerHTML = `
            <h3>🎯 Trial Complete - Choose Your Plan</h3>
            <p>You've used all 100 scans in your trial. Choose your next plan:</p>
            <div class="plan-choice-buttons">
                <button id="choose-free-plan-btn" class="plan-choice-button free-plan-btn">
                    <div class="plan-choice-icon">🎉</div>
                    <div class="plan-choice-content">
                        <div class="plan-choice-title">Free Plan</div>
                        <div class="plan-choice-subtitle">Unlimited scans forever</div>
                    </div>
                </button>
                <button id="request-pro-access-btn" class="plan-choice-button pro-plan-btn">
                    <div class="plan-choice-icon">🚀</div>
                    <div class="plan-choice-content">
                        <div class="plan-choice-title">Request Pro Access</div>
                        <div class="plan-choice-subtitle">Get early access to Pro features</div>
                    </div>
                </button>
            </div>
        `;

        container.insertBefore(limitMessage, header.nextSibling);

        // Add event listeners
        const chooseFreeBtn = document.getElementById('choose-free-plan-btn');
        const requestProBtn = document.getElementById('request-pro-access-btn');

        if (chooseFreeBtn) {
            chooseFreeBtn.addEventListener('click', () => this.handleChooseFreePlan());
        }

        if (requestProBtn) {
            requestProBtn.addEventListener('click', () => this.handleRequestProAccess());
        }
    }

    async handleChooseFreePlan() {
        try {
            console.log('✅ User chose free plan - moving to free plan...');
            this.updateStatus('Moving to free plan...', 'info');

            // The transition will happen automatically on next scan or stats load
            // But we can trigger it manually by refreshing usage stats
            if (this.usageTracker) {
                await this.usageTracker.loadUsageStats();

                // Force a refresh to trigger the auto-transition
                const stats = this.usageTracker.getUsageStats();
                console.log('📊 Current plan after refresh:', stats.current_plan);

                if (stats.current_plan === 'free') {
                    this.updateStatus('Successfully moved to free plan!', 'success');
                    // Remove the limit message
                    const limitMessage = document.querySelector('.limit-reached');
                    if (limitMessage) limitMessage.remove();

                    // Refresh UI to show free plan
                    this.displayUsageCounter();
                } else {
                    // If still on trial, trigger transition by calling the RPC
                    console.log('🔄 Still on trial, triggering transition...');
                    await this.triggerTrialToFreeTransition();
                }
            } else {
                // Fallback: just refresh
                await this.initializeUsageTracking();
            }
        } catch (error) {
            console.error('❌ Error moving to free plan:', error);
            this.updateStatus('Error moving to free plan. Please try again.', 'error');
        }
    }

    async triggerTrialToFreeTransition() {
        try {
            if (!this.currentUser) {
                throw new Error('No authenticated user found');
            }

            const supabaseClient = window.supabase || this.usageTracker?.supabase;

            if (!supabaseClient) {
                throw new Error('Supabase client not available');
            }

            console.log('🔄 Forcing transition to free plan for user:', this.currentUser.id);

            const { data, error } = await supabaseClient.rpc('force_move_user_to_free_plan', {
                user_google_id: this.currentUser.id
            });

            if (error) {
                throw error;
            }

            console.log('✅ Forced transition result:', data);

            if (this.usageTracker) {
                await this.usageTracker.loadUsageStats();
                this.displayUsageCounter();
            }

            const limitMessage = document.querySelector('.limit-reached');
            if (limitMessage) limitMessage.remove();

            this.updateStatus('Successfully moved to free plan!', 'success');
        } catch (error) {
            console.error('❌ Error triggering transition:', error);
            this.updateStatus('Failed to move to free plan. Please try again.', 'error');
            throw error;
        }
    }

    handleRequestProAccess() {
        console.log('🚀 User requested pro access');

        // Remove the limit message
        const limitMessage = document.querySelector('.limit-reached');
        if (limitMessage) limitMessage.remove();

        // Show the pro upgrade section
        const freePlanForever = document.getElementById('free-plan-forever');
        const proPlanUpgrade = document.getElementById('pro-plan-upgrade');

        if (freePlanForever) {
            freePlanForever.style.display = 'block';
        }

        if (proPlanUpgrade) {
            proPlanUpgrade.style.display = 'block';
        }

        // Scroll to upgrade section if needed
        if (proPlanUpgrade) {
            proPlanUpgrade.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }

        // Focus on email input
        setTimeout(() => {
            const emailInput = document.getElementById('upgrade-email');
            if (emailInput) {
                emailInput.focus();
            }
        }, 300);
    }

    showFreePlanLimitReachedMessage() {
        // Free plan is unlimited forever - this message should never be shown
        // But keeping function for backward compatibility
        console.log('⚠️ showFreePlanLimitReachedMessage() called but free plan is unlimited');
    }

    showTrialExpiredMessage() {
        const container = document.querySelector('.container');
        const header = document.querySelector('.header');

        const limitMessage = document.createElement('div');
        limitMessage.className = 'limit-reached';
        limitMessage.innerHTML = `
            <h3>⏰ Trial Expired</h3>
            <p>Your 7-day trial has expired. You've been moved to our free plan with 50 scans per month.</p>
            <button class="upgrade-button" onclick="window.open('https://your-website.com/upgrade', '_blank')">
                View Plans
            </button>
        `;

        container.insertBefore(limitMessage, header.nextSibling);
    }

    async handleAutoScanUsage(scanData) {
        try {
            // Record auto-scan usage
            await this.usageTracker.recordScan('auto_scan', scanData.url, scanData.elementsScanned);
            console.log('✅ Auto-scan usage recorded');

            // Update usage counter display
            this.displayUsageCounter();
            this.checkUsageWarnings();

            // Check if limit reached after this scan
            const canStillScan = await this.usageTracker.canScan();
            if (!canStillScan) {
                this.disableScanning();
                this.updateStatus('Trial limit reached - auto-scan disabled', 'error');
            }
        } catch (error) {
            console.error('❌ Failed to record auto-scan usage:', error);
            // Show user-friendly error message
            const errorMessage = error.message || error.toString() || 'Unknown error';
            this.updateStatus(`Warning: Auto-scan tracking failed - ${errorMessage}`, 'warning');
        }
    }

    disableScanning() {
        const scanBtn = document.getElementById('scan-btn');
        if (scanBtn) {
            scanBtn.disabled = true;
            const stats = this.usageTracker.getUsageStats();
            if (stats.current_plan === 'free') {
                scanBtn.textContent = 'Free Plan Limit Reached';
            } else {
                scanBtn.textContent = 'Trial Limit Reached';
            }
            scanBtn.style.opacity = '0.6';
        }

        const autoScanToggle = document.getElementById('auto-scan-toggle');
        if (autoScanToggle) {
            autoScanToggle.disabled = true;
            autoScanToggle.checked = false;
        }

        // Also stop auto-scan on content script side
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
                try {
                    chrome.tabs.sendMessage(tabs[0].id, { action: 'stopAutoScan' });
                } catch (contentScriptError) {
                    // Content script not loaded - this is normal for some pages
                    console.log('📝 Content script not available for auto-scan stop (normal for some pages)');
                }
            }
        });
    }

    setupEventListeners() {
        // Scan button
        const scanBtn = document.getElementById('scan-btn');
        if (scanBtn) {
            scanBtn.addEventListener('click', () => this.startScan());
        }


        // Clear button
        if (this.clearBtn) {
            this.clearBtn.addEventListener('click', () => this.clearIssues());
        }

        // Export button
        if (this.exportBtn) {
            this.exportBtn.addEventListener('click', () => this.exportIssues());
        }

        // Highlight Issues button
        const highlightBtn = document.getElementById('highlight-btn');
        if (highlightBtn) {
            highlightBtn.addEventListener('click', () => this.highlightIssues());
        }

        // Clean Results button
        const cleanBtn = document.getElementById('clean-btn');
        if (cleanBtn) {
            cleanBtn.addEventListener('click', () => this.cleanResults());
        }

        // Target language selector
        const languageSelector = document.getElementById('target-language');
        if (languageSelector) {
            languageSelector.addEventListener('change', (e) => this.updateTargetLanguage(e.target.value));
        }

        // Auto-scan toggle
        if (this.autoScanToggle) {
            this.autoScanToggle.addEventListener('change', () => this.toggleAutoScan());
        }

        // Filter buttons
        const filterAllBtn = document.getElementById('filter-all');
        const filterStaticBtn = document.getElementById('filter-static');
        const filterDynamicBtn = document.getElementById('filter-dynamic');

        if (filterAllBtn) {
            filterAllBtn.addEventListener('click', () => this.setFilter('all'));
        }
        if (filterStaticBtn) {
            filterStaticBtn.addEventListener('click', () => this.setFilter('static'));
        }
        if (filterDynamicBtn) {
            filterDynamicBtn.addEventListener('click', () => this.setFilter('dynamic'));
        }

        // Sign out button
        if (this.signOutBtn) {
            this.signOutBtn.addEventListener('click', () => this.handleSignOut());
        }

        // Upgrade to Pro button (hidden for now, kept for future use)
        const upgradeToProBtn = document.getElementById('upgrade-to-pro-btn');
        if (upgradeToProBtn) {
            // Keep handler but button is hidden in HTML
            upgradeToProBtn.addEventListener('click', () => this.showProPlanUpgrade());
        }

        // Donation button
        const donationBtn = document.getElementById('donation-btn');
        if (donationBtn) {
            donationBtn.addEventListener('click', () => this.handleDonation());
        }

        // Check extension status
        this.checkExtensionStatus();

    }

    setupMessageListener() {
        // Listen for streaming issue updates from content script
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            if (request.action === 'issuesUpdate') {
                console.log(`📨 Received streaming update: ${request.count} issues`);
                this.issues = request.issues;
                this.displayIssues();
                this.updateButtonStates();
                this.updateStatus(`Found ${request.count} issues (streaming...)`, 'info');
            }

            // Listen for content script requesting user plan
            if (request.action === 'getUserPlan') {
                console.log('📨 Content script requesting user plan');
                // All users are on free plan now
                const plan = 'free';
                console.log(`📊 Sending plan to content script: ${plan}`);
                sendResponse({ plan: plan });
                return true; // Keep message channel open for async response
            }

            // Listen for auto-scan usage tracking
            if (request.action === 'autoScanUsage') {
                this.handleAutoScanUsage(request.scanData);
            }
        });
    }

    async updateTargetLanguage(language) {
        this.targetLanguage = language;
        await this.saveLanguageSettings();
        console.log(`🌍 Target language updated to: ${language}`);
        this.updateStatus(`Target language set to: ${this.getLanguageName(language)}`, 'info');
    }

    async loadLanguageSettings() {
        try {
            const result = await chrome.storage.local.get(['targetLanguage']);
            if (result.targetLanguage) {
                this.targetLanguage = result.targetLanguage;
                const languageSelector = document.getElementById('target-language');
                if (languageSelector) {
                    languageSelector.value = this.targetLanguage;
                }
                console.log(`🌍 Loaded target language: ${this.targetLanguage}`);
            }
        } catch (error) {
            console.error('❌ Failed to load language settings:', error);
        }
    }

    async saveLanguageSettings() {
        try {
            await chrome.storage.local.set({ targetLanguage: this.targetLanguage });
        } catch (error) {
            console.error('❌ Failed to save language settings:', error);
        }
    }

    getLanguageName(code) {
        const languages = {
            'en': 'English',
            'fr': 'French',
            'ar': 'Arabic'
        };
        return languages[code] || code;
    }

    async checkExtensionStatus() {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

            // Try to send message to content script
            const response = await chrome.tabs.sendMessage(tab.id, { action: 'ping' });

            if (response && response.success) {
                console.log('✅ Extension is ready');
                this.updateStatus('Extension ready', 'success');
            } else {
                console.log('❌ Extension not ready');
                this.updateStatus('Extension not ready', 'error');
            }
        } catch (error) {
            // Check if it's a connection error (content script not loaded)
            if (error.message.includes('Could not establish connection') ||
                error.message.includes('Receiving end does not exist')) {
                console.log('📝 Content script not loaded, will inject when needed');
                this.updateStatus('Extension ready (will inject when scanning)', 'info');
                return true; // Don't treat this as an error
            } else {
                console.error('❌ Error checking extension status:', error);
                this.updateStatus('Extension error: ' + (error.message || 'Unknown'), 'error');
                return false;
            }
        }
    }

    async injectContentScript() {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

            // Inject the content script
            await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                files: ['libs/franc.js', 'libs/languageDetector.js', 'content/content.js']
            });

            console.log('✅ Content script injected successfully');
            this.updateStatus('Extension injected and ready', 'success');

            // Wait a moment for the script to initialize
            setTimeout(() => {
                this.checkExtensionStatus();
            }, 1000);

        } catch (error) {
            console.error('❌ Failed to inject content script:', error);
            this.updateStatus('Failed to load extension', 'error');
        }
    }

    async startScan() {
        if (this.isScanning) return;

        // Check if user can scan (trial limits)
        try {
            const canScan = await this.usageTracker.canScan();
            if (!canScan) {
                const stats = this.usageTracker.getUsageStats();

                // Show appropriate message based on current plan
                if (stats.current_plan === 'free') {
                    this.updateStatus('Free plan limit reached', 'error');
                    this.showFreePlanLimitReachedMessage();
                } else if (stats.current_plan === 'trial') {
                    if (stats.trial_days_remaining <= 0) {
                        this.updateStatus('Trial expired', 'error');
                        this.showTrialExpiredMessage();
                    } else {
                        this.updateStatus('Trial limit reached', 'error');
                        this.showTrialLimitReachedMessage();
                    }
                } else {
                    this.updateStatus('Plan limit reached', 'error');
                    this.showTrialLimitReachedMessage(); // Fallback
                }

                this.disableScanning();
                return;
            }
        } catch (error) {
            console.error('❌ Error checking scan permission:', error);
            this.updateStatus('Error checking permissions', 'error');
            return;
        }

        this.isScanning = true;
        this.updateStatus('Scanning...', 'info');
        this.updateScanButton('Scanning...', true);
        this.showProgress();

        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

            // Record scan usage immediately when scan starts
            try {
                await this.usageTracker.recordScan('manual', tab?.url || '', 0);
                console.log('✅ Manual scan usage recorded at start');
            } catch (usageError) {
                console.error('❌ Failed to record scan at start:', usageError);
            }

            // First check if content script is available
            let response;
            try {
                response = await chrome.tabs.sendMessage(tab.id, { action: 'ping' });
            } catch (pingError) {
                console.log('📝 Content script not loaded, injecting...');
                await this.injectContentScript();

                // Wait a moment for injection to complete
                await new Promise(resolve => setTimeout(resolve, 1000));

                // Try ping again
                try {
                    response = await chrome.tabs.sendMessage(tab.id, { action: 'ping' });
                } catch (retryError) {
                    throw new Error('Content script injection failed');
                }
            }

            if (!response || !response.success) {
                throw new Error('Content script not responding');
            }

            // Now try the actual scan
            response = await chrome.tabs.sendMessage(tab.id, { action: 'scanPage' });

            if (response && response.success) {
                this.issues = response.issues;
                console.log('📥 POPUP: Received issues from content script:', this.issues);
                console.log('📊 POPUP: Issue details:', this.issues.map(issue => ({
                    id: issue.id,
                    text: issue.text.substring(0, 50) + (issue.text.length > 50 ? '...' : ''),
                    type: issue.type,
                    dataType: issue.dataType,
                    htmlTag: issue.htmlTag
                })));

                // Update usage counter display (scan already recorded at start)
                this.displayUsageCounter();
                this.checkUsageWarnings();

                this.displayIssues();
                this.updateButtonStates();
                this.updateStatus(`Found ${this.issues.length} issues`, 'success');
                this.saveIssuesToStorage();
            } else {
                this.updateStatus('Scan failed: ' + (response?.error || 'Unknown error'), 'error');
            }
        } catch (error) {
            console.error('❌ Scan error:', error);

            if (error.message.includes('Could not establish connection') ||
                error.message.includes('Receiving end does not exist') ||
                error.message.includes('Content script not responding')) {
                console.log('🔄 Content script communication failed, please refresh the page and try again');
                this.updateStatus('Please refresh the page and try scanning again', 'warning');
            } else {
                this.updateStatus('Scan failed: ' + error.message, 'error');
            }
        } finally {
            this.isScanning = false;
            this.updateScanButton('🔍 Scan Page', false);
            this.hideProgress();
        }
    }


    displayIssues() {
        const issuesList = document.getElementById('issues-list');
        if (!issuesList) return;

        issuesList.innerHTML = '';

        // Get filtered issues based on current filter
        const filteredIssues = this.getFilteredIssues();

        if (filteredIssues.length === 0) {
            if (this.issues.length === 0) {
                issuesList.innerHTML = '<div class="no-issues">No translation issues found!</div>';
            } else {
                issuesList.innerHTML = `<div class="no-issues">No ${this.currentFilter} issues found!</div>`;
            }
            this.updateIssueCount();
            return;
        }

        // Display filtered issues
        filteredIssues.forEach(issue => {
            const issueElement = document.createElement('div');
            issueElement.className = `issue-item ${issue.type}`;

            // Add auto-scan indicator
            const sourceIndicator = issue.source === 'auto_scan' ? ' <span style="color: #007bff; font-size: 12px;">🔄</span>' : '';

            issueElement.innerHTML = `
                <div class="issue-text">${issue.text}${sourceIndicator}</div>
                <div class="issue-details">
                    <span class="issue-selector">${issue.selector}</span>
                    <span class="issue-type">${issue.dataType}</span>
                </div>
            `;
            issuesList.appendChild(issueElement);
        });

        this.updateIssueCount();
        this.updateButtonStates();
    }

    updateButtonStates() {
        const hasIssues = this.issues.length > 0;

        if (this.clearBtn) {
            this.clearBtn.disabled = !hasIssues;
        }

        if (this.exportBtn) {
            this.exportBtn.disabled = !hasIssues;
        }
    }

    async clearIssues() {
        this.issues = [];
        this.displayIssues();
        this.updateStatus('Clearing all data...', 'info');

        // Clear issues from storage
        await this.clearIssuesFromStorage();

        // Clear auto-scan cache and disable auto-scan
        await this.clearAutoScanData();

        // Disable auto-scan toggle
        this.disableAutoScan();

        this.updateStatus('All data cleared and auto-scan disabled', 'success');
    }

    exportIssues() {
        if (this.issues.length === 0) {
            this.updateStatus('No issues to export', 'info');
            return;
        }

        const dataStr = JSON.stringify(this.issues, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);

        const link = document.createElement('a');
        link.href = url;
        link.download = `translation-issues-${new Date().toISOString().split('T')[0]}.json`;
        link.click();

        URL.revokeObjectURL(url);
        this.updateStatus('Issues exported', 'success');
    }

    async toggleAutoScan() {
        if (!this.autoScanToggle) return;

        const isEnabled = this.autoScanToggle.checked;

        // If enabling auto-scan, check if user can scan (all users can scan now, but check for limits)
        if (isEnabled) {
            try {
                const canScan = await this.usageTracker.canScan();
                if (!canScan) {
                    this.autoScanToggle.checked = false;
                    const stats = this.usageTracker.getUsageStats();

                    // Show appropriate message based on current plan
                    if (stats.current_plan === 'trial') {
                        if (stats.trial_days_remaining <= 0) {
                            this.updateStatus('Trial expired - cannot enable auto-scan', 'error');
                            this.showTrialExpiredMessage();
                        } else {
                            this.updateStatus('Trial limit reached - cannot enable auto-scan', 'error');
                            this.showTrialLimitReachedMessage();
                        }
                    } else {
                        this.updateStatus('Plan limit reached - cannot enable auto-scan', 'error');
                        this.showTrialLimitReachedMessage(); // Fallback
                    }

                    this.disableScanning();
                    return;
                }
            } catch (error) {
                console.error('❌ Error checking auto-scan permission:', error);
                this.autoScanToggle.checked = false;
                this.updateStatus('Error checking permissions', 'error');
                return;
            }
        }

        try {
            // Save setting FIRST to ensure it's persisted
            console.log(`💾 Saving auto-scan state: ${isEnabled}`);

            // If enabling auto-scan, store the current website
            if (isEnabled) {
                const currentWebsite = window.location.href;
                const currentHostname = window.location.hostname;
                console.log(`🌐 Storing tracked website: ${currentHostname} (${currentWebsite})`);
                await chrome.storage.local.set({
                    autoScanEnabled: isEnabled,
                    trackedWebsite: currentWebsite,
                    trackedHostname: currentHostname
                });
            } else {
                await chrome.storage.local.set({ autoScanEnabled: isEnabled });
            }
            console.log('✅ Auto-scan state saved to storage');

            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

            // Check if content script is available first
            let response;
            try {
                response = await chrome.tabs.sendMessage(tab.id, { action: 'ping' });
            } catch (pingError) {
                // If ping fails, try to inject content script
                console.log('📝 Content script not loaded, attempting to inject...');
                await this.injectContentScript();

                // Wait a moment for injection to complete
                await new Promise(resolve => setTimeout(resolve, 1000));

                // Try ping again
                try {
                    response = await chrome.tabs.sendMessage(tab.id, { action: 'ping' });
                } catch (retryError) {
                    throw new Error('Content script injection failed');
                }
            }

            if (!response || !response.success) {
                throw new Error('Content script not available on this page');
            }

            if (isEnabled) {
                await chrome.tabs.sendMessage(tab.id, {
                    action: 'startAutoScan',
                    url: tab.url,
                    usageTracker: 'enabled' // Signal to content script to track usage
                });
                this.updateStatus('🔄 Auto-scanning enabled for current website', 'success');
                this.updateAutoScanIndicator(true);
            } else {
                await chrome.tabs.sendMessage(tab.id, { action: 'stopAutoScan' });
                this.updateStatus('Auto-scanning disabled', 'info');
                this.updateAutoScanIndicator(false);
            }

        } catch (error) {
            console.error('❌ Error toggling auto-scan:', error);
            this.autoScanToggle.checked = !isEnabled;

            // Provide user-friendly error message
            if (error.message.includes('Content script not available') ||
                error.message.includes('Content script injection failed') ||
                error.message.includes('Could not establish connection')) {
                this.updateStatus('Auto-scan requires page refresh. Please reload the page and try again.', 'warning');
            } else {
                this.updateStatus('Failed to toggle auto-scan: ' + error.message, 'error');
            }
        }
    }

    async loadAutoScanSettings() {
        try {
            const result = await chrome.storage.local.get(['autoScanEnabled']);
            if (result.autoScanEnabled !== undefined) {
                this.autoScanToggle.checked = result.autoScanEnabled;
                this.updateAutoScanIndicator(result.autoScanEnabled);
                console.log(`🔄 Loaded auto-scan setting: ${result.autoScanEnabled}`);
            }
        } catch (error) {
            console.error('❌ Failed to load auto-scan settings:', error);
        }
    }

    updateAutoScanIndicator(isActive) {
        const autoScanConfig = document.querySelector('.auto-scan-config');
        if (autoScanConfig) {
            if (isActive) {
                autoScanConfig.style.background = '#e8f5e8';
                autoScanConfig.style.borderColor = '#28a745';
                autoScanConfig.style.borderWidth = '2px';
            } else {
                autoScanConfig.style.background = 'white';
                autoScanConfig.style.borderColor = '#e9ecef';
                autoScanConfig.style.borderWidth = '1px';
            }
        }
    }

    async loadFilterSettings() {
        try {
            const result = await chrome.storage.local.get(['issueFilter']);
            if (result.issueFilter) {
                this.currentFilter = result.issueFilter;
            }
            this.updateFilterButtons();
            console.log(`🔍 Loaded filter setting: ${this.currentFilter}`);
        } catch (error) {
            console.error('❌ Failed to load filter settings:', error);
        }
    }

    setFilter(filterType) {
        this.currentFilter = filterType;
        this.updateFilterButtons();
        this.displayIssues();
        this.saveFilterSettings();
        console.log(`🔍 Filter changed to: ${filterType}`);
    }

    updateFilterButtons() {
        // Remove active class from all buttons
        document.querySelectorAll('.filter-button').forEach(btn => {
            btn.classList.remove('active');
        });

        // Add active class to current filter button
        const activeButton = document.getElementById(`filter-${this.currentFilter}`);
        if (activeButton) {
            activeButton.classList.add('active');
        }
    }

    async saveFilterSettings() {
        try {
            await chrome.storage.local.set({ issueFilter: this.currentFilter });
            console.log(`🔍 Saved filter setting: ${this.currentFilter}`);
        } catch (error) {
            console.error('❌ Failed to save filter settings:', error);
        }
    }

    getFilteredIssues() {
        if (this.currentFilter === 'all') {
            return this.issues;
        }
        return this.issues.filter(issue => issue.dataType === this.currentFilter);
    }

    updateStatus(message, type) {
        const statusElement = document.getElementById('status');
        if (statusElement) {
            statusElement.textContent = message;
            statusElement.className = `status ${type}`;
        }
    }

    updateScanButton(text, disabled) {
        const scanBtn = document.getElementById('scan-btn');
        if (scanBtn) {
            scanBtn.textContent = text;
            scanBtn.disabled = disabled;
        }
    }

    updateIssueCount() {
        const issueCountElement = document.getElementById('issue-count');
        if (issueCountElement) {
            const filteredIssues = this.getFilteredIssues();
            const totalIssues = this.issues.length;

            if (this.currentFilter === 'all') {
                issueCountElement.textContent = `${totalIssues} issues`;
            } else {
                issueCountElement.textContent = `${filteredIssues.length}/${totalIssues} ${this.currentFilter} issues`;
            }
        }
    }

    showProgress() {
        const progressSection = document.getElementById('progress-section');
        if (progressSection) {
            progressSection.style.display = 'block';
        }
    }

    hideProgress() {
        const progressSection = document.getElementById('progress-section');
        if (progressSection) {
            progressSection.style.display = 'none';
        }
    }

    updateProgress(current, total) {
        const progressFill = document.getElementById('progress-fill');
        const progressText = document.getElementById('progress-text');

        if (progressFill) {
            const percentage = (current / total) * 100;
            progressFill.style.width = `${percentage}%`;
        }

        if (progressText) {
            progressText.textContent = `Scanning... ${current}/${total}`;
        }
    }

    async loadPersistentIssues() {
        try {
            // Load from storage first
            const result = await chrome.storage.local.get(['persistentIssues']);
            if (result.persistentIssues) {
                this.issues = result.persistentIssues;
                this.displayIssues();
                this.updateButtonStates();
                console.log(`📦 Loaded ${this.issues.length} persistent issues from storage`);
            }

            // Also request current issues from content script (includes auto-scan issues)
            await this.loadCurrentIssuesFromContentScript();

        } catch (error) {
            console.error('❌ Failed to load persistent issues:', error);
        }
    }

    async loadCurrentIssuesFromContentScript() {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            const response = await chrome.tabs.sendMessage(tab.id, { action: 'getCurrentIssues' });

            if (response && response.success && response.issues) {
                // Merge with existing issues, avoiding duplicates
                const existingIds = new Set(this.issues.map(issue => issue.id));
                const newIssues = response.issues.filter(issue => !existingIds.has(issue.id));

                if (newIssues.length > 0) {
                    this.issues = [...this.issues, ...newIssues];
                    this.displayIssues();
                    this.updateButtonStates();
                    this.saveIssuesToStorage();
                    console.log(`📦 Loaded ${newIssues.length} current issues from content script`);
                }
            }
        } catch (error) {
            console.log('📝 Could not load current issues from content script (content script may not be loaded)');
        }
    }

    async saveIssuesToStorage() {
        try {
            await chrome.storage.local.set({ persistentIssues: this.issues });
            console.log(`💾 Saved ${this.issues.length} issues to storage`);
        } catch (error) {
            console.error('❌ Failed to save issues to storage:', error);
        }
    }

    async clearIssuesFromStorage() {
        try {
            await chrome.storage.local.remove(['persistentIssues']);
            console.log('🧹 Cleared issues from storage');
        } catch (error) {
            console.error('❌ Failed to clear issues from storage:', error);
        }
    }

    async clearAutoScanData() {
        try {
            // Clear auto-scan cache from storage
            await chrome.storage.local.remove(['autoScanCache']);
            console.log('🧹 Cleared auto-scan cache from storage');

            // Try to send message to content script to clear auto-scan cache
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tab) {
                try {
                    await chrome.tabs.sendMessage(tab.id, { action: 'clearAutoScanCache' });
                    console.log('🧹 Cleared auto-scan cache from content script');
                } catch (contentScriptError) {
                    // Content script not loaded - this is normal for some pages
                    console.log('📝 Content script not available for auto-scan cache clearing (normal for some pages)');
                }
            }
        } catch (error) {
            console.error('❌ Failed to clear auto-scan data:', error);
        }
    }

    async disableAutoScan() {
        try {
            // Set auto-scan to false in storage
            await chrome.storage.local.set({ autoScanEnabled: false });

            // Update the toggle UI
            if (this.autoScanToggle) {
                this.autoScanToggle.checked = false;
                this.updateAutoScanIndicator(false);
            }

            // Try to send message to content script to stop auto-scan
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tab) {
                try {
                    await chrome.tabs.sendMessage(tab.id, { action: 'stopAutoScan' });
                    console.log('🛑 Stopped auto-scan via content script');
                } catch (contentScriptError) {
                    // Content script not loaded - this is normal for some pages
                    console.log('📝 Content script not available for auto-scan stop (normal for some pages)');
                }
            }

            console.log('🛑 Auto-scan disabled');
        } catch (error) {
            console.error('❌ Failed to disable auto-scan:', error);
        }
    }

    async highlightIssues() {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            const response = await chrome.tabs.sendMessage(tab.id, { action: 'highlightIssues' });

            if (response && response.success) {
                this.updateStatus('Issues highlighted on page', 'success');
            } else {
                this.updateStatus('Failed to highlight issues: ' + (response.error || 'Unknown error'), 'error');
            }
        } catch (error) {
            console.error('❌ Highlight error:', error);
            this.updateStatus('Failed to highlight issues: ' + error.message, 'error');
        }
    }

    async cleanResults() {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            const response = await chrome.tabs.sendMessage(tab.id, { action: 'cleanResults' });

            if (response && response.success) {
                this.updateStatus('Results cleaned from page', 'success');
            } else {
                this.updateStatus('Failed to clean results: ' + (response.error || 'Unknown error'), 'error');
            }
        } catch (error) {
            console.error('❌ Clean error:', error);
            this.updateStatus('Failed to clean results: ' + error.message, 'error');
        }
    }

    handleDonation() {
        // Open Buy Me a Coffee page in new tab
        // Replace 'YOUR_USERNAME' with your actual Buy Me a Coffee username
        const buyMeACoffeeUrl = 'https://buymeacoffee.com/hamza.ks';
        chrome.tabs.create({ url: buyMeACoffeeUrl });
        console.log('☕ Opening Buy Me a Coffee page');
        this.updateStatus('Thank you for your support! ❤️', 'success');
    }

    async handleSignOut() {
        try {
            this.updateStatus('Signing out...', 'info');
            await this.authService.signOut();

            // Clear all local data
            await this.clearIssues();

            // Redirect to auth page
            window.location.href = '../auth/auth.html';
        } catch (error) {
            console.error('❌ Sign out error:', error);
            this.updateStatus('Failed to sign out: ' + error.message, 'error');
        }
    }



}

// Initialize popup when DOM is loaded

document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Initializing TranslateMe Popup...');
    console.log('📦 Version: 2.2.0 - Database Integration Fixed');
    console.log('🕒 Build Time: 2025-01-27 16:00:00');
    console.log('🔧 Features: Fixed database integration, scans and plan from DB');

    // Initialize Supabase client
    if (typeof window.supabase !== 'undefined' && window.supabase.createClient && typeof SUPABASE_CONFIG !== 'undefined') {
        console.log('🔧 Creating Supabase client...');
        window.supabase = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
        console.log('✅ Supabase client created');
    } else {
        console.log('❌ Supabase client or config not available');
        console.log('🔍 window.supabase:', typeof window.supabase);
        console.log('🔍 SUPABASE_CONFIG:', typeof SUPABASE_CONFIG);
    }

    new TranslateMePopup();
    console.log('✅ TranslateMe Popup ready');
});


