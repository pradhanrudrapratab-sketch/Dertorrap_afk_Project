const express = require('express');
const fetch = require('node-fetch');
require('dotenv').config();

// ─── Config ───────────────────────────────────────────────
const BOT_URL = process.env.BOT_URL;   // Render Account 1 URL
const API_KEY = process.env.API_KEY;   // Bot API key - hidden here!
const PORT    = process.env.PORT || 3000;

if (!BOT_URL) { console.error('❌ BOT_URL missing in .env'); process.exit(1); }
if (!API_KEY) { console.error('❌ API_KEY missing in .env'); process.exit(1); }

const app = express();
app.use(express.json());

// ─── Call Bot API (key added secretly here) ───────────────
async function callBot(action, value = null) {
  let url = `${BOT_URL}/${action}?key=${encodeURIComponent(API_KEY)}`;
  if (value !== null && value !== '') url += `&value=${encodeURIComponent(value)}`;

  try {
    const res  = await fetch(url, { timeout: 10000 });
    const data = await res.json();
    return { ok: res.ok, status: res.status, data };
  } catch (err) {
    return { ok: false, status: 0, data: { success: false, error: err.message } };
  }
}

// ─── Format response for MCP ──────────────────────────────
function mcpText(data) {
  return JSON.stringify(data, null, 2);
}

// ─── MCP Tools Definition ─────────────────────────────────
const TOOLS = [
  {
    name: 'start_bot',
    description: 'Connect the Minecraft bot to the server. IP and Port must be set first.',
    inputSchema: { type: 'object', properties: {}, required: [] }
  },
  {
    name: 'stop_bot',
    description: 'Disconnect the Minecraft bot and disable auto-reconnect.',
    inputSchema: { type: 'object', properties: {}, required: [] }
  },
  {
    name: 'set_ip',
    description: 'Set the Minecraft server IP address.',
    inputSchema: {
      type: 'object',
      properties: {
        ip: { type: 'string', description: 'Server IP e.g. hypixel.net or 192.168.1.1' }
      },
      required: ['ip']
    }
  },
  {
    name: 'set_port',
    description: 'Set the Minecraft server port. Default is 25565.',
    inputSchema: {
      type: 'object',
      properties: {
        port: { type: 'number', description: 'Port number between 1-65535' }
      },
      required: ['port']
    }
  },
  {
    name: 'rename_bot',
    description: 'Rename the bot username. 3-16 chars, letters/numbers/underscore only.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'New bot username' }
      },
      required: ['name']
    }
  },
  {
    name: 'set_version',
    description: 'Set Minecraft version e.g. 1.20.1. Use "auto" for auto-detect.',
    inputSchema: {
      type: 'object',
      properties: {
        version: { type: 'string', description: 'Version string e.g. 1.20.1 or auto' }
      },
      required: ['version']
    }
  },
  {
    name: 'start_jump',
    description: 'Start auto-jumping every 3 seconds. Stops sneak mode.',
    inputSchema: { type: 'object', properties: {}, required: [] }
  },
  {
    name: 'start_move',
    description: 'Start auto-moving in random directions every 1 second.',
    inputSchema: { type: 'object', properties: {}, required: [] }
  },
  {
    name: 'start_sneak',
    description: 'Enable sneak mode. Stops auto-jump.',
    inputSchema: { type: 'object', properties: {}, required: [] }
  },
  {
    name: 'stop_actions',
    description: 'Stop all active actions — jump, move, and sneak.',
    inputSchema: { type: 'object', properties: {}, required: [] }
  },
  {
    name: 'get_status',
    description: 'Get full bot status including health, food, position, ping, uptime, and active actions.',
    inputSchema: { type: 'object', properties: {}, required: [] }
  }
];

// ─── MCP Tool Executor ────────────────────────────────────
async function executeTool(name, args) {
  switch (name) {
    case 'start_bot':    return await callBot('start');
    case 'stop_bot':     return await callBot('stop');
    case 'start_jump':   return await callBot('jump');
    case 'start_move':   return await callBot('move');
    case 'start_sneak':  return await callBot('sneak');
    case 'stop_actions': return await callBot('stopaction');
    case 'get_status':   return await callBot('status');
    case 'set_ip':       return await callBot('ip',      args.ip);
    case 'set_port':     return await callBot('port',    String(args.port));
    case 'rename_bot':   return await callBot('rename',  args.name);
    case 'set_version':  return await callBot('version', args.version);
    default:
      return { ok: false, data: { success: false, error: `Unknown tool: ${name}` } };
  }
}

