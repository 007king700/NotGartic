const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// In-memory storage
const rooms = {};

// Serve static files
app.use(express.static('public'));

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/index.html');
});

// Handle Socket.io connections
io.on('connection', (socket) => {
    console.log('New client connected');

    // Create Room
    socket.on('createRoom', (roomName, username) => {
        if (!rooms[roomName]) {
            rooms[roomName] = { users: [], drawingData: [], drawer: '', chatLog: [] };
        }

        if (!rooms[roomName].users.includes(username)) {
            rooms[roomName].users.push(username);
            rooms[roomName].drawer = username;
            socket.join(roomName);
            io.to(roomName).emit('roomCreated', { roomName, users: rooms[roomName].users, drawer: username });
        } else {
            socket.emit('error', 'Username already taken in this room');
        }
    });

    // Join Room
    socket.on('joinRoom', (roomName, username) => {
        if (rooms[roomName]) {
            if (!rooms[roomName].users.includes(username)) {
                rooms[roomName].users.push(username);
                socket.join(roomName);
                socket.emit('roomJoined', {
                    roomName,
                    users: rooms[roomName].users,
                    drawer: rooms[roomName].drawer,
                    drawingData: rooms[roomName].drawingData,
                    chatLog: rooms[roomName].chatLog
                });
                io.to(roomName).emit('userJoined', { username, users: rooms[roomName].users });
            } else {
                socket.emit('error', 'Username already taken in this room');
            }
        } else {
            socket.emit('error', 'Room not found');
        }
    });

    // Handle Drawing Data
    socket.on('drawing', (data) => {
        if (rooms[data.room] && rooms[data.room].drawer === data.username) {
            rooms[data.room].drawingData.push(data.image);
            socket.to(data.room).emit('drawing', data);
        }
    });

    // Handle Guessing
    socket.on('guess', (data) => {
        if (rooms[data.room]) {
            rooms[data.room].chatLog.push({ username: data.username, guess: data.guess });
            io.to(data.room).emit('guess', { username: data.username, guess: data.guess });
        }
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected');
        // Handle user disconnection logic if necessary
    });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
