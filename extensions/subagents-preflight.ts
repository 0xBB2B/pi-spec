import { randomUUID } from "node:crypto";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

type EventBus = Pick<ExtensionAPI["events"], "on" | "emit">;

export const INSTALL_HINT = "pi-spec 依赖 @tintinweb/pi-subagents（Agent、SubagentWorkflow、StructuredOutput 与子代理定义都由它提供），当前会话未检测到。请执行：pi install npm:@tintinweb/pi-subagents";

function pingOnce(events: EventBus, timeoutMs: number): Promise<boolean> {
	return new Promise((resolve) => {
		const requestId = randomUUID();
		const unsubscribe = events.on(`subagents:rpc:ping:reply:${requestId}`, () => {
			clearTimeout(timer);
			unsubscribe();
			resolve(true);
		});
		const timer = setTimeout(() => {
			unsubscribe();
			resolve(false);
		}, timeoutMs);
		events.emit("subagents:rpc:ping", { requestId });
	});
}

export async function detectSubagents(events: EventBus, delaysMs: number[] = [0, 500, 1500]): Promise<boolean> {
	for (const delay of delaysMs) {
		if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
		if (await pingOnce(events, 300)) return true;
	}
	return false;
}

export default function subagentsPreflightExtension(pi: ExtensionAPI) {
	pi.on("session_start", async (_event, ctx) => {
		if (!(await detectSubagents(pi.events))) ctx.ui.notify(INSTALL_HINT, "warning");
	});
}
