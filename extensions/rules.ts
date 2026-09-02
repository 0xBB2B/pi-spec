import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const rulesDir = join(dirname(fileURLToPath(import.meta.url)), "..", "rules");

function loadRules(): string {
	return readdirSync(rulesDir)
		.filter((file) => file.endsWith(".md"))
		.sort()
		.map((file) => readFileSync(join(rulesDir, file), "utf8").trim())
		.join("\n\n");
}

export default function rulesExtension(pi: ExtensionAPI) {
	const rules = loadRules();
	pi.on("before_agent_start", (event) => {
		if (!rules) return;
		return { systemPrompt: `${event.systemPrompt}\n\n${rules}` };
	});
}
