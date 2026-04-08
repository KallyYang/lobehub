---
name: local-testing
description: >
  Local app and bot testing. Uses agent-browser CLI for Electron/web app UI testing,
  and osascript (AppleScript) for controlling native macOS apps (WeChat, Discord, Telegram, Slack, Lark/飞书, QQ)
  to test bots. Triggers on 'local test', 'test in electron', 'test desktop', 'test bot',
  'bot test', 'test in discord', 'test in telegram', 'test in slack', 'test in weixin',
  'test in wechat', 'test in lark', 'test in feishu', 'test in qq',
  'manual test', 'osascript', or UI/bot verification tasks.
---

# Local App & Bot Testing

Two approaches for local testing on macOS:

| Approach                    | Tool                | Best For                                             |
| --------------------------- | ------------------- | ---------------------------------------------------- |
| **agent-browser + CDP**     | `agent-browser` CLI | Electron apps, web apps (DOM access, JS eval)        |
| **osascript (AppleScript)** | `osascript -e`      | Native macOS apps (WeChat, Discord, Telegram, Slack) |

---

# Part 1: agent-browser (Electron / Web Apps)

Use `agent-browser` to automate Chromium-based apps via Chrome DevTools Protocol.

## Prerequisites

- `agent-browser` CLI installed globally (`agent-browser --version`)

## Core Workflow

### 1. Snapshot → Find Elements

```bash
agent-browser --cdp -i < PORT > snapshot    # Interactive elements only
agent-browser --cdp -i -C < PORT > snapshot # Include contenteditable elements
```

Returns element refs like `@e1`, `@e2`. **Refs are ephemeral** — re-snapshot after any page change.

### 2. Interact

```bash
agent-browser --cdp @e5 < PORT > click
agent-browser --cdp @e3 "text" < PORT > type # Character by character (contenteditable)
agent-browser --cdp @e3 "text" < PORT > fill # Bulk fill (regular inputs)
agent-browser --cdp Enter < PORT > press
agent-browser --cdp down 500 < PORT > scroll
```

### 3. Wait

```bash
agent-browser --cdp 2000 < PORT > wait               # Wait ms
agent-browser --cdp --load networkidle < PORT > wait # Wait for network
```

For waits >30s, use `sleep N` in bash instead — `agent-browser wait` blocks the daemon.

### 4. Screenshot & Verify

```bash
agent-browser --cdp < PORT > screenshot   # Save to ~/.agent-browser/tmp/screenshots/
agent-browser --cdp text @e1 < PORT > get # Get element text
agent-browser --cdp url < PORT > get      # Get current URL
```

Read screenshots with the `Read` tool for visual verification.

### 5. Evaluate JavaScript

```bash
agent-browser --cdp "document.title" < PORT > eval
```

For multi-line JS, use `--stdin`:

```bash
agent-browser --cdp --stdin < PORT > eval << 'EVALEOF'
(function() {
  return JSON.stringify({ title: document.title, url: location.href });
})()
EVALEOF
```

## Electron (LobeHub Desktop)

### Setup

```bash
# 1. Kill existing instances
pkill -f "Electron" 2> /dev/null
pkill -f "electron-vite" 2> /dev/null
pkill -f "agent-browser" 2> /dev/null
sleep 3

# 2. Start Electron with CDP (MUST cd to apps/desktop first)
cd apps/desktop && ELECTRON_ENABLE_LOGGING=1 npx electron-vite dev -- --remote-debugging-port=9222 > /tmp/electron-dev.log 2>&1 &

# 3. Wait for startup
for i in $(seq 1 12); do
  sleep 5
  if strings /tmp/electron-dev.log 2> /dev/null | grep -q "starting electron"; then
    echo "ready"
    break
  fi
done

# 4. Wait for renderer, then connect
sleep 15 && agent-browser --cdp 9222 wait 3000
```

**Critical:** `npx electron-vite dev` MUST run from `apps/desktop/` directory, not project root.

### LobeHub-Specific Patterns

#### Access Zustand Store State

```bash
agent-browser --cdp 9222 eval --stdin << 'EVALEOF'
(function() {
  var chat = window.__LOBE_STORES.chat();
  var ops = Object.values(chat.operations);
  return JSON.stringify({
    ops: ops.map(function(o) { return { type: o.type, status: o.status }; }),
    activeAgent: chat.activeAgentId,
    activeTopic: chat.activeTopicId,
  });
})()
EVALEOF
```

