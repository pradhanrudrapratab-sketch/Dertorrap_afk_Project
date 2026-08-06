const mineflayer = require('mineflayer');
const TelegramBot = require('node-telegram-bot-api');
const http = require('http');
require('dotenv').config();

// ─── Config ───────────────────────────────────────────────────────────────────
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const ALLOWED_CHAT_ID = process.env.ALLOWED_CHAT_ID;
const PORT = process.env.PORT || 3000;

if (!TELEGRAM_TOKEN) {
  console.error('❌ TELEGRAM_TOKEN missing in .env');
  process.exit(1);
}

// ─── Header Banner (shown on every message) ───────────────────────────────────
const HEADER = `🛡️ *DERTORRAP ANTI AFK BOT*\n━━━━━━━━━━━━━━━━━━━━━━\n`;

// ─── State ────────────────────────────────────────────────────────────────────
let state = {
  ip: null,
  port: 25565,
  portSet: false,        // track if user explicitly set port
  bot: null,
  connected: false,
  autoReconnect: false,
  reconnectTimer: null,
  botUsername: process.env.MC_USERNAME || 'BotPlayer',
  mcVersion: process.env.MC_VERSION || null,   // null = auto-detect

  // Action intervals
  jumpInterval: null,
  moveInterval: null,
  sneakActive: false,

  // Stats
  joinTime: null,
  disconnectReason: null,
  lastChatId: null,      // store last chatId for reconnect messages
};

// ─── Telegram Bot ─────────────────────────────────────────────────────────────
const tg = new TelegramBot(TELEGRAM_TOKEN, { polling: true });

function send(chatId, msg) {
  // Prepend header to every message
  const full = HEADER + msg;
  tg.sendMessage(chatId, full, { parse_mode: 'Markdown' }).catch((err) => {
    console.error('Telegram send error:', err.message);
  });
}

function isAllowed(chatId) {
  if (!ALLOWED_CHAT_ID) return true;
  return String(chatId) === String(ALLOWED_CHAT_ID);
}

// ─── Setup Validation ─────────────────────────────────────────────────────────
// Returns { ok: true } or { ok: false, message: '...' }
function validateSetup() {
  const noIp = !state.ip;
  const noPort = !state.portSet;

  if (noIp && noPort) {
    return {
      ok: false,
      message: `⚠️ *Setup incomplete!*\n\n🚫 Neither IP nor Port is set.\n\n👉 Please set both:\n• \`/ip <server-address>\`\n• \`/port <number>\` _(default: 25565)_`,
    };
  }
  if (noIp) {
    return {
      ok: false,
      message: `⚠️ *IP not set!*\n\n🌐 Port is already set to \`${state.port}\`\n\n👉 Now set the IP:\n• \`/ip <server-address>\``,
    };
  }
  if (noPort) {
    return {
      ok: false,
      message: `⚠️ *Port not set!*\n\n🌐 IP is already set to \`${state.ip}\`\n\n👉 Now set the port:\n• \`/port <number>\`\n_(or use \`/port 25565\` for default)_`,
    };
  }

  return { ok: true };
}

// ─── Mineflayer Helpers ────────────────────────────────────────────────────────
function clearAllActions() {
  if (state.jumpInterval) { clearInterval(state.jumpInterval); state.jumpInterval = null; }
  if (state.moveInterval) { clearInterval(state.moveInterval); state.moveInterval = null; }
  if (state.bot && state.sneakActive) {
    try { state.bot.setControlState('sneak', false); } catch (_) {}
    state.sneakActive = false;
  }
}

function startAutoJump() {
  if (!state.bot || !state.connected) return false;

  // Stop sneak first
  if (state.sneakActive) {
    try { state.bot.setControlState('sneak', false); } catch (_) {}
    state.sneakActive = false;
  }

  if (state.jumpInterval) clearInterval(state.jumpInterval);

  state.jumpInterval = setInterval(() => {
    if (state.bot && state.connected) {
      try {
        state.bot.setControlState('jump', true);
        setTimeout(() => {
          if (state.bot) state.bot.setControlState('jump', false);
        }, 200);
      } catch (_) {}
    }
  }, 3000);

  return true;
}

