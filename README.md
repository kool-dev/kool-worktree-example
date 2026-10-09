# Kool worktree example

A Node + Vite example of [Kool's workspace support](https://github.com/kool-dev/kool/blob/feature/workspace-proxy/docs/15-Snippets/Workspaces.md) for Git worktrees and [Rift](https://github.com/anomalyco/rift).

Each workspace gets its own app and Vite server. PostgreSQL and Redis are shared. The page shows the current hostname and a shared database counter.

## Requirements

- Docker Engine 28+, Compose 2.24.4+, and Git.
- A Kool build with workspace/proxy support. Until released, build `feature/workspace-proxy` from [kool-dev/kool](https://github.com/kool-dev/kool) with `go build -o /your/bin/kool .` and put it on your `PATH`.
- Ports 80 and 3001 available, or already served by Kool's proxy.

No host Node/npm installation is needed; Rift is optional. This stack and its credentials are for local development. Your browser/resolver must support `*.localhost`, or you must add the exact hosts to your hosts file.

## 1. Start the original project

```bash
git clone https://github.com/kool-dev/kool-worktree-example.git
cd kool-worktree-example
kool start
kool logs app
```

Startup installs dependencies. Once the app and Vite are ready, open http://demo.localhost. Caddy routes HTML to the app and assets/HMR to Vite on http://demo.localhost:3001.

The counter is stored in PostgreSQL; `PONG` confirms the Redis connection.

## 2. Start a Git worktree

From the original checkout:

```bash
git worktree add ../task-a -b task-a
cd ../task-a
kool start
kool logs app
```

Open http://task-a.workspace.demo.localhost once ready. Edit `src/main.js` or `src/style.css` in `task-a` to see HMR in that workspace. Changes to `server.js` restart its Node app.

Increment the counter and refresh the original page: both apps use the same data.

Run checks inside the workspace:

```bash
kool run test
kool run build
kool status
```

Tests run in this workspace's app container without touching PostgreSQL. Use a dedicated test database for destructive integration tests.

Repeat with `../task-b` and branch `task-b` for another app. Hostnames follow workspace directory names. Use `kool status` to inspect projects.

## 3. Rift compatibility

Start the original project, then create a Rift workspace. The included `.rift.toml` starts it after creation and stops it before removal:

```toml
version = 1

[[hooks.postcreate]]
run = "kool start"

[[hooks.preremove]]
run = "kool stop"
```

Open `http://<workspace-directory-name>.workspace.demo.localhost` and use the same Kool commands. Plain Git worktrees need explicit start/stop commands.

## Stop and remove

Inside a Git worktree:

```bash
kool stop
cd ../kool-worktree-example
git worktree remove ../task-a
kool status
```

Save or commit edits before removal. Workspace stop removes its containers and routes; other apps keep running. Named volumes survive.

An unqualified `kool stop` in the original project stops its workspaces and stack, leaving unrelated projects and the proxy running.

For configuration details, a private database, troubleshooting, and local checks, see the [configuration guide](docs/configuration.md).
