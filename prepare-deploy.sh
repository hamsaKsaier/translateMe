#!/bin/bash

# Script to prepare TranslateMe extension for Chrome Web Store deployment
# Usage: ./prepare-deploy.sh

set -e

VERSION=$(grep '"version"' manifest.json | cut -d'"' -f4)
DEPLOY_DIR="deploy/chrome-store"
ZIP_NAME="translateMe-v${VERSION}.zip"

echo "🚀 Preparing TranslateMe Extension v${VERSION} for deployment..."

# Create deployment directory
echo "📁 Creating deployment directory..."
rm -rf "$DEPLOY_DIR"
mkdir -p "$DEPLOY_DIR"

# Copy required files
echo "📋 Copying files..."

# Core extension files
cp manifest.json "$DEPLOY_DIR/"
cp -r popup "$DEPLOY_DIR/"
cp -r content "$DEPLOY_DIR/"
cp -r background "$DEPLOY_DIR/"
cp -r auth "$DEPLOY_DIR/"
cp -r libs "$DEPLOY_DIR/"
cp -r services "$DEPLOY_DIR/"
cp -r assets "$DEPLOY_DIR/"

# Config files (MUST include - extension needs them)
echo "⚠️  WARNING: Including config files with API keys..."
mkdir -p "$DEPLOY_DIR/config"
cp config/api.config.js "$DEPLOY_DIR/config/"
cp config/supabase.config.js "$DEPLOY_DIR/config/"
cp config/supabase.config.example.js "$DEPLOY_DIR/config/"

# Create ZIP file
echo "📦 Creating ZIP file..."
cd "$DEPLOY_DIR"
zip -r "../${ZIP_NAME}" . -x "*.DS_Store" "*.git*" "*.log" > /dev/null
cd ../..

echo "✅ Deployment package created: deploy/${ZIP_NAME}"
echo ""
echo "📝 Next steps:"
echo "   1. Test the extension from deploy/chrome-store/ folder"
echo "   2. Upload deploy/${ZIP_NAME} to Chrome Web Store"
echo "   3. Verify all features work correctly"

