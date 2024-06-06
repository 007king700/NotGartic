const socket = io();

// Select all necessary elements from the DOM
const elements = {
    loginDiv: document.getElementById('login'),
    gameDiv: document.getElementById('game'),
    createRoomBtn: document.getElementById('createRoomBtn'),
    joinRoomBtn: document.getElementById('joinRoomBtn'),
    listPublicRoomsBtn: document.getElementById('listPublicRoomsBtn'),
    publicRoomsList: document.getElementById('publicRoomsList'),
    roomNameInput: document.getElementById('roomName'),
    usernameInput: document.getElementById('username'),
    publicRoomToggle: document.getElementById('publicRoomToggle'),
    canvas: document.getElementById('canvas'),
    guessInput: document.getElementById('guess'),
    sendGuessBtn: document.getElementById('sendGuessBtn'),
    messages: document.getElementById('messages'),
    playersList: document.getElementById('players'),
    startGameBtn: document.getElementById('startGameBtn'),
    wordChoicesDiv: document.getElementById('wordChoices'),
    wordButtons: [document.getElementById('word1'), document.getElementById('word2'), document.getElementById('word3')],
    leaderboardDiv: document.getElementById('leaderboard'),
    scoresList: document.getElementById('scores'),
    leaveRoomBtn: document.getElementById('leaveRoomBtn'),
    currentWordDiv: document.getElementById('currentWord'),
    toolbar: document.getElementById('toolbar'),
    colors: document.getElementById('colors'),
    thickness: document.getElementById('thickness'),
    eraseAllBtn: document.getElementById('eraseAll'),
    wordChoicesCountdown: document.getElementById('wordChoicesCountdown'),
    leaveRoomCountdown: document.createElement('div') // Create a new element for the leave room countdown
};

// Style the leave room countdown
elements.leaveRoomCountdown.id = 'leaveRoomCountdown';
elements.leaveRoomCountdown.style.position = 'absolute';
elements.leaveRoomCountdown.style.top = '50%';
elements.leaveRoomCountdown.style.left = '50%';
elements.leaveRoomCountdown.style.transform = 'translate(-50%, -50%)';
elements.leaveRoomCountdown.style.fontSize = '2em';
elements.leaveRoomCountdown.style.backgroundColor = 'rgba(255, 255, 255, 0.8)';
elements.leaveRoomCountdown.style.padding = '10px';
elements.leaveRoomCountdown.style.borderRadius = '10px';
elements.leaveRoomCountdown.style.display = 'none'; // Initially hidden
elements.gameDiv.appendChild(elements.leaveRoomCountdown);

// Define constants for canvas dimensions and default drawing settings
const BASE_CANVAS_WIDTH = 2000;
const BASE_CANVAS_HEIGHT = 1500;
const DEFAULT_COLOR = '#000000';
const DEFAULT_THICKNESS = 5;

let drawing = false; // Flag to check if drawing is in progress
let currentRoom = ''; // Current room the user is in
let currentUser = ''; // Current user
let currentDrawer = ''; // Current drawer
let currentWord = ''; // Current word to guess
let drawingData = []; // Array to store the drawing data
let currentColor = DEFAULT_COLOR; // Current selected color
let currentThickness = DEFAULT_THICKNESS; // Current selected thickness

const context = elements.canvas.getContext('2d'); // Get the canvas drawing context
context.lineWidth = currentThickness; // Set the initial line thickness
context.strokeStyle = currentColor; // Set the initial stroke color

// Adjust the canvas size based on the window size
const adjustCanvasSize = () => {
    const aspectRatio = BASE_CANVAS_WIDTH / BASE_CANVAS_HEIGHT;
    const containerWidth = elements.canvas.parentElement.clientWidth;
    const containerHeight = elements.canvas.parentElement.clientHeight;

    if (containerWidth / containerHeight > aspectRatio) {
        elements.canvas.height = containerHeight;
        elements.canvas.width = containerHeight * aspectRatio;
    } else {
        elements.canvas.width = containerWidth;
        elements.canvas.height = containerWidth / aspectRatio;
    }

    context.setTransform(1, 0, 0, 1, 0, 0); // Reset the transformation matrix
    context.clearRect(0, 0, elements.canvas.width, elements.canvas.height); // Clear the canvas
    context.scale(elements.canvas.width / BASE_CANVAS_WIDTH, elements.canvas.height / BASE_CANVAS_HEIGHT); // Scale the canvas
    redrawCanvas(); // Redraw the canvas with the new size
};

