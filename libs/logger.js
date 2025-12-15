// Logger Utility - Only logs in development mode
// Automatically overrides console methods to silence logs in production

(function() {
    'use strict';

    let isDevMode = false;
    const originalConsole = {
        log: console.log,
        error: console.error,
        warn: console.warn,
        info: console.info,
        debug: console.debug
    };

    // Silence console in production (default)
    function silenceConsole() {
        if (typeof console !== 'undefined') {
            console.log = function() {};
            console.error = function() {};
            console.warn = function() {};
            console.info = function() {};
            console.debug = function() {};
        }
    }

    // Restore console in dev mode
    function restoreConsole() {
        if (typeof console !== 'undefined' && originalConsole) {
            console.log = originalConsole.log;
            console.error = originalConsole.error;
            console.warn = originalConsole.warn;
            console.info = originalConsole.info;
            console.debug = originalConsole.debug;
        }
    }

    // Detect dev mode
    function detectDevMode() {
        try {
            if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) {
                // Check storage for dev mode flag (async)
                if (chrome.storage && chrome.storage.local) {
                    chrome.storage.local.get(['devMode'], (result) => {
                        if (result.devMode === true) {
                            isDevMode = true;
                            restoreConsole();
                        } else {
                            isDevMode = false;
                            silenceConsole();
                        }
                    });
                } else {
                    // If storage not available yet, default to production
                    isDevMode = false;
                    silenceConsole();
                }
            } else {
                // No chrome runtime, likely not in extension context
                isDevMode = false;
                silenceConsole();
            }
        } catch (e) {
            // Default to production (no logging)
            isDevMode = false;
            silenceConsole();
        }
    }

    // Logger API
    const Logger = {
        isDevMode: function() {
            return isDevMode;
        },

        log: function(...args) {
            if (isDevMode && originalConsole.log) {
                originalConsole.log(...args);
            }
        },

        error: function(...args) {
            if (isDevMode && originalConsole.error) {
                originalConsole.error(...args);
            }
        },

        warn: function(...args) {
            if (isDevMode && originalConsole.warn) {
                originalConsole.warn(...args);
            }
        },

        info: function(...args) {
            if (isDevMode && originalConsole.info) {
                originalConsole.info(...args);
            }
        },

        debug: function(...args) {
            if (isDevMode && originalConsole.debug) {
                originalConsole.debug(...args);
            }
        },

        // Enable dev mode programmatically
        enableDevMode: function() {
            isDevMode = true;
            restoreConsole();
            if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
                chrome.storage.local.set({ devMode: true });
            }
        },

        // Disable dev mode
        disableDevMode: function() {
            isDevMode = false;
            silenceConsole();
            if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
                chrome.storage.local.set({ devMode: false });
            }
        }
    };

    // Initialize: Default to production (silent), then check storage
    silenceConsole();
    detectDevMode();

    // Export logger
    const global = (function() {
        if (typeof window !== 'undefined') return window;
        if (typeof globalThis !== 'undefined') return globalThis;
        if (typeof self !== 'undefined') return self;
        return {};
    })();

    global.logger = Logger;

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = Logger;
    }
})();

