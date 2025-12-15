// Node.js script to generate PNG icons for TranslateMe extension
// Run with: node generate-icons.js

const fs = require('fs');
const path = require('path');

// Simple PNG generator for basic icons
function createPNGIcon(size, filename) {
    // This is a simplified approach - in a real scenario, you'd use a library like canvas
    // For now, we'll create a simple base64 encoded PNG

    const canvas = `
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
        <defs>
            <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style="stop-color:#667eea;stop-opacity:1" />
                <stop offset="100%" style="stop-color:#764ba2;stop-opacity:1" />
            </linearGradient>
        </defs>
        <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - 2}" fill="url(#grad)" stroke="#fff" stroke-width="1"/>
        <circle cx="${size / 2}" cy="${size / 2}" r="${size / 3}" fill="none" stroke="#fff" stroke-width="${Math.max(1, size / 16)}"/>
        <path d="M${size / 4} ${size / 2}h${size / 2}M${size / 2} ${size / 4}v${size / 2}" stroke="#fff" stroke-width="${Math.max(1, size / 20)}"/>
        <text x="${size / 2 - 2}" y="${size / 2 - 2}" font-family="Arial, sans-serif" font-size="${size / 8}" fill="#fff" text-anchor="middle">A</text>
        <text x="${size / 2 + 2}" y="${size / 2 + 2}" font-family="Arial, sans-serif" font-size="${size / 8}" fill="#fff" text-anchor="middle">中</text>
    </svg>`;

    // For now, we'll create the SVG files and let the user convert them
    fs.writeFileSync(path.join(__dirname, filename.replace('.png', '.svg')), canvas);
    console.log(`Created ${filename.replace('.png', '.svg')}`);
}

// Generate icons
console.log('Generating TranslateMe extension icons...');

createPNGIcon(16, 'icon16.png');
createPNGIcon(48, 'icon48.png');
createPNGIcon(128, 'icon128.png');

console.log('Icons generated! Use convert-icons.html to convert SVG to PNG format.');
console.log('Or use an online SVG to PNG converter.');