function startAutoMove() {
  if (!state.bot || !state.connected) return false;

  const directions = ['forward', 'back', 'left', 'right'];
  let currentDir = null;

  if (state.moveInterval) clearInterval(state.moveInterval);

  state.moveInterval = setInterval(() => {
    if (!state.bot || !state.connected) return;
    try {
      if (currentDir) state.bot.setControlState(currentDir, false);
      currentDir = directions[Math.floor(Math.random() * directions.length)];
      state.bot.setControlState(currentDir, true);
    } catch (_) {}
  }, 1000);

  return true;
}

function startSneak() {
  if (!state.bot || !state.connected) return false;

  if (state.jumpInterval) { clearInterval(state.jumpInterval); state.jumpInterval = null; }

  try {
    state.bot.setControlState('sneak', true);
    state.sneakActive = true;
  } catch (_) { return false; }

  return true;
}

function stopSneak() {
  if (!state.bot) return;
  try { state.bot.setControlState('sneak', false); } catch (_) {}
  state.sneakActive = false;
}

// ─── Format uptime ────────────────────────────────────────────────────────────
function formatUptime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

// ─── Minecraft Bot Creation ───────────────────────────────────────────────────
function createBot(chatId) {
  // Destroy existing bot cleanly
  if (state.bot) {
    clearAllActions();
    state.bot.removeAllListeners();
    try { state.bot.quit(); } catch (_) {}
    state.bot = null;
    state.connected = false;
  }

  const versionLabel = state.mcVersion ? `\`${state.mcVersion}\`` : '`auto-detect`';
  send(chatId, `🔄 *Connecting...*\n\n🌐 Server: \`${state.ip}:${state.port}\`\n👤 Username: \`${state.botUsername}\`\n🎮 Version: ${versionLabel}\n⏳ Please wait...`);

  try {
    state.bot = mineflayer.createBot({
      host: state.ip,
      port: state.port,
      username: state.botUsername,
      version: state.mcVersion || false,
      auth: process.env.MC_AUTH || 'offline',
    });
  } catch (err) {
    send(chatId, `❌ *Failed to create bot!*\n\n\`${err.message}\`\n\n🔧 Check your IP/Port and try again.`);
    return;
  }

  // ── Events ──
  state.bot.once('spawn', () => {
    state.connected = true;
    state.joinTime = new Date();
    state.disconnectReason = null;
    send(chatId, `✅ *Bot successfully joined!*\n\n🌐 Server: \`${state.ip}:${state.port}\`\n👤 Username: \`${state.botUsername}\`\n🕐 Joined at: ${state.joinTime.toLocaleString()}\n🔄 Auto-reconnect: ✅ Active`);
  });

  state.bot.on('error', (err) => {
    console.error('Bot error:', err.message);

    // Silently ignore common disconnect noise
    if (err.message.includes('ECONNRESET') || err.message.includes('ETIMEDOUT')) return;

    // Version mismatch — give a proper fix message
    if (err.message.includes('Unsupported protocol version') || err.message.includes('protocol version')) {
      state.autoReconnect = false; // stop infinite reconnect loop on version error
      if (state.reconnectTimer) { clearTimeout(state.reconnectTimer); state.reconnectTimer = null; }
      return send(chatId,
        `❌ *Version Mismatch Error!*\n\n` +
        `🎮 Server rejected the connection because the Minecraft version is wrong.\n\n` +
        `🔧 *Fix — set the version manually:*\n` +
        `• \`/version 1.20.1\`\n` +
        `• \`/version 1.19.4\`\n` +
        `• \`/version 1.18.2\`\n` +
        `• \`/version 1.16.5\`\n\n` +
        `💡 Check the server's version and then send \`/start\` again.\n` +
        `⚠️ Auto-reconnect has been *disabled* to avoid spam.`
      );
    }

    send(chatId, `⚠️ *Bot Error!*\n\n\`${err.message}\`\n\n🔄 Will attempt reconnect if auto-reconnect is on.`);
  });

  state.bot.on('kicked', (reason) => {
    const wasConnected = state.connected;
    state.connected = false;
    state.disconnectReason = reason;
    clearAllActions();
    const msg = typeof reason === 'string' ? reason : JSON.stringify(reason);
    if (wasConnected) {
      send(chatId, `🚫 *Bot was KICKED!*\n\n📋 Reason:\n\`${msg.slice(0, 200)}\`\n\n⏳ Reconnecting in 15 seconds...`);
    }
    scheduleReconnect(chatId);
  });

  state.bot.on('end', (reason) => {
    if (!state.connected) return; // already handled by kicked
    state.connected = false;
    clearAllActions();
    send(chatId, `🔌 *Bot Disconnected!*\n\n📋 Reason: \`${reason || 'Connection lost'}\`\n\n⏳ Reconnecting in 15 seconds...`);
    scheduleReconnect(chatId);
  });

  state.bot.on('death', () => {
    send(chatId, `💀 *Bot Died!*\n\n🔄 Attempting to respawn automatically...`);
    try { state.bot.respawn(); } catch (_) {}
  });

  state.bot.on('health', () => {
    if (state.bot && state.bot.health !== undefined && state.bot.health < 5) {
      send(chatId, `🆘 *CRITICAL HEALTH WARNING!*\n\n❤️ HP: ${state.bot.health.toFixed(1)}/20\n🍖 Food: ${state.bot.food ?? 'N/A'}/20\n⚠️ Bot is about to die!`);
    }
  });
}

