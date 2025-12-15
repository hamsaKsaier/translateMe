# GitHub Setup Instructions

## Step 1: Initialize Git Repository (if not already done)

```bash
cd /Users/takiacademy/Desktop/translateMe
git init
```

## Step 2: Add Files to Git

```bash
# Check what will be committed (should NOT include api.config.js or supabase.config.js)
git status

# Add all files (sensitive files are excluded by .gitignore)
git add .

# Verify sensitive files are NOT included
git status | grep -E "api.config.js|supabase.config.js"
# Should show nothing - if it shows files, STOP and check .gitignore
```

## Step 3: Create Initial Commit

```bash
git commit -m "Initial commit: TranslateMe Extension v1.0.2

Features:
- Free plan with unlimited scans
- OpenRouter/DeepSeek AI integration
- Auto-scan functionality
- Keyboard shortcut (Ctrl+Shift+S)
- Context menu integration
- Buy Me a Coffee donation support
- Dev mode logging system"
```

## Step 4: Create GitHub Repository

1. Go to https://github.com/new
2. Repository name: `translateMe` (or your preferred name)
3. Description: "Chrome extension for detecting translation issues in web applications"
4. Choose Public or Private
5. **DO NOT** initialize with README, .gitignore, or license (we already have these)
6. Click "Create repository"

## Step 5: Connect and Push

```bash
# Add remote (replace YOUR_USERNAME with your GitHub username)
git remote add origin https://github.com/YOUR_USERNAME/translateMe.git

# Rename branch to main (if needed)
git branch -M main

# Push to GitHub
git push -u origin main
```

## Step 6: Verify

1. Go to your GitHub repository
2. Verify that `config/api.config.js` and `config/supabase.config.js` are NOT visible
3. Verify that `config/supabase.config.example.js` IS visible
4. Check that all other files are present

## Important Security Notes

✅ **Safe to commit:**
- `config/supabase.config.example.js` (example file, no real keys)
- All source code
- Documentation
- Icons and assets

❌ **NEVER commit:**
- `config/api.config.js` (contains real API keys)
- `config/supabase.config.js` (contains real Supabase keys)
- These are excluded by `.gitignore`

## Future Updates

```bash
# After making changes
git add .
git commit -m "Description of changes"
git push
```

