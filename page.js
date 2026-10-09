export function page(origin) {
  // Only the configured URL is interpolated; application data is rendered with textContent.
  const url = new URL(origin);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Invalid Vite origin');
  const safe = url.origin.replaceAll('&', '&amp;').replaceAll('"', '&quot;');
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Kool workspace demo</title></head>
<body><main>
<h1>Kool workspace demo</h1>
<p>Edit <code>src/main.js</code> in this workspace to see Vite HMR.</p>
<p id="message"></p><pre id="status">Loading…</pre>
<button id="increment">Increment shared database counter</button>
<p>The counter is shared; the code and Vite server belong to this workspace.</p>
</main>
<script type="module" src="${safe}/@vite/client"></script>
<script type="module" src="${safe}/src/main.js"></script>
</body></html>`;
}
