# 🛡️ Dertorrap Anti AFK Bot

> A 24/7 Minecraft Anti-AFK bot system built from scratch — controllable from **5 different methods**: Mobile App, Web Panel, Browser URL, Claude AI (via MCP), and PHP Proxy.  
> No phone or PC needed to keep the bot online. Runs entirely on cloud.

---

## 🏗️ Full Architecture

```
┌─────────────────────────────────────────────────────┐
│                  CONTROL METHODS                             │
│                                                              │
│    📱 App    🌐 Web Panel    🧠 Claude MCP    🔗 API         │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│                    InfinityFree (PHP Proxy)                  │
│                  index.html + index.php                      │
│             Hides API key — never exposed to browser         │
└──────────────────────┬──────────────────────────────┘
                       │
          ┌────────────┴────────────┐
          ▼                         ▼
┌─────────────────┐         ┌─────────────────────┐
│  Render Account    │         │   Render Account 2      │
│       #1           │         │    MCP Server           │
│   Bot API          │  ◄─────│  (Node.js + MCP         │
│  (Node.js +        │         │   SDK)                  │
│   Mineflayer)      │         └─────────────────────┘
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Minecraft Server │
│    (Any server)    │
└─────────────────┘
```

---

## 📁 File Structure

```
dertorrap-system/
│
├── 📦 bot-api/                  ← Render Account 1
│   ├── index.js                 Main bot file
│   ├── package.json
│   ├── .env                     MC_IP, MC_PORT, MC_USERNAME,
│   │                            MC_AUTH, MC_VERSION,
│   │                            PORT, API_KEY
│   ├── .env.example
│   ├── .gitignore
│   ├── Procfile
│   └── README.md
│
├── 📦 mcp-server/               ← Render Account 2
│   ├── index.js                 MCP Server file
│   ├── package.json
│   ├── .env                     BOT_URL, API_KEY, PORT
│   ├── .env.example
│   ├── .gitignore
│   ├── Procfile
│   └── README.md
│
└── 📦 web-panel/                ← InfinityFree
    ├── index.html               Frontend UI (buttons, live status)
    └── index.php                PHP Proxy (hides API key)
```

---

## 🤖 Bot API — `bot-api/` (Render Account 1)

The core of the system. Runs Mineflayer 24/7 on Render and exposes HTTP endpoints for control.

### Features
- ✅ Runs Mineflayer 24/7 on Render
- ✅ Exposes HTTP endpoints for all bot controls
- ✅ Auto-reconnects every 15 seconds on disconnect/kick
- ✅ Auto-respawns on death
- ✅ Live HTML dashboard at `/health`
- ✅ Stores last 20 logs in memory

### Tech Stack
- Node.js
- Mineflayer
- Built-in `http` module *(no Express needed)*
- dotenv

### Environment Variables

```env
MC_IP         = Minecraft server IP
MC_PORT       = Minecraft server port (default: 25565)
MC_USERNAME   = Bot's in-game username
MC_AUTH       = offline or microsoft
MC_VERSION    = e.g. 1.20.1  (leave empty for auto-detect)
PORT          = HTTP server port (Render sets automatically)
API_KEY       = Secret key to protect all endpoints
```

### All HTTP Endpoints

> ⚠️ All endpoints except `/health` require `?key=YOUR_API_KEY`

| Endpoint | Description |
|---|---|
| `GET /health` | HTML dashboard (browser) or JSON (API) |
| `GET /status` | Full JSON status |
| `GET /start` | Connect bot + enable auto-reconnect |
| `GET /stop` | Disconnect bot |
| `GET /jump` | Auto-jump every 3 seconds |
| `GET /move` | Random movement every 1 second |
| `GET /sneak` | Sneak mode ON |
| `GET /stopaction` | Stop all active actions |
| `GET /ip?value=x` | Set server IP |
| `GET /port?value=x` | Set server port |
| `GET /rename?value=x` | Rename bot username |
| `GET /version?value=x` | Set Minecraft version |

### Auto Features

| Feature | Behavior |
|---|---|
| Auto-reconnect | Reconnects every 15s after kick/disconnect |
| Auto-respawn | Respawns automatically on death |
| Low health warning | Logs warning when HP < 5 |
| Action cleanup | All actions cleared on disconnect |

### Smart Error Handling

| Situation | Response |
|---|---|
| `/start` without IP | Error with hint to set IP first |
| `/start` without Port | Error with hint to set Port first |
| `/start` without both | Error mentioning both are missing |
| `/start` when already connected | Error saying use `/stop` first |
| Action when not connected | Error with connection hint |

---

## 🧠 MCP Server — `mcp-server/` (Render Account 2)

Bridge between AI clients (like Claude Desktop) and the Bot API. AI controls the bot using natural language — without ever seeing the API key.

### Features
- ✅ Hides API key inside — AI never sees it
- ✅ Exposes 11 MCP tools callable via natural language
- ✅ Follows MCP JSON-RPC 2.0 protocol

### Tech Stack
- Node.js
- Express
- `@modelcontextprotocol/sdk`
- node-fetch
- dotenv

### Environment Variables

```env
BOT_URL   = URL of Render Account 1 (Bot API)
API_KEY   = Same API key as bot (hidden here, never exposed)
PORT      = Render sets automatically
```

### 11 MCP Tools

| Tool | Description |
|---|---|
| `start_bot` | Connect bot to Minecraft server |
| `stop_bot` | Disconnect bot |
| `set_ip` | Set server IP address |
| `set_port` | Set server port |
| `rename_bot` | Rename bot username |
| `set_version` | Set Minecraft version |
| `start_jump` | Auto-jump every 3 seconds |
| `start_move` | Random movement every 1 second |
| `start_sneak` | Enable sneak mode |
| `stop_actions` | Stop all active actions |
| `get_status` | Full bot status — HP, food, position, ping, uptime |

