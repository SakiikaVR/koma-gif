import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const EDGE_PATHS = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
];
const edgePath = EDGE_PATHS.find(existsSync);
if (!edgePath) throw new Error('Microsoft Edge が見つかりません。');

const port = 9333;
const profile = await mkdtemp(join(tmpdir(), 'koma-gif-edge-'));
const edge = spawn(edgePath, [
  '--headless=new',
  '--disable-gpu',
  '--no-first-run',
  `--remote-debugging-port=${port}`,
  `--user-data-dir=${profile}`,
  'http://127.0.0.1:5173',
], { windowsHide: true, stdio: 'ignore' });

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForJson(url, attempts = 40) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return response.json();
    } catch {
      // Browser is still starting.
    }
    await delay(250);
  }
  throw new Error(`DevTools endpoint did not open: ${url}`);
}

let socket;
let nextId = 0;
const pending = new Map();

function command(method, params = {}) {
  const id = ++nextId;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}

try {
  const pages = await waitForJson(`http://127.0.0.1:${port}/json/list`);
  const page = pages.find((item) => item.type === 'page');
  if (!page) throw new Error('テスト対象のページが見つかりません。');

  socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (!message.id || !pending.has(message.id)) return;
    const handler = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) handler.reject(new Error(message.error.message));
    else handler.resolve(message.result);
  });

  await command('Runtime.enable');
  const result = await command('Runtime.evaluate', {
    awaitPromise: true,
    returnByValue: true,
    expression: `(async () => {
      const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      while (document.readyState !== 'complete') await wait(50);
      document.getElementById('load-samples').click();
      const startedLoading = Date.now();
      while (document.querySelectorAll('.slide-card').length !== 5) {
        if (Date.now() - startedLoading > 10000) throw new Error('サンプル5枚を読み込めませんでした');
        await wait(100);
      }

      const setInput = (id, value) => {
        const input = document.getElementById(id);
        input.value = value;
        input.dispatchEvent(new Event('change', { bubbles: true }));
      };
      setInput('width-input', 320);
      setInput('height-input', 320);
      document.querySelector('[data-transition="cut"]').click();
      document.getElementById('export-button').click();

      const startedEncoding = Date.now();
      while (document.getElementById('result').hidden) {
        const error = document.getElementById('error-message').textContent;
        if (error) throw new Error(error);
        if (Date.now() - startedEncoding > 30000) throw new Error('GIF生成がタイムアウトしました');
        await wait(100);
      }

      return {
        title: document.title,
        slides: document.querySelectorAll('.slide-card').length,
        resultSize: document.getElementById('result-size').textContent,
        downloadReady: document.getElementById('download-link').href.startsWith('blob:'),
      };
    })()`,
  });

  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
  }
  const value = result.result.value;
  if (value.slides !== 5 || !value.downloadReady) throw new Error('ブラウザ検証結果が不正です。');
  console.log(JSON.stringify(value, null, 2));
} finally {
  if (socket?.readyState === WebSocket.OPEN) {
    await command('Browser.close').catch(() => {});
    socket.close();
  } else {
    edge.kill();
  }
  await delay(1000);
  try {
    await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 });
  } catch (error) {
    console.warn(`一時ブラウザプロファイルを削除できませんでした: ${error.message}`);
  }
}
