// Authentication Service for TranslateMe Extension
// Handles all authentication logic with Supabase

class AuthService {
    constructor() {
        this.supabase = null;
        this.currentUser = null;
        this.initialized = false;
        this._isBraveCache = undefined;
    }

    // Initialize Supabase client
    async init() {
        if (this.initialized) return;

        try {
            // Wait for Supabase to load
            await this.waitForSupabase();
            
            // Import Supabase client
            const { createClient } = supabase;
            
            // Create Supabase client
            this.supabase = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
            
            // Check for existing session
            const { data: { session } } = await this.supabase.auth.getSession();
            
            if (session) {
                this.currentUser = session.user;
                console.log('✅ User session restored:', this.currentUser.email);
            }

            // Listen for auth state changes
            this.supabase.auth.onAuthStateChange((event, session) => {
                console.log('🔐 Auth state changed:', event);
                if (session) {
                    this.currentUser = session.user;
                    this.saveUserToStorage();
                    this.notifyAuthChange(true);
                } else {
                    this.currentUser = null;
                    this.clearUserFromStorage();
                    this.notifyAuthChange(false);
                }
            });

            this.initialized = true;
            console.log('✅ AuthService initialized');
        } catch (error) {
            console.error('❌ Failed to initialize AuthService:', error);
            throw error;
        }
    }

    // Wait for Supabase to load
    async waitForSupabase() {
        let attempts = 0;
        const maxAttempts = 10; // 1 second max wait for local client
        
        while (typeof window.supabase === 'undefined' && attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
        }
        
        if (typeof window.supabase === 'undefined') {
            throw new Error('Supabase failed to load');
        }
        
        console.log('✅ Supabase is ready');
    }