// ─── MCP HTTP Endpoints ───────────────────────────────────

// GET /  → server info
app.get('/', (req, res) => {
  res.json({
    name: 'dertorrap-mcp-server',
    version: '1.0.0',
    description: 'MCP Server for Dertorrap Anti AFK Minecraft Bot',
    tools: TOOLS.map(t => ({ name: t.name, description: t.description })),
    endpoints: {
      'GET  /':              'Server info',
      'POST /mcp':           'MCP JSON-RPC endpoint',
      'GET  /health':        'Health check',
      'GET  /tools':         'List all tools',
    }
  });
});

// GET /tools → list tools
app.get('/tools', (req, res) => {
  res.json({ success: true, count: TOOLS.length, tools: TOOLS });
});

// GET /health → health check
app.get('/health', (req, res) => {
  res.json({
    success: true,
    status: 'online',
    service: 'Dertorrap MCP Server',
    timestamp: new Date().toISOString(),
    botUrl: BOT_URL.replace(/\/\/.*@/, '//***@'), // hide credentials if any
    toolCount: TOOLS.length
  });
});

// POST /mcp → MCP JSON-RPC 2.0
app.post('/mcp', async (req, res) => {
  const { jsonrpc, id, method, params } = req.body;

  // Validate JSON-RPC
  if (jsonrpc !== '2.0') {
    return res.status(400).json({
      jsonrpc: '2.0', id,
      error: { code: -32600, message: 'Invalid Request: jsonrpc must be "2.0"' }
    });
  }

  try {
    // ── tools/list ──────────────────────────────────────
    if (method === 'tools/list') {
      return res.json({
        jsonrpc: '2.0', id,
        result: { tools: TOOLS }
      });
    }

    // ── tools/call ──────────────────────────────────────
    if (method === 'tools/call') {
      const toolName = params?.name;
      const toolArgs = params?.arguments || {};

      if (!toolName) {
        return res.json({
          jsonrpc: '2.0', id,
          error: { code: -32602, message: 'Missing tool name' }
        });
      }

      const tool = TOOLS.find(t => t.name === toolName);
      if (!tool) {
        return res.json({
          jsonrpc: '2.0', id,
          error: { code: -32602, message: `Unknown tool: ${toolName}` }
        });
      }

      const result = await executeTool(toolName, toolArgs);

      return res.json({
        jsonrpc: '2.0', id,
        result: {
          content: [
            {
              type: 'text',
              text: mcpText(result.data)
            }
          ],
          isError: !result.ok
        }
      });
    }

    // ── initialize (MCP handshake) ───────────────────────
    if (method === 'initialize') {
      return res.json({
        jsonrpc: '2.0', id,
        result: {
          protocolVersion: '2024-11-05',
          capabilities: { tools: {} },
          serverInfo: {
            name: 'dertorrap-mcp-server',
            version: '1.0.0'
          }
        }
      });
    }

    // ── notifications/initialized ────────────────────────
    if (method === 'notifications/initialized') {
      return res.status(204).send();
    }

    // ── Unknown method ───────────────────────────────────
    return res.json({
      jsonrpc: '2.0', id,
      error: { code: -32601, message: `Method not found: ${method}` }
    });

  } catch (err) {
    return res.json({
      jsonrpc: '2.0', id,
      error: { code: -32603, message: 'Internal error', data: err.message }
    });
  }
});

// ─── 404 ──────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, error: `Unknown endpoint: ${req.path}` });
});

// ─── Start ────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log('');
  console.log('🤖 DERTORRAP MCP SERVER');
  console.log('━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`🌐 Running on port ${PORT}`);
  console.log(`🔗 Bot URL: ${BOT_URL}`);
  console.log(`🔧 Tools available: ${TOOLS.length}`);
  console.log(`📡 MCP endpoint: POST /mcp`);
  console.log('');
});

process.on('uncaughtException',  err => console.error('Uncaught:', err.message));
process.on('unhandledRejection', err => console.error('Rejection:', err));