// Redraw the canvas based on the stored drawing data
const redrawCanvas = () => {
    context.clearRect(0, 0, BASE_CANVAS_WIDTH, BASE_CANVAS_HEIGHT); // Clear the entire canvas
    drawingData.forEach(pathData => {
        context.beginPath(); // Start a new path
        context.lineWidth = pathData.thickness * (elements.canvas.width / BASE_CANVAS_WIDTH); // Adjust line width based on the canvas scale
        context.strokeStyle = pathData.color; // Set the stroke color
        pathData.path.forEach((point, index) => {
            const { x, y } = point; // Destructure the point coordinates
            if (index === 0) {
                context.moveTo(x, y); // Move to the starting point
            } else {
                context.lineTo(x, y); // Draw a line to the next point
            }
        });
        context.stroke(); // Apply the stroke to the path
    });
};

// Scale the coordinates of a point on the canvas
const scaleCoordinates = (x, y) => {
    const rect = elements.canvas.getBoundingClientRect(); // Get the canvas bounding rectangle
    return { 
        x: (x - rect.left) * (BASE_CANVAS_WIDTH / rect.width), // Scale x-coordinate
        y: (y - rect.top) * (BASE_CANVAS_HEIGHT / rect.height) // Scale y-coordinate
    };
};

// Update the list of players in the room
const updatePlayersList = (users) => {
    elements.playersList.innerHTML = ''; // Clear the players list
    users.forEach(user => {
        const item = document.createElement('li'); // Create a new list item
        item.textContent = user; // Set the text content to the username
        if (user === currentDrawer) item.classList.add('bold'); // Highlight the current drawer
        elements.playersList.appendChild(item); // Append the item to the players list
    });
};

// Add a message to the chat
const addMessage = (message) => {
    const item = document.createElement('li'); // Create a new list item
    item.textContent = message; // Set the text content to the message
    elements.messages.appendChild(item); // Append the item to the messages list
};

// Clear the chat messages
const clearChat = () => {
    elements.messages.innerHTML = ''; // Clear the messages list
};

// Reset the game state and UI elements
const resetGame = () => {
    elements.loginDiv.style.display = 'block'; // Show the login div
    elements.gameDiv.style.display = 'none'; // Hide the game div
    elements.leaderboardDiv.style.display = 'none'; // Hide the leaderboard div
    elements.toolbar.style.display = 'none'; // Hide the toolbar
    elements.wordChoicesDiv.style.display = 'none'; // Hide the word choices div
    elements.leaveRoomCountdown.style.display = 'none'; // Hide the leave room countdown
    elements.startGameBtn.style.display = 'none'; // Hide the start game button
    currentRoom = ''; // Reset current room
    currentUser = ''; // Reset current user
    currentDrawer = ''; // Reset current drawer
    currentWord = ''; // Reset current word
    clearChat(); // Clear chat messages
    context.clearRect(0, 0, BASE_CANVAS_WIDTH, BASE_CANVAS_HEIGHT); // Clear the canvas
    elements.currentWordDiv.style.display = 'none'; // Hide the current word div
    drawingData = []; // Clear the drawing data
    adjustCanvasSize(); // Adjust the canvas size
};

// Reset the canvas and tool settings
const resetCanvas = () => {
    context.clearRect(0, 0, BASE_CANVAS_WIDTH, BASE_CANVAS_HEIGHT); // Clear the canvas
    drawingData = []; // Clear the drawing data
    currentColor = DEFAULT_COLOR; // Reset to default color
    currentThickness = DEFAULT_THICKNESS; // Reset to default thickness
    context.lineWidth = currentThickness; // Set line width
    context.strokeStyle = currentColor; // Set stroke color

    document.querySelector('.color-option.active').classList.remove('active'); // Remove active class from current color
    document.querySelector('.color-option[data-color="' + DEFAULT_COLOR + '"]').classList.add('active'); // Add active class to default color

    document.querySelector('.thickness-option.active').classList.remove('active'); // Remove active class from current thickness
    document.querySelector('.thickness-option[data-thickness="' + DEFAULT_THICKNESS + '"]').classList.add('active'); // Add active class to default thickness
};

// Handle window resize events to adjust the canvas size
window.addEventListener('resize', adjustCanvasSize);
window.addEventListener('load', adjustCanvasSize);

let countdownInterval;

// Start the countdown timer for guessing
const startCountdown = (seconds) => {
    clearInterval(countdownInterval); // Clear any existing interval
    countdownInterval = setInterval(() => {
        if (seconds > 0) {
            if (currentUser === currentDrawer) {
                elements.currentWordDiv.textContent = `Your word: ${currentWord} (${seconds}s)`; // Update the word display for the drawer
            }
            seconds--;
        } else {
            clearInterval(countdownInterval); // Clear the interval when the countdown reaches 0
        }
    }, 1000);
};

