import { useRpc, type PluginScreenProps } from "@getpaseo/plugin/client";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { TaskboardFrame } from "./web";
import {
  checkNow, continueRun, modelCatalog, openBoard, readBoard, saveConfig,
  type DispatchConfig, type Route,
} from "../shared/taskboard";

const providers = ["claude", "codex", "kimi", "pi"] as const;
const providerNames = { claude: "Claude", codex: "Codex", kimi: "Kimi", pi: "Pi" };
type Model = { id: string; name: string };

function displayTime(value: string | null) {
  return value ? new Date(value).toLocaleString() : "未提供";
}

function screenStyles(theme: PluginScreenProps["theme"], compact: boolean) {
  return {
    root: { flex: 1, backgroundColor: theme.colors.surface0 },
    body: { padding: compact ? 16 : 24, gap: 20, width: "100%" as const, maxWidth: 1120, alignSelf: "center" as const },
    section: { gap: 10, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border },
    title: { color: theme.colors.foreground, fontSize: 18, fontWeight: "600" as const },
    text: { color: theme.colors.foreground },
    muted: { color: theme.colors.foregroundMuted, fontSize: 13 },
    row: { flexDirection: "row" as const, flexWrap: "wrap" as const, gap: 8, alignItems: "center" as const },
    button: { paddingVertical: 9, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: theme.colors.border },
    selected: { backgroundColor: theme.colors.accent },
    selectedText: { color: theme.colors.accentForeground },
    input: { color: theme.colors.foreground, backgroundColor: theme.colors.surface0, borderColor: theme.colors.border, borderWidth: 1, borderRadius: 8, padding: 10, minWidth: 80 },
  };
}


function Button({ styles, busy, title, onPress, selected = false, disabled = false }: {
    styles: ReturnType<typeof screenStyles>; busy: boolean;
    title: string; onPress: () => void; selected?: boolean; disabled?: boolean;
  }) {
    return <Pressable accessibilityRole="button" accessibilityLabel={title}
      accessibilityState={{ selected, disabled }} disabled={disabled || busy}
      onPress={onPress} style={[styles.button, selected && styles.selected, (disabled || busy) && { opacity: 0.5 }]}>
      <Text style={selected ? styles.selectedText : styles.text}>{title}</Text>
    </Pressable>;
  }

function Field({ styles, label, value, onChange, numeric = false }: {
    styles: ReturnType<typeof screenStyles>;
    label: string; value: string; onChange: (value: string) => void; numeric?: boolean;
  }) {
    return <View style={{ gap: 5 }}>
      <Text style={styles.muted}>{label}</Text>
      <TextInput accessibilityLabel={label} value={value} onChangeText={onChange}
        keyboardType={numeric ? "numeric" : "default"} autoCapitalize="none" autoCorrect={false}
        style={styles.input} />
    </View>;
  }