function scheduleReconnect(chatId) {
  if (!state.autoReconnect) return;
  if (state.reconnectTimer) return;

  state.reconnectTimer = setTimeout(() => {
    state.reconnectTimer = null;
    if (state.autoReconnect) {
      send(chatId, `🔄 *Attempting reconnect now...*`);
      createBot(chatId);
    }
  }, 15000);
}

// ─── Telegram Commands ────────────────────────────────────────────────────────
tg.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = (msg.text || '').trim();

  if (!text.startsWith('/')) return;
  if (!isAllowed(chatId)) {
    send(chatId, `⛔ *Unauthorized Access!*\n\n🚫 You are not allowed to control this bot.\n🔒 Contact the bot owner.`);
    return;
  }

  state.lastChatId = chatId;
  const [cmd, ...args] = text.split(/\s+/);
  const command = cmd.toLowerCase();

  // ── /ip <address> ──────────────────────────────────────────────────────────
  if (command === '/ip') {
    if (!args[0]) {
      return send(chatId, `❌ *Missing IP Address!*\n\n📌 Usage: \`/ip <server-address>\`\n\n💡 Examples:\n• \`/ip hypixel.net\`\n• \`/ip 192.168.1.1\``);
    }
    state.ip = args[0];
    const portStatus = state.portSet
      ? `✅ Port is already set to \`${state.port}\``
      : `⚠️ Port not set yet — use \`/port 25565\` to set it`;
    send(chatId, `✅ *IP Address Saved!*\n\n🌐 IP: \`${state.ip}\`\n${portStatus}\n\n${state.portSet ? '👉 You can now use `/start`' : '👉 Set port next!'}`);
  }

  // ── /port <number> ─────────────────────────────────────────────────────────
  else if (command === '/port') {
    const p = parseInt(args[0]);
    if (!args[0] || isNaN(p) || p < 1 || p > 65535) {
      return send(chatId, `❌ *Invalid Port!*\n\n📌 Usage: \`/port <number>\`\n📊 Valid range: 1 - 65535\n\n💡 Common ports:\n• \`/port 25565\` — Default Minecraft\n• \`/port 19132\` — Bedrock Edition`);
    }
    state.port = p;
    state.portSet = true;
    const ipStatus = state.ip
      ? `✅ IP is already set to \`${state.ip}\``
      : `⚠️ IP not set yet — use \`/ip <address>\` to set it`;
    send(chatId, `✅ *Port Saved!*\n\n🔌 Port: \`${state.port}\`\n${ipStatus}\n\n${state.ip ? '👉 You can now use `/start`' : '👉 Set IP next!'}`);
  }

  // ── /start ─────────────────────────────────────────────────────────────────
  else if (command === '/start') {
    const check = validateSetup();
    if (!check.ok) {
      return send(chatId, check.message);
    }

    if (state.connected) {
      return send(chatId, `⚠️ *Bot is already connected!*\n\n🌐 Server: \`${state.ip}:${state.port}\`\n\n💡 Use \`/stop\` first to disconnect, then \`/start\` again.`);
    }

    state.autoReconnect = true;
    if (state.reconnectTimer) { clearTimeout(state.reconnectTimer); state.reconnectTimer = null; }
    createBot(chatId);
  }

  // ── /stop ──────────────────────────────────────────────────────────────────
  else if (command === '/stop') {
    state.autoReconnect = false;
    if (state.reconnectTimer) { clearTimeout(state.reconnectTimer); state.reconnectTimer = null; }
    clearAllActions();

    if (!state.bot && !state.connected) {
      return send(chatId, `⚠️ *Bot is not running!*\n\n🤖 Nothing to stop. Use \`/start\` to connect first.`);
    }

    if (state.bot) {
      try { state.bot.quit('Stopped by Telegram'); } catch (_) {}
      state.bot = null;
    }
    state.connected = false;
    send(chatId, `🛑 *Bot Stopped!*\n\n🌐 Disconnected from \`${state.ip}:${state.port}\`\n🔄 Auto-reconnect: ❌ Disabled\n\n👉 Use \`/start\` to reconnect.`);
  }

  // ── /jump ──────────────────────────────────────────────────────────────────
  else if (command === '/jump') {
    if (!state.connected) {
      return send(chatId, `❌ *Bot is not connected!*\n\n🤖 You need to connect first.\n👉 Use \`/start\` to join the server.`);
    }
    stopSneak();
    const ok = startAutoJump();
    send(chatId, ok
      ? `🐸 *Auto-Jump Activated!*\n\n⏱ Jumping every *3 seconds*\n🦆 Sneak mode: ❌ Off\n\n💡 Use \`/sneak\` to switch to sneak mode\n💡 Use \`/stopaction\` to stop`
      : `❌ *Failed to start auto-jump!*\n\n🔧 Bot may not be fully spawned yet. Try again in a moment.`
    );
  }

  // ── /move ──────────────────────────────────────────────────────────────────
  else if (command === '/move') {
    if (!state.connected) {
      return send(chatId, `❌ *Bot is not connected!*\n\n🤖 You need to connect first.\n👉 Use \`/start\` to join the server.`);
    }
    const ok = startAutoMove();
    send(chatId, ok
      ? `🚶 *Auto-Move Activated!*\n\n⏱ Moving in random direction every *1 second*\n🎲 Directions: Forward / Back / Left / Right\n\n💡 Use \`/stopaction\` to stop`
      : `❌ *Failed to start auto-move!*\n\n🔧 Bot may not be fully spawned yet. Try again in a moment.`
    );
  }

  // ── /sneak ─────────────────────────────────────────────────────────────────
  else if (command === '/sneak') {
    if (!state.connected) {
      return send(chatId, `❌ *Bot is not connected!*\n\n🤖 You need to connect first.\n👉 Use \`/start\` to join the server.`);
    }
    const ok = startSneak();
    send(chatId, ok
      ? `🦆 *Sneak Mode Activated!*\n\n🐸 Auto-jump: ❌ Stopped\n🦆 Sneak: ✅ Active\n\n💡 Use \`/jump\` to switch back to jump mode\n💡 Use \`/stopaction\` to stop all actions`
      : `❌ *Failed to start sneak!*\n\n🔧 Bot may not be fully spawned yet. Try again in a moment.`
    );
  }

  // ── /stopaction ────────────────────────────────────────────────────────────
  else if (command === '/stopaction') {
    clearAllActions();
    send(chatId, `⏹ *All Actions Stopped!*\n\n🐸 Auto-jump: ❌ Off\n🚶 Auto-move: ❌ Off\n🦆 Sneak: ❌ Off\n\n🤖 Bot is now idle on the server.`);
  }

  // ── /rename <name> ─────────────────────────────────────────────────────────
  else if (command === '/rename') {
    if (!args[0]) {
      return send(chatId, `❌ *Missing Name!*\n\n📌 Usage: \`/rename <username>\`\n\n💡 Example: \`/rename CoolBot123\`\n⚠️ Name change takes effect on next \`/start\``);
    }
    const newName = args[0].trim();
    if (newName.length < 3 || newName.length > 16) {
      return send(chatId, `❌ *Invalid Username!*\n\n📏 Username must be 3–16 characters.\n📌 Your input: \`${newName}\` (${newName.length} chars)\n\n💡 Example: \`/rename CoolBot123\``);
    }
    if (!/^[a-zA-Z0-9_]+$/.test(newName)) {
      return send(chatId, `❌ *Invalid Characters!*\n\n🔤 Username can only contain:\n• Letters (a-z, A-Z)\n• Numbers (0-9)\n• Underscores (_)\n\n💡 Example: \`/rename Cool_Bot_99\``);
    }
    const oldName = state.botUsername;
    state.botUsername = newName;
    const reconnectNote = state.connected
      ? `\n\n⚠️ Bot is currently connected as \`${oldName}\`\n🔄 Use \`/stop\` then \`/start\` to apply the new name.`
      : `\n\n✅ New name will be used on next \`/start\``;
    send(chatId, `✏️ *Bot Renamed!*\n\n🔴 Old name: \`${oldName}\`\n🟢 New name: \`${newName}\`${reconnectNote}`);
  }

  // ── /version <version> ─────────────────────────────────────────────────────
  else if (command === '/version') {
    if (!args[0]) {
      const current = state.mcVersion ? `\`${state.mcVersion}\`` : '`auto-detect` _(not set)_';
      return send(chatId,
        `🎮 *Minecraft Version Setting*\n\n` +
        `📌 Current: ${current}\n\n` +
        `📌 Usage: \`/version <version>\`\n\n` +
        `💡 *Common versions:*\n` +
        `• \`/version 1.20.4\`\n` +
        `• \`/version 1.20.1\`\n` +
        `• \`/version 1.19.4\`\n` +
        `• \`/version 1.18.2\`\n` +
        `• \`/version 1.16.5\`\n` +
        `• \`/version 1.8.9\`\n\n` +
        `🔄 To reset to auto-detect: \`/version auto\``
      );
    }

    if (args[0].toLowerCase() === 'auto') {
      state.mcVersion = null;
      return send(chatId, `✅ *Version reset to auto-detect!*\n\n🎮 Mineflayer will detect the server version automatically.\n\n👉 Use \`/start\` to reconnect.`);
    }

    // Basic version format check e.g. 1.20.1 or 1.8.9
    const versionRegex = /^\d+\.\d+(\.\d+)?$/;
    if (!versionRegex.test(args[0])) {
      return send(chatId,
        `❌ *Invalid Version Format!*\n\n` +
        `📌 Must be like: \`1.20.1\` or \`1.8.9\`\n` +
        `📌 Your input: \`${args[0]}\`\n\n` +
        `💡 Examples:\n` +
        `• \`/version 1.20.4\`\n` +
        `• \`/version 1.8.9\``
      );
    }

    state.mcVersion = args[0];
    const reconnectNote = state.connected
      ? `\n\n⚠️ Bot is currently connected — use \`/stop\` then \`/start\` to apply.`
      : `\n\n👉 Now use \`/start\` to connect with this version.`;
    send(chatId, `✅ *Version Set!*\n\n🎮 Minecraft Version: \`${state.mcVersion}\`${reconnectNote}`);
  }

  // ── /status ────────────────────────────────────────────────────────────────
  else if (command === '/status') {
    const bot = state.bot;
    const uptime = state.joinTime
      ? Math.floor((Date.now() - state.joinTime.getTime()) / 1000)
      : null;

    let lines = [
      `📊 *Full Bot Status*`,
      ``,
      `🖥️ *Server Info*`,
      `🌐 IP: \`${state.ip || '❌ Not set'}\``,
      `🔌 Port: \`${state.portSet ? state.port : '❌ Not set'}\``,
      `👤 Username: \`${state.botUsername}\``,
      `🎮 Version: \`${state.mcVersion || 'auto-detect'}\``,
      ``,
      `🤖 *Connection*`,
      `📡 Status: ${state.connected ? '🟢 Connected' : '🔴 Disconnected'}`,
      `🔄 Auto-reconnect: ${state.autoReconnect ? '✅ Enabled' : '❌ Disabled'}`,
    ];

    if (state.connected && bot) {
      lines.push(``);
      lines.push(`⚡ *Live Stats*`);
      lines.push(`⏱ Uptime: \`${formatUptime(uptime)}\``);
      try {
        lines.push(`❤️ Health: \`${bot.health?.toFixed(1) ?? 'N/A'}/20\``);
        lines.push(`🍖 Food: \`${bot.food ?? 'N/A'}/20\``);
        const pos = bot.entity?.position;
        if (pos) {
          lines.push(`📍 Position: \`x:${pos.x.toFixed(1)}, y:${pos.y.toFixed(1)}, z:${pos.z.toFixed(1)}\``);
        }
        lines.push(`🌍 Dimension: \`${bot.game?.dimension ?? 'N/A'}\``);
        lines.push(`🏓 Ping: \`${bot._client?.latency ?? 'N/A'}ms\``);
      } catch (_) {}
    }

    lines.push(``);
    lines.push(`🕹️ *Active Actions*`);
    lines.push(`🐸 Auto-jump: ${state.jumpInterval ? '✅ ON (every 3s)' : '❌ Off'}`);
    lines.push(`🚶 Auto-move: ${state.moveInterval ? '✅ ON (every 1s)' : '❌ Off'}`);
    lines.push(`🦆 Sneak: ${state.sneakActive ? '✅ ON' : '❌ Off'}`);

    if (state.disconnectReason) {
      lines.push(``);
      lines.push(`⚠️ *Last Disconnect Reason*`);
      lines.push(`\`${String(state.disconnectReason).slice(0, 150)}\``);
    }

    send(chatId, lines.join('\n'));
  }

  // ── /help ──────────────────────────────────────────────────────────────────
  else if (command === '/help') {
    send(chatId, [
      `📖 *All Commands*`,
      ``,
      `⚙️ *Setup*`,
      `\`/ip <address>\` — Set server IP`,
      `\`/port <number>\` — Set port _(default: 25565)_`,
      `\`/version <ver>\` — Set MC version _(e.g. 1.20.1)_`,
      `\`/rename <name>\` — Change bot username`,
      ``,
      `🎮 *Bot Control*`,
      `\`/start\` — Connect bot + enable auto-reconnect`,
      `\`/stop\` — Disconnect + disable auto-reconnect`,
      ``,
      `🕹️ *Anti-AFK Actions*`,
      `\`/jump\` — Auto jump every 3 seconds`,
      `\`/move\` — Random movement every 1 second`,
      `\`/sneak\` — Sneak mode ON (disables jump)`,
      `\`/stopaction\` — Stop ALL actions`,
      ``,
      `📊 *Info*`,
      `\`/status\` — Full bot status & live stats`,
      `\`/help\` — This help message`,
      ``,
      `🔄 *Auto Features*`,
      `• Auto-reconnect every 15s on disconnect`,
      `• Death auto-respawn`,
      `• Low health warnings (< 5 HP)`,
    ].join('\n'));
  }

  // ── Unknown command ────────────────────────────────────────────────────────
  else {
    send(chatId, `❓ *Unknown Command!*\n\n\`${command}\` is not a valid command.\n\n👉 Use \`/help\` to see all available commands.`);
  }
});

