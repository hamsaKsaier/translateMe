// Language Detector Utility for TranslateMe Extension
// Uses franc.js for language detection with additional utilities

class LanguageDetector {
    constructor() {
        this.franc = null;
        this.initialized = false;
        this.initPromise = null;
    }

    async initialize() {
        if (this.initialized) return;
        if (this.initPromise) return this.initPromise;

        this.initPromise = this.loadFranc();
        await this.initPromise;
        this.initialized = true;
    }

    async loadFranc() {
        try {
            // Import franc.js as ES6 module
            const { default: Franc } = await import(chrome.runtime.getURL('libs/franc.js'));
            this.franc = new Franc();
            console.log('✅ Franc language detection library loaded');
        } catch (error) {
            console.error('❌ Failed to load franc.js:', error);
            throw error;
        }
    }

    async detectLanguage(text, options = {}) {
        await this.initialize();

        if (!this.franc) {
            throw new Error('Language detection library not loaded');
        }

        const {
            minLength = 3,
            confidenceThreshold = 0.1,
            whitelist = null,
            blacklist = ['unknown']
        } = options;

        // Basic validation
        if (!text || typeof text !== 'string') {
            return { language: 'unknown', confidence: 0, alternatives: [] };
        }

        const cleanText = text.trim();
        if (cleanText.length < minLength) {
            return { language: 'unknown', confidence: 0, alternatives: [] };
        }

        try {
            // Use franc for detection
            const result = this.franc.detectLanguage(cleanText);

            // Apply whitelist/blacklist filters
            if (blacklist && blacklist.includes(result.language)) {
                result.language = 'unknown';
                result.confidence = 0;
            }

            if (whitelist && !whitelist.includes(result.language)) {
                result.language = 'unknown';
                result.confidence = 0;
            }

            // Filter out results below confidence threshold
            if (result.confidence < confidenceThreshold) {
                result.language = 'unknown';
                result.confidence = 0;
            }

            // Add language name
            result.languageName = this.franc.getLanguageName(result.language);

            // Generate alternatives (simplified)
            result.alternatives = this.generateAlternatives(cleanText, result.language);

            return result;
        } catch (error) {
            console.error('Language detection error:', error);
            return { language: 'unknown', confidence: 0, alternatives: [] };
        }
    }

    generateAlternatives(text, primaryLanguage) {
        // Simplified alternative generation - return empty for now
        // In a production system, this would use more sophisticated methods
        return [];
    }

    calculateSimpleScore(text, language) {
        // Simple scoring based on character patterns
        const patterns = {
            'en': /[a-zA-Z]/g,
            'es': /[a-zA-Záéíóúñü]/g,
            'fr': /[a-zA-Zàâäéèêëïîôöùûüÿç]/g,
            'de': /[a-zA-Zäöüß]/g,
            'ru': /[а-яё]/g,
            'ja': /[ひらがなカタカナ漢字]/g,
            'ko': /[ㄱ-ㅎㅏ-ㅣ가-힣]/g,
            'zh': /[一-龯]/g,
            'ar': /[ء-ي]/g,
            'hi': /[अ-ह]/g
        };

        const pattern = patterns[language];
        if (!pattern) return 0;

        const matches = text.match(pattern);
        if (!matches) return 0;

        return Math.min(matches.length / text.length, 1.0);
    }

    getSupportedLanguages() {
        if (!this.franc) {
            return [];
        }
        return this.franc.getSupportedLanguages();
    }

    isLanguageSupported(languageCode) {
        const supported = this.getSupportedLanguages();
        return supported.some(lang => lang.code === languageCode);
    }

    // DEPRECATED: Batch detection removed - now using optimized Groq batch processing
}

// Export for use in content script
window.LanguageDetector = LanguageDetector;

if (typeof window !== 'undefined') {
    window.LanguageDetector = LanguageDetector;
} else if (typeof module !== 'undefined' && module.exports) {
    module.exports = LanguageDetector;
}
