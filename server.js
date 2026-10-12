const http = require('http');

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');   // lets the browser page read the reply
  res.setHeader('Content-Type', 'application/json');

  if (req.url === '/api/hello') {
    res.end(JSON.stringify({
      message: 'Hello from the Ubuntu VM',
      time: new Date().toISOString(),
      clientIp: req.socket.remoteAddress
    }));
  } else {
    res.statusCode = 404;
    res.end(JSON.stringify({ error: 'not found' }));
  }
});

server.listen(3000, '0.0.0.0', () => console.log('Listening on port 3000'));