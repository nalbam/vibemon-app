/*
 * TFT_eSPI to LovyanGFX compatibility wrapper
 * Allows existing TFT_eSPI code to work with LovyanGFX
 */

#ifndef TFT_COMPAT_H
#define TFT_COMPAT_H

#include "LGFX_ESP32C6.hpp"

// Create display instance
static LGFX tft;

// TFT_eSPI color definitions (RGB565)
#define TFT_BLACK       0x0000
#define TFT_WHITE       0xFFFF
#define TFT_RED         0xF800
#define TFT_GREEN       0x07E0
#define TFT_BLUE        0x001F
#define TFT_YELLOW      0xFFE0
#define TFT_CYAN        0x07FF
#define TFT_MAGENTA     0xF81F
#define TFT_ORANGE      0xFD20
#define TFT_NAVY        0x000F
#define TFT_DARKGREEN   0x03E0
#define TFT_DARKCYAN    0x03EF
#define TFT_MAROON      0x7800
#define TFT_PURPLE      0x780F
#define TFT_OLIVE       0x7BE0
#define TFT_LIGHTGREY   0xC618
#define TFT_DARKGREY    0x7BEF

// Text datum definitions (same as TFT_eSPI)
#define TL_DATUM 0  // Top left
#define TC_DATUM 1  // Top centre
#define TR_DATUM 2  // Top right
#define ML_DATUM 3  // Middle left
#define MC_DATUM 4  // Middle centre
#define MR_DATUM 5  // Middle right
#define BL_DATUM 6  // Bottom left
#define BC_DATUM 7  // Bottom centre
#define BR_DATUM 8  // Bottom right

// TFT_eSPI class wrapper for LovyanGFX
// Note: LGFX already provides most TFT_eSPI-compatible methods:
// - init() / begin()
// - setRotation()
// - fillScreen()
// - fillRect()
// - drawRect()
// - fillCircle()
// - drawFastVLine()
// - setTextColor()
// - setTextDatum()
// - drawString()
// - textWidth()
// - pushImage()

// Alias for compatibility
using TFT_eSPI = LGFX;

// Sprite class for double buffering (prevents flickering)
using TFT_eSprite = lgfx::LGFX_Sprite;

#endif // TFT_COMPAT_H
