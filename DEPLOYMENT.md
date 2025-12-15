# Deployment Guide for TranslateMe Extension

## Pre-Deployment Checklist

### 1. Security Check
- [ ] Ensure `config/api.config.js` is NOT committed (contains API keys)
- [ ] Ensure `config/supabase.config.js` is NOT committed (contains Supabase keys)
- [ ] Verify `.gitignore` excludes sensitive files
- [ ] Remove any hardcoded API keys from code

### 2. Version Update
- [ ] Update version in `manifest.json`
- [ ] Update version in any documentation

### 3. Testing
- [ ] Test extension in Chrome
- [ ] Test keyboard shortcut (Ctrl+Shift+S / Cmd+Shift+S)
- [ ] Test context menu (right-click → Scan this page)
- [ ] Test donation button
- [ ] Test auto-scan feature
- [ ] Verify all features work with free API

## Preparing Deployment Package

### For Chrome Web Store

1. **Create deployment folder:**
   ```bash
   mkdir -p deploy/chrome-store
   ```

2. **Copy required files** (use the `prepare-deploy.sh` script or manually):
   - All files EXCEPT:
     - `node_modules/`
     - `config/api.config.js` (contains API keys)
     - `config/supabase.config.js` (contains Supabase keys)
     - `.git/`
     - `.cursor/`
     - `*.log`
     - `test-website/` (optional - can exclude)
     - `screens/` (optional - can exclude)
     - Documentation files (optional for store)

3. **Required files for Chrome Web Store:**
   - `manifest.json`
   - All `popup/` files
   - All `content/` files
   - All `background/` files
   - All `auth/` files
   - All `libs/` files
   - All `services/` files
   - All `assets/icons/` files (PNG versions)
   - `config/supabase.config.example.js` (for reference)
   - `config/api.config.js` (MUST include - but ensure API keys are production-ready)

4. **Create ZIP file:**
   ```bash
   cd deploy/chrome-store
   zip -r translateMe-v1.0.2.zip . -x "*.DS_Store" "*.git*"
   ```

## GitHub Deployment

### Files to Commit:
- All source code
- Documentation files
- Example config files
- Icons and assets

### Files NOT to Commit:
- `config/api.config.js` (contains API keys)
- `config/supabase.config.js` (contains Supabase keys)
- `node_modules/`
- `.cursor/`
- Log files

### GitHub Setup:
1. Initialize git (if not already):
   ```bash
   git init
   git add .
   git commit -m "Initial commit - TranslateMe Extension v1.0.2"
   ```

2. Create GitHub repository and push:
   ```bash
   git remote add origin <your-github-repo-url>
   git branch -M main
   git push -u origin main
   ```

## Chrome Web Store Upload

1. Go to [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
2. Click "New Item"
3. Upload the ZIP file from `deploy/chrome-store/`
4. Fill in store listing details
5. Submit for review

## Important Notes

- **API Keys**: The `config/api.config.js` file MUST be included in the Chrome Web Store package (it's needed for the extension to work), but ensure the keys are production-ready and have proper usage limits
- **Supabase Keys**: The `config/supabase.config.js` file MUST be included in the Chrome Web Store package
- **Version**: Always increment version in `manifest.json` before each deployment
- **Testing**: Always test the extension after packaging to ensure it works