#### Find and Use the Chat Input

```bash
# The chat input is contenteditable — must use -C flag
agent-browser --cdp 9222 snapshot -i -C 2>&1 | grep "editable"

agent-browser --cdp 9222 click @e48
agent-browser --cdp 9222 type @e48 "Hello world"
agent-browser --cdp 9222 press Enter
```

#### Wait for Agent to Complete

```bash
agent-browser --cdp 9222 eval --stdin << 'EVALEOF'
(function() {
  var chat = window.__LOBE_STORES.chat();
  var ops = Object.values(chat.operations);
  var running = ops.filter(function(o) { return o.status === 'running'; });
  return running.length === 0 ? 'done' : 'running: ' + running.length;
})()
EVALEOF
```

#### Install Error Interceptor

```bash
agent-browser --cdp 9222 eval --stdin << 'EVALEOF'
(function() {
  window.__CAPTURED_ERRORS = [];
  var orig = console.error;
  console.error = function() {
    var msg = Array.from(arguments).map(function(a) {
      if (a instanceof Error) return a.message;
      return typeof a === 'object' ? JSON.stringify(a) : String(a);
    }).join(' ');
    window.__CAPTURED_ERRORS.push(msg);
    orig.apply(console, arguments);
  };
  return 'installed';
})()
EVALEOF

# Later, check captured errors:
agent-browser --cdp 9222 eval "JSON.stringify(window.__CAPTURED_ERRORS)"
```

## Chrome / Web Apps

```bash
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --remote-debugging-port=9222 \
  --user-data-dir=/tmp/chrome-test-profile \
  "<URL>" &
sleep 5
agent-browser --cdp 9222 snapshot -i
```

---

# Part 2: osascript (Native macOS App Bot Testing)

Use AppleScript via `osascript` to control native macOS desktop apps for bot testing. Works with any app that supports macOS Accessibility, no CDP or Chromium needed.

The pattern is the same for every platform:

1. **Activate** the app (`tell application "X" to activate`)
2. **Navigate** to a channel/chat (Quick Switcher `Cmd+K` or Search `Cmd+F`)
3. **Send** a message (clipboard paste `Cmd+V` + Enter)
4. **Wait** for the bot response
5. **Screenshot** for verification (`screencapture` + `Read` tool)

## Per-Platform References

Pick the file for your target platform — each contains activation, navigation, send-message, and verification snippets specific to that app:

| Platform      | Reference                                        | Quick switcher |
| ------------- | ------------------------------------------------ | -------------- |
| Discord       | [reference/discord.md](./reference/discord.md)   | `Cmd+K`        |
| Slack         | [reference/slack.md](./reference/slack.md)       | `Cmd+K`        |
| Telegram      | [reference/telegram.md](./reference/telegram.md) | `Cmd+F`        |
| WeChat / 微信 | [reference/wechat.md](./reference/wechat.md)     | `Cmd+F`        |
| Lark / 飞书   | [reference/lark.md](./reference/lark.md)         | `Cmd+K`        |
| QQ            | [reference/qq.md](./reference/qq.md)             | `Cmd+F`        |

For **shared osascript patterns** (activate, type, paste, screenshot, read accessibility, common workflow template, gotchas), see [reference/osascript-common.md](./reference/osascript-common.md). Read this first if you're new to osascript automation.

---

# Scripts

Ready-to-use scripts in `.agents/skills/local-testing/scripts/`:

| Script                    | Usage                                         |
| ------------------------- | --------------------------------------------- |
| `capture-app-window.sh`   | Capture screenshot of a specific app window   |
| `record-electron-demo.sh` | Record Electron app demo with ffmpeg          |
| `test-discord-bot.sh`     | Send message to Discord bot via osascript     |
| `test-slack-bot.sh`       | Send message to Slack bot via osascript       |
| `test-telegram-bot.sh`    | Send message to Telegram bot via osascript    |
| `test-wechat-bot.sh`      | Send message to WeChat bot via osascript      |
| `test-lark-bot.sh`        | Send message to Lark / 飞书 bot via osascript |
| `test-qq-bot.sh`          | Send message to QQ bot via osascript          |

### Window Screenshot Utility

`capture-app-window.sh` captures a screenshot of a specific app window using `screencapture -l <windowID>`. It uses Swift + CGWindowList to find the window by process name, so screenshots work correctly even when the window is on an external monitor or behind other windows.

