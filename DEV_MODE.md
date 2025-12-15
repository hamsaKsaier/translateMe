# Development Mode Configuration

## Overview
The extension now includes a logger utility that silences all console logs in production mode. Console logs will only appear when development mode is enabled.

## How to Enable Development Mode

### Method 1: Using Chrome Storage (Recommended)
1. Open the extension popup
2. Open Chrome DevTools (F12)
3. Go to Console tab
4. Run this command:
```javascript
chrome.storage.local.set({ devMode: true })
```
5. Reload the extension

### Method 2: Using Logger API
In any script context, you can enable dev mode:
```javascript
if (typeof logger !== 'undefined') {
    logger.enableDevMode();
}
```

## How to Disable Development Mode

### Method 1: Using Chrome Storage
```javascript
chrome.storage.local.set({ devMode: false })
```

### Method 2: Using Logger API
```javascript
if (typeof logger !== 'undefined') {
    logger.disableDevMode();
}
```

## Default Behavior
- **Production (Default)**: All console logs are silenced
- **Development**: Console logs work normally when devMode is enabled

## Files Modified
- `libs/logger.js` - Logger utility that overrides console methods
- `manifest.json` - Logger loaded first in content scripts
- `popup/popup.html` - Logger loaded before other scripts
- `auth/auth.html` - Logger loaded before other scripts

## Notes
- The logger automatically silences console.log, console.error, console.warn, console.info, and console.debug in production
- Existing console statements don't need to be changed - they're automatically handled
- To check if dev mode is active: `logger.isDevMode()`

