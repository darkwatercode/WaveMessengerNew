// ========== КОНФИГУРАЦИЯ ==========
const CONFIG = {
    appName: "WaveMessenger Pro",
    version: "3.0",
    serverUrl: window.location.origin,
    reconnectAttempts: 5,
    reconnectDelay: 3000,
    features: {
        aiEnabled: true,
        notifications: true,
        sounds: true,
        animations: true
    }
};

// ========== ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ==========
let socket = null;
let currentUser = null;
let currentChannel = 'general';
let messageQueue = [];
let isTyping = false;
let typingTimeout = null;
let reconnectCount = 0;
let notifications = [];
let onlineUsers = [];
let channels = [];
let aiContext = [];

// Эмодзи
const emojiCategories = {
    smileys: ['😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩', '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣', '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡', '🤬', '🤯', '😳', '🥵', '🥶', '😱', '😨', '😰', '😥', '😓', '🤗', '🤔', '🤭', '🤫', '🤥', '😶', '😐', '😑', '😬', '🙄', '😯', '😦', '😧', '😮', '😲', '🥱', '😴', '🤤', '😪', '😵', '🤐', '🥴', '🤢', '🤮', '🤧', '😷', '🤒', '🤕', '🤑', '🤠'],
    objects: ['⌚', '📱', '📲', '💻', '⌨️', '🖥️', '🖨️', '🖱️', '🖲️', '🕹️', '🗜️', '💽', '💾', '💿', '📀', '📼', '📷', '📸', '📹', '🎥', '📽️', '🎞️', '📞', '☎️', '📟', '📠', '📺', '📻', '🎙️', '🎚️', '🎛️', '🧭', '⏱️', '⏲️', '⏰', '🕰️', '⌛', '⏳', '📡', '🔋', '🔌', '💡', '🔦', '🕯️', '🪔', '🧯', '🛢️', '💸', '💵', '💴', '💶', '💷', '💰', '💳', '💎', '⚖️', '🧰', '🔧', '🔨', '⚒️', '🛠️', '⛏️', '🔩', '⚙️', '🧱', '⛓️', '🧲', '🔫', '💣', '🧨', '🪓', '🔪', '🗡️', '⚔️', '🛡️', '🚬', '⚰️', '🪦', '⚱️', '🏺', '🔮', '📿', '🧿', '💈', '⚗️', '🔭', '🔬', '🕳️', '🩹', '🩺', '💊', '💉', '🩸', '🧬', '🦠', '🧫', '🧪', '🌡️', '🧹', '🧺', '🧻', '🚽', '🚰', '🚿', '🛁', '🛀', '🧼', '🪒', '🧽', '🧴', '🛎️', '🔑', '🗝️', '🚪', '🪑', '🛋️', '🛏️', '🧸', '🖼️', '🛍️', '🛒', '🎁', '🎈', '🎏', '🎀', '🎊', '🎉', '🎎', '🏮', '🎐', '🧧', '✉️', '📩', '📨', '📧', '💌', '📥', '📤', '📦', '🏷️', '📪', '📫', '📬', '📭', '📮', '📯', '📜', '📃', '📄', '📑', '🧾', '📊', '📈', '📉', '🗒️', '🗓️', '📆', '📅', '🗑️', '📇', '🗃️', '🗳️', '🗄️', '📋', '📁', '📂', '🗂️', '🗞️', '📰', '📓', '📔', '📒', '📕', '📗', '📘', '📙', '📚', '📖', '🔖', '🧷', '🔗', '📎', '🖇️', '📏', '📐', '✂️', '🗃️', '📌', '📍', '🚩', '🏳️', '🏴', '🏁', '🚩', '🏳️‍🌈', '🏴‍☠️', '🇦🇫', '🇦🇽', '🇦🇱', '🇩🇿', '🇦🇸', '🇦🇩', '🇦🇴', '🇦🇮', '🇦🇶', '🇦🇬', '🇦🇷', '🇦🇲', '🇦🇼', '🇦🇺', '🇦🇹', '🇦🇿', '🇧🇸', '🇧🇭', '🇧🇩', '🇧🇧', '🇧🇾', '🇧🇪', '🇧🇿', '🇧🇯', '🇧🇲', '🇧🇹', '🇧🇴', '🇧🇦', '🇧🇼', '🇧🇷', '🇮🇴', '🇻🇬', '🇧🇳', '🇧🇬', '🇧🇫', '🇧🇮', '🇰🇭', '🇨🇲', '🇨🇦', '🇮🇨', '🇨🇻', '🇧🇶', '🇰🇾', '🇨🇫', '🇹🇩', '🇨🇱', '🇨🇳', '🇨🇽', '🇨🇨', '🇨🇴', '🇰🇲', '🇨🇬', '🇨🇩', '🇨🇰', '🇨🇷', '🇨🇮', '🇭🇷', '🇨🇺', '🇨🇼', '🇨🇾', '🇨🇿', '🇩🇰', '🇩🇯', '🇩🇲', '🇩🇴', '🇪🇨', '🇪🇬', '🇸🇻', '🇬🇶', '🇪🇷', '🇪🇪', '🇪🇹', '🇪🇺', '🇫🇰', '🇫🇴', '🇫🇯', '🇫🇮', '🇫🇷', '🇬🇫', '🇵🇫', '🇹🇫', '🇬🇦', '🇬🇲', '🇬🇪', '🇩🇪', '🇬🇭', '🇬🇮', '🇬🇷', '🇬🇱', '🇬🇩', '🇬🇵', '🇬🇺', '🇬🇹', '🇬🇬', '🇬🇳', '🇬🇼', '🇬🇾', '🇭🇹', '🇭🇳', '🇭🇰', '🇭🇺', '🇮🇸', '🇮🇳', '🇮🇩', '🇮🇷', '🇮🇶', '🇮🇪', '🇮🇲', '🇮🇱', '🇮🇹', '🇯🇲', '🇯🇵', '🏳️‍⚧️'],
    nature: ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐽', '🐸', '🐵', '🙈', '🙉', '🙊', '🐒', '🐔', '🐧', '🐦', '🐤', '🐣', '🐥', '🦆', '🦅', '🦉', '🦇', '🐺', '🐗', '🐴', '🦄', '🐝', '🐛', '🦋', '🐌', '🐞', '🐜', '🦗', '🕷️', '🕸️', '🦂', '🐢', '🐍', '🦎', '🦖', '🦕', '🐙', '🦑', '🦐', '🦞', '🦀', '🐡', '🐠', '🐟', '🐬', '🐳', '🐋', '🦈', '🐊', '🐅', '🐆', '🦓', '🦍', '🦧', '🐘', '🦛', '🦏', '🐪', '🐫', '🦒', '🦘', '🐃', '🐂', '🐄', '🐎', '🐖', '🐏', '🐑', '🦙', '🐐', '🦌', '🐕', '🐩', '🦮', '🐕‍🦺', '🐈', '🐈‍⬛', '🐓', '🦃', '🦚', '🦜', '🦢', '🦩', '🐇', '🦝', '🦨', '🦡', '🦦', '🦥', '🐁', '🐀', '🦔', '🌵', '🎄', '🌲', '🌳', '🌴', '🌱', '🌿', '☘️', '🍀', '🎍', '🎋', '🍃', '🍂', '🍁', '🍄', '🐚', '🌾', '💐', '🌷', '🌹', '🥀', '🌺', '🌸', '🌼', '🌻', '🌞', '🌝', '🌛', '🌜', '🌚', '🌕', '🌖', '🌗', '🌘', '🌑', '🌒', '🌓', '🌔', '🌙', '🌎', '🌍', '🌏', '🪐', '💫', '⭐', '🌟', '✨', '⚡', '☄️', '💥', '🔥', '🌪️', '🌈', '☀️', '🌤️', '⛅', '🌥️', '☁️', '🌦️', '🌧️', '⛈️', '🌩️', '🌨️', '❄️', '☃️', '⛄', '🌬️', '💨', '💧', '💦', '☔', '☂️', '🌊', '🌫️'],
    food: ['🍏', '🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🫐', '🍈', '🍒', '🍑', '🥭', '🍍', '🥥', '🥝', '🍅', '🍆', '🥑', '🥦', '🥬', '🥒', '🌶️', '🫑', '🌽', '🥕', '🫒', '🧄', '🧅', '🥔', '🍠', '🥐', '🥯', '🍞', '🥖', '🥨', '🧀', '🥚', '🍳', '🧈', '🥞', '🧇', '🥓', '🥩', '🍗', '🍖', '🦴', '🌭', '🍔', '🍟', '🍕', '🫓', '🥪', '🥙', '🧆', '🌮', '🌯', '🫔', '🥗', '🥘', '🫕', '🥫', '🍝', '🍜', '🍲', '🍛', '🍣', '🍱', '🥟', '🦪', '🍤', '🍙', '🍚', '🍘', '🍥', '🥠', '🥮', '🍢', '🍡', '🍧', '🍨', '🍦', '🥧', '🧁', '🍰', '🎂', '🍮', '🍭', '🍬', '🍫', '🍿', '🍩', '🍪', '🌰', '🥜', '🍯', '🥛', '🍼', '🫖', '☕', '🍵', '🧃', '🥤', '🍶', '🍺', '🍻', '🥂', '🍷', '🥃', '🍸', '🍹', '🧉', '🍾', '🧊', '🥄', '🍴', '🍽️', '🥣', '🥡', '🥢', '🧂']
};

