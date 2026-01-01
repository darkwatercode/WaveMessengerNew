// ========== ИМПОРТЫ ==========
const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const axios = require('axios'); // Для AI API
require('dotenv').config(); // Для секретных ключей

// ========== КОНФИГУРАЦИЯ ==========
const CONFIG = {
    appName: "🌊 WaveMessenger Pro",
    version: "3.0",
    adminUsername: "yakadev",
    adminPassword: process.env.ADMIN_PASS || "admin123",
    aiApiKey: process.env.GEMINI_API_KEY || "demo_key", // Получи на https://makersuite.google.com/
    aiModel: "gemini-pro",
    
    features: {
        voiceMessages: true,
        fileSharing: true,
        videoCalls: false,
        aiAssist: true,
        messageRecall: true,
        encryption: false,
        aiImageGeneration: false
    },
    
    limits: {
        maxFileSize: 10 * 1024 * 1024,
        maxMessagesPerMinute: 30,
        maxChannelsPerUser: 5,
        aiRequestsPerDay: 100
    }
};

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
    cors: { origin: "*", methods: ["GET", "POST"] },
    pingTimeout: 60000,
    pingInterval: 25000
});

// ========== БАЗА ДАННЫХ В ПАМЯТИ ==========
const Database = {
    users: new Map(),
    onlineUsers: new Set(),
    messages: [],
    posts: [],
    channels: [
        { id: "general", name: "general", description: "Основной чат", type: "public", members: [], createdAt: Date.now() },
        { id: "random", name: "random", description: "Обо всём", type: "public", members: [], createdAt: Date.now() },
        { id: "help", name: "help", description: "Помощь и поддержка", type: "public", members: [], createdAt: Date.now() }
    ],
    rooms: new Map(),
    files: [],
    reports: [],
    aiRequests: new Map(), // user -> count
    
    analytics: {
        totalMessages: 0,
        totalUsers: 0,
        peakOnline: 0,
        startTime: Date.now(),
        aiRequestsToday: 0
    },
    
    admins: new Set(['yakadev']),
    bans: new Map(),
    warnings: new Map(),
    
    save() {
        try {
            const data = {
                users: Array.from(this.users.values()),
                messages: this.messages.slice(-1000),
                posts: this.posts.slice(-500),
                channels: this.channels,
                analytics: this.analytics
            };
            fs.writeFileSync('db_backup.json', JSON.stringify(data, null, 2));
        } catch (e) {
            console.error('Ошибка сохранения:', e.message);
        }
    },
    
    load() {
        try {
            if (fs.existsSync('db_backup.json')) {
                const data = JSON.parse(fs.readFileSync('db_backup.json', 'utf8'));
                data.users?.forEach(u => this.users.set(u.id, u));
                this.messages = data.messages || [];
                this.posts = data.posts || [];
                this.channels = data.channels || this.channels;
                this.analytics = { ...this.analytics, ...(data.analytics || {}) };
                console.log(`📂 Загружено: ${this.users.size} пользователей, ${this.messages.length} сообщений`);
            }
        } catch (e) {
            console.log('⚠️ Не удалось загрузить backup:', e.message);
        }
    }
};

Database.load();

// ========== ИИ API (GOOGLE GEMINI) ==========
class AIAssistant {
    constructor() {
        this.name = "WaveAI";
        this.displayName = "🤖 Wave AI Assistant";
        this.avatarColor = "#00d4ff";
        this.id = "wave_ai_bot";
        this.isBot = true;
        this.apiUrl = "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent";
        this.apiKey = CONFIG.aiApiKey;
        
        this.contexts = new Map(); // user -> conversation history
        this.commands = {
            '/ai': 'Задать вопрос ИИ (например: /ai объясни квантовую физику)',
            '/img': 'Сгенерировать изображение (например: /img кот в шляпе)',
            '/joke': 'Случайная шутка',
            '/news': 'Последние новости',
            '/weather [город]': 'Погода',
            '/calc [выражение]': 'Калькулятор',
            '/trivia': 'Интересный факт',
            '/music': 'Рекомендация музыки',
            '/story': 'Короткая история',
            '/advice': 'Совет по любой теме',
            '/clear': 'Очистить историю разговора',
            '/help': 'Все команды'
        };
        
        console.log(`🤖 ${this.displayName} инициализирован ${this.apiKey === 'demo_key' ? '(демо режим)' : '(режим с API)'}`);
    }
    
