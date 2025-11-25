let socket = null;
let currentToken = null;
let currentUser = null;
let currentRoom = 'general';
let availableRooms = [];
let onlineUsers = [];

const authSection = document.getElementById('authSection');
const chatSection = document.getElementById('chatSection');
const authStatus = document.getElementById('authStatus');
const registerButton = document.getElementById('registerButton');
const loginButton = document.getElementById('loginButton');
const sendButton = document.getElementById('sendButton');
const messageInput = document.getElementById('messageInput');
const clearButton = document.getElementById('clearButton');
const statusElement = document.getElementById('status');
const messagesDiv = document.getElementById('messages');
const logoutButton = document.getElementById('logoutButton');
const currentUsernameElement = document.getElementById('currentUsername');
const currentRoomElement = document.getElementById('currentRoom');
const roomsListElement = document.getElementById('roomsList');
const onlineUsersListElement = document.getElementById('onlineUsersList');
const onlineUsersCountElement = document.getElementById('onlineUsersCount');
const newRoomNameInput = document.getElementById('newRoomName');
const newRoomDescriptionInput = document.getElementById('newRoomDescription');
const createNewRoomButton = document.getElementById('createNewRoomButton');
const refreshRoomsButton = document.getElementById('refreshRoomsButton');

function showNotification(message, type = 'info', duration = 3000) {
    const existingNotification = document.querySelector('.notification');
    if (existingNotification) {
        existingNotification.remove();
    }

    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <span class="notification-message">${escapeHtml(message)}</span>
            <button class="notification-close" onclick="this.parentElement.parentElement.remove()">×</button>
        </div>
    `;

    if (!document.querySelector('#notification-styles')) {
        const styles = document.createElement('style');
        styles.id = 'notification-styles';
        styles.textContent = `
            .notification {
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 1000;
                background: var(--bg-card);
                border: 1px solid var(--border-color);
                border-radius: var(--radius-md);
                box-shadow: var(--shadow-lg);
                padding: 1rem;
                max-width: 300px;
                animation: slideIn 0.3s ease-out;
            }
            .notification-success {
                border-left: 4px solid var(--success-color);
            }
            .notification-error {
                border-left: 4px solid var(--danger-color);
            }
            .notification-warning {
                border-left: 4px solid var(--warning-color);
            }
            .notification-content {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 1rem;
            }
            .notification-message {
                flex: 1;
                font-size: 0.875rem;
            }
            .notification-close {
                background: none;
                border: none;
                font-size: 1.25rem;
                cursor: pointer;
                color: var(--text-muted);
                padding: 0;
                width: 20px;
                height: 20px;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            .notification-close:hover {
                color: var(--text-primary);
            }
            @keyframes slideIn {
                from {
                    transform: translateX(100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
        `;
        document.head.appendChild(styles);
    }

    document.body.appendChild(notification);

    if (duration > 0) {
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, duration);
    }

    return notification;
}

window.addEventListener('DOMContentLoaded', () => {
    const savedToken = localStorage.getItem('chatToken');
    const savedUser = localStorage.getItem('chatUser');

    if (savedToken && savedUser) {
        try {
            currentToken = savedToken;
            currentUser = JSON.parse(savedUser);

            fetch('/api/auth/profile', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${currentToken}`
                }
            })
                .then(response => {
                    if (response.ok) {
                        return response.json();
                    } else {
                        throw new Error('Invalid token');
                    }
                })
                .then(data => {
                    showAuthStatus('Auto-login successful!', 'success');
                    initializeSocket();
                })
                .catch(error => {
                    localStorage.removeItem('chatToken');
                    localStorage.removeItem('chatUser');
                    showAuthStatus('Session expired, please login again', 'warning');
                });
        } catch (error) {
            console.error('Auto-login error:', error);
            showAuthStatus('Auto-login failed', 'error');
        }
    }
});

function showAuthStatus(message, type = 'info') {
    authStatus.textContent = message;
    authStatus.className = 'auth-status';

    switch (type) {
        case 'success':
            authStatus.style.color = 'var(--success-color)';
            authStatus.style.backgroundColor = 'rgba(16, 185, 129, 0.1)';
            break;
        case 'error':
            authStatus.style.color = 'var(--danger-color)';
            authStatus.style.backgroundColor = 'rgba(239, 68, 68, 0.1)';
            break;
        case 'warning':
            authStatus.style.color = 'var(--warning-color)';
            authStatus.style.backgroundColor = 'rgba(245, 158, 11, 0.1)';
            break;
        default:
            authStatus.style.color = 'var(--text-secondary)';
            authStatus.style.backgroundColor = 'var(--bg-tertiary)';
    }
}

function saveAuthData(token, user) {
    localStorage.setItem('chatToken', token);
    localStorage.setItem('chatUser', JSON.stringify(user));
}

function clearAuthData() {
    localStorage.removeItem('chatToken');
    localStorage.removeItem('chatUser');
    currentToken = null;
    currentUser = null;
}

function logout() {
    if (socket) {
        socket.disconnect();
    }
    clearAuthData();
    location.reload();
}

