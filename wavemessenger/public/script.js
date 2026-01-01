// Глобальные переменные
let socket = null;
let currentUser = null;
let users = [];
let messages = [];
let posts = [];
let channels = [];
let onlineUsers = [];

// Цвета для аватаров
const avatarColors = [
    'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
    'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
    'linear-gradient(135deg, #fa709a 0%, #fee140 100%)'
];

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', function() {
    // Проверяем, есть ли сохраненный пользователь
    const savedUser = localStorage.getItem('wave_user');
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
        connectToServer();
    }
    
    // Подключаем обработчики событий
    setupEventListeners();
});

// Подключение к серверу Socket.IO
function connectToServer() {
    socket = io();
    
    // Обработка подключения
    socket.on('connect', () => {
        console.log('Подключено к серверу');
        
        // Регистрируем пользователя
        socket.emit('register', {
            username: currentUser.username,
            displayName: currentUser.displayName,
            avatarColor: currentUser.avatarColor
        });
    });
    
    // Получение начальных данных
    socket.on('initialData', (data) => {
        messages = data.messages || [];
        posts = data.posts || [];
        channels = data.channels || [];
        users = data.users || [];
        
        showApp();
        updateUI();
    });
    
    // Новое сообщение
    socket.on('newMessage', (message) => {
        messages.push(message);
        if (document.getElementById('chatSection').classList.contains('active')) {
            displayMessage(message);
        }
    });
    
    // Новый пост
    socket.on('newPost', (post) => {
        posts.unshift(post);
        if (document.getElementById('feedSection').classList.contains('active')) {
            displayPost(post);
        }
    });
    
    // Обновление поста
    socket.on('postUpdated', (post) => {
        const index = posts.findIndex(p => p.id === post.id);
        if (index !== -1) {
            posts[index] = post;
            updatePostDisplay(post);
        }
    });
    
    // Новый канал
    socket.on('newChannel', (channel) => {
        channels.push(channel);
        displayChannel(channel);
    });
    
    // Обновление канала
    socket.on('channelUpdated', (channel) => {
        const index = channels.findIndex(c => c.id === channel.id);
        if (index !== -1) {
            channels[index] = channel;
            updateChannelDisplay(channel);
        }
    });
    
    // Онлайн пользователи
    socket.on('onlineUsers', (users) => {
        onlineUsers = users;
        updateOnlineList();
    });
    
    // Пользователь присоединился
    socket.on('userJoined', (user) => {
        showNotification(`${user.displayName} присоединился(ась)`);
    });
    
    // Пользователь вышел
    socket.on('userLeft', (user) => {
        showNotification(`${user.displayName} вышел(ла)`);
    });
}

// Настройка обработчиков событий
function setupEventListeners() {
    // Навигация по страницам
    document.getElementById('messageInput')?.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });
    
    document.getElementById('postInput')?.addEventListener('keypress', function(e) {
        if (e.key === 'Enter' && e.ctrlKey) {
            createPost();
        }
    });
}

// Отображение приложения
function showApp() {
    document.getElementById('welcomePage').classList.remove('active');
    document.getElementById('registerPage').classList.remove('active');
    document.getElementById('loginPage').classList.remove('active');
    document.getElementById('appPage').classList.add('active');
    
    // Показываем ленту по умолчанию
    showSection('feed');
}

// Регистрация
function register() {
    const username = document.getElementById('regUsername').value.trim();
    const displayName = document.getElementById('regDisplayName').value.trim();
    const password = document.getElementById('regPassword').value.trim();
    
    // Простая валидация
    if (!username || !displayName || !password) {
        showNotification('Заполните все поля', 'error');
        return;
    }
    
    if (password.length < 6) {
        showNotification('Пароль должен быть не короче 6 символов', 'error');
        return;
    }
    
    // Сохраняем пользователя
    currentUser = {
        id: Date.now().toString(),
        username: username,
        displayName: displayName,
        avatarColor: avatarColors[Math.floor(Math.random() * avatarColors.length)],
        password: password
    };
    
    localStorage.setItem('wave_user', JSON.stringify(currentUser));
    
    // Подключаемся к серверу
    connectToServer();
    
    showNotification('Регистрация успешна!', 'success');
}

