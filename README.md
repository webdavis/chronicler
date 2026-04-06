# Chronicler

An [OpenClaw](https://docs.openclaw.ai/automation/hooks) hook that logs every message received and sent
across all channels (Discord, BlueBubbles, Telegram, etc.) to daily Markdown files.

<!-- TOC -->

## Table of Contents

- [Log structure](#log-structure)
- [Configuration](#configuration)
  - [Default](#default)
  - [Custom](#custom)
- [Development](#development)

<!-- /TOC -->

## Log structure

Logs are organized by date:

```
~/.openclaw/
  hooks/
    chronicler/
      logs/
        2026/
          04/
            2026-04-06.md
            2026-04-07.md
```

Each file contains all messages for that day, interleaved chronologically across channels:

```
**[04/06/2026 14:30:00 MDT] [discord:000000000000000001] stephen:** Hey, can you check the logs?

**[04/06/2026 14:31:12 MDT] [discord:000000000000000001] Dresden:** Checking now.

**[04/06/2026 14:35:00 MDT] [bluebubbles:+18005551234] +18005551234:** Don't forget dinner tonight

**[04/06/2026 14:35:30 MDT] [bluebubbles:+18005551234] Dresden:** Will remind Stephen at 17:00.
```

## Configuration

### Default

Chronicler comes with a default configuration stored in its `chronicler.json` file:

```json
{
  "outputDir": "~/.openclaw/hooks/chronicler/logs",
  "agents": {
    "main": "main"
  }
}
```

| Field       | Description                                          | Default                             |
| ----------- | ---------------------------------------------------- | ----------------------------------- |
| `outputDir` | Directory for daily log files. Supports `~`.         | `~/.openclaw/hooks/chronicler/logs` |
| `agents`    | Maps agent IDs to display names used in log entries. | `{ "main": "main" }`                |

> [!NOTE]
> If an agent ID has no mapping, the raw ID is used.

### Custom

You can customize your configuration by adjusting the values. For example:

```json
{
  "outputDir": "~/my-logs",
  "agents": {
    "main": "Dresden",
    "researcher": "Bob"
  }
}
```

## Development

Chronicler uses [Bun](https://bun.sh) to manage its dependencies.

Install dependencies:

```bash
bun install
```

Run tests:

```bash
bun test
```
