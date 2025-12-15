# TranslateMe Extension - Quick Start Guide

## Overview

TranslateMe is a Chrome extension that automatically detects translation issues in web applications. It now includes Google authentication via Supabase to ensure secure access.

## Quick Setup (5 minutes)

### 1. Install Dependencies

```bash
cd translateMe
npm install
```

### 2. Configure Supabase

1. Create a Supabase account at [supabase.com](https://supabase.com)
2. Create a new project
3. Copy `config/supabase.config.example.js` to `config/supabase.config.js`
4. Update with your Supabase credentials:

```javascript
const SUPABASE_CONFIG = {
    url: 'https://YOUR_PROJECT_ID.supabase.co',
    anonKey: 'YOUR_SUPABASE_ANON_KEY'
};
```

### 3. Set up Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable Google+ API
4. Create OAuth 2.0 credentials (Chrome Extension type)
5. Update `manifest.json` with your Client ID:

```json
"oauth2": {
    "client_id": "YOUR_CLIENT_ID.apps.googleusercontent.com",
    ...
}
```

### 4. Load Extension in Chrome

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" (top right)
3. Click "Load unpacked"
4. Select the `translateMe` directory
5. Copy the Extension ID

### 5. Update Google Cloud Console

1. Go back to Google Cloud Console
2. Update your OAuth credentials with the Extension ID from step 4
3. Save changes

### 6. Enable Google Provider in Supabase

1. In Supabase dashboard, go to Authentication → Providers
2. Enable Google
3. Add your Google OAuth Client ID and Secret
4. Save

## Usage

1. Click the extension icon in Chrome
2. Sign in with your Google account
3. Select the language you want to test
4. Click "Scan Page" to detect translation issues
5. Review detected issues in the popup

## Features

- ✅ **Google Authentication**: Secure sign-in with Google
- 🔍 **Automatic Scanning**: Detect untranslated text
- 🎨 **Visual Highlighting**: Highlight issues on the page
- 📊 **Issue Filtering**: Filter by static/dynamic content
- 💾 **Persistent Storage**: Save and export results
- 🔄 **Auto-scan Mode**: Automatically scan websites

## Support

For detailed setup instructions, see [AUTH_SETUP.md](AUTH_SETUP.md)

## Troubleshooting

### Authentication Issues

If you can't sign in:
1. Check browser console for errors
2. Verify Supabase credentials are correct
3. Ensure Google OAuth is properly configured
4. Make sure Extension ID is updated in Google Cloud Console

### Extension Not Loading

If the extension doesn't load:
1. Check that all dependencies are installed (`npm install`)
2. Verify `config/supabase.config.js` exists and is configured
3. Check for errors in Chrome extension error console

## Next Steps

- Read [AUTH_SETUP.md](AUTH_SETUP.md) for detailed authentication setup
- Check [TESTING.md](TESTING.md) for testing guidelines
- See [README.md](README.md) for full documentation

