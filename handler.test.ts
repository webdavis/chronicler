import { describe, it, expect, beforeEach, afterEach, spyOn } from "bun:test";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

describe("loadConfig", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "chronicler-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("reads outputDir and agents from chronicler.json", async () => {
    const config = {
      outputDir: "~/my-logs",
      agents: { main: "Dresden" },
    };
    fs.writeFileSync(
      path.join(tmpDir, "chronicler.json"),
      JSON.stringify(config),
    );

    const { loadConfig } = await import("./handler.ts");
    const result = loadConfig(tmpDir);

    expect(result.outputDir).toBe("~/my-logs");
    expect(result.agents).toEqual({ main: "Dresden" });
  });

  it("returns defaults when chronicler.json is missing", async () => {
    const { loadConfig } = await import("./handler.ts");
    const result = loadConfig(tmpDir);

    expect(result.outputDir).toBe("");
    expect(result.agents).toEqual({});
  });

  it("returns defaults when chronicler.json is malformed", async () => {
    fs.writeFileSync(path.join(tmpDir, "chronicler.json"), "not json{{{");

    const { loadConfig } = await import("./handler.ts");
    const result = loadConfig(tmpDir);

    expect(result.outputDir).toBe("");
    expect(result.agents).toEqual({});
  });
});

describe("resolveOutputDir", () => {
  it("expands tilde to HOME", () => {
    const { resolveOutputDir } = require("./handler.ts");
    const result = resolveOutputDir("~/my-logs", "/some/hookdir");
    expect(result).toBe(`${process.env.HOME}/my-logs`);
  });

  it("defaults to hookDir/logs when empty", () => {
    const { resolveOutputDir } = require("./handler.ts");
    const result = resolveOutputDir("", "/some/hookdir");
    expect(result).toBe("/some/hookdir/logs");
  });

  it("returns absolute paths unchanged", () => {
    const { resolveOutputDir } = require("./handler.ts");
    const result = resolveOutputDir("/absolute/path", "/some/hookdir");
    expect(result).toBe("/absolute/path");
  });
});

describe("resolveAgentName", () => {
  it("looks up agent ID from sessionKey in agents map", () => {
    const { resolveAgentName } = require("./handler.ts");
    const result = resolveAgentName("agent:main:cron:abc", { main: "Dresden" });
    expect(result).toBe("Dresden");
  });

  it("falls back to raw agent ID when no mapping exists", () => {
    const { resolveAgentName } = require("./handler.ts");
    const result = resolveAgentName("agent:researcher:task:xyz", {});
    expect(result).toBe("researcher");
  });

  it("handles malformed sessionKey gracefully", () => {
    const { resolveAgentName } = require("./handler.ts");
    const result = resolveAgentName("noseparator", {});
    expect(result).toBe("noseparator");
  });
});

describe("resolveSpeakerName", () => {
  it("uses metadata.senderName first", () => {
    const { resolveSpeakerName } = require("./handler.ts");
    const result = resolveSpeakerName({
      metadata: { senderName: "Alice", senderUsername: "alice99" },
      from: "12345",
    });
    expect(result).toBe("Alice");
  });

  it("falls back to metadata.senderUsername", () => {
    const { resolveSpeakerName } = require("./handler.ts");
    const result = resolveSpeakerName({
      metadata: { senderUsername: "alice99" },
      from: "12345",
    });
    expect(result).toBe("alice99");
  });

  it("falls back to event.from", () => {
    const { resolveSpeakerName } = require("./handler.ts");
    const result = resolveSpeakerName({ from: "12345" });
    expect(result).toBe("12345");
  });

  it("falls back to Unknown when nothing available", () => {
    const { resolveSpeakerName } = require("./handler.ts");
    const result = resolveSpeakerName({});
    expect(result).toBe("Unknown");
  });
});

describe("formatChannelTag", () => {
  it("combines channelId and conversationId", () => {
    const { formatChannelTag } = require("./handler.ts");
    const result = formatChannelTag({
      channelId: "discord",
      conversationId: "000000000000000001",
    });
    expect(result).toBe("discord:000000000000000001");
  });

  it("uses event.to as fallback for conversationId", () => {
    const { formatChannelTag } = require("./handler.ts");
    const result = formatChannelTag({
      channelId: "bluebubbles",
      to: "+18005551234",
    });
    expect(result).toBe("bluebubbles:+18005551234");
  });

  it("returns channel only when no conversationId or to", () => {
    const { formatChannelTag } = require("./handler.ts");
    const result = formatChannelTag({ channelId: "discord" });
    expect(result).toBe("discord");
  });

  it("returns unknown when channelId missing", () => {
    const { formatChannelTag } = require("./handler.ts");
    const result = formatChannelTag({});
    expect(result).toBe("unknown");
  });
});

describe("formatTimestamp", () => {
  it("formats a date with timezone abbreviation", () => {
    const { formatTimestamp } = require("./handler.ts");
    const result = formatTimestamp(new Date("2026-04-06T14:30:00Z"));
    // Should contain date, time, and a timezone abbreviation
    expect(result).toMatch(/\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}:\d{2}\s+\w+/);
  });
});

describe("getPathForDate", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "chronicler-path-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("creates YYYY/MM directory and returns path to YYYY-MM-DD.md", () => {
    const { getPathForDate } = require("./handler.ts");
    const date = new Date("2026-04-06T14:30:00Z");
    const result = getPathForDate(date, tmpDir);

    expect(result).toMatch(/2026\/04\/2026-04-06\.md$/);
    expect(fs.existsSync(path.dirname(result))).toBe(true);
  });
});

