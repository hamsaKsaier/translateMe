// API Configuration Example
// Copy this file to api.config.js and replace with your actual API key

// OpenRouter API Configuration (Free DeepSeek access)
// Get your API key from: https://openrouter.ai/keys
window.API_CONFIG = {
    openrouter: {
        apiKey: 'YOUR_OPENROUTER_API_KEY_HERE', // Replace with your OpenRouter API key
        model: 'deepseek/deepseek-chat',        // DeepSeek model (free)
        maxTokens: 200,                          // Maximum tokens per response
        temperature: 0.3,                       // Response creativity (0-1)
        baseUrl: 'https://openrouter.ai/api/v1/chat/completions'
    }
};

// Alternative: OpenAI Configuration (if you prefer OpenAI)
// window.API_CONFIG = {
//     openai: {
//         apiKey: 'YOUR_OPENAI_API_KEY_HERE',
//         model: 'gpt-4o',
//         maxTokens: 200,
//         temperature: 0.3
//     }
// };

// Note: The extension currently uses OpenRouter/DeepSeek by default (free API)
// You can modify content/content.js to support other providers if needed
