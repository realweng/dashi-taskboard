import type { PluginServerContext } from "@getpaseo/plugin/server";
import { checkNow, continueRun, listPaseoProjects, modelCatalog, openBoard, readBoard, saveConfig, summarizeProject } from "./shared/taskboard";
import { Dispatcher } from "./server/dispatcher";

export default function contribute(server: PluginServerContext) {
  let dispatcher: Dispatcher | undefined;
  let initialization: Promise<void> | undefined;
  const get = async (paseo: ConstructorParameters<typeof Dispatcher>[0]) => {
    if (!dispatcher) {
      dispatcher = new Dispatcher(paseo);
      initialization = dispatcher.start();
    }
    await initialization;
    return dispatcher;
  };
  server.handle(readBoard, async (_, { paseo }) => (await get(paseo)).snapshot());
  server.handle(saveConfig, async (config, { paseo }) => {
    await (await get(paseo)).configure(config);
    return { saved: true };
  });
  server.handle(checkNow, async (_, { paseo }) => ({ message: await (await get(paseo)).tick(true) }));
  server.handle(continueRun, async ({ agentId }, { paseo }) => ({ message: await (await get(paseo)).continue(agentId) }));
  server.handle(openBoard, async (_, { paseo }) => ({ url: await (await get(paseo)).boardUrl() }));
  server.handle(modelCatalog, async ({ provider }, { paseo }) => ({ models: await (await get(paseo)).models(provider) }));
  server.handle(listPaseoProjects, async (_, { paseo }) => ({ projects: await (await get(paseo)).paseoProjects() }));
  server.handle(summarizeProject, async ({ projectId }, { paseo }) => (await get(paseo)).summarize(projectId));
  const unhook = server.on("agent.created", async (_, { paseo }) => { await get(paseo); });
  return () => { unhook(); dispatcher?.stop(); };
}
