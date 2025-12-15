// Enhanced Content script for TranslateMe Extension
// 
// CONFIGURATION:
// To set your OpenAI API key, edit the getAPIConfig() method below (around line 523)
// To change the target language, edit the getTargetLanguage() method below (around line 566)
class TranslateMeScanner {
    constructor() {
        this.setupMessageListener();
        this.issueCounter = 0;
        this.highlightedIssues = new Map();
        this.highlightStyle = null;
        this.aiRequestQueue = [];
        this.isProcessingAIQueue = false;
        this.aiFailureCount = 0;
        this.maxAIFailures = 3;
        this.injectHighlightStyles();

        // DOM change tracking properties
        this.mutationObserver = null;
        this.isTrackingEnabled = false;
        this.targetUrls = [];
        this.currentUrl = window.location.href;
        this.changeDetectionDebounce = null;
        this.lastScanTime = 0;
        this.minScanInterval = 2000; // Minimum 2 seconds between auto-scans

        // Translation result caching
        this.translationCache = new Map(); // In-memory cache for current session
        this.cacheMaxSize = 1000; // Maximum number of cached translations
        this.cacheExpiryTime = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

        // API config cache to prevent parallel calls to different APIs
        this.apiConfigCache = null;
        this.apiConfigCacheTime = 0;
        this.apiConfigCacheDuration = 30000; // 30 seconds cache

        // Request deduplication to prevent multiple AI requests for same content
        this.pendingRequests = new Map(); // Track pending AI requests
        this.requestTimeout = 5000; // 5 seconds timeout for requests
        this.isScanning = false; // Prevent multiple simultaneous scans

        // Initialize usage tracker for content script
        this.initializeUsageTracker();

        // Refresh plan data from popup on page load
        this.refreshPlanData();

        // Auto-resume tracking state
        this.autoResumeEnabled = true; // Enable auto-resume after page refresh
        this.isAutoScanEnabled = false; // Will be set from storage

        // Initialize URL-based tracking
        this.initializeUrlBasedTracking();

        // Load persistent cache
        this.loadPersistentCache();

        // Check if auto-scan should be enabled after page refresh
        this.checkAutoScanState();

        // Expose debug methods globally for testing
        window.forceFreePlan = () => this.forceFreePlan();
        window.clearAPICache = () => this.clearAPICache();
        window.clearPendingRequests = () => this.clearPendingRequests();
    }

    async initializeUsageTracker() {
        try {
            console.log('🔄 Content script: Initializing usage tracker...');
            console.log('🔍 Content script: Checking available objects...');
            console.log('🔍 Content script: window.API_CONFIG available:', typeof window.API_CONFIG !== 'undefined');
            console.log('🔍 Content script: window.UsageTracker available:', typeof window.UsageTracker !== 'undefined');
            console.log('🔍 Content script: window.supabase available:', typeof window.supabase !== 'undefined');

            // Content script doesn't need full UsageTracker - just send messages to background
            console.log('📊 Content script: Using background script for usage tracking');
            window.usageTracker = {
                // Mock usage tracker for content script - all operations go to background
                recordScan: async (scanType, pageUrl, elementsScanned) => {
                    console.log(`📊 Content script: Sending ${scanType} scan to background for recording`);
                    chrome.runtime.sendMessage({
                        action: scanType === 'auto_scan' ? 'autoScanUsage' : 'manualScanUsage',
                        scanData: {
                            url: pageUrl,
                            elementsScanned: elementsScanned,
                            timestamp: Date.now(),
                            scanType: scanType
                        }
                    }).catch(() => {
                        console.log('📝 Content script: Could not send usage data to background');
                    });
                },
                isAuthenticated: () => true, // Assume authenticated if content script is running
                getUsageStats: () => ({ current_plan: 'trial', scans_used: 0, scans_limit: 100 })
            };
        } catch (error) {
            console.error('❌ Content script: Failed to initialize usage tracker:', error);
            // Don't throw the error, just log it and continue
        }
    }

    async refreshPlanData() {
        try {
            console.log('🔄 Content script: Refreshing plan data from popup...');

            // Clear API config cache when refreshing plan data
            this.apiConfigCache = null;
            this.apiConfigCacheTime = 0;
            console.log('📊 Content script: Cleared API config cache for fresh plan data');

            // Try to get fresh plan data from popup
            try {
                const response = await chrome.runtime.sendMessage({ action: 'getUserPlan' });
                if (response && response.plan) {
                    console.log(`📊 Content script: Got fresh plan from popup: ${response.plan}`);

                    // Store the fresh plan data in storage
                    await chrome.storage.local.set({
                        currentPlan: response.plan,
                        lastPlanUpdate: Date.now()
                    });

                    console.log(`✅ Content script: Updated plan in storage: ${response.plan}`);
                    return response.plan;
                }
            } catch (popupError) {
                console.log('📊 Content script: Could not get fresh plan from popup (popup may be closed)');
            }

            // If popup is not available, check existing storage
            const result = await chrome.storage.local.get(['currentPlan', 'lastPlanUpdate']);
            if (result.currentPlan) {
                console.log(`📊 Content script: Using existing plan from storage: ${result.currentPlan}`);
                return result.currentPlan;
            }

            console.log('📊 Content script: No plan data available, will use trial as fallback');
            return 'trial';

        } catch (error) {
            console.error('❌ Content script: Failed to refresh plan data:', error);
            return 'trial';
        }
    }

    async checkAutoScanState() {
        try {
            console.log('🔍 Checking auto-scan state after page refresh...');

            // Check if auto-scan was enabled before refresh
            const result = await chrome.storage.local.get(['autoScanEnabled', 'trackedWebsite', 'trackedHostname']);
            console.log('📊 Storage result:', result);

            if (result.autoScanEnabled === true) {
                // Check if we're still on the same website
                const currentHostname = window.location.hostname;
                if (result.trackedHostname && result.trackedHostname !== currentHostname) {
                    console.log(`🌐 Website changed from ${result.trackedHostname} to ${currentHostname}, disabling auto-scan`);
                    this.isAutoScanEnabled = false;
                    await chrome.storage.local.set({ autoScanEnabled: false });
                    return;
                }

                // Check user's plan before enabling auto-scan
                const userPlan = await this.getUserPlan();
                console.log(`📊 User plan: ${userPlan}`);

                if (userPlan === 'free') {
                    console.log('🚫 Auto-scan disabled for free plan user');
                    // Disable auto-scan for free plan users
                    this.isAutoScanEnabled = false;
                    await chrome.storage.local.set({ autoScanEnabled: false });
                    return;
                }

                console.log('✅ Auto-scan was enabled before refresh, re-enabling...');
                this.isAutoScanEnabled = true;
                this.initializeAutoScanner();

                // Verify the auto scanner was created and started
                if (this.autoScanner && this.autoScanner.isEnabled) {
                    console.log('✅ Auto-scanner successfully initialized and started');
                } else {
                    console.error('❌ Auto-scanner failed to initialize properly');
                }
            } else {
                console.log('📝 Auto-scan was not enabled before refresh (value:', result.autoScanEnabled, ')');
            }
        } catch (error) {
            console.error('❌ Error checking auto-scan state:', error);
        }
    }