// ========== ИНИЦИАЛИЗАЦИЯ ==========
document.addEventListener('DOMContentLoaded', function() {
    console.log(`🚀 ${CONFIG.appName} v${CONFIG.version} загружается...`);
    
    // Инициализация
    initTheme();
    initEventListeners();
    initUI();
    
    // Проверка сохранённого пользователя
    const savedUser = localStorage.getItem('wave_user');
    if (savedUser) {
        try {
            currentUser = JSON.parse(savedUser);
            connectToServer();
        } catch (e) {
            console.error('Ошибка загрузки пользователя:', e);
        }
    }
    
    // Загрузка данных
    loadChannels();
    loadEmojis();
    updateWelcomeStats();
    
    // Запуск фоновых задач
    startBackgroundTasks();
});

// ========== THEME ==========
function initTheme() {
    const savedTheme = localStorage.getItem('wave_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    
    // Обновляем иконку темы
    const themeIcon = document.querySelector('.theme-toggle i');
    if (themeIcon) {
        themeIcon.className = savedTheme === 'dark' ? 'fas fa-moon' : 'fas fa-sun';
    }
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('wave_theme', newTheme);
    
    // Обновляем иконку
    const themeIcon = document.querySelector('.theme-toggle i');
    if (themeIcon) {
        themeIcon.className = newTheme === 'dark' ? 'fas fa-moon' : 'fas fa-sun';
    }
    
    showNotification(`Тема изменена на ${newTheme === 'dark' ? 'тёмную' : 'светлую'}`, 'success');
}

// ========== SOCKET.IO ==========
function connectToServer() {
    if (socket?.connected) {
        console.log('Socket уже подключен');
        return;
    }
    
    socket = io(CONFIG.serverUrl, {
        reconnection: true,
        reconnectionAttempts: CONFIG.reconnectAttempts,
        reconnectionDelay: CONFIG.reconnectDelay,
        transports: ['websocket', 'polling']
    });
    
    // События
    socket.on('connect', onSocketConnect);
    socket.on('disconnect', onSocketDisconnect);
    socket.on('connect_error', onSocketError);
    
    // Сообщения от сервера
    socket.on('welcome', onWelcome);
    socket.on('registered', onRegistered);
    socket.on('message', onMessage);
    socket.on('userJoined', onUserJoined);
    socket.on('userLeft', onUserLeft);
    socket.on('onlineUsers', onOnlineUsers);
    socket.on('newChannel', onNewChannel);
    socket.on('newPost', onNewPost);
    socket.on('typing', onTyping);
    socket.on('notification', onServerNotification);
    socket.on('error', onError);
    
    // Админ события
    socket.on('adminWelcome', onAdminWelcome);
    socket.on('adminStats', onAdminStats);
    socket.on('userKicked', onUserKicked);
    
    console.log('Попытка подключения к серверу...');
}

function onSocketConnect() {
    console.log('✅ Подключено к серверу Socket.IO');
    updateConnectionStatus(true);
    
    // Регистрируем пользователя
    if (currentUser) {
        socket.emit('register', {
            username: currentUser.username,
            displayName: currentUser.displayName,
            avatarColor: currentUser.avatarColor
        });
    }
    
    // Сбрасываем счётчик переподключений
    reconnectCount = 0;
    
    // Показываем уведомление
    showNotification('Подключено к серверу', 'success');
}

function onSocketDisconnect(reason) {
    console.log('❌ Отключено от сервера:', reason);
    updateConnectionStatus(false);
    
    if (reason === 'io server disconnect') {
        // Сервер принудительно отключил
        showNotification('Сервер отключил соединение', 'error');
    } else {
        // Пытаемся переподключиться
        reconnectCount++;
        const delay = Math.min(1000 * reconnectCount, 10000);
        
        showNotification(`Переподключение через ${delay/1000}сек... (${reconnectCount}/${CONFIG.reconnectAttempts})`, 'warning');
        
        setTimeout(() => {
            if (reconnectCount < CONFIG.reconnectAttempts) {
                socket.connect();
            }
        }, delay);
    }
}

function onSocketError(error) {
    console.error('Ошибка подключения:', error);
    showNotification('Ошибка подключения к серверу', 'error');
}

// ========== ОБРАБОТЧИКИ СОБЫТИЙ ==========
function onWelcome(data) {
    console.log('Приветствие от сервера:', data);
    updateWelcomeStats(data);
}

function onRegistered(data) {
    console.log('Зарегистрирован:', data);
    currentUser = data.user;
    
    // Сохраняем пользователя
    localStorage.setItem('wave_user', JSON.stringify(currentUser));
    
    // Обновляем UI
    updateUserUI(currentUser);
    
    // Загружаем данные
    if (data.initialData) {
        loadMessages(data.initialData.messages);
        loadChannelsData(data.initialData.channels);
        updateOnlineList(data.initialData.onlineUsers);
    }
    
    // Показываем приложение
    showApp();
    
    // Админ доступ
    if (currentUser.isAdmin) {
        showAdminFeatures();
    }
    
    showNotification(`Добро пожаловать, ${currentUser.displayName}!`, 'success');
}

function onMessage(message) {
    console.log('Новое сообщение:', message);
    
    // Добавляем в очередь
    messageQueue.push(message);
    
    // Отображаем сообщение
    displayMessage(message);
    
    // Обновляем счётчик непрочитанных
    if (!isMessageVisible(message)) {
        updateUnreadCount(1);
    }
    
    // Воспроизводим звук
    if (CONFIG.features.sounds && message.userId !== currentUser?.id) {
        playNotificationSound();
    }
    
    // Показываем уведомление (если не в активном окне)
    if (document.hidden && message.userId !== currentUser?.id) {
        showDesktopNotification(message);
    }
}

function onUserJoined(data) {
    console.log('Пользователь присоединился:', data);
    
    // Обновляем список онлайн
    if (data.user) {
        addOnlineUser(data.user);
    }
    
    // Показываем уведомление
    if (data.user && data.user.id !== currentUser?.id) {
        showNotification(`${data.user.displayName} присоединился`, 'info');
    }
}

function onUserLeft(data) {
    console.log('Пользователь вышел:', data);
    
    // Обновляем список онлайн
    if (data.userId) {
        removeOnlineUser(data.userId);
    }
    
    // Обновляем счётчик
    updateOnlineCounter();
}

function onOnlineUsers(users) {
    console.log('Онлайн пользователи:', users);
    updateOnlineList(users);
}

function onNewChannel(channel) {
    console.log('Новый канал:', channel);
    addChannel(channel);
}

function onNewPost(post) {
    console.log('Новый пост:', post);
    displayPost(post);
}

function onTyping(data) {
    console.log('Печатает:', data);
    showTypingIndicator(data.username, data.isTyping);
}

function onServerNotification(data) {
    console.log('Уведомление от сервера:', data);
    showNotification(data.message, data.type || 'info');
}

function onError(data) {
    console.error('Ошибка от сервера:', data);
    showNotification(data.message || 'Ошибка сервера', 'error');
}

// ========== АДМИН СИСТЕМА ==========
function onAdminWelcome(data) {
    console.log('Админ приветствие:', data);
    
    // Показываем секретные функции
    showAdminFeatures();
    
    // Сохраняем ключ
    localStorage.setItem('wave_admin_key', data.secretKey);
    
    // Специальное уведомление
    showNotification(`👑 Добро пожаловать в админ-панель, ${currentUser.displayName}!`, 'success');
}

function onAdminStats(data) {
    console.log('Админ статистика:', data);
    updateAdminStats(data);
}

function onUserKicked(data) {
    console.log('Пользователь кикнут:', data);
    showNotification(`Пользователь ${data.username} был отключён администратором`, 'warning');
}

// ========== UI ФУНКЦИИ ==========
function showWelcome() {
    switchPage('welcomePage');
    document.title = `${CONFIG.appName} - Главная`;
}

function showRegister() {
    switchPage('registerPage');
    document.title = `${CONFIG.appName} - Регистрация`;
}

function showLogin() {
    switchPage('loginPage');
    document.title = `${CONFIG.appName} - Вход`;
}

function showApp() {
    switchPage('appPage');
    document.title = `${CONFIG.appName} - Чат`;
    updateUI();
}

function showSection(sectionId) {
    // Скрываем все секции
    document.querySelectorAll('.section').forEach(section => {
        section.classList.remove('active');
    });
    
    // Скрываем все навигационные кнопки
    document.querySelectorAll('.nav-item, .nav-btn').forEach(nav => {
        nav.classList.remove('active');
    });
    
    // Показываем выбранную секцию
    const section = document.getElementById(sectionId + 'Section');
    if (section) {
        section.classList.add('active');
    }
    
    // Активируем соответствующую кнопку
    const navItem = document.querySelector(`[onclick*="${sectionId}"]`);
    if (navItem) {
        navItem.classList.add('active');
    }
    
    // Обновляем заголовок
    updateSectionTitle(sectionId);
    
    // Загружаем данные для секции
    loadSectionData(sectionId);
}

function switchPage(pageId) {
    // Анимация перехода
    document.querySelectorAll('.page').forEach(page => {
        if (page.classList.contains('active')) {
            page.style.animation = 'fadeOut 0.3s forwards';
            setTimeout(() => {
                page.classList.remove('active');
                page.style.animation = '';
            }, 300);
        }
    });
    
    setTimeout(() => {
        const targetPage = document.getElementById(pageId);
        if (targetPage) {
            targetPage.classList.add('active');
            targetPage.style.animation = 'fadeIn 0.3s forwards';
        }
    }, 300);
}

// ========== СООБЩЕНИЯ ==========
function sendMessage() {
    if (!socket || !socket.connected) {
        showNotification('Нет подключения к серверу', 'error');
        return;
    }
    
    const input = document.getElementById('messageInput');
    const text = input?.value.trim();
    
    if (!text) return;
    
    // Создаём сообщение
    const message = {
        text: text,
        channel: currentChannel,
        timestamp: new Date().toISOString()
    };
    
    // Отправляем на сервер
    socket.emit('message', message);
    
    // Очищаем поле ввода
    if (input) {
        input.value = '';
        autoResizeTextarea(input);
    }
    
    // Сбрасываем индикатор набора
    if (isTyping) {
        socket.emit('typing', false);
        isTyping = false;
    }
}

function displayMessage(message) {
    const container = document.getElementById('messagesContainer');
    if (!container) return;
    
    // Проверяем, это бот или пользователь
    const isBot = message.user?.isBot || message.isBot;
    const isCurrentUser = message.userId === currentUser?.id;
    
    // Создаём элемент сообщения
    const messageEl = document.createElement('div');
    messageEl.className = `message ${isCurrentUser ? 'sent' : 'received'} ${isBot ? 'bot-message' : ''}`;
    messageEl.dataset.id = message.id;
    
    // Форматируем время
    const time = new Date(message.time || message.timestamp).toLocaleTimeString('ru-RU', {
        hour: '2-digit',
        minute: '2-digit'
    });
    
    // Аватар
    const avatarColor = message.user?.avatarColor || getRandomColor();
    const avatarText = message.user?.displayName?.[0] || '?';
    
    // Содержимое
    messageEl.innerHTML = `
        <div class="message-avatar" style="background: ${avatarColor}">
            ${avatarText}
        </div>
        <div class="message-content">
            <div class="message-header">
                <span class="message-sender">
                    ${message.user?.displayName || 'Неизвестный'}
                    ${message.user?.isAdmin ? ' 👑' : ''}
                    ${isBot ? ' 🤖' : ''}
                </span>
                <span class="message-time">${time}</span>
            </div>
            <div class="message-text">${formatMessageText(message.text)}</div>
            ${message.reactions ? renderReactions(message.reactions) : ''}
        </div>
        <div class="message-actions">
            <button onclick="reactToMessage('${message.id}', '👍')" title="Нравится">
                👍
            </button>
            <button onclick="replyToMessage('${message.id}')" title="Ответить">
                <i class="fas fa-reply"></i>
            </button>
        </div>
    `;
    
    // Добавляем в контейнер
    container.appendChild(messageEl);
    
    // Прокручиваем вниз
    setTimeout(() => {
        container.scrollTop = container.scrollHeight;
    }, 100);
}

function formatMessageText(text) {
    if (!text) return '';
    
    // Заменяем ссылки
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    text = text.replace(urlRegex, url => {
        return `<a href="${url}" target="_blank" class="message-link">${url}</a>`;
    });
    
    // Заменяем переносы строк
    text = text.replace(/\n/g, '<br>');
    
    // Обрабатываем команды AI
    if (text.startsWith('/ai ') || text.startsWith('/img ') || text.includes('@waveai')) {
        text = `<span class="ai-highlight">${text}</span>`;
    }
    
    return text;
}

// ========== WAVE AI ==========
function sendAiMessage() {
    const input = document.getElementById('aiInput');
    const text = input?.value.trim();
    
    if (!text || !socket) return;
    
    // Отправляем сообщение в общий чат
    socket.emit('message', {
        text: text,
        channel: currentChannel,
        timestamp: new Date().toISOString()
    });
    
    // Также отправляем в AI чат
    addAiMessage(text, 'user');
    
    // Очищаем поле
    if (input) {
        input.value = '';
    }
    
    // Показываем индикатор загрузки
    showAiLoading(true);
    
    // Имитируем ответ AI
    setTimeout(() => {
        showAiLoading(false);
        const aiResponse = generateAiResponse(text);
        addAiMessage(aiResponse, 'bot');
    }, 1000 + Math.random() * 2000);
}

function generateAiResponse(prompt) {
    const responses = [
        `🤖 **WaveAI:** Отличный вопрос! "${prompt.substring(0, 30)}..." - интересная тема!`,
        `✨ **AI:** Я думаю над вашим вопросом... Возможно, стоит обсудить это в основном чате?`,
        `🧠 **ИИ:** "${prompt.substring(0, 20)}..." - сложная тема! Нужно больше контекста.`,
        `💡 **WaveAI:** Попробуйте использовать команду /ai для более детального ответа!`
    ];
    
    return responses[Math.floor(Math.random() * responses.length)];
}

function addAiMessage(text, type = 'user') {
    const container = document.getElementById('aiChatMessages');
    if (!container) return;
    
    const messageEl = document.createElement('div');
    messageEl.className = `ai-message ai-message-${type}`;
    
    const time = new Date().toLocaleTimeString('ru-RU', {
        hour: '2-digit',
        minute: '2-digit'
    });
    
    messageEl.innerHTML = `
        <div class="ai-message-avatar">
            <i class="fas fa-${type === 'user' ? 'user' : 'robot'}"></i>
        </div>
        <div class="ai-message-content">
            <div class="ai-message-text">${formatMessageText(text)}</div>
            <div class="ai-message-time">${time}</div>
        </div>
    `;
    
    container.appendChild(messageEl);
    
    // Прокручиваем вниз
    setTimeout(() => {
        container.scrollTop = container.scrollHeight;
    }, 100);
}

// ========== АДМИН ФУНКЦИИ ==========
function showAdminFeatures() {
    // Показываем админ пункт в навигации
    const adminNav = document.getElementById('adminNavItem');
    if (adminNav) {
        adminNav.style.display = 'flex';
    }
    
    // Добавляем админ бейдж
    const userBadge = document.getElementById('userBadge');
    if (userBadge) {
        userBadge.innerHTML = '👑';
        userBadge.title = 'Администратор';
    }
    
    // Добавляем админ CSS класс
    document.body.classList.add('admin-mode');
}

function refreshAdminStats() {
    if (!socket || !currentUser?.isAdmin) return;
    
    socket.emit('admin', {
        action: 'stats'
    });
    
    showNotification('Обновление статистики...', 'info');
}

function adminSendAnnouncement() {
    const text = prompt('Введите текст анонса:');
    if (!text) return;
    
    if (socket && currentUser?.isAdmin) {
        socket.emit('admin', {
            action: 'announce',
            text: text
        });
        
        showNotification('Анонс отправлен!', 'success');
    }
}

// ========== УТИЛИТЫ ==========
function updateConnectionStatus(connected) {
    const statusEl = document.getElementById('connectionStatus');
    if (statusEl) {
        statusEl.innerHTML = connected 
            ? '<i class="fas fa-wifi"></i> <span>Онлайн</span>'
            : '<i class="fas fa-wifi-slash"></i> <span>Офлайн</span>';
        statusEl.className = connected ? 'connection-status connection-connected' : 'connection-status connection-disconnected';
    }
}

function updateOnlineCounter() {
    const counter = document.getElementById('onlineCounter');
    if (counter) {
        const count = onlineUsers.length;
        counter.querySelector('span').textContent = count;
        counter.title = `${count} пользователей онлайн`;
    }
}

function updateUnreadCount(count) {
    // Обновляем все счётчики непрочитанных
    const elements = [
        document.getElementById('unreadCount'),
        document.getElementById('mobileUnread'),
        document.querySelector('.nav-item[onclick*="chat"] .nav-badge')
    ];
    
    elements.forEach(el => {
        if (el) {
            const current = parseInt(el.textContent) || 0;
            el.textContent = current + count;
            el.style.display = current + count > 0 ? 'flex' : 'none';
        }
    });
}

function showNotification(message, type = 'info') {
    // Создаём элемент уведомления
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <i class="fas fa-${getNotificationIcon(type)}"></i>
        <span>${message}</span>
        <button class="notification-close" onclick="this.parentElement.remove()">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    // Добавляем в контейнер
    const container = document.getElementById('notificationContainer');
    if (container) {
        container.appendChild(notification);
        
        // Анимация
        setTimeout(() => notification.classList.add('show'), 10);
        
        // Авто-удаление
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, 5000);
    }
    
    // Звук
    if (CONFIG.features.sounds) {
        playNotificationSound(type);
    }
}

