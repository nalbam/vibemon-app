/*
 * LovyanGFX configuration for ESP32-C6-LCD-1.47
 * ST7789V2, 172x320 pixels
 */

#ifndef LGFX_ESP32C6_HPP
#define LGFX_ESP32C6_HPP

#define LGFX_USE_V1
#include <LovyanGFX.hpp>

class LGFX : public lgfx::LGFX_Device {
  lgfx::Panel_ST7789 _panel_instance;
  lgfx::Bus_SPI _bus_instance;
  lgfx::Light_PWM _light_instance;

public:
  LGFX(void) {
    // SPI bus configuration
    {
      auto cfg = _bus_instance.config();
      cfg.spi_host = SPI2_HOST;  // ESP32-C6 uses SPI2_HOST
      cfg.spi_mode = 0;
      cfg.freq_write = 40000000;
      cfg.freq_read = 16000000;
      cfg.spi_3wire = false;
      cfg.use_lock = true;
      cfg.dma_channel = SPI_DMA_CH_AUTO;

      // ESP32-C6-LCD-1.47 pin configuration
      cfg.pin_sclk = 7;   // SCK
      cfg.pin_mosi = 6;   // MOSI
      cfg.pin_miso = -1;  // Not used
      cfg.pin_dc = 15;    // DC

      _bus_instance.config(cfg);
      _panel_instance.setBus(&_bus_instance);
    }

    // Panel configuration
    {
      auto cfg = _panel_instance.config();
      cfg.pin_cs = 14;    // CS
      cfg.pin_rst = 21;   // RST
      cfg.pin_busy = -1;  // Not used

      cfg.panel_width = 172;
      cfg.panel_height = 320;
      cfg.offset_x = 34;      // X offset for centering
      cfg.offset_y = 0;
      cfg.offset_rotation = 0;
      cfg.dummy_read_pixel = 8;
      cfg.dummy_read_bits = 1;
      cfg.readable = true;
      cfg.invert = true;      // ST7789 typically needs inversion
      cfg.rgb_order = false;  // BGR order (ST7789 native)
      cfg.dlen_16bit = false;
      cfg.bus_shared = false;

      _panel_instance.config(cfg);
    }

    // Backlight configuration
    {
      auto cfg = _light_instance.config();
      cfg.pin_bl = 22;        // Backlight pin
      cfg.invert = false;
      cfg.freq = 44100;
      cfg.pwm_channel = 0;

      _light_instance.config(cfg);
      _panel_instance.setLight(&_light_instance);
    }

    setPanel(&_panel_instance);
  }
};

#endif // LGFX_ESP32C6_HPP
