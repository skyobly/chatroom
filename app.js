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
app.set('views','html');
app.set('view engine','pug');

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

//users , ws , userMap[user] = ws
var userMap = Object.create(null);

/**
 * routes
 */
app.get('/', function (req, res) {  
   res.send('Hello World!!!'+req.session.user);
})

//loign page
app.get('/index', function (req, res) {
  if(req.session.user == undefined){
    res.sendFile(__dirname+"/html/index.html" );
  }
  else{
    res.redirect('/chat');
  }     
})

//login action
app.post('/login',function(req,res){
  if(req.body.name == undefined){
    res.redirect('/index');
  }
  else{
    req.session.user = req.body.name;
    res.redirect('/chat');
  }    
})

app.get('/chat', function (req, res) {
  if(req.session.user == undefined){
    res.redirect('/index');
  }
  else{
    //res.sendFile(__dirname+"/html/chatroom.html" );
    res.render("chatroom",{name:req.session.user});
  }  
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



//websocket server
var WebSocketServer = require('ws').Server;
var wss = new WebSocketServer({server: server});
wss.on('connection', function(ws) {
    console.log("connection");
    var cookies = cookie.parse(ws.upgradeReq.headers.cookie);
    
    //get session by session id , get user info
    store.get(cookieParser.signedCookie(cookies["connect.sid"],'123'),function(e,s){
      //console.log(e);
      //console.log(s);
      var user = s.user;
      
      if(userMap[user] === undefined){
        
        userMap[user] = ws;
        //建立连接，广播
        var data = {
          user:user,
          type:"init"
        };
        wss.broadcast(JSON.stringify(data));
      }
      else{
        userMap[user].close(1000,'da');
        userMap[user] = ws;
      }      

      ws.on('message', function(message) {
          //console.log(message instanceof Buffer);
          if(typeof message === "string"){
            var data = {
              user:user,
              type:"text",
              msg:message
            };
            wss.broadcast(JSON.stringify(data));
          }
          else{
            var len = user.length;
            var array = new Uint16Array(len+1);
            array[0] = len;
            for(var i=0;i<len;i++){
              array[i+1] = user.charCodeAt(i);
            }
            //console.log(Buffer.from(array.buffer));
            wss.broadcast(Buffer.concat([Buffer.from(array.buffer),message]));
          }
          
      });

      ws.on('close',function(code,msg){
        //console.log("code : "+code,"msg : "+msg);
        //console.log(userMap[user] === ws);
        if(userMap[user] === ws){
          delete userMap[user];
          //关闭连接，广播
          var data = {
            user:user,
            type:"exit"
          };
          wss.broadcast(JSON.stringify(data));
        }
        else{

        }
          
      })

      
    });
    
});
wss.broadcast = function(msg) {
  for(var user in userMap){
    userMap[user].send(msg)
  }
};