// ─── HTTP Health Server (for Render.com + cron-job.org) ──────────────────────
const server = http.createServer((req, res) => {
  if (req.url === '/health' || req.url === '/') {
    const uptime = state.joinTime
      ? Math.floor((Date.now() - state.joinTime.getTime()) / 1000)
      : null;

    const data = {
      status: 'online',
      service: 'Dertorrap Anti AFK Bot',
      timestamp: new Date().toISOString(),
      bot: {
        connected: state.connected,
        server: state.ip ? `${state.ip}:${state.port}` : null,
        username: state.botUsername,
        autoReconnect: state.autoReconnect,
        uptimeSeconds: uptime,
        actions: {
          jump: !!state.jumpInterval,
          move: !!state.moveInterval,
          sneak: state.sneakActive,
        },
      },
    };

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data, null, 2));
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }
});

server.listen(PORT, () => {
  console.log(`🌐 Health server running on port ${PORT}`);
  console.log(`📡 Health check: http://localhost:${PORT}/health`);
});

// ─── Process Error Handling ───────────────────────────────────────────────────
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err.message);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
});

// ─── Boot Message ─────────────────────────────────────────────────────────────
console.log('');
console.log('🛡️  DERTORRAP ANTI AFK BOT');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('✅ Telegram bot started (polling)');
console.log(`🌐 Health endpoint: /health on port ${PORT}`);
console.log('📱 Open Telegram and send /help to begin');
console.log('');
