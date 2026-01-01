const socket = io();

let currentUser = null;

// Подключение
socket.on('connect', () => {
    console.log('✅ Подключено к серверу');
    updateStatus('✅ Подключено', 'success');
});

socket.on('welcome', (data) => {
    console.log('Приветствие:', data);
});

// Регистрация
function login() {
    const username = document.getElementById('username').value.trim();
    if (!username) return alert('Введите имя');
    
    currentUser = {
        username: username,
        displayName: username,
        avatarColor: getRandomColor()
    };
    
    socket.emit('register', currentUser);
    
    document.getElementById('loginForm').style.display = 'none';
    document.getElementById('chat').style.display = 'block';
    document.getElementById('messageInput').focus();
}

// Отправка сообщения
function sendMessage() {
    const input = document.getElementById('messageInput');
    const text = input.value.trim();
    
    if (!text) return;
    
    socket.emit('sendMessage', { text });
    input.value = '';
}

// Получение сообщений
socket.on('newMessage', (message) => {
    displayMessage(message);
});

socket.on('initialData', (data) => {
    console.log('Получены данные:', data);
    data.messages.forEach(displayMessage);
});

// Отображение сообщения
function displayMessage(message) {
    const messagesDiv = document.getElementById('messages');
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message';
    
    const time = new Date(message.timestamp).toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit' 
    });
    
    messageDiv.innerHTML = `
        <strong style="color: ${message.sender.avatarColor}">
            ${message.sender.displayName}
        </strong>
        <span style="color: #8892b0; font-size: 0.9rem; margin-left: 10px;">
            ${time}
        </span>
        <div style="margin-top: 5px;">${escapeHtml(message.text)}</div>
    `;
    
    messagesDiv.appendChild(messageDiv);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

// Вспомогательные функции
function updateStatus(text, type) {
    const status = document.getElementById('status');
    status.textContent = text;
    status.style.color = type === 'success' ? '#00ffaa' : '#ff5555';
}

function getRandomColor() {
    const colors = ['#0066ff', '#00d4ff', '#00ffaa', '#ff6b9d', '#ffaa00'];
    return colors[Math.floor(Math.random() * colors.length)];
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Автовход для теста
if (window.location.hostname === 'localhost') {
    document.getElementById('username').value = 'Тест' + Math.floor(Math.random() * 1000);
    setTimeout(login, 1000);
}