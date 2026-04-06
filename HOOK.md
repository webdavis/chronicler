---
name: chronicler
description: "Logs all conversations across all channels to daily Markdown files"
metadata: { "openclaw": { "emoji": "📜", "events": ["message:received", "message:sent"] } }
---

# Chronicler

Captures every message received and sent across all channels (Discord, BlueBubbles, Telegram, etc.) and appends them to daily Markdown log files.

## Log file structure

Logs are organized by date:

```
outputDir/
  2026/
    04/
      2026-04-06.md
      2026-04-07.md
```

Each file contains all messages for that day, interleaved chronologically across channels.

## Entry format

```
**[04/06/2026 14:30:00 MDT] [discord:000000000000000001] stephen:** Hey, can you check the logs?

**[04/06/2026 14:31:12 MDT] [discord:000000000000000001] Dresden:** Checking now.

**[04/06/2026 14:35:00 MDT] [bluebubbles:+18005551234] +18005551234:** Don't forget dinner tonight

**[04/06/2026 14:35:30 MDT] [bluebubbles:+18005551234] Dresden:** Will remind Stephen at 17:00.
```

## Configuration

Chronicler is configured via `chronicler.json` in the hook directory. This file is separate from `hook.json` to avoid conflicts with OpenClaw's hook metadata schema.

### Fields

- **`outputDir`** — Directory where daily log files are written. Supports `~` for home directory. Default: `~/.openclaw/hooks/chronicler/logs`
- **`agents`** — Maps agent IDs to display names used in log entries. If an agent ID has no mapping, the raw ID is used.

### Example

```json
{
  "outputDir": "~/my-logs",
  "agents": {
    "main": "Dresden",
    "researcher": "Bob"
  }
}
```

This configuration writes logs to `~/my-logs/YYYY/MM/YYYY-MM-DD.md` and logs messages from the `main` agent as "Dresden" and from the `researcher` agent as "Bob".

### Default configuration

The hook ships with this default `chronicler.json`:

```json
{
  "outputDir": "~/.openclaw/hooks/chronicler/logs",
  "agents": {
    "main": "main"
  }
}
```

To customize agent display names, replace the values in the `agents` map with your preferred names. For example, change `"main": "main"` to `"main": "Dresden"`.
