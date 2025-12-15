// Supabase Configuration Example
// Copy this file to supabase.config.js and replace with your actual values

const SUPABASE_CONFIG = {
    url: 'https://your-project.supabase.co', // e.g., 'https://xxxxxxxxxxxxx.supabase.co'
    anonKey: 'YOUR_SUPABASE_ANON_KEY' // Your Supabase anonymous key
};

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SUPABASE_CONFIG;
}

