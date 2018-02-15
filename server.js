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

app.get('/slave', function (req, res) {
  res.sendFile(path.join(__dirname, 'client', 'slave.html'));
});

// ----------------------------------------------------------------------------------------

const wss = new WebSocketServer({server: httpsServer, clientTracking: true});
var networks = {};

wss.on('connection', function(ws) {
  
  ws.on('error', (e) => { if(e.code != 'ECONNRESET') console.log(e); });

  ws.uuid = -99;
  ws.on('message', function(message) {
    var signal = JSON.parse(message);
    if(signal.identify) { ws.uuid = signal.uuid; return; }

    console.log("MESSAGE: " + signal);
    console.log("Master in message: " + signal.master);

    // this message is from a slave
    if(signal.master){
      // if this is not the first message to the master
      if(signal.master in networks) {
        console.log("NOT the first message from slave.");
        var slaves = networks[signal.master];
        // if this is a new slave
        if(slaves.indexOf(signal.uuid) == -1) networks[signal.master].push(signal.uuid);
      } 
      // this is the first message from the slave, establish master<-->slave link
      else {
        console.log("First message from slave.");
        networks[signal.master] = [signal.uuid];
      }

      console.log(networks);

      // forward the message to the master
      var client_array = Array.from(wss.clients);
      console.log("Clients: " + client_array);
      client_array.forEach(cl => console.log(cl.uuid));

      var master = Array.from(wss.clients).filter(client => client.uuid == signal.master)[0];
      console.log("Master: " + master);
      if(master && master.readyState === WebSocket.OPEN) master.send(message);
      else console.log("Master not found!");
    }
    // this message is from a master
    else {
      // forward the message to all slaves
      console.log("Master uuid: " + signal.uuid);
      console.log("networks: " + networks);
      networks[signal.uuid].forEach(function each(slave) {
        var slave_ws = Array.from(wss.clients).filter(client => client.uuid == slave)[0];
        console.log(slave_ws);
        if(slave_ws && slave_ws.readyState === WebSocket.OPEN) slave_ws.send(message);
        else console.log("Slave not found!");
      });
    }
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