function getNotificationIcon(type) {
    const icons = {
        success: 'check-circle',
        error: 'exclamation-circle',
        warning: 'exclamation-triangle',
        info: 'info-circle'
    };
    return icons[type] || 'bell';
}

function playNotificationSound(type = 'info') {
    if (!CONFIG.features.sounds) return;
    
    const audio = new Audio();
    audio.volume = 0.3;
    
    // Разные звуки для разных типов
    switch(type) {
        case 'success':
            audio.src = 'https://assets.mixkit.co/sfx/preview/mixkit-correct-answer-tone-2870.mp3';
            break;
        case 'error':
            audio.src = 'https://assets.mixkit.co/sfx/preview/mixkit-wrong-answer-fail-notification-946.mp3';
            break;
        default:
            audio.src = 'https://assets.mixkit.co/sfx/preview/mixkit-message-pop-alert-2354.mp3';
    }
    
    audio.play().catch(e => console.log('Звук не воспроизведён:', e));
}

// ========== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ==========
function autoResizeTextarea(textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = textarea.scrollHeight + 'px';
}

function handleMessageKeydown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
    }
    
    // Индикатор набора текста
    if (socket) {
        if (!isTyping) {
            isTyping = true;
            socket.emit('typing', true);
        }
        
        clearTimeout(typingTimeout);
        typingTimeout = setTimeout(() => {
            if (isTyping) {
                isTyping = false;
                socket.emit('typing', false);
            }
        }, 1000);
    }
}