    // Sign in with Google using OAuth (redirect-based, works in all browsers)
    async signInWithGoogle() {
        try {
            // Get the extension's redirect URL
            const redirectUrl = chrome.identity.getRedirectURL();
            console.log('🔐 Extension redirect URL:', redirectUrl);
            console.log('🔐 Extension ID:', chrome.runtime.id);

            // For Brave compatibility, we need to ensure the redirect URL is properly formatted
            // The redirect URL should be: chrome-extension://[extension-id]/
            const extensionId = chrome.runtime.id;
            const formattedRedirectUrl = `chrome-extension://${extensionId}/`;
            
            console.log('🔐 Formatted redirect URL:', formattedRedirectUrl);
            console.log('🔐 Supabase URL:', SUPABASE_CONFIG.url);

            // Use Supabase OAuth with proper redirect configuration
            const { data, error } = await this.supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: formattedRedirectUrl,
                    skipBrowserRedirect: true, // We'll handle the redirect manually
                    queryParams: {
                        // Add any additional query parameters if needed
                    }
                }
            });

            if (error) {
                const errorMessage = error.message || JSON.stringify(error);
                console.error('❌ Google sign-in error:', errorMessage);
                console.error('❌ Full error object:', error);
                throw new Error(`OAuth initialization failed: ${errorMessage}`);
            }

            if (!data || !data.url) {
                console.error('❌ No OAuth URL returned from Supabase');
                throw new Error('No OAuth URL returned from Supabase. Please check your Supabase configuration and ensure the redirect URL is registered.');
            }

            console.log('✅ Google sign-in initiated');
            console.log('🔐 OAuth URL:', data.url);
            
            // Open OAuth URL in a new tab/window
            chrome.tabs.create({ url: data.url }, (tab) => {
                if (chrome.runtime.lastError) {
                    console.error('❌ Failed to open OAuth tab:', chrome.runtime.lastError);
                } else {
                    console.log('✅ OAuth tab opened:', tab.id);
                }
            });
            
            // Return a special indicator that we're waiting for OAuth callback
            return { waitingForCallback: true, url: data.url, redirectUrl: formattedRedirectUrl };
        } catch (error) {
            const errorMessage = error.message || error.toString() || JSON.stringify(error);
            console.error('❌ Sign-in failed:', errorMessage);
            console.error('❌ Error stack:', error.stack);
            throw new Error(errorMessage);
        }
    }

    // Sign in with Google using Chrome Identity API (Chrome only, may fail in Brave)
    async signInWithGoogleChrome() {
        try {
            // Detect if we're in Brave browser using reliable async detection
            const isBrave = await this.isBraveBrowser();

            if (isBrave) {
                console.log('🦁 Brave browser detected - skipping Chrome Identity API, using OAuth redirect');
                console.log('ℹ️ Note: Even with "Allow Google login" enabled, Brave treats chrome.identity as 3rd party login');
                console.log('ℹ️ OAuth redirect flow works better with Supabase in Brave');
                return await this.signInWithGoogle();
            }

            // Check if Chrome Identity API is available
            if (!chrome.identity || !chrome.identity.getAuthToken) {
                console.log('⚠️ Chrome Identity API not available, falling back to OAuth redirect');
                return await this.signInWithGoogle();
            }

            // Get OAuth token from Chrome Identity API
            const token = await new Promise((resolve, reject) => {
                chrome.identity.getAuthToken({ interactive: true }, (token) => {
                    if (chrome.runtime.lastError) {
                        const error = chrome.runtime.lastError;
                        const errorMessage = error.message || '';
                        console.warn('⚠️ Chrome Identity API error:', errorMessage);
                        
                        // Check for various error types that indicate we should fallback to OAuth redirect
                        // Common in Brave and other Chromium-based browsers
                        const shouldFallback = 
                            errorMessage.includes('invalid') ||
                            errorMessage.includes('did not approve') ||
                            errorMessage.includes('OAuth2') ||
                            errorMessage.includes('bad client id') ||
                            errorMessage.includes('access_denied') ||
                            errorMessage.includes('verificationCode');
                        
                        if (shouldFallback) {
                            console.log('🔄 Chrome Identity API not supported, falling back to OAuth redirect');
                            console.log('ℹ️ This is expected in Brave - OAuth redirect will work');
                            reject(new Error('FALLBACK_TO_OAUTH'));
                        } else {
                            reject(error);
                        }
                    } else {
                        resolve(token);
                    }
                });
            });

            console.log('✅ Got Chrome OAuth token');

            // Exchange token with Supabase
            const { data, error } = await this.supabase.auth.signInWithIdToken({
                provider: 'google',
                token: token
            });

            if (error) {
                console.error('❌ Supabase token exchange error:', error.message || error);
                throw error;
            }

            this.currentUser = data.user;
            await this.saveUserToStorage();
            console.log('✅ User signed in:', this.currentUser.email);
            
            return data;
        } catch (error) {
            // If Chrome Identity API fails (e.g., in Brave), fallback to OAuth redirect
            const errorMessage = error.message || String(error);
            if (errorMessage === 'FALLBACK_TO_OAUTH' || 
                errorMessage.includes('invalid_request') ||
                errorMessage.includes('did not approve') ||
                errorMessage.includes('OAuth2')) {
                console.log('🔄 Falling back to OAuth redirect flow for browser compatibility');
                const result = await this.signInWithGoogle();
                // If OAuth redirect was triggered, return the waiting indicator
                if (result && result.waitingForCallback) {
                    return result;
                }
                return result;
            }
            // Log the actual error message instead of [object Object]
            const errorDetails = error.message || error.toString() || JSON.stringify(error);
            console.error('❌ Chrome Google sign-in failed:', errorDetails);
            throw error;
        }
    }

    // Detect Brave browser with caching to avoid repeated async calls
    async isBraveBrowser() {
        if (typeof this._isBraveCache !== 'undefined') {
            return this._isBraveCache;
        }

        try {
            // NavigatorUAData API (Chromium based browsers)
            const uaData = navigator.userAgentData;
            if (uaData && Array.isArray(uaData.brands)) {
                const brandMatch = uaData.brands.some((brand) => (brand.brand || '').toLowerCase().includes('brave'));
                if (brandMatch) {
                    this._isBraveCache = true;
                    return true;
                }
            }

            // User agent string fallback
            if ((navigator.userAgent || '').toLowerCase().includes('brave')) {
                this._isBraveCache = true;
                return true;
            }

            // Brave exposes navigator.brave.isBrave() → Promise<boolean>
            if (navigator.brave && typeof navigator.brave.isBrave === 'function') {
                const result = await navigator.brave.isBrave();
                if (typeof result === 'boolean') {
                    this._isBraveCache = result;
                    return result;
                }
            }
        } catch (error) {
            console.warn('⚠️ Brave detection failed, assuming non-Brave browser:', error);
        }

        this._isBraveCache = false;
        return false;
    }

    // Sign out
    async signOut() {
        try {
            // Remove Chrome OAuth token
            const token = await new Promise((resolve) => {
                chrome.identity.getAuthToken({ interactive: false }, (token) => {
                    resolve(token);
                });
            });

            if (token) {
                await new Promise((resolve) => {
                    chrome.identity.removeCachedAuthToken({ token: token }, () => {
                        resolve();
                    });
                });
            }

            // Sign out from Supabase
            const { error } = await this.supabase.auth.signOut();
            
            if (error) {
                console.error('❌ Sign-out error:', error);
                throw error;
            }

            this.currentUser = null;
            await this.clearUserFromStorage();
            console.log('✅ User signed out');
        } catch (error) {
            console.error('❌ Sign-out failed:', error);
            throw error;
        }
    }

    // Check if user is authenticated
    async isAuthenticated() {
        if (!this.initialized) {
            await this.init();
        }

        // Check current user
        if (this.currentUser) {
            return true;
        }

        // Check storage
        const userData = await this.getUserFromStorage();
        if (userData) {
            this.currentUser = userData;
            return true;
        }

        // Check Supabase session
        const { data: { session } } = await this.supabase.auth.getSession();
        if (session) {
            this.currentUser = session.user;
            await this.saveUserToStorage();
            return true;
        }

        return false;
    }

    // Get current user
    getCurrentUser() {
        return this.currentUser;
    }

    // Save user to Chrome storage
    async saveUserToStorage() {
        try {
            await chrome.storage.local.set({
                authUser: {
                    id: this.currentUser.id,
                    email: this.currentUser.email,
                    user_metadata: this.currentUser.user_metadata,
                    created_at: this.currentUser.created_at
                }
            });
            console.log('💾 User saved to storage');
        } catch (error) {
            console.error('❌ Failed to save user to storage:', error);
        }
    }

    // Get user from Chrome storage
    async getUserFromStorage() {
        try {
            const result = await chrome.storage.local.get(['authUser']);
            return result.authUser || null;
        } catch (error) {
            console.error('❌ Failed to get user from storage:', error);
            return null;
        }
    }

    // Clear user from Chrome storage
    async clearUserFromStorage() {
        try {
            await chrome.storage.local.remove(['authUser']);
            console.log('🧹 User cleared from storage');
        } catch (error) {
            console.error('❌ Failed to clear user from storage:', error);
        }
    }

    // Handle OAuth callback (for redirect-based flow)
    async handleOAuthCallback(accessToken, refreshToken) {
        try {
            console.log('🔐 Processing OAuth callback...');
            
            // Set the session with the tokens
            const { data: { session }, error } = await this.supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken
            });

            if (error) {
                console.error('❌ Failed to set session:', error);
                throw error;
            }

            if (session && session.user) {
                this.currentUser = session.user;
                await this.saveUserToStorage();
                console.log('✅ User signed in via OAuth callback:', this.currentUser.email);
                this.notifyAuthChange(true);
                return { user: this.currentUser, session };
            }

            throw new Error('No session created from OAuth callback');
        } catch (error) {
            console.error('❌ OAuth callback handling failed:', error);
            throw error;
        }
    }

    // Notify popup of auth state change
    notifyAuthChange(isAuthenticated) {
        chrome.runtime.sendMessage({
            action: 'authStateChanged',
            isAuthenticated: isAuthenticated,
            user: this.currentUser
        }).catch(() => {
            // Popup might not be open, ignore error
        });
    }
}

// Create singleton instance
const authService = new AuthService();

// Initialize on load
authService.init().catch(console.error);

