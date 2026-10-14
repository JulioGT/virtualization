'use strict';
// serve.js - serves the files of a folder over HTTP (plain static web server).
// Usage:  node serve.js [port] [folder]      Example:  node serve.js 8080 web
const http = require('http');
const fs = require('fs');
const path = require('path');

const port = Number(process.argv[2]) || 8080;
const root = path.resolve(process.argv[3] || '.');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.json': 'application/json', '.txt': 'text/plain; charset=utf-8' };

http.createServer((req, res) => {
  const urlPath = decodeURIComponent(req.url.split('?')[0]);
  const file = path.join(root, path.normalize(urlPath));
  if (!file.startsWith(root)) { res.writeHead(403); return res.end('forbidden'); }
  fs.stat(file, (err, st) => {
    if (err) { res.writeHead(404); return res.end('not found'); }
    if (st.isDirectory()) {
      if (fs.existsSync(path.join(file, 'index.html'))) return send(path.join(file, 'index.html'));
      const names = fs.readdirSync(file).map(n => '<li><a href="' + path.posix.join(urlPath, n) + '">' + n + '</a></li>').join('');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end('<h1>Directory listing for ' + urlPath + '</h1><ul>' + names + '</ul>');
    }
    send(file);
  });
  function send(f) {
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    fs.createReadStream(f).pipe(res);
    console.log(new Date().toTimeString().slice(0, 8) + ' GET ' + req.url);
  }
}).on('error', e => { console.error(e.code === 'EADDRINUSE' ? 'port ' + port + ' is already in use' : e.message); process.exit(1); })
  .listen(port, '0.0.0.0', () => console.log('serving ' + root + ' on 0.0.0.0:' + port));
