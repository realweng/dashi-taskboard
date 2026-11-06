import type { PluginClientContext, PluginSidebarItemProps } from "@getpaseo/plugin/client";
import { SidebarRow } from "@getpaseo/plugin/client/ui";
import { TaskboardScreen } from "./client/taskboard";

function TaskboardItem({ currentScreen, openScreen }: PluginSidebarItemProps) {
  return (
    <SidebarRow
      icon="ListTodo"
      active={currentScreen?.screenId === "taskboard"}
      onPress={() => openScreen({ screenId: "taskboard" })}
    />
  );
}

export default function contribute(client: PluginClientContext) {
  client.addScreen({ id: "taskboard", title: "Taskboard", Component: TaskboardScreen });
  client.addSidebarHeaderItem({ id: "taskboard", title: "Taskboard", Component: TaskboardItem });
  return () => {};
}
