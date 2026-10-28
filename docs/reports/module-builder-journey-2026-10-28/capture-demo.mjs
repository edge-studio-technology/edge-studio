import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const report = path.dirname(fileURLToPath(import.meta.url));
const images = path.join(report, 'screenshots');
await mkdir(images, { recursive: true });
const port = 9397;
const browser = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', [
  '--headless=new', '--disable-gpu', '--disable-background-networking', '--disable-sync',
  '--disable-extensions', '--no-first-run', '--no-default-browser-check',
  `--remote-debugging-port=${port}`, '--remote-debugging-address=127.0.0.1',
  `--user-data-dir=${path.join(report, 'capture-state', String(Date.now()))}`, 'about:blank',
], { windowsHide: true, stdio: 'ignore' });
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
let socket;
const errors = [];
const backendRequests = [];
try {
  for (let attempt = 0; attempt < 100; attempt++) {
    try { await fetch(`http://127.0.0.1:${port}/json/version`); break; } catch { await delay(100); }
  }
  const target = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json();
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  let nextId = 0;
  const pending = new Map();
  socket.onmessage = event => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const promise = pending.get(message.id); pending.delete(message.id);
      message.error ? promise.reject(message.error) : promise.resolve(message.result);
    }
    if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.text);
    if (message.method === 'Network.requestWillBeSent' && /\/api\//.test(message.params.request.url)) backendRequests.push(message.params.request.url);
  };
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++nextId; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params }));
  });
  async function evaluate(expression) {
    const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  }
  async function wait(expression) {
    for (let attempt = 0; attempt < 100; attempt++) { if (await evaluate(expression)) return; await delay(100); }
    throw new Error(`Timed out: ${expression}`);
  }
  async function click(selector) {
    await wait(`!!document.querySelector(${JSON.stringify(selector)})`);
    await evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
  }
  async function button(label) {
    await wait(`[...document.querySelectorAll('button')].some(e=>e.textContent.trim().startsWith(${JSON.stringify(label)}))`);
    await evaluate(`(()=>{const buttons=[...document.querySelectorAll('button')];(buttons.find(e=>e.textContent.trim()===${JSON.stringify(label)})||buttons.find(e=>e.textContent.trim().startsWith(${JSON.stringify(label)}))).click();})()`);
  }
  async function select(selector, value) {
    await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  }
  async function screenshot(name, selector) {
    await evaluate(`document.querySelectorAll('[aria-label="Close notification"]').forEach(e=>e.click())`);
    await delay(200);
    const clip = selector ? await evaluate(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:Math.max(0,r.x-8),y:Math.max(0,r.y-8)+scrollY,width:Math.min(innerWidth-Math.max(0,r.x-8),r.width+16),height:r.height+16,scale:1};})()`) : { x: 224, y: 98, width: 1216, height: 802, scale: 1 };
    const result = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip });
    await writeFile(path.join(images, `${name}.png`), Buffer.from(result.data, 'base64'));
  }
  await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
  await send('Browser.setDownloadBehavior', { behavior: 'deny' });
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: 'http://127.0.0.1:3042/demo/modules' });
  await wait(`document.querySelector('h1')?.textContent==='Module builder'`);
  await screenshot('01-local-workspace');
  await button('Create module'); await screenshot('02-template-selection', '[role="dialog"]'); await button('Cancel');
  await button('Drafts'); await click('a[href="/demo/modules/editor/greenhouse-monitor"]');
  await wait(`!!document.querySelector('[aria-label="Edit src/index.ts"]')`);
  await button('AI-assisted creation'); await screenshot('03-ai-harness-handoff', '[role="dialog"]'); await button('Back to editor');
  await screenshot('04-edit-and-preview');
  await select('[aria-label="Preview surface"]', 'Device setup');
  await screenshot('05-device-schema-preview', 'aside:has([aria-label="Preview surface"])');
  await select('[aria-label="Preview surface"]', 'Hardware support');
  await screenshot('06-hardware-preview', 'aside:has([aria-label="Preview surface"])');
  await select('[aria-label="Preview surface"]', 'Block preview');
  await button('Test sample'); await button('Validate draft'); await button('Package demo module');
  await screenshot('07-validated-package');
  await button('Activate locally'); await screenshot('08-backup-before-activation', '[role="dialog"]'); await button('Activate demo version');
  await click('a[href="/demo/modules"]'); await wait(`!!document.querySelector('[aria-label="Activate Greenhouse Monitor"]')`);
  await screenshot('09-local-activation');
  await button('Import module'); await screenshot('10-local-import-export', '[role="dialog"]'); await button('Cancel');
  await button('Drafts'); await click('a[href="/demo/modules/editor/greenhouse-monitor"]');
  await button('Validate draft'); await button('Package demo module'); await button('Publish · Phase 2');
  await click('[role="dialog"] input[type="checkbox"]:not(:checked)');
  await screenshot('11-publishing-checks', '[role="dialog"]');
  await button('Publish demo listing'); await button('View in library');
  await wait(`document.querySelector('h1')?.textContent==='Greenhouse Monitor'`);
  await screenshot('12-community-listing', 'div.mx-auto.max-w-\\[1180px\\]');
  await button('Source'); await select('[aria-label="Release source file"]', 'src/index.ts');
  await screenshot('13-release-source', 'section:has([aria-label="Release source"])');
  await click('a[href="/demo/library"]'); await wait(`!!document.querySelector('[aria-label="Search library"]')`);
  await evaluate('window.scrollTo(0,0)');
  const library = await send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: 1440, height: 900, scale: 1 } });
  await writeFile(path.join(images, '14-library-discovery.png'), Buffer.from(library.data, 'base64'));
  await click('a[href="/demo/library/gpio"]'); await button('Preview purchase'); await screenshot('15-paid-module-concept', '[role="dialog"]');
  await button('Record demo purchase'); await button('Add to Edge Studio'); await screenshot('16-install-trust-and-backup', '[role="dialog"]');
  if (errors.length || backendRequests.length) throw new Error(JSON.stringify({ errors, backendRequests }));
  console.log(JSON.stringify({ screenshots: 16, errors, backendRequests, folder: images }, null, 2));
} finally {
  if (socket) socket.close();
  browser.kill();
}