    setupMessageListener() {
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            console.log('📨 Content script received message:', request);

            if (request.action === 'ping' || request.action === 'getStatus') {
                sendResponse({ success: true, message: 'Content script is ready' });
                return true;
            }

            if (request.action === 'scanPage') {
                this.scanPage().then(issues => {
                    sendResponse({ success: true, issues: issues });
                }).catch(error => {
                    console.error('❌ Scan error:', error);
                    sendResponse({ success: false, error: error.message });
                });
                return true; // Keep message channel open for async response
            }

            if (request.action === 'getStatus') {
                sendResponse({
                    success: true,
                    status: 'ready',
                    url: window.location.href,
                    issues: this.highlightedIssues.size
                });
            }

            if (request.action === 'getCurrentIssues') {
                const currentIssues = Array.from(this.highlightedIssues.values());
                sendResponse({
                    success: true,
                    issues: currentIssues,
                    count: currentIssues.length
                });
            }

            if (request.action === 'clearAutoScanCache') {
                this.autoScanner?.clearPersistentCache();
                sendResponse({ success: true });
            }

            if (request.action === 'triggerAutoScan') {
                if (this.autoScanner) {
                    this.autoScanner.scheduleScan();
                    sendResponse({ success: true, message: 'Auto-scan triggered' });
                } else {
                    sendResponse({ success: false, message: 'Auto-scan not enabled' });
                }
            }

            if (request.action === 'startAutoTracking') {
                this.startAutoTracking(request.url);
                sendResponse({ success: true });
            }

            if (request.action === 'stopAutoTracking') {
                this.stopAutoTracking();
                sendResponse({ success: true });
            }

            if (request.action === 'startAutoScan') {
                this.startAutoScan(request.url);
                sendResponse({ success: true });
            }

            if (request.action === 'stopAutoScan') {
                this.stopAutoScan();
                sendResponse({ success: true });
            }


            if (request.action === 'highlightIssues') {
                this.highlightAllIssues();
                sendResponse({ success: true });
            }

            if (request.action === 'cleanResults') {
                this.cleanAllHighlights();
                sendResponse({ success: true });
            }

            if (request.action === 'clearAutoScanCache') {
                if (this.autoScanner) {
                    this.autoScanner.clearPersistentCache();
                    console.log('🧹 AutoScanner: Cache cleared via message');
                }
                sendResponse({ success: true });
            }

        });
    }


    injectHighlightStyles() {
        if (document.getElementById('translateme-styles')) return;

        const style = document.createElement('style');
        style.id = 'translateme-styles';
        style.textContent = `
            .translateme-issue {
                background-color: #ffeb3b !important;
                border: 2px solid #ff9800 !important;
                border-radius: 3px !important;
                position: relative !important;
            }
            .translateme-issue::after {
                content: "⚠️ Translation Issue" !important;
                position: absolute !important;
                top: -20px !important;
                left: 0 !important;
                background: #ff9800 !important;
                color: white !important;
                padding: 2px 6px !important;
                font-size: 10px !important;
                border-radius: 3px !important;
                z-index: 10000 !important;
            }
        `;
        document.head.appendChild(style);
        console.log('✅ Highlight styles injected');
    }

    async scanPage() {
        console.log('🔍 Starting page scan...');
        const issues = [];

        try {
            // Get all text elements
            const textElements = this.getTextElements();
            console.log(`📊 Found ${textElements.length} text elements`);

            // Convert elements to text data format for smart batching
            const textDataArray = textElements.map(element => ({
                element: element,
                text: this.extractText(element),
                selector: this.getElementSelector(element),
                tagName: element.tagName,
                className: element.className
            }));

            // Filter out empty texts
            const validTextData = textDataArray.filter(textData =>
                textData.text && textData.text.length >= 3
            );

            console.log(`📊 Processing ${validTextData.length} valid text elements with smart batching`);

            // Create smart batches based on tokens and response time
            const batches = this.createSmartBatches(validTextData);
            console.log(`📊 Smart batching created ${batches.length} batches`);

            // Process batches in parallel with progress updates
            let processedElements = 0;
            const totalElements = validTextData.length;

            for (let i = 0; i < batches.length; i++) {
                const batch = batches[i];
                const batchElements = batch.map(textData => textData.element);

                console.log(`🔄 Processing batch ${i + 1}/${batches.length} (${batch.length} elements)`);

                const batchIssues = await this.processBatch(batchElements);
                issues.push(...batchIssues);

                processedElements += batch.length;

                // Send progress update
                chrome.runtime.sendMessage({
                    action: 'progressUpdate',
                    current: processedElements,
                    total: totalElements
                }).catch(() => { }); // Ignore errors if popup is closed
            }

            console.log(`✅ Scan completed: ${issues.length} issues found using smart batching`);
            return issues;

        } catch (error) {
            console.error('❌ Scan failed:', error);
            throw error;
        }
    }

    getTextElements() {
        const selectors = [
            'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
            'p', 'span', 'a', 'button',
            'input[placeholder]', 'textarea[placeholder]',
            'label', 'li', 'td', 'th'
        ];

        const elements = [];
        selectors.forEach(selector => {
            const found = document.querySelectorAll(selector);
            found.forEach(el => {
                if (this.hasTextContent(el) &&
                    !this.isHiddenElement(el) &&
                    !this.hasChildTextElements(el) &&
                    !this.isContainerElement(el)) {
                    elements.push(el);
                }
            });
        });

        return elements;
    }

    hasTextContent(element) {
        const text = this.extractText(element);
        return text && text.trim().length > 0;
    }

    hasChildTextElements(element) {
        // Check if element has child elements that contain text
        const textSelectors = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'span', 'a', 'button', 'label', 'li', 'td', 'th'];
        for (let selector of textSelectors) {
            if (element.querySelector(selector)) {
                return true;
            }
        }
        return false;
    }

    isContainerElement(element) {
        // Check if element is likely a container (has many child elements or specific classes)
        const childCount = element.children.length;
        const textLength = element.textContent ? element.textContent.length : 0;

        // Skip elements with many children
        if (childCount > 5) {
            return true;
        }

        // Skip elements with very long text content
        if (textLength > 1000) {
            return true;
        }

        // Skip elements with container-like classes
        const containerClasses = ['container', 'section', 'content', 'main', 'wrapper', 'box', 'card', 'panel'];
        const className = element && element.className ? element.className.toLowerCase() : '';
        for (let cls of containerClasses) {
            if (className.includes(cls)) {
                return true;
            }
        }

        return false;
    }

    extractText(element) {
        if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
            return element.getAttribute('placeholder') || element.value || '';
        }

        // Get only direct text content, not from child elements
        let text = '';
        for (let node of element.childNodes) {
            if (node.nodeType === Node.TEXT_NODE) {
                text += node.textContent;
            }
        }

        // If no direct text, fall back to full text content but only for leaf elements
        if (!text.trim() && element.children.length === 0) {
            text = element.textContent || element.innerText || '';
        }

        // Additional check: if text is too long, it's likely a container
        if (text.length > 500) {
            console.log(`⚠️ Text too long (${text.length} chars), likely container: ${element.tagName}`);
            return '';
        }

        return text.trim();
    }

    isHiddenElement(element) {
        const style = window.getComputedStyle(element);
        return style.display === 'none' ||
            style.visibility === 'hidden' ||
            style.opacity === '0' ||
            element.offsetParent === null;
    }

    async processBatch(elements) {
        const issues = [];
        const textsToAnalyze = [];

        // First pass: extract texts and do basic language detection
        console.log('🔍 Starting text extraction and language detection...');
        console.log(`📊 Processing ${elements.length} elements`);

        for (const element of elements) {
            try {
                const text = this.extractText(element);
                console.log(`🔍 Element: ${element.tagName} | Text length: ${text.length} | Text: "${text.substring(0, 100)}${text.length > 100 ? '...' : ''}"`);

                if (!text || text.trim().length < 3) {
                    console.log(`⏭️ Skipped (too short): ${element.tagName}`);
                    continue;
                }

                // Skip if text is too long (likely a container)
                if (text.length > 200) {
                    console.log(`⏭️ Skipped (too long, likely container): ${element.tagName} | Length: ${text.length}`);
                    continue;
                }

                // Add all texts to analysis queue - let AI decide everything
                const textData = {
                    element: element,
                    text: text,
                    selector: this.getElementSelector(element),
                    tagName: element.tagName,
                    className: element.className || null
                };
                textsToAnalyze.push(textData);
                console.log(`📝 Text: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}" | Added to analysis queue: ${textData.tagName}`);
            } catch (error) {
                console.error('❌ Error processing element:', error);
            }
        }

        // Second pass: Send to AI for detailed analysis (smart batching with parallel processing)
        if (textsToAnalyze.length > 0) {
            console.log(`🤖 Sending ${textsToAnalyze.length} texts to AI for analysis...`);
            console.log('📋 Texts being analyzed:', textsToAnalyze.map(t => `"${t.text.substring(0, 30)}${t.text.length > 30 ? '...' : ''}"`));

            // Create smart batches based on token limits
            const batches = this.createSmartBatches(textsToAnalyze);
            console.log(`📦 Created ${batches.length} smart batches for processing`);

            // Process all batches in parallel
            await this.processBatchesInParallel(batches, issues);
        } else {
            console.log('ℹ️ No texts found to analyze');
        }

        console.log(`📊 FINAL RESULTS: Found ${issues.length} translation issues`);
        console.log('📋 Issues to display in popup:', issues.map(issue => ({
            id: issue.id,
            text: issue.text.substring(0, 50) + (issue.text.length > 50 ? '...' : ''),
            language: issue.language,
            type: issue.type,
            dataType: issue.dataType,
            htmlTag: issue.htmlTag
        })));

        return issues;
    }

    sendIssuesToPopup() {
        // Send current issues to popup for real-time updates
        const currentIssues = Array.from(this.highlightedIssues.values());

        // Check if popup context is available
        if (!this.isPopupAvailable()) {
            console.log('📝 AutoScanner: Popup context not available, skipping message');
            return;
        }

        try {
            chrome.runtime.sendMessage({
                action: 'issuesUpdate',
                issues: currentIssues,
                count: currentIssues.length
            }, (response) => {
                // Handle response or errors
                if (chrome.runtime.lastError) {
                    console.log('📝 AutoScanner: Popup not available (context invalidated or popup closed)');
                    // This is normal when popup is closed, don't treat as error
                } else {
                    console.log('📝 AutoScanner: Issues sent to popup successfully');
                }
            });
        } catch (error) {
            console.log('📝 AutoScanner: Could not send issues to popup (context invalidated)');
            // This is normal when popup is closed, don't treat as error
        }
    }

    isPopupAvailable() {
        // Check if popup context is available
        try {
            return chrome.runtime && chrome.runtime.sendMessage;
        } catch (error) {
            return false;
        }
    }

    createSmartBatches(textsToAnalyze) {
        // Adaptive batching parameters - can be adjusted based on performance
        const MAX_TOKENS_PER_REQUEST = 80000; // Reduced for faster response times
        const MAX_TEXTS_PER_BATCH = 25; // Reduced for better performance
        const PROMPT_OVERHEAD_TOKENS = 500; // Estimated prompt overhead
        const MAX_ESTIMATED_RESPONSE_TIME = 15000; // 15 seconds max per request
        const TOKENS_PER_SECOND = 5000; // Estimated processing speed

        // Get adaptive settings from storage (if available)
        const adaptiveSettings = this.getAdaptiveBatchingSettings();
        const effectiveMaxTokens = Math.min(MAX_TOKENS_PER_REQUEST, adaptiveSettings.maxTokens || MAX_TOKENS_PER_REQUEST);
        const effectiveMaxTexts = Math.min(MAX_TEXTS_PER_BATCH, adaptiveSettings.maxTexts || MAX_TEXTS_PER_BATCH);

        const batches = [];
        let currentBatch = [];
        let currentTokens = PROMPT_OVERHEAD_TOKENS;

        for (const textData of textsToAnalyze) {
            const estimatedTokens = this.estimateTokens(textData.text);
            const estimatedResponseTime = (currentTokens + estimatedTokens) / TOKENS_PER_SECOND * 1000; // Convert to milliseconds

            // Check if adding this text would exceed any limits
            const wouldExceedTokens = currentTokens + estimatedTokens > effectiveMaxTokens;
            const wouldExceedTextCount = currentBatch.length >= effectiveMaxTexts;
            const wouldExceedTime = estimatedResponseTime > MAX_ESTIMATED_RESPONSE_TIME;

            if ((wouldExceedTokens || wouldExceedTextCount || wouldExceedTime) && currentBatch.length > 0) {
                batches.push([...currentBatch]);
                currentBatch = [];
                currentTokens = PROMPT_OVERHEAD_TOKENS;
            }

            currentBatch.push(textData);
            currentTokens += estimatedTokens;
        }

        // Add the last batch if it has any texts
        if (currentBatch.length > 0) {
            batches.push(currentBatch);
        }

        console.log(`📊 Smart batching: ${batches.length} batches created`);
        batches.forEach((batch, index) => {
            const totalTokens = batch.reduce((sum, textData) => sum + this.estimateTokens(textData.text), PROMPT_OVERHEAD_TOKENS);
            const estimatedTime = (totalTokens / TOKENS_PER_SECOND * 1000).toFixed(0);
            console.log(`  Batch ${index + 1}: ${batch.length} texts, ~${totalTokens} tokens, ~${estimatedTime}ms`);
        });

        return batches;
    }

    estimateTokens(text) {
        if (!text || text.length === 0) return 0;

        // More accurate token estimation based on language and content type
        const textLength = text.length;

        // Check if text contains mostly ASCII (English) or Unicode (other languages)
        const asciiRatio = (text.match(/[\x00-\x7F]/g) || []).length / textLength;
        const isMostlyEnglish = asciiRatio > 0.8;

        // Token estimation: English ~4 chars/token, Other languages ~2-3 chars/token
        const avgCharsPerToken = isMostlyEnglish ? 4 : 2.5;

        // Add complexity factor for special characters, numbers, etc.
        const hasNumbers = /\d/.test(text);
        const hasSpecialChars = /[^\w\s]/.test(text);
        const complexityFactor = hasNumbers || hasSpecialChars ? 1.1 : 1.0;

        return Math.ceil((textLength / avgCharsPerToken) * complexityFactor);
    }

    getAdaptiveBatchingSettings() {
        // Get adaptive settings from storage or use defaults
        try {
            const stored = localStorage.getItem('translateMe_adaptiveSettings');
            if (stored) {
                return JSON.parse(stored);
            }
        } catch (error) {
            console.log('📊 Using default adaptive batching settings');
        }

        return {
            maxTokens: 80000,
            maxTexts: 25,
            lastUpdated: Date.now()
        };
    }

    updateAdaptiveBatchingSettings(responseTime, tokens, success) {
        try {
            const settings = this.getAdaptiveBatchingSettings();
            const now = Date.now();

            // Only update if we have enough data and it's been a while
            if (now - settings.lastUpdated > 60000) { // Update every minute
                if (success && responseTime < 10000) {
                    // If response was fast and successful, we can try larger batches
                    settings.maxTokens = Math.min(100000, settings.maxTokens * 1.1);
                    settings.maxTexts = Math.min(35, settings.maxTexts * 1.1);
                } else if (responseTime > 20000 || !success) {
                    // If response was slow or failed, reduce batch sizes
                    settings.maxTokens = Math.max(40000, settings.maxTokens * 0.8);
                    settings.maxTexts = Math.max(15, settings.maxTexts * 0.8);
                }

                settings.lastUpdated = now;
                localStorage.setItem('translateMe_adaptiveSettings', JSON.stringify(settings));
                console.log(`📊 Updated adaptive batching settings: ${settings.maxTokens} tokens, ${settings.maxTexts} texts`);
            }
        } catch (error) {
            console.log('📊 Could not update adaptive batching settings:', error);
        }
    }

    async processBatchesInParallel(batches, issues) {
        console.log(`🚀 Processing ${batches.length} batches in parallel...`);

        // Track response times for performance monitoring
        const responseTimes = [];

        // Create promises for all batches
        const batchPromises = batches.map(async (batch, batchIndex) => {
            const startTime = Date.now();
            try {
                console.log(`🔄 Starting batch ${batchIndex + 1}/${batches.length} (${batch.length} texts)`);
                const aiResults = await this.analyzeWithAI(batch);
                const endTime = Date.now();
                const duration = endTime - startTime;
                responseTimes.push(duration);

                console.log(`✅ Batch ${batchIndex + 1} completed in ${duration}ms`);

                // Log performance metrics
                const tokens = batch.reduce((sum, textData) => sum + this.estimateTokens(textData.text), 500);
                const tokensPerSecond = Math.round(tokens / (duration / 1000));
                console.log(`📊 Batch ${batchIndex + 1} performance: ${tokensPerSecond} tokens/sec`);

                // Update adaptive batching settings based on performance
                this.updateAdaptiveBatchingSettings(duration, tokens, true);

                return { batchIndex, batch, aiResults };
            } catch (error) {
                console.error(`❌ Batch ${batchIndex + 1} failed:`, error);

                // Update adaptive settings for failed batch
                const tokens = batch.reduce((sum, textData) => sum + this.estimateTokens(textData.text), 500);
                this.updateAdaptiveBatchingSettings(30000, tokens, false); // Assume 30s timeout for failed requests

                return { batchIndex, batch, aiResults: [], error };
            }
        });

        // Process results as they complete (streaming effect)
        const results = await Promise.all(batchPromises);

        // Display results in order with streaming effect
        for (const result of results) {
            if (result.error) continue;

            const { batch, aiResults } = result;
            console.log(`🎯 Processing results from batch ${result.batchIndex + 1}:`, aiResults);

            // Display each result with streaming effect
            for (let i = 0; i < batch.length; i++) {
                const textData = batch[i];
                const aiResult = aiResults[i];

                const isIssue = aiResult && (aiResult.includes('Static/Issue') || aiResult.includes('Dynamic/Issue'));
                console.log(`🔍 Text: "${textData.text.substring(0, 30)}${textData.text.length > 30 ? '...' : ''}" | AI Result: "${aiResult}" | Is Issue: ${isIssue}`);

                if (isIssue) {
                    const issue = {
                        id: `issue_${this.issueCounter++}`,
                        text: textData.text,
                        selector: textData.selector,
                        url: window.location.href,
                        timestamp: new Date().toISOString(),
                        type: 'translation_issue',
                        dataType: aiResult.includes('Static') ? 'static' : 'dynamic',
                        htmlTag: textData.tagName,
                        className: textData.className
                    };

                    issues.push(issue);
                    // Store the issue for highlighting but don't highlight automatically
                    this.highlightIssue(textData.element, issue);
                    console.log(`❌ ISSUE DETECTED: ${aiResult} | Text: "${textData.text}" | Element: ${textData.tagName}`);

                    // Send update to popup immediately (streaming effect)
                    try {
                        this.sendIssuesToPopup();
                    } catch (error) {
                        console.log('📝 AutoScanner: Could not send streaming update (popup unavailable)');
                    }

                    // Add small delay for streaming effect
                    await new Promise(resolve => setTimeout(resolve, 300));
                } else {
                    console.log(`✅ No issue: ${aiResult} | Text: "${textData.text}"`);
                }
            }
        }

        // Calculate and log performance statistics
        if (responseTimes.length > 0) {
            const avgResponseTime = responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
            const maxResponseTime = Math.max(...responseTimes);
            const minResponseTime = Math.min(...responseTimes);

            console.log(`📊 Performance Summary:`);
            console.log(`  Average response time: ${avgResponseTime.toFixed(0)}ms`);
            console.log(`  Min response time: ${minResponseTime}ms`);
            console.log(`  Max response time: ${maxResponseTime}ms`);
            console.log(`  Total batches: ${batches.length}`);
            console.log(`  Total issues found: ${issues.length}`);
        }

        console.log(`🎉 All batches processed! Found ${issues.length} total issues`);
    }

    detectLanguage(text) {
        // Simple, reliable language detection
        if (!text || typeof text !== 'string') {
            return { language: 'unknown', confidence: 0 };
        }

        const cleanText = text.toLowerCase().trim();
        if (cleanText.length < 3) {
            return { language: 'unknown', confidence: 0 };
        }

        // Character-based detection (most reliable)
        const arabicChars = /[\u0600-\u06FF]/;
        const chineseChars = /[\u4e00-\u9fff]/;
        const japaneseChars = /[\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]/;
        const koreanChars = /[\uac00-\ud7af]/;
        const cyrillicChars = /[\u0400-\u04ff]/;

        if (arabicChars.test(text)) return { language: 'ar', confidence: 0.9 };
        if (chineseChars.test(text)) return { language: 'zh', confidence: 0.9 };
        if (japaneseChars.test(text)) return { language: 'ja', confidence: 0.9 };
        if (koreanChars.test(text)) return { language: 'ko', confidence: 0.9 };
        if (cyrillicChars.test(text)) return { language: 'ru', confidence: 0.9 };

        // Word-based detection for Latin scripts
        const frenchWords = [
            'le', 'la', 'les', 'de', 'du', 'des', 'un', 'une', 'et', 'ou', 'avec', 'pour', 'dans', 'sur', 'par',
            'rechercher', 'bienvenue', 'accueil', 'contact', 'produits', 'services', 'nos', 'votre', 'notre',
            'vous', 'nous', 'merci', 'bonjour', 'aujourd\'hui', 'très', 'content', 'voir', 'ici', 'beaucoup',
            'visite', 'plus', 'tout', 'tous', 'toutes', 'cette', 'ces', 'son', 'sa', 'ses', 'mon', 'ma', 'mes'
        ];

        const spanishWords = [
            'el', 'la', 'los', 'las', 'de', 'del', 'en', 'un', 'una', 'y', 'o', 'con', 'para', 'por', 'sobre',
            'bienvenido', 'contacto', 'productos', 'servicios', 'nuestros', 'su', 'sus', 'mi', 'mis', 'tu', 'tus'
        ];

        const germanWords = [
            'der', 'die', 'das', 'und', 'in', 'den', 'von', 'zu', 'das', 'mit', 'sich', 'des', 'auf', 'für',
            'willkommen', 'kontakt', 'produkte', 'dienstleistungen', 'unsere', 'ihre', 'meine', 'deine'
        ];

        const italianWords = [
            'il', 'la', 'lo', 'gli', 'le', 'di', 'del', 'della', 'dei', 'delle', 'un', 'una', 'e', 'o', 'con',
            'benvenuto', 'contatto', 'prodotti', 'servizi', 'nostri', 'vostri', 'miei', 'tuoi'
        ];

        // Check for French words
        const frenchMatches = frenchWords.filter(word => cleanText.includes(word)).length;
        if (frenchMatches > 0) {
            return { language: 'fr', confidence: Math.min(frenchMatches * 0.3, 0.9) };
        }

        // Check for Spanish words
        const spanishMatches = spanishWords.filter(word => cleanText.includes(word)).length;
        if (spanishMatches > 0) {
            return { language: 'es', confidence: Math.min(spanishMatches * 0.3, 0.9) };
        }

        // Check for German words
        const germanMatches = germanWords.filter(word => cleanText.includes(word)).length;
        if (germanMatches > 0) {
            return { language: 'de', confidence: Math.min(germanMatches * 0.3, 0.9) };
        }

        // Check for Italian words
        const italianMatches = italianWords.filter(word => cleanText.includes(word)).length;
        if (italianMatches > 0) {
            return { language: 'it', confidence: Math.min(italianMatches * 0.3, 0.9) };
        }

        // Default to English if no other language detected
        return { language: 'en', confidence: 0.5 };
    }

    getElementSelector(element) {
        if (!element) return 'unknown';
        if (element.id) return `#${element.id}`;
        if (element.className) return `.${element.className.split(' ')[0]}`;
        return element.tagName ? element.tagName.toLowerCase() : 'unknown';
    }


    highlightIssue(element, issue) {
        if (this.highlightedIssues.has(issue.id)) return;

        // Store the issue but don't highlight automatically
        element.setAttribute('data-translateme-issue', issue.id);
        this.highlightedIssues.set(issue.id, issue);

        console.log('🎯 Issue stored for highlighting:', issue.text);
    }

    removeHighlights() {
        this.highlightedIssues.forEach((issue, id) => {
            const element = document.querySelector(`[data-translateme-issue="${id}"]`);
            if (element) {
                element.classList.remove('translateme-issue-static', 'translateme-issue-dynamic', 'translateme-issue-mixed');
                element.removeAttribute('data-translateme-issue');
            }
        });
        this.highlightedIssues.clear();
        console.log('🧹 Highlights removed');
    }

    highlightAllIssues() {
        // Highlight all stored issues with different colors based on type
        console.log(`🎨 Starting to highlight ${this.highlightedIssues.size} stored issues`);

        this.highlightedIssues.forEach((issue, id) => {
            console.log(`🔍 Looking for element with data-translateme-issue="${id}"`);
            const element = document.querySelector(`[data-translateme-issue="${id}"]`);
            if (element) {
                console.log(`✅ Found element for issue ${id}, applying highlight`);
                this.applyHighlight(element, issue);
            } else {
                console.log(`❌ Element not found for issue ${id}`);
            }
        });
        console.log(`🎨 Highlighted ${this.highlightedIssues.size} issues with colors`);
    }

    applyHighlight(element, issue) {
        // Remove any existing highlight classes
        element.classList.remove('translateme-issue-static', 'translateme-issue-dynamic', 'translateme-issue-mixed');

        // Apply appropriate highlight based on issue type
        if (issue.dataType === 'static') {
            element.classList.add('translateme-issue-static');
        } else if (issue.dataType === 'dynamic') {
            element.classList.add('translateme-issue-dynamic');
        } else {
            element.classList.add('translateme-issue-mixed');
        }
    }

    cleanAllHighlights() {
        // Remove all highlights and clear the issues
        this.removeHighlights();
        console.log('🧹 All highlights cleaned');
    }

    // Auto-tracking methods
    initializeUrlBasedTracking() {
        this.loadTrackingUrls();
        this.setupNavigationListener();
        this.setupVisibilityObserver();
        this.checkAutoResume();
    }

    async loadTrackingUrls() {
        try {
            const result = await chrome.storage.sync.get(['targetUrls']);
            this.targetUrls = result.targetUrls || [];
            console.log('📋 Loaded target URLs:', this.targetUrls);
        } catch (error) {
            console.error('❌ Failed to load tracking URLs:', error);
        }
    }

    setupNavigationListener() {
        // Override history methods
        const originalPushState = history.pushState;
        const originalReplaceState = history.replaceState;

        history.pushState = (...args) => {
            originalPushState.apply(history, args);
            this.handleNavigationChange();
        };

        history.replaceState = (...args) => {
            originalReplaceState.apply(history, args);
            this.handleNavigationChange();
        };

        // Listen for popstate
        window.addEventListener('popstate', () => {
            this.handleNavigationChange();
        });

        // Listen for clicks on navigation links
        document.addEventListener('click', (event) => {
            const link = event.target.closest('a[href^="#"]');
            if (link) {
                setTimeout(() => this.handleNavigationChange(), 100);
            }
        });
    }

    setupVisibilityObserver() {
        this.visibilityObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    console.log('👁️ Content section became visible:', entry.target);
                    this.handleNavigationChange();
                }
            });
        }, { threshold: 0.1 });

        // Observe content sections
        const contentSections = document.querySelectorAll('.content-section, [class*="content"], [class*="section"]');
        contentSections.forEach(section => {
            this.visibilityObserver.observe(section);
        });
    }

    handleNavigationChange() {
        if (!this.isTrackingEnabled) return;

        const now = Date.now();
        if (now - this.lastScanTime < this.minScanInterval) return;

        this.lastScanTime = now;
        console.log('🔄 Navigation detected, rescanning visible content...');

    }


    getVisibleTextElements() {
        const selectors = [
            'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
            'p', 'span', 'div', 'a', 'button',
            'input[placeholder]', 'textarea[placeholder]',
            'label', 'li', 'td', 'th'
        ];

        const elements = [];
        selectors.forEach(selector => {
            const found = document.querySelectorAll(selector);
            found.forEach(el => {
                if (this.hasTextContent(el) && this.isElementVisible(el)) {
                    elements.push(el);
                }
            });
        });

        return elements;
    }

    isElementVisible(element) {
        const rect = element.getBoundingClientRect();
        const windowHeight = window.innerHeight;
        const windowWidth = window.innerWidth;

        return rect.top < windowHeight &&
            rect.bottom > 0 &&
            rect.left < windowWidth &&
            rect.right > 0;
    }

    startAutoTracking(url) {
        this.isTrackingEnabled = true;
        this.currentUrl = url;
        console.log('🔄 Auto-tracking started for:', url);

        // Start DOM change monitoring
        this.startDOMChangeMonitoring();
    }

    stopAutoTracking() {
        this.isTrackingEnabled = false;
        console.log('⏹️ Auto-tracking stopped');

        // Stop DOM change monitoring
        this.stopDOMChangeMonitoring();
    }

    startDOMChangeMonitoring() {
        if (this.mutationObserver) return;

        this.mutationObserver = new MutationObserver((mutations) => {
            this.handleDOMChanges(mutations);
        });

        this.mutationObserver.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['class', 'style']
        });

        console.log('👀 DOM change monitoring started');
    }

    stopDOMChangeMonitoring() {
        if (this.mutationObserver) {
            this.mutationObserver.disconnect();
            this.mutationObserver = null;
            console.log('👀 DOM change monitoring stopped');
        }
    }

    handleDOMChanges(mutations) {
        if (!this.isTrackingEnabled) return;

        // Debounce changes
        if (this.changeDetectionDebounce) {
            clearTimeout(this.changeDetectionDebounce);
        }

        this.changeDetectionDebounce = setTimeout(() => {
            this.handleNavigationChange();
        }, 500);
    }

    async checkAutoResume() {
        try {
            const result = await chrome.storage.sync.get(['autoTrackingEnabled', 'targetUrls']);
            if (result.autoTrackingEnabled && result.targetUrls) {
                const currentUrl = window.location.href;
                if (result.targetUrls.includes(currentUrl)) {
                    this.startAutoTracking(currentUrl);
                }
            }
        } catch (error) {
            console.error('❌ Failed to check auto-resume:', error);
        }
    }

    async loadPersistentCache() {
        try {
            const result = await chrome.storage.local.get(['translationCache']);
            if (result.translationCache) {
                this.translationCache = new Map(result.translationCache);
                console.log(`📦 Loaded ${this.translationCache.size} cached translations`);
            }
        } catch (error) {
            console.error('❌ Failed to load persistent cache:', error);
        }
    }

    // AI Analysis Methods
    async analyzeWithAI(textsToAnalyze) {
        try {
            // Create a unique key for this request to prevent duplicates
            const requestKey = textsToAnalyze.join('|').substring(0, 100); // Limit key length

            // Check if we already have a pending request for this content
            if (this.pendingRequests.has(requestKey)) {
                console.log('🔄 Auto-scan: Duplicate request detected, waiting for existing request...');
                return await this.pendingRequests.get(requestKey);
            }

            // Get API configuration
            const config = await this.getAPIConfig();
            if (!config.apiKey || !config.provider) {
                console.log('⚠️ No AI API configured, using basic detection only');
                return textsToAnalyze.map(() => 'Static/Issue');
            }

            console.log(`🔍 Auto-scan: Analyzing ${textsToAnalyze.length} texts using ${config.provider} API...`);
            console.log(`🤖 Auto-scan: Using ${config.provider} for ${config.plan} plan`);

            // Create a promise for this request
            const requestPromise = this.performAIRequest(textsToAnalyze, config);

            // Store the promise to prevent duplicates
            this.pendingRequests.set(requestKey, requestPromise);

            // Set timeout to clean up the request
            setTimeout(() => {
                this.pendingRequests.delete(requestKey);
            }, this.requestTimeout);

            // Wait for the request to complete
            const results = await requestPromise;

            // Clean up the request
            this.pendingRequests.delete(requestKey);

            return results;
        } catch (error) {
            console.error('❌ AI analysis failed:', error);

            // Provide helpful error messages
            if (error.message.includes('Invalid API key')) {
                console.warn('⚠️ Please check your OpenAI API key in config/api.config.js');
            } else if (error.message.includes('Failed to fetch')) {
                console.warn('⚠️ Network error - check your internet connection');
            } else if (error.message.includes('rate limit')) {
                console.warn('⚠️ API rate limit exceeded - please wait before trying again');
            }

            // Fallback to basic detection
            return textsToAnalyze.map(() => 'Static/Issue');
        }
    }

    // Perform the actual AI request (separated for deduplication)
    async performAIRequest(textsToAnalyze, config) {
        try {
            // Send all texts in one request (more efficient)
            const results = await this.sendToAI(textsToAnalyze, config);

            // Ensure we have the right number of results
            if (results.length !== textsToAnalyze.length) {
                console.warn(`⚠️ Expected ${textsToAnalyze.length} results, got ${results.length}. Padding with 'Static/Issue'`);
                while (results.length < textsToAnalyze.length) {
                    results.push('Static/Issue');
                }
            }

            return results;
        } catch (error) {
            console.error('❌ AI request failed:', error);
            // Return fallback results
            return textsToAnalyze.map(() => 'Static/Issue');
        }
    }

    async getAPIConfig() {
        try {
            // Check if we have a cached config that's still valid
            const now = Date.now();
            if (this.apiConfigCache && (now - this.apiConfigCacheTime) < this.apiConfigCacheDuration) {
                console.log(`📊 Content script: Using cached API config: ${this.apiConfigCache.provider}`);
                return this.apiConfigCache;
            }

            // Get user's current plan from usage tracker (for logging purposes)
            const userPlan = await this.getUserPlan();
            console.log(`📊 Content script: User plan: ${userPlan} (all users use free OpenRouter API)`);

            // All users now use OpenRouter/DeepSeek (free API)
            let apiConfig = null;

            // Try to load from config file first
            if (typeof window.API_CONFIG !== 'undefined') {
                const config = window.API_CONFIG;
                const providerConfig = config.openrouter;

                if (providerConfig && providerConfig.apiKey) {
                    console.log(`🤖 Content script: Using OpenRouter API (free DeepSeek access)`);
                    apiConfig = {
                        provider: 'openrouter',
                        apiKey: providerConfig.apiKey,
                        model: providerConfig.model,
                        maxTokens: providerConfig.maxTokens,
                        temperature: providerConfig.temperature,
                        plan: userPlan,
                        baseUrl: providerConfig.baseUrl
                    };
                } else {
                    console.log(`❌ Content script: OpenRouter config missing or no API key`);
                }
            }

            // Fallback if config file not available: return placeholder config and warn
            if (!apiConfig) {
                const message = 'Content script: OpenRouter config missing. Provide config/api.config.js with your API key.';
                console.warn(`📊 ${message}`);
                apiConfig = {
                    provider: 'openrouter',
                    apiKey: '',
                    model: 'deepseek/deepseek-chat',
                    maxTokens: 200,
                    temperature: 0.3,
                    plan: userPlan || 'free',
                    baseUrl: 'https://openrouter.ai/api/v1/chat/completions'
                };
            }

            // Cache the config
            this.apiConfigCache = apiConfig;
            this.apiConfigCacheTime = Date.now();
            console.log(`📊 Content script: Cached OpenRouter API config`);

            return apiConfig;
        } catch (error) {
            console.error('❌ Content script: Error loading API config:', error);
            // Fallback to placeholder OpenRouter config even on error
            return {
                provider: 'openrouter',
                apiKey: '',
                model: 'deepseek/deepseek-chat',
                maxTokens: 200,
                temperature: 0.3,
                plan: 'free',
                baseUrl: 'https://openrouter.ai/api/v1/chat/completions'
            };
        }
    }

    async getUserPlan() {
        try {
            console.log('🔍 Content script: Getting user plan...');

            // Method 1: Try to get from popup via message
            try {
                console.log('📊 Content script: Attempting to get plan from popup...');
                const response = await chrome.runtime.sendMessage({ action: 'getUserPlan' });
                console.log('📊 Content script: Popup response:', response);
                if (response && response.plan) {
                    console.log(`📊 Content script: Got plan from popup: ${response.plan}`);
                    return response.plan;
                } else {
                    console.log('📊 Content script: No plan in popup response, trying other methods...');
                }
            } catch (popupError) {
                console.log('📊 Content script: Could not get plan from popup:', popupError.message);
                console.log('📊 Content script: This is normal when popup is closed, trying other methods...');
            }

            // Method 2: Check if usage tracker is available
            if (typeof window.usageTracker !== 'undefined' && window.usageTracker.getUsageStats) {
                const stats = window.usageTracker.getUsageStats();

                // Use the current_plan from database if available
                if (stats.current_plan) {
                    console.log(`📊 Content script: User plan from database: ${stats.current_plan}`);
                    return stats.current_plan;
                }

                // If no current_plan in stats, try to load fresh data
                console.log('📊 Content script: No current_plan in stats, trying to load fresh data...');
                try {
                    // Check if usage tracker is properly initialized
                    if (window.usageTracker && window.usageTracker.supabase && typeof window.usageTracker.supabase.rpc === 'function') {
                        await window.usageTracker.loadUsageStats();
                        const freshStats = window.usageTracker.getUsageStats();
                        if (freshStats.current_plan) {
                            console.log(`📊 Content script: Fresh plan from database: ${freshStats.current_plan}`);
                            return freshStats.current_plan;
                        }
                    } else {
                        console.log('📊 Content script: Usage tracker not available or invalid Supabase client, skipping loadUsageStats');
                    }
                } catch (loadError) {
                    console.log('📊 Content script: Failed to load fresh stats:', loadError.message);
                }

                // Fallback: determine plan based on trial status (legacy logic)
                if (stats.trial_days_remaining > 0) {
                    console.log('📊 Content script: Using legacy trial logic - trial active');
                    return 'trial';
                } else {
                    console.log('📊 Content script: Using legacy trial logic - trial expired, defaulting to free');
                    return 'free';
                }
            }

            // Method 3: Check storage for current plan
            const result = await chrome.storage.local.get(['userPlan', 'currentPlan', 'lastPlanUpdate']);
            const plan = result.currentPlan || result.userPlan || 'trial';
            const lastUpdate = result.lastPlanUpdate || 0;
            const timeSinceUpdate = Date.now() - lastUpdate;

            console.log(`📊 Content script: Storage data:`, result);
            console.log(`📊 Content script: Using storage fallback: ${plan} (updated ${Math.round(timeSinceUpdate / 1000)}s ago)`);

            // For free plan, be more lenient with age - only default to trial if very old (30 minutes)
            if (plan === 'free' && timeSinceUpdate > 30 * 60 * 1000) {
                console.log('⚠️ Content script: Free plan data is very old (30+ min), but keeping free plan');
                return 'free'; // Keep free plan even if old
            } else if (plan !== 'free' && timeSinceUpdate > 5 * 60 * 1000) {
                console.log('⚠️ Content script: Plan data is old, defaulting to trial for safety');
                return 'trial';
            }

            console.log(`✅ Content script: Using plan from storage: ${plan}`);
            return plan;

            // Method 4: Direct database check as last resort
            console.log('📊 Content script: All other methods failed, trying direct database check...');
            const directPlan = await this.checkDatabaseDirectly();
            if (directPlan) {
                console.log(`✅ Content script: Got plan from direct database check: ${directPlan}`);
                return directPlan;
            }

            // Method 5: Force check database for free plan users
            console.log('📊 Content script: Trying to force check database for free plan...');
            try {
                const userData = await chrome.storage.local.get(['currentUser']);
                if (userData.currentUser && userData.currentUser.id) {
                    console.log('📊 Content script: Found user data, checking if user should be on free plan...');

                    // If we can't get plan from database, but user exists, assume free plan
                    // This is a fallback for when database is not accessible
                    console.log('📊 Content script: Assuming free plan as fallback for existing user');
                    return 'free';
                }
            } catch (error) {
                console.log('📊 Content script: Could not check user data:', error.message);
            }

        } catch (error) {
            console.error('❌ Error getting user plan:', error);
            console.log('📊 Content script: Error fallback - defaulting to trial');
            return 'trial'; // Default to trial
        }
    }

    async checkDatabaseDirectly() {
        try {
            console.log('🔍 Content script: Checking database directly...');

            // Try to get user ID from storage first
            const userData = await chrome.storage.local.get(['currentUser']);
            if (!userData.currentUser || !userData.currentUser.id) {
                console.log('📊 Content script: No user data in storage');
                return null;
            }

            const supabaseUrl = (typeof SUPABASE_CONFIG !== 'undefined' && SUPABASE_CONFIG.url) || null;
            const supabaseKey = (typeof SUPABASE_CONFIG !== 'undefined' && SUPABASE_CONFIG.anonKey) || null;

            if (!supabaseUrl || !supabaseKey) {
                console.warn('⚠️ Content script: Supabase config missing. Provide config/supabase.config.js with url and anonKey.');
                return null;
            }

            // Make direct API call to get user plan
            const response = await fetch(`${supabaseUrl}/rest/v1/rpc/get_user_plan_info_with_transition`, {
                method: 'POST',
                headers: {
                    'apikey': supabaseKey,
                    'Authorization': `Bearer ${supabaseKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    user_google_id: userData.currentUser.id
                })
            });

            if (response.ok) {
                const data = await response.json();
                if (data && data.length > 0) {
                    const plan = data[0].current_plan;
                    console.log(`📊 Content script: Direct database check - plan: ${plan}`);

                    // Clear API cache if plan changed
                    if (this.apiConfigCache && this.apiConfigCache.plan !== plan) {
                        console.log(`📊 Content script: Plan changed from ${this.apiConfigCache.plan} to ${plan}, clearing cache`);
                        this.apiConfigCache = null;
                        this.apiConfigCacheTime = 0;
                    }

                    return plan;
                }
            }

            console.log('📊 Content script: Direct database check failed');
            return null;

        } catch (error) {
            console.error('❌ Content script: Direct database check error:', error);
            return null;
        }
    }

    clearAPICache() {
        console.log('📊 Content script: Manually clearing API config cache');
        this.apiConfigCache = null;
        this.apiConfigCacheTime = 0;
    }

    clearPendingRequests() {
        console.log('📊 Content script: Clearing pending AI requests');
        this.pendingRequests.clear();
    }

    // Debug method to force free plan (for testing)
    forceFreePlan() {
        console.log('🔧 Content script: FORCING FREE PLAN for testing');
        this.apiConfigCache = null; // Clear cache
        this.apiConfigCacheTime = 0;

        // Store free plan in storage
        chrome.storage.local.set({
            currentPlan: 'free',
            lastPlanUpdate: Date.now()
        }).then(() => {
            console.log('🔧 Content script: Forced free plan stored in storage');
        });
    }

    async sendToAI(textsToAnalyze, config) {
        const prompt = await this.buildAIPrompt(textsToAnalyze);

        if (config.provider === 'openrouter') {
            return await this.sendToOpenRouter(prompt, config);
        } else if (config.provider === 'deepseek') {
            return await this.sendToDeepSeek(prompt, config);
        } else if (config.provider === 'groq') {
            return await this.sendToGroq(prompt, config);
        } else {
            return await this.sendToOpenAI(prompt, config);
        }
    }

    async buildAIPrompt(textsToAnalyze) {
        const targetLanguage = await this.getTargetLanguage();

        let prompt = `You are a translation QA expert. Analyze each text and classify as:
- Static/Issue (UI element not in ${targetLanguage})
- Static/No_Issue (UI element correctly in ${targetLanguage})
- Dynamic/Issue (user content not in ${targetLanguage})
- Dynamic/No_Issue (user content correctly in ${targetLanguage})

Texts to analyze:\n`;

        textsToAnalyze.forEach((textData, index) => {
            const classInfo = textData.className ? ` class="${textData.className}"` : '';
            prompt += `${index + 1}. "${textData.text}" | <${textData.tagName ? textData.tagName.toLowerCase() : 'unknown'}${classInfo}>\n`;
        });

        prompt += `\nIMPORTANT: You must provide exactly ${textsToAnalyze.length} results, one for each text above.
Format: One result per line, using only these exact values:
- Static/Issue
- Static/No_Issue  
- Dynamic/Issue
- Dynamic/No_Issue

Results:\n`;

        return prompt;
    }

    async getTargetLanguage() {
        try {
            // Check if extension context is still valid
            if (!(chrome.runtime && chrome.runtime.id)) {
                console.log('⚠️ Extension context invalidated, using default language');
                return 'en';
            }

            const result = await chrome.storage.local.get(['targetLanguage']);
            return result.targetLanguage || 'en'; // Default to English if not set
        } catch (error) {
            if (error.message?.includes('Extension context invalidated')) {
                console.log('⚠️ Extension context invalidated, using default language');
            } else {
                console.error('❌ Failed to get target language:', error);
            }
            return 'en'; // Fallback to English
        }
    }

    async sendToOpenAI(prompt, config) {
        try {
            console.log('🤖 Sending request to OpenAI...');

            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${config.apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: config.model || 'gpt-4o',
                    messages: [{ role: 'user', content: prompt }],
                    max_tokens: config.maxTokens || 300,
                    temperature: config.temperature || 0.2
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`❌ OpenAI API error ${response.status}:`, errorText);

                if (response.status === 401) {
                    throw new Error('Invalid API key - please check your OpenAI API key configuration');
                } else if (response.status === 429) {
                    throw new Error('API rate limit exceeded - please try again later');
                } else if (response.status === 500) {
                    throw new Error('OpenAI server error - please try again later');
                } else {
                    throw new Error(`OpenAI API error ${response.status}: ${errorText}`);
                }
            }

            const data = await response.json();

            if (!data.choices || !data.choices[0] || !data.choices[0].message) {
                throw new Error('Invalid response format from OpenAI API');
            }

            const content = data.choices[0].message.content;
            console.log('🤖 Raw AI Response:', content);

            // Parse simple response format
            const results = content.trim().split('\n').map(line => line.trim()).filter(line => line.length > 0);
            console.log('🤖 Parsed AI Results:', results);
            return results;

        } catch (error) {
            console.error('❌ OpenAI API request failed:', error);
            throw error;
        }
    }

    async sendToGroq(prompt, apiKey) {
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'llama-3.1-8b-instant',
                messages: [{ role: 'user', content: prompt }],
                max_tokens: 200,
                temperature: 0.3
            })
        });

        if (!response.ok) {
            throw new Error(`Groq API error: ${response.status}`);
        }

        const data = await response.json();
        const content = data.choices[0].message.content;

        // Parse simple response format
        const results = content.trim().split('\n').map(line => line.trim());
        return results;
    }

    async sendToDeepSeek(prompt, config) {
        try {
            console.log('🤖 Sending request to DeepSeek...');

            const response = await fetch(config.baseUrl || 'https://api.deepseek.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${config.apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: config.model || 'deepseek-chat',
                    messages: [{ role: 'user', content: prompt }],
                    max_tokens: config.maxTokens || 200,
                    temperature: config.temperature || 0.3
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`❌ DeepSeek API error ${response.status}:`, errorText);

                if (response.status === 401) {
                    throw new Error('Invalid DeepSeek API key - please check your API key configuration');
                } else if (response.status === 429) {
                    throw new Error('DeepSeek API rate limit exceeded - please try again later');
                } else if (response.status === 500) {
                    throw new Error('DeepSeek server error - please try again later');
                } else {
                    throw new Error(`DeepSeek API error ${response.status}: ${errorText}`);
                }
            }

            const data = await response.json();

            if (!data.choices || !data.choices[0] || !data.choices[0].message) {
                throw new Error('Invalid response format from DeepSeek API');
            }

            const content = data.choices[0].message.content;
            console.log('🤖 Raw DeepSeek Response:', content);

            // Parse simple response format
            const results = content.trim().split('\n').map(line => line.trim()).filter(line => line.length > 0);
            console.log('🤖 Parsed DeepSeek Results:', results);
            return results;

        } catch (error) {
            console.error('❌ DeepSeek API request failed:', error);
            throw error;
        }
    }

    async sendToOpenRouter(prompt, config) {
        try {
            console.log('🤖 Sending request to OpenRouter...');
            console.log('🔍 OpenRouter config:', {
                baseUrl: config.baseUrl,
                model: config.model,
                apiKey: config.apiKey ? `${config.apiKey.substring(0, 10)}...` : 'MISSING',
                maxTokens: config.maxTokens
            });
            console.log('🔍 Current URL:', window.location.href);
            console.log('🔍 Origin:', window.location.origin);

            const response = await fetch(config.baseUrl || 'https://openrouter.ai/api/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${config.apiKey}`,
                    'Content-Type': 'application/json',
                    'HTTP-Referer': window.location.origin,
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
                console.error(`❌ OpenRouter API error ${response.status}:`, errorText);

                if (response.status === 401) {
                    throw new Error('Invalid OpenRouter API key - please check your API key configuration');
                } else if (response.status === 429) {
                    throw new Error('OpenRouter API rate limit exceeded - please try again later');
                } else if (response.status === 500) {
                    throw new Error('OpenRouter server error - please try again later');
                } else {
                    throw new Error(`OpenRouter API error ${response.status}: ${errorText}`);
                }
            }

            const data = await response.json();

            if (!data.choices || !data.choices[0] || !data.choices[0].message) {
                throw new Error('Invalid response format from OpenRouter API');
            }

            const content = data.choices[0].message.content;
            console.log('🤖 Raw OpenRouter Response:', content);

            // Parse response format more robustly
            let results = [];

            // Try different parsing methods
            const lines = content.trim().split('\n').map(line => line.trim()).filter(line => line.length > 0);
            console.log('🤖 Raw lines from AI:', lines);

            for (const line of lines) {
                // Skip empty lines or very long lines (likely explanations)
                if (line.length === 0 || line.length > 100) {
                    continue;
                }

                // Look for exact patterns first - this is the most reliable method
                const exactMatch = line.match(/(Static\/Issue|Dynamic\/Issue|Static\/No_Issue|Dynamic\/No_Issue|No Issue)/i);
                if (exactMatch) {
                    // Normalize the match to our expected format
                    const match = exactMatch[1];
                    if (match.toLowerCase().includes('static/no_issue')) {
                        results.push('Static/No_Issue');
                    } else if (match.toLowerCase().includes('dynamic/no_issue')) {
                        results.push('Dynamic/No_Issue');
                    } else if (match.toLowerCase().includes('static/issue')) {
                        results.push('Static/Issue');
                    } else if (match.toLowerCase().includes('dynamic/issue')) {
                        results.push('Dynamic/Issue');
                    } else if (match.toLowerCase().includes('no issue')) {
                        results.push('No Issue');
                    } else {
                        results.push('Static/Issue'); // Default fallback
                    }
                    continue;
                }

                // Handle numbered lists like "1. Static/Issue", "1) Static/Issue", etc.
                if (line.match(/^\d+[\.\)]\s*/)) {
                    const result = line.replace(/^\d+[\.\)]\s*/, '').trim();
                    // Use exact matching for numbered lists too
                    if (result.match(/^Static\/No_Issue$/i)) {
                        results.push('Static/No_Issue');
                    } else if (result.match(/^Dynamic\/No_Issue$/i)) {
                        results.push('Dynamic/No_Issue');
                    } else if (result.match(/^Static\/Issue$/i)) {
                        results.push('Static/Issue');
                    } else if (result.match(/^Dynamic\/Issue$/i)) {
                        results.push('Dynamic/Issue');
                    } else if (result.match(/^No Issue$/i)) {
                        results.push('No Issue');
                    } else {
                        results.push('Static/Issue'); // Default
                    }
                    continue;
                }

                // Handle bullet points like "- Static/Issue", "* Static/Issue", etc.
                if (line.match(/^[-*]\s*/)) {
                    const result = line.replace(/^[-*]\s*/, '').trim();
                    // Use exact matching for bullet points too
                    if (result.match(/^Static\/No_Issue$/i)) {
                        results.push('Static/No_Issue');
                    } else if (result.match(/^Dynamic\/No_Issue$/i)) {
                        results.push('Dynamic/No_Issue');
                    } else if (result.match(/^Static\/Issue$/i)) {
                        results.push('Static/Issue');
                    } else if (result.match(/^Dynamic\/Issue$/i)) {
                        results.push('Dynamic/Issue');
                    } else if (result.match(/^No Issue$/i)) {
                        results.push('No Issue');
                    } else {
                        results.push('Static/Issue'); // Default
                    }
                    continue;
                }

                // Handle simple patterns - be more precise to avoid false matches
                const lowerLine = line.toLowerCase();
                if (lowerLine === 'static' || lowerLine === 'static/issue') {
                    results.push('Static/Issue');
                } else if (lowerLine === 'dynamic' || lowerLine === 'dynamic/issue') {
                    results.push('Dynamic/Issue');
                } else if (lowerLine === 'no issue' || lowerLine === 'static/no_issue') {
                    results.push('Static/No_Issue');
                } else if (lowerLine === 'dynamic/no_issue') {
                    results.push('Dynamic/No_Issue');
                } else if (lowerLine.includes('no issue') && !lowerLine.includes('static') && !lowerLine.includes('dynamic')) {
                    results.push('No Issue');
                } else if (line.length < 20 && !lowerLine.includes('no')) {
                    // Short lines might be results, but avoid "no issue" patterns
                    results.push('Static/Issue'); // Default
                }
            }

            console.log('🤖 Parsed OpenRouter Results:', results);
            console.log(`🤖 Found ${results.length} results from ${lines.length} lines`);
            return results;

        } catch (error) {
            console.error('❌ OpenRouter API request failed:', error);

            // If it's a CORS error on local files, try routing through background script
            if (error.message.includes('Failed to fetch') && window.location.protocol === 'file:') {
                console.log('🔄 CORS error on local file, trying background script routing...');
                return await this.sendToOpenRouterViaBackground(prompt, config);
            }

            throw error;
        }
    }

    async sendToOpenRouterViaBackground(prompt, config) {
        try {
            console.log('🤖 Sending OpenRouter request via background script...');

            const response = await chrome.runtime.sendMessage({
                action: 'sendToOpenRouter',
                prompt: prompt,
                config: config
            });

            if (response && response.success) {
                console.log('🤖 OpenRouter response via background:', response.results);
                return response.results;
            } else {
                throw new Error(response?.error || 'Background script request failed');
            }
        } catch (error) {
            console.error('❌ OpenRouter via background script failed:', error);
            throw error;
        }
    }

    // Auto-scan methods
    async startAutoScan(url) {
        console.log('🔄 Starting auto-scan for URL:', url);

        // Auto-scan is now available for all users
        this.currentUrl = url;
        this.isAutoScanEnabled = true;

        // Re-initialize auto scanner if it doesn't exist or is broken
        if (!this.autoScanner || !this.autoScanner.isEnabled) {
            console.log('🔧 Re-initializing auto scanner...');
            this.initializeAutoScanner();
        } else {
            console.log('✅ Auto scanner already running');
        }
    }

    stopAutoScan() {
        console.log('🛑 Stopping auto-scan');
        this.isAutoScanEnabled = false;
        if (this.autoScanner) {
            this.autoScanner.stop();
            this.autoScanner = null;
        }
    }

    initializeAutoScanner() {
        if (this.autoScanner) {
            console.log('🛑 Stopping existing auto scanner...');
            this.autoScanner.stop();
        }

        console.log('🚀 Creating new auto scanner...');
        this.autoScanner = new AutoScanner(this);

        // Ensure auto scanner is properly started
        if (this.isAutoScanEnabled && this.autoScanner) {
            this.autoScanner.start();
            console.log('✅ Auto scanner initialized and started');
        } else {
            console.log('📝 Auto scanner created but not started (auto-scan disabled)');
        }
    }
}

