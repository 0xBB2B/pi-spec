import { describe, expect, test } from "bun:test";
import subagentsPreflightExtension, { detectSubagents, INSTALL_HINT } from "../extensions/subagents-preflight.ts";

type Handler = (data: unknown) => void;

function fakeBus(respond: boolean) {
  const handlers = new Map<string, Set<Handler>>();
  return {
    on(channel: string, handler: Handler) {
      handlers.set(channel, (handlers.get(channel) ?? new Set()).add(handler));
      return () => handlers.get(channel)?.delete(handler);
    },
    emit(channel: string, data: unknown) {
      if (channel === "subagents:rpc:ping" && respond) {
        const { requestId } = data as { requestId: string };
        for (const handler of handlers.get(`subagents:rpc:ping:reply:${requestId}`) ?? []) handler({ success: true, data: { version: 1 } });
      }
    },
  };
}

describe("subagents preflight", () => {
  test("detects pi-subagents when ping is answered", async () => {
    expect(await detectSubagents(fakeBus(true), [0])).toBe(true);
  });

  test("reports absence after retries when nobody answers", async () => {
    expect(await detectSubagents(fakeBus(false), [0, 10])).toBe(false);
  });

  test("warns with the install command when pi-subagents is missing", async () => {
    const notices: string[] = [];
    let onSessionStart: ((event: unknown, ctx: unknown) => Promise<void>) | undefined;
    const pi = {
      events: fakeBus(false),
      on: (name: string, handler: typeof onSessionStart) => { if (name === "session_start") onSessionStart = handler; },
    };
    subagentsPreflightExtension(pi as never);
    await onSessionStart?.({}, { ui: { notify: (message: string) => notices.push(message) } });
    expect(notices).toEqual([INSTALL_HINT]);
  });
});