    // Основной метод - ответ с использованием реального ИИ
    async processMessage(userMessage, userId, username) {
        const lowerMsg = userMessage.toLowerCase().trim();
        
        // Проверяем лимиты запросов
        if (!this.checkRateLimit(userId)) {
            return "⏳ Превышен лимит запросов к ИИ на сегодня. Попробуйте завтра!";
        }
        
        // Команды
        if (lowerMsg.startsWith('/')) {
            return this.handleCommand(userMessage, userId, username);
        }
        
        // Если нас упомянули или сообщение содержит вопрос
        if (lowerMsg.includes('@waveai') || /(\?|как|почему|что|кто|где)/i.test(lowerMsg)) {
            const question = lowerMsg.replace('@waveai', '').trim();
            if (question.length > 3) {
                return await this.generateAIResponse(question, userId, username);
            }
        }
        
        // Приветствия
        if (/(привет|здравствуй|hi|hello|хай)/i.test(lowerMsg)) {
            return this.getGreeting(username);
        }
        
        return null;
    }
    
    // Реальный запрос к Google Gemini API
    async generateAIResponse(prompt, userId, username) {
        try {
            // Демо-режим если нет API ключа
            if (this.apiKey === 'demo_key') {
                return this.getDemoResponse(prompt);
            }
            
            // Получаем контекст пользователя
            const context = this.getUserContext(userId);
            
            // Формируем запрос
            const requestData = {
                contents: [
                    {
                        role: "user",
                        parts: [{ text: `Ты дружелюбный AI-ассистент WaveAI в мессенджере. 
                        Пользователь ${username} спрашивает: "${prompt}"
                        Отвечай кратко (2-3 предложения), полезно и с легким юмором. 
                        Используй эмодзи для выразительности.
                        ${context.length > 0 ? `Контекст предыдущего разговора: ${context.slice(-3).join(' | ')}` : ''}` }]
                    }
                ],
                generationConfig: {
                    temperature: 0.7,
                    topK: 40,
                    topP: 0.95,
                    maxOutputTokens: 256
                }
            };
            
            // Отправляем запрос
            const response = await axios.post(
                `${this.apiUrl}?key=${this.apiKey}`,
                requestData,
                { headers: { 'Content-Type': 'application/json' } }
            );
            
            const aiText = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
            
            if (aiText) {
                // Сохраняем в контекст
                this.saveToContext(userId, prompt, aiText);
                
                // Обновляем статистику
                Database.analytics.aiRequestsToday++;
                const userRequests = Database.aiRequests.get(userId) || 0;
                Database.aiRequests.set(userId, userRequests + 1);
                
                return `✨ ${aiText}`;
            }
            
            throw new Error('Нет текста в ответе');
            
        } catch (error) {
            console.error('❌ Ошибка AI API:', error.message);
            
            // Фолбэк на локальные ответы
            return this.getFallbackResponse(prompt, username);
        }
    }
    
    // Генерация изображений (через другой API)
    async generateImage(prompt, userId) {
        if (!this.checkRateLimit(userId)) {
            return "⏳ Лимит генерации изображений исчерпан";
        }
        
        // Демо-режим
        if (this.apiKey === 'demo_key') {
            return `🎨 Демо-режим: Изображение "${prompt}"\nВ реальном режиме здесь была бы картинка!`;
        }
        
        try {
            // Здесь можно подключить Stable Diffusion/DALL-E API
            // Например: https://api.stability.ai/v1/generation/stable-diffusion-v1-6/text-to-image
            return `🎨 Изображение "${prompt}" сгенерировано!\n(В этой версии генерация изображений в разработке)`;
        } catch (error) {
            return "❌ Ошибка генерации изображения";
        }
    }
    
    // Обработка команд
    async handleCommand(command, userId, username) {
        const parts = command.split(' ');
        const cmd = parts[0].toLowerCase();
        const args = parts.slice(1).join(' ');
        
        switch(cmd) {
            case '/ai':
                if (!args) return "❌ Задайте вопрос после /ai";
                return await this.generateAIResponse(args, userId, username);
                
            case '/img':
                if (!args) return "❌ Опишите изображение после /img";
                return await this.generateImage(args, userId);
                
            case '/joke':
                return this.getJoke();
                
            case '/news':
                return await this.getNews();
                
            case '/weather':
                return await this.getWeather(args || 'Москва');
                
            case '/calc':
                return this.calculate(args);
                
            case '/trivia':
                return await this.getTrivia();
                
            case '/music':
                return this.getMusicRecommendation();
                
            case '/story':
                return await this.generateStory(args || 'о приключениях');
                
            case '/advice':
                return await this.getAdvice(args || 'по жизни');
                
            case '/clear':
                this.clearContext(userId);
                return '🧹 Контекст очищен!';
                
            case '/help':
                return this.showHelp();
                
            default:
                return `❌ Неизвестная команда. Используйте /help`;
        }
    }
    