async function register() {
    const username = document.getElementById('authUsername').value.trim();
    const email = document.getElementById('authEmail').value.trim();
    const password = document.getElementById('authPassword').value;

    if (!username || !email || !password) {
        showAuthStatus('Please fill all fields', 'error');
        return;
    }

    if (password.length < 6) {
        showAuthStatus('Password must be at least 6 characters', 'error');
        return;
    }

    try {
        const response = await fetch('/api/auth/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ username, email, password }),
        });

        const data = await response.json();

        if (response.ok) {
            currentToken = data.token;
            currentUser = data.user;
            saveAuthData(currentToken, currentUser);
            showAuthStatus('Registration successful!', 'success');
            initializeSocket();
        } else {
            showAuthStatus(`Error: ${data.error}`, 'error');
        }
    } catch (error) {
        showAuthStatus('Network error', 'error');
    }
}

async function login() {
    const email = document.getElementById('authEmail').value.trim();
    const password = document.getElementById('authPassword').value;

    if (!email || !password) {
        showAuthStatus('Please fill email and password', 'error');
        return;
    }

    try {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email, password }),
        });

        const data = await response.json();

        if (response.ok) {
            currentToken = data.token;
            currentUser = data.user;
            saveAuthData(currentToken, currentUser);
            showAuthStatus('Login successful!', 'success');
            initializeSocket();
        } else {
            showAuthStatus(`Error: ${data.error}`, 'error');
        }
    } catch (error) {
        showAuthStatus('Network error', 'error');
    }
}

function initializeSocket() {
    if (socket) {
        socket.disconnect();
    }

    socket = io({
        auth: {
            token: currentToken
        },
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000
    });

    setupSocketEvents();
    updateUserInterface();

    authSection.style.display = 'none';
    chatSection.style.display = 'flex';
}

function setupSocketEvents() {
    socket.on('connect', () => {
        updateStatus('Connected', true);
        addMessage('Connected to server', 'system');
        showNotification('Connected to chat server', 'success', 2000);
    });

    socket.on('disconnect', () => {
        updateStatus('Disconnected', false);
        addMessage('Disconnected from server', 'system');
        showNotification('Disconnected from server', 'error', 3000);
    });

    socket.on('welcome', (data) => {
        addMessage(data.message, 'system', data.timestamp);
        updateOnlineUsersDisplay(data.onlineUsers);
    });

    socket.on('user_joined', (data) => {
        addMessage(data.message, 'system', data.timestamp);
        updateOnlineUsersDisplay(data.onlineUsers);
    });

    socket.on('new_message', (data) => {
        const isMyMessage = data.userId === currentUser.id;
        addMessage(data.text, isMyMessage ? 'my-message' : 'other-message', data.timestamp, data.username);
    });

    socket.on('room_joined', (data) => {
        currentRoom = data.room;
        currentRoomElement.textContent = data.room;

        messagesDiv.innerHTML = '';
        data.messages.forEach(message => {
            const isMyMessage = message.userId === currentUser.id;
            addMessage(message.text, isMyMessage ? 'my-message' : 'other-message', message.timestamp, message.username);
        });

        addMessage(`Joined room "${data.room}"`, 'system');
        updateRoomsDisplay();
        showNotification(`Joined room: ${data.room}`, 'success', 2000);
    });

    socket.on('user_joined_room', (data) => {
        if (data.room === currentRoom) {
            addMessage(data.message, 'system', data.timestamp);
        }
    });

    socket.on('user_left_room', (data) => {
        if (data.room === currentRoom) {
            addMessage(data.message, 'system', data.timestamp);
        }
    });

    socket.on('user_left', (data) => {
        addMessage(data.message, 'system', data.timestamp);
        updateOnlineUsersDisplay(data.onlineUsers);
    });

    socket.on('rooms_updated', (roomsList) => {
        console.log('Received rooms update:', roomsList);
        availableRooms = roomsList;
        updateRoomsDisplay();
    });

    socket.on('error', (data) => {
        addMessage(`Error: ${data.message}`, 'system');
        showNotification(`Error: ${data.message}`, 'error', 5000);
        console.error('Socket error:', data);
    });
}

function updateStatus(status, isConnected) {
    statusElement.textContent = status;
    statusElement.classList.toggle('connected', isConnected);
}

function updateRoomsDisplay() {
    roomsListElement.innerHTML = '';

    if (availableRooms.length === 0) {
        roomsListElement.innerHTML = `
            <div class="empty-state">
                No rooms available<br>
                <small>Create the first room!</small>
            </div>
        `;
        return;
    }

    availableRooms.forEach(room => {
        const roomElement = document.createElement('div');
        roomElement.className = 'room-item';
        if (room.name === currentRoom) {
            roomElement.classList.add('active');
        }

        roomElement.innerHTML = `
            <div class="room-header">
                <div class="room-name">${escapeHtml(room.name)}</div>
                <div class="room-user-count">${room.userCount || 0}</div>
            </div>
            <div class="room-info">
                ${room.description ? escapeHtml(room.description) : 'No description'}
            </div>
        `;

        roomElement.addEventListener('click', () => {
            joinRoom(room.name);
        });

        roomsListElement.appendChild(roomElement);
    });
}

