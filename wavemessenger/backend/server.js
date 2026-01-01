// ========== ИМПОРТЫ ==========
const express = require('express');
const http = require('http');
const socketIO = require('socket.io'); // ← ДОБАВЬТЕ ЭТО!
const path = require('path');
const fs = require('fs');

// ========== НАСТРОЙКА ==========
const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// ========== ПУТИ ==========
const projectRoot = path.join(__dirname, '..');
const publicDir = path.join(projectRoot, 'public');

console.log('🚀 Запуск WaveMessenger...');
console.log('📁 Текущая папка:', __dirname);
console.log('📁 Корень проекта:', projectRoot);
console.log('📁 Папка public:', publicDir);

// ========== СТАТИКА ==========
if (fs.existsSync(publicDir)) {
    console.log('✅ Public папка найдена');
    app.use(express.static(publicDir));
    app.get('/', (req, res) => {
        res.sendFile(path.join(publicDir, 'index.html'));
    });
} else {
    console.log('⚠️ Public папка не найдена, показываем заглушку');
    app.get('/', (req, res) => {
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>WaveMessenger 🌊</title>
                <style>
                    body { font-family: Arial; padding: 40px; background: #0a192f; color: white; text-align: center; }
                    h1 { color: #00d4ff; }
                    .box { background: rgba(255,255,255,0.1); padding: 30px; border-radius: 15px; margin: 20px auto; max-width: 600px; }
                    .success { color: #00ffaa; }
                </style>
            </head>
            <body>
                <h1>🌊 WaveMessenger</h1>
                <div class="box">
                    <h2 class="success">✅ Сервер запущен!</h2>
                    <p>Socket.IO работает нормально</p>
                    <p>Но не найдена папка <code>public/</code></p>
                    <p>Создайте папку <code>public</code> с файлами:</p>
                    <ul style="text-align: left; display: inline-block;">
                        <li><code>index.html</code></li>
                        <li><code>style.css</code></li>
                        <li><code>script.js</code></li>
                    </ul>
                </div>
                <div id="status">Подключение к Socket.IO...</div>
                <script src="/socket.io/socket.io.js"></script>
                <script>
                    const socket = io();
                    socket.on('connect', () => {
                        document.getElementById('status').innerHTML = 
                            '<span class="success">✅ Socket.IO подключен!</span>';
                    });
                </script>
            </body>
            </html>
        `);
    });
}

// ========== ДОПОЛНИТЕЛЬНЫЕ МАРШРУТЫ ==========
app.get('/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
});

app.get('/api/debug', (req, res) => {
    const files = fs.existsSync(publicDir) ? fs.readdirSync(publicDir) : [];
    res.json({
        dir: __dirname,
        publicExists: fs.existsSync(publicDir),
        files: files
    });
});

// ========== SOCKET.IO ==========
const users = new Map();

io.on('connection', (socket) => {
    console.log('👤 Подключен:', socket.id);
    
    // Приветствие
    socket.emit('welcome', {
        message: 'Добро пожаловать в WaveMessenger!',
        id: socket.id,
        online: users.size + 1
    });
    
    // Регистрация
    socket.on('register', (data) => {
        const user = {
            id: socket.id,
            username: data.username || `user_${socket.id.substring(0, 6)}`,
            displayName: data.displayName || 'Гость',
            color: data.color || '#0066ff'
        };
        users.set(socket.id, user);
        
        socket.emit('registered', user);
        socket.broadcast.emit('userJoined', user);
        
        console.log(`✅ Зарегистрирован: ${user.displayName}`);
    });
    
    // Сообщения
    socket.on('message', (data) => {
        const user = users.get(socket.id);
        if (!user || !data.text) return;
        
        const message = {
            id: Date.now(),
            user: user,
            text: data.text,
            time: new Date().toISOString()
        };
        
        io.emit('message', message);
        console.log(`💬 ${user.displayName}: ${data.text.substring(0, 50)}...`);
    });
    
    // Отключение
    socket.on('disconnect', () => {
        const user = users.get(socket.id);
        if (user) {
            users.delete(socket.id);
            io.emit('userLeft', user);
            console.log(`👋 Отключился: ${user.displayName}`);
        }
    });
});

// ========== ЗАПУСК ==========
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log('='.repeat(50));
    console.log(`🚀 Сервер запущен на порту ${PORT}`);
    console.log(`📡 WebSocket доступен на: ws://localhost:${PORT}`);
    console.log(`🌐 HTTP доступен на: http://localhost:${PORT}`);
    console.log('='.repeat(50));
    
    // Проверка зависимостей
    console.log('🔍 Проверка зависимостей:');
    try {
        const packageJson = require('./package.json');
        console.log(`✅ Package: ${packageJson.name} v${packageJson.version}`);
        console.log(`✅ Dependencies: ${Object.keys(packageJson.dependencies || {}).length}`);
    } catch (e) {
        console.log('⚠️ package.json не найден или поврежден');
    }
});