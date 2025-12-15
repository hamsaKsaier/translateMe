// API Configuration Example for TranslateMe Extension
// Copy this file to api.config.js and replace with your actual API keys

const API_CONFIG = {
    // OpenAI Configuration (Optional - kept for future use)
    // openai: {
    //     apiKey: 'YOUR_OPENAI_API_KEY',
    //     model: 'gpt-4o',
    //     maxTokens: 300,
    //     temperature: 0.2,
    //     plan: 'trial'
    // },

    // OpenRouter Configuration - Get your free API key from https://openrouter.ai/
    openrouter: {
        apiKey: '', // ⚠️ Set your OpenRouter API key here (get free key from https://openrouter.ai/)
        model: 'deepseek/deepseek-chat',
        maxTokens: 200,
        temperature: 0.3,
        plan: 'free',
        baseUrl: 'https://openrouter.ai/api/v1/chat/completions'
    },

    // Groq Configuration (Alternative Free Option)
    groq: {
        apiKey: '', // ⚠️ Get your free Groq API key from https://console.groq.com/keys if needed
        model: 'llama-3.1-8b-instant',
        maxTokens: 200,
        temperature: 0.3,
        plan: 'free',
        baseUrl: 'https://api.groq.com/openai/v1/chat/completions'
    },

    // Plan-based provider selection
    planProviders: {
        trial: 'openrouter',
        free: 'openrouter',
        pro: 'openrouter',
        enterprise: 'openrouter'
    },

    // Fallback behavior when AI fails
    fallbackBehavior: 'static_issue' // 'static_issue', 'static_no_issue', or 'skip'
};

// Export for use in content script
if (typeof module !== 'undefined' && module.exports) {
    module.exports = API_CONFIG;
} else {
    window.API_CONFIG = API_CONFIG;
}
