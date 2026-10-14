'use strict';
// svc.js - tiny shared helper for the reference services (Node.js built-in modules only).
const http = require('http');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// Keep the CPU busy for about `ms` milliseconds. Node runs your code on ONE thread,
// so while a request is "burning", this process serves nothing else.
function burn(ms) {
  const end = process.hrtime.bigint() + BigInt(Math.round(ms * 1e6));
  while (process.hrtime.bigint() < end) { /* busy */ }
}

const pad = (s, n) => String(s).padEnd(n);
const clock = () => new Date().toTimeString().slice(0, 8);

// handle(method, path, body) -> [statusCode, object]. body is an object, or null if empty.
function run(name, defaultPort, costMs, handle) {
  const port = process.argv[2] ? Number(process.argv[2]) : defaultPort;

  const server = http.createServer((req, res) => {
    const path = req.url.split('?')[0];
    const send = (status, payload) => {
      const data = JSON.stringify(payload);
      res.writeHead(status, Object.assign({ 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }, CORS));
      res.end(data);
      console.log(clock() + ' ' + pad(req.method, 6) + ' ' + pad(req.url, 22) + ' ' + status);
    };
    if (req.method === 'OPTIONS') {
      res.writeHead(204, Object.assign({ 'Content-Length': 0 }, CORS));
      return res.end();
    }
    if (path === '/health') return send(200, { service: name, status: 'ok' });
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => {
      let body = null;
      const raw = Buffer.concat(chunks).toString();
      if (raw) {
        try { body = JSON.parse(raw); } catch (e) { return send(400, { error: 'invalid JSON' }); }
      }
      burn(costMs);
      let result;
      try { result = handle(req.method, path, body); }
      catch (e) { result = [500, { error: String(e && e.message) }]; } // never crash on a bad request
      send(result[0], result[1]);
    });
  });

  server.on('error', e => {
    console.error(e.code === 'EADDRINUSE'
      ? name + ': port ' + port + ' is already in use. Is an old copy still running?  (pkill -f ' + name + '.js)'
      : name + ': ' + e.message);
    process.exit(1);
  });
  server.listen(port, '0.0.0.0', () =>
    console.log(name + ' listening on 0.0.0.0:' + port + ' (about ' + costMs + ' ms of CPU per request)'));
}

module.exports = { run, burn };
