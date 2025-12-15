#!/usr/bin/env python3
"""
Generate PNG icons for TranslateMe extension
Run with: python3 generate_png_icons.py
"""

try:
    from PIL import Image, ImageDraw, ImageFont
    PIL_AVAILABLE = True
except ImportError:
    PIL_AVAILABLE = False
    print("PIL (Pillow) not available. Install with: pip install Pillow")

def create_icon(size, filename):
    """Create a simple icon with the specified size"""
    
    if not PIL_AVAILABLE:
        print(f"Creating SVG fallback for {filename}")
        create_svg_icon(size, filename)
        return
    
    # Create image with transparent background
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # Calculate positions and sizes
    center = size // 2
    radius = size // 2 - 2
    
    # Draw background circle with gradient (simplified)
    draw.ellipse([2, 2, size-2, size-2], fill=(102, 126, 234, 255), outline=(255, 255, 255, 255), width=1)
    
    # Draw inner circle
    inner_radius = size // 3
    draw.ellipse([center - inner_radius, center - inner_radius, 
                  center + inner_radius, center + inner_radius], 
                 fill=None, outline=(255, 255, 255, 255), width=max(1, size // 16))
    
    # Draw cross lines
    line_width = max(1, size // 20)
    draw.line([size // 4, center, 3 * size // 4, center], fill=(255, 255, 255, 255), width=line_width)
    draw.line([center, size // 4, center, 3 * size // 4], fill=(255, 255, 255, 255), width=line_width)
    
    # Add text (simplified)
    try:
        font_size = max(8, size // 8)
        font = ImageFont.truetype("arial.ttf", font_size)
    except:
        font = ImageFont.load_default()
    
    # Draw 'A' and '中' characters
    text_color = (255, 255, 255, 255)
    draw.text((center - 2, center - 2), 'A', fill=text_color, font=font, anchor="mm")
    draw.text((center + 2, center + 2), '中', fill=text_color, font=font, anchor="mm")
    
    # Save the image
    img.save(filename, 'PNG')
    print(f"Created {filename} ({size}x{size})")

def create_svg_icon(size, filename):
    """Create SVG icon as fallback"""
    svg_content = f'''<svg width="{size}" height="{size}" viewBox="0 0 {size} {size}" xmlns="http://www.w3.org/2000/svg">
        <defs>
            <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style="stop-color:#667eea;stop-opacity:1" />
                <stop offset="100%" style="stop-color:#764ba2;stop-opacity:1" />
            </linearGradient>
        </defs>
        <circle cx="{size//2}" cy="{size//2}" r="{size//2-2}" fill="url(#grad)" stroke="#fff" stroke-width="1"/>
        <circle cx="{size//2}" cy="{size//2}" r="{size//3}" fill="none" stroke="#fff" stroke-width="{max(1, size//16)}"/>
        <path d="M{size//4} {size//2}h{size//2}M{size//2} {size//4}v{size//2}" stroke="#fff" stroke-width="{max(1, size//20)}"/>
        <text x="{size//2-2}" y="{size//2-2}" font-family="Arial, sans-serif" font-size="{size//8}" fill="#fff" text-anchor="middle">A</text>
        <text x="{size//2+2}" y="{size//2+2}" font-family="Arial, sans-serif" font-size="{size//8}" fill="#fff" text-anchor="middle">中</text>
    </svg>'''
    
    with open(filename.replace('.png', '.svg'), 'w') as f:
        f.write(svg_content)
    print(f"Created {filename.replace('.png', '.svg')} (SVG fallback)")

def main():
    print("Generating TranslateMe extension icons...")
    
    # Create icons in different sizes
    create_icon(16, 'icon16.png')
    create_icon(48, 'icon48.png')
    create_icon(128, 'icon128.png')
    
    print("\nIcons generated successfully!")
    print("If you got SVG files instead of PNG, install Pillow: pip install Pillow")
    print("Then run this script again to get PNG files.")

if __name__ == "__main__":
    main()
