import { createElement, useEffect, useRef, type ReactElement } from "react";
import { Platform, Text } from "react-native";
import { providerSchema, type Route } from "../shared/taskboard";

interface FrameWindow { postMessage(data: unknown, origin: string): void }
interface FrameElement { contentWindow: FrameWindow | null }
interface FrameMessage { source: unknown; origin: string; data: unknown }
declare const window: {
  addEventListener(type: "message", listener: (event: FrameMessage) => void): void;
  removeEventListener(type: "message", listener: (event: FrameMessage) => void): void;
};

export interface PaseoProjectChoice { id: string; name: string; workspacePath: string }
export interface PaseoSummaryResult { summary: string; provider: string; model: string }

// Keep the existing DOM-based Taskboard in its own document. Browser-only
// rendering lives here; the scheduler screen still uses native components.
export function TaskboardFrame({ url, color, loadModels, loadProjects, summarize, zoom = 1 }: {
  url: string; color: string; zoom?: number;
  loadModels: (input: { provider: Route["provider"] }) => Promise<{ models: { id: string; name: string }[] }>;
  loadProjects: (input: Record<string, never>) => Promise<{ projects: PaseoProjectChoice[] }>;
  summarize: (input: { projectId: string }) => Promise<PaseoSummaryResult>;
}): ReactElement {
  const frame = useRef<FrameElement | null>(null);
  const frameUrl = new URL(url);
  frameUrl.searchParams.set("host", "paseo");
  const origin = frameUrl.origin;
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const receive = (event: FrameMessage) => {
      if (event.source !== frame.current?.contentWindow || event.origin !== origin || !event.data || typeof event.data !== "object") return;
      const data = event.data as Record<string, unknown>;
      if (typeof data.requestId !== "string") return;
      const respond = (type: string) => (result: object) => frame.current?.contentWindow?.postMessage({
        type, requestId: data.requestId, ...result,
      }, origin);
      const fail = (type: string) => (error: unknown) => respond(type)({ error: error instanceof Error ? error.message : String(error) });
      if (data.type === "taskboard:paseo-models-request") {
        const provider = providerSchema.safeParse(data.provider);
        if (!provider.success) return;
        void loadModels({ provider: provider.data }).then(respond("taskboard:paseo-models-response")).catch(fail("taskboard:paseo-models-response"));
        return;
      }
      if (data.type === "taskboard:paseo-projects-request") {
        void loadProjects({}).then(respond("taskboard:paseo-projects-response")).catch(fail("taskboard:paseo-projects-response"));
        return;
      }
      if (data.type === "taskboard:paseo-summary-request" && typeof data.projectId === "string") {
        void summarize({ projectId: data.projectId }).then(respond("taskboard:paseo-summary-response")).catch(fail("taskboard:paseo-summary-response"));
      }
    };
    window.addEventListener("message", receive);
    return () => window.removeEventListener("message", receive);
  }, [origin, loadModels, loadProjects, summarize]);
  if (Platform.OS !== "web") {
    return createElement(Text, { style: { color } }, "完整任务面板目前支持在 Paseo 桌面版内显示。");
  }
  return createElement("iframe", {
    ref: (element: FrameElement | null) => { frame.current = element; },
    src: frameUrl.href,
    title: "Taskboard 任务面板",
    style: { display: "block", width: "100%", height: "100%", flex: 1, border: 0, minHeight: 0, zoom },
  });
}
