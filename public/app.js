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

let drawing = false;
let currentRoom = '';
let currentUser = '';
let currentDrawer = '';

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

// Handle room creation and joining
socket.on('roomCreated', (data) => {
    loginDiv.style.display = 'none';
    gameDiv.style.display = 'flex';
    currentDrawer = data.drawer;
    clearChat();
});

socket.on('roomJoined', (data) => {
    loginDiv.style.display = 'none';
    gameDiv.style.display = 'flex';
    currentDrawer = data.drawer;
    data.drawingData.forEach(imageData => {
        const image = new Image();
        image.src = imageData;
        image.onload = () => {
            context.drawImage(image, 0, 0);
        };
    });
    data.chatLog.forEach(log => {
        addMessage(`${log.username}: ${log.guess}`);
    });
});

socket.on('userJoined', (data) => {
    addMessage(`${data.username} joined the room`);
});

socket.on('error', (message) => {
    alert(message);
});

// Drawing on canvas
canvas.addEventListener('mousedown', () => {
    if (currentUser === currentDrawer) {
        drawing = true;
        context.beginPath();
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
    if (!drawing) return;
    context.lineTo(event.offsetX, event.offsetY);
    context.stroke();
});

socket.on('drawing', (data) => {
    const image = new Image();
    image.src = data.image;
    image.onload = () => {
        context.drawImage(image, 0, 0);
    };
});

// Handle guessing
sendGuessBtn.addEventListener('click', () => {
    const guess = guessInput.value;
    socket.emit('guess', { room: currentRoom, username: currentUser, guess });
    guessInput.value = '';
});

socket.on('guess', (data) => {
    addMessage(`${data.username}: ${data.guess}`);
});

function addMessage(message) {
    const item = document.createElement('li');
    item.textContent = message;
    messages.appendChild(item);
}

function clearChat() {
    messages.innerHTML = '';
}