export function TaskboardScreen({ theme, layout, navigation, host }: PluginScreenProps) {
  const read = useRpc(readBoard);
  const configure = useRpc(saveConfig);
  const inspect = useRpc(checkNow);
  const board = useRpc(openBoard);
  const catalog = useRpc(modelCatalog);
  const resume = useRpc(continueRun);
  const snapshot = useQuery({
    queryKey: ["taskboard", host.id],
    queryFn: () => read({}),
    refetchInterval: 5000,
  });
  const [draft, setDraft] = useState<DispatchConfig | null>(null);
  const [models, setModels] = useState<Partial<Record<Route["provider"], Model[]>>>({});
  const [labelInputs, setLabelInputs] = useState<Partial<Record<Route["provider"], string>>>({});
  const [advanced, setAdvanced] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [view, setView] = useState<"board" | "automation">("board");
  const [frameVersion, setFrameVersion] = useState(0);
  const boardAddress = useQuery({
    queryKey: ["taskboard-url", host.id, snapshot.data?.config.runtimeFile],
    queryFn: () => board({}),
    enabled: view === "board",
  });
  const activeHost = useRef(host.id);

  useEffect(() => {
    if (activeHost.current === host.id) return;
    activeHost.current = host.id;
    setDraft(null);
    setModels({});
    setLabelInputs({});
    setError("");
    setNotice("");
  }, [host.id]);
  useEffect(() => {
    if (snapshot.data) setDraft((current) => current ?? snapshot.data.config);
  }, [snapshot.data]);

  const styles = useMemo(() => screenStyles(theme, layout.compact), [theme, layout.compact]);

  function update(patch: Partial<DispatchConfig>) {
    setDraft((current) => current ? { ...current, ...patch } : current);
  }

  function updateRoute(provider: Route["provider"], patch: Partial<Route>) {
    setDraft((current) => {
      if (!current) return current;
      const previous = current.routes.find((route) => route.provider === provider);
      const route: Route = {
        id: provider, provider, model: "", quotaId: "", requiredLabels: [], enabled: false,
        ...previous, ...patch,
      };
      return { ...current, routes: [...current.routes.filter((item) => item.id !== route.id), route] };
    });
  }

  async function act(operation: () => Promise<void>) {
    setBusy(true);
    setError("");
    setNotice("");
    try { await operation(); }
    catch (failure) { setError(failure instanceof Error ? failure.message : String(failure)); }
    finally { setBusy(false); }
  }

  async function save(enabled = draft?.enabled) {
    if (!draft) return;
    const config = {
      ...draft,
      enabled: enabled ?? false,
      routes: draft.routes.filter((route) => route.model && route.quotaId),
    };
    await configure(config);
    setDraft(config);
    setNotice(config.enabled ? "配置已保存，自动调度已启用。" : "配置已保存，自动调度已暂停。");
    await snapshot.refetch();
  }

  const data = snapshot.data;
  return <View style={styles.root}>
    <View style={[styles.row, { padding: 10, borderBottomWidth: 1, borderColor: theme.colors.border }]}>
      <Button styles={styles} busy={false} title="任务面板" selected={view === "board"} onPress={() => setView("board")} />
      <Button styles={styles} busy={false} title="自动调度" selected={view === "automation"} onPress={() => setView("automation")} />
      {view === "board" && <Button styles={styles} busy={boardAddress.isFetching} title="刷新面板" onPress={() => {
        setFrameVersion(v => v + 1);
        void boardAddress.refetch();
      }} />}
    </View>
    {view === "board" ? <View style={{ flex: 1, minHeight: 0 }}>
      {boardAddress.data && !boardAddress.error && <TaskboardFrame key={`${host.id}:${frameVersion}`} url={boardAddress.data.url} color={theme.colors.foreground} loadModels={catalog} />}
      {boardAddress.isPending && <Text style={[styles.muted, { padding: 20 }]}>正在连接任务面板…</Text>}
      {!!boardAddress.error && <View style={{ padding: 20, gap: 12 }}>
        <Text style={styles.text}>无法连接任务面板：{boardAddress.error instanceof Error ? boardAddress.error.message : String(boardAddress.error)}</Text>
        <Button styles={styles} busy={false} title="前往连接设置" onPress={() => { setAdvanced(true); setView("automation"); }} />
      </View>}
    </View> : <ScrollView style={styles.root} contentContainerStyle={styles.body}>
    <View style={{ gap: 8 }}>
      <Text style={[styles.title, { fontSize: 24 }]}>任务调度</Text>
      <Text style={styles.muted}>按可用额度分派任务到 Claude、Codex、Kimi 和 Pi。配置保存后生效。</Text>
      <Text style={styles.text}>{data?.config.enabled ? "自动调度运行中" : "自动调度已暂停"}</Text>
      <Text style={styles.muted}>上次检查：{displayTime(data?.lastCheckedAt ?? null)}</Text>
      {!!data?.message && <Text style={styles.text}>{data.message}</Text>}
      <View style={styles.row}>
        <Button styles={styles} busy={busy} title="刷新" onPress={() => void snapshot.refetch()} />
        <Button styles={styles} busy={busy} title="立即检查" onPress={() => void act(async () => {
          const result = await inspect({});
          setNotice(result.message);
          await snapshot.refetch();
        })} />
        <Button styles={styles} busy={busy} title="查看任务面板" onPress={() => setView("board")} />
      </View>
      {(error || snapshot.error) && <Text accessibilityRole="alert" style={styles.text}>
        操作失败：{error || (snapshot.error instanceof Error ? snapshot.error.message : String(snapshot.error))}
      </Text>}
      {!!notice && <Text style={styles.text}>{notice}</Text>}
      {!data && !snapshot.error && <Text style={styles.muted}>正在读取面板与额度…</Text>}
    </View>

    <View style={styles.section}>
      <Text style={styles.title}>订阅额度</Text>
      {!data?.quotas.length && <Text style={styles.muted}>尚无额度报告。</Text>}
      {data?.quotas.map((quota) => <View key={quota.id} style={{ gap: 5, paddingVertical: 5 }}>
        <Text style={styles.text}>{quota.label} · {quota.status}</Text>
        {quota.windows.map((window, index) => <Text key={`${window.label}-${index}`} style={styles.muted}>
          {window.label}：剩余 {window.remainingPct === null ? "未知" : `${window.remainingPct}%`} · 重置 {displayTime(window.resetsAt)}
        </Text>)}
      </View>)}
    </View>

    {draft && <>
      <View style={styles.section}>
        <Text style={styles.title}>处理项目</Text>
        <Text style={styles.muted}>仅处理选中项目中允许执行的任务；工作目录必须是该项目在此主机上的精确路径。</Text>
        {data?.projects.map((project) => {
          const selected = draft.projects.find((item) => item.id === project.id);
          return <View key={project.id} style={{ gap: 8 }}>
            <Button styles={styles} busy={busy} title={`${selected ? "已选" : "选择"} · ${project.name}`} selected={!!selected}
              onPress={() => update({ projects: selected
                ? draft.projects.filter((item) => item.id !== project.id)
                : [...draft.projects, { id: project.id, workspacePath: project.workspacePath ?? "" }],
              })} />
            {selected && <Field styles={styles} label={`${project.name} 工作目录`} value={selected.workspacePath}
              onChange={(workspacePath) => update({ projects: draft.projects.map((item) => item.id === project.id ? { ...item, workspacePath } : item) })} />}
          </View>;
        })}
      </View>

      <View style={styles.section}>
        <Text style={styles.title}>Agent profiles</Text>
        <Text style={styles.muted}>先阅读 profile 的用途说明，再应用它的模型和运行设置；额度池仍需单独选择。</Text>
        {!data?.profiles.length && <Text style={styles.muted}>没有已配置的 profile，可在下方加载模型。</Text>}
        {data?.profiles.map((profile) => {
          const provider = profile.provider.split("/")[0];
          return <View key={profile.id} style={{ gap: 6, paddingVertical: 6 }}>
            <Text style={styles.text}>{profile.name} · {profile.provider}{profile.model ? ` / ${profile.model}` : ""}</Text>
            <Text style={styles.muted}>{profile.notes || "未填写用途说明"}</Text>
            {providers.includes(provider as Route["provider"]) && <Button styles={styles} busy={busy} title={`应用 ${profile.name}`}
              onPress={() => updateRoute(provider as Route["provider"], {
                model: profile.model ?? profile.provider.split("/").slice(1).join("/"),
                modeId: profile.modeId, thinkingOptionId: profile.thinkingOptionId,
                featureValues: profile.featureValues,
              })} />}
          </View>;
        })}
      </View>

      {providers.map((provider) => {
        const route = draft.routes.find((item) => item.provider === provider);
        const available = data?.providers.find((item) => item.id === provider)?.available;
        return <View key={provider} style={styles.section}>
          <Text style={styles.title}>{providerNames[provider]} · {available ? "可用" : "当前不可用"}</Text>
          <View style={styles.row}>
            <Button styles={styles} busy={busy} title={route?.enabled ? "路由已启用" : "路由已禁用"} selected={!!route?.enabled}
              onPress={() => updateRoute(provider, { enabled: !route?.enabled })} />
            <Button styles={styles} busy={busy} title={`加载 ${providerNames[provider]} 模型`} onPress={() => void act(async () => {
              const result = await catalog({ provider });
              setModels((current) => ({ ...current, [provider]: result.models }));
              if (!result.models.length) setNotice("该 provider 未返回可用模型。");
            })} />
          </View>
          <Text style={styles.text}>模型：{route?.model || "未配置"}</Text>
          <View style={styles.row}>
            {models[provider]?.map((model) => <Button styles={styles} busy={busy} key={model.id} title={model.name}
              selected={route?.model === model.id} onPress={() => updateRoute(provider, { model: model.id })} />)}
          </View>
          <Text style={styles.muted}>额度池：选择这个 provider 实际使用的订阅账户。同一账户的多个 agent 共享额度。</Text>
          {provider === "pi" && <Text style={styles.muted}>Pi 共享所选模型的底层账号额度，不提供额外额度：Anthropic 对应 Claude，OpenAI Codex 对应 Codex，Kimi 对应 Kimi。</Text>}
          <View style={styles.row}>
            {data?.quotas.map((quota) => <Button styles={styles} busy={busy} key={quota.id} title={`${quota.label} · ${quota.id}`}
              selected={route?.quotaId === quota.id} onPress={() => updateRoute(provider, { quotaId: quota.id })} />)}
          </View>
          {!route?.quotaId && <Text style={styles.muted}>未选择额度池</Text>}
          <Field styles={styles} label={`${providerNames[provider]} 任务标签（逗号分隔）`}
            value={labelInputs[provider] ?? route?.requiredLabels.join(", ") ?? ""}
            onChange={(value) => {
              setLabelInputs((current) => ({ ...current, [provider]: value }));
              updateRoute(provider, { requiredLabels: value.split(",").map((label) => label.trim()).filter(Boolean) });
            }} />
          <Text style={styles.muted}>标签用于限定适合该模型的任务类型，避免仅按剩余额度分派高风险任务。留空时不按标签筛选。</Text>

        </View>;
      })}

      <View style={styles.section}>
        <Text style={styles.title}>调度设置</Text>
        <Field styles={styles} label="保留额度百分比（0–99）" value={String(draft.reservePercent)} numeric
          onChange={(value) => update({ reservePercent: Number(value) })} />
        <Field styles={styles} label="检查间隔（1–60 分钟）" value={String(draft.intervalMinutes)} numeric
          onChange={(value) => update({ intervalMinutes: Number(value) })} />
        <Button styles={styles} busy={busy} title={advanced ? "收起连接设置" : "连接设置"} onPress={() => setAdvanced(!advanced)} />
        {advanced && <>
          <Field styles={styles} label="Paseo CLI 精确路径" value={draft.paseoPath} onChange={(paseoPath) => update({ paseoPath })} />
          <Field styles={styles} label="taskctl 精确路径" value={draft.taskctlPath} onChange={(taskctlPath) => update({ taskctlPath })} />
          <Field styles={styles} label="Runtime descriptor 路径（留空使用 Launcher 当前运行时）" value={draft.runtimeFile}
            onChange={(runtimeFile) => update({ runtimeFile })} />
        </>}
        <Text style={styles.muted}>未同时配置模型与额度池的路由不会保存。启用前请完成项目与路由选择。</Text>
        <View style={styles.row}>
          <Button styles={styles} busy={busy} title="保存配置" onPress={() => void act(() => save())} />
          <Button styles={styles} busy={busy} title="保存并启用" selected={draft.enabled} onPress={() => void act(() => save(true))} />
          <Button styles={styles} busy={busy} title="暂停自动调度" onPress={() => void act(() => save(false))} />
        </View>
      </View>
    </>}

    <View style={styles.section}>
      <Text style={styles.title}>执行记录</Text>
      {!data?.runs.length && <Text style={styles.muted}>尚无执行记录。</Text>}
      {data?.runs.map((run) => <View key={run.agentId} style={{ gap: 6, paddingVertical: 8 }}>
        <Text style={styles.text}>{run.title} · {run.status}</Text>
        <Text style={styles.muted}>{run.provider} / {run.model} · 开始于 {displayTime(run.startedAt)}</Text>
        <Text selectable style={styles.muted}>{run.branch} · {run.worktreePath}</Text>
        {!!run.message && <Text style={styles.text}>{run.message}</Text>}
        <Button styles={styles} busy={busy} title={`打开会话 · ${run.title}`} disabled={!navigation?.openAgent}
          onPress={() => void act(async () => { await navigation?.openAgent?.({ agentId: run.agentId, serverId: run.serverId }); })} />
        {(run.status === "blocked" || run.status === "error") && <Button styles={styles} busy={busy}
          title={`继续执行 · ${run.title}`} onPress={() => void act(async () => {
            const result = await resume({ agentId: run.agentId });
            setNotice(result.message);
            await snapshot.refetch();
          })} />}
      </View>)}
    </View>
  </ScrollView>}
  </View>;
}
