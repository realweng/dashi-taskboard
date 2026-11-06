Taskboard connects a running Dashi Taskboard to Claude Code, Codex, Kimi Code CLI, and Pi in Paseo. It reads approved tasks, checks subscription quota windows, starts agents in isolated worktrees, and writes execution progress and results back to the board.

Select a project, models, and the quota accounts used by those agents. Task labels can restrict which models receive work. Pi shares its underlying model account's allowance. Unknown or exhausted quotas wait for a later check; there is no paid API fallback.

Requires Paseo 0.15 or later, a running Taskboard service with Paseo session support, and the exact local taskctl and Paseo CLI paths. Execution mappings are stored on the daemon. Permissions and interrupted work remain visible in Paseo; users can continue the original session. The plugin does not merge, release, or mark tasks done.

The complete board renders directly inside the Paseo desktop plugin screen, with a separate tab for automation settings. This first version runs on the daemon machine. After a daemon restart, open the Taskboard page once to resume scheduling. Its loopback address is not accessible directly from a remote phone.