### MCP Endpoints

| Endpoint | Purpose |
|---|---|
| `POST /mcp` | MCP JSON-RPC 2.0 (AI clients connect here) |
| `GET /health` | Health check for UptimeRobot |
| `GET /tools` | List all tools with schemas |
| `GET /` | Server info |

### Claude Desktop Config

```json
{
  "mcpServers": {
    "dertorrap-bot": {
      "url": "https://your-mcp-server.onrender.com/mcp"
    }
  }
}
```

---

## 🌐 Web Panel — `web-panel/` (InfinityFree)

A beautiful dark-themed control panel hosted for free on InfinityFree.

### Features
- ✅ Buttons for all bot actions
- ✅ Live status bar — HP, food, ping, uptime
- ✅ Active action badges (jump / move / sneak)
- ✅ Live position, dimension, game mode display
- ✅ Recent logs viewer
- ✅ Auto-refreshes every 15 seconds
- ✅ Toast notifications on every action

### Tech Stack
- `index.html` — Pure HTML/CSS/JS frontend
- `index.php` — PHP proxy backend
- Hosted on InfinityFree (free PHP hosting)

### Security Model

```
User clicks button in index.html
        ↓
fetch("index.php?action=start")      ← No key here
        ↓
index.php adds key internally        ← Key hidden on server
        ↓
https://bot.onrender.com/start?key=xxx  ← Key never reaches browser
```

> Browser Network tab only shows: `index.php?action=start`  
> API key is **never visible** anywhere in the browser.

### `index.php` Config

```php
define('BOT_URL',        'https://your-bot.onrender.com');
define('API_KEY',        'your_secret_key');
define('ALLOWED_ORIGIN', 'https://yourdomain.com');
```

---

## 📱 Mobile App

The web panel converted into a native-feeling mobile app using **HOW Web to App**.

### XOR Encryption (Source Protection)

The HTML loaded inside the app is XOR encrypted at runtime:

```js
// What people see in source:
const d = "dGhpcyBpcyBlbmNyeXB0ZWQ=...";  // encrypted gibberish

// What actually happens at runtime:
// XOR decrypt → original HTML → document.write → renders panel
```

- ✅ No one can read the source code of the app
- ✅ Original panel HTML is never visible
- ✅ API key stays safe inside PHP on the server

---

## 🔒 Security Layers

```
Layer 1 — XOR Encrypted App HTML
          (Source code unreadable)
          ↓
Layer 2 — PHP Proxy on InfinityFree
          (Key never reaches browser)
          ↓
Layer 3 — API Key on Bot (Render #1)
          (All endpoints protected)
          ↓
Layer 4 — MCP Server (Render #2)
          (AI never sees the key)
```

---

## 🕹️ 5 Ways to Control the Bot

| # | Method | Best For |
|---|---|---|
| 1 | 📱 **Mobile App** | Quick control from phone, XOR encrypted source |
| 2 | 🌐 **Web Panel** | Full live dashboard, best on PC/tablet |
| 3 | 🧠 **Claude AI via MCP** | Natural language — *"Bot ko hypixel pe connect karo"* |
| 4 | 🔗 **Direct API** | Developers, Postman, JSON responses |
| 5 | 🐘 **PHP Proxy** | Scripts, public-facing integrations, key always hidden |

---

## ☁️ Deployment Summary

| Component | Platform | Account |
|---|---|---|
| Bot API | Render.com | Account 1 |
| MCP Server | Render.com | Account 2 |
| Web Panel | InfinityFree | — |
| Mobile App | HOW Web to App | — |

### Keep Render Awake (UptimeRobot)

1. Go to [uptimerobot.com](https://uptimerobot.com)
2. Add HTTP monitor for **both** Render URLs
3. URL: `https://your-app.onrender.com/health`
4. Interval: **Every 5 minutes**
5. Both services stay awake 24/7 ✅

---

## 🔄 Auto-Reconnect Flow

```
Bot disconnected / kicked
        ↓
Wait 15 seconds
        ↓
Auto-reconnect attempt
        ↓
Success → Log "Bot spawned"
Fail    → Log error → Wait 15s → Try again
```

---

## 📊 Status JSON Example

```json
{
  "service": "Dertorrap Anti AFK Bot",
  "connection": {
    "connected": true,
    "autoReconnect": true,
    "uptimeSeconds": 3600,
    "uptimeFormatted": "1h 0m 0s"
  },
  "actions": {
    "jump": true,
    "move": false,
    "sneak": false
  },
  "liveStats": {
    "health": 20.0,
    "food": 20,
    "position": { "x": 100.5, "y": 64.0, "z": -200.3 },
    "dimension": "overworld",
    "ping": 45,
    "gameMode": "survival"
  }
}
```

---

## 🧩 Tech Stack Summary

| Layer | Technology |
|---|---|
| Bot Engine | Mineflayer (Node.js) |
| Bot HTTP Server | Node.js built-in `http` |
| MCP Server | Express + MCP SDK |
| Web Panel Backend | PHP (cURL) |
| Web Panel Frontend | HTML + CSS + Vanilla JS |
| Mobile App | HOW Web to App (WebView) |
| Encryption | XOR cipher |
| Hosting (Bot) | Render.com |
| Hosting (MCP) | Render.com |
| Hosting (Panel) | InfinityFree |
| Uptime Monitoring | UptimeRobot |

---

## 📜 License

MIT License — free to use, modify, and distribute.

---

> Made with ❤️ by **MrKrishna** | Dertorrap Anti AFK Bot System
