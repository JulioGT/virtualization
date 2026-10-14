'use strict';
// contract-check.js - checks that your services follow CONTRACT.md.
// Usage:   node contract-check.js <host-or-IP>            (checks ports 3001, 3002, 3003)
//          node contract-check.js <host-or-IP> --agent    (also checks the agent on 9100)
// Runs on any machine that has Node 18 or newer. Only built-in modules are used.
const http = require('http');

const HOST = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'localhost';
const CHECK_AGENT = process.argv.includes('--agent');
let fails = 0;

function req(port, method, path, body, raw, extraHeaders) {
  return new Promise((resolve, reject) => {
    const data = raw !== undefined ? Buffer.from(raw) : body !== undefined ? Buffer.from(JSON.stringify(body)) : null;
    const headers = Object.assign({ 'Content-Type': 'application/json', Connection: 'close' }, extraHeaders || {});
    if (data) headers['Content-Length'] = data.length;
    const t0 = process.hrtime.bigint();
    const r = http.request({ host: HOST, port, method, path, headers, agent: false, timeout: 5000 }, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString();
        let json = null;
        try { json = text ? JSON.parse(text) : null; } catch (e) { json = null; }
        resolve({ status: res.statusCode, headers: res.headers, json, ms: Number(process.hrtime.bigint() - t0) / 1e6 });
      });
    });
    r.on('timeout', () => r.destroy(new Error('timeout after 5 s')));
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

function check(label, cond, detail) {
  console.log('  [' + (cond ? 'PASS' : 'FAIL') + '] ' + label + (cond ? '' : (detail ? '  -> ' + detail : '')));
  if (!cond) fails++;
  return cond;
}
const isNum = x => typeof x === 'number' && isFinite(x);
const show = x => JSON.stringify(x);

