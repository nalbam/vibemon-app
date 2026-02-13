# VibeMon WiFi Provisioning - Web Interface with Token Field

## Screenshot Simulation

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│              🌐 VibeMon WiFi Setup                      │
│              Connect your VibeMon to WiFi               │
│                                                         │
│  ┌───────────────────────────────────────────────────┐ │
│  │  🔍 Scan Networks                                 │ │
│  └───────────────────────────────────────────────────┘ │
│                                                         │
│  WiFi Network                                           │
│  ┌───────────────────────────────────────────────────┐ │
│  │ ▰▰▰▰ MyHomeWiFi 🔒                              ▼ │ │
│  └───────────────────────────────────────────────────┘ │
│                                                         │
│  Password                                               │
│  ┌───────────────────────────────────────────────────┐ │
│  │ ••••••••••••                                       │ │
│  └───────────────────────────────────────────────────┘ │
│                                                         │
│  VibeMon Token (Optional)                 ← NEW FIELD  │
│  ┌───────────────────────────────────────────────────┐ │
│  │ abc123-xyz789-token                                │ │
│  └───────────────────────────────────────────────────┘ │
│                                                         │
│  ┌───────────────────────────────────────────────────┐ │
│  │            💾 Save & Connect                      │ │
│  └───────────────────────────────────────────────────┘ │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

## Form Fields

### Before (Original)

1. **WiFi Network** (Dropdown)
   - Lists scanned networks with signal strength
   
2. **Password** (Password input)
   - WiFi password for selected network

3. **Save & Connect** (Button)
   - Saves credentials and reboots

### After (With Token)

1. **WiFi Network** (Dropdown)
   - Lists scanned networks with signal strength
   
2. **Password** (Password input)
   - WiFi password for selected network

3. **VibeMon Token** (Text input) ← **NEW**
   - Optional WebSocket authentication token
   - Placeholder: "Enter WebSocket token (leave empty if not needed)"
   - Can be left empty if no token is required

4. **Save & Connect** (Button)
   - Saves WiFi credentials + token and reboots

## Field Details

### VibeMon Token Field

```html
<div class="form-group">
  <label for="token">VibeMon Token (Optional)</label>
  <input 
    type="text" 
    id="token" 
    placeholder="Enter WebSocket token (leave empty if not needed)"
  >
</div>
```

**Characteristics:**
- Type: Text input (not password, so users can see what they type)
- Required: No (optional field)
- Placeholder: Helpful text explaining what it's for
- Styling: Matches other form fields (same purple gradient theme)

## User Experience Flow

### New User Journey

1. **Connect to VibeMon-Setup**
   - User connects phone/laptop to AP

2. **Captive Portal Opens**
   - Configuration page appears automatically

3. **Scan Networks**
   - Click "🔍 Scan Networks" button
   - Networks appear in dropdown

4. **Select WiFi**
   - Choose network from dropdown
   - Signal strength indicators help selection

5. **Enter WiFi Password**
   - Type password in password field

6. **Enter Token (Optional)** ← **NEW STEP**
   - If user has a VibeMon token, enter it
   - If not, leave field empty

7. **Save**
   - Click "💾 Save & Connect"
   - Device saves both WiFi and token
   - Reboots automatically

8. **Connected**
   - Device connects to WiFi
   - If token provided, connects to WebSocket with auth

## Visual Comparison

### Original Form (2 fields)
```
┌─────────────────────┐
│ WiFi Network    [▼] │
├─────────────────────┤
│ Password      [***] │
├─────────────────────┤
│ [Save & Connect]    │
└─────────────────────┘
```

### Updated Form (3 fields)
```
┌─────────────────────┐
│ WiFi Network    [▼] │
├─────────────────────┤
│ Password      [***] │
├─────────────────────┤
│ VibeMon Token       │  ← NEW
│ (Optional)    [   ] │  ← NEW
├─────────────────────┤
│ [Save & Connect]    │
└─────────────────────┘
```

## Mobile View

### Portrait (iPhone/Android)

```
┌──────────────────────┐
│ 🌐 VibeMon WiFi      │
│                      │
│ [🔍 Scan Networks]   │
│                      │
│ WiFi Network         │
│ ┌──────────────────┐ │
│ │MyHomeWiFi 🔒    ▼│ │
│ └──────────────────┘ │
│                      │
│ Password             │
│ ┌──────────────────┐ │
│ │••••••••••••      │ │
│ └──────────────────┘ │
│                      │
│ VibeMon Token        │
│ (Optional)           │
│ ┌──────────────────┐ │
│ │abc123-xyz...     │ │
│ └──────────────────┘ │
│                      │
│ ┌──────────────────┐ │
│ │💾 Save & Connect │ │
│ └──────────────────┘ │
│                      │
└──────────────────────┘
```

## Desktop View

### Browser (Chrome/Firefox/Safari)

```
┌────────────────────────────────────────────────────────┐
│  http://192.168.4.1                              × □ - │
├────────────────────────────────────────────────────────┤
│                                                        │
│            🌐 VibeMon WiFi Setup                       │
│            Connect your VibeMon to WiFi                │
│                                                        │
│    ┌────────────────────────────────────────────┐     │
│    │        🔍 Scan Networks                    │     │
│    └────────────────────────────────────────────┘     │
│                                                        │
│    WiFi Network                                        │
│    ┌────────────────────────────────────────────┐     │
│    │ ▰▰▰▰ MyHomeWiFi 🔒                       ▼ │     │
│    │ ▰▰▰▱ OfficeNetwork 🔒                      │     │
│    │ ▰▰▱▱ CafeWiFi                              │     │
│    └────────────────────────────────────────────┘     │
│                                                        │
│    Password                                            │
│    ┌────────────────────────────────────────────┐     │
│    │ ••••••••••••••••                           │     │
│    └────────────────────────────────────────────┘     │
│                                                        │
│    VibeMon Token (Optional)                            │
│    ┌────────────────────────────────────────────┐     │
│    │ my-secret-token-abc123                     │     │
│    └────────────────────────────────────────────┘     │
│                                                        │
│    ┌────────────────────────────────────────────┐     │
│    │          💾 Save & Connect                 │     │
│    └────────────────────────────────────────────┘     │
│                                                        │
│    ✓ Found 3 networks                                 │
│                                                        │
└────────────────────────────────────────────────────────┘
```

## Accessibility Features

- ✅ Label clearly identifies field purpose
- ✅ "(Optional)" indicates field is not required
- ✅ Placeholder text provides guidance
- ✅ Text input allows seeing what you type
- ✅ Tab order follows logical flow
- ✅ Works with screen readers
- ✅ Clear visual styling matches other fields

## Error Handling

### Valid States

1. **WiFi + Token**: Both provided → Saves both
2. **WiFi only**: Token empty → Saves WiFi only
3. **WiFi + Empty Token**: Token field blank → Saves WiFi only

### Invalid States

1. **No WiFi**: Missing SSID/password → Error message
2. **Invalid chars**: Token with special chars → Accepted (no validation)

## Color Scheme

Matches existing VibeMon branding:
- **Background**: Purple gradient (#667eea to #764ba2)
- **Form**: White container with rounded corners
- **Inputs**: Light gray border, purple focus
- **Button**: Purple gradient with hover effect
- **Text**: Dark gray labels, placeholder in light gray

## Summary

The new token field:
- ✅ Seamlessly integrates with existing UI
- ✅ Maintains design consistency
- ✅ Clearly marked as optional
- ✅ Easy to use on mobile and desktop
- ✅ No breaking changes to existing flow
- ✅ Enhances functionality without complexity