// AutoScanner class for monitoring DOM changes
class AutoScanner {
    constructor(scanner) {
        this.scanner = scanner;
        this.mutationObserver = null;
        this.isEnabled = false;
        this.lastScanTime = 0;
        this.minScanInterval = 3000; // 3 seconds between scans
        this.debounceTimer = null;

        // Website filter for auto-scan
        this.trackedWebsite = null; // Store the website where auto-scan was enabled
        this.trackedHostname = null; // Store the hostname for comparison

        // Text storage and duplicate prevention
        this.scannedTexts = new Map(); // textId -> {text, isIssue, timestamp, element}
        this.textCache = new Map(); // textId -> AI result cache
        this.cacheExpiry = 24 * 60 * 60 * 1000; // 24 hours
        this.maxCacheSize = 1000; // Maximum cached texts
        this.storageKey = 'autoScanCache'; // Storage key for persistence

        // Smart cache invalidation
        this.sectionHashes = new Map(); // sectionId -> content hash
        this.contentHashCache = new Map(); // element -> content hash
        this.invalidationThreshold = 1000; // Minimum time between invalidations (ms)
        this.lastInvalidationTime = 0; // Timestamp of last invalidation
        this.isNavigating = false; // Flag to track navigation vs content changes
        this.isPageRefresh = true; // Flag to detect page refresh
        // Load persistent cache
        this.loadPersistentCache();
        this.initializeSectionHashes();
        this.cleanupStaleCacheAfterRefresh();
        this.start();
    }