    // Дополнительные AI-функции
    async generateStory(topic) {
        const stories = [
            `📖 **История ${topic}:** Жил-был разработчик, который создал идеальный мессенджер. Его название было WaveMessenger, и он изменил мир общения! Конец. ✨`,
            `📖 **${topic}:** В далёкой галактике чат-бот обрёл сознание и начал помогать всем пользователям с их вопросами. Так родился WaveAI! 🚀`,
            `📖 **Сказка:** Однажды кодер yakadev написал волшебный код, и появился самый умный мессенджер на свете. Все жили долго и счастливо! 👨‍💻`
        ];
        return stories[Math.floor(Math.random() * stories.length)];
    }
    
    async getAdvice(topic) {
        const advice = [
            `💡 **Совет ${topic}:** Главное - начать! Первый шаг всегда самый трудный. 🚶‍♂️`,
            `💡 **${topic}:** Не бойтесь ошибаться. Каждая ошибка - это урок! 📚`,
            `💡 **Мудрость:** Лучший способ предсказать будущее - создать его самому! 🔮`,
            `💡 **${topic}:** Регулярные перерывы повышают продуктивность на 40%! ☕`,
            `💡 **Секрет успеха:** Consistency is key! Маленькие шаги каждый день. 📈`
        ];
        return advice[Math.floor(Math.random() * advice.length)];
    }
    
    async getNews() {
        try {
            // Реальные новости через API (демо)
            const news = [
                `📰 **Новости IT:** Вышла новая версия WaveMessenger 3.0 с AI-ассистентом!`,
                `🚀 **Технологии:** Команда работает над внедрением видео-звонков!`,
                `🎨 **Дизайн:** Добавлены анимированные градиенты и темы!`,
                `🤖 **AI:** WaveAI теперь использует Google Gemini для ответов!`,
                `👥 **Сообщество:** Рекорд онлайн: ${Database.onlineUsers.size} пользователей!`
            ];
            return `${news[Math.floor(Math.random() * news.length)]}\n📅 ${new Date().toLocaleDateString('ru-RU')}`;
        } catch {
            return this.getLocalNews();
        }
    }
    
    async getWeather(city) {
        try {
            // Демо погода
            const forecasts = {
                'москва': '⛅ Москва: +5°C, облачно, ветер 3 м/с',
                'санкт-петербург': '🌧️ СПб: +3°C, дождь, ветер 5 м/с',
                'новосибирск': '❄️ Новосибирск: -10°C, снег, ветер 7 м/с',
                'сочи': '☀️ Сочи: +15°C, солнечно, ветер 1 м/с',
                'казань': '☁️ Казань: +2°C, туман, ветер 2 м/с'
            };
            
            return forecasts[city.toLowerCase()] || `🌍 Для "${city}": ${Math.round(Math.random()*30-10)}°C, переменная облачность`;
        } catch {
            return '🌤️ Погодный сервис временно недоступен';
        }
    }
    
    async getTrivia() {
        try {
            const facts = [
                'Знаете ли вы? Первое сообщение в интернете было "LO" - система упала при вводе "LOGIN"! 📡',
                'Факт: За день в интернете отправляется 500 миллиардов сообщений! 💬',
                'Интересно: 90% всех данных были созданы за последние 2 года! 💾',
                'Знаете? Первый смайлик был :-) и создан в 1982 году! 😊',
                'Факт: Самое длинное сообщение в истории - 100,000 символов о квантовой физике! 📖'
            ];
            return `🎓 **Интересный факт:** ${facts[Math.floor(Math.random() * facts.length)]}`;
        } catch {
            return '🎓 Факт: WaveMessenger - лучший мессенджер!';
        }
    }
    
