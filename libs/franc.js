// Franc.js - Language Detection Library
// This is a simplified version of franc for browser extension use
// Original: https://github.com/wooorm/franc

// Language detection data (simplified for common languages)
const languageData = {
    'en': { name: 'English', patterns: /[a-zA-Z]/g, commonWords: ['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'] },
    'es': { name: 'Spanish', patterns: /[a-zA-Záéíóúñü]/g, commonWords: ['el', 'la', 'de', 'que', 'y', 'a', 'en', 'un', 'es', 'se', 'no', 'te', 'lo', 'le', 'da', 'su', 'por', 'son', 'con', 'para'] },
    'fr': { name: 'French', patterns: /[a-zA-Zàâäéèêëïîôöùûüÿç]/g, commonWords: ['le', 'de', 'et', 'à', 'un', 'il', 'être', 'et', 'en', 'avoir', 'que', 'pour', 'dans', 'ce', 'son', 'une', 'sur', 'avec', 'ne', 'se', 'rechercher', 'bienvenue', 'accueil', 'contact', 'produits', 'services', 'nos', 'votre', 'notre', 'vous', 'nous', 'merci', 'bonjour', 'aujourd\'hui', 'très', 'content', 'voir', 'ici', 'beaucoup', 'visite'] },
    'de': { name: 'German', patterns: /[a-zA-Zäöüß]/g, commonWords: ['der', 'die', 'und', 'in', 'den', 'von', 'zu', 'das', 'mit', 'sich', 'des', 'auf', 'für', 'ist', 'im', 'dem', 'nicht', 'ein', 'eine', 'als'] },
    'it': { name: 'Italian', patterns: /[a-zA-Zàèéìíîòóùú]/g, commonWords: ['di', 'a', 'da', 'in', 'con', 'su', 'per', 'tra', 'fra', 'il', 'lo', 'la', 'i', 'gli', 'le', 'un', 'uno', 'una', 'del', 'della'] },
    'pt': { name: 'Portuguese', patterns: /[a-zA-Zàáâãéêíóôõú]/g, commonWords: ['de', 'a', 'o', 'e', 'do', 'da', 'em', 'um', 'para', 'é', 'com', 'não', 'uma', 'os', 'no', 'se', 'na', 'por', 'mais', 'as'] },
    'ru': { name: 'Russian', patterns: /[а-яё]/g, commonWords: ['и', 'в', 'не', 'на', 'я', 'быть', 'с', 'со', 'а', 'как', 'по', 'но', 'они', 'к', 'у', 'мы', 'за', 'вы', 'от', 'что'] },
    'ar': { name: 'Arabic', patterns: /[\u0600-\u06FF]/g, commonWords: ['في', 'من', 'إلى', 'على', 'هذا', 'هذه', 'التي', 'الذي', 'كان', 'كانت', 'يكون', 'تكون', 'له', 'لها', 'لهما', 'لهم', 'لهن', 'بعد', 'قبل', 'عند'] },
    'zh': { name: 'Chinese', patterns: /[\u4e00-\u9fff]/g, commonWords: ['的', '了', '在', '是', '我', '有', '和', '就', '不', '人', '都', '一', '一个', '上', '也', '很', '到', '说', '要', '去'] },
    'ja': { name: 'Japanese', patterns: /[\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]/g, commonWords: ['の', 'に', 'は', 'を', 'た', 'が', 'で', 'て', 'と', 'し', 'れ', 'さ', 'ある', 'いる', 'も', 'する', 'から', 'な', 'こと', 'として'] },
    'ko': { name: 'Korean', patterns: /[\uac00-\ud7af]/g, commonWords: ['이', '그', '저', '의', '가', '을', '를', '에', '에서', '로', '으로', '와', '과', '도', '는', '은', '이', '가', '을', '를'] }
};

class Franc {

    // Language detection function
    detectLanguage(text) {
        if (!text || typeof text !== 'string') {
            return { language: 'unknown', confidence: 0 };
        }

        const cleanText = text.trim();
        if (cleanText.length < 3) {
            return { language: 'unknown', confidence: 0 };
        }

        let bestMatch = { language: 'unknown', confidence: 0 };
        const scores = {};

        // Calculate scores for each language
        Object.keys(languageData).forEach(lang => {
            const data = languageData[lang];
            let score = 0;
            let totalChars = 0;

            // Check character patterns
            const matches = cleanText.match(data.patterns);
            if (matches) {
                score += matches.length * 0.3;
                totalChars += matches.length;
            }

            // Check common words
            const words = cleanText.toLowerCase().split(/\s+/);
            words.forEach(word => {
                // Remove punctuation for better matching
                const cleanWord = word.replace(/[.,!?;:()"'`~]/g, '');
                if (data.commonWords.includes(cleanWord)) {
                    score += 2; // Common words are weighted more
                    console.log(`🎯 French word match: "${cleanWord}" in "${cleanText}"`);
                }
            });

            // Normalize score
            if (totalChars > 0) {
                score = score / (totalChars + words.length);
                scores[lang] = score;
            }
        });

        // Find the best match
        Object.keys(scores).forEach(lang => {
            if (scores[lang] > bestMatch.confidence) {
                bestMatch = {
                    language: lang,
                    confidence: Math.min(scores[lang], 1.0)
                };
            }
        });

        console.log(`🔍 Language detection for "${cleanText}":`, {
            scores: scores,
            bestMatch: bestMatch
        });

        // If confidence is too low, return unknown
        if (bestMatch.confidence < 0.1) {
            return { language: 'unknown', confidence: 0 };
        }

        return bestMatch;
    }

    // Get language name
    getLanguageName(code) {
        return languageData[code] ? languageData[code].name : code;
    }

    // Get all supported languages
    getSupportedLanguages() {
        return Object.keys(languageData).map(code => ({
            code: code,
            name: languageData[code].name
        }));
    }
}

// Export for Chrome extension (no ES6 modules)
window.Franc = Franc;
