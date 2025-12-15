# Brave Browser OAuth Setup Guide

## Problem
Brave browser has known issues with `chrome.identity.getAuthToken()` and may show "Access blocked: verificationCode's request is invalid" even when "Allow Google login for extensions" is enabled.

## Solution
Use Supabase OAuth redirect flow instead of Chrome Identity API. This requires proper configuration in both Supabase and Google Cloud Console.

## Step-by-Step Configuration

### 1. Get Your Extension ID

1. Load your extension in Brave/Chrome
2. Go to `brave://extensions/` (or `chrome://extensions/`)
3. Find your extension and copy the **Extension ID** (e.g., `gabbpcedghcdopahjhfejoeejmbcjokp`)

### 2. Configure Redirect URI in Supabase

1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Select your project
3. Go to **Authentication** → **URL Configuration**
4. In the **Redirect URLs** section, add:
   ```
   chrome-extension://YOUR_EXTENSION_ID/
   ```
   Replace `YOUR_EXTENSION_ID` with your actual extension ID (e.g., `chrome-extension://gabbpcedghcdopahjhfejoeejmbcjokp/`)

5. Click **Save**

### 3. Configure Google OAuth in Supabase

1. In Supabase Dashboard, go to **Authentication** → **Providers**
2. Find **Google** and click to configure
3. Ensure **Google** is enabled
4. Add your **Google OAuth Client ID** and **Client Secret**
5. In **Authorized redirect URIs**, make sure it includes:
   ```
   https://YOUR_PROJECT_ID.supabase.co/auth/v1/callback
   ```
   (This should already be there, but verify)

6. Click **Save**

### 4. Configure Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project
3. Go to **APIs & Services** → **Credentials**
4. Find your OAuth 2.0 Client ID (the one in your `manifest.json`)
5. Click to edit it
6. In **Authorized redirect URIs**, add:
   ```
   https://YOUR_PROJECT_ID.supabase.co/auth/v1/callback
   ```
   (This is Supabase's callback URL - it handles the OAuth flow)

7. In **Authorized JavaScript origins**, add:
   ```
   https://YOUR_PROJECT_ID.supabase.co
   ```

8. Click **Save**

### 5. Verify Extension Configuration

Your `manifest.json` should have:
```json
{
  "permissions": [
    "identity",
    "tabs"
  ],
  "oauth2": {
    "client_id": "YOUR_CLIENT_ID.apps.googleusercontent.com",
    "scopes": ["openid", "email", "profile"]
  }
}
```

## How It Works

1. User clicks "Sign in with Google" in Brave
2. Extension opens a new tab with Supabase OAuth URL
3. User signs in with Google
4. Google redirects to Supabase callback URL
5. Supabase processes the OAuth and redirects to `chrome-extension://[id]/`
6. Background script detects the callback and extracts tokens
7. Extension completes authentication

## Troubleshooting

### Error: "Access blocked: verificationCode's request is invalid"

**Cause**: Redirect URI not properly configured in Google Cloud Console or Supabase.

**Solution**:
1. Verify the redirect URI in Supabase matches: `chrome-extension://[YOUR_EXTENSION_ID]/`
2. Verify Google Cloud Console has Supabase callback URL: `https://[PROJECT_ID].supabase.co/auth/v1/callback`
3. Make sure you're using the correct Extension ID (it changes if you reload the extension)

### Error: "No OAuth URL returned from Supabase"

**Cause**: Supabase redirect URL not configured or Google provider not enabled.

**Solution**:
1. Check Supabase → Authentication → URL Configuration → Redirect URLs
2. Check Supabase → Authentication → Providers → Google is enabled
3. Verify Google OAuth credentials in Supabase

### Extension ID Changed After Reload

**Cause**: Extension ID changes when you reload an unpacked extension.

**Solution**:
1. Get the new Extension ID from `brave://extensions/`
2. Update the redirect URI in Supabase with the new ID
3. The Extension ID is stable once published to Chrome Web Store

## Testing

1. Open Brave browser
2. Enable "Allow Google login for extensions" in `brave://settings/extensions`
3. Load your extension
4. Click "Sign in with Google"
5. A new tab should open with Google sign-in
6. After signing in, the extension should complete authentication automatically

## Notes

- The Extension ID is different for unpacked extensions vs. published extensions
- Once published to Chrome Web Store, the Extension ID is stable (thanks to the `key` field in manifest.json)
- For development, you may need to update the redirect URI in Supabase each time you reload the extension
- Consider using a development redirect URI that works for all extension IDs during testing