// Вход
function login() {
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value.trim();
    
    // В реальном приложении здесь была бы проверка с сервером
    // Для демо просто создаем пользователя если его нет
    const savedUser = localStorage.getItem('wave_user');
    if (savedUser) {
        const user = JSON.parse(savedUser);
        if (user.username === username && user.password === password) {
            currentUser = user;
            connectToServer();
            return;
        }
    }
    
    showNotification('Неверный логин или пароль', 'error');
}

// Обновление UI
function updateUI() {
    // Обновляем информацию пользователя
    if (currentUser) {
        document.getElementById('userName').textContent = currentUser.displayName;
        document.getElementById('userAvatar').textContent = currentUser.displayName[0];
        document.getElementById('userAvatar').style.background = currentUser.avatarColor;
    }
    
    // Загружаем данные для текущей секции
    if (document.getElementById('feedSection').classList.contains('active')) {
        loadPosts();
    } else if (document.getElementById('chatSection').classList.contains('active')) {
        loadMessages();
    } else if (document.getElementById('channelsSection').classList.contains('active')) {
        loadChannels();
    }
}

// Переключение секций
function showSection(sectionName) {
    // Скрываем все секции
    document.querySelectorAll('.section').forEach(section => {
        section.classList.remove('active');
    });
    
    // Обновляем активные кнопки
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Показываем выбранную секцию
    document.getElementById(sectionName + 'Section').classList.add('active');
    
    // Обновляем навигацию
    const navItem = document.querySelector(`.nav-item[onclick*="${sectionName}"]`);
    if (navItem) navItem.classList.add('active');
    
    const navBtn = document.querySelector(`.nav-btn[onclick*="${sectionName}"]`);
    if (navBtn) navBtn.classList.add('active');
    
    // Загружаем данные
    switch(sectionName) {
        case 'feed':
            loadPosts();
            break;
        case 'chat':
            loadMessages();
            break;
        case 'channels':
            loadChannels();
            break;
        case 'online':
            updateOnlineList();
            break;
        case 'profile':
            loadProfile();
            break;
    }
}

// Загрузка постов
function loadPosts() {
    const container = document.getElementById('postsContainer');
    
    if (posts.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-newspaper"></i>
                <p>Здесь пока нет постов. Будьте первым!</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = '';
    posts.forEach(post => {
        displayPost(post);
    });
}

// Отображение поста
function displayPost(post) {
    const container = document.getElementById('postsContainer');
    
    const postElement = document.createElement('div');
    postElement.className = 'post';
    postElement.id = `post_${post.id}`;
    
    const user = users.find(u => u.username === post.username) || post;
    const timeAgo = getTimeAgo(new Date(post.createdAt));
    
    postElement.innerHTML = `
        <div class="post-header">
            <div class="avatar" style="background: ${user.avatarColor || avatarColors[0]}">
                ${user.displayName ? user.displayName[0] : 'U'}
            </div>
            <div>
                <h4>${post.displayName}</h4>
                <p class="post-time">@${post.username} · ${timeAgo}</p>
            </div>
        </div>
        <div class="post-content">${escapeHtml(post.content)}</div>
        <div class="post-actions">
            <span onclick="likePost('${post.id}')">
                <i class="fas fa-heart"></i> ${post.likes.length || 0}
            </span>
            <span onclick="commentOnPost('${post.id}')">
                <i class="fas fa-comment"></i> ${post.comments.length || 0}
            </span>
        </div>
    `;
    
    container.prepend(postElement);
}

// Создание поста
function createPost() {
    const content = document.getElementById('postInput').value.trim();
    
    if (!content) {
        showNotification('Введите текст поста', 'warning');
        return;
    }
    
    if (!socket || !currentUser) {
        showNotification('Соединение потеряно', 'error');
        return;
    }
    
    socket.emit('createPost', {
        content: content
    });
    
    document.getElementById('postInput').value = '';
    showNotification('Пост отправлен!', 'success');
}

// Лайк поста
function likePost(postId) {
    if (!socket || !currentUser) return;
    
    socket.emit('likePost', {
        postId: postId,
        userId: currentUser.id
    });
}

// Загрузка сообщений
function loadMessages() {
    const container = document.getElementById('messagesContainer');
    
    if (messages.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-comments"></i>
                <p>Начните общение в общем чате!</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = '';
    messages.forEach(message => {
        displayMessage(message);
    });
    
    // Прокручиваем вниз
    container.scrollTop = container.scrollHeight;
}

// Отображение сообщения
function displayMessage(message) {
    const container = document.getElementById('messagesContainer');
    const isCurrentUser = message.sender.username === currentUser?.username;
    
    const messageElement = document.createElement('div');
    messageElement.className = `message ${isCurrentUser ? 'sent' : ''}`;
    
    const time = new Date(message.timestamp).toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit' 
    });
    
    messageElement.innerHTML = `
        <div class="message-header">
            <div class="avatar" style="background: ${message.sender.avatarColor}">
                ${message.sender.displayName ? message.sender.displayName[0] : 'U'}
            </div>
            <div>
                <strong>${message.sender.displayName}</strong>
                <span class="message-time">${time}</span>
            </div>
        </div>
        <div class="message-text">${escapeHtml(message.text)}</div>
    `;
    
    container.appendChild(messageElement);
    
    // Прокручиваем вниз
    container.scrollTop = container.scrollHeight;
}

