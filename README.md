<div align="center">

# 🤖 Astro Bot

[![Discord.js](https://img.shields.io/badge/Discord.js-v14.14.1-5865F2?style=for-the-badge&logo=discord&logoColor=white)](https://discord.js.org/)
[![Node.js](https://img.shields.io/badge/Node.js->=18.0.0-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](LICENSE)

**Advanced Discord Bot with AntiNuke, AutoMod & Utility Commands**

[Features](#features) • [Installation](#installation) • [Configuration](#configuration) • [Commands](#commands) • [Support](#support)

</div>

---

## 📋 Table of Contents

- [Features](#-features)
- [Installation](#-installation)
- [Configuration](#-configuration)
- [Commands](#-commands)
- [AntiNuke System](#-antinuke-system)
- [Folder Structure](#-folder-structure)
- [Screenshots](#-screenshots)
- [Contributing](#-contributing)
- [License](#-license)

---

## ✨ Features

### 🛡️ AntiNuke Protection
| Feature | Description | Status |
|---------|-------------|--------|
| Channel Protection | Auto-detect mass create/delete/perm update | ✅ |
| Role Protection | Protect roles from deletion/permission changes | ✅ |
| Member Protection | Prevent mass ban/kick/bot add | ✅ |
| Webhook Protection | Block unauthorized webhook creation | ✅ |
| Emoji/Sticker Protection | Prevent mass emoji/sticker deletion | ✅ |
| Mention Spam | Detect @everyone/@here abuse | ✅ |
| Quarantine System | Isolate attackers with role backup | ✅ |

### ⚙️ Advanced Systems
- **Smart Registration** - Only registers slash commands when changed
- **Dual Command System** - Both slash (`/`) and prefix (`!`) commands
- **Rate Limiting** - Per-user cooldowns
- **Whitelist System** - Protect trusted users/roles
- **Extra Owners** - Delegate admin access
- **Heat System** - Escalating punishments based on severity

### 🎨 Customization
- Configurable colors via `.env`
- Custom status messages
- Per-server settings (coming soon)

---

## 🚀 Installation

### Prerequisites
- [Node.js](https://nodejs.org/) v18.0.0 or higher
- [Git](https://git-scm.com/)

### Step 1: Clone Repository
```bash
git clone https://github.com/TuZhi-Codes/astro-bot.git
cd astro-bot
```

Step 2: Install Dependencies

```bash
npm install
```

Step 3: Configure Environment
Create `.env` file in root directory:

```env
TOKEN=YOUR_BOT_TOKEN_HERE
CLIENT_ID=YOUR_CLIENT_ID_HERE
DEFAULT_PREFIX=!
COLOR_SUCCESS=#00FF00
COLOR_WARN=#FFD700
COLOR_ERROR=#FF0000
COLOR_COOLDOWN=#808080
COLOR_INFO=#0099FF
DEVELOPER_IDS=YOUR_DISCORD_ID
TEST_GUILD_ID=YOUR_TEST_SERVER_ID
NODE_ENV=development
```

Step 4: Start Bot

```bash
# Development (with auto-restart)
npm run dev

# Production
npm start

# PM2 (background process)
npm run pm2:start
```

---

⚙️ Configuration

Environment Variables

Variable	Required	Description	
`TOKEN`	✅	Bot token from [Discord Developer Portal](https://discord.com/developers/applications)	
`CLIENT_ID`	✅	Application ID from Discord Developer Portal	
`DEFAULT_PREFIX`	❌	Default prefix for commands (default: `!`)	
`DEVELOPER_IDS`	❌	Comma-separated Discord user IDs with full access	
`TEST_GUILD_ID`	❌	Test server ID for development	
`NODE_ENV`	❌	`development` or `production`	

Color Customization
All embed colors can be customized via `.env`:
- `COLOR_SUCCESS` - Success messages (default: `#00FF00`)
- `COLOR_WARN` - Warning messages (default: `#FFD700`)
- `COLOR_ERROR` - Error messages (default: `#FF0000`)
- `COLOR_COOLDOWN` - Cooldown messages (default: `#808080`)
- `COLOR_INFO` - Info messages (default: `#0099FF`)

---

🤖 Commands

AntiNuke Commands

Command	Description	Permission	
`/antinuke setup`	Initialize AntiNuke system	Server Owner	
`/antinuke toggle <feature> <on/off>`	Enable/disable features	Owner/Extra Owner	
`/antinuke limit <action> <count> <seconds> <punishment>`	Set action limits	Owner/Extra Owner	
`/antinuke whitelist <type> <action> [target]`	Manage whitelist	Owner/Extra Owner	
`/antinuke extraowner <action> [user]`	Manage extra owners	Server Owner Only	
`/antinuke settings`	View current settings	Owner/Extra Owner	
`/antinuke quarantine <user> [reason]`	Manual quarantine	Owner/Extra Owner	
`/antinuke unquarantine <user>`	Restore quarantined user	Owner/Extra Owner	

Utility Commands

Command	Type	Description	
`/ping`	Hybrid	Check bot latency	
`!ping`	Prefix	Check bot latency with prefix	

---

🛡️ AntiNuke System

Protection Levels

Level	Trigger	Action	
Low	3-5 actions/min	Warning + Log	
Medium	5-10 actions/min	Timeout/Kick	
High	10+ actions/min	Quarantine/Ban	

Quarantine System
When triggered:
1. All user roles backed up to JSON
2. All roles removed from user
3. Quarantine role assigned (no permissions)
4. User isolated in quarantine-logs channel
5. Manual review required for restore

Protected Entities
- ✅ Server Owner (always protected)
- ✅ Extra Owners (configurable)
- ✅ Whitelisted Users/Roles
- ❌ Everyone else (monitored)

---

📁 Folder Structure

```
astro-bot/
├── commands/
│   ├── antinuke.js          # All AntiNuke commands
│   ├── ping.js              # Utility commands
│   └── ...
├── events/
│   ├── antinuke/
│   │   ├── config.js        # Colors, emojis, messages
│   │   ├── sendMessage.js   # Message sender
│   │   ├── main.js          # Event handlers
│   │   └── index.js         # Loader
│   ├── client/
│   │   └── ready.js         # Bot ready event
│   └── ...
├── data/
│   └── antinuke/
│       └── [server-id]/
│           ├── settings.json
│           ├── limits.json
│           ├── whitelist.json
│           ├── extraowners.json
│           └── quarantine.json
├── .env                     # Environment variables (gitignored)
├── .env.example             # Example environment file
├── .gitignore
├── index.js                 # Main entry point
├── package.json
└── README.md
```

---

📸 Screenshots

![Setup](https://via.placeholder.com/600x200/5865F2/FFFFFF?text=AntiNuke+Setup)
AntiNuke Initialization

![Protection](https://via.placeholder.com/600x200/ED4245/FFFFFF?text=Quarantine+Trigger)
Quarantine in Action

![Settings](https://via.placeholder.com/600x200/57F287/FFFFFF?text=Settings+Panel)
Configuration Panel

---

🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

Code Style
- Use consistent indentation (4 spaces)
- Add comments for complex logic
- Follow existing naming conventions

---

🐛 Support

Need help? Join our support server or create an issue:

- [Discord Support Server](https://discord.gg/your-invite)
- [GitHub Issues](https://github.com/TuZhi-Codes/astro-bot/issues)

---

📝 License

Distributed under the MIT License. See `LICENSE` for more information.

---

Made with ❤️ by [TuZhi Codes](https://github.com/TuZhi-Codes)

⭐ Star this repo if you find it helpful!

---

Additional Files:

`.env.example` (for GitHub):

```env
# Discord Bot Token (https://discord.com/developers/applications)
TOKEN=YOUR_BOT_TOKEN_HERE

# Bot Client ID
CLIENT_ID=YOUR_CLIENT_ID_HERE

# Default Prefix
DEFAULT_PREFIX=!

# Embed Colors
COLOR_SUCCESS=#00FF00
COLOR_WARN=#FFD700
COLOR_ERROR=#FF0000
COLOR_COOLDOWN=#808080
COLOR_INFO=#0099FF

# Developer IDs (comma separated)
DEVELOPER_IDS=123456789012345678

# Test Guild ID (for development)
TEST_GUILD_ID=123456789012345678

# Environment (development/production)
NODE_ENV=development

# Bot Status
STATUS_TYPE=Watching
STATUS_TEXT={prefix}help | {commands} commands
STATUS_STATE=online
```

`.gitignore`:

```
node_modules/
.env
data/
logs/
*.log
.DS_Store
.vscode/
.idea/
```
