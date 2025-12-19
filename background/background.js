// Enhanced Background Script for TranslateMe Extension
// Console logs are silenced in production - enable dev mode via chrome.storage.local.set({ devMode: true })

// Simple console override for background script (service worker context)
(function() {
    'use strict';
    let devMode = false;
    const originalConsole = {
        log: console.log,
        error: console.error,
        warn: console.warn,
        info: console.info,
        debug: console.debug
    };

    function silenceConsole() {
        console.log = function() {};
        console.error = function() {};
        console.warn = function() {};
        console.info = function() {};
        console.debug = function() {};
    }

    function restoreConsole() {
        console.log = originalConsole.log;
        console.error = originalConsole.error;
        console.warn = originalConsole.warn;
        console.info = originalConsole.info;
        console.debug = originalConsole.debug;
    }

    // Check dev mode from storage
    chrome.storage.local.get(['devMode'], (result) => {
        devMode = result.devMode === true;
        if (devMode) {
            restoreConsole();
        } else {
            silenceConsole();
        }
    });

    // Default to silent (production)
    silenceConsole();
})();

console.log('🚀 Background script loaded');

chrome.runtime.onInstalled.addListener((details) => {
    console.log('TranslateMe Extension installed');

    // Set default configuration
    chrome.storage.sync.set({
        selectedLanguage: 'en',
        confidenceThreshold: 0.6,
        scanSettings: {
            includeImages: false,
            scanFrequency: 'manual',
            autoHighlight: false
        }
    });

    // Create context menu item
    chrome.contextMenus.create({
        id: 'scan-page',
        title: 'Scan this page with TranslateMe',
        contexts: ['page']
    });
    
    // Verify commands on install
    chrome.commands.getAll((commands) => {
        console.log('🔧 Background: Available commands on install:', commands);
        if (!commands || commands.length === 0) {
            console.error('❌ Background: No commands found! Check manifest.json');
        }
    });
});

// Initialize context menu on startup (in case extension was already installed)
chrome.runtime.onStartup.addListener(() => {
    chrome.contextMenus.create({
        id: 'scan-page',
        title: 'Scan this page with TranslateMe',
        contexts: ['page']
    });
});

// Handle extension icon click
chrome.action.onClicked.addListener((tab) => {
    console.log('Extension icon clicked');
});

