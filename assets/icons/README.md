# TranslateMe Extension Icons

This directory contains the icon files for the TranslateMe browser extension.

## Required Files

- `icon16.png` (16x16 pixels) - Small icon for extension toolbar
- `icon48.png` (48x48 pixels) - Medium icon for extension management  
- `icon128.png` (128x128 pixels) - Large icon for Chrome Web Store

## How to Create Icons

### Option 1: Use the HTML Generator
1. Open `create_simple_icons.html` in your browser
2. Click the download buttons for each icon size
3. Save the files as `icon16.png`, `icon48.png`, and `icon128.png`

### Option 2: Use SVG Files
1. Use the provided SVG files (`icon16.svg`, `icon48.svg`, `icon128.svg`)
2. Convert them to PNG using an online converter or image editor
3. Save as the required PNG files

### Option 3: Create Custom Icons
Design your own icons with these specifications:
- **Theme**: Translation/globe with language indicators
- **Colors**: Blue gradient (#667eea to #764ba2) with white accents
- **Style**: Clean, modern, recognizable at small sizes
- **Format**: PNG with transparency support

## Current Status

The extension will work without these PNG files, but Chrome will show a default icon. To have proper icons:

1. Generate the PNG files using one of the methods above
2. Place them in this directory
3. Reload the extension in Chrome

## Files in this Directory

- `create_simple_icons.html` - Interactive icon generator
- `convert-icons.html` - SVG to PNG converter
- `generate_png_icons.py` - Python script for icon generation
- `make_icons.sh` - Shell script for ImageMagick generation
- `icon16.svg`, `icon48.svg`, `icon128.svg` - SVG source files
