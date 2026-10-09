import { createServer } from 'node:http';
import pg from 'pg';
import { createClient } from 'redis';
import { page } from './page.js';

const database = new pg.Pool({
  host: process.env.DB_HOST || 'demo-database',
  database: 'demo', user: 'demo', password: 'demo',
  connectionTimeoutMillis: 3000,
});
const cache = createClient({ url: process.env.REDIS_URL || 'redis://demo-cache:6379' });
cache.on('error', error => console.error('Redis:', error.message));
cache.connect().catch(error => console.error(error.message));

async function counter(increment = false) {
  await database.query('CREATE TABLE IF NOT EXISTS counter (id integer PRIMARY KEY, value integer NOT NULL)');
  await database.query('INSERT INTO counter VALUES (1, 0) ON CONFLICT DO NOTHING');
  const { rows } = await database.query(increment
    ? 'UPDATE counter SET value = value + 1 WHERE id = 1 RETURNING value'
    : 'SELECT value FROM counter WHERE id = 1');
  return rows[0].value;
}

createServer(async (request, response) => {
  try {
    if (request.url === '/' && request.method === 'GET') {
      response.setHeader('Content-Type', 'text/html; charset=utf-8');
      response.end(page(process.env.VITE_PUBLIC_ORIGIN || 'http://demo.localhost:3001'));
    } else if (request.url === '/api/status' && request.method === 'GET') {
      const value = await counter();
      const redis = cache.isReady ? await cache.ping() : 'connecting';
      response.setHeader('Content-Type', 'application/json');
      response.end(JSON.stringify({ host: process.env.APP_HOST, database: process.env.DB_HOST, counter: value, redis }));
    } else if (request.url === '/api/increment' && request.method === 'POST') {
      response.setHeader('Content-Type', 'application/json');
      response.end(JSON.stringify({ counter: await counter(true) }));
    } else {
      response.writeHead(404).end('Not found');
    }
  } catch (error) {
    console.error(error);
    response.writeHead(503, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ error: 'Infrastructure not ready; try again shortly.' }));
  }
}).listen(8080, '0.0.0.0', () => console.log('App listening on :8080'));
