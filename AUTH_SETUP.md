# Authentication Setup Guide

This guide will help you set up Google OAuth authentication for the TranslateMe extension.

## Prerequisites

- A Supabase account ([supabase.com](https://supabase.com))
- A Google Cloud Console account ([console.cloud.google.com](https://console.cloud.google.com))

## Step 1: Set Up Supabase

1. **Create a Supabase project:**
   - Go to [supabase.com](https://supabase.com)
   - Sign up or log in
   - Click "New Project"
   - Fill in project details and create

2. **Get your Supabase credentials:**
   - Go to Project Settings → API
   - Copy your Project URL
   - Copy your `anon` (public) key

3. **Configure Supabase config file:**
   - Copy `config/supabase.config.example.js` to `config/supabase.config.js`
   - Replace the placeholder values with your actual Supabase URL and anon key

## Step 2: Set Up Google OAuth

1. **Create OAuth 2.0 credentials in Google Cloud Console:**
   - Go to [Google Cloud Console](https://console.cloud.google.com)
   - Create a new project or select an existing one
   - Enable the Google+ API
   - Go to "Credentials" → "Create Credentials" → "OAuth client ID"
   - Choose "Chrome App" as application type
   - Enter your extension name
   - Click "Create"

2. **Get your Extension ID:**
   - Load the extension in Chrome (see README.md for instructions)
   - Go to `chrome://extensions/`
   - Find TranslateMe extension
   - Copy the Extension ID (looks like: `abcdefghijklmnopqrstuvwxyz123456`)

3. **Update Google OAuth credentials:**
   - Go back to Google Cloud Console
   - Edit your OAuth 2.0 client
   - Add your Extension ID to the application ID field
   - Save changes

4. **Configure redirect URIs:**
   - In Google Cloud Console, add these redirect URIs:
     - `chrome-extension://YOUR_EXTENSION_ID/`
     - `https://YOUR_SUPABASE_PROJECT_ID.supabase.co/auth/v1/callback`
   - Replace `YOUR_EXTENSION_ID` and `YOUR_SUPABASE_PROJECT_ID` with actual values

## Step 3: Configure Supabase OAuth

1. **Enable Google provider in Supabase:**
   - Go to Supabase Dashboard → Authentication → Providers
   - Enable "Google" provider
   - Enter your Google OAuth Client ID and Client Secret
   - Add redirect URL: `chrome-extension://YOUR_EXTENSION_ID/`
   - Save

2. **Configure Supabase redirect URLs:**
   - Go to Authentication → URL Configuration
   - Add Site URL: `chrome-extension://YOUR_EXTENSION_ID/`
   - Add Redirect URLs:
     - `chrome-extension://YOUR_EXTENSION_ID/`
     - `https://YOUR_SUPABASE_PROJECT_ID.supabase.co/auth/v1/callback`

## Step 4: Update manifest.json

1. **Add OAuth client ID to manifest:**
   - Open `manifest.json`
   - Find the `oauth2` section
   - Replace the `client_id` with your Google OAuth Client ID from Step 2

## Step 5: Test Authentication

1. **Load the extension in Chrome**
2. **Click the extension icon**
3. **Click "Sign in with Google"**
4. **Complete the Google sign-in flow**
5. **Verify you're signed in**

## Troubleshooting

### Brave Browser Issues

If you're using Brave browser, see `BRAVE_OAUTH_SETUP.md` for specific instructions.

### Common Errors

- **"Invalid client ID"**: Check that your OAuth client ID in `manifest.json` matches Google Cloud Console
- **"Redirect URI mismatch"**: Verify redirect URIs in both Google Cloud Console and Supabase
- **"Extension not found"**: Ensure the extension is loaded and you're using the correct Extension ID

## Security Notes

- **Never commit** `config/supabase.config.js` (it contains your Supabase keys)
- Keep your Google OAuth credentials secure
- Use environment variables or secure storage for production

## Need Help?

If you encounter issues:
1. Check the browser console for error messages
2. Verify all configuration steps were completed
3. Open an issue on GitHub with details