// Отправка сообщения
function sendMessage() {
    const input = document.getElementById('messageInput');
    const text = input.value.trim();
    
    if (!text) {
        showNotification('Введите сообщение', 'warning');
        return;
    }
    
    if (!socket || !currentUser) {
        showNotification('Соединение потеряно', 'error');
        return;
    }
    
    socket.emit('sendMessage', {
        text: text,
        channelId: 'general'
    });
    
    input.value = '';
}

// Загрузка каналов
function loadChannels() {
    const container = document.getElementById('channelsContainer');
    
    // Всегда показываем общий канал
    container.innerHTML = `
        <div class="channel">
            <div class="channel-info">
                <i class="fas fa-hashtag"></i>
                <div>
                    <h4>general</h4>
                    <p>Основной канал для общения</p>
                </div>
            </div>
            <button class="btn btn-primary" onclick="joinChannel('general')">
                Присоединиться
            </button>
        </div>
    `;
    
    // Добавляем остальные каналы
    channels.forEach(channel => {
        displayChannel(channel);
    });
}

// Отображение канала
function displayChannel(channel) {
    const container = document.getElementById('channelsContainer');
    
    const channelElement = document.createElement('div');
    channelElement.className = 'channel';
    channelElement.id = `channel_${channel.id}`;
    
    channelElement.innerHTML = `
        <div class="channel-info">
            <i class="fas fa-hashtag"></i>
            <div>
                <h4>${channel.name}</h4>
                <p>${channel.description}</p>
                <small>Создал: ${channel.owner} · ${channel.members.length} участников</small>
            </div>
        </div>
        <button class="btn btn-primary" onclick="joinChannel('${channel.id}')">
            Присоединиться
        </button>
    `;
    
    container.appendChild(channelElement);
}

// Присоединение к каналу
function joinChannel(channelId) {
    if (!socket) return;
    
    socket.emit('joinChannel', channelId);
    showNotification('Вы присоединились к каналу', 'success');
}

// Создание канала
function createChannel() {
    const name = document.getElementById('channelName').value.trim();
    const desc = document.getElementById('channelDesc').value.trim();
    
    if (!name) {
        showNotification('Введите название канала', 'warning');
        return;
    }
    
    if (!socket || !currentUser) return;
    
    socket.emit('createChannel', {
        name: name,
        description: desc,
        type: 'public'
    });
    
    closeModal();
    document.getElementById('channelName').value = '';
    document.getElementById('channelDesc').value = '';
    showNotification('Канал создан!', 'success');
}

