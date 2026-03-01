/*
 * VibeMon Configuration
 * Constants, macros, and compile-time settings
 */

#ifndef CONFIG_H
#define CONFIG_H

// Version string
#define VERSION "v1.8.1"

// Screen size
#define SCREEN_WIDTH  172
#define SCREEN_HEIGHT 320

// Layout positions (adjusted for 128x128 character on 172x320 screen)
#define CHAR_X_BASE   22   // (172 - 128) / 2 = 22
#define CHAR_Y_BASE   18   // Base Y position (float ±5px → 13~23)
#define FLOAT_AMPLITUDE_X 3  // Floating animation amplitude X (pixels)
#define FLOAT_AMPLITUDE_Y 5  // Floating animation amplitude Y (pixels)
#define STATUS_TEXT_Y 160  // size 3 (24px) → bottom 184
#define LOADING_Y     190  // dots after status text (gap 6px) → bottom ~198
#define PROJECT_Y     204  // info rows: 25px spacing (+1px from previous 24px)
#define TOOL_Y        229
#define MODEL_Y       254
#define MEMORY_Y      279  // font ~14px → bottom 293
#define MEMORY_BAR_X  10
#define MEMORY_BAR_Y  299  // 5px gap after memory text
#define MEMORY_BAR_W  152
#define MEMORY_BAR_H  6    // bar bottom 303 → 17px bottom margin
#define BRAND_Y       308  // start screen only (size 1, 8px)

// Animation timing
#define BLINK_INTERVAL       3200  // Blink interval in idle state (ms)
#define BLINK_DURATION        100  // Blink closed-eye hold duration (ms)

// Animation periods (in animation frames, each frame = 100ms tick)
#define ANIM_SPARKLE_PERIOD     4  // 4-point star rotation (400ms cycle)
#define ANIM_THOUGHT_PERIOD    12  // Thought bubble size toggle (1.2s cycle)
#define ANIM_ZZZ_PERIOD        20  // Z blink on/off (2s cycle)
#define ANIM_FLOAT_TABLE_SIZE  32  // Floating sine/cosine lookup entries (~3.2s cycle)
#define ANIM_FRAME_WRAP      4800  // LCM(32,12,20,4)=480 × 10 for safety

// State timeouts
#define IDLE_TIMEOUT 60000            // 1 minute (start/done -> idle)
#define SLEEP_TIMEOUT 300000          // 5 minutes (idle -> sleep)

// JSON buffer size for StaticJsonDocument
// Increased to 1024 for WebSocket nested payloads:
// {"type":"status","data":{"state":"...", "project":"...", "model":"...", ...}}
#define JSON_BUFFER_SIZE 1024

// Project lock modes
#define LOCK_MODE_FIRST_PROJECT 0
#define LOCK_MODE_ON_THINKING 1
#define MAX_PROJECTS 10

// WiFi connection
#define WIFI_CONNECT_ATTEMPTS  20  // Max connection attempts per round
#define WIFI_CONNECT_DELAY_MS 500  // Delay between each attempt (ms)
#define WIFI_CONNECT_RETRIES    3  // Number of full rounds before giving up
#define WIFI_FAIL_RESTART_MS 2000  // Delay before reboot on connection failure (ms)

// Backlight brightness (0-255, PWM on pin 22)
#define BACKLIGHT_NORMAL  255
#define BACKLIGHT_SLEEP    64

// Loop delays per state category (ms)
#define LOOP_DELAY_ACTIVE   10  // thinking, planning, working, packing, notification, alert
#define LOOP_DELAY_IDLE     30  // start, idle, done
#define LOOP_DELAY_SLEEP   100  // sleep

// Safe string copy: always null-terminates, requires array (not pointer) as dst
#define safeCopyStr(dst, src) do { strncpy(dst, src, sizeof(dst)-1); dst[sizeof(dst)-1]='\0'; } while(0)

#endif // CONFIG_H
