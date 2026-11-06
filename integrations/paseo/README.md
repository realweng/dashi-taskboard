# Taskboard for Paseo

Paseo 0.15+ 插件，用现有订阅额度分派 Taskboard 任务。第一版支持 Claude Code、Codex、Kimi Code CLI 和 Pi。

## 使用

在这个目录运行 `npm ci --ignore-scripts` 和 `npm run typecheck`。在目标 Paseo daemon 的插件总开关已经获用户授权开启后，运行：

```sh
paseo plugin install /absolute/path/to/dashi-taskboard/integrations/paseo
```

打开侧栏 **Taskboard**，默认直接在 Paseo 插件内容区显示完整任务看板。页签行右侧的 **－ / ＋** 缩放面板（80%–200%，点百分比重置为 100%），缩放偏好保存在本机，重载后保持。顶部 **自动调度** 页签用于配置和查看执行；在其中的连接设置填写本机 packaged `taskctl`、Paseo CLI 的精确路径。`runtimeFile` 留空使用当前 Launcher descriptor；隔离预览时填写独立 descriptor。Taskboard 服务必须包含本插件配套的 `paseo` 会话归属支持，旧的已安装服务需要更新后才能领取任务。不要把新代码的 CLI 指向不支持该字段的旧服务。

选择项目和精确目录，给要启用的 agent 选择实际模型及对应账户额度池。现有 Paseo profile 的说明会显示在页面中，可以应用其模型、运行模式、推理选项和 features。没有合适 profile 时，模型列表来自 daemon 实际返回值。

在内嵌看板的 **新建议题** 弹窗中，可以指定 **Agent** 和 **模型**。默认“自动分配”；选择某个 Agent 后，模型列表实时从 Paseo 读取。“按调度配置”使用该 Agent 的默认模型，指定具体模型则覆盖默认模型。执行偏好作为议题的 `executionTarget` 保存。明确指定后只使用该 Agent，额度不足、路由未启用或不可用时等待，不改派其他 Agent；仍使用该 Agent 路由配置的账户、权限模式和额度保留设置。

任务标签可以限定路由。例如 `implementation` 仅交给配置了该标签的候选；多个要求的标签必须全部匹配。留空表示不按标签筛选。多个候选中优先使用最紧张额度窗口剩余量较多的一个；所有已报告窗口均需高于保留比例。未知或不可用额度不会启用付费 API 回退。

Pi 共享底层账户额度，不是一份额外订阅。第一版订阅路由支持：

| Agent / 模型入口 | 额度来源 |
| --- | --- |
| Claude | Claude 账户 |
| Codex | Codex 账户 |
| Kimi 的 `kimi-code/*` | Kimi 账户 |
| Pi 的 `anthropic/*` | Claude 账户 |
| Pi 的 `openai-codex/*` | Codex 账户 |
| Pi 的 `kimi/*`、`kimi-coding/*` | Kimi 账户 |

需要选择与该 agent 实际登录相同的账户。插件不会切换登录、复制凭据或转换 OAuth。其他自定义 endpoint / API 计费模型仍可手动使用 Paseo，但不参与本插件的订阅调度。

保存后点击 **立即检查** 执行一轮，或开启自动调度。定时检查不启动额外的协调模型。没有任务或没有可用额度时等待下一轮。暂停只停止新分派，已启动 agent 继续执行与回写。

## 实际操作路径

1. packaged `taskctl` 读取所选项目的 `todo`，再读取完整议题、评论和附件。
2. 跳过已有会话绑定、未完成依赖或显式等待的任务；agent 在实施前也必须检查原始需求中的等待指令。
3. Paseo 创建隔离 worktree 和空闲 agent；以任务版本号领取成功后才发送工作提示。
4. Taskboard 保存真实 Paseo agent ID 和 worktree。插件记录 server、workspace、agent、模型、额度池、分支和任务版本，并在认领评论中回写。
5. agent 实施与直接验证，调度器回写结果。只有 agent 明确报告直接验证及所需评审已完成才移动到 `in_review`；需人工验收、权限或其他等待时保留产出并显示待处理状态。绝不自动标记 `done`。
6. 在执行记录打开 Paseo 会话处理权限或人工确认；等待项可以点击 **继续执行**，沿用原 agent 和 worktree。

默认同项目串行。已确认独立的冲突域可用 `paseo:lane:<domain>` 标签并行；共享 Launcher、注入、签名、发布等运行环境应使用同一个 domain，并停止同项目的其他自动认领器。发生等待的执行组保留其占用，其他独立组继续工作。

## 第一版边界

- 状态保存在 daemon 的 `$PASEO_HOME/plugin-data/taskboard/state.json`，包含配置和执行映射，不保存凭据。附件下载到相邻的 `inputs/`，供执行 agent 阅读。
- 打开插件页面或 daemon 上出现 agent 创建事件后启动调度器；daemon 重启后若没有任何这类操作，需打开一次 Taskboard 页面恢复调度。
- 额度报告使用 Paseo 缓存，百分比不是精确 token 预算；第一版保守检查全部返回窗口，包括模型专属窗口。不会预测长任务消耗。
- 支持同机执行；跨主机账户迁移、切换登录以及任务中途自动换 provider 不在第一版范围。中断后在原会话继续，或由人决定交接。
- 现有 `in_progress` 仅恢复插件自己持久记录的执行，不接管其他会话。
- 完整面板在 Paseo 桌面版插件内容区的 iframe 内渲染。手机原生客户端继续使用调度与执行列表；远程客户端不能直接访问 daemon 的 loopback URL。
- agent 完成报告是执行证据，用户验收仍独立进行。项目要求 GPT-6 Pro 或用户确认时，执行应停在等待步骤。

修改插件后先运行 `npm run typecheck`，再执行 `paseo plugin reload taskboard`，无需重启 daemon。