async function common(name, port) {
  console.log('\n== ' + name + ' (port ' + port + ') ==');
  let r;
  try { r = await req(port, 'GET', '/health'); }
  catch (e) { check('service answers on port ' + port, false, 'cannot connect (' + (e.code || e.message) + '). Is it running? Does it listen on 0.0.0.0?'); return false; }
  check('GET /health -> 200', r.status === 200, 'got ' + r.status);
  check('/health body has "status":"ok" and "service":"' + name + '"', r.json && r.json.status === 'ok' && r.json.service === name, 'got ' + show(r.json));
  check('CORS header Access-Control-Allow-Origin on responses', r.headers['access-control-allow-origin'] === '*', 'header missing');
  try {
    const o = await req(port, 'OPTIONS', '/health', undefined, undefined, { Origin: 'http://x', 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type' });
    const ah = String(o.headers['access-control-allow-headers'] || '').toLowerCase();
    check('OPTIONS preflight answers 2xx and allows Content-Type', o.status >= 200 && o.status < 300 && ah.includes('content-type'), 'status ' + o.status + ', Allow-Headers=' + show(ah));
  } catch (e) { check('OPTIONS preflight answers 2xx and allows Content-Type', false, e.message); }
  return true;
}

async function product() {
  if (!(await common('product', 3001))) return;
  let r = await req(3001, 'GET', '/products');
  const ok = check('GET /products -> 200 with a list under key "products"', r.status === 200 && r.json && Array.isArray(r.json.products), 'got ' + r.status + ' ' + show(r.json));
  const items = ok ? r.json.products : [];
  check('at least 3 products', items.length >= 3, 'found ' + items.length);
  check('each product has id (string), name (string), price (number > 0)', items.length > 0 && items.every(p => p && typeof p.id === 'string' && typeof p.name === 'string' && isNum(p.price) && p.price > 0), 'wrong fields');
  if (items.length) {
    r = await req(3001, 'GET', '/products/' + items[0].id);
    check('GET /products/<id> -> 200 with that product', r.status === 200 && r.json && r.json.id === items[0].id, 'got ' + r.status + ' ' + show(r.json));
  }
  r = await req(3001, 'GET', '/products/zzz');
  check('GET /products/zzz -> 404 with an "error" message', r.status === 404 && r.json && 'error' in r.json, 'got ' + r.status + ' ' + show(r.json));
}

async function cart() {
  if (!(await common('cart', 3002))) return;
  let r = await req(3002, 'DELETE', '/cart');
  check('DELETE /cart -> 200 with {"items": []}', r.status === 200 && r.json && show(r.json.items) === '[]', 'got ' + r.status + ' ' + show(r.json));
  r = await req(3002, 'POST', '/cart', { productId: 'p1', qty: 2 });
  check('POST /cart {productId,qty} -> 201 with the cart', r.status === 201 && r.json && show(r.json.items) === show([{ productId: 'p1', qty: 2 }]), 'got ' + r.status + ' ' + show(r.json));
  r = await req(3002, 'POST', '/cart', { productId: 'p1', qty: 1 });
  check('adding the same productId again adds to qty (2 + 1 = 3)', r.status === 201 && r.json && show(r.json.items) === show([{ productId: 'p1', qty: 3 }]), 'got ' + r.status + ' ' + show(r.json));
  r = await req(3002, 'POST', '/cart', { productId: 'p2', qty: 0 });
  check('POST with qty 0 -> 400', r.status === 400, 'got ' + r.status);
  r = await req(3002, 'GET', '/cart');
  check('GET /cart -> 200 with the items', r.status === 200 && r.json && Array.isArray(r.json.items) && r.json.items.length === 1, 'got ' + r.status + ' ' + show(r.json));
  await req(3002, 'DELETE', '/cart');
}

async function payment() {
  if (!(await common('payment', 3003))) return;
  let r = await req(3003, 'POST', '/pay', { amount: 19.8, card: '4242424242424242' });
  check('POST /pay valid -> 200 {status:approved, id, amount}', r.status === 200 && r.json && r.json.status === 'approved' && typeof r.json.id === 'string' && r.json.amount === 19.8, 'got ' + r.status + ' ' + show(r.json));
  r = await req(3003, 'POST', '/pay', { amount: 0, card: '4242424242424242' });
  check('POST /pay with amount 0 -> 400 {status:declined, error}', r.status === 400 && r.json && r.json.status === 'declined' && 'error' in r.json, 'got ' + r.status + ' ' + show(r.json));
  r = await req(3003, 'POST', '/pay', undefined, '{not json');
  check('POST /pay with broken JSON -> 400', r.status === 400, 'got ' + r.status);
  const times = [];
  for (let i = 0; i < 3; i++) times.push((await req(3003, 'POST', '/pay', { amount: 5, card: '4242' })).ms);
  const best = Math.min(...times);
  check('each /pay takes at least 25 ms (simulated CPU work, see CONTRACT.md); fastest was ' + best.toFixed(0) + ' ms', best >= 25, 'no simulated work: load tests will not reach 80% CPU');
}

async function agent() {
  if (!(await common('agent', 9100))) return;
  const r = await req(9100, 'GET', '/metrics');
  const ok = r.status === 200 && r.json && typeof r.json === 'object';
  check('GET /metrics -> 200', ok, 'got ' + r.status);
  if (ok) {
    const j = r.json;
    check('cpuPct is a number from 0 to 100', isNum(j.cpuPct) && j.cpuPct >= 0 && j.cpuPct <= 100, 'got ' + show(j.cpuPct));
    check('memPct is a number from 0 to 100', isNum(j.memPct) && j.memPct >= 0 && j.memPct <= 100, 'got ' + show(j.memPct));
    check('load1 and cores are numbers, host is a string', isNum(j.load1) && isNum(j.cores) && typeof j.host === 'string', 'got ' + show(j));
  }
}

(async () => {
  console.log('Checking services on ' + HOST + ' ...');
  await product(); await cart(); await payment();
  if (CHECK_AGENT) await agent();
  console.log();
  console.log(fails === 0 ? 'RESULT: ALL CHECKS PASSED' : 'RESULT: ' + fails + ' check(s) FAILED. Read the -> hints above.');
  process.exit(fails ? 1 : 0);
})();