// Minimal Supabase RPC helper for background context
async function callSupabaseRpc(functionName, params) {
    try {
        const supabaseUrl = 'https://ikrbjqzsrubizrranzjt.supabase.co';
        const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlrcmJqcXpzcnViaXpycmFuemp0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg1NTcyODQsImV4cCI6MjA3NDEzMzI4NH0.d_yD-Nl0Fmgtsum3X3g0t1vfRVfTOwzaGZsceGMG430';

        console.log(`🌐 Background: Making RPC call to ${functionName}`, params);

        const response = await fetch(`${supabaseUrl}/rest/v1/rpc/${functionName}`, {
            method: 'POST',
            headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(params)
        });

        console.log(`🌐 Background: RPC response status: ${response.status}`);

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`❌ Background: RPC ${functionName} failed:`, response.status, errorText);
            throw new Error(`RPC ${functionName} failed: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        console.log(`✅ Background: RPC ${functionName} success:`, data);
        return { data, error: null };
    } catch (error) {
        console.error(`❌ Background: RPC ${functionName} error:`, error);
        return { data: null, error };
    }
}

// Handle messages from content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'logScan') {
        console.log('Page scan completed:', request.data);
    }

    if (request.action === 'autoScanUsage') {
        // Record auto-scan usage even when popup is closed
        (async () => {
            try {
                console.log('📊 Background: Received autoScanUsage message:', request.scanData);
                const { url, elementsScanned } = request.scanData || {};
                // Read cached auth user from storage (set by auth service/popup)
                const { currentUser } = await chrome.storage.local.get(['currentUser']);
                console.log('👤 Background: Current user from storage:', currentUser);

                if (!currentUser?.id) {
                    console.log('⚠️ Background: No currentUser in storage; cannot record usage');
                    return;
                }

                const { data, error } = await callSupabaseRpc('record_scan_with_auto_transition', {
                    user_google_id: currentUser.id,
                    scan_type: 'auto_scan',
                    page_url: url || '',
                    elements_scanned: elementsScanned || 0
                });

                if (error) {
                    console.error('❌ Background: Failed to record auto-scan usage:', error);
                    return;
                }

                // Optionally notify popup if it's open to refresh counters
                chrome.runtime.sendMessage({ action: 'usageUpdated', payload: data }).catch(() => { });
                console.log('✅ Background: Auto-scan usage recorded');
            } catch (e) {
                console.error('❌ Background: autoScanUsage handling error:', e);
            }
        })();
        return; // no response expected
    }

    if (request.action === 'manualScanUsage') {
        // Record manual scan usage when popup might be closed
        (async () => {
            try {
                console.log('📊 Background: Received manualScanUsage message:', request.scanData);
                const { url, elementsScanned } = request.scanData || {};
                const { currentUser } = await chrome.storage.local.get(['currentUser']);
                console.log('👤 Background: Current user from storage:', currentUser);

                if (!currentUser?.id) {
                    console.log('⚠️ Background: No currentUser in storage; cannot record manual usage');
                    return;
                }

                const { data, error } = await callSupabaseRpc('record_scan_with_auto_transition', {
                    user_google_id: currentUser.id,
                    scan_type: 'manual',
                    page_url: url || '',
                    elements_scanned: elementsScanned || 0
                });

                if (error) {
                    console.error('❌ Background: Failed to record manual scan usage:', error);
                    return;
                }

                chrome.runtime.sendMessage({ action: 'usageUpdated', payload: data }).catch(() => { });
                console.log('✅ Background: Manual scan usage recorded');
            } catch (e) {
                console.error('❌ Background: manualScanUsage handling error:', e);
            }
        })();
        return;
    }

    if (request.action === 'streamIssue') {
        // Forward streaming issue to popup
        console.log('📡 Received streaming issue:', request.issue);
        // Forward to popup if it's open
        chrome.runtime.sendMessage({
            action: 'streamIssue',
            issue: request.issue
        }).catch(() => {
            // Popup might not be open, ignore error
        });
    }

    if (request.action === 'progressUpdate') {
        // Forward progress update to popup
        console.log('📊 Received progress update:', request.current, '/', request.total);
        // Forward to popup if it's open
        chrome.runtime.sendMessage({
            action: 'progressUpdate',
            current: request.current,
            total: request.total
        }).catch(() => {
            // Popup might not be open, ignore error
        });
    }

    if (request.action === 'getSettings') {
        chrome.storage.sync.get(['scanSettings'], (result) => {
            sendResponse(result.scanSettings || {});
        });
        return true;
    }

    if (request.action === 'trackingStatusUpdate') {
        // Forward tracking status update to popup
        console.log('📊 Received tracking status update:', request.isTracking, request.currentUrl);
        // Forward to popup if it's open
        chrome.runtime.sendMessage({
            action: 'trackingStatusUpdate',
            isTracking: request.isTracking,
            currentUrl: request.currentUrl,
            targetUrls: request.targetUrls
        }).catch(() => {
            // Popup might not be open, ignore error
        });
    }

    if (request.action === 'sendToOpenRouter') {
        // Handle OpenRouter API requests from content script
        console.log('🤖 Background: Handling OpenRouter request');
        handleOpenRouterRequest(request, sendResponse);
        return true; // Keep message channel open for async response
    }
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === 'scan-page') {
        console.log('🔍 Context menu: Scanning page', tab.url);
        // Send message to content script to trigger scan
        chrome.tabs.sendMessage(tab.id, { action: 'scanPage' }).catch((error) => {
            console.log('📝 Context menu: Could not send scan message (content script may not be loaded)');
        });
    }
});

// Handle keyboard shortcut commands
console.log('🔧 Background: Setting up keyboard command listener');

// Verify commands are available immediately
chrome.commands.getAll((commands) => {
    console.log('🔧 Background: Available commands:', commands);
    if (!commands || commands.length === 0) {
        console.error('❌ Background: WARNING - No commands found! Extension may need to be reloaded.');
    }
});

chrome.commands.onCommand.addListener((command) => {
    console.log('⌨️ Background: Command received:', command);
    
    // Show notification to confirm command is working
    chrome.notifications.create({
        type: 'basic',
        iconUrl: 'assets/icons/icon48.png',
        title: 'TranslateMe',
        message: `Command received: ${command}`
    }).catch(() => {
        // Notifications permission might not be granted, that's ok
    });
    
    if (command === 'scan-page') {
        console.log('⌨️ Keyboard shortcut: scan-page command triggered');
        // Get active tab and send scan message (same approach as context menu)
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            console.log('⌨️ Keyboard shortcut: Tabs query result:', tabs ? tabs.length : 'null');
            if (tabs && tabs.length > 0 && tabs[0]) {
                const tab = tabs[0];
                console.log('⌨️ Keyboard shortcut: Active tab URL:', tab.url);
                // Check if tab URL is valid (not chrome://, chrome-extension://, etc.)
                if (tab.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('chrome-extension://') && !tab.url.startsWith('edge://')) {
                    console.log('⌨️ Keyboard shortcut: Sending scanPage message to tab', tab.id);
                    chrome.tabs.sendMessage(tab.id, { action: 'scanPage' }, (response) => {
                        if (chrome.runtime.lastError) {
                            console.log('📝 Keyboard shortcut: Could not send scan message -', chrome.runtime.lastError.message);
                            // Content script might not be loaded, try to inject it
                            console.log('⌨️ Keyboard shortcut: Attempting to inject content script...');
                            chrome.scripting.executeScript({
                                target: { tabId: tab.id },
                                files: ['libs/logger.js', 'libs/franc.js', 'libs/languageDetector.js', 'libs/supabase-local.js', 'config/supabase.config.js', 'config/api.config.js', 'services/usageTracker.js', 'content/content.js']
                            }).then(() => {
                                console.log('⌨️ Keyboard shortcut: Content script injected, waiting for initialization...');
                                // Wait a moment for content script to initialize, then try again
                                setTimeout(() => {
                                    console.log('⌨️ Keyboard shortcut: Retrying scanPage message after injection...');
                                    chrome.tabs.sendMessage(tab.id, { action: 'scanPage' }, (response) => {
                                        if (chrome.runtime.lastError) {
                                            console.log('❌ Keyboard shortcut: Still failed after injection -', chrome.runtime.lastError.message);
                                        } else {
                                            console.log('✅ Keyboard shortcut: Scan triggered after injection, response:', response);
                                        }
                                    });
                                }, 1000);
                            }).catch((error) => {
                                console.log('❌ Keyboard shortcut: Failed to inject content script -', error.message);
                            });
                        } else {
                            console.log('✅ Keyboard shortcut: Scan triggered successfully, response:', response);
                        }
                    });
                } else {
                    console.log('📝 Keyboard shortcut: Cannot scan this page type (chrome:// or extension page):', tab.url);
                }
            } else {
                console.log('📝 Keyboard shortcut: No active tab found');
            }
        });
    } else {
        console.log('⌨️ Background: Unknown command received:', command);
    }
});
console.log('✅ Background: Keyboard command listener registered');

// Verify commands on startup
chrome.runtime.onStartup.addListener(() => {
    chrome.commands.getAll((commands) => {
        console.log('🔧 Background: Available commands on startup:', commands);
    });
});

// Also verify on install
chrome.runtime.onInstalled.addListener((details) => {
    chrome.commands.getAll((commands) => {
        console.log('🔧 Background: Available commands on install:', commands);
    });
});

// Handle OpenRouter API requests
async function handleOpenRouterRequest(request, sendResponse) {
    try {
        const { prompt, config } = request;

        console.log('🤖 Background: Sending request to OpenRouter...');
        console.log('🔍 Background: Config:', {
            baseUrl: config.baseUrl,
            model: config.model,
            apiKey: config.apiKey ? `${config.apiKey.substring(0, 10)}...` : 'MISSING'
        });

        const response = await fetch(config.baseUrl || 'https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${config.apiKey}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'chrome-extension://' + chrome.runtime.id,
                'X-Title': 'TranslateMe Extension'
            },
            body: JSON.stringify({
                model: config.model || 'deepseek/deepseek-chat',
                messages: [{ role: 'user', content: prompt }],
                max_tokens: config.maxTokens || 200,
                temperature: config.temperature || 0.3
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`❌ Background: OpenRouter API error ${response.status}:`, errorText);
            sendResponse({
                success: false,
                error: `OpenRouter API error ${response.status}: ${errorText}`
            });
            return;
        }

        const data = await response.json();

        if (!data.choices || !data.choices[0] || !data.choices[0].message) {
            throw new Error('Invalid response format from OpenRouter API');
        }

        const content = data.choices[0].message.content;
        console.log('🤖 Background: Raw OpenRouter Response:', content);

        // Parse simple response format
        const results = content.trim().split('\n').map(line => line.trim()).filter(line => line.length > 0);
        console.log('🤖 Background: Parsed OpenRouter Results:', results);

        sendResponse({
            success: true,
            results: results
        });

    } catch (error) {
        console.error('❌ Background: OpenRouter request failed:', error);
        sendResponse({
            success: false,
            error: error.message || 'Unknown error'
        });
    }
}

// Handle OAuth callback from Google sign-in (for Brave and other browsers)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url) {
        // Check if this is an OAuth callback from Supabase
        const redirectUrl = chrome.identity.getRedirectURL();
        console.log('🔍 Checking tab URL:', tab.url, 'against redirect URL:', redirectUrl);
        
        if (tab.url && tab.url.startsWith(redirectUrl)) {
            console.log('🔐 OAuth callback detected:', tab.url);
            
            try {
                // Extract hash fragment (contains access_token, etc.)
                const urlObj = new URL(tab.url);
                const hash = urlObj.hash.substring(1); // Remove #
                const params = new URLSearchParams(hash);
                
                const accessToken = params.get('access_token');
                const refreshToken = params.get('refresh_token');
                const error = params.get('error');
                const errorDescription = params.get('error_description');
                
                console.log('🔐 OAuth params extracted:', { 
                    hasAccessToken: !!accessToken, 
                    hasRefreshToken: !!refreshToken,
                    error: error 
                });
                
                if (error) {
                    console.error('❌ OAuth error:', error, errorDescription);
                    // Notify popup of error
                    chrome.runtime.sendMessage({
                        action: 'oauthError',
                        error: error,
                        errorDescription: errorDescription
                    }).catch(() => {});
                    // Close the OAuth callback tab
                    chrome.tabs.remove(tabId).catch(() => {});
                    return;
                }
                
                if (accessToken) {
                    console.log('✅ OAuth tokens received');
                    // Store tokens and notify popup
                    chrome.storage.local.set({
                        oauthCallback: {
                            access_token: accessToken,
                            refresh_token: refreshToken,
                            timestamp: Date.now()
                        }
                    }, () => {
                        // Notify popup to process OAuth callback
                        chrome.runtime.sendMessage({
                            action: 'oauthCallback',
                            access_token: accessToken,
                            refresh_token: refreshToken
                        }).catch((err) => {
                            console.error('❌ Failed to send OAuth callback message:', err);
                        });
                        
                        // Close the OAuth callback tab after a short delay
                        setTimeout(() => {
                            chrome.tabs.remove(tabId).catch(() => {});
                        }, 500);
                    });
                } else {
                    console.warn('⚠️ OAuth callback URL detected but no access_token found');
                }
            } catch (err) {
                console.error('❌ Error processing OAuth callback:', err);
            }
        }
        
        // Log tab updates for debugging (only for extension URLs to reduce noise)
        if (tab.url && tab.url.startsWith('chrome-extension://')) {
            console.log('Tab updated:', tab.url);
        }
    }
});