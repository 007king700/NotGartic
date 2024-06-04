const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

let wordList = [];

// Load the word list
fs.readFile('words.json', (err, data) => {
    if (err) {
        console.error('Error reading words.json:', err);
        return;
    }
    wordList = JSON.parse(data).words;
});

// In-memory storage
const rooms = {};

// Helper function to randomly select a drawer
function selectRandomDrawer(room) {
    const users = rooms[room].users.filter(user => !rooms[room].hasDrawn.includes(user));
    const randomIndex = Math.floor(Math.random() * users.length);
    return users[randomIndex];
}

// Helper function to pick random words
function getRandomWords() {
    const shuffled = wordList.sort(() => 0.5 - Math.random());
    return shuffled.slice(0, 3);
}

// Serve static files from the 'public' directory
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
            rooms[roomName] = { users: [], drawingData: [], drawer: '', chatLog: [], points: {}, hasDrawn: [], currentWord: '', timer: null, countdown: 0 };
        }

        if (!rooms[roomName].users.includes(username)) {
            rooms[roomName].users.push(username);
            rooms[roomName].points[username] = 0;
            socket.join(roomName);
            io.to(roomName).emit('roomCreated', { roomName, users: rooms[roomName].users });
        } else {
            socket.emit('error', 'Username already taken in this room');
        }
    });

    // Join Room
    socket.on('joinRoom', (roomName, username) => {
        if (rooms[roomName]) {
            if (!rooms[roomName].users.includes(username)) {
                rooms[roomName].users.push(username);
                rooms[roomName].points[username] = 0;
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

    // Start Game
    socket.on('startGame', (roomName) => {
        if (rooms[roomName]) {
            startNewRound(roomName);
        }
    });

    function startNewRound(roomName) {
        const room = rooms[roomName];
        const drawer = selectRandomDrawer(roomName);
        room.drawer = drawer;
        room.hasDrawn.push(drawer);
        const words = getRandomWords();
        room.currentWord = words[0]; // Default to the first word if no choice is made

        io.to(roomName).emit('newRound', { drawer, words, users: room.users });

        room.timer = setTimeout(() => {
            // Automatically select the first word if no choice is made
            io.to(roomName).emit('wordSelected', { word: room.currentWord });
            startGuessingPhase(roomName);
        }, 10000); // 10 seconds to choose a word

        updateCountdown(roomName, 10);
    }

    function startGuessingPhase(roomName) {
        const room = rooms[roomName];
        room.countdown = 120;
        io.to(roomName).emit('startGuessing', { word: room.currentWord, countdown: room.countdown });
        room.timer = setInterval(() => {
            room.countdown--;
            if (room.countdown <= 0) {
                clearInterval(room.timer);
                endRound(roomName);
            } else {
                io.to(roomName).emit('updateCountdown', { countdown: room.countdown });
            }
        }, 1000); // 1 second interval
    }

    function endRound(roomName) {
        const room = rooms[roomName];
        clearInterval(room.timer);

        if (room.hasDrawn.length === room.users.length) {
            // All users have drawn, end the game
            io.to(roomName).emit('endGame', { points: room.points });
            setTimeout(() => {
                io.to(roomName).emit('leaveRoom');
                delete rooms[roomName];
            }, 30000); // Close room after 30 seconds
        } else {
            // Start a new round
            startNewRound(roomName);
        }
    }

    function updateCountdown(roomName, countdown) {
        rooms[roomName].countdown = countdown;
        io.to(roomName).emit('updateCountdown', { countdown: countdown });
    }

    // Handle Drawing Data
    socket.on('drawing', (data) => {
        if (rooms[data.room] && rooms[data.room].drawer === data.username) {
            rooms[data.room].drawingData.push(data.image);
            socket.to(data.room).emit('drawing', data);
        }
    });

    // Handle Guessing
    socket.on('guess', (data) => {
        const room = rooms[data.room];
        if (room) {
            room.chatLog.push({ username: data.username, guess: data.guess });
            io.to(data.room).emit('guess', { username: data.username, guess: data.guess });

            if (data.guess.toLowerCase() === room.currentWord.toLowerCase()) {
                room.points[data.username] += 10; // Award points
                io.to(data.room).emit('correctGuess', { username: data.username, word: room.currentWord });
                endRound(data.room);
            }
        }
    });

    socket.on('wordChosen', (data) => {
        const room = rooms[data.room];
        if (room.drawer === data.username) {
            room.currentWord = data.word;
            clearTimeout(room.timer); // Clear the previous timer
            io.to(data.room).emit('wordSelected', { word: data.word });
            startGuessingPhase(data.room);
        }
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected');
        // Handle user disconnection logic if necessary
    });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