function showTypingIndicator(username, isTyping) {
    const indicator = document.getElementById('typingIndicator');
    const text = document.getElementById('typingText');
    
    if (indicator && text) {
        if (isTyping) {
            text.textContent = `${username} печатает...`;
            indicator.style.display = 'flex';
        } else {
            indicator.style.display = 'none';
        }
    }
}

function toggleEmojiPicker() {
    const picker = document.getElementById('emojiPicker');
    if (picker) {
        picker.classList.toggle('show');
    }
}

function insertEmoji(emoji) {
    const input = document.getElementById('messageInput');
    if (input) {
        const start = input.selectionStart;
        const end = input.selectionEnd;
        input.value = input.value.substring(0, start) + emoji + input.value.substring(end);
        input.focus();
        input.selectionStart = input.selectionEnd = start + emoji.length;
        autoResizeTextarea(input);
    }
    
    // Закрываем пикер
    const picker = document.getElementById('emojiPicker');
    if (picker) {
        picker.classList.remove('show');
    }
}

// ========== ЭКСПОРТ ФУНКЦИЙ ==========
// Функции, которые вызываются из HTML
window.showWelcome = showWelcome;
window.showRegister = showRegister;
window.showLogin = showLogin;
window.showApp = showApp;
window.showSection = showSection;
window.toggleSidebar = toggleSidebar;
window.toggleTheme = toggleTheme;
window.toggleEmojiPicker = toggleEmojiPicker;
window.insertEmoji = insertEmoji;
window.sendMessage = sendMessage;
window.sendAiMessage = sendAiMessage;
window.refreshAdminStats = refreshAdminStats;
window.adminSendAnnouncement = adminSendAnnouncement;
window.logout = logout;

// Дополнительные функции
function logout() {
    if (socket) {
        socket.disconnect();
    }
    
    localStorage.removeItem('wave_user');
    localStorage.removeItem('wave_admin_key');
    currentUser = null;
    
    showWelcome();
    showNotification('Вы вышли из системы', 'success');
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('show');
    }
}

console.log('✅ Клиентский скрипт WaveMessenger Pro загружен!');