let wordChoiceCountdownInterval;

// Start the countdown timer for word choice
const startWordChoiceCountdown = (seconds) => {
    clearInterval(wordChoiceCountdownInterval); // Clear any existing interval
    elements.wordChoicesCountdown.textContent = `${seconds}s`; // Update the countdown display
    wordChoiceCountdownInterval = setInterval(() => {
        if (seconds > 0) {
            elements.wordChoicesCountdown.textContent = `${seconds}s`; // Update the countdown display
            seconds--;
        } else {
            clearInterval(wordChoiceCountdownInterval); // Clear the interval when the countdown reaches 0
        }
    }, 1000);
};

// Generate a random room name
const generateRandomRoomName = () => {
    return 'room-' + Math.random().toString(36).substr(2, 9);
};

// Event listener for creating a room
elements.createRoomBtn.addEventListener('click', () => {
    const roomName = elements.publicRoomToggle.checked ? generateRandomRoomName() : elements.roomNameInput.value;
    const username = elements.usernameInput.value;
    const isPublic = elements.publicRoomToggle.checked;
    if ((roomName || isPublic) && username) {
        socket.emit('createRoom', roomName, username, isPublic); // Emit createRoom event to the server
        currentRoom = roomName;
        currentUser = username;
    } else {
        alert('Please enter a room name and username.'); // Alert if room name or username is missing
    }
});

// Event listener for joining a room
elements.joinRoomBtn.addEventListener('click', () => {
    const roomName = elements.roomNameInput.value;
    const username = elements.usernameInput.value;
    if (roomName && username) {
        socket.emit('joinRoom', roomName, username); // Emit joinRoom event to the server
        currentRoom = roomName;
        currentUser = username;
    } else {
        alert('Please enter a room name and username.'); // Alert if room name or username is missing
    }
});

// Event listener for listing public rooms
elements.listPublicRoomsBtn.addEventListener('click', () => {
    socket.emit('getPublicRooms'); // Emit getPublicRooms event to the server
});

// Event listener for starting the game
elements.startGameBtn.addEventListener('click', () => {
    socket.emit('startGame', currentRoom); // Emit startGame event to the server
});

// Listen for the gameStarted event and then hide the start game button
socket.on('gameStarted', () => {
    elements.startGameBtn.style.display = 'none'; // Hide the start game button when the game starts
});

// Event listener for choosing a word
elements.wordButtons.forEach(button => button.addEventListener('click', () => {
    const word = button.textContent;
    socket.emit('wordChosen', { room: currentRoom, username: currentUser, word }); // Emit wordChosen event to the server
}));

// Event listener for leaving a room
elements.leaveRoomBtn.addEventListener('click', () => {
    socket.emit('leaveRoom', currentRoom, currentUser); // Emit leaveRoom event to the server
    resetGame(); // Reset the game state
});

// Event listener for selecting a color
elements.colors.addEventListener('click', (event) => {
    if (event.target.classList.contains('color-option')) {
        currentColor = event.target.getAttribute('data-color'); // Get the selected color
        context.strokeStyle = currentColor; // Set the stroke color
        document.querySelector('.color-option.active').classList.remove('active'); // Remove active class from the current color
        event.target.classList.add('active'); // Add active class to the selected color
    }
});

// Event listener for selecting a thickness
elements.thickness.addEventListener('click', (event) => {
    if (event.target.classList.contains('thickness-option')) {
        currentThickness = event.target.getAttribute('data-thickness'); // Get the selected thickness
        context.lineWidth = currentThickness * (elements.canvas.width / BASE_CANVAS_WIDTH); // Set the line width
        document.querySelector('.thickness-option.active').classList.remove('active'); // Remove active class from the current thickness
        event.target.classList.add('active'); // Add active class to the selected thickness
    }
});

// Event listener for erasing the canvas
elements.eraseAllBtn.addEventListener('click', () => {
    resetCanvas(); // Reset the canvas
    socket.emit('clearCanvas', { room: currentRoom }); // Emit clearCanvas event to the server
});

// Event listener for starting a drawing
elements.canvas.addEventListener('mousedown', (event) => {
    if (currentUser === currentDrawer) {
        drawing = true; // Set drawing flag to true
        const { x, y } = scaleCoordinates(event.clientX, event.clientY); // Scale the coordinates
        context.beginPath(); // Start a new path
        context.moveTo(x, y); // Move to the starting point
        drawingData.push({ color: currentColor, thickness: currentThickness, path: [{ x, y }] }); // Add the starting point to the drawing data
    }
});