// Обновление списка онлайн пользователей
function updateOnlineList() {
    const container = document.getElementById('onlineUsersList');
    const countElement = document.getElementById('onlineCount');
    
    if (countElement) {
        countElement.textContent = onlineUsers.length;
    }
    
    if (!container) return;
    
    if (onlineUsers.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-users"></i>
                <p>Никого нет онлайн</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = onlineUsers.map(user => `
        <div class="user-item">
            <div class="avatar" style="background: ${user.avatarColor}">
                ${user.displayName ? user.displayName[0] : 'U'}
            </div>
            <div>
                <strong>${user.displayName}</strong>
                <p>@${user.username}</p>
            </div>
        </div>
    `).join('');
}

// Загрузка профиля
function loadProfile() {
    const container = document.getElementById('profileContent');
    
    if (!currentUser) return;
    
    container.innerHTML = `
        <div class="profile-header">
            <div class="avatar-large" style="background: ${currentUser.avatarColor}">
                ${currentUser.displayName ? currentUser.displayName[0] : 'U'}
            </div>
            <h2>${currentUser.displayName}</h2>
            <p>@${currentUser.username}</p>
        </div>
        <div class="profile-stats">
            <div class="stat">
                <strong>${posts.filter(p => p.username === currentUser.username).length}</strong>
                <span>Постов</span>
            </div>
            <div class="stat">
                <strong>${onlineUsers.filter(u => u.username !== currentUser.username).length}</strong>
                <span>Онлайн</span>
            </div>
        </div>
        <div class="profile-actions">
            <button class="btn btn-secondary" onclick="editProfile()">
                <i class="fas fa-edit"></i> Редактировать
            </button>
            <button class="btn btn-secondary" onclick="logout()">
                <i class="fas fa-sign-out-alt"></i> Выйти
            </button>
        </div>
    `;
}

// Управление модальными окнами
function showNewChannelModal() {
    document.getElementById('newChannelModal').classList.add('active');
}

function closeModal() {
    document.getElementById('newChannelModal').classList.remove('active');
}

// Управление боковым меню
function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('active');
}

// Навигация по страницам
function showWelcome() {
    document.getElementById('registerPage').classList.remove('active');
    document.getElementById('loginPage').classList.remove('active');
    document.getElementById('appPage').classList.remove('active');
    document.getElementById('welcomePage').classList.add('active');
}

function showRegister() {
    document.getElementById('welcomePage').classList.remove('active');
    document.getElementById('loginPage').classList.remove('active');
    document.getElementById('appPage').classList.remove('active');
    document.getElementById('registerPage').classList.add('active');
}

function showLogin() {
    document.getElementById('welcomePage').classList.remove('active');
    document.getElementById('registerPage').classList.remove('active');
    document.getElementById('appPage').classList.remove('active');
    document.getElementById('loginPage').classList.add('active');
}

// Выход
function logout() {
    if (socket) {
        socket.disconnect();
    }
    
    localStorage.removeItem('wave_user');
    currentUser = null;
    showWelcome();
}

// Уведомления
function showNotification(message, type = 'info') {
    const notification = document.getElementById('notification');
    const text = document.getElementById('notificationText');
    
    text.textContent = message;
    notification.classList.add('show');
    
    setTimeout(() => {
        notification.classList.remove('show');
    }, 3000);
}

// Вспомогательные функции
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function getTimeAgo(date) {
    const seconds = Math.floor((new Date() - date) / 1000);
    
    const intervals = {
        год: 31536000,
        месяц: 2592000,
        неделя: 604800,
        день: 86400,
        час: 3600,
        минута: 60,
        секунда: 1
    };
    
    for (const [name, secondsIn] of Object.entries(intervals)) {
        const interval = Math.floor(seconds / secondsIn);
        if (interval >= 1) {
            return `${interval} ${name}${interval >= 2 && interval <= 4 ? 'а' : interval >= 5 && interval <= 20 ? 'ов' : name === 'месяц' ? 'ев' : name === 'день' ? 'дней' : 'ов'}`;
        }
    }
    
    return 'только что';
}

// Поиск пользователей (демо)
function searchUsers() {
    const query = document.getElementById('userSearch').value.toLowerCase();
    const results = document.getElementById('searchResults');
    
    if (!query) {
        results.innerHTML = '<p>Введите поисковый запрос</p>';
        return;
    }
    
    const filteredUsers = users.filter(user => 
        user.username.toLowerCase().includes(query) ||
        user.displayName.toLowerCase().includes(query)
    );
    
    if (filteredUsers.length === 0) {
        results.innerHTML = '<p>Пользователи не найдены</p>';
        return;
    }
    
    results.innerHTML = filteredUsers.map(user => `
        <div class="user-item">
            <div class="avatar" style="background: ${user.avatarColor}">
                ${user.displayName ? user.displayName[0] : 'U'}
            </div>
            <div>
                <strong>${user.displayName}</strong>
                <p>@${user.username}</p>
                <button class="btn btn-small" onclick="sendMessageToUser('${user.username}')">
                    Написать
                </button>
            </div>
        </div>
    `).join('');
}
// В клиенте (public/script.js):
const socket = io('https://wavemessenger.onrender.com');