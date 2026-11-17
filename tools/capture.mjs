// Glimmerdeep — screenshot capture. Drives headless Chromium over the
// DevTools protocol, opens each deterministic shot scene (?shot=...&seed=...)
// from the game's own files, waits for it to report ready, and saves it as a
// JPEG that fits the gate's 256 KiB cap. Fails loudly on any page error or
// console error, so a screenshot never hides a broken game. Standard library
// only:
//   CHROME=/path/to/chrome CHROME_ARGS="--flag ..." node tools/capture.mjs
// CHROME_ARGS carries extra launch flags (this VM's Chromium needs its WebGL
// domain-policy switches); shots come from shots.json. Pages load from
// file:// with --allow-file-access-from-files because this VM's hardened
// Chromium blocks loopback navigation; the game itself is served over plain
// HTTP by tools/serve.mjs and behaves the same either way.

import { spawn } from 'node:child_process';
import { readFile, writeFile, mkdir, mkdtemp } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repoRoot = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const gameIndex = join(repoRoot, 'game', 'index.html');
const shotsPath = join(repoRoot, 'shots.json');
const outDir = join(repoRoot, 'screenshots');
const CHROME = process.env.CHROME || '/opt/meta-chromium/chrome';
const EXTRA_ARGS = (process.env.CHROME_ARGS || '').split(/\s+/).filter(Boolean);
const DEBUG_PORT = 9223;
const MAX_BYTES = 262144;
const VIEW = { width: 1280, height: 720 };

async function waitForDebugger(timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/version`);
      if (res.ok) return;
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('Chromium DevTools endpoint did not come up');
}

function parseJpegSize(buffer) {
  let off = 2;
  while (off + 9 < buffer.length) {
    if (buffer[off] !== 0xff) break;
    const marker = buffer[off + 1];
    if (marker >= 0xc0 && marker <= 0xc3) {
      return { height: buffer.readUInt16BE(off + 5), width: buffer.readUInt16BE(off + 7) };
    }
    const len = buffer.readUInt16BE(off + 2);
    off += 2 + len;
  }
  return null;
}

class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.nextId = 1;
    this.pending = new Map();
    this.events = [];
    ws.addEventListener('message', (message) => {
      const data = JSON.parse(String(message.data));
      if (data.id && this.pending.has(data.id)) {
        const { resolve, reject } = this.pending.get(data.id);
        this.pending.delete(data.id);
        if (data.error) reject(new Error(data.error.message));
        else resolve(data.result);
      } else if (data.method) {
        this.events.push(data);
      }
    });
  }

  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate(expression) {
    const result = await this.send('Runtime.evaluate', { expression, returnByValue: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
    return result.result.value;
  }
}

async function main() {
  const shots = JSON.parse(await readFile(shotsPath, 'utf8'));
  await mkdir(outDir, { recursive: true });
  const profile = await mkdtemp(join(tmpdir(), 'glimmerdeep-chrome-'));
  const chrome = spawn(CHROME, [
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu',
    '--disable-dev-shm-usage',
    '--no-first-run',
    '--no-default-browser-check',
    '--hide-scrollbars',
    '--force-device-scale-factor=1',
    '--allow-file-access-from-files',
    `--window-size=${VIEW.width},${VIEW.height}`,
    `--remote-debugging-port=${DEBUG_PORT}`,
    '--remote-allow-origins=*',
    `--user-data-dir=${profile}`,
    ...EXTRA_ARGS,
    'about:blank',
  ], { stdio: 'ignore' });

  const problems = [];
  try {
    await waitForDebugger(30000);
    const targets = await (await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`)).json();
    const page = targets.find((t) => t.type === 'page');
    if (!page) throw new Error('no page target');
    const ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      ws.addEventListener('open', resolve);
      ws.addEventListener('error', reject);
    });
    const cdp = new Cdp(ws);
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Log.enable');
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: VIEW.width, height: VIEW.height, deviceScaleFactor: 1, mobile: false,
    });

    for (const shot of shots) {
      const url = pathToFileURL(gameIndex).href + shot.query;
      cdp.events.length = 0;
      await cdp.send('Page.navigate', { url });
      const deadline = Date.now() + 20000;
      let ready = false;
      while (Date.now() < deadline) {
        const error = await cdp.evaluate('window.__shotError || null').catch(() => null);
        if (error) throw new Error(`${shot.name}: page reported ${error}`);
        ready = await cdp.evaluate('window.__shotReady === true').catch(() => false);
        if (ready) break;
        await new Promise((r) => setTimeout(r, 200));
      }
      if (!ready) throw new Error(`${shot.name}: shot never reported ready`);
      for (const event of cdp.events) {
        if (event.method === 'Runtime.exceptionThrown') {
          problems.push(`${shot.name}: exception ${JSON.stringify(event.params.exceptionDetails.text)}`);
        }
        if (event.method === 'Runtime.consoleAPICalled' && event.params.type === 'error') {
          problems.push(`${shot.name}: console.error ${JSON.stringify(event.params.args)}`);
        }
        if (event.method === 'Log.entryAdded' && event.params.entry.level === 'error') {
          problems.push(`${shot.name}: log error ${event.params.entry.text} (${event.params.entry.url || ''})`);
        }
      }
      let buffer = null;
      for (const quality of [85, 75, 65, 55, 45]) {
        const shotResult = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality });
        buffer = Buffer.from(shotResult.data, 'base64');
        if (buffer.length <= MAX_BYTES) break;
      }
      if (!buffer || buffer.length > MAX_BYTES) throw new Error(`${shot.name}: JPEG still ${buffer?.length} bytes over the cap`);
      const size = parseJpegSize(buffer);
      if (!size || size.width !== VIEW.width || size.height !== VIEW.height) {
        throw new Error(`${shot.name}: unexpected dimensions ${JSON.stringify(size)}`);
      }
      await writeFile(join(outDir, shot.name), buffer);
      console.log(`${shot.name}: ${buffer.length} bytes, ${size.width}x${size.height}`);
    }
    ws.close();
  } finally {
    chrome.kill('SIGKILL');
  }
  if (problems.length > 0) {
    console.error('PAGE PROBLEMS:');
    for (const problem of problems) console.error(` - ${problem}`);
    process.exitCode = 1;
  } else {
    console.log('All shots captured with no page errors.');
  }
}

main().catch((err) => {
  console.error(`capture failed: ${err.message}`);
  process.exit(1);
});
