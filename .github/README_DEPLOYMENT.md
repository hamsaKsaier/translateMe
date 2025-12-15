# Deployment Instructions

## Before Deploying

1. **Update version** in `manifest.json`
2. **Test thoroughly** on a clean Chrome profile
3. **Verify API keys** are production-ready in `config/api.config.js`

## Quick Deploy

Run the deployment script:
```bash
./prepare-deploy.sh
```

This will create a ZIP file in `deploy/` folder ready for Chrome Web Store upload.

## Manual Deployment

1. Copy all files EXCEPT:
   - `node_modules/`
   - `.git/`
   - `.cursor/`
   - `*.log`
   - `test-website/` (optional)

2. Create ZIP file of the extension folder

3. Upload to Chrome Web Store Developer Dashboard

## Important Security Notes

- ⚠️ `config/api.config.js` contains API keys - MUST be included in deployment
- ⚠️ `config/supabase.config.js` contains Supabase keys - MUST be included in deployment
- ✅ These files are excluded from Git via `.gitignore`
- ✅ Use example files (`*.example.js`) in repository

