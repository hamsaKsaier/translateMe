// Auth Screen Script
class AuthScreen {
    constructor() {
        this.authService = authService;
        this.googleSignInBtn = document.getElementById('google-signin-btn');
        this.authStatus = document.getElementById('auth-status');
        this.authError = document.getElementById('auth-error');
        
        this.init();
    }

    async init() {
        console.log('🔐 Initializing auth screen...');
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Listen for OAuth callbacks from background script
        this.setupOAuthCallbackListener();
        
        // Check if user is already authenticated
        await this.checkExistingAuth();
    }

    setupOAuthCallbackListener() {
        // Listen for OAuth callback messages from background script
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            if (request.action === 'oauthCallback') {
                console.log('🔐 Received OAuth callback');
                this.handleOAuthCallback(request.access_token, request.refresh_token);
                sendResponse({ success: true });
            } else if (request.action === 'oauthError') {
                console.error('❌ OAuth error:', request.error, request.errorDescription);
                this.showError(request.errorDescription || request.error || 'OAuth authentication failed');
                this.resetSignInButton();
                sendResponse({ success: false });
            }
            return true; // Keep message channel open for async response
        });
    }

    async handleOAuthCallback(accessToken, refreshToken) {
        try {
            this.showStatus('Processing authentication...');
            
            await this.authService.handleOAuthCallback(accessToken, refreshToken);
            
            this.showStatus('✅ Sign in successful!');
            
            // Redirect to main popup after successful sign-in
            setTimeout(() => {
                this.redirectToMain();
            }, 1000);
        } catch (error) {
            console.error('❌ OAuth callback handling error:', error);
            const errorMessage = error.message || 
                                (typeof error === 'string' ? error : JSON.stringify(error)) ||
                                'Failed to complete authentication. Please try again.';
            this.showError(errorMessage);
            this.resetSignInButton();
        }
    }

    setupEventListeners() {
        this.googleSignInBtn.addEventListener('click', () => this.handleGoogleSignIn());
    }

    async checkExistingAuth() {
        try {
            const isAuthenticated = await this.authService.isAuthenticated();
            
            if (isAuthenticated) {
                console.log('✅ User already authenticated, redirecting...');
                this.showStatus('Already signed in! Redirecting...');
                setTimeout(() => {
                    this.redirectToMain();
                }, 500);
            }
        } catch (error) {
            console.error('❌ Error checking existing auth:', error);
        }
    }

    async handleGoogleSignIn() {
        try {
            this.googleSignInBtn.disabled = true;
            this.googleSignInBtn.innerHTML = '<div class="spinner"></div> Signing in...';
            this.hideError();
            this.showStatus('Connecting to Google...');

            // Use Chrome Identity API for better extension support
            const result = await this.authService.signInWithGoogleChrome();

            // Check if we're waiting for OAuth callback (happens in Brave/other browsers)
            if (result && result.waitingForCallback) {
                console.log('⏳ Waiting for OAuth callback...');
                console.log('🔐 Redirect URL:', result.redirectUrl);
                this.showStatus('Please complete sign-in in the new tab that opened...');
                // Don't reset button or redirect - wait for OAuth callback
                // The handleOAuthCallback method will handle the rest
                
                // Add a timeout to show helpful message if callback doesn't arrive
                setTimeout(() => {
                    // Check if we're still waiting (user hasn't completed sign-in)
                    chrome.storage.local.get(['oauthCallback'], (result) => {
                        if (!result.oauthCallback) {
                            console.warn('⚠️ OAuth callback timeout - user may need to check the new tab');
                            // Don't show error yet - user might still be signing in
                        }
                    });
                }, 60000); // 1 minute timeout
                
                return;
            }

            // If we get here, sign-in completed immediately (Chrome Identity API worked)
            this.showStatus('✅ Sign in successful!');
            
            // Redirect to main popup after successful sign-in
            setTimeout(() => {
                this.redirectToMain();
            }, 1000);

        } catch (error) {
            console.error('❌ Sign-in error:', error);
            // Extract meaningful error message
            let errorMessage = error.message || 
                              (typeof error === 'string' ? error : JSON.stringify(error)) ||
                              'Failed to sign in. Please try again.';
            
            // Add helpful guidance for common errors
            if (errorMessage.includes('invalid_request') || errorMessage.includes('verificationCode')) {
                const extensionId = chrome.runtime.id;
                errorMessage = `OAuth configuration error. Please ensure:\n\n` +
                             `1. Redirect URI is configured in Supabase:\n` +
                             `   chrome-extension://${extensionId}/\n\n` +
                             `2. Google OAuth is enabled in Supabase\n\n` +
                             `3. See BRAVE_OAUTH_SETUP.md for detailed setup instructions`;
            } else if (errorMessage.includes('No OAuth URL')) {
                errorMessage = `Supabase OAuth not configured. Please:\n\n` +
                             `1. Enable Google provider in Supabase Dashboard\n` +
                             `2. Add redirect URI: chrome-extension://${chrome.runtime.id}/\n` +
                             `3. Check your Supabase configuration`;
            }
            
            this.showError(errorMessage);
            this.resetSignInButton();
        }
    }

    redirectToMain() {
        // Close current popup and reopen to show main content
        // Store auth success flag and redirect
        chrome.storage.local.set({ authSuccess: true }, () => {
            window.location.href = '../popup/popup.html';
        });
    }

    showStatus(message) {
        this.authStatus.textContent = message;
        this.authStatus.classList.add('show');
        this.authStatus.style.display = 'block';
    }

    hideStatus() {
        this.authStatus.classList.remove('show');
        this.authStatus.style.display = 'none';
    }

    showError(message) {
        this.authError.textContent = message;
        this.authError.classList.add('show');
        this.authError.style.display = 'block';
    }

    hideError() {
        this.authError.classList.remove('show');
        this.authError.style.display = 'none';
    }

    resetSignInButton() {
        this.googleSignInBtn.disabled = false;
        this.googleSignInBtn.innerHTML = `
            <svg class="google-icon" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Sign in with Google
        `;
    }
}

// Initialize auth screen when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Loading auth screen...');
    new AuthScreen();
});

