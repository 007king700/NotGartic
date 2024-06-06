const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const fs = require('fs').promises;

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

let wordList = []; // List of words for the game
const rooms = {}; // Object to store room information
const publicRooms = []; // Array to store public room names

// Generates a random room name
const generateRandomRoomName = () => {
    return 'room-' + Math.random().toString(36).substr(2, 9);
};

// Selects a random drawer from the users in the room who haven't drawn yet
const selectRandomDrawer = (room) => {
    const users = rooms[room].users.filter(user => !rooms[room].hasDrawn.includes(user));
    return users[Math.floor(Math.random() * users.length)];
};

// Gets three random words from the word list
const getRandomWords = () => wordList.sort(() => 0.5 - Math.random()).slice(0, 3);

// Updates the countdown timer for a room
const updateCountdown = (roomName, countdown) => {
    rooms[roomName].countdown = countdown; // Set the countdown for the room
    io.to(roomName).emit('updateCountdown', { countdown }); // Notify clients in the room about the updated countdown
};

// Ends the current round and starts a new one or ends the game if everyone has drawn
const endRound = (roomName) => {
    const room = rooms[roomName];
    clearInterval(room.timer); // Clear the round timer

    if (room.hasDrawn.length === room.users.length) {
        // If everyone has drawn, end the game
        io.to(roomName).emit('endGame', { points: room.points });
        let countdown = 30;
        const endGameTimer = setInterval(() => {
            if (rooms[roomName]) {
                countdown--;
                io.to(roomName).emit('leaveRoomCountdown', { countdown });
                if (countdown <= 0 || rooms[roomName].users.length === 0) {
                    clearInterval(endGameTimer); // Clear the timer when countdown reaches 0 or no users are left
                    io.to(roomName).emit('leaveRoom'); // Notify clients to leave the room
                    deleteRoom(roomName); // Delete the room
                }
            } else {
                clearInterval(endGameTimer); // Clear the timer if the room no longer exists
            }
        }, 1000);
    } else {
        startNewRound(roomName); // Start a new round if not everyone has drawn
    }
};

// Starts the guessing phase of the game
const startGuessingPhase = (roomName) => {
    const room = rooms[roomName];
    room.countdown = 120; // Set the guessing phase countdown to 120 seconds
    io.to(roomName).emit('startGuessing', { word: room.currentWord, countdown: room.countdown });

    room.timer = setInterval(() => {
        if (rooms[roomName]) {
            room.countdown--;
            if (room.countdown <= 0) {
                clearInterval(room.timer); // Clear the timer when countdown reaches 0
                endRound(roomName); // End the round
            } else {
                io.to(roomName).emit('updateCountdown', { countdown: room.countdown }); // Notify clients about the updated countdown
            }
        } else {
            clearInterval(room.timer); // Clear the timer if the room no longer exists
        }
    }, 1000);
};

// Starts a new round by selecting a new drawer and word
const startNewRound = (roomName) => {
    const room = rooms[roomName];
    const drawer = selectRandomDrawer(roomName); // Select a random drawer
    room.drawer = drawer;
    room.hasDrawn.push(drawer); // Mark the drawer as having drawn
    const words = getRandomWords(); // Get three random words
    room.currentWord = words[0]; // Select the first word as the current word

    io.to(roomName).emit('newRound', { drawer, words, users: room.users });
    io.to(roomName).emit('resetCanvas'); // Send a message to reset the canvas

    // Emit gameStarted event here
    io.to(roomName).emit('gameStarted');

    room.timer = setTimeout(() => {
        io.to(roomName).emit('wordSelected', { word: room.currentWord }); // Notify clients about the selected word
        startGuessingPhase(roomName); // Start the guessing phase
    }, 10000); // Wait 10 seconds for the drawer to select a word

    updateCountdown(roomName, 10); // Update the countdown for word selection
};

// Deletes a room and removes it from the list of public rooms if applicable
const deleteRoom = (roomName) => {
    if (rooms[roomName]) {
        delete rooms[roomName]; // Delete the room from the rooms object
        const publicIndex = publicRooms.indexOf(roomName);
        if (publicIndex > -1) {
            publicRooms.splice(publicIndex, 1); // Remove the room from the public rooms array
        }
    }
};

// Load the word list from a JSON file
fs.readFile('words.json')
    .then(data => {
        wordList = JSON.parse(data).words; // Parse the word list from the JSON file
    })
    .catch(err => console.error('Error reading words.json:', err)); // Log an error if reading the file fails

// Serve static files from the 'public' directory
app.use(express.static('public'));

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/index.html'); // Serve the main HTML file
});

