import { test } from 'node:test';
import assert from 'node:assert/strict';
import { page } from '../page.js';

test('HTML loads Vite and HMR from the current workspace, not the source', () => {
  const html = page('http://task-a.workspace.demo.localhost:3001');
  assert.ok(html.includes('http://task-a.workspace.demo.localhost:3001/@vite/client'));
  assert.ok(html.includes('http://task-a.workspace.demo.localhost:3001/src/main.js'));
});

test('rejects non-web origins', () => {
  assert.throws(() => page('javascript:alert(1)'));
});
