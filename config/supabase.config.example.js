// Supabase Configuration Example
// Copy this file to supabase.config.js and replace with your actual values

const SUPABASE_CONFIG = {
    url: 'https://ikrbjqzsrubizrranzjt.supabase.co', // e.g., 'https://xxxxxxxxxxxxx.supabase.co'
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlrcmJqcXpzcnViaXpycmFuemp0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg1NTcyODQsImV4cCI6MjA3NDEzMzI4NH0.d_yD-Nl0Fmgtsum3X3g0t1vfRVfTOwzaGZsceGMG430' // Your Supabase anonymous key
};

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SUPABASE_CONFIG;
}

