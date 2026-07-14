import type { LogEvent } from "../../logging/index.js";

// ===================================================================
// `paper-journal/events.log.jsonl`-dən `level: "SIGNAL"` sətirlərini oxuyur
// (runCycle.ts-in logger.signal() çağırışları). Digər level-lər (TRADE,
// RISK, WARN, ERROR) bu oxucunun işi deyil.
// ===================================================================

export interface EventsReaderDeps {
  readFile: (path: string) => Promise<string | null>;
}

export async function readSignalEvents(filePath: string, deps: EventsReaderDeps): Promise<LogEvent[]> {
  const content = await deps.readFile(filePath);
  if (content === null) return [];

  const events: LogEvent[] = [];
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.length === 0) continue;
    try {
      const event = JSON.parse(trimmed) as LogEvent;
      if (event.level === "SIGNAL") events.push(event);
    } catch {
      continue;
    }
  }
  return events;
}
