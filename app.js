// require('dotenv').config();
const
    express = require('express'),
    app = express(),
    path = require('path'),
    favicon = require('serve-favicon'),
    logger = require('morgan'),
    cookieParser = require('cookie-parser'),
    bodyParser = require('body-parser'),
    router = express.Router(),
    getJSON = require('get-json'),
    request = require('request'),
    helmet = require('helmet'),
    requestjs = require('request'),
    fs = require('fs'),
    _ = require('lodash'),
    array = require('lodash/array'),
    object = require('lodash/fp/object'),
    uid = require('uid');
    ObjectId = require('mongodb').ObjectID,
    MongoClient = require('mongodb').MongoClient,
    assert = require('assert'),
    googleTranslate = require('google-translate')('AIzaSyDP_ICZEl3iMxsLHr8HvH65kE-LOP2r9cQ')
;

app.use(express.static('public'));
app.use(express.static('client/dist'));
app.set('views', path.join(__dirname, './client'));
app.set('view engine', 'pug');
// app.set('view cache', true);
var main = require('./routes/main.js');
app.use('/', main);

// Connecting to MongoDB database
let database;
let url = 'mongodb://localhost:27017/myproject?connectTimeoutMS=900000&socketTimeoutMS=900000';
MongoClient.connect(url, function(err, db) {
    assert.equal(null, err);
    console.log('Connected correctly to MongoDB server');
    database = db;
});

app.use(helmet());
var debug = require('debug')('Resume:server');
var http = require('http');

var server = http.createServer(app);
var port = 80;
server.listen(port);
var io = require('socket.io').listen(server);
var clients = [];
global.api = 3000;

const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
// const HashStrategy = require('passport-hash').Strategy;
const flash = require('connect-flash');

//GZIP compression module for better performance
const compression = require('compression');
app.use(compression());

// This function checks/corrects dates in object or string format
function checkNull(data) {
    console.log('Type: ' + typeof data + ' | ' + 'Data: ' + data);
    // if data = 'null' string
    if (data == 'null' || data == null || data == '-') {
        var result = 'null';
        return result;
    }
    // if data = date in string format
    else if (data != 'null' && typeof data == 'string') {
        var result = Date.parse(data);
        return result;
    }
    // if data = date object
    else {
        return data;
    }
}
// Connection to socket
io.on('connection', function(socket) {
    console.log('User connected: ' + socket.id);

    socket.on('CREATE_SESSION', function(val){
        console.log(val);
        let tempid = uid(10);
        console.log(tempid, val);
        database.collection('sessions').insert({
            sessionid: tempid, user1: val.user1, user2: val.user2
        }, function(err, data) {
            if (err) {
                console.log(err);
            }else if (data) {
                io.to(socket.id).emit('CREATE_SESSION_SUCCESS', data);
            }
        });
    });

    socket.on('GET_SESSIONS', function(val){
        console.log(val);
        database.collection('sessions').find({
            $or: [{user1: val.user}, {user2: val.user}]
        }).toArray(function(err, data) {
            if (err) {
                console.log(err);
            }else if (data) {
                io.to(socket.id).emit('GET_SESSIONS_SUCCESS', {sessions: data});
            }
        });
    });

    socket.on('GET_CONTACTS', function(val){
        console.log(val);
        database.collection('users').findOne({
            email: val.user
        }, function(err, data) {
            if (err) {
                console.log(err);
            }else if (data) {
                delete data['password'];
                io.to(socket.id).emit('GET_CONTACTS_SUCCESS', {contacts: data.contacts});
            }
        });
    });

    socket.on('GET_SESSION_DATA', function(val){
        console.log(val);
        database.collection('texts').find({
            sessionid: val.sessionid
        }).toArray(function(err, data) {
            if (err) {
                console.log(err);
            }else if (data) {
                io.to(socket.id).emit('GET_SESSION_DATA_SUCCESS', {texts: data});
            }
        });
    });

    socket.on('SEND_MESSAGE', function(val){
        console.log('val');
        console.log(val);
        database.collection('users').findOne({
            email: val.language
        }, function(err, data) {
            if (err) {
                console.log(err);
            }else if (data) {
                console.log('got translate');
                console.log(data.lang);
                googleTranslate.translate(val.content, data.lang, function(err2, translation) {
                    console.log(translation.translatedText);
                    val.translation = translation.translatedText;
                    val.showtranslation = true;
                    database.collection('texts').insert(val, function(err3, data2) {
                        if (err3) {
                            console.log(err3);
                        }else if (data2) {
                            console.log(data2);
                            io.to(socket.id).emit('SEND_MESSAGE_SUCCESS', {content: data2});
                        }
                    });
                });
            }
        });
    });
});

// Print server start and errors
server.on('error', onError);
server.on('listening', onListening);

//Normalize a port into a number, string, or false.
function normalizePort(val) {
    var port = parseInt(val, 10);
    if (isNaN(port)) {
        // named pipe
        return val;
    }
    if (port >= 0) {
        // port number
        return port;
    }
    return false;
}

//Event listener for HTTP server "error" event.
function onError(error) {
    if (error.syscall !== 'listen') {
        throw error;
    }
    var bind = typeof port === 'string' ? 'Pipe ' + port : 'Port ' + port;
    // handle specific listen errors with friendly messages
    switch (error.code) {
    case 'EACCES':
        console.error(bind + ' requires elevated privileges');
        process.exit(1);
        break;
    case 'EADDRINUSE':
        console.error(bind + ' is already in use');
        process.exit(1);
        break;
    default:
        throw error;
    }
}

//Event listener for HTTP server "listening" event.
function onListening() {
    var addr = server.address();
    var bind = typeof addr === 'string' ? 'pipe ' + addr : 'port ' + addr.port;
    debug('Listening on ' + bind);
    console.log('Listening on port 80...');
}

app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
    extended: false
}));
//app.use(cookieParser());
app.use(flash());

app.post('/login', function(req, res) {
    console.log('logging in')
    database.db('myproject').collection('users').findOne({
        'email':  req.body.email
    }, function(err, thedata){
        if (err || !thedata) {
            res.json({"user": null});
        }else{
            if(req.body.password !== thedata.password){
                console.log('wrong password');
                res.json({"user": null});
            }else if(req.body.password === thedata.password){
                console.log('correct password');
                delete thedata['password'];
                res.json(thedata);
            }
        }
    })
});
app.post('/register', function(req, res){
    console.log(req.body);
    database.collection('users').findOne({email: req.body.email}, function(err, user){
        if(err){
            console.log(err);
        }else if (user) {
            res.json({"user": null});
        }else{
            let user = req.body;
            if(user.coach === false){
                user.subcoaches = [];
            }
            database.collection('users').insert(user);
            res.json({"user": user});
        }
    })
});
app.post('/logout', function(req, res){
    res.redirect('/');
});
