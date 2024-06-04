const socket = io();

// Elements
const loginDiv = document.getElementById('login');
const gameDiv = document.getElementById('game');
const createRoomBtn = document.getElementById('createRoomBtn');
const joinRoomBtn = document.getElementById('joinRoomBtn');
const roomNameInput = document.getElementById('roomName');
const usernameInput = document.getElementById('username');
const canvas = document.getElementById('canvas');
const context = canvas.getContext('2d');
const guessInput = document.getElementById('guess');
const sendGuessBtn = document.getElementById('sendGuessBtn');
const messages = document.getElementById('messages');
const playersList = document.getElementById('players');
const startGameBtn = document.getElementById('startGameBtn');
const wordChoicesDiv = document.getElementById('wordChoices');
const wordButtons = [document.getElementById('word1'), document.getElementById('word2'), document.getElementById('word3')];
const leaderboardDiv = document.getElementById('leaderboard');
const scoresList = document.getElementById('scores');
const leaveRoomBtn = document.getElementById('leaveRoomBtn');
const currentWordDiv = document.getElementById('currentWord');

const BASE_CANVAS_WIDTH = 2000;
const BASE_CANVAS_HEIGHT = 1500;

let drawing = false;
let currentRoom = '';
let currentUser = '';
let currentDrawer = '';
let currentWord = '';
let drawingData = [];

// Adjust canvas size and set scaling factors
function adjustCanvasSize() {
    const aspectRatio = BASE_CANVAS_WIDTH / BASE_CANVAS_HEIGHT;
    const containerWidth = canvas.parentElement.clientWidth;
    const containerHeight = canvas.parentElement.clientHeight;

    if (containerWidth / containerHeight > aspectRatio) {
        canvas.height = containerHeight;
        canvas.width = containerHeight * aspectRatio;
    } else {
        canvas.width = containerWidth;
        canvas.height = containerWidth / aspectRatio;
    }

    context.setTransform(canvas.width / BASE_CANVAS_WIDTH, 0, 0, canvas.height / BASE_CANVAS_HEIGHT, 0, 0);
    redrawCanvas();
}
window.addEventListener('resize', adjustCanvasSize);
window.addEventListener('load', adjustCanvasSize);

// Scale mouse coordinates
function scaleCoordinates(x, y) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = BASE_CANVAS_WIDTH / rect.width;
    const scaleY = BASE_CANVAS_HEIGHT / rect.height;
    return { x: (x - rect.left) * scaleX, y: (y - rect.top) * scaleY };
}

// Redraw canvas
function redrawCanvas() {
    context.clearRect(0, 0, BASE_CANVAS_WIDTH, BASE_CANVAS_HEIGHT);
    drawingData.forEach(imageData => {
        const image = new Image();
        image.src = imageData;
        image.onload = () => {
            context.drawImage(image, 0, 0, BASE_CANVAS_WIDTH, BASE_CANVAS_HEIGHT);
        };
    });
}

// Join or create room
createRoomBtn.addEventListener('click', () => {
    const roomName = roomNameInput.value;
    const username = usernameInput.value;
    if (roomName && username) {
        socket.emit('createRoom', roomName, username);
        currentRoom = roomName;
        currentUser = username;
    } else {
        alert('Please enter both room name and username.');
    }
});

joinRoomBtn.addEventListener('click', () => {
    const roomName = roomNameInput.value;
    const username = usernameInput.value;
    if (roomName && username) {
        socket.emit('joinRoom', roomName, username);
        currentRoom = roomName;
        currentUser = username;
    } else {
        alert('Please enter both room name and username.');
    }
});

startGameBtn.addEventListener('click', () => {
    socket.emit('startGame', currentRoom);
});

wordButtons.forEach((button, index) => {
    button.addEventListener('click', () => {
        const word = button.textContent;
        socket.emit('wordChosen', { room: currentRoom, username: currentUser, word });
    });
});

leaveRoomBtn.addEventListener('click', () => {
    socket.emit('leaveRoom', currentRoom);
    resetGame();
});

// Handle room creation and joining
socket.on('roomCreated', (data) => {
    loginDiv.style.display = 'none';
    gameDiv.style.display = 'flex';
    startGameBtn.style.display = 'block';
    updatePlayersList(data.users);
    adjustCanvasSize();
});

socket.on('roomJoined', (data) => {
    loginDiv.style.display = 'none';
    gameDiv.style.display = 'flex';
    updatePlayersList(data.users);
    drawingData = data.drawingData;
    redrawCanvas();
    data.chatLog.forEach(log => {
        addMessage(`${log.username}: ${log.guess}`);
    });
    adjustCanvasSize();
});

