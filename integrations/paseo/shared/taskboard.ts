import { defineRpc } from "@getpaseo/plugin";
import { z } from "zod";

export const providerSchema = z.enum(["claude", "codex", "kimi", "pi"]);
export const routeSchema = z.object({
  id: z.string().min(1),
  provider: providerSchema,
  model: z.string().min(1),
  modeId: z.string().optional(),
  thinkingOptionId: z.string().optional(),
  featureValues: z.record(z.string(), z.json()).optional(),
  quotaId: z.string().min(1),
  requiredLabels: z.array(z.string()).default([]),
  enabled: z.boolean().default(true),
});
export const configSchema = z.object({
  enabled: z.boolean().default(false),
  taskctlPath: z.string().min(1),
  paseoPath: z.string().min(1),
  runtimeFile: z.string().default(""),
  projects: z.array(z.object({ id: z.string(), workspacePath: z.string().min(1) })),
  routes: z.array(routeSchema),
  reservePercent: z.number().min(0).max(99).default(10),
  intervalMinutes: z.number().int().min(1).max(60).default(5),
});
export type DispatchConfig = z.infer<typeof configSchema>;
export type Route = z.infer<typeof routeSchema>;

export const runSchema = z.object({
  issueId: z.string(), projectId: z.string(), title: z.string(),
  agentId: z.string(), workspaceId: z.string(), serverId: z.string(),
  provider: providerSchema, model: z.string(), quotaId: z.string(),
  worktreePath: z.string(), branch: z.string(), lane: z.string(),
  version: z.number(),
  taskctlPath: z.string(), runtimeFile: z.string(),
  status: z.enum(["running", "permission", "error", "blocked", "in_review"]),
  startedAt: z.string(), message: z.string().default(""),
});
export type TaskRun = z.infer<typeof runSchema>;
export const windowSchema = z.object({
  label: z.string(), remainingPct: z.number().nullable(), resetsAt: z.string().nullable(),
});
export const quotaSchema = z.object({
  id: z.string(), label: z.string(), status: z.string(), windows: z.array(windowSchema),
});
export type Quota = z.infer<typeof quotaSchema>;
export const snapshotSchema = z.object({
  config: configSchema,
  projects: z.array(z.object({ id: z.string(), name: z.string(), workspacePath: z.string().nullable() })),
  profiles: z.array(z.object({ id: z.string(), name: z.string(), provider: z.string(), model: z.string().optional(), notes: z.string().optional(), modeId: z.string().optional(), thinkingOptionId: z.string().optional(), featureValues: z.record(z.string(), z.json()).optional() })),
  providers: z.array(z.object({ id: z.string(), available: z.boolean() })),
  quotas: z.array(quotaSchema), runs: z.array(runSchema),
  lastCheckedAt: z.string().nullable(), message: z.string(),
});
export type Snapshot = z.infer<typeof snapshotSchema>;
export const readBoard = defineRpc({ name: "taskboard.read", input: z.object({}), output: snapshotSchema });
export const saveConfig = defineRpc({ name: "taskboard.configure", input: configSchema, output: z.object({ saved: z.boolean() }) });
export const checkNow = defineRpc({ name: "taskboard.check", input: z.object({}), output: z.object({ message: z.string() }) });
export const continueRun = defineRpc({ name: "taskboard.continue", input: z.object({ agentId: z.string() }), output: z.object({ message: z.string() }) });
export const openBoard = defineRpc({ name: "taskboard.url", input: z.object({}), output: z.object({ url: z.string() }) });
export const modelCatalog = defineRpc({ name: "taskboard.models", input: z.object({ provider: providerSchema }), output: z.object({ models: z.array(z.object({ id: z.string(), name: z.string() })) }) });
export const listPaseoProjects = defineRpc({ name: "taskboard.paseo-projects", input: z.object({}), output: z.object({ projects: z.array(z.object({ id: z.string(), name: z.string(), workspacePath: z.string() })) }) });
export const summarizeProject = defineRpc({ name: "taskboard.summarize-project", input: z.object({ projectId: z.string().min(1) }), output: z.object({ summary: z.string(), provider: providerSchema, model: z.string() }) });
