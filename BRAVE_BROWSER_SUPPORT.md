# Brave Browser Support

TranslateMe extension works with Brave browser, but requires special OAuth configuration due to Brave's privacy-focused architecture.

## Overview

Brave browser has known issues with Chrome's `chrome.identity.getAuthToken()` API. The extension automatically detects Brave and uses a standard OAuth redirect flow instead.

## Quick Setup

### 1. Get Your Extension ID

1. Load the extension in Brave
2. Go to `brave://extensions/`
3. Copy the **Extension ID** (e.g., `gabbpcedghcdopahjhfejoeejmbcjokp`)

### 2. Configure Supabase Redirect URI

1. Go to Supabase Dashboard → Authentication → URL Configuration
2. Add to **Redirect URLs**:
   ```
   chrome-extension://YOUR_EXTENSION_ID/
   ```
3. Replace `YOUR_EXTENSION_ID` with your actual extension ID
4. Click **Save**

### 3. Configure Google Cloud Console

1. Go to Google Cloud Console → APIs & Services → Credentials
2. Edit your OAuth 2.0 Client ID
3. Add to **Authorized redirect URIs**:
   ```
   https://YOUR_PROJECT_ID.supabase.co/auth/v1/callback
   ```
4. Add to **Authorized JavaScript origins**:
   ```
   https://YOUR_PROJECT_ID.supabase.co
   ```
5. Click **Save**

## How It Works

The extension automatically detects Brave browser and uses OAuth redirect flow:

1. User clicks "Sign in with Google"
2. Extension opens new tab with Google sign-in
3. User completes Google authentication
4. Google redirects to Supabase callback
5. Supabase processes OAuth and redirects to extension
6. Extension extracts tokens and completes authentication

## Troubleshooting

### "Access blocked: verificationCode's request is invalid"

**Solution:**
- Verify redirect URI in Supabase: `chrome-extension://[YOUR_EXTENSION_ID]/`
- Verify Google Cloud Console has Supabase callback URL
- Check that Extension ID is correct (it may change when reloading unpacked extension)

### "No OAuth URL returned from Supabase"

**Solution:**
- Check Supabase → Authentication → Providers → Google is enabled
- Verify Google OAuth credentials are correct in Supabase
- Check redirect URLs in Supabase configuration

### Extension ID Changed

When developing with unpacked extension, the Extension ID may change after reloading. Update the redirect URI in Supabase with the new ID.

**Note:** Once published to Chrome Web Store, the Extension ID is stable (thanks to `key` field in manifest.json).

## Technical Details

### Why Chrome Identity API Fails in Brave

Brave's privacy architecture restricts Chrome's internal OAuth service. Even with "Allow Google login for extensions" enabled, `chrome.identity.getAuthToken()` may fail because:

1. Brave treats it as a 3rd party login (not 1st party)
2. User must be logged into Google in Brave for it to work
3. Supabase OAuth (3rd party) may not be fully compatible

### OAuth Redirect Flow (Solution)

The extension uses standard web OAuth 2.0 flow that works in all browsers:

- No dependency on Chrome-specific APIs
- Works with 3rd party OAuth providers (like Supabase)
- No requirement for user to be logged into Google
- More transparent user experience

## Testing Checklist

- [ ] Extension loads in Brave without errors
- [ ] "Sign in with Google" opens new tab
- [ ] Google sign-in completes successfully
- [ ] Extension receives authentication tokens
- [ ] User is signed in and can use extension features

## References

- [Brave Browser Wiki - Allow Google login](https://github.com/brave/brave-browser/wiki/Allow-Google-login---Third-Parties-and-Extensions)
- [Chrome Identity API Documentation](https://developer.chrome.com/docs/extensions/reference/identity/)
