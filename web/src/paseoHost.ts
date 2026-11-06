import type { TaskExecutionTarget } from "./types";

export interface PaseoModel { id: string; name: string }
export interface PaseoProject { id: string; name: string; workspacePath: string }
export interface PaseoSummary { summary: string; provider: string; model: string }

export function isPaseoHost() {
  return window.parent !== window && new URL(document.baseURI).searchParams.get("host") === "paseo";
}

function request<T>(type: string, responseType: string, payload: Record<string, unknown>, timeoutMs: number, timeoutMessage: string): Promise<T> {
  const requestId = crypto.randomUUID();
  return new Promise((resolve, reject) => {
    const finish = () => {
      clearTimeout(timeout);
      window.removeEventListener("message", receive);
    };
    const receive = (event: MessageEvent) => {
      if (event.source !== window.parent || event.data?.type !== responseType || event.data.requestId !== requestId) return;
      finish();
      if (typeof event.data.error === "string") { reject(new Error(event.data.error)); return; }
      resolve(event.data as T);
    };
    const timeout = setTimeout(() => { finish(); reject(new Error(timeoutMessage)); }, timeoutMs);
    window.addEventListener("message", receive);
    window.parent.postMessage({ type, requestId, ...payload }, "*");
  });
}

export async function listPaseoModels(provider: TaskExecutionTarget["provider"]): Promise<PaseoModel[]> {
  const response = await request<{ models: unknown }>(
    "taskboard:paseo-models-request", "taskboard:paseo-models-response", { provider },
    90_000, "读取 Paseo 模型超时，请重新选择 Agent。",
  );
  const models: unknown = response.models;
  if (!Array.isArray(models) || !models.every(m => typeof m?.id === "string" && typeof m?.name === "string")) {
    throw new Error("Paseo 返回的模型列表无效。");
  }
  return models;
}

export async function listPaseoProjects(): Promise<PaseoProject[]> {
  const response = await request<{ projects: unknown }>(
    "taskboard:paseo-projects-request", "taskboard:paseo-projects-response", {},
    30_000, "读取 Paseo 项目列表超时。",
  );
  const projects: unknown = response.projects;
  if (!Array.isArray(projects) || !projects.every(p => typeof p?.id === "string" && typeof p?.name === "string" && typeof p?.workspacePath === "string")) {
    throw new Error("Paseo 返回的项目列表无效。");
  }
  return projects;
}

export function generatePaseoSummary(projectId: string): Promise<PaseoSummary> {
  return request<PaseoSummary>(
    "taskboard:paseo-summary-request", "taskboard:paseo-summary-response", { projectId },
    10 * 60_000, "Paseo 生成项目总结超时。",
  );
}
