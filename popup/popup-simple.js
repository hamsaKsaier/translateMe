// Simple Pro Upgrade Request Handler
// This replaces the complex Supabase integration with a simple email input form

class SimpleProUpgradeHandler {
    constructor() {
        this.setupHandlers();
    }

    setupHandlers() {
        const sendRequestBtn = document.getElementById('send-upgrade-request-btn');
        const dismissBtn = document.getElementById('dismiss-upgrade-btn');
        const emailInput = document.getElementById('upgrade-email');

        if (sendRequestBtn) {
            sendRequestBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.handleUpgradeRequest();
            });
        }

        if (dismissBtn) {
            dismissBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.hideUpgradeSection();
            });
        }

        // Auto-fill email if available
        if (emailInput) {
            this.autoFillEmail(emailInput);
        }
    }

    async autoFillEmail(emailInput) {
        try {
            let userEmail = null;

            // Try to get email from various sources
            if (window.usageTracker) {
                const stats = window.usageTracker.getUsageStats();
                if (stats && stats.user_email) {
                    userEmail = stats.user_email;
                }
            }

            if (userEmail) {
                emailInput.value = userEmail;
                console.log('✅ Auto-filled email:', userEmail);
            }
        } catch (error) {
            console.log('❌ Failed to auto-fill email:', error);
        }
    }

    async handleUpgradeRequest() {
        try {
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

            console.log('🚀 Pro upgrade request submitted:', userEmail);

            // Get user info
            let userInfo = {};
            if (window.usageTracker) {
                try {
                    const stats = window.usageTracker.getUsageStats();
                    if (stats) {
                        userInfo = {
                            name: stats.user_name || userEmail.split('@')[0],
                            current_plan: stats.current_plan || 'free',
                            scans_used: stats.scans_used || 0,
                            scans_limit: stats.scans_limit || 50,
                            trial_days_remaining: stats.trial_days_remaining || 0
                        };
                    }
                } catch (error) {
                    console.log('❌ Failed to get user info:', error);
                }
            }

            // Log the request details
            console.log('📧 Pro Upgrade Request Details:');
            console.log('📧 User Email:', userEmail);
            console.log('📧 User Name:', userInfo.name || userEmail.split('@')[0]);
            console.log('📧 Current Plan:', userInfo.current_plan || 'free');
            console.log('📧 Scans Used:', userInfo.scans_used || 0);
            console.log('📧 Scans Limit:', userInfo.scans_limit || 50);
            console.log('📧 Trial Days Remaining:', userInfo.trial_days_remaining || 0);
            console.log('📧 Request Time:', new Date().toISOString());
            console.log('📧 Request ID:', 'req_' + Date.now());

            // Show success message
            this.showSuccessMessage();

            // Hide the upgrade section
            setTimeout(() => {
                this.hideUpgradeSection();
            }, 3000);

        } catch (error) {
            console.error('❌ Pro upgrade request failed:', error);
            this.showErrorMessage(error.message);
        }
    }

    showSuccessMessage() {
        const statusElement = document.getElementById('status');
        if (statusElement) {
            statusElement.textContent = '✅ Request received! We\'ll email you as soon as the Pro plan is available.';
            statusElement.className = 'status success';
        }
    }

    showErrorMessage(message) {
        const statusElement = document.getElementById('status');
        if (statusElement) {
            statusElement.textContent = `❌ ${message}`;
            statusElement.className = 'status error';
        }
    }

    hideUpgradeSection() {
        const upgradeSection = document.getElementById('pro-plan-upgrade');
        if (upgradeSection) {
            upgradeSection.style.display = 'none';
        }
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        new SimpleProUpgradeHandler();
    });
} else {
    new SimpleProUpgradeHandler();
}
