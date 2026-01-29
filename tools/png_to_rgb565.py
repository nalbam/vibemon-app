#!/usr/bin/env python3
"""
PNG to RGB565 C Array Converter for ESP32
Converts PNG images to RGB565 format C header files for TFT_eSPI library.

Usage:
    python png_to_rgb565.py ../images/clawd-128.png clawd  -> img_clawd.h (IMG_CLAWD)
    python png_to_rgb565.py ../images/kiro-128.png kiro    -> img_kiro.h (IMG_KIRO)
"""

import sys
from PIL import Image
import os


def rgb_to_rgb565(r, g, b):
    """Convert RGB888 to RGB565."""
    return ((r & 0xF8) << 8) | ((g & 0xFC) << 3) | (b >> 3)


def convert_png_to_rgb565(input_path, name, target_size=128):
    """Convert PNG image to RGB565 C array."""
    img = Image.open(input_path).convert('RGBA')
    width, height = img.size

    # Resize to target size if needed
    if width != target_size or height != target_size:
        print(f"Resizing from {width}x{height} to {target_size}x{target_size}...")
        img = img.resize((target_size, target_size), Image.Resampling.LANCZOS)
        width, height = target_size, target_size

    print(f"Converting {input_path} ({width}x{height}) to RGB565...")

    # Generate C array
    lines = []
    lines.append(f"// {name.upper()} character image ({width}x{height})")
    lines.append(f"// Generated from {os.path.basename(input_path)}")
    lines.append(f"#define IMG_{name.upper()}_WIDTH {width}")
    lines.append(f"#define IMG_{name.upper()}_HEIGHT {height}")
    lines.append("")
    lines.append(f"const uint16_t IMG_{name.upper()}[{width * height}] PROGMEM = {{")

    pixel_values = []
    transparent_color = 0xF81F  # Magenta as transparent marker

    for y in range(height):
        row_values = []
        for x in range(width):
            r, g, b, a = img.getpixel((x, y))

            if a < 128:  # Transparent pixel
                # Use magenta as transparent marker (common convention for sprite transparency)
                rgb565 = transparent_color
            else:
                rgb565 = rgb_to_rgb565(r, g, b)

            row_values.append(f"0x{rgb565:04X}")

        pixel_values.append("  " + ", ".join(row_values) + ",")

    lines.extend(pixel_values)
    lines.append("};")
    lines.append("")

    return "\n".join(lines)


def main():
    if len(sys.argv) < 3:
        print("Usage: python png_to_rgb565.py <input.png> <name>")
        print("Example: python png_to_rgb565.py ../images/clawd-128.png clawd  -> img_clawd.h")
        sys.exit(1)

    input_path = sys.argv[1]
    name = sys.argv[2]

    if not os.path.exists(input_path):
        print(f"Error: File not found: {input_path}")
        sys.exit(1)

    c_code = convert_png_to_rgb565(input_path, name)

    output_path = f"img_{name}.h"
    with open(output_path, 'w') as f:
        f.write(c_code)

    print(f"Generated: {output_path}")


if __name__ == "__main__":
    main()
