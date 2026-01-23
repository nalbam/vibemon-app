/*
 * TFT_eSPI User Setup for ESP32-C6-LCD-1.47
 * ST7789V2, 172x320 pixels
 *
 * 이 파일을 Arduino/libraries/TFT_eSPI/User_Setup.h 로 복사하세요.
 */

#define USER_SETUP_INFO "ESP32-C6-LCD-1.47"

// 드라이버 선택
#define ST7789_DRIVER

// 해상도
#define TFT_WIDTH  172
#define TFT_HEIGHT 320

// 색상 순서 (RGB 또는 BGR)
#define TFT_RGB_ORDER TFT_RGB

// ESP32-C6-LCD-1.47 핀 설정
#define TFT_MOSI 6
#define TFT_SCLK 7
#define TFT_CS   14
#define TFT_DC   15
#define TFT_RST  21
#define TFT_BL   22  // 백라이트

// SPI 설정
#define SPI_FREQUENCY  40000000
#define SPI_READ_FREQUENCY  20000000
#define SPI_TOUCH_FREQUENCY  2500000

// 폰트 로드
#define LOAD_GLCD   // Font 1
#define LOAD_FONT2  // Font 2
#define LOAD_FONT4  // Font 4
#define LOAD_FONT6  // Font 6
#define LOAD_FONT7  // Font 7
#define LOAD_FONT8  // Font 8
#define LOAD_GFXFF  // FreeFonts

#define SMOOTH_FONT
