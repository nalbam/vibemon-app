/*
 * VibeMon WiFi Portal
 * Captive portal HTML page for WiFi configuration
 */

#ifndef WIFI_PORTAL_H
#define WIFI_PORTAL_H

// HTML page for WiFi configuration (stored in flash, no heap allocation)
const char CONFIG_PAGE[] = R"HTML(
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>VibeMon WiFi Setup</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .container {
      background: white;
      border-radius: 12px;
      padding: 30px;
      max-width: 400px;
      width: 100%;
      box-shadow: 0 10px 40px rgba(0,0,0,0.2);
    }
    h1 {
      color: #333;
      margin-bottom: 10px;
      font-size: 24px;
    }
    .subtitle {
      color: #666;
      margin-bottom: 25px;
      font-size: 14px;
    }
    .form-group {
      margin-bottom: 20px;
    }
    label {
      display: block;
      color: #555;
      font-weight: 500;
      margin-bottom: 8px;
      font-size: 14px;
    }
    select, input {
      width: 100%;
      padding: 12px;
      border: 2px solid #e0e0e0;
      border-radius: 8px;
      font-size: 14px;
      transition: border-color 0.3s;
    }
    select:focus, input:focus {
      outline: none;
      border-color: #667eea;
    }
    button {
      width: 100%;
      padding: 14px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: transform 0.2s;
    }
    button:hover {
      transform: translateY(-2px);
    }
    button:active {
      transform: translateY(0);
    }
    button:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
    .scan-btn {
      background: linear-gradient(135deg, #42a5f5 0%, #1976d2 100%);
      margin-bottom: 15px;
    }
    .status {
      margin-top: 15px;
      padding: 12px;
      border-radius: 8px;
      text-align: center;
      font-size: 14px;
      display: none;
    }
    .status.success {
      background: #d4edda;
      color: #155724;
      border: 1px solid #c3e6cb;
    }
    .status.error {
      background: #f8d7da;
      color: #721c24;
      border: 1px solid #f5c6cb;
    }
    .loading {
      display: inline-block;
      width: 14px;
      height: 14px;
      border: 2px solid #f3f3f3;
      border-top: 2px solid #667eea;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin-right: 8px;
    }
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>🌐 VibeMon WiFi Setup</h1>
    <p class="subtitle">Connect your VibeMon to WiFi</p>

    <button class="scan-btn" onclick="scanNetworks()">
      <span id="scan-text">🔍 Scan Networks</span>
    </button>

    <form onsubmit="saveCredentials(event)">
      <div class="form-group">
        <label for="ssid">WiFi Network</label>
        <select id="ssid" required>
          <option value="">Select a network...</option>
        </select>
      </div>

      <div class="form-group">
        <label for="password">Password</label>
        <input type="password" id="password" required placeholder="Enter WiFi password" autocapitalize="none" autocorrect="off" spellcheck="false">
      </div>

      <div class="form-group">
        <label for="token">VibeMon Token (Optional)</label>
        <input type="text" id="token" placeholder="Enter WebSocket token (leave empty if not needed)" autocapitalize="none" autocorrect="off" spellcheck="false">
      </div>

      <button type="submit" id="save-btn">💾 Save & Connect</button>
    </form>

    <div class="status" id="status"></div>
  </div>

  <script>
    function showStatus(message, isError = false) {
      const status = document.getElementById('status');
      status.textContent = message;
      status.className = 'status ' + (isError ? 'error' : 'success');
      status.style.display = 'block';
    }

    function scanNetworks() {
      const scanBtn = document.querySelector('.scan-btn');
      const scanText = document.getElementById('scan-text');
      scanBtn.disabled = true;
      scanText.innerHTML = '<span class="loading"></span>Scanning...';

      fetch('/scan')
        .then(res => res.json())
        .then(data => {
          const select = document.getElementById('ssid');
          select.innerHTML = '<option value="">Select a network...</option>';

          data.networks.forEach(network => {
            const option = document.createElement('option');
            option.value = network.ssid;
            const signal = network.rssi > -50 ? '▰▰▰▰' : network.rssi > -60 ? '▰▰▰▱' : network.rssi > -70 ? '▰▰▱▱' : '▰▱▱▱';
            const lock = network.secure ? '🔒' : "";
            option.textContent = signal + ' ' + network.ssid + ' ' + lock;
            select.appendChild(option);
          });

          showStatus('Found ' + data.networks.length + ' networks');
          setTimeout(() => {
            document.getElementById('status').style.display = 'none';
          }, 3000);
        })
        .catch(err => {
          showStatus('Scan failed: ' + err.message, true);
        })
        .finally(() => {
          scanBtn.disabled = false;
          scanText.innerHTML = '🔍 Scan Networks';
        });
    }

    function saveCredentials(e) {
      e.preventDefault();

      const ssid = document.getElementById('ssid').value;
      const password = document.getElementById('password').value;
      const token = document.getElementById('token').value;
      const saveBtn = document.getElementById('save-btn');

      saveBtn.disabled = true;
      saveBtn.innerHTML = '<span class="loading"></span>Connecting...';

      const formData = new URLSearchParams();
      formData.append('ssid', ssid);
      formData.append('password', password);
      if (token) {
        formData.append('token', token);
      }

      fetch('/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData
      })
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            showStatus(data.message);
          } else {
            showStatus(data.message, true);
            saveBtn.disabled = false;
            saveBtn.innerHTML = '💾 Save & Connect';
          }
        })
        .catch(err => {
          showStatus('Failed: ' + err.message, true);
          saveBtn.disabled = false;
          saveBtn.innerHTML = '💾 Save & Connect';
        });
    }

    // Auto-scan on load
    window.addEventListener('load', () => {
      setTimeout(scanNetworks, 500);
    });
  </script>
</body>
</html>
)HTML";

#endif // WIFI_PORTAL_H
