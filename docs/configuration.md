# Configuration

`kool.yml` selects `app` and `node` for workspace starts. Kool uses `--no-deps`, so start the original database and cache first. `docker-compose.yml` mounts the current directory into each app; dependency and database volumes belong to its Compose project.

The apps join project-local and global networks. Shared PostgreSQL and Redis use the global aliases `demo-database` and `demo-cache`. Keep these aliases unique across projects. Redis is a shared backend, not a queue worker.

Caddy routes port 80 to app port 8080 and port 3001 to Vite. Kool gives each backend a unique alias and registers its hostname and wildcard routes. Git worktrees with duplicate directory names get hostname suffixes; Compose project names include a canonical-path hash.

Compose passes `KOOL_PROXY_HOST` to both services through `VITE_PUBLIC_ORIGIN`. `vite.config.js` sets the asset origin, CORS, allowed host, and HMR hostname/protocol/port. The app loads `/@vite/client` and `/src/main.js` from that origin; Caddy forwards WebSocket upgrades.

`kool run build` checks the frontend build. The Node server serves development HTML, not the production bundle. For local HTTPS, follow the Kool guide, adjust origins/CORS, and trust the proxy's local CA.

## Private database

For independent data, add `database` to `workspaces` in that workspace's `kool.yml`:

```yaml
workspaces:
  - app
  - node
  - database
```

Create an ignored `.env.local` there:

```dotenv
COMPOSE_FILE=docker-compose.yml:compose.private-database.yml
```

Run `kool start` again and wait for PostgreSQL. The override points `DB_HOST` at `database` on the project-local network and removes its shared-network alias. Its project-scoped volume starts empty; shared data is neither copied nor deleted. Redis stays shared.

Selecting a database service alone does not isolate data. Its connection and storage must also be separate; avoid the original connection string or a fixed external volume. Commit the configuration on your feature branch if others should use it too. The `:` file separator above is for macOS/Linux/WSL.

Named volumes survive `kool stop`. Use `docker compose down -v` only when you intend to delete the project's volumes.

## Troubleshooting

- Database unavailable: start the original project and check `kool logs database` there. For a private database, check inside its workspace.
- Frontend or HMR failure: check `kool logs node`, browser requests on port 3001, and both services' `VITE_PUBLIC_ORIGIN`. Keep Vite's `allowedHosts` protection enabled.
- Port conflict: stop the conflicting non-Kool proxy, or change the listen ports and public-origin/HMR settings together.
- Dependencies changed: restart the workspace services to run `npm ci` from its lockfile.
- Unknown workspace/proxy config: check that the Kool binary on `PATH` supports this feature.
- 502 with long names: the current feature branch can generate backend DNS aliases over 63 characters. Use shorter project/workspace directory names until alias length handling is fixed.

## Local checks

With Node 22+:

```bash
npm ci
npm test
npm run build
docker compose config --quiet
COMPOSE_FILE=docker-compose.yml:compose.private-database.yml docker compose config --quiet
```

Live Docker checks covered routing, shared PostgreSQL/Redis, Vite WebSocket reloads confined to one workspace, workspace tests/build, private data, and stop cleanup without removing unrelated routes. Rift CLI creation/removal remains untested.
