import type { TaskExecutionTarget } from "./types";

export interface PaseoModel { id: string; name: string }

export function isPaseoHost() {
  return window.parent !== window && new URL(document.baseURI).searchParams.get("host") === "paseo";
}

export function listPaseoModels(provider: TaskExecutionTarget["provider"]): Promise<PaseoModel[]> {
  const requestId = crypto.randomUUID();
  return new Promise((resolve, reject) => {
    const finish = () => {
      clearTimeout(timeout);
      window.removeEventListener("message", receive);
    };
    const receive = (event: MessageEvent) => {
      if (event.source !== window.parent || event.data?.type !== "taskboard:paseo-models-response" || event.data.requestId !== requestId) return;
      finish();
      if (typeof event.data.error === "string") { reject(new Error(event.data.error)); return; }
      const models: unknown = event.data.models;
      if (!Array.isArray(models) || !models.every(m => typeof m?.id === "string" && typeof m?.name === "string")) {
        reject(new Error("Paseo 返回的模型列表无效。")); return;
      }
      resolve(models);
    };
    const timeout = setTimeout(() => { finish(); reject(new Error("读取 Paseo 模型超时，请重新选择 Agent。")); }, 90_000);
    window.addEventListener("message", receive);
    window.parent.postMessage({ type: "taskboard:paseo-models-request", requestId, provider }, "*");
  });
}