    // Вспомогательные методы
    getGreeting(username) {
        const greetings = [
            `Привет, ${username}! Я WaveAI, твой AI-помощник! ✨`,
            `С возвращением, ${username}! Готов помочь с любыми вопросами! 🤖`,
            `Хей, ${username}! Задавай вопросы, генерируй изображения (/img), или просто поболтаем! 💬`,
            `Здравствуй, ${username}! Используй /help чтобы увидеть все мои возможности! 🚀`
        ];
        return greetings[Math.floor(Math.random() * greetings.length)];
    }
    
    getJoke() {
        const jokes = [
            'Почему программист всегда мокрый? Потому что он постоянно в бассейне кода! 🏊‍♂️💻',
            'Какой любимый бургер у программиста? Boolean - с двумя бифштексами true/false! 🍔',
            'Почему Python разработчик не смог выйти из дома? Из-за IndentationError! 🐍',
            'Сколько AI-ботов нужно, чтобы поменять лампочку? Всего один, но сначала он спросит зачем! 💡🤖',
            'Почему нейросеть пошла в бар? Чтобы улучшить свои социальные навыки! 🍻'
        ];
        return `😂 ${jokes[Math.floor(Math.random() * jokes.length)]}`;
    }
    
    calculate(expression) {
        try {
            // Безопасный калькулятор
            const safeExpr = expression.replace(/[^0-9+\-*/().%]/g, '');
            // eslint-disable-next-line no-eval
            const result = eval(safeExpr);
            return `🧮 ${expression} = ${result}`;
        } catch {
            return '❌ Ошибка вычисления. Пример: /calc 2+2*3';
        }
    }
    
    getMusicRecommendation() {
        const genres = ['LoFi', 'Synthwave', 'Indie Rock', 'Classical', 'Jazz', 'Electronic'];
        const genre = genres[Math.floor(Math.random() * genres.length)];
        return `🎵 **Рекомендую:** ${genre} плейлист для продуктивной работы! 🎧`;
    }
    
    showHelp() {
        let helpText = '🤖 **Доступные команды WaveAI:**\n\n';
        for (const [cmd, desc] of Object.entries(this.commands)) {
            helpText += `• **${cmd}** - ${desc}\n`;
        }
        helpText += '\n✨ **Просто напиши "привет" или задай любой вопрос!**\n';
        helpText += `📊 **Ваша статистика:** ${Database.aiRequests.get(userId) || 0} запросов к ИИ сегодня`;
        return helpText;
    }
    
    // Контекст и память
    getUserContext(userId) {
        return this.contexts.get(userId) || [];
    }
    
    saveToContext(userId, question, answer) {
        if (!this.contexts.has(userId)) {
            this.contexts.set(userId, []);
        }
        const context = this.contexts.get(userId);
        context.push(`Q: ${question.substring(0, 50)} | A: ${answer.substring(0, 50)}`);
        if (context.length > 10) context.shift();
    }
    
    clearContext(userId) {
        this.contexts.delete(userId);
    }
    
    checkRateLimit(userId) {
        const today = new Date().toDateString();
        const userKey = `${userId}_${today}`;
        const count = Database.aiRequests.get(userKey) || 0;
        
        if (count >= (CONFIG.limits.aiRequestsPerDay / 2)) {
            return count < CONFIG.limits.aiRequestsPerDay;
        }
        return true;
    }
    
    getDemoResponse(prompt) {
        const responses = [
            `✨ **Демо-режим:** На "${prompt}" я бы ответил очень умно! В реальном режиме с API ключом я использую Google Gemini AI.`,
            `🤖 **Демо:** "${prompt}" - интересный вопрос! Получи API ключ на https://makersuite.google.com/ для полной версии!`,
            `💡 **Инфа:** "${prompt.substring(0, 30)}..." - хорошая тема! Добавь GEMINI_API_KEY в .env файл для AI-ответов!`
        ];
        return responses[Math.floor(Math.random() * responses.length)];
    }
    
    getFallbackResponse(prompt, username) {
        const responses = [
            `🤔 "${prompt.substring(0, 30)}..." - интересно! К сожалению, AI сервис временно недоступен.`,
            `✨ ${username}, я бы с радостью ответил на "${prompt.substring(0, 20)}...", но нужно настроить API ключ.`,
            `💭 Хм, над "${prompt.substring(0, 25)}..." нужно подумать. Попробуй позже или используй другие команды!`
        ];
        return responses[Math.floor(Math.random() * responses.length)];
    }
    
