'use strict';
// load.js - sends a steady number of requests per second to one URL and reports what happened.
// Run it from ANOTHER VM (or the laptop), not from the VM you are measuring.
// Examples:
//   node load.js http://192.168.64.5:3003/pay --rps 10 --seconds 20            (POST, payment body)
//   node load.js http://192.168.64.5:3001/products --method GET --rps 30 --seconds 20
// Press Ctrl+C to stop early. Only built-in modules are used.
const http = require('http');

const argv = process.argv.slice(2);
const url = argv.find(a => a.startsWith('http'));
const opt = (name, def) => { const i = argv.indexOf('--' + name); return i >= 0 ? argv[i + 1] : def; };
if (!url) { console.error('usage: node load.js URL [--rps N] [--seconds S] [--method GET|POST] [--timeout 3]'); process.exit(2); }
const rps = Number(opt('rps', 10)), seconds = Number(opt('seconds', 20)), method = opt('method', 'POST').toUpperCase(), timeoutMs = Number(opt('timeout', 3)) * 1000;
const u = new URL(url);
const BODY = method === 'POST' ? JSON.stringify({ amount: 9.9, card: '4242424242424242' }) : null;
const agent = new http.Agent({ keepAlive: false, maxSockets: Infinity });

let bucket = { ok: 0, err: 0, lat: [] }, total = { ok: 0, err: 0 };

function fire() {
  const t0 = process.hrtime.bigint();
  let done = false;
  const finish = good => {
    if (done) return; done = true;
    if (good) { bucket.ok++; bucket.lat.push(Number(process.hrtime.bigint() - t0) / 1e6); } else bucket.err++;
  };
  const headers = { 'Content-Type': 'application/json' };
  if (BODY) headers['Content-Length'] = Buffer.byteLength(BODY);
  const r = http.request({ host: u.hostname, port: u.port || 80, path: u.pathname + u.search, method, headers, agent, timeout: timeoutMs }, res => {
    res.resume();
    res.on('end', () => finish(res.statusCode < 400));
  });
  r.on('timeout', () => { r.destroy(); finish(false); });
  r.on('error', () => finish(false));
  if (BODY) r.write(BODY);
  r.end();
}

console.log('sending ' + rps.toFixed(1) + ' req/s to ' + url + ' for ' + seconds + ' s');
console.log('second  ok/s  err/s  p95 latency');
const start = Date.now();
let sent = 0, sec = 0;
const tick = setInterval(() => {
  const elapsed = (Date.now() - start) / 1000;
  while (sent < elapsed * rps) { fire(); sent++; }
}, 5);
const report = setInterval(() => {
  sec++;
  const lat = bucket.lat.sort((a, b) => a - b);
  const p95 = lat.length ? lat[Math.floor(0.95 * (lat.length - 1))] : 0;
  console.log(String(sec).padStart(6) + '  ' + String(bucket.ok).padStart(4) + '  ' + String(bucket.err).padStart(5) + '  ' + p95.toFixed(0).padStart(7) + ' ms');
  total.ok += bucket.ok; total.err += bucket.err;
  bucket = { ok: 0, err: 0, lat: [] };
  if (sec >= seconds) stop();
}, 1000);
function stop() { clearInterval(tick); clearInterval(report); console.log('done: ' + total.ok + ' ok, ' + total.err + ' errors'); process.exit(0); }
process.on('SIGINT', stop);
