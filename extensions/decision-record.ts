import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { appendDecision, type DecisionInput } from "../skills/spec-docs/scripts/decision-ledger.ts";

const EFFECTS = ["behavior", "scope", "authorization", "architecture", "risk", "recovery", "flow-branch"] as const;

const text = Type.String({ minLength: 1 });
const texts = Type.Array(text);

export const DECISION_RECORD_PARAMETERS = Type.Object({
	requirementDir: Type.String({ description: "需求目录的绝对路径" }),
	actor: Type.Union([Type.Literal("ai"), Type.Literal("user")], {
		description: "ai：主 agent 自主形成的决定；user：用户形成的选择",
	}),
	source: Type.String({ minLength: 1, description: "决定形成的场合，例如 spec-flow/draft-confirm、spec-revise/attribution" }),
	trigger: Type.String({ minLength: 1, description: "引发这个决定的问题或情境" }),
	decision: Type.String({ minLength: 1, description: "已选定的方案" }),
	alternatives: Type.Array(text, { description: "被否定的备选方案；AI 决定至少一项，用户决定可为空" }),
	effects: Type.Array(Type.Union(EFFECTS.map((effect) => Type.Literal(effect))), {
		minItems: 1,
		description: "这个决定会改变的方面",
	}),
	scope: Type.Optional(Type.String({ minLength: 1, description: "仅 AI 决定：受影响的任务或 R/AC 范围" })),
	basis: Type.Optional(Type.Array(text, { description: "仅 AI 决定：依据，至少一项" })),
	action: Type.Optional(Type.String({ minLength: 1, description: "仅 AI 决定：记录后将执行的动作" })),
	impact: Type.Optional(Type.String({ minLength: 1, description: "仅用户决定：对后续动作的影响" })),
	supersedes: Type.Optional(
		Type.Array(Type.String({ pattern: "^(AI|USER)-\\d+$" }), { description: "被本决定替代的更早决定编号" }),
	),
});

type Params = {
	requirementDir: string;
	actor: "ai" | "user";
	source: string;
	trigger: string;
	decision: string;
	alternatives: string[];
	effects: (typeof EFFECTS)[number][];
	scope?: string;
	basis?: string[];
	action?: string;
	impact?: string;
	supersedes?: string[];
};

function toDecisionInput(params: Params): DecisionInput {
	const input: DecisionInput = {
		requirementDir: params.requirementDir,
		actor: params.actor,
		source: params.source,
		trigger: params.trigger,
		decision: params.decision,
		alternatives: params.alternatives,
		materiality: { alternativesExist: true, notUniquelyDetermined: true, effects: params.effects },
	};
	if (params.scope !== undefined) input.scope = params.scope;
	if (params.basis !== undefined) input.basis = params.basis;
	if (params.action !== undefined) input.action = params.action;
	if (params.impact !== undefined) input.impact = params.impact;
	if (params.supersedes !== undefined) input.supersedes = params.supersedes as DecisionInput["supersedes"];
	return input;
}

export default function decisionRecordExtension(pi: ExtensionAPI) {
	pi.registerTool({
		name: "decision_record",
		label: "Decision Record",
		description:
			"把一条材料性决定追加到当前需求目录的决策台账并返回回执。AI 自主形成的决定 actor 为 ai，用户的选择 actor 为 user。必须在执行该决定对应的动作之前调用；调用失败时不得执行动作。",
		parameters: DECISION_RECORD_PARAMETERS,
		async execute(_toolCallId, params) {
			const receipt = await appendDecision(toDecisionInput(params as Params));
			return {
				content: [
					{
						type: "text",
						text: `已记录 ${receipt.decisionId}：${receipt.ledgerPath} 第 ${receipt.lineNumber} 行，hash ${receipt.decisionHash}`,
					},
				],
				details: receipt,
			};
		},
	});
}