// Event listener for ending a drawing
elements.canvas.addEventListener('mouseup', () => {
    if (currentUser === currentDrawer) {
        drawing = false; // Set drawing flag to false
        context.closePath(); // Close the current path
        const latestPath = drawingData[drawingData.length - 1]; // Get the latest path data
        socket.emit('drawing', { room: currentRoom, username: currentUser, pathData: latestPath }); // Emit drawing event to the server
    }
});

// Event listener for drawing on the canvas
elements.canvas.addEventListener('mousemove', (event) => {
    if (drawing) {
        const { x, y } = scaleCoordinates(event.clientX, event.clientY); // Scale the coordinates
        context.lineTo(x, y); // Draw a line to the current point
        context.stroke(); // Apply the stroke
        drawingData[drawingData.length - 1].path.push({ x, y }); // Add the current point to the drawing data
    }
});

// Event listener for when the mouse leaves the canvas
elements.canvas.addEventListener('mouseleave', () => {
    if (drawing && currentUser === currentDrawer) {
        drawing = false; // Set drawing flag to false
        context.closePath(); // Close the current path
        const latestPath = drawingData[drawingData.length - 1]; // Get the latest path data
        socket.emit('drawing', { room: currentRoom, username: currentUser, pathData: latestPath }); // Emit drawing event to the server
    }
});

// Event listener for when the mouse enters the canvas
elements.canvas.addEventListener('mouseenter', (event) => {
    if (currentUser === currentDrawer && event.buttons === 1) { // Check if the user is the drawer and the mouse button is pressed
        drawing = true; // Set drawing flag to true
        const { x, y } = scaleCoordinates(event.clientX, event.clientY); // Scale the coordinates
        context.beginPath(); // Start a new path
        context.moveTo(x, y); // Move to the starting point
        drawingData.push({ color: currentColor, thickness: currentThickness, path: [{ x, y }] }); // Add the starting point to the drawing data
    }
});

// Event listener for sending a guess
elements.sendGuessBtn.addEventListener('click', () => {
    const guess = elements.guessInput.value; // Get the guess input value
    socket.emit('guess', { room: currentRoom, username: currentUser, guess }); // Emit guess event to the server
    elements.guessInput.value = ''; // Clear the guess input
});

// Event listener for sending a guess with the Enter key
elements.guessInput.addEventListener('keypress', (event) => {
    if (event.key === 'Enter') {
        const guess = elements.guessInput.value; // Get the guess input value
        socket.emit('guess', { room: currentRoom, username: currentUser, guess }); // Emit guess event to the server
        elements.guessInput.value = ''; // Clear the guess input
    }
});

// Socket event handlers

// Handle roomCreated event
socket.on('roomCreated', (data) => {
    elements.loginDiv.style.display = 'none'; // Hide the login div
    elements.gameDiv.style.display = 'flex'; // Show the game div
    elements.startGameBtn.style.display = 'block'; // Show the start game button
    updatePlayersList(data.users); // Update the players list
    adjustCanvasSize(); // Adjust the canvas size
});

// Handle roomJoined event
socket.on('roomJoined', (data) => {
    elements.loginDiv.style.display = 'none'; // Hide the login div
    elements.gameDiv.style.display = 'flex'; // Show the game div
    updatePlayersList(data.users); // Update the players list
    drawingData = data.fullDrawingData; // Load the full drawing data
    redrawCanvas(); // Redraw the canvas
    data.chatLog.forEach(log => addMessage(`${log.username}: ${log.guess}`)); // Load the chat log
    adjustCanvasSize(); // Adjust the canvas size
});

// Handle userJoined event
socket.on('userJoined', (data) => {
    addMessage(`${data.username} joined the room`); // Add a message to the chat
    updatePlayersList(data.users); // Update the players list
});

// Handle error event
socket.on('error', (message) => alert(message)); // Display an alert with the error message

// Handle newRound event
socket.on('newRound', (data) => {
    currentDrawer = data.drawer; // Set the current drawer
    updatePlayersList(data.users); // Update the players list
    resetCanvas(); // Reset the canvas and selected colors/thickness
    
    // Disable chat for the drawer
    if (currentUser === currentDrawer) {
        elements.guessInput.disabled = true; // Disable the guess input
        elements.sendGuessBtn.disabled = true; // Disable the send guess button
        elements.wordChoicesDiv.style.display = 'block'; // Show the word choices div
        elements.toolbar.style.display = 'flex'; // Show the toolbar
        data.words.forEach((word, index) => elements.wordButtons[index].textContent = word); // Load the word choices
        startWordChoiceCountdown(10); // Start the countdown for word choice
    } else {
        elements.guessInput.disabled = false; // Enable the guess input
        elements.sendGuessBtn.disabled = false; // Enable the send guess button
        elements.toolbar.style.display = 'none'; // Hide the toolbar for guessers
    }
    adjustCanvasSize(); // Adjust the canvas size
});