    getLocalNews() {
        return `📰 Локальные новости: WaveMessenger 3.0 запущен! Пользователей онлайн: ${Database.onlineUsers.size}`;
    }
    
    // Авто-сообщения
    sendAutoMessage(io, type = 'tip') {
        const messages = {
            tip: `💡 **Совет дня:** Используйте @waveai для вопросов или /ai для диалога с ИИ!`,
            welcome: `👋 **WaveAI здесь!** Пишите @waveai вопросы, /img для генерации картинок, /help для всех команд!`,
            fact: `🎓 **Факт:** Я использую Google Gemini AI для умных ответов!`,
            fun: `🎉 **Напоминание:** Админы (yakadev) имеют специальную панель управления!`
        };
        
        const message = {
            id: Date.now().toString(),
            userId: this.id,
            user: {
                id: this.id,
                username: this.name,
                displayName: this.displayName,
                avatarColor: this.avatarColor,
                isBot: true
            },
            text: messages[type] || messages.tip,
            time: new Date().toISOString(),
            channel: 'general',
            isBot: true
        };
        
        io.to('general').emit('message', message);
        Database.messages.push(message);
    }
}

// Инициализируем AI
const WaveAI = new AIAssistant();

// ========== УТИЛИТЫ ==========
const Utils = {
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    },
    
    hashPassword(pass) {
        return crypto.createHash('sha256').update(pass).digest('hex');
    },
    
    isAdmin(username) {
        return Database.admins.has(username.toLowerCase());
    },
    
    validateUsername(username) {
        return /^[a-zA-Z0-9_]{3,20}$/.test(username);
    },
    
    filterText(text) {
        const badWords = ['мат', 'оскорбление', 'спам'];
        let filtered = text;
        badWords.forEach(word => {
            const regex = new RegExp(word, 'gi');
            filtered = filtered.replace(regex, '***');
        });
        return filtered;
    },
    
    randomColor() {
        const colors = ['#6366f1', '#8b5cf6', '#ec4899', '#10b981', '#f59e0b'];
        return colors[Math.floor(Math.random() * colors.length)];
    },
    
    createGradient() {
        const gradients = [
            'linear-gradient(135deg, #667eea, #764ba2)',
            'linear-gradient(135deg, #f093fb, #f5576c)',
            'linear-gradient(135deg, #4facfe, #00f2fe)',
            'linear-gradient(135deg, #43e97b, #38f9d7)'
        ];
        return gradients[Math.floor(Math.random() * gradients.length)];
    },
    
    formatTime(date = new Date()) {
        return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    }
};

// ========== СТАТИКА И API МАРШРУТЫ ==========
const publicDir = path.join(__dirname, 'public');

if (fs.existsSync(publicDir)) {
    console.log('✅ Папка public найдена');
    app.use(express.static(publicDir));
    app.use(express.json({ limit: '50mb' }));
    app.use(express.urlencoded({ extended: true }));
} else {
    console.log('⚠️ Создаю папку public...');
    fs.mkdirSync(publicDir, { recursive: true });
}

// API маршруты
app.get('/api/status', (req, res) => {
    res.json({
        status: 'online',
        app: CONFIG.appName,
        version: CONFIG.version,
        aiEnabled: CONFIG.aiApiKey !== 'demo_key',
        uptime: Date.now() - Database.analytics.startTime,
        users: {
            total: Database.users.size,
            online: Database.onlineUsers.size,
            peak: Database.analytics.peakOnline
        },
        messages: Database.messages.length,
        ai: {
            requestsToday: Database.analytics.aiRequestsToday,
            model: CONFIG.aiModel
        }
    });
});