// Handle socket.io connections and events
io.on('connection', (socket) => {
    console.log('New client connected');

    // Event listener for creating a room
    socket.on('createRoom', (roomName, username, isPublic) => {
        if (!rooms[roomName]) {
            rooms[roomName] = { 
                users: [], 
                fullDrawingData: [], 
                drawer: '', 
                chatLog: [], 
                points: {}, 
                hasDrawn: [], 
                currentWord: '', 
                timer: null, 
                countdown: 0,
                creator: username // Store the creator's username
            };
            if (isPublic) {
                publicRooms.push(roomName); // Add the room to public rooms if it is public
            }
        }

        if (!rooms[roomName].users.includes(username)) {
            rooms[roomName].users.push(username); // Add the user to the room
            rooms[roomName].points[username] = 0; // Initialize the user's points
            socket.join(roomName); // Join the socket to the room
            io.to(roomName).emit('roomCreated', { roomName, users: rooms[roomName].users }); // Notify clients in the room
        } else {
            socket.emit('error', 'Username already taken in this room'); // Notify the user if the username is already taken
        }
    });

    // Event listener for joining a room
    socket.on('joinRoom', (roomName, username) => {
        if (rooms[roomName]) {
            if (!rooms[roomName].users.includes(username)) {
                rooms[roomName].users.push(username); // Add the user to the room
                rooms[roomName].points[username] = 0; // Initialize the user's points
                socket.join(roomName); // Join the socket to the room
                socket.emit('roomJoined', {
                    roomName,
                    users: rooms[roomName].users,
                    drawer: rooms[roomName].drawer,
                    fullDrawingData: rooms[roomName].fullDrawingData,
                    chatLog: rooms[roomName].chatLog
                });
                io.to(roomName).emit('userJoined', { username, users: rooms[roomName].users }); // Notify clients in the room
            } else {
                socket.emit('error', 'Username already taken in this room'); // Notify the user if the username is already taken
            }
        } else {
            socket.emit('error', 'Room not found'); // Notify the user if the room does not exist
        }
    });

    // Event listener for leaving a room
    socket.on('leaveRoom', (roomName, username) => {
        if (rooms[roomName]) {
            const userIndex = rooms[roomName].users.indexOf(username);
            if (userIndex > -1) {
                rooms[roomName].users.splice(userIndex, 1); // Remove the user from the room
                socket.leave(roomName); // Leave the socket from the room
                io.to(roomName).emit('userLeft', { username, users: rooms[roomName].users }); // Notify clients in the room

                if (rooms[roomName].users.length === 0) {
                    deleteRoom(roomName); // Delete the room if no users are left
                }
            }
        }
    });

    // Event listener for client disconnection
    socket.on('disconnect', () => {
        console.log('Client disconnected');
    });

    // Event listener for starting a game
    socket.on('startGame', (roomName) => {
        if (rooms[roomName]) {
            if (rooms[roomName].users.length < 2) {
                socket.emit('error', 'You cannot start a game alone.'); // Notify the user if there are not enough players
            } else {
                startNewRound(roomName); // Start a new round
            }
        }
    });

    // Event listener for drawing
    socket.on('drawing', (data) => {
        if (rooms[data.room] && rooms[data.room].drawer === data.username) {
            rooms[data.room].fullDrawingData.push(data.pathData); // Store the full canvas data
            socket.to(data.room).emit('drawing', { pathData: data.pathData }); // Broadcast the drawing data to other clients in the room
        }
    });

    // Event listener for guessing a word
    socket.on('guess', (data) => {
        const room = rooms[data.room];
        if (room) {
            room.chatLog.push({ username: data.username, guess: data.guess }); // Add the guess to the chat log
            io.to(data.room).emit('guess', { username: data.username, guess: data.guess }); // Broadcast the guess to other clients in the room

            if (data.guess.toLowerCase() === room.currentWord.toLowerCase()) {
                room.points[data.username] += 10; // Add points to the user for a correct guess
                io.to(data.room).emit('correctGuess', { username: data.username, word: room.currentWord }); // Notify clients about the correct guess
                endRound(data.room); // End the round
            }
        }
    });

    // Event listener for selecting a word
    socket.on('wordChosen', (data) => {
        const room = rooms[data.room];
        if (room.drawer === data.username) {
            room.currentWord = data.word; // Set the selected word as the current word
            clearTimeout(room.timer); // Clear the word selection timer
            io.to(data.room).emit('wordSelected', { word: data.word }); // Notify clients about the selected word
            startGuessingPhase(data.room); // Start the guessing phase
        }
    });

    // Event listener for getting the list of public rooms
    socket.on('getPublicRooms', () => {
        socket.emit('publicRooms', publicRooms.map(roomName => ({
            roomName, 
            users: rooms[roomName].users,
            creator: rooms[roomName].creator // Send the creator's username
        })));
    });

    // Event listener for clearing the canvas
    socket.on('clearCanvas', (data) => {
        if (rooms[data.room]) {
            // Clear the stored drawing data for the room
            rooms[data.room].fullDrawingData = [];
            // Broadcast the clearCanvas event to all clients in the room
            io.to(data.room).emit('clearCanvas');
        }
    });
});

// Start the server on the specified port
const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