describe("appendMessage", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "chronicler-append-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("appends a formatted entry to the daily file", () => {
    const { appendMessage } = require("./handler.ts");
    const date = new Date("2026-04-06T14:30:00Z");
    appendMessage("Dresden", "discord:123", "Hello world", date, tmpDir);

    const files = fs.readdirSync(path.join(tmpDir, "2026", "04"));
    expect(files).toHaveLength(1);

    const content = fs.readFileSync(
      path.join(tmpDir, "2026", "04", files[0]),
      "utf8",
    );
    expect(content).toContain("[discord:123]");
    expect(content).toContain("Dresden:");
    expect(content).toContain("Hello world");
  });

  it("indents multiline message content", () => {
    const { appendMessage } = require("./handler.ts");
    const date = new Date("2026-04-06T14:30:00Z");
    appendMessage("Dresden", "discord:123", "line1\nline2", date, tmpDir);

    const files = fs.readdirSync(path.join(tmpDir, "2026", "04"));
    const content = fs.readFileSync(
      path.join(tmpDir, "2026", "04", files[0]),
      "utf8",
    );
    expect(content).toContain("line1\n  line2");
  });

  it("appends multiple messages to the same file", () => {
    const { appendMessage } = require("./handler.ts");
    const date = new Date("2026-04-06T14:30:00Z");
    appendMessage("Alice", "discord:123", "First", date, tmpDir);
    appendMessage("Dresden", "discord:123", "Second", date, tmpDir);

    const files = fs.readdirSync(path.join(tmpDir, "2026", "04"));
    const content = fs.readFileSync(
      path.join(tmpDir, "2026", "04", files[0]),
      "utf8",
    );
    expect(content).toContain("Alice:");
    expect(content).toContain("Dresden:");
    expect(content).toContain("First");
    expect(content).toContain("Second");
  });
});

describe("maybeLogHint", () => {
  it("logs hint when all agent mappings are identity (key === value)", () => {
    const { maybeLogHint, resetHintState } = require("./handler.ts");
    resetHintState();
    const spy = spyOn(console, "log");
    maybeLogHint({ main: "main" });
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0]).toContain("Agent name mapping not configured");
    spy.mockRestore();
  });

  it("does not log hint when mappings are customized", () => {
    const { maybeLogHint, resetHintState } = require("./handler.ts");
    resetHintState();
    const spy = spyOn(console, "log");
    maybeLogHint({ main: "Dresden" });
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("does not log hint when agents map is empty", () => {
    const { maybeLogHint, resetHintState } = require("./handler.ts");
    resetHintState();
    const spy = spyOn(console, "log");
    maybeLogHint({});
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("only logs once per gateway startup", () => {
    const { maybeLogHint, resetHintState } = require("./handler.ts");
    resetHintState();
    const spy = spyOn(console, "log");
    maybeLogHint({ main: "main" });
    maybeLogHint({ main: "main" });
    maybeLogHint({ main: "main" });
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });
});

describe("handler", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "chronicler-handler-"));
    const config = {
      outputDir: path.join(tmpDir, "logs"),
      agents: { main: "Dresden" },
    };
    fs.writeFileSync(
      path.join(tmpDir, "chronicler.json"),
      JSON.stringify(config),
    );
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("logs received messages from any channel", async () => {
    const { createHandler } = require("./handler.ts");
    const handler = createHandler(tmpDir);

    await handler({
      type: "message",
      action: "received",
      sessionKey: "agent:main:discord:123",
      channelId: "discord",
      conversationId: "000000000000000001",
      content: "Hello from Discord",
      metadata: { senderName: "Alice" },
      timestamp: Math.floor(new Date("2026-04-06T14:30:00Z").getTime() / 1000),
    });

    const logDir = path.join(tmpDir, "logs", "2026", "04");
    const files = fs.readdirSync(logDir);
    const content = fs.readFileSync(path.join(logDir, files[0]), "utf8");
    expect(content).toContain("[discord:000000000000000001]");
    expect(content).toContain("Alice:");
    expect(content).toContain("Hello from Discord");
  });

  it("logs sent messages using agent name from config", async () => {
    const { createHandler } = require("./handler.ts");
    const handler = createHandler(tmpDir);

    await handler({
      type: "message",
      action: "sent",
      sessionKey: "agent:main:discord:123",
      channelId: "discord",
      conversationId: "000000000000000001",
      content: "Reply from agent",
      success: true,
    });

    const logDir = path.join(tmpDir, "logs", "2026", "04");
    const files = fs.readdirSync(logDir);
    const content = fs.readFileSync(path.join(logDir, files[0]), "utf8");
    expect(content).toContain("Dresden:");
    expect(content).toContain("Reply from agent");
  });

  it("skips failed sent messages", async () => {
    const { createHandler } = require("./handler.ts");
    const handler = createHandler(tmpDir);

    await handler({
      type: "message",
      action: "sent",
      sessionKey: "agent:main:discord:123",
      channelId: "discord",
      content: "Should not appear",
      success: false,
    });

    const logDir = path.join(tmpDir, "logs");
    expect(fs.existsSync(logDir)).toBe(false);
  });

  it("ignores non-message events", async () => {
    const { createHandler } = require("./handler.ts");
    const handler = createHandler(tmpDir);

    await handler({
      type: "command",
      action: "new",
      sessionKey: "agent:main:main",
    });

    const logDir = path.join(tmpDir, "logs");
    expect(fs.existsSync(logDir)).toBe(false);
  });
});
