var WebSocketServer = require('ws').Server;
var wss = new WebSocketServer({port: 8000});
wss.on('connection', function(ws) {
	//console.log(ws);
    ws.on('message', function(message) {
        console.log('received: %s', message);
        wss.broadcast(message);
    });
    ws.send('something');
    //wss.broadcast('000');

});

wss.broadcast = function(data) {
  wss.clients.forEach(function(client) {
    client.send(data);
  });
};

var express = require('express');
var app = express();

app.get('/', function (req, res) {
   res.send('Hello World');
})

app.get('/index', function (req, res) {
	console.log(__dirname);
   res.sendFile(__dirname+"/client.html" );
})

app.get('/audio', function (req, res) {
   res.sendFile(__dirname+"/audio.html" );
})

var server = app.listen(8081, function () {

  var host = server.address().address
  var port = server.address().port

  console.log("应用实例，访问地址为 http://%s:%s", host, port)

})