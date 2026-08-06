# 🤖 Dertorrap MCP Server

MCP (Model Context Protocol) server for controlling the Dertorrap Anti AFK Minecraft Bot via AI clients like Claude.

---

## 🏗️ Architecture

```
Claude / AI Client
      ↓
MCP Server (Render Account 2) ← YOU ARE HERE
      ↓  [key hidden inside]
Bot API (Render Account 1)
      ↓
Mineflayer (Minecraft Server)
```

---

## ⚡ Setup

### 1. Install
```bash
npm install
```

### 2. Create `.env`
```bash
cp .env.example .env
```

| Variable | Description |
|---|---|
| `BOT_URL` | Your bot's Render URL (Account 1) |
| `API_KEY` | Bot API key — stays hidden here! |
| `PORT` | Server port (Render sets this automatically) |

### 3. Run
```bash
npm start
```

---

## 🔧 MCP Tools

| Tool | Description |
|---|---|
| `start_bot` | Connect bot to Minecraft server |
| `stop_bot` | Disconnect bot |
| `set_ip` | Set server IP |
| `set_port` | Set server port |
| `rename_bot` | Rename bot username |
| `set_version` | Set Minecraft version |
| `start_jump` | Auto-jump every 3 seconds |
| `start_move` | Random movement every 1 second |
| `start_sneak` | Enable sneak mode |
| `stop_actions` | Stop all actions |
| `get_status` | Full bot status |

---

## 📡 Endpoints

| Endpoint | Description |
|---|---|
| `GET /` | Server info + tool list |
| `POST /mcp` | MCP JSON-RPC 2.0 endpoint |
| `GET /health` | Health check (for UptimeRobot) |
| `GET /tools` | List all tools with schemas |

---

## ☁️ Deploy to Render.com (Account 2)

1. Push to GitHub
2. Render → **New → Web Service**
3. Build: `npm install` / Start: `node index.js`
4. Add `.env` values as Environment Variables
5. Deploy ✅

---

## 🔗 Connect to Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "dertorrap-bot": {
      "url": "https://your-mcp-server.onrender.com/mcp"
    }
  }
}
```

Then in Claude just say:
> "Bot ko hypixel.net pe connect karo aur jump start karo"

Claude khud tools call karega! 🚀
