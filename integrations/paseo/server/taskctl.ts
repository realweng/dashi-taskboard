import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { isAbsolute } from "node:path";
import { promisify } from "node:util";
import type { DispatchConfig } from "../shared/taskboard";

const execute = promisify(execFile);
export class Taskctl {
  constructor(private config: DispatchConfig) {}

  async call<T>(...args: string[]): Promise<T> {
    if (!isAbsolute(this.config.taskctlPath)) throw new Error("taskctl 必须使用完整路径。");
    const runtime = this.config.runtimeFile ? ["--runtime-file", this.config.runtimeFile] : [];
    // The packaged wrapper owns endpoint discovery. Never guess a port or inherit
    // the controller's Codex identity into a Paseo-owned task.
    const env = { ...process.env };
    delete env.CODEX_THREAD_ID;
    if (this.config.runtimeFile) delete env.CODEX_TASKBOARD_URL;
    const { stdout } = await execute(this.config.taskctlPath, [...runtime, ...args, "--json"], {
      env, timeout: 30_000, maxBuffer: 8 * 1024 * 1024,
    });
    return JSON.parse(stdout) as T;
  }

  async url(): Promise<string> {
    const descriptor = JSON.parse(await readFile(this.config.runtimeFile || defaultRuntimeFile(), "utf8"));
    const url = new URL(descriptor.url);
    if (descriptor.version !== 1 || !["http:", "https:"].includes(url.protocol)) throw new Error("Taskboard runtime descriptor 无效。");
    return url.href;
  }
}

import os from "node:os";
import path from "node:path";
export function defaultRuntimeFile() {
  return process.env.CODEX_TASKBOARD_RUNTIME_FILE || path.join(os.homedir(), "Library/Application Support/Codex Taskboard/launcher-runtime.json");
}

export interface Issue {
  id: string; identifier?: string; projectId: string; title: string; description: string;
  version: number; status: string; archivedAt: string | null; labels: string[];
  threadId?: string | null; threadBinding?: unknown; agentSession?: { platform: string; sessionId: string } | null;
  developmentContext?: { type: string; path?: string; branch?: string } | null;
  relations?: { blockedBy?: { status: string }[] };
  executionTarget?: { provider: "claude" | "codex" | "kimi" | "pi"; model?: string } | null;
}
export interface BoardProject { id: string; name: string; workspacePath: string | null }
