var express = require('express');
var app = express();

//https server
var https = require('https');
var fs = require('fs');

//http server
var http = require('http');

//https server options
var options = {
    key: fs.readFileSync(__dirname+'/keys/server.key'),
    cert: fs.readFileSync(__dirname+'/keys/server.crt')
};

//静态资源
app.use(express.static('public'));

//cookies and session
var cookieParser = require('cookie-parser');
app.use(cookieParser());

var session = require('express-session');
// session store
var store = new session.MemoryStore();
var sessionOption = {
  secret: '123',
  resave: false,
  saveUninitialized: true,
  store:store,
  
};
app.use(session(sessionOption));

//接收参数
var bodyParser = require('body-parser');
//var multer = require('multer'); 
app.use(bodyParser.json()); // for parsing application/json
app.use(bodyParser.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded
//app.use(multer()); // for parsing multipart/form-data

/**
 * routes
 */
app.get('/', function (req, res) {  
   res.send('Hello World!!!'+req.session.user);
})

app.get('/index', function (req, res) {
    console.log(__dirname);
   res.sendFile(__dirname+"/html/index.html" );
})

app.post('/login',function(req,res){
  req.session.user = req.body.name;
  res.send();
})

app.get('/audio', function (req, res) {
   res.sendFile(__dirname+"/html/audio.html" );
})

app.get('/ajax', function (req, res) {
   res.sendFile(__dirname+"/html/ajax.html" );
})
app.get('/ajaxtest', function (req, res) {
   res.json({msg:"Hello World!!!"});
})

//https server,listen port:8888
var server = https.createServer(options, app).listen(8888);

//http server , listen port:8081
var serverhttp = app.listen(8081, function () {
  var host = serverhttp.address().address
  var port = serverhttp.address().port

  console.log("应用实例，访问地址为 http://%s:%s", host, port)

});

//parse cookie
var cookie = require('cookie');

//users , ws , userMap[user] = ws
var userMap = Object.create(null);

//websocket server
var WebSocketServer = require('ws').Server;
var wss = new WebSocketServer({server: server});
wss.on('connection', function(ws) {
   // console.log(ws.upgradeReq.headers.cookie);
    var cookies = cookie.parse(ws.upgradeReq.headers.cookie);
    
    //get session by session id , get user info
    store.get(cookieParser.signedCookie(cookies["connect.sid"],'123'),function(e,s){
      //console.log(e);
      //console.log(s);
      var user = s.user;
      userMap[user] = ws;
      ws.on('message', function(message) {
          wss.broadcast(message);
      });

      //建立连接，广播
      wss.broadcast(user+" join the chatroom");
    });
    
});
wss.broadcast = function(msg) {
  for(var user in userMap){
    userMap[user].send(msg)
  }
};