const http = require('http');

console.log('Testing server connectivity...');

const port = process.env.PORT || 3080;
console.log('Testing server on port:', port);

const req = http.request({
  hostname: 'localhost',
  port: port,
  path: '/api/health',
  method: 'GET',
  timeout: 5000
}, (res) => {
  console.log(`Server responded with status: ${res.statusCode}`);
  res.on('data', (chunk) => {
    console.log('Response:', chunk.toString());
  });
});

req.on('error', (err) => {
  console.log('Server connection failed:', err.message);
});

req.on('timeout', () => {
  console.log('Server connection timed out');
  req.destroy();
});

req.end(); 