function joinRoom(roomName) {
    if (!socket || !socket.connected) {
        showNotification('Not connected to server', 'error');
        return;
    }

    console.log('Joining room:', roomName);
    socket.emit('join_room', { name: roomName });
}

function createNewRoom() {
    const roomName = newRoomNameInput.value.trim();
    const roomDescription = newRoomDescriptionInput.value.trim();

    if (!roomName) {
        showNotification('Please enter a room name', 'error');
        return;
    }

    if (roomName.length < 3) {
        showNotification('Room name must be at least 3 characters', 'error');
        return;
    }

    if (roomName.length > 20) {
        showNotification('Room name must be less than 20 characters', 'error');
        return;
    }

    const roomExists = availableRooms.some(room => room.name === roomName.toLowerCase());
    if (roomExists) {
        showNotification(`Room "${roomName}" already exists`, 'error');
        return;
    }

    console.log('Creating new room:', roomName);
    socket.emit('join_room', {
        name: roomName,
        description: roomDescription
    });

    newRoomNameInput.value = '';
    newRoomDescriptionInput.value = '';
    showNotification(`Creating room: ${roomName}`, 'success', 2000);
}

function updateOnlineUsersDisplay(users) {
    onlineUsersListElement.innerHTML = '';
    onlineUsers = users || [];

    if (!users || users.length === 0) {
        onlineUsersListElement.innerHTML = `
            <div class="empty-state">
                No users online
            </div>
        `;
        onlineUsersCountElement.textContent = '0';
        return;
    }

    onlineUsersCountElement.textContent = users.length.toString();

    users.forEach(user => {
        const userElement = document.createElement('div');
        userElement.className = 'user-item';

        const isCurrentUser = user.id === currentUser.id;
        userElement.innerHTML = `
            <span>👤</span>
            <span>${escapeHtml(user.username)} ${isCurrentUser ? '(You)' : ''}</span>
        `;

        onlineUsersListElement.appendChild(userElement);
    });
}

function sendMessage() {
    if (!socket || !socket.connected) {
        showNotification('Not connected to server', 'error');
        return;
    }

    const text = messageInput.value.trim();

    if (!text) {
        return;
    }

    if (text.length > 1000) {
        showNotification('Message is too long (max 1000 characters)', 'error');
        return;
    }

    socket.emit('send_message', {
        text: text,
        room: currentRoom
    });
    messageInput.value = '';
}

function addMessage(text, className, timestamp = null, username = null) {
    const messageElement = document.createElement('div');
    messageElement.className = `message ${className}`;

    const time = timestamp ? new Date(timestamp) : new Date();
    const timeString = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    let messageContent = '';

    if (className === 'system') {
        messageContent = `
            <div class="message-bubble">${escapeHtml(text)}</div>
        `;
    } else {
        const displayName = className === 'my-message' ? 'You' : (username || 'Unknown');
        messageContent = `
            <div class="message-bubble">${escapeHtml(text)}</div>
            <div class="message-info">
                <span class="message-sender">${escapeHtml(displayName)}</span>
                <span class="message-time">${timeString}</span>
            </div>
        `;
    }

    messageElement.innerHTML = messageContent;
    messagesDiv.appendChild(messageElement);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

function clearMessages() {
    if (messagesDiv.children.length === 0) return;

    if (confirm('Are you sure you want to clear all messages?')) {
        messagesDiv.innerHTML = '';
        addMessage('Chat history cleared', 'system');
    }
}

function updateUserInterface() {
    if (currentUser) {
        currentUsernameElement.textContent = currentUser.username;
    }
    updateRoomsDisplay();
}

function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

registerButton.addEventListener('click', register);
loginButton.addEventListener('click', login);
logoutButton.addEventListener('click', logout);
sendButton.addEventListener('click', sendMessage);
clearButton.addEventListener('click', clearMessages);
createNewRoomButton.addEventListener('click', createNewRoom);
refreshRoomsButton.addEventListener('click', () => {
    if (socket && socket.connected) {
        socket.emit('get_rooms');
        addMessage('Refreshing rooms list...', 'system');
        showNotification('Refreshing rooms...', 'info', 1000);
    }
});

messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendMessage();
    }
});

newRoomNameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        createNewRoom();
    }
});

newRoomDescriptionInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        createNewRoom();
    }
});

document.getElementById('authUsername')?.addEventListener('input', function() {
    if (this.value.trim()) {
        document.getElementById('authEmail').focus();
    }
});

document.getElementById('authEmail')?.addEventListener('input', function() {
    if (this.value.trim()) {
        document.getElementById('authPassword').focus();
    }
});

function initializeSocket() {
    if (socket) {
        socket.disconnect();
    }

    socket = io({
        auth: {
            token: currentToken
        },
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000
    });

    setupSocketEvents();
    updateUserInterface();

    authSection.style.display = 'none';
    chatSection.style.display = 'flex';

    setTimeout(() => {
        messageInput.focus();
    }, 500);
}