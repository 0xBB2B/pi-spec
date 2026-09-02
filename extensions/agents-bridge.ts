import { existsSync, lstatSync, mkdirSync, readdirSync, readlinkSync, symlinkSync, unlinkSync } from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { getAgentDir, type ExtensionAPI } from "@earendil-works/pi-coding-agent";

const packageAgentsDir = join(dirname(fileURLToPath(import.meta.url)), "..", "agents");

type BridgeOutcome = { linked: string[]; conflicts: string[]; removed: string[] };

function symlinkTarget(path: string): string | null {
	try {
		return lstatSync(path).isSymbolicLink() ? resolve(dirname(path), readlinkSync(path)) : null;
	} catch {
		return null;
	}
}

export function bridgeAgents(globalAgentsDir: string, sourceDir = packageAgentsDir): BridgeOutcome {
	mkdirSync(globalAgentsDir, { recursive: true });
	const outcome: BridgeOutcome = { linked: [], conflicts: [], removed: [] };

	for (const entry of readdirSync(globalAgentsDir)) {
		const path = join(globalAgentsDir, entry);
		const target = symlinkTarget(path);
		if (target && target.startsWith(sourceDir + sep) && !existsSync(target)) {
			unlinkSync(path);
			outcome.removed.push(entry);
		}
	}

	for (const entry of readdirSync(sourceDir).filter((file) => file.endsWith(".md")).sort()) {
		const source = join(sourceDir, entry);
		const path = join(globalAgentsDir, entry);
		if (symlinkTarget(path) === source) continue;
		if (existsSync(path) || symlinkTarget(path)) {
			outcome.conflicts.push(entry);
			continue;
		}
		symlinkSync(source, path);
		outcome.linked.push(entry);
	}
	return outcome;
}

export default function agentsBridgeExtension(pi: ExtensionAPI) {
	pi.on("session_start", (_event, ctx) => {
		const outcome = bridgeAgents(join(getAgentDir(), "agents"));
		if (outcome.linked.length > 0) {
			ctx.ui.notify(`pi-spec：已链接子代理 ${outcome.linked.join(", ")}`, "info");
		}
		if (outcome.conflicts.length > 0) {
			ctx.ui.notify(`pi-spec：全局 agents 目录已有同名文件，未覆盖：${outcome.conflicts.join(", ")}`, "warning");
		}
	});
}
