#!/bin/bash

# Simple script to create placeholder PNG icons for TranslateMe extension
# This creates basic colored squares as placeholder icons

echo "Creating placeholder PNG icons for TranslateMe extension..."

# Create a simple 16x16 PNG using ImageMagick if available
if command -v convert &> /dev/null; then
    echo "Using ImageMagick to create PNG icons..."
    
    # Create 16x16 icon
    convert -size 16x16 xc:"#667eea" -fill white -draw "circle 8,8 8,4" -fill white -draw "line 4,8 12,8" -fill white -draw "line 8,4 8,12" icon16.png
    
    # Create 48x48 icon  
    convert -size 48x48 xc:"#667eea" -fill white -draw "circle 24,24 24,12" -fill white -draw "line 12,24 36,24" -fill white -draw "line 24,12 24,36" icon48.png
    
    # Create 128x128 icon
    convert -size 128x128 xc:"#667eea" -fill white -draw "circle 64,64 64,32" -fill white -draw "line 32,64 96,64" -fill white -draw "line 64,32 64,96" icon128.png
    
    echo "PNG icons created successfully!"
else
    echo "ImageMagick not available. Please use create_simple_icons.html to generate PNG files."
    echo "Or install ImageMagick: brew install imagemagick"
fi