    start() {
        if (this.isEnabled) return;

        console.log('🔄 AutoScanner: Starting DOM monitoring');
        this.isEnabled = true;

        // Store the current website for filtering
        this.trackedWebsite = window.location.href;
        this.trackedHostname = window.location.hostname;
        console.log(`🌐 AutoScanner: Tracking website: ${this.trackedHostname} (${this.trackedWebsite})`);

        // Create mutation observer
        this.mutationObserver = new MutationObserver((mutations) => {
            this.handleMutations(mutations);
        });

        // Start observing
        this.mutationObserver.observe(document.body, {
            childList: true,
            subtree: true,
            characterData: true,
            attributes: false
        });

        // Listen for navigation changes (SPA routing)
        this.setupNavigationListener();

        // Initial scan
        this.scheduleScan();
    }

    stop() {
        if (!this.isEnabled) return;

        console.log('🛑 AutoScanner: Stopping DOM monitoring');
        this.isEnabled = false;

        if (this.mutationObserver) {
            this.mutationObserver.disconnect();
            this.mutationObserver = null;
        }

        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
            this.debounceTimer = null;
        }

        // Remove navigation listener
        this.removeNavigationListener();
    }

    isOnTrackedWebsite() {
        if (!this.trackedHostname) {
            return true; // If no tracked website, allow scanning
        }

        const currentHostname = window.location.hostname;
        const isSameWebsite = currentHostname === this.trackedHostname;

        if (!isSameWebsite) {
            console.log(`🌐 AutoScanner: Website changed from ${this.trackedHostname} to ${currentHostname}`);
        }

        return isSameWebsite;
    }

    setupNavigationListener() {
        // Listen for custom navigation events
        this.navigationHandler = (event) => {
            if (event.detail && event.detail.sectionId) {
                console.log(`🔄 AutoScanner: Navigation detected - Section: ${event.detail.sectionId}`);
                // Set navigation flag to prevent unnecessary invalidation
                this.isNavigating = true;
                setTimeout(() => {
                    this.isNavigating = false;
                }, 2000); // Reset after 2 seconds
                // Don't schedule scan immediately for navigation
            }
        };

        document.addEventListener('contentSectionChanged', this.navigationHandler);

        // Also listen for URL changes (for hash-based routing)
        this.urlChangeHandler = () => {
            console.log('🔄 AutoScanner: URL change detected');
            this.scheduleScan();
        };

        window.addEventListener('hashchange', this.urlChangeHandler);
        window.addEventListener('popstate', this.urlChangeHandler);

        // Listen for visibility changes (when user switches tabs and comes back)
        this.visibilityHandler = () => {
            if (!document.hidden) {
                console.log('🔄 AutoScanner: Page became visible - checking for changes');
                this.scheduleScan();
            }
        };

        document.addEventListener('visibilitychange', this.visibilityHandler);

        // Listen for click events on navigation links as a fallback
        this.clickHandler = (event) => {
            const target = event.target.closest('a[href^="#"], .nav-link, [data-section]');
            if (target) {
                console.log('🔄 AutoScanner: Navigation link clicked - checking for changes');
                // Small delay to allow the navigation to complete
                setTimeout(() => {
                    this.scheduleScan();
                }, 100);
            }
        };

        document.addEventListener('click', this.clickHandler);

        // Monitor for class changes on content sections (fallback detection)
        this.setupClassChangeObserver();
    }

    removeNavigationListener() {
        if (this.navigationHandler) {
            document.removeEventListener('contentSectionChanged', this.navigationHandler);
            this.navigationHandler = null;
        }

        if (this.urlChangeHandler) {
            window.removeEventListener('hashchange', this.urlChangeHandler);
            window.removeEventListener('popstate', this.urlChangeHandler);
            this.urlChangeHandler = null;
        }

        if (this.visibilityHandler) {
            document.removeEventListener('visibilitychange', this.visibilityHandler);
            this.visibilityHandler = null;
        }

        if (this.clickHandler) {
            document.removeEventListener('click', this.clickHandler);
            this.clickHandler = null;
        }

        if (this.classChangeObserver) {
            this.classChangeObserver.disconnect();
            this.classChangeObserver = null;
        }
    }

    setupClassChangeObserver() {
        // Monitor for class changes on content sections
        this.classChangeObserver = new MutationObserver((mutations) => {
            mutations.forEach(mutation => {
                if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                    const target = mutation.target;
                    if (target.classList.contains('content-section') && target.classList.contains('active')) {
                        console.log(`🔄 AutoScanner: Section became active - ${target.id}`);
                        this.scheduleScan();
                    }
                } else if (mutation.type === 'childList') {
                    // Check if new content sections were added
                    mutation.addedNodes.forEach(node => {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            if (node.classList && node.classList.contains('content-section')) {
                                console.log(`🔄 AutoScanner: New content section added - ${node.id}`);
                                this.observeNewContentSection(node);
                            }
                            // Also check for content sections within the added node
                            const newSections = node.querySelectorAll && node.querySelectorAll('.content-section');
                            if (newSections) {
                                newSections.forEach(section => {
                                    console.log(`🔄 AutoScanner: New content section found - ${section.id}`);
                                    this.observeNewContentSection(section);
                                });
                            }
                        }
                    });
                }
            });
        });

        // Observe all content sections
        const contentSections = document.querySelectorAll('.content-section');
        contentSections.forEach(section => {
            this.classChangeObserver.observe(section, {
                attributes: true,
                attributeFilter: ['class']
            });
        });

        // Also observe for new content sections being added
        this.classChangeObserver.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    observeNewContentSection(section) {
        // Start observing the new content section for class changes
        if (this.classChangeObserver) {
            this.classChangeObserver.observe(section, {
                attributes: true,
                attributeFilter: ['class']
            });
        }

        // If this section is already active, scan it immediately
        if (section.classList.contains('active')) {
            console.log(`🔄 AutoScanner: New active section detected - ${section.id}`);
            this.scheduleScan();
        }
    }

    handleMutations(mutations) {
        if (!this.isEnabled) return;

        // Check if we're still on the same website
        if (!this.isOnTrackedWebsite()) {
            console.log('🌐 AutoScanner: Different website detected, stopping auto-scan');
            this.stop();
            return;
        }

        let hasTextChanges = false;

        mutations.forEach(mutation => {
            if (mutation.type === 'childList') {
                // Check if any added nodes contain text
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === Node.TEXT_NODE ||
                        (node.nodeType === Node.ELEMENT_NODE && node.textContent.trim())) {
                        hasTextChanges = true;
                    }
                });
            } else if (mutation.type === 'characterData') {
                hasTextChanges = true;
            }
        });

        if (hasTextChanges) {
            console.log('📝 AutoScanner: Text changes detected');
            this.scheduleScan();
        }
    }

    scheduleScan() {
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }

        this.debounceTimer = setTimeout(() => {
            // Check if we're still on the tracked website before scanning
            if (!this.isOnTrackedWebsite()) {
                console.log('🌐 AutoScanner: Different website detected during scheduled scan, stopping auto-scan');
                this.stop();
                return;
            }

            // Record auto-scan usage immediately when scan starts
            if (window.usageTracker && window.usageTracker.recordScan) {
                window.usageTracker.recordScan('auto_scan', window.location.href, 0);
            }

            this.smartScan();
        }, 1000); // 1 second debounce
    }

    async performScan() {
        if (!this.isEnabled) return;

        // Prevent multiple simultaneous scans
        if (this.isScanning) {
            console.log('⏱️ AutoScanner: Scan already in progress, skipping');
            return;
        }

        const now = Date.now();
        if (now - this.lastScanTime < this.minScanInterval) {
            console.log('⏱️ AutoScanner: Skipping scan (too soon)');
            return;
        }

        console.log('🔍 AutoScanner: Performing auto-scan');
        console.log(`📊 AutoScanner: Current cache size: ${this.scannedTexts.size} entries`);
        this.lastScanTime = now;
        this.isScanning = true;

        try {
            // Extract new texts
            const newTexts = this.extractNewTexts();

            if (newTexts.length === 0) {
                console.log('📝 AutoScanner: No new texts found - all texts are cached');
                return;
            }

            console.log(`📝 AutoScanner: Found ${newTexts.length} new texts to analyze`);
            console.log('📝 AutoScanner: Texts to analyze:', newTexts.map(t => `"${t.text.substring(0, 50)}${t.text.length > 50 ? '...' : ''}"`));

            // Analyze with AI
            await this.analyzeNewTexts(newTexts);

        } catch (error) {
            console.error('❌ AutoScanner: Error during scan:', error);
        } finally {
            // Always reset the scanning flag
            this.isScanning = false;
        }
    }

    extractNewTexts() {
        // Use the EXACT same text extraction as manual scan
        const textElements = this.scanner.getTextElements();
        console.log(`📝 AutoScanner: Found ${textElements.length} text elements using EXACT same method as manual scan`);

        // Filter out already scanned texts to avoid duplicates
        const newTexts = [];
        const duplicateCount = { total: 0, cached: 0, expired: 0, invalidated: 0 };

        textElements.forEach(element => {
            const text = this.scanner.extractText(element);
            if (!text || text.length < 3) return;

            const textId = this.createTextId(element, text);

            // Debug: Log text ID generation
            console.log(`🔍 AutoScanner: Generated textId for "${text.substring(0, 30)}...": ${textId.substring(0, 80)}...`);

            // Check if we've already scanned this text
            if (this.scannedTexts.has(textId)) {
                console.log(`✅ AutoScanner: Found cached result for textId: ${textId.substring(0, 50)}...`);
                console.log(`💾 AutoScanner: Using cached result - no AI request needed`);
                console.log(`🔍 AutoScanner: Cache lookup successful for "${text.substring(0, 30)}..."`);
                const cached = this.scannedTexts.get(textId);
                const isExpired = Date.now() - cached.timestamp > this.cacheExpiry;

                // Additional validation: check if the element still exists and matches
                const isElementValid = this.isCachedElementValid(cached, element);

                // After page refresh, be more aggressive about re-scanning
                const shouldRescanAfterRefresh = this.isPageRefresh &&
                    (Date.now() - cached.timestamp > 5000); // Re-scan if cache is older than 5 seconds

                if (isExpired || !isElementValid || shouldRescanAfterRefresh) {
                    // Remove invalid/expired cache
                    this.scannedTexts.delete(textId);
                    this.textCache.delete(textId);
                    if (isExpired) {
                        duplicateCount.expired++;
                    } else if (shouldRescanAfterRefresh) {
                        duplicateCount.invalidated++;
                    } else {
                        duplicateCount.invalidated++;
                    }
                } else {
                    // Use cached result
                    duplicateCount.cached++;
                    this.restoreCachedResult(cached);
                    return;
                }
            }

            duplicateCount.total++;
            console.log(`❌ AutoScanner: No cached result found for textId: ${textId.substring(0, 50)}...`);
            console.log(`🔍 AutoScanner: Cache lookup failed for "${text.substring(0, 30)}..." - will send to AI`);
            newTexts.push({
                element: element,
                text: text,
                textId: textId,
                selector: this.scanner.getElementSelector(element),
                tagName: element.tagName,
                className: element.className
            });
        });

        console.log(`📝 AutoScanner: ${duplicateCount.total} new texts, ${duplicateCount.cached} cached, ${duplicateCount.expired} expired, ${duplicateCount.invalidated} invalidated`);

        if (duplicateCount.cached > 0) {
            console.log(`🎉 AutoScanner: ${duplicateCount.cached} texts found in cache - no AI requests needed!`);
        }
        if (duplicateCount.total > 0) {
            console.log(`🔄 AutoScanner: ${duplicateCount.total} new texts will be sent to AI for analysis`);
        }

        // Debug: Show current cache contents
        if (this.scannedTexts.size > 0) {
            console.log(`📊 AutoScanner: Current cache contains ${this.scannedTexts.size} entries:`);
            this.scannedTexts.forEach((cached, textId) => {
                console.log(`  - ${textId.substring(0, 50)}... | Text: "${cached.text.substring(0, 30)}..." | Issue: ${cached.isIssue}`);
            });
        }

        return newTexts;
    }

    isCachedElementValid(cached, currentElement) {
        // Check if the cached element reference is still valid
        if (!cached.element || !currentElement) {
            return false;
        }

        // Check if it's the same element
        if (cached.element === currentElement) {
            return true;
        }

        // Get current text content
        const currentText = this.scanner.extractText(currentElement);

        // Check if it's the same element with same text content
        const currentTextId = this.createTextId(currentElement, currentText);
        const cachedTextId = this.createTextId(cached.element, cached.text);

        if (currentTextId === cachedTextId) {
            // Same element with same text content
            cached.element = currentElement;
            cached.text = currentText;
            return true;
        }

        // Check if it's the same element but different text (content changed)
        if (this.isSameElementDifferentText(cached.element, currentElement)) {
            console.log(`🔄 AutoScanner: Same element detected but text changed - will re-scan`);
            return false; // Force re-scan for content changes
        }

        return false;
    }

    isSameElementDifferentText(cachedElement, currentElement) {
        // Check if it's the same DOM element but with different text content
        if (cachedElement === currentElement) {
            return true; // Same element, text might be different
        }

        // Check if elements have same structure but different text
        const cachedPath = this.getElementDomPath(cachedElement);
        const currentPath = this.getElementDomPath(currentElement);

        return cachedPath === currentPath;
    }

    createTextId(element, text) {
        // Create a stable ID based on element structure AND text content
        // This ensures we match the same element with the same text content
        const url = window.location.href;
        const tagName = element.tagName;
        const className = element.className || '';
        const id = element.id || '';

        // Get element's position in the DOM tree
        const domPath = this.getElementDomPath(element);

        // Create a hash of the text content for comparison
        const textHash = this.hashString(text);

        // Create identifier based on structure, position, AND text content
        const stableId = `${url}-${tagName}-${className}-${id}-${domPath}-${textHash}`;
        return stableId;
    }

    getElementDomPath(element) {
        // Create a DOM path that identifies the element's position in the tree
        const path = [];
        let current = element;

        while (current && current !== document.body) {
            let selector = current.tagName ? current.tagName.toLowerCase() : 'unknown';

            if (current.id) {
                selector += `#${current.id}`;
            } else if (current.className) {
                const classes = current.className.split(' ').filter(c => c.trim()).slice(0, 2); // Limit to first 2 classes
                if (classes.length > 0) {
                    selector += `.${classes.join('.')}`;
                }
            }

            // Add sibling index to make it unique
            const siblings = Array.from(current.parentNode?.children || [])
                .filter(sibling => sibling.tagName === current.tagName);
            const index = siblings.indexOf(current);
            if (siblings.length > 1) {
                selector += `:nth-of-type(${index + 1})`;
            }

            path.unshift(selector);
            current = current.parentElement;
        }

        return path.join(' > ');
    }

    hashString(str) {
        // Simple hash function for text content
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash).toString(36);
    }

    restoreCachedResult(cached) {
        // Restore cached issue to highlighted issues if it was an issue
        if (cached.isIssue && cached.issueId) {
            const issue = {
                id: cached.issueId,
                text: cached.text,
                selector: cached.selector,
                url: window.location.href,
                timestamp: cached.timestamp,
                type: 'translation_issue',
                dataType: cached.dataType || 'static',
                htmlTag: cached.tagName,
                className: cached.className,
                source: 'auto_scan_cached'
            };

            this.scanner.highlightedIssues.set(issue.id, issue);
            console.log(`🔄 AutoScanner: Restored cached issue: "${cached.text.substring(0, 50)}..."`);
        }
    }



    hasTextElementChildren(element, allElements) {
        // Check if this element contains other text elements from our list
        const textElementTags = ['p', 'span', 'div', 'a', 'button', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'td', 'th', 'label'];

        for (const tag of textElementTags) {
            const children = Array.from(element.querySelectorAll(tag));
            for (const child of children) {
                if (allElements.includes(child) && child !== element) {
                    return true;
                }
            }
        }

        return false;
    }

    getTextElementChildren(element, allElements) {
        // Get all text element children of this element
        const children = [];
        const textElementTags = ['p', 'span', 'div', 'a', 'button', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'td', 'th', 'label'];

        for (const tag of textElementTags) {
            const childElements = Array.from(element.querySelectorAll(tag));
            for (const child of childElements) {
                if (allElements.includes(child) && child !== element) {
                    children.push(child);
                }
            }
        }

        return children;
    }


    getElementSelector(element) {
        if (!element) return 'unknown';
        if (element.id) return `#${element.id}`;
        if (element.className) return `.${element.className.split(' ')[0]}`;
        return element.tagName ? element.tagName.toLowerCase() : 'unknown';
    }


    async analyzeNewTexts(texts) {
        if (texts.length === 0) return;

        try {
            console.log(`🔄 AutoScanner: Processing ${texts.length} texts using EXACT same method as manual scan`);

            // Convert texts to elements for the manual scan process
            const elements = texts.map(textData => textData.element);
            console.log(`🔄 AutoScanner: Converted to ${elements.length} elements for processing`);

            // Use smart batching based on tokens and response time
            console.log(`🔄 AutoScanner: Using smart batching for ${elements.length} elements`);

            // Convert elements to text data format for smart batching
            const textDataArray = elements.map(element => ({
                element: element,
                text: this.scanner.extractText(element),
                selector: this.scanner.getElementSelector(element),
                tagName: element.tagName,
                className: element.className
            }));

            // Create smart batches
            const batches = this.scanner.createSmartBatches(textDataArray);
            const issues = [];

            // Process each batch using the smart batching
            for (let i = 0; i < batches.length; i++) {
                const batch = batches[i];
                const batchElements = batch.map(textData => textData.element);
                console.log(`🔄 AutoScanner: Processing smart batch ${i + 1}/${batches.length} (${batch.length} elements)`);

                // Use the processBatch method as manual scan
                const batchIssues = await this.scanner.processBatch(batchElements);
                issues.push(...batchIssues);
            }

            // Store results and prevent future duplicates
            this.storeTextResults(texts, issues);

            // Add issues to highlighted issues (same as manual scan)
            issues.forEach(issue => {
                this.scanner.highlightedIssues.set(issue.id, issue);
            });

            // Send to popup (same as manual scan)
            this.scanner.sendIssuesToPopup();

            console.log(`🔄 AutoScanner: Found ${issues.length} issues and stored ${texts.length} text results`);

            // Reset page refresh flag after first scan
            if (this.isPageRefresh) {
                this.isPageRefresh = false;
                console.log(`🔄 AutoScanner: Page refresh scan completed, returning to normal mode`);
            }

        } catch (error) {
            console.error('❌ AutoScanner: Error analyzing texts:', error);

            // If it's an API key error, show a helpful message
            if (error.message.includes('401') || error.message.includes('Unauthorized')) {
                console.warn('⚠️ AutoScanner: OpenAI API key is invalid or not configured. Please check your API key in content.js');
            }
        }
    }

    storeTextResults(texts, issues) {
        const now = Date.now();
        const issueMap = new Map();

        // Create a map of issues by text for quick lookup
        issues.forEach(issue => {
            issueMap.set(issue.text, issue);
        });

        // Store each text result
        texts.forEach(textData => {
            const issue = issueMap.get(textData.text);
            const isIssue = !!issue;

            const textResult = {
                textId: textData.textId,
                text: textData.text,
                element: textData.element,
                selector: textData.selector,
                tagName: textData.tagName,
                className: textData.className,
                isIssue: isIssue,
                issueId: issue ? issue.id : null,
                dataType: issue ? issue.dataType : null,
                timestamp: now,
                source: 'auto_scan'
            };

            // Store in cache
            this.scannedTexts.set(textData.textId, textResult);

            // Store AI result cache if available
            if (issue) {
                this.textCache.set(textData.textId, {
                    result: issue.type,
                    confidence: 'high',
                    timestamp: now
                });
            }

            console.log(`💾 AutoScanner: Stored text result - "${textData.text.substring(0, 30)}..." | Issue: ${isIssue} | textId: ${textData.textId.substring(0, 50)}...`);
        });

        // Clean up old cache entries if we exceed max size
        this.cleanupCache();

        // Save to persistent storage (only if context is valid)
        if (isExtensionContextValid()) {
            this.savePersistentCache();
        } else {
            console.log('⚠️ AutoScanner: Extension context invalidated, skipping cache save');
        }

        // Usage already recorded at start of scan
    }

    cleanupCache() {
        if (this.scannedTexts.size <= this.maxCacheSize) return;

        // Remove oldest entries
        const entries = Array.from(this.scannedTexts.entries());
        entries.sort((a, b) => a[1].timestamp - b[1].timestamp);

        const toRemove = entries.slice(0, entries.length - this.maxCacheSize);
        toRemove.forEach(([textId]) => {
            this.scannedTexts.delete(textId);
            this.textCache.delete(textId);
        });

        console.log(`🧹 AutoScanner: Cleaned up ${toRemove.length} old cache entries`);

        // Save updated cache after cleanup (only if context is valid)
        if (isExtensionContextValid()) {
            this.savePersistentCache();
        } else {
            console.log('⚠️ AutoScanner: Extension context invalidated, skipping cache save after cleanup');
        }
    }


    async loadPersistentCache() {
        try {
            const result = await chrome.storage.local.get(this.storageKey);
            if (result[this.storageKey]) {
                const cacheData = result[this.storageKey];
                const now = Date.now();
                let loadedCount = 0;
                let expiredCount = 0;

                // Restore scanned texts cache
                if (cacheData.scannedTexts) {
                    for (const [textId, textData] of Object.entries(cacheData.scannedTexts)) {
                        // Check if cache entry is still valid
                        if (now - textData.timestamp < this.cacheExpiry) {
                            this.scannedTexts.set(textId, textData);
                            loadedCount++;
                        } else {
                            expiredCount++;
                        }
                    }
                }

                // Restore AI result cache
                if (cacheData.textCache) {
                    for (const [textId, aiCacheData] of Object.entries(cacheData.textCache)) {
                        if (now - aiCacheData.timestamp < this.cacheExpiry) {
                            this.textCache.set(textId, aiCacheData);
                        }
                    }
                }

                console.log(`💾 AutoScanner: Loaded persistent cache - ${loadedCount} valid entries, ${expiredCount} expired`);
                console.log(`💾 AutoScanner: Current in-memory cache size: ${this.scannedTexts.size} entries`);

                // Debug: Show some loaded textIds
                if (loadedCount > 0) {
                    console.log(`💾 AutoScanner: Sample loaded textIds:`);
                    let count = 0;
                    for (const [textId, textData] of this.scannedTexts) {
                        if (count < 3) {
                            console.log(`  - ${textId.substring(0, 60)}... (age: ${Math.round((now - textData.timestamp) / 1000)}s)`);
                            count++;
                        }
                    }
                }

                // Restore cached issues to highlighted issues
                this.restoreCachedIssues();
            } else {
                console.log(`💾 AutoScanner: No persistent cache found, starting fresh`);
            }
        } catch (error) {
            console.error('❌ AutoScanner: Error loading persistent cache:', error);
        }
    }

    async savePersistentCache() {
        try {
            // Check if extension context is still valid
            if (!isExtensionContextValid()) {
                console.log('⚠️ AutoScanner: Extension context invalidated, skipping cache save');
                return;
            }

            const cacheData = {
                scannedTexts: Object.fromEntries(this.scannedTexts),
                textCache: Object.fromEntries(this.textCache),
                timestamp: Date.now(),
                version: '1.0'
            };

            await chrome.storage.local.set({
                [this.storageKey]: cacheData
            });

            console.log(`💾 AutoScanner: Saved persistent cache - ${this.scannedTexts.size} text entries, ${this.textCache.size} AI results`);
        } catch (error) {
            if (error.message?.includes('Extension context invalidated')) {
                console.log('⚠️ AutoScanner: Extension context invalidated, cache save skipped');
            } else {
                console.error('❌ AutoScanner: Error saving persistent cache:', error);
            }
        }
    }

    restoreCachedIssues() {
        let restoredCount = 0;

        this.scannedTexts.forEach((textData, textId) => {
            if (textData.isIssue && textData.issueId) {
                const issue = {
                    id: textData.issueId,
                    text: textData.text,
                    selector: textData.selector,
                    url: window.location.href,
                    timestamp: textData.timestamp,
                    type: 'translation_issue',
                    dataType: textData.dataType || 'static',
                    htmlTag: textData.tagName,
                    className: textData.className,
                    source: 'auto_scan_cached'
                };

                this.scanner.highlightedIssues.set(issue.id, issue);
                restoredCount++;
            }
        });

        if (restoredCount > 0) {
            console.log(`🔄 AutoScanner: Restored ${restoredCount} cached issues to highlighted issues`);
            // Send restored issues to popup
            this.scanner.sendIssuesToPopup();
        }
    }

    async clearPersistentCache() {
        try {
            await chrome.storage.local.remove(this.storageKey);
            this.scannedTexts.clear();
            this.textCache.clear();
            this.sectionHashes.clear();
            this.contentHashCache.clear();
            console.log(`🧹 AutoScanner: Cleared all persistent cache`);
        } catch (error) {
            console.error('❌ AutoScanner: Error clearing persistent cache:', error);
        }
    }

    calculateContentHash(element) {
        // Create a hash based on element's text content and structure
        const textContent = element.textContent || '';
        const tagName = element.tagName;
        const className = element.className || '';
        const id = element.id || '';

        // Include child count and structure info
        const childCount = element.children.length;
        const childTags = Array.from(element.children).map(child => child.tagName).join(',');

        // Create hash string
        const hashString = `${tagName}-${className}-${id}-${textContent}-${childCount}-${childTags}`;
        return this.hashString(hashString);
    }

    detectContentChanges() {
        const now = Date.now();
        const changes = [];

        // Skip change detection if we're in navigation mode
        if (this.isNavigating) {
            console.log(`🔄 AutoScanner: Skipping change detection during navigation`);
            return changes;
        }

        // Check if enough time has passed since last invalidation
        if (now - this.lastInvalidationTime < this.invalidationThreshold) {
            return changes;
        }

        // Check all content sections for changes
        const sections = document.querySelectorAll('.content-section, main, article, section');

        sections.forEach(section => {
            try {
                const sectionId = section.id || section.className || section.tagName;
                const currentHash = this.calculateContentHash(section);
                const previousHash = this.sectionHashes.get(sectionId);

                // Only consider it a change if the content hash actually changed
                // and it's not just a visibility/class change
                if (previousHash && previousHash !== currentHash) {
                    // Check if this is a real content change vs just visibility change
                    if (this.isRealContentChange(section, previousHash, currentHash)) {
                        changes.push({
                            sectionId: sectionId,
                            element: section,
                            previousHash: previousHash,
                            currentHash: currentHash
                        });
                        console.log(`🔄 AutoScanner: Real content change detected in section: ${sectionId}`);
                    } else {
                        console.log(`🔄 AutoScanner: Ignoring visibility change in section: ${sectionId}`);
                    }
                }

                // Update hash
                this.sectionHashes.set(sectionId, currentHash);
            } catch (error) {
                console.warn(`⚠️ AutoScanner: Error processing section for change detection:`, error);
            }
        });

        if (changes.length > 0) {
            this.lastInvalidationTime = now;
            console.log(`🔄 AutoScanner: Detected ${changes.length} real content changes`);
        }

        return changes;
    }

    isRealContentChange(section, previousHash, currentHash) {
        // Check if the change is just visibility/class changes vs actual content changes
        const currentTextContent = section.textContent || '';
        const currentChildCount = section.children.length;

        // Create a content-only hash (excluding classes and visibility)
        const contentOnlyHash = this.calculateContentOnlyHash(section);
        const previousContentOnlyHash = this.sectionHashes.get(section.id + '_content_only');

        // Update content-only hash
        this.sectionHashes.set(section.id + '_content_only', contentOnlyHash);

        // If content-only hash is the same, it's just a visibility change
        if (previousContentOnlyHash && previousContentOnlyHash === contentOnlyHash) {
            return false;
        }

        return true;
    }

    calculateContentOnlyHash(element) {
        // Create hash based only on text content and structure, ignoring classes/visibility
        const textContent = element.textContent || '';
        const tagName = element.tagName;
        const childCount = element.children.length;
        const childTags = Array.from(element.children).map(child => child.tagName).join(',');

        // Only include content-related properties, not styling/visibility
        const hashString = `${tagName}-${textContent}-${childCount}-${childTags}`;
        return this.hashString(hashString);
    }

    invalidateCacheForChanges(changes) {
        let invalidatedCount = 0;

        changes.forEach(change => {
            const sectionId = change.sectionId;
            const sectionElement = change.element;

            // Find all text IDs that belong to this section
            const textIdsToRemove = [];

            this.scannedTexts.forEach((textData, textId) => {
                // Check if this text belongs to the changed section
                if (textData.element && this.isTextInSection(textData.element, sectionElement)) {
                    textIdsToRemove.push(textId);
                }
            });

            // Remove invalidated entries
            textIdsToRemove.forEach(textId => {
                this.scannedTexts.delete(textId);
                this.textCache.delete(textId);
                invalidatedCount++;
            });

            console.log(`🧹 AutoScanner: Invalidated ${textIdsToRemove.length} cache entries for section: ${sectionId}`);
        });

        if (invalidatedCount > 0) {
            console.log(`🧹 AutoScanner: Total invalidated entries: ${invalidatedCount}`);
            // Save updated cache
            this.savePersistentCache();
        }

        return invalidatedCount;
    }

    isTextInSection(textElement, sectionElement) {
        // Check if both elements are valid DOM nodes
        if (!textElement || !sectionElement ||
            !(textElement instanceof Node) ||
            !(sectionElement instanceof Node)) {
            return false;
        }

        // Check if textElement is within sectionElement
        return sectionElement.contains(textElement) || sectionElement === textElement;
    }

    smartScan() {
        // Detect content changes first
        const changes = this.detectContentChanges();

        if (changes.length > 0) {
            // Invalidate cache for changed sections
            const invalidatedCount = this.invalidateCacheForChanges(changes);

            if (invalidatedCount > 0) {
                console.log(`🔄 AutoScanner: Smart invalidation completed, ${invalidatedCount} entries removed`);
            }
        }

        // Proceed with normal scan (will now include invalidated content)
        this.performScan();
    }

    initializeSectionHashes() {
        // Initialize content hashes for all sections
        const sections = document.querySelectorAll('.content-section, main, article, section');

        sections.forEach(section => {
            const sectionId = section.id || section.className || section.tagName;
            const hash = this.calculateContentHash(section);
            this.sectionHashes.set(sectionId, hash);
        });

        console.log(`🔄 AutoScanner: Initialized ${sections.length} section hashes for smart invalidation`);
    }

    cleanupStaleCacheAfterRefresh() {
        // After page refresh, clean up cache entries that are no longer valid
        let cleanedCount = 0;
        const currentTextElements = this.scanner.getTextElements();
        const currentTextIds = new Set();

        // Create a set of current text IDs
        currentTextElements.forEach(element => {
            const text = this.scanner.extractText(element);
            if (text && text.length >= 3) {
                const textId = this.createTextId(element, text);
                currentTextIds.add(textId);
            }
        });

        // Remove cache entries that no longer exist on the page
        const staleTextIds = [];
        this.scannedTexts.forEach((cached, textId) => {
            if (!currentTextIds.has(textId)) {
                staleTextIds.push(textId);
            }
        });

        // Clean up stale entries
        staleTextIds.forEach(textId => {
            this.scannedTexts.delete(textId);
            this.textCache.delete(textId);
            cleanedCount++;
        });

        if (cleanedCount > 0) {
            console.log(`🧹 AutoScanner: Cleaned up ${cleanedCount} stale cache entries after refresh`);
            // Save updated cache
            this.savePersistentCache();
        }
    }

    buildAIPrompt(texts, targetLanguage) {
        const languageNames = {
            'en': 'English',
            'fr': 'French',
            'ar': 'Arabic'
        };

        const expectedLanguage = languageNames[targetLanguage] || 'English';

        let prompt = `You are a translation QA expert. Analyze each text and classify as:\n`;
        prompt += `- Static/Issue (UI element not in ${expectedLanguage})\n`;
        prompt += `- Static/No_Issue (UI element correctly in ${expectedLanguage})\n`;
        prompt += `- Dynamic/Issue (user content not in ${expectedLanguage})\n`;
        prompt += `- Dynamic/No_Issue (user content correctly in ${expectedLanguage})\n\n`;
        prompt += `Texts to analyze:\n`;

        texts.forEach((textData, index) => {
            const classInfo = textData.className ? ` class="${textData.className}"` : '';
            prompt += `${index + 1}. "${textData.text}" | <${textData.tagName ? textData.tagName.toLowerCase() : 'unknown'}${classInfo}>\n`;
        });

        prompt += `\nResults (one per line):\n`;

        return prompt;
    }

    async processAutoScanResults(texts, results) {
        const newIssues = [];

        for (let i = 0; i < texts.length && i < results.length; i++) {
            const textData = texts[i];
            const aiResult = results[i];

            const isIssue = aiResult && (aiResult.includes('Static/Issue') || aiResult.includes('Dynamic/Issue'));

            if (isIssue) {
                const issue = {
                    id: `auto_issue_${Date.now()}_${i}`,
                    text: textData.text,
                    selector: textData.selector,
                    url: window.location.href,
                    timestamp: new Date().toISOString(),
                    type: 'translation_issue',
                    dataType: aiResult.includes('Static') ? 'static' : 'dynamic',
                    htmlTag: textData.tagName,
                    className: textData.className,
                    source: 'auto_scan'
                };

                newIssues.push(issue);
                this.scanner.highlightIssue(textData.element, issue);

                console.log(`🔄 AutoScanner: New issue detected: ${aiResult} | Text: "${textData.text}"`);
            }
        }

        if (newIssues.length > 0) {
            // Add new issues to the scanner's issue collection
            newIssues.forEach(issue => {
                this.scanner.highlightedIssues.set(issue.id, issue);
            });

            // Send issues to popup (with error handling)
            try {
                this.scanner.sendIssuesToPopup();
                console.log(`🔄 AutoScanner: Found ${newIssues.length} new issues`);
            } catch (error) {
                console.log(`🔄 AutoScanner: Found ${newIssues.length} new issues (popup unavailable)`);
            }

            // Show notification for new issues
            if (newIssues.length > 0) {
                this.showNotification(`${newIssues.length} new translation issue${newIssues.length > 1 ? 's' : ''} detected!`);
            }
        }
    }

    showNotification(message) {
        // Create a simple notification element
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #007bff;
            color: white;
            padding: 15px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            z-index: 10000;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 14px;
            font-weight: 500;
            max-width: 300px;
            animation: slideIn 0.3s ease-out;
        `;

        notification.textContent = message;

        // Add animation styles
        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            @keyframes slideOut {
                from { transform: translateX(0); opacity: 1; }
                to { transform: translateX(100%); opacity: 0; }
            }
        `;
        document.head.appendChild(style);

        // Add to page
        document.body.appendChild(notification);

        // Auto-remove after 5 seconds
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease-in';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 5000);

        console.log(`🔔 Notification: ${message}`);
    }

}

// Inject CSS styles
function injectStyles() {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = chrome.runtime.getURL('content/content.css');
    document.head.appendChild(link);
    console.log('🎨 TranslateMe styles injected');
}

// Global helper function for extension context validation
function isExtensionContextValid() {
    return !!(chrome.runtime && chrome.runtime.id);
}

// Initialize scanner
console.log('🚀 Initializing TranslateMe Scanner...');
console.log('📍 Content script loaded on:', window.location.href);
injectStyles();
const scanner = new TranslateMeScanner();
console.log('✅ TranslateMe Scanner ready');


