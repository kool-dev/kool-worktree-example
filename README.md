# Kool worktree example

A small Node + Vite project demonstrating [Kool's workspace support](https://github.com/kool-dev/kool/blob/feature/workspace-proxy/docs/15-Snippets/Workspaces.md) for Git worktrees and [Rift](https://github.com/anomalyco/rift).

Each workspace runs its own Node application and Vite dev server. PostgreSQL and Redis run once in the original project and are shared. The page shows the application's hostname and a database counter, so you can see separate code using the same data.

## Requirements

- Docker Engine 28+ and Docker Compose 2.24.4+ (`!reset` and `!override` support).
- Git and a Kool build containing workspace/global-proxy support. While this feature is unreleased, build `feature/workspace-proxy` from [kool-dev/kool](https://github.com/kool-dev/kool) with `go build -o /your/bin/kool .`, and put that binary on your `PATH`. An older release will not understand this configuration.
- Available host ports 80 and 3001, or an existing Kool-managed proxy listening on them. Do not start a second reverse proxy on these ports.
- Rift is optional. No host Node/npm installation is needed for the Docker workflow.

Demo credentials are for local development only. Do not deploy this stack as-is. Use a browser/resolver that supports `*.localhost` (otherwise add the exact demo and workspace hosts to your hosts file).

## 1. Start the original project

```bash
git clone https://github.com/kool-dev/kool-worktree-example.git
cd kool-worktree-example
kool start
kool logs app
```

The app and frontend install their locked dependencies into separate, project-scoped Docker volumes on startup. Wait for the app to report `App listening on :8080` and Vite to report ready. Open **http://demo.localhost**. The HTML comes from the Node app through Caddy; assets and HMR come from **http://demo.localhost:3001**.

Click the counter button. PostgreSQL stores the count; Redis supplies the cache connection shown as `PONG`. Redis is included to demonstrate shared infrastructure, not a queue worker.

## 2. Start a Git worktree

From the original checkout:

```bash
git worktree add ../task-a -b task-a
cd ../task-a
kool start
kool logs app
```

Open **http://task-a.workspace.demo.localhost** after both services are ready. Edit the message in `src/main.js` or styles in `src/style.css` inside `task-a`: Vite updates this workspace's page, not the original page. Edit `server.js` to exercise Node's watch/restart behavior.

Click the counter and refresh the original page: both see the same database count. Files, containers, dependency volumes, and Vite servers are separate; the database is deliberately shared. Workspace selection does not create separate data automatically.

Run tests and build inside the current workspace:

```bash
kool run test
kool run build
kool status
```

Tests execute in the current workspace's app container. These unit tests do not access or modify PostgreSQL. Real integration tests would use whichever database the app is configured to connect to; use a dedicated test database for destructive tests.

You can repeat this with `../task-b` and branch `task-b`. Hostnames use the workspace directory name, not necessarily its Git branch. Kool adds a suffix when Git worktree basenames collide; Compose project names also include a canonical-path hash. Use `kool status` rather than hardcoding container names.

## 3. Rift compatibility

Start the original project first, then create a workspace with your Rift CLI or integration. The committed `.rift.toml` runs:

```toml
version = 1

[[hooks.postcreate]]
run = "kool start"

[[hooks.preremove]]
run = "kool stop"
```

Kool detects the Rift workspace and runs the same `app` and `node` services there. Its URL is `http://<workspace-directory-name>.workspace.demo.localhost`. The hooks automate start after creation and stop before removal; use `kool run test`, `kool logs app`, and `kool status` inside it as usual. A plain Git worktree does not execute Rift hooks, so start and stop it explicitly.

## How the configuration works

- `kool.yml` selects `app` and `node` for workspace starts. Kool uses `--no-deps`, so the original database and cache must already be running.
- `docker-compose.yml` binds `.` into each application's container. In a workspace, `.` is that workspace's directory. Each Compose project owns its dependency and database volumes.
- Both application services join a project-local network and Kool's external global network. The original database/cache have explicit `demo-database` / `demo-cache` aliases on that global network; the app uses those aliases to reach shared infrastructure. Other projects on that network must not reuse these demo aliases.
- Caddy publishes port 80 and forwards to app port 8080. It publishes 3001 and forwards to Vite port 3001. Kool assigns unique backend aliases and registers routes for each hostname, including wildcard hosts by default. No per-worktree host port is needed.
- `KOOL_PROXY_HOST` supplies the context-specific hostname. Compose passes it into the app and Vite as `VITE_PUBLIC_ORIGIN`.
- `vite.config.js` sets the public origin, CORS, allowed host, and the browser-facing HMR hostname/protocol/port. WebSocket upgrades pass through Caddy. The app loads `/@vite/client` and `/src/main.js` from that same workspace origin.

`kool run build` checks the frontend build; this example's Node server intentionally serves development HTML, not the production bundle. Local HTTPS is covered in the Kool guide; enabling it also requires adjusting the origins/CORS and trusting the proxy's local CA.

## Optional: a private database for a feature

If a feature changes schemas or needs independent data, share Redis but run a database in that workspace too. Inside that workspace, add `database` to `workspaces` in `kool.yml`:

```yaml
workspaces:
  - app
  - node
  - database
```

Create `.env.local` there (ignored by Git):

```dotenv
COMPOSE_FILE=docker-compose.yml:compose.private-database.yml
```

Then run `kool start` again. The override changes the app's `DB_HOST` to `database` on its project-local network and removes the database from the shared network, preventing duplicate shared aliases. Its named database volume is scoped to this workspace's Compose project. The new database starts empty; populate it as needed. Retry the page after PostgreSQL becomes ready. Existing shared data is not copied or deleted.

Do not just add a database service while keeping a shared database connection or fixed external volume: that would still share data. Commit this configuration on a feature branch if other users of that branch should get the same isolation. The `:` separator shown is for macOS/Linux/WSL.

## Stop and remove

Inside a Git worktree:

```bash
kool stop
cd ../kool-worktree-example
git worktree remove ../task-a
kool status
```

Save/commit any edits before removing it. Stopping a workspace removes only its containers and proxy routes; the original and other workspaces keep running. Rift's preremove hook performs that stop for Rift workspaces. Named volumes survive stop, including private database data.

From the original project, `kool stop` without service arguments stops its active workspaces before stopping the original stack. It does not stop unrelated Kool projects or remove the shared proxy. Avoid `docker compose down -v` unless you intend to delete this project's volumes.

## Troubleshooting

- **Database unavailable:** start the original project first; check `kool logs database` there. With a private database, check it inside the workspace instead.
- **Blank frontend / HMR failure:** check `kool logs node`, the browser's requests to the workspace host on 3001, and the `VITE_PUBLIC_ORIGIN` passed to both services. Old Vite versions without `allowedHosts` protection should not be used.
- **Address already in use:** Caddy owns the configured listen ports; stop a conflicting non-Kool proxy or change both `kool.yml` and public-origin/HMR configuration together.
- **Old dependencies after a branch switch:** restart that workspace's services; startup runs `npm ci` from its own lockfile.
- **Unknown workspace/proxy config:** verify the Kool binary on `PATH` includes this feature.
- **502 with a long project/workspace name:** the current feature branch can generate a backend DNS alias longer than 63 characters. Use a shorter checkout/workspace directory name until Kool fixes alias length handling.

## Local checks (optional Node 22+)

```bash
npm ci
npm test
npm run build
docker compose config --quiet
COMPOSE_FILE=docker-compose.yml:compose.private-database.yml docker compose config --quiet
```

Live Docker checks also exercised original/worktree routing, a shared counter and
Redis connection, a Vite WebSocket connection and workspace-only reload event,
workspace-local tests/build, the private database override, and stopping a
workspace while retaining the original and unrelated proxy routes. Rift's hook
configuration is included; creation/removal through the Rift CLI has not been
exercised in this verification.