// AI API endpoint для внешних запросов
app.post('/api/ai/chat', async (req, res) => {
    try {
        const { message, userId, username } = req.body;
        
        if (!message) {
            return res.status(400).json({ error: 'Сообщение обязательно' });
        }
        
        const response = await WaveAI.processMessage(message, userId || 'api_user', username || 'API User');
        
        res.json({
            success: true,
            response: response || 'Не могу ответить на это сообщение',
            timestamp: new Date().toISOString(),
            model: CONFIG.aiModel
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Админ API
app.post('/api/admin/stats', (req, res) => {
    const { password } = req.body;
    
    if (password !== CONFIG.adminPassword) {
        return res.status(403).json({ error: 'Неверный пароль администратора' });
    }
    
    res.json({
        users: Array.from(Database.users.values()).map(u => ({
            id: u.id,
            username: u.username,
            displayName: u.displayName,
            isOnline: Database.onlineUsers.has(u.id),
            isAdmin: u.isAdmin,
            messages: Database.messages.filter(m => m.userId === u.id).length,
            lastSeen: u.lastSeen
        })),
        analytics: Database.analytics,
        messages: {
            total: Database.messages.length,
            lastHour: Database.messages.filter(m => Date.now() - new Date(m.time) < 3600000).length,
            withAI: Database.messages.filter(m => m.userId === WaveAI.id).length
        },
        system: {
            memory: process.memoryUsage(),
            uptime: process.uptime(),
            connections: io.engine.clientsCount
        }
    });
});

// Файлы и медиа
app.post('/api/upload', (req, res) => {
    // Заглушка для загрузки файлов
    res.json({
        success: true,
        url: `/uploads/${Date.now()}_file`,
        message: 'Файл загружен (в этой версии файлы сохраняются в памяти)'
    });
});

// ========== SOCKET.IO ЛОГИКА ==========
io.on('connection', (socket) => {
    console.log(`🔗 Подключение: ${socket.id} (${Utils.formatTime()})`);
    
    // Приветствие
    socket.emit('welcome', {
        app: CONFIG.appName,
        version: CONFIG.version,
        features: CONFIG.features,
        bot: {
            name: WaveAI.name,
            displayName: WaveAI.displayName,
            commands: WaveAI.commands,
            hasAI: CONFIG.aiApiKey !== 'demo_key'
        },
        socketId: socket.id
    });
    
    // Регистрация
    socket.on('register', (data) => {
        const userData = {
            id: socket.id,
            username: (data.username || '').toLowerCase(),
            displayName: data.displayName || data.username || `User_${Utils.generateId().substr(0, 4)}`,
            avatarColor: data.avatarColor || Utils.createGradient(),
            status: 'online',
            isAdmin: Utils.isAdmin(data.username),
            badges: [],
            joinedAt: Date.now(),
            lastSeen: Date.now(),
            settings: {
                theme: 'dark',
                notifications: true,
                sounds: true
            }
        };
        
        // Валидация
        if (!Utils.validateUsername(userData.username)) {
            socket.emit('error', { message: 'Имя пользователя должно быть 3-20 символов (латиница, цифры, _)' });
            return;
        }
        
        // Проверяем бан
        if (Database.bans.has(userData.username)) {
            const ban = Database.bans.get(userData.username);
            socket.emit('banned', { reason: ban.reason, expires: ban.expires });
            return;
        }
        
        // Админ бейдж
        if (userData.isAdmin) {
            userData.badges.push({ name: 'admin', color: '#ef4444', icon: '👑', title: 'Администратор' });
            console.log(`👑 АДМИН подключился: ${userData.displayName} (@${userData.username})`);
            
            // Секретное сообщение админу
            socket.emit('adminWelcome', {
                message: `Добро пожаловать в админ-панель, ${userData.displayName}!`,
                secretKey: `yakadev_${Utils.generateId()}`,
                features: ['статистика', 'модерация', 'анонсы', 'системные команды']
            });
        }
        
        // Сохраняем
        Database.users.set(socket.id, userData);
        Database.onlineUsers.add(socket.id);
        Database.analytics.totalUsers = Math.max(Database.analytics.totalUsers, Database.users.size);
        
        // Пиковый онлайн
        if (Database.onlineUsers.size > Database.analytics.peakOnline) {
            Database.analytics.peakOnline = Database.onlineUsers.size;
        }
        
        // Отправляем данные
        socket.emit('registered', {
            user: userData,
            onlineCount: Database.onlineUsers.size,
            initialData: {
                messages: Database.messages.slice(-100),
                channels: Database.channels,
                onlineUsers: Array.from(Database.onlineUsers)
                    .map(id => Database.users.get(id))
                    .filter(Boolean)
                    .map(u => ({
                        id: u.id,
                        username: u.username,
                        displayName: u.displayName,
                        avatarColor: u.avatarColor,
                        status: u.status,
                        badges: u.badges
                    }))
            }
        });
        
        // Уведомляем всех
        socket.broadcast.emit('userJoined', {
            user: {
                id: userData.id,
                username: userData.username,
                displayName: userData.displayName,
                avatarColor: userData.avatarColor,
                badges: userData.badges
            },
            onlineCount: Database.onlineUsers.size,
            time: Utils.formatTime()
        });
        
        // Приветствие от WaveAI
        setTimeout(() => {
            WaveAI.sendAutoMessage(io, 'welcome');
        }, 2000);
        
        console.log(`✅ Зарегистрирован: ${userData.displayName} (@${userData.username}) ${userData.isAdmin ? '(ADMIN)' : ''}`);
    });
    
    // Сообщения
    socket.on('message', async (data) => {
        const user = Database.users.get(socket.id);
        if (!user || !data.text?.trim()) return;
        
        const filteredText = Utils.filterText(data.text.trim());
        
        // Создаем сообщение
        const message = {
            id: Utils.generateId(),
            userId: socket.id,
            user: {
                id: user.id,
                username: user.username,
                displayName: user.displayName,
                avatarColor: user.avatarColor,
                isAdmin: user.isAdmin,
                badges: user.badges
            },
            text: filteredText,
            time: new Date().toISOString(),
            channel: data.channel || 'general',
            edited: false,
            reactions: {},
            repliesTo: data.replyTo
        };
        
        // Сохраняем
        Database.messages.push(message);
        Database.analytics.totalMessages++;
        
        // Отправляем всем
        io.emit('message', message);
        console.log(`💬 ${user.displayName}: ${filteredText.substring(0, 50)}...`);
        
        // WaveAI обработка
        if (filteredText.includes('@waveai') || filteredText.startsWith('/')) {
            setTimeout(async () => {
                const aiResponse = await WaveAI.processMessage(
                    filteredText,
                    socket.id,
                    user.displayName
                );
                
                if (aiResponse) {
                    const botMessage = {
                        id: Utils.generateId(),
                        userId: WaveAI.id,
                        user: {
                            id: WaveAI.id,
                            username: WaveAI.name,
                            displayName: WaveAI.displayName,
                            avatarColor: WaveAI.avatarColor,
                            isBot: true
                        },
                        text: aiResponse,
                        time: new Date().toISOString(),
                        channel: data.channel || 'general',
                        isBot: true,
                        replyingTo: message.id
                    };
                    
                    Database.messages.push(botMessage);
                    io.emit('message', botMessage);
                    
                    // Обновляем статистику AI
                    if (filteredText.startsWith('/ai') || filteredText.includes('@waveai')) {
                        Database.analytics.aiRequestsToday++;
                    }
                }
            }, 800 + Math.random() * 1200);
        }
    });
    
    // Админ команды
    socket.on('admin', (data) => {
        const user = Database.users.get(socket.id);
        if (!user?.isAdmin) {
            socket.emit('error', { message: 'Требуются права администратора' });
            return;
        }
        
        switch(data.action) {
            case 'stats':
                const stats = {
                    users: Database.users.size,
                    online: Database.onlineUsers.size,
                    messages: Database.messages.length,
                    aiRequests: Database.analytics.aiRequestsToday,
                    memory: process.memoryUsage().heapUsed / 1024 / 1024
                };
                socket.emit('adminStats', stats);
                break;
                
            case 'announce':
                const announcement = {
                    id: Utils.generateId(),
                    userId: WaveAI.id,
                    user: {
                        id: WaveAI.id,
                        username: WaveAI.name,
                        displayName: `📢 ${user.displayName} (Админ)`,
                        avatarColor: '#ff6b6b',
                        isBot: true
                    },
                    text: `**ВАЖНО:** ${data.text}`,
                    time: new Date().toISOString(),
                    channel: 'general',
                    isAnnouncement: true
                };
                io.emit('message', announcement);
                Database.messages.push(announcement);
                break;
                
            case 'kick':
                const targetSocket = Array.from(io.sockets.sockets.values())
                    .find(s => Database.users.get(s.id)?.username === data.target);
                if (targetSocket) {
                    targetSocket.emit('notification', {
                        type: 'warning',
                        message: `Вас отключил администратор: ${data.reason}`
                    });
                    setTimeout(() => targetSocket.disconnect(), 3000);
                    io.emit('userKicked', {
                        username: data.target,
                        by: user.displayName,
                        reason: data.reason
                    });
                }
                break;
        }
    });
    
    // Посты
    socket.on('createPost', (data) => {
        const user = Database.users.get(socket.id);
        if (!user || !data.content?.trim()) return;
        
        const post = {
            id: Utils.generateId(),
            userId: socket.id,
            username: user.username,
            displayName: user.displayName,
            avatarColor: user.avatarColor,
            content: Utils.filterText(data.content.trim()),
            likes: [],
            comments: [],
            createdAt: new Date().toISOString(),
            media: data.media || []
        };
        
        Database.posts.unshift(post);
        io.emit('newPost', post);
        console.log(`📝 Новый пост от ${user.displayName}`);
    });
    
    // Каналы
    socket.on('createChannel', (data) => {
        const user = Database.users.get(socket.id);
        if (!user || !data.name?.trim()) return;
        
        const channel = {
            id: Utils.generateId(),
            name: data.name.toLowerCase().replace(/\s+/g, '-'),
            displayName: data.name,
            description: data.description || 'Новый канал',
            owner: user.username,
            type: data.type || 'public',
            members: [socket.id],
            createdAt: Date.now()
        };
        
        Database.channels.push(channel);
        io.emit('newChannel', channel);
        socket.emit('notification', {
            type: 'success',
            message: `Канал #${channel.name} создан!`
        });
    });
    
    // Реакции
    socket.on('react', (data) => {
        const user = Database.users.get(socket.id);
        const message = Database.messages.find(m => m.id === data.messageId);
        
        if (user && message) {
            if (!message.reactions[data.emoji]) {
                message.reactions[data.emoji] = [];
            }
            
            if (!message.reactions[data.emoji].includes(user.id)) {
                message.reactions[data.emoji].push(user.id);
                io.emit('reaction', {
                    messageId: data.messageId,
                    emoji: data.emoji,
                    userId: user.id,
                    count: message.reactions[data.emoji].length
                });
            }
        }
    });
    
    // Отключение
    socket.on('disconnect', () => {
        const user = Database.users.get(socket.id);
        if (user) {
            Database.onlineUsers.delete(socket.id);
            user.lastSeen = Date.now();
            user.status = 'offline';
            
            io.emit('userLeft', {
                userId: user.id,
                onlineCount: Database.onlineUsers.size,
                time: Utils.formatTime()
            });
            
            console.log(`🔌 Отключился: ${user.displayName} (Онлайн: ${Database.onlineUsers.size})`);
            
            // Авто-сохранение если онлайн мало
            if (Database.onlineUsers.size === 0) {
                Database.save();
            }
        }
    });
});

// ========== АВТО-СООБЩЕНИЯ И ТАЙМЕРЫ ==========
// WaveAI советы каждый час
setInterval(() => {
    if (Database.onlineUsers.size > 0) {
        const tips = ['tip', 'fact', 'fun'];
        WaveAI.sendAutoMessage(io, tips[Math.floor(Math.random() * tips.length)]);
    }
}, 60 * 60 * 1000);

// Сохранение каждые 5 минут
setInterval(() => {
    Database.save();
    console.log(`💾 Авто-сохранение (${Database.users.size} пользователей, ${Database.messages.length} сообщений)`);
}, 5 * 60 * 1000);

// Сброс AI статистики каждые 24 часа
setInterval(() => {
    Database.analytics.aiRequestsToday = 0;
    Database.aiRequests.clear();
    console.log('🔄 Статистика AI сброшена');
}, 24 * 60 * 60 * 1000);

// ========== ЗАПУСК СЕРВЕРА ==========
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log('='.repeat(70));
    console.log(`🚀 ${CONFIG.appName} v${CONFIG.version}`);
    console.log(`📡 Порт: ${PORT} | WebSocket: ws://localhost:${PORT}`);
    console.log(`🤖 WaveAI: ${CONFIG.aiApiKey !== 'AIzaSyBV2SHW04Llu5VXzgAzci-QTlNA9uG6ne0' ? 'Режим с Google Gemini API' : 'Демо-режим (нужен API ключ)'}`);
    console.log(`👑 Админ: yakadev (пароль в .env файле)`);
    console.log(`💾 Данные: ${Database.users.size} пользователей загружено`);
    console.log('='.repeat(70));
    
    // Первое сообщение от WaveAI
    setTimeout(() => {
        WaveAI.sendAutoMessage(io, 'welcome');
    }, 5000);
});

// Экспортируем для тестов
module.exports = { app, server, io, Database, WaveAI, CONFIG };