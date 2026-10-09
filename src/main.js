import './style.css';

document.querySelector('#message').textContent = 'Hello from this workspace!';
const status = document.querySelector('#status');
async function refresh() {
  const response = await fetch('/api/status');
  status.textContent = JSON.stringify(await response.json(), null, 2);
}
document.querySelector('#increment').onclick = async () => {
  await fetch('/api/increment', { method: 'POST' });
  await refresh();
};
refresh().catch(error => { status.textContent = error.message; });