socket.on('userJoined', (data) => {
    addMessage(`${data.username} joined the room`);
    updatePlayersList(data.users);
});

socket.on('error', (message) => {
    alert(message);
});

socket.on('newRound', (data) => {
    currentDrawer = data.drawer;
    updatePlayersList(data.users);
    if (currentUser === currentDrawer) {
        wordChoicesDiv.style.display = 'block';
        data.words.forEach((word, index) => {
            wordButtons[index].textContent = word;
        });
    }
    adjustCanvasSize();
});

socket.on('wordSelected', (data) => {
    currentWord = data.word;
    wordChoicesDiv.style.display = 'none';
    if (currentUser === currentDrawer) {
        currentWordDiv.textContent = `Your word to draw is: ${currentWord}`;
        currentWordDiv.style.display = 'block';
    }
});

socket.on('startGuessing', (data) => {
    currentWord = data.word;
    if (currentUser !== currentDrawer) {
        alert(`Start guessing!`);
    }
    startCountdown(data.countdown);
});

socket.on('correctGuess', (data) => {
    addMessage(`${data.username} guessed the word: ${data.word}`);
});

socket.on('drawing', (data) => {
    const image = new Image();
    image.src = data.image;
    image.onload = () => {
        context.drawImage(image, 0, 0, BASE_CANVAS_WIDTH, BASE_CANVAS_HEIGHT);
    };
    drawingData.push(data.image); // Store the drawing data
});

socket.on('guess', (data) => {
    addMessage(`${data.username}: ${data.guess}`);
});

socket.on('endGame', (data) => {
    leaderboardDiv.style.display = 'block';
    scoresList.innerHTML = '';
    for (const [player, score] of Object.entries(data.points)) {
        const item = document.createElement('li');
        item.textContent = `${player}: ${score} points`;
        scoresList.appendChild(item);
    }
});

socket.on('leaveRoom', () => {
    resetGame();
});

socket.on('updateCountdown', (data) => {
    if (currentUser === currentDrawer) {
        currentWordDiv.textContent = `Your word to draw is: ${currentWord} (${data.countdown}s)`;
    }
});

function addMessage(message) {
    const item = document.createElement('li');
    item.textContent = message;
    messages.appendChild(item);
}

function updatePlayersList(users) {
    playersList.innerHTML = '';
    users.forEach(user => {
        const item = document.createElement('li');
        item.textContent = user;
        if (user === currentDrawer) {
            item.classList.add('bold');
        }
        playersList.appendChild(item);
    });
}

function clearChat() {
    messages.innerHTML = '';
}

function resetGame() {
    loginDiv.style.display = 'block';
    gameDiv.style.display = 'none';
    leaderboardDiv.style.display = 'none';
    currentRoom = '';
    currentUser = '';
    currentDrawer = '';
    currentWord = '';
    clearChat();
    context.clearRect(0, 0, BASE_CANVAS_WIDTH, BASE_CANVAS_HEIGHT);
    currentWordDiv.style.display = 'none';
    drawingData = [];
    adjustCanvasSize();
}

function startCountdown(seconds) {
    const countdownInterval = setInterval(() => {
        if (seconds > 0) {
            if (currentUser === currentDrawer) {
                currentWordDiv.textContent = `Your word to draw is: ${currentWord} (${seconds}s)`;
            }
            seconds--;
        } else {
            clearInterval(countdownInterval);
        }
    }, 1000);
}

// Drawing on canvas
canvas.addEventListener('mousedown', (event) => {
    if (currentUser === currentDrawer) {
        drawing = true;
        const { x, y } = scaleCoordinates(event.clientX, event.clientY);
        context.beginPath();
        context.moveTo(x, y);
    }
});

canvas.addEventListener('mouseup', () => {
    if (currentUser === currentDrawer) {
        drawing = false;
        context.closePath();
        socket.emit('drawing', { room: currentRoom, username: currentUser, image: canvas.toDataURL() });
    }
});

canvas.addEventListener('mousemove', (event) => {
    if (drawing) {
        const { x, y } = scaleCoordinates(event.clientX, event.clientY);
        context.lineTo(x, y);
        context.stroke();
    }
});

sendGuessBtn.addEventListener('click', () => {
    const guess = guessInput.value;
    socket.emit('guess', { room: currentRoom, username: currentUser, guess });
    guessInput.value = '';
});