// Handle wordSelected event
socket.on('wordSelected', (data) => {
    currentWord = data.word; // Set the current word
    elements.wordChoicesDiv.style.display = 'none'; // Hide the word choices div
    if (currentUser === currentDrawer) {
        elements.currentWordDiv.textContent = `Your word: ${currentWord}`; // Display the current word for the drawer
        elements.currentWordDiv.style.display = 'block'; // Show the current word div
    }
});

// Handle startGuessing event
socket.on('startGuessing', (data) => {
    currentWord = data.word; // Set the current word
    if (currentUser !== currentDrawer) {
        alert(`Start guessing!`); // Alert guessers to start guessing
    }
    startCountdown(data.countdown); // Start the guessing countdown
});

// Handle correctGuess event
socket.on('correctGuess', (data) => {
    addMessage(`${data.username} guessed the word: ${data.word}`); // Add a message to the chat
});

// Handle drawing event
socket.on('drawing', (data) => {
    const { color, thickness, path } = data.pathData; // Get the drawing data
    context.beginPath(); // Start a new path
    context.lineWidth = thickness * (elements.canvas.width / BASE_CANVAS_WIDTH); // Set the line width
    context.strokeStyle = color; // Set the stroke color
    path.forEach((point, index) => {
        const { x, y } = point; // Destructure the point coordinates
        if (index === 0) {
            context.moveTo(x, y); // Move to the starting point
        } else {
            context.lineTo(x, y); // Draw a line to the next point
        }
    });
    context.stroke(); // Apply the stroke to the path
    drawingData.push(data.pathData); // Add the drawing data to the array
});

// Handle guess event
socket.on('guess', (data) => addMessage(`${data.username}: ${data.guess}`)); // Add the guess to the chat

// Handle endGame event
socket.on('endGame', (data) => {
    elements.leaderboardDiv.style.display = 'block'; // Show the leaderboard
    elements.scoresList.innerHTML = ''; // Clear the scores list
    for (const [player, score] of Object.entries(data.points)) {
        const item = document.createElement('li'); // Create a new list item
        item.textContent = `${player}: ${score} points`; // Set the text content to the player and score
        elements.scoresList.appendChild(item); // Append the item to the scores list
    }
});

// Handle leaveRoom event
socket.on('leaveRoom', resetGame); // Reset the game when the user leaves the room

// Handle updateCountdown event
socket.on('updateCountdown', (data) => {
    if (currentUser === currentDrawer) {
        elements.currentWordDiv.textContent = `Your word: ${currentWord} (${data.countdown}s)`; // Update the word display with the countdown
    }
});

// Handle resetCanvas event
socket.on('resetCanvas', () => {
    resetCanvas(); // Reset the canvas
});

// Handle clearCanvas event
socket.on('clearCanvas', () => {
    resetCanvas(); // Reset the canvas
});

// Handle publicRooms event
socket.on('publicRooms', (data) => {
    elements.publicRoomsList.innerHTML = ''; // Clear the public rooms list
    data.forEach(room => {
        const roomDiv = document.createElement('div'); // Create a new div for each public room
        roomDiv.textContent = `Created by: ${room.creator}, Players: ${room.users.length}`; // Set the text content to the room details
        roomDiv.classList.add('public-room'); // Add the public-room class
        roomDiv.addEventListener('click', () => {
            elements.roomNameInput.value = room.roomName; // Set the room name input value when the div is clicked
        });
        elements.publicRoomsList.appendChild(roomDiv); // Append the div to the public rooms list
    });
});

// Handle leaveRoomCountdown event
socket.on('leaveRoomCountdown', (data) => {
    elements.leaveRoomCountdown.style.display = 'block'; // Show the leave room countdown
    elements.leaveRoomCountdown.textContent = `You will be forced to leave the room in ${data.countdown}s`; // Update the countdown display
    if (data.countdown <= 0) {
        elements.leaveRoomCountdown.style.display = 'none'; // Hide the leave room countdown when the countdown reaches 0
        socket.emit('leaveRoom', currentRoom, currentUser); // Emit leaveRoom event to the server
    }
});