```bash
# Standalone usage
./.agents/skills/local-testing/scripts/capture-app-window.sh "Discord" /tmp/discord.png
./.agents/skills/local-testing/scripts/capture-app-window.sh "Slack" /tmp/slack.png
./.agents/skills/local-testing/scripts/capture-app-window.sh "WeChat" /tmp/wechat.png
```

All bot test scripts use this utility automatically for their screenshots.

### Bot Test Scripts

All bot test scripts share the same interface:

```bash
./scripts/test-<platform>-bot.sh <channel_or_contact> <message> [wait_seconds] [screenshot_path]
```

Examples:

```bash
# Discord — test a bot in #bot-testing channel
./.agents/skills/local-testing/scripts/test-discord-bot.sh "bot-testing" "!ping"
./.agents/skills/local-testing/scripts/test-discord-bot.sh "bot-testing" "/ask Tell me a joke" 30

# Slack — test a bot in #bot-testing channel
./.agents/skills/local-testing/scripts/test-slack-bot.sh "bot-testing" "@mybot hello"
./.agents/skills/local-testing/scripts/test-slack-bot.sh "bot-testing" "/ask What is 2+2?" 20

# Telegram — test a bot by username
./.agents/skills/local-testing/scripts/test-telegram-bot.sh "MyTestBot" "/start"
./.agents/skills/local-testing/scripts/test-telegram-bot.sh "GPTBot" "Hello" 60

# WeChat — test a bot or send to a contact
./.agents/skills/local-testing/scripts/test-wechat-bot.sh "文件传输助手" "test message" 5
./.agents/skills/local-testing/scripts/test-wechat-bot.sh "MyBot" "Tell me a joke" 30

# Lark/飞书 — test a bot in a group chat
./.agents/skills/local-testing/scripts/test-lark-bot.sh "bot-testing" "@MyBot hello"
./.agents/skills/local-testing/scripts/test-lark-bot.sh "bot-testing" "Help me with this" 30

# QQ — test a bot in a group or direct chat
./.agents/skills/local-testing/scripts/test-qq-bot.sh "bot-testing" "Hello bot" 15
./.agents/skills/local-testing/scripts/test-qq-bot.sh "MyBot" "/help" 10
```

Each script: activates the app, navigates to the channel/contact, pastes the message via clipboard, sends, waits, and takes a screenshot. Use the `Read` tool on the screenshot for visual verification.

---

# Screen Recording

Record automated demos by combining `ffmpeg` screen capture with `agent-browser` automation. The script `.agents/skills/local-testing/scripts/record-electron-demo.sh` handles the full lifecycle for Electron.

### Usage

```bash
# Run the built-in demo (queue-edit feature)
./.agents/skills/local-testing/scripts/record-electron-demo.sh

# Run a custom automation script
./.agents/skills/local-testing/scripts/record-electron-demo.sh ./my-demo.sh /tmp/my-demo.mp4
```

The script automatically:

1. Starts Electron with CDP and waits for SPA to load
2. Detects window position, screen, and Retina scale via Swift/CGWindowList
3. Records only the Electron window region using `ffmpeg -f avfoundation` with crop
4. Runs the demo (built-in or custom script receiving CDP port as `$1`)
5. Stops recording and cleans up

---

# Gotchas

### agent-browser

- **Daemon can get stuck** — if commands hang, `pkill -f agent-browser` to reset
- **`agent-browser wait` blocks the daemon** — for waits >30s, use bash `sleep`
- **HMR invalidates everything** — after code changes, refs break. Re-snapshot or restart
- **`snapshot -i` doesn't find contenteditable** — use `snapshot -i -C` for rich text editors
- **`fill` doesn't work on contenteditable** — use `type` for chat inputs
- **Screenshots go to `~/.agent-browser/tmp/screenshots/`** — read them with the `Read` tool

### Electron-specific

- **`npx electron-vite dev` must run from `apps/desktop/`** — running from project root fails silently
- **Don't resize the Electron window after load** — resizing triggers full SPA reload
- **Store is at `window.__LOBE_STORES`** not `window.__ZUSTAND_STORES__`

### osascript

See [reference/osascript-common.md](./reference/osascript-common.md#gotchas) for the full osascript gotchas list (accessibility permissions, `keystroke` non-ASCII issues, locale-specific app names, rate limiting, etc.).
