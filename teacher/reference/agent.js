'use strict';
// agent - port 9100 - reports THIS VM's real CPU and memory use.  run:  node agent.js
// Reads /proc (Linux only): CPU from /proc/stat, memory from /proc/meminfo, load from /proc/loadavg.
const fs = require('fs');
const os = require('os');
const { run } = require('./svc');

function readCpu() {
  const parts = fs.readFileSync('/proc/stat', 'utf8').split('\n')[0].trim().split(/\s+/).slice(1).map(Number);
  const idle = parts[3] + (parts[4] || 0); // idle + iowait
  return { idle, total: parts.reduce((a, b) => a + b, 0) };
}

let cpuPct = 0;
let prev = readCpu();
setInterval(() => {
  const cur = readCpu();
  const dTotal = cur.total - prev.total, dIdle = cur.idle - prev.idle;
  cpuPct = dTotal > 0 ? Math.round(1000 * (1 - dIdle / dTotal)) / 10 : 0;
  prev = cur;
}, 1000);

function memPct() {
  const m = {};
  for (const line of fs.readFileSync('/proc/meminfo', 'utf8').split('\n')) {
    const [k, v] = line.split(':');
    if (v) m[k] = parseInt(v, 10);
  }
  return Math.round(1000 * (1 - m.MemAvailable / m.MemTotal)) / 10;
}

run('agent', 9100, 0, (method, path) => {
  if (method === 'GET' && path === '/metrics') {
    const load1 = parseFloat(fs.readFileSync('/proc/loadavg', 'utf8').split(' ')[0]);
    return [200, { host: os.hostname(), cpuPct, memPct: memPct(), load1, cores: os.cpus().length }];
  }
  return [404, { error: 'not found' }];
});
