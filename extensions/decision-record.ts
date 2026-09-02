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
	scope: Type.Optional(Type.Union([Type.String({ minLength: 1 }), Type.Null()], { description: "仅 AI 决定：受影响的任务或 R/AC 范围；用户决定传 null" })),
	basis: Type.Optional(Type.Union([Type.Array(text), Type.Null()], { description: "仅 AI 决定：依据，至少一项；用户决定传 null" })),
	action: Type.Optional(Type.Union([Type.String({ minLength: 1 }), Type.Null()], { description: "仅 AI 决定：记录后将执行的动作；用户决定传 null" })),
	impact: Type.Optional(Type.Union([Type.String({ minLength: 1 }), Type.Null()], { description: "仅用户决定：对后续动作的影响；AI 决定传 null" })),
	supersedes: Type.Optional(
		Type.Union([Type.Array(Type.String({ pattern: "^(AI|USER)-\\d+$" })), Type.Null()], { description: "被本决定替代的更早决定编号；没有则传 null 或空数组" }),
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
	scope?: string | null;
	basis?: string[] | null;
	action?: string | null;
	impact?: string | null;
	supersedes?: string[] | null;
};

function present<T>(value: T | null | undefined): value is T {
	return value !== null && value !== undefined && !(Array.isArray(value) && value.length === 0);
}

function toDecisionInput(params: Params): DecisionInput {
	const aiOnly = ["scope", "basis", "action"].filter((key) => present(params[key as "scope" | "basis" | "action"]));
	if (params.actor === "user" && aiOnly.length > 0) {
		throw new Error(`用户决定不得携带 ${aiOnly.join("、")}，请传 null；用户决定只需 impact`);
	}
	if (params.actor === "user" && !present(params.impact)) {
		throw new Error("用户决定必须提供 impact");
	}
	if (params.actor === "ai" && present(params.impact)) {
		throw new Error("AI 决定不得携带 impact，请传 null；AI 决定需要 scope、basis、action");
	}
	if (params.actor === "ai" && (!present(params.scope) || !present(params.basis) || !present(params.action))) {
		throw new Error("AI 决定必须同时提供 scope、basis（至少一项）、action");
	}
	const input: DecisionInput = {
		requirementDir: params.requirementDir,
		actor: params.actor,
		source: params.source,
		trigger: params.trigger,
		decision: params.decision,
		alternatives: params.alternatives,
		materiality: { alternativesExist: true, notUniquelyDetermined: true, effects: params.effects },
	};
	if (present(params.scope)) input.scope = params.scope;
	if (present(params.basis)) input.basis = params.basis;
	if (present(params.action)) input.action = params.action;
	if (present(params.impact)) input.impact = params.impact;
	if (present(params.supersedes)) input.supersedes = params.supersedes as DecisionInput["supersedes"];
	return input;
}

export default function decisionRecordExtension(pi: ExtensionAPI) {
	pi.registerTool({
		name: "decision_record",
		label: "Decision Record",
		description:
			"把一条材料性决定追加到当前需求目录的决策台账并返回回执。AI 自主形成的决定 actor 为 ai（需 scope、basis、action，impact 传 null），用户的选择 actor 为 user（需 impact，scope、basis、action 传 null）。必须在执行该决定对应的动作之前调用；调用失败时不得执行动作。",
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
