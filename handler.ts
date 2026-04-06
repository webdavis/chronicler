import * as fs from "fs";
import * as path from "path";

const HOME = process.env.HOME || "";
let hintLogged = false;

export interface ChroniclerConfig {
  outputDir: string;
  agents: Record<string, string>;
}

export function loadConfig(hookDir: string): ChroniclerConfig {
  const configPath = path.join(hookDir, "chronicler.json");
  try {
    const raw = fs.readFileSync(configPath, "utf8");
    const parsed = JSON.parse(raw);
    return {
      outputDir: typeof parsed.outputDir === "string" ? parsed.outputDir : "",
      agents:
        parsed.agents && typeof parsed.agents === "object"
          ? parsed.agents
          : {},
    };
  } catch {
    return { outputDir: "", agents: {} };
  }
}

export function resolveOutputDir(raw: string, hookDir: string): string {
  if (!raw) return path.join(hookDir, "logs");
  return raw.replace(/^~/, HOME);
}

export function resolveAgentName(
  sessionKey: string,
  agents: Record<string, string>,
): string {
  const parts = sessionKey.split(":");
  const agentId = parts.length >= 2 ? parts[1] : sessionKey;
  return agents[agentId] || agentId;
}

export function resolveSpeakerName(event: any): string {
  return (
    event.metadata?.senderName ||
    event.metadata?.senderUsername ||
    event.from ||
    "Unknown"
  );
}

function getSystemTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return "UTC";
  }
}

const TZ = getSystemTimezone();

export function formatTimestamp(date: Date): string {
  const formatted = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })
    .format(date)
    .replace(",", "");
  const abbr =
    new Intl.DateTimeFormat("en-US", {
      timeZone: TZ,
      timeZoneName: "short",
    })
      .formatToParts(date)
      .find((p) => p.type === "timeZoneName")?.value ?? "UTC";
  return `${formatted} ${abbr}`;
}

export function formatChannelTag(event: any): string {
  const channel = event.channelId || "unknown";
  const convId = event.conversationId || event.to || "";
  return convId ? `${channel}:${convId}` : channel;
}

export function getPathForDate(date: Date, outputDir: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = parts.find((p) => p.type === "year")!.value;
  const month = parts.find((p) => p.type === "month")!.value;
  const day = parts.find((p) => p.type === "day")!.value;
  const dateStr = `${year}-${month}-${day}`;
  const dir = path.join(outputDir, year, month);
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, `${dateStr}.md`);
}

export function appendMessage(
  speaker: string,
  channelTag: string,
  content: string,
  timestamp: Date,
  outputDir: string,
): void {
  try {
    const filePath = getPathForDate(timestamp, outputDir);
    const ts = formatTimestamp(timestamp);
    const indentedContent = (content || "").replace(/\n/g, "\n  ");
    const entry = `\n**[${ts}] [${channelTag}] ${speaker}:** ${indentedContent}\n`;
    fs.appendFileSync(filePath, entry, "utf8");
  } catch (err) {
    console.error(
      "[chronicler] Write error:",
      err instanceof Error ? err.message : String(err),
    );
  }
}

export function resetHintState(): void {
  hintLogged = false;
}

export function maybeLogHint(agents: Record<string, string>): void {
  if (hintLogged) return;
  hintLogged = true;

  if (Object.keys(agents).length === 0) return;

  const allIdentity = Object.entries(agents).every(
    ([key, value]) => key === value,
  );
  if (!allIdentity) return;

  console.log(
    '[chronicler] Agent name mapping not configured. To use friendly names in logs, edit ~/.openclaw/hooks/chronicler/chronicler.json and change the "agents" values. Example: {"main": "Dresden", "researcher": "Bob"} will log "Dresden" and "Bob" instead of "main" and "researcher".',
  );
}

export function createHandler(hookDir: string) {
  return async (event: any) => {
    try {
      if (event.type !== "message") return;

      const config = loadConfig(hookDir);
      const outputDir = resolveOutputDir(config.outputDir, hookDir);

      maybeLogHint(config.agents);

      const channelTag = formatChannelTag(event);

      if (event.action === "received") {
        const ts = event.timestamp
          ? new Date(event.timestamp * 1000)
          : new Date();
        const speaker = resolveSpeakerName(event);
        appendMessage(speaker, channelTag, event.content || "", ts, outputDir);
      } else if (event.action === "sent") {
        if (event.success === false) return;
        const speaker = resolveAgentName(
          event.sessionKey || "",
          config.agents,
        );
        appendMessage(
          speaker,
          channelTag,
          event.content || "",
          new Date(),
          outputDir,
        );
      }
    } catch (err) {
      console.error(
        "[chronicler] Error:",
        err instanceof Error ? err.message : String(err),
      );
    }
  };
}

const HOOK_DIR = path.dirname(
  new URL(import.meta.url ?? `file://${__filename}`).pathname,
);

export default createHandler(HOOK_DIR);
