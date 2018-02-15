const HTTPS_PORT = 8443;

const fs = require('fs');
const https = require('https');
const WebSocket = require('ws');
const WebSocketServer = WebSocket.Server;
const express = require('express');
const url_shortener_api_key = "AIzaSyCH3za-88u0uxeA7LyiWutFaKMe3FZJlcs";

// Yes, TLS is required
const serverConfig = {
  key: fs.readFileSync('key.pem'),
  cert: fs.readFileSync('cert.pem'),
};

// ----------------------------------------------------------------------------------------

var app = express();
var path = require('path');
var httpsServer = https.createServer(serverConfig, app).listen(HTTPS_PORT, '0.0.0.0');

var redis = require("redis");
var redis_client = redis.createClient();

redis_client.on('error', function (err) {
  console.log('Error ' + err)
})

process.on('SIGTERM', function() {
    redis_client.quit();
    process.exit();
});

process.on('SIGINT', function() {
    redis_client.quit();
    process.exit();
});

app.use(express.static( __dirname + '/client'));

app.get('/', function (req, res) {
  res.sendFile(path.join(__dirname, 'client', 'index.html'));
});

app.get('/master', function (req, res) {
  res.sendFile(path.join(__dirname, 'client', 'master.html'));
});

// ----------------------------------------------------------------------------------------

const wss = new WebSocketServer({server: httpsServer});
var networks = {};

wss.on('connection', function(ws) {
  ws.on('message', function(message) {
    // Broadcast any received message to all clients
    console.log('received: %s', message);
    wss.broadcast(message);
  });
});

wss.broadcast = function(data) {
  this.clients.forEach(function(client) {
    if(client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  });
};


// -------------------------------------------------
// Ensures that there are no hanging ws connections
function noop() {}

function heartbeat() {
  this.isAlive = true;
}

wss.on('connection', function connection(ws) {
  ws.isAlive = true;
  ws.on('pong', heartbeat);
});

const interval = setInterval(function ping() {
  wss.clients.forEach(function each(ws) {
    if (ws.isAlive === false) return ws.terminate();

    ws.isAlive = false;
    ws.ping(noop);
  });
}, 30000);

// -------------------------------------------------

console.log('Server running. Visit https://localhost:' + HTTPS_PORT + ' in Firefox/Chrome.\n\n\
Some important notes:\n\
  * Note the HTTPS; there is no HTTP -> HTTPS redirect.\n\
  * You\'ll also need to accept the invalid TLS certificate.\n\
  * Some browsers or OSs may not allow the webcam to be used by multiple pages at once. You may need to use two different browsers or machines.\n'
);
