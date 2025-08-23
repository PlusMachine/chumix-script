"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const axios_1 = __importDefault(require("axios"));
const socket_io_client_1 = require("socket.io-client");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
// Парсинг аргументов командной строки
// Парсинг аргументов командной строки
const args = process.argv.slice(2);
let existingRoomId = args.length > 0 ? args[0] : null;
// Если roomId не передан как аргумент, попробуем прочитать из файла
if (!existingRoomId) {
    try {
        const roomIdFile = path_1.default.join(__dirname, 'current_room_id.txt');
        if (fs_1.default.existsSync(roomIdFile) && fs_1.default.statSync(roomIdFile).size > 0) {
            existingRoomId = fs_1.default.readFileSync(roomIdFile, 'utf-8').trim();
            if (existingRoomId && existingRoomId.length > 0) {
                console.log(`Найден сохраненный Room ID: ${existingRoomId}`);
            }
            else {
                existingRoomId = null;
                console.log('Файл с Room ID существует, но пуст. Будет создана новая сессия.');
            }
        }
        else {
            console.log('Не найден сохраненный Room ID. Будет создана новая сессия.');
        }
    }
    catch (error) {
        console.error('Ошибка при чтении Room ID из файла:', error);
    }
}
// Конфигурация
const config = {
    apiBaseUrl: 'http://localhost:3001/api/sessions',
    socketUrl: 'http://localhost:3001/poker',
    gameConfig: {
        ante: 5,
        bigBlind: 10,
        smallBlind: 5,
        numSeats: 6,
        buyIn: 1000
    },
    players: [
        { name: 'TightTiger' },      // Консервативный игрок
        { name: 'WildWolf' },        // Агрессивный игрок  
        { name: 'SlyFox' },          // Хитрый средний игрок
        { name: 'CoolBear' },        // Осторожный игрок
        { name: 'SharpHawk' },       // Наблюдательный игрок
        { name: 'BoldLion' }         // Смелый игрок
    ],
    logFile: path_1.default.join(__dirname, 'poker-test-session.log')
};
// Инициализация логгера
const logger = {
    log: (message) => {
        const timestamp = new Date().toISOString();
        const logMessage = `[${timestamp}] ${message}`;
        console.log(logMessage);
        fs_1.default.appendFileSync(config.logFile, logMessage + '\n');
    },
    error: (message, error) => {
        const timestamp = new Date().toISOString();
        const errorMessage = `[${timestamp}] ERROR: ${message} - ${error instanceof Error ? error.message : JSON.stringify(error)}`;
        console.error(errorMessage);
        fs_1.default.appendFileSync(config.logFile, errorMessage + '\n');
    }
};
// Создаем файл лога или очищаем существующий
fs_1.default.writeFileSync(config.logFile, '--- POKER TEST SESSION LOG ---\n');
// Глобальные переменные для хранения состояния
const state = {
    roomId: existingRoomId, // Инициализируем roomId значением из аргументов командной строки, если оно есть
    players: [],
    spectator: null,
    gameStarted: false,
    currentPlayerIndex: 0,
    handInProgress: false,
    handleTableState: null, // Функция для обработки состояния стола
    lastHandCompleteTime: 0, // Время последнего handComplete с winners для задержки действий
    playerMoods: {
        // Модификаторы настроения для каждого игрока (обновляются периодически)
        0: { tilt: 0, confidence: 0.5, aggression: 0.3, luckFactor: 0.5, bluffMode: false }, // TightTiger - консервативный
        1: { tilt: 0, confidence: 0.5, aggression: 0.8, luckFactor: 0.5, bluffMode: false }, // WildWolf - агрессивный
        2: { tilt: 0, confidence: 0.5, aggression: 0.6, luckFactor: 0.5, bluffMode: false }, // SlyFox - хитрый средний
        3: { tilt: 0, confidence: 0.5, aggression: 0.3, luckFactor: 0.5, bluffMode: false }, // CoolBear - осторожный
        4: { tilt: 0, confidence: 0.5, aggression: 0.7, luckFactor: 0.5, bluffMode: false }, // SharpHawk - наблюдательный
        5: { tilt: 0, confidence: 0.5, aggression: 0.75, luckFactor: 0.5, bluffMode: false }  // BoldLion - смелый
    },
    moodUpdateCounter: 0 // Счетчик для периодического обновления настроения
};
// Функция для сохранения roomId в файл
function saveRoomIdToFile(roomId) {
    try {
        // Сохраняем только в dist/current_room_id.txt
        const filePath = path_1.default.join(__dirname, 'current_room_id.txt');
        fs_1.default.writeFileSync(filePath, roomId);
        logger.log(`Room ID сохранен в файл: ${filePath}`);
        // Валидация сохранения
        if (fs_1.default.existsSync(filePath)) {
            const savedId = fs_1.default.readFileSync(filePath, 'utf-8').trim();
            if (savedId !== roomId) {
                logger.log(`Внимание: сохранённый ID (${savedId}) не соответствует ожидаемому (${roomId})`);
            }
        }
    }
    catch (error) {
        logger.error('Ошибка при сохранении Room ID в файл', error);
    }
}
// Функция для создания сессии
async function createSession() {
    try {
        logger.log('Создание сессии...');
        const response = await axios_1.default.post(`${config.apiBaseUrl}/create`, config.gameConfig);
        const roomId = response.data.roomId;
        state.roomId = roomId;
        // Сохраняем roomId в файл
        saveRoomIdToFile(roomId);
        // Выводим roomId заметно, чтобы пользователь мог его легко скопировать
        logger.log('\n\n');
        logger.log('*******************************************************');
        logger.log('*******************************************************');
        logger.log(`***                                                 ***`);
        logger.log(`***             ROOM ID: ${roomId}                ***`);
        logger.log(`***                                                 ***`);
        logger.log('*******************************************************');
        logger.log('*******************************************************');
        logger.log('\n\n');
        return roomId;
    }
    catch (error) {
        logger.error('Ошибка при создании сессии', error);
        throw error;
    }
}
// Функция для подключения Socket.IO
function connectSocket() {
    return new Promise((resolve) => {
        const socket = (0, socket_io_client_1.io)(config.socketUrl);
        // Обработчик события подключения
        socket.on('connect', () => {
            logger.log(`Socket соединение установлено, ожидание ID от сервера...`);
        });
        // Обработчик события 'connected' от сервера, который отправляет socketId
        socket.on('connected', (data) => {
            logger.log(`Получен socket ID от сервера: ${data.socketId}`);
            // Проверяем, что ID сокета в данных совпадает с ID сокета в объекте socket
            if (socket.id !== data.socketId) {
                logger.log(`Внимание: ID сокета от сервера (${data.socketId}) отличается от локального ID (${socket.id})`);
            }
            // Разрешаем промис, возвращая сокет
            resolve(socket);
        });
        // Обработчик ошибок
        socket.on('connect_error', (error) => {
            logger.error(`Ошибка подключения к socket.io серверу`, error);
        });
        // Установим таймаут на подключение, чтобы не зависать, если сервер не отвечает
        setTimeout(() => {
            // Если через 5 секунд нет ответа от сервера, но соединение есть, все равно продолжаем
            if (socket.connected && !socket.disconnected) {
                logger.log(`Таймаут ожидания ID от сервера, используем локальный ID: ${socket.id}`);
                resolve(socket);
            }
        }, 5000);
    });
}
// Функция для подключения игрока к сессии
async function joinPlayer(playerName, socket) {
    try {
        if (!state.roomId) {
            throw new Error('Room ID is not set');
        }
        logger.log(`Подключение игрока ${playerName} к сессии ${state.roomId}...`);
        const response = await axios_1.default.post(`${config.apiBaseUrl}/join`, {
            roomId: state.roomId,
            name: playerName,
            socketId: socket.id || '',
            buyIn: config.gameConfig.buyIn
        });
        const playerData = {
            name: playerName,
            socketId: socket.id || '',
            playerId: response.data.playerId,
            seatIndex: response.data.seatIndex,
            socket: socket
        };
        state.players.push(playerData);
        logger.log(`Игрок ${playerName} успешно подключен к сессии. PlayerId: ${playerData.playerId}, Seat: ${playerData.seatIndex}`);
        // Настройка слушателей событий для игрока
        setupPlayerListeners(playerData);
        return playerData;
    }
    catch (error) {
        logger.error(`Ошибка при подключении игрока ${playerName}`, error);
        throw error;
    }
}
// Функция для подключения спектатора к сессии
async function joinSpectator(socket) {
    try {
        if (!state.roomId) {
            throw new Error('Room ID is not set');
        }
        logger.log(`Подключение спектатора к сессии ${state.roomId}...`);
        const response = await axios_1.default.post(`${config.apiBaseUrl}/spectate`, {
            roomId: state.roomId,
            socketId: socket.id || ''
        });
        const spectatorData = {
            socketId: socket.id || '',
            socket: socket
        };
        state.spectator = spectatorData;
        logger.log(`Спектатор успешно подключен к сессии. Всего спектаторов: ${response.data.spectatorCount}`);
        // Настройка слушателей событий для спектатора
        setupSpectatorListeners(spectatorData);
        return spectatorData;
    }
    catch (error) {
        logger.error('Ошибка при подключении спектатора', error);
        throw error;
    }
}
// Настройка слушателей событий для игрока
function setupPlayerListeners(playerData) {
    const { socket, name } = playerData;

    // Слушаем обновления состояния стола и проверяем завершение раздачи
    socket.on('tableState', (tableState) => {
        logger.log(`[${name}] Получено прямое обновление tableState: ${JSON.stringify(tableState, null, 2)}`);

        // Проверяем, есть ли handComplete с winners для задержки следующих действий
        if (tableState.handComplete && tableState.winners && tableState.winners.length > 0) {
            logger.log(`[${name}] Обнаружено завершение раздачи с победителями`);

            // Сохраняем время завершения раздачи для задержки следующих действий
            state.lastHandCompleteTime = Date.now();

            // Логируем информацию о победителях
            tableState.winners.forEach((winner, index) => {
                try {
                    // Более безопасное извлечение данных победителя
                    let seatIndex, cards, handData;

                    if (Array.isArray(winner) && winner.length >= 2) {
                        // Структура: [seatIndex, [cards, handData]]
                        seatIndex = winner[0];
                        if (Array.isArray(winner[1]) && winner[1].length >= 2) {
                            cards = winner[1][0];
                            handData = winner[1][1];
                        }
                    } else if (typeof winner === 'object' && winner !== null) {
                        // Структура объекта
                        seatIndex = winner.seatIndex || winner.seat || 'Unknown';
                        cards = winner.cards || winner.hand;
                        handData = winner.handData || winner.handInfo;
                    }

                    logger.log(`[${name}] Победитель ${index + 1}: Seat ${seatIndex}, Комбинация: ${JSON.stringify(cards)}, Сила: ${handData ? handData.strength : 'Unknown'}`);
                } catch (error) {
                    logger.log(`[${name}] Ошибка при обработке победителя ${index + 1}: ${error.message}. Данные: ${JSON.stringify(winner)}`);
                }
            });

            logger.log(`[${name}] Следующие действия будут задержаны на 20 секунд для просмотра результатов раздачи`);
        }

        // Проверяем, началась ли игра
        if (tableState.isHandInProgress && !state.gameStarted) {
            logger.log(`Игра автоматически началась после подключения игроков (прямое событие tableState)`);
            state.gameStarted = true;
            setTimeout(startGamePlay, 2000);
        }

        // Обрабатываем состояние игры, если игра уже началась
        if (state.gameStarted && state.handleTableState) {
            logger.log(`[${name}] Вызываем handleTableState...`);
            state.handleTableState(tableState);
        } else {
            logger.log(`[${name}] Не вызываем handleTableState: gameStarted=${state.gameStarted}, handleTableState=${!!state.handleTableState}`);
            // Если игра еще не началась но есть isHandInProgress, запускаем игру
            if (tableState.isHandInProgress && !state.gameStarted) {
                logger.log(`[${name}] Обнаружено начало игры, запускаем игровой процесс`);
                state.gameStarted = true;
                setTimeout(() => {
                    logger.log(`[${name}] Вызываем handleTableState после запуска игры...`);
                    if (state.handleTableState) {
                        state.handleTableState(tableState);
                    }
                }, 1000);
            }
        }
    });

    // Слушаем сообщения от сервера через событие message
    socket.on('message', (message) => {
        logger.log(`[${name}] Получено сообщение: ${JSON.stringify(message)}`);

        // Обрабатываем сообщение о состоянии стола
        if (message.type === 'tableState' && message.data) {
            logger.log(`[${name}] Получено обновление tableState через message: ${JSON.stringify(message.data, null, 2)}`);

            // Проверяем, началась ли игра
            if (message.data.isHandInProgress && !state.gameStarted) {
                logger.log(`Игра автоматически началась после подключения игроков (через message)`);
                state.gameStarted = true;
                setTimeout(startGamePlay, 2000);
            }

            // Обрабатываем состояние игры, если игра уже началась
            if (state.gameStarted && state.handleTableState) {
                state.handleTableState(message.data);
            }
        }

        // Проверяем, есть ли в сообщении информация о начале игры
        if (message.type === 'gameStarted') {
            logger.log(`Получено сообщение о начале игры`);
            if (!state.gameStarted) {
                state.gameStarted = true;
                setTimeout(startGamePlay, 2000);
            }
        }
    });

    // Слушаем приватные обновления для игрока
    socket.on('privateState', (privateState) => {
        logger.log(`[${name}] Получено приватное состояние: ${JSON.stringify(privateState, null, 2)}`);

        // Сохраняем доступные действия для игрока
        playerData.availableActions = privateState.availableActions;

        // Если у игрока есть доступные действия, он должен сделать ход
        if (privateState.availableActions && privateState.availableActions.actions &&
            privateState.availableActions.actions.length > 0) {

            if (!state.gameStarted) {
                logger.log(`Игра началась, получены доступные действия для игрока ${name}`);
                state.gameStarted = true;
                setTimeout(startGamePlay, 2000);
            }

            // Игрок должен сделать ход, так как у него есть доступные действия
            logger.log(`[${name}] Получены доступные действия: ${JSON.stringify(privateState.availableActions)} - начинаем обработку хода`);

            // Вызываем обработку хода для этого конкретного игрока
            handlePlayerAction(playerData, privateState.availableActions);
        } else {
            logger.log(`[${name}] Нет доступных действий в privateState`);
        }
    });


}
// Настройка слушателей событий для спектатора
function setupSpectatorListeners(spectatorData) {
    const { socket } = spectatorData;

    // Слушаем обновления состояния стола и проверяем завершение раздачи
    socket.on('tableState', (tableState) => {
        logger.log(`[Spectator] Получено прямое обновление tableState: ${JSON.stringify(tableState, null, 2)}`);

        // Проверяем, есть ли handComplete с winners для задержки следующих действий
        if (tableState.handComplete && tableState.winners && tableState.winners.length > 0) {
            logger.log(`[Spectator] Обнаружено завершение раздачи с победителями`);

            // Сохраняем время завершения раздачи для задержки следующих действий
            state.lastHandCompleteTime = Date.now();

            // Логируем информацию о победителях
            tableState.winners.forEach((winner, index) => {
                try {
                    // Более безопасное извлечение данных победителя
                    let seatIndex, cards, handData;

                    if (Array.isArray(winner) && winner.length >= 2) {
                        // Структура: [seatIndex, [cards, handData]]
                        seatIndex = winner[0];
                        if (Array.isArray(winner[1]) && winner[1].length >= 2) {
                            cards = winner[1][0];
                            handData = winner[1][1];
                        }
                    } else if (typeof winner === 'object' && winner !== null) {
                        // Структура объекта
                        seatIndex = winner.seatIndex || winner.seat || 'Unknown';
                        cards = winner.cards || winner.hand;
                        handData = winner.handData || winner.handInfo;
                    }

                    logger.log(`[Spectator] Победитель ${index + 1}: Seat ${seatIndex}, Комбинация: ${JSON.stringify(cards)}, Сила: ${handData ? handData.strength : 'Unknown'}`);
                } catch (error) {
                    logger.log(`[Spectator] Ошибка при обработке победителя ${index + 1}: ${error.message}. Данные: ${JSON.stringify(winner)}`);
                }
            });

            logger.log(`[Spectator] Следующие действия будут задержаны на 20 секунд для просмотра результатов раздачи`);
        }

        // Проверяем, началась ли игра
        if (tableState.isHandInProgress && !state.gameStarted) {
            logger.log(`Игра автоматически началась (обнаружено спектатором через прямое событие)`);
            state.gameStarted = true;
            setTimeout(startGamePlay, 2000);
        }

        // Обрабатываем состояние игры, если игра уже началась
        if (state.gameStarted && state.handleTableState) {
            logger.log(`[Spectator] Вызываем handleTableState...`);
            state.handleTableState(tableState);
        } else {
            logger.log(`[Spectator] Не вызываем handleTableState: gameStarted=${state.gameStarted}, handleTableState=${!!state.handleTableState}`);
        }
    });

    // Слушаем сообщения через событие message
    socket.on('message', (message) => {
        logger.log(`[Spectator] Получено сообщение: ${JSON.stringify(message)}`);

        // Обрабатываем сообщение о состоянии стола
        if (message.type === 'tableState' && message.data) {
            logger.log(`[Spectator] Получено обновление tableState через message: ${JSON.stringify(message.data, null, 2)}`);

            // Проверяем, началась ли игра
            if (message.data.isHandInProgress && !state.gameStarted) {
                logger.log(`Игра автоматически началась (обнаружено спектатором через message)`);
                state.gameStarted = true;
                setTimeout(startGamePlay, 2000);
            }

            // Обрабатываем состояние игры, если игра уже началась
            if (state.gameStarted && state.handleTableState) {
                state.handleTableState(message.data);
            }
        }
    });


}
// Функция для выполнения действия игрока
function performPlayerAction(playerData, action, amount = null) {
    const { socket, playerId } = playerData;
    if (state.roomId === null) {
        logger.error(`Невозможно выполнить действие: roomId не определен`, new Error('roomId is null'));
        return;
    }
    const actionData = {
        action,
        playerId,
        roomId: state.roomId
    };
    if (amount !== null) {
        actionData.amount = amount;
    }
    logger.log(`[${playerData.name}] Выполняет действие: ${action}${amount !== null ? ` с суммой ${amount}` : ''}`);
    socket.emit('pokerAction', actionData);
}
// Функции для управления настроением игроков
function updatePlayerMoods() {
    state.moodUpdateCounter++;

    // Обновляем настроение каждые 2-5 ходов (чаще для больше разнообразия)
    if (state.moodUpdateCounter % (2 + Math.floor(Math.random() * 4)) !== 0) {
        return;
    }

    Object.keys(state.playerMoods).forEach(seatIndex => {
        const mood = state.playerMoods[seatIndex];

        // Тилт постепенно снижается (0.7-0.95)
        mood.tilt *= (0.7 + Math.random() * 0.25);

        // Уверенность колеблется случайно (±0.15)
        mood.confidence += (Math.random() - 0.5) * 0.3;
        mood.confidence = Math.max(0.05, Math.min(0.95, mood.confidence));

        // Агрессивность тоже может меняться больше (±0.08)
        mood.aggression += (Math.random() - 0.5) * 0.16;
        mood.aggression = Math.max(0.05, Math.min(0.95, mood.aggression));

        // Добавляем случайный фактор "удачи" для еще большего разнообразия
        if (!mood.luckFactor) mood.luckFactor = 0.5;
        mood.luckFactor += (Math.random() - 0.5) * 0.2;
        mood.luckFactor = Math.max(0.1, Math.min(0.9, mood.luckFactor));

        // Снижаем шанс сильных изменений настроения (2% шанс вместо 4%)
        if (Math.random() < 0.02) {
            const eventType = Math.random();
            const playerNames = ['TightTiger', 'WildWolf', 'SlyFox', 'CoolBear', 'SharpHawk', 'BoldLion'];
            const playerName = playerNames[parseInt(seatIndex)] || `Player ${parseInt(seatIndex) + 1}`;
            
            if (eventType < 0.25) {
                // Умеренный тилт (снижено влияние)
                mood.tilt += Math.random() * 0.3 + 0.1; // было 0.5 + 0.2
                mood.aggression += Math.random() * 0.15; // было 0.3
                mood.confidence -= Math.random() * 0.1; // было 0.2
                logger.log(`${playerName} умеренно тильтует (тилт: +${(mood.tilt * 100).toFixed(0)}%, агрессия: +${(mood.aggression * 100).toFixed(0)}%)`);
            } else if (eventType < 0.45) {
                // Умеренная удачная серия (снижено влияние)
                mood.confidence += Math.random() * 0.25 + 0.05; // было 0.4 + 0.1
                mood.aggression += Math.random() * 0.1; // было 0.2
                mood.luckFactor += Math.random() * 0.2; // было 0.3
                logger.log(`${playerName} везучий (уверенность: +${(mood.confidence * 100).toFixed(0)}%, удача: +${(mood.luckFactor * 100).toFixed(0)}%)`);
            } else if (eventType < 0.65) {
                // Умеренная осторожность (снижено влияние)
                mood.aggression -= Math.random() * 0.2; // было 0.3
                mood.tilt *= 0.5; // было 0.3
                mood.confidence -= Math.random() * 0.08; // было 0.15
                logger.log(`${playerName} стал осторожным (агрессия: -${(mood.aggression * 100).toFixed(0)}%, тилт снижен)`);
            } else if (eventType < 0.8) {
                // Умеренное блефовое настроение (снижено влияние)
                mood.aggression += Math.random() * 0.15; // было 0.25
                mood.confidence += Math.random() * 0.1; // было 0.2
                mood.bluffMode = Math.random() < 0.5; // 50% шанс войти в режим блефа (было 70%)
                logger.log(`${playerName} в умеренном блефовом настроении (агрессия: +${(mood.aggression * 100).toFixed(0)}%, блеф: ${mood.bluffMode ? 'ДА' : 'НЕТ'})`);
            } else {
                // Умеренная смена стиля (снижено влияние)
                mood.aggression = Math.random() * 0.6 + 0.2; // было 0.8 + 0.1
                mood.confidence = Math.random() * 0.6 + 0.2; // было 0.8 + 0.1
                mood.tilt = Math.random() * 0.2; // было 0.4
                logger.log(`${playerName} умеренно меняет стиль (новая агрессия: ${(mood.aggression * 100).toFixed(0)}%, уверенность: ${(mood.confidence * 100).toFixed(0)}%)`);
            }
        }

        // Ограничиваем значения
        mood.tilt = Math.max(0, Math.min(1, mood.tilt));
        mood.confidence = Math.max(0.05, Math.min(0.95, mood.confidence));
        mood.aggression = Math.max(0.05, Math.min(0.95, mood.aggression));
        mood.luckFactor = Math.max(0.1, Math.min(0.9, mood.luckFactor));
    });
}

function getMoodModifiers(seatIndex) {
    updatePlayerMoods(); // Обновляем настроение перед получением модификаторов

    const mood = state.playerMoods[seatIndex] || { tilt: 0, confidence: 0.5, aggression: 0.5, luckFactor: 0.5, bluffMode: false };

    // Убеждаемся, что все значения определены
    if (typeof mood.luckFactor !== 'number' || isNaN(mood.luckFactor)) mood.luckFactor = 0.5;
    if (typeof mood.bluffMode !== 'boolean') mood.bluffMode = false;

    // Добавляем случайный фактор для еще большего разнообразия
    const randomBoost = (Math.random() - 0.5) * 0.1; // ±5% случайности

    return {
        // Модификатор вероятности all-in (РАДИКАЛЬНО уменьшен)
        allinModifier: mood.tilt * 0.01 + (mood.confidence - 0.5) * 0.005 + (mood.bluffMode ? 0.002 : 0) + randomBoost * 0.1,

        // Модификатор агрессивности ставок (сильно уменьшен)
        aggressionModifier: (mood.aggression - 0.5) * 0.1 + (mood.confidence - 0.5) * 0.05 + (mood.luckFactor - 0.5) * 0.03 + randomBoost * 0.2,

        // Модификатор вероятности фолда (сильно уменьшен)
        foldModifier: -mood.tilt * 0.05 + (0.5 - mood.confidence) * 0.04 - (mood.bluffMode ? 0.01 : 0) + randomBoost * 0.2,

        // Модификатор размера ставки (сильно уменьшен)
        betSizeModifier: (mood.luckFactor - 0.5) * 0.05 + (mood.confidence - 0.5) * 0.02,

        // Модификатор необычного поведения (сильно уменьшен)
        unusualBehaviorChance: mood.tilt * 0.03 + (mood.bluffMode ? 0.02 : 0),

        // Текущее настроение для логирования
        currentMood: {
            tilt: Math.round(mood.tilt * 100),
            confidence: Math.round(mood.confidence * 100),
            aggression: Math.round(mood.aggression * 100),
            luck: Math.round(mood.luckFactor * 100),
            bluffMode: mood.bluffMode || false
        }
    };
}

// Функция для определения действия на основе доступных опций
function getActionForPlayer(playerIndex, legalActions, roundOfBetting) {
    const actions = legalActions.actions;

    logger.log(`Определяем действие для игрока seat ${playerIndex}. Доступные действия: ${JSON.stringify(actions)}`);

    // Логирование диапазона допустимых ставок
    if (legalActions.chipRange) {
        logger.log(`Допустимый диапазон ставок: ${legalActions.chipRange.min}-${legalActions.chipRange.max}`);
    }

    // Функция для расчета ставки определенного размера от диапазона
    const calculateBet = (min, max, percentage) => {
        return Math.floor(min + (max - min) * percentage);
    };

    // Получаем модификаторы настроения
    const moodMods = getMoodModifiers(playerIndex);
    const playerNames = ['TightTiger', 'WildWolf', 'SlyFox', 'CoolBear', 'SharpHawk', 'BoldLion'];
    logger.log(`${playerNames[playerIndex]} настроение: тилт ${moodMods.currentMood.tilt}%, уверенность ${moodMods.currentMood.confidence}%, агрессия ${moodMods.currentMood.aggression}%, удача ${moodMods.currentMood.luck}%, блеф-режим: ${moodMods.currentMood.bluffMode ? 'ДА' : 'НЕТ'}`);
    logger.log(`${playerNames[playerIndex]} модификаторы: all-in +${(moodMods.allinModifier * 100).toFixed(1)}%, агрессия +${(moodMods.aggressionModifier * 100).toFixed(1)}%, фолд +${(moodMods.foldModifier * 100).toFixed(1)}%`);

    // Добавляем общий случайный фактор для разнообразия (0-1)
    const randomFactor = Math.random();

    // Модификатор агрессивности из настроения
    const baseMoodAggression = moodMods.aggressionModifier;

    // Иногда игроки могут действовать нехарактерно (базовый шанс 8%, увеличивается от тилта и блеф-режима)
    const isUnusualBehavior = Math.random() < (0.08 + moodMods.unusualBehaviorChance);

    // Добавляем редкие случайные ходы (0.5% шанс на полностью рандомное действие - снижено)
    if (Math.random() < 0.005) {
        const randomAction = actions[Math.floor(Math.random() * actions.length)];
        const playerNames = ['TightTiger', 'WildWolf', 'SlyFox', 'CoolBear', 'SharpHawk', 'BoldLion'];
        logger.log(`${playerNames[playerIndex]} делает ОЧЕНЬ РЕДКОЕ случайное действие: ${randomAction}!`);

        if (randomAction === 'bet' || randomAction === 'raise') {
            const minAmount = legalActions.chipRange?.min || 10;
            const maxAmount = legalActions.chipRange?.max || 100;
            // Даже случайные ставки теперь очень малые
            const randomAmount = calculateBet(minAmount, maxAmount, Math.random() * 0.3 + 0.1); // 10-40% (снижено)
            return { action: randomAction, amount: randomAmount };
        }
        return { action: randomAction };
    }

    // Случайная агрессивность (влияет на размер ставок) + модификатор настроения
    const aggressionBoost = Math.random() * 0.2 + baseMoodAggression; // 0-20% + модификатор настроения

    // Стратегии для всех 6 игроков
    switch (playerIndex) {
        case 0: // TightTiger - очень консервативный, редко блефует
            if (isUnusualBehavior) {
                logger.log(`TightTiger сегодня в нехарактерно агрессивном настроении!`);
                if (Math.random() < 0.15 && (actions.includes('bet') || actions.includes('raise'))) {
                    const minBet = legalActions.chipRange?.min || 10;
                    const maxBet = legalActions.chipRange?.max || 100;
                    const aggressiveBet = calculateBet(minBet, maxBet, 0.4 + Math.random() * 0.2);
                    logger.log(`TightTiger НЕОЖИДАННО АГРЕССИВЕН: ${aggressiveBet}!`);
                    return { action: actions.includes('bet') ? 'bet' : 'raise', amount: aggressiveBet };
                }
            }

            const allinChance0 = 0.001 + randomFactor * 0.002 + Math.max(0, moodMods.allinModifier * 0.1);
            if (Math.random() < allinChance0 && (actions.includes('bet') || actions.includes('raise'))) {
                const maxBet = legalActions.chipRange?.max || 100;
                logger.log(`TightTiger КРАЙНЕ РЕДКО идет ALL-IN: ${maxBet}!`);
                return { action: actions.includes('bet') ? 'bet' : 'raise', amount: maxBet };
            }

            const checkChance = 0.6 + randomFactor * 0.2 - Math.max(0, moodMods.aggressionModifier * 0.5);
            if (actions.includes('check') && Math.random() < checkChance) return { action: 'check' };

            const foldChance = 0.25 + randomFactor * 0.2 + Math.max(0, moodMods.foldModifier);
            if (Math.random() < foldChance && actions.includes('fold')) return { action: 'fold' };

            if (actions.includes('call')) return { action: 'call' };

            const betChance = 0.2 + randomFactor * 0.2 + Math.max(0, moodMods.aggressionModifier * 0.4);
            if (actions.includes('bet') && Math.random() < betChance) {
                const minBet = legalActions.chipRange?.min || 10;
                const maxBet = legalActions.chipRange?.max || 100;
                const betPercentage = Math.random() * 0.2 + 0.1 + Math.max(0, aggressionBoost) + moodMods.betSizeModifier;
                const betAmount = calculateBet(minBet, maxBet, Math.min(betPercentage, 0.4));
                logger.log(`TightTiger делает консервативную ставку ${betAmount} (${Math.round(betPercentage * 100)}%)`);
                return { action: 'bet', amount: betAmount };
            }

            if (actions.includes('fold')) return { action: 'fold' };
            if (actions.includes('check')) return { action: 'check' };
            break;

        case 1: // WildWolf - агрессивный, но контролируемый
            if (isUnusualBehavior && moodMods.currentMood.confidence < 40) {
                logger.log(`WildWolf сегодня играет осторожно из-за низкой уверенности!`);
                if (actions.includes('check') && Math.random() < 0.7) return { action: 'check' };
                if (actions.includes('call') && Math.random() < 0.8) return { action: 'call' };
                if (Math.random() < 0.3 && actions.includes('fold')) return { action: 'fold' };
            }

            const allinChance1 = 0.003 + randomFactor * 0.005 + Math.max(0, moodMods.allinModifier * 0.2);
            if (Math.random() < allinChance1 && (actions.includes('bet') || actions.includes('raise'))) {
                const maxBet = legalActions.chipRange?.max || 100;
                logger.log(`WildWolf идет ALL-IN: ${maxBet}! (шанс был ${(allinChance1 * 100).toFixed(3)}%)`);
                return { action: actions.includes('bet') ? 'bet' : 'raise', amount: maxBet };
            }

            const betChance1 = 0.4 + randomFactor * 0.2;
            if (actions.includes('bet') && Math.random() < betChance1) {
                const minBet = legalActions.chipRange?.min || 10;
                const maxBet = legalActions.chipRange?.max || 100;
                const betPercentage = Math.random() * 0.3 + 0.2 + aggressionBoost * 0.3 + moodMods.betSizeModifier;
                const betAmount = calculateBet(minBet, maxBet, Math.min(betPercentage, 0.6));
                logger.log(`WildWolf делает агрессивную ставку ${betAmount} (${Math.round(betPercentage * 100)}%)`);
                return { action: 'bet', amount: betAmount };
            }

            const raiseChance1 = 0.25 + randomFactor * 0.15;
            if (actions.includes('raise') && Math.random() < raiseChance1) {
                const minRaise = legalActions.chipRange?.min || 20;
                const maxRaise = legalActions.chipRange?.max || 100;
                const raisePercentage = Math.random() * 0.25 + 0.2 + aggressionBoost * 0.3 + moodMods.betSizeModifier;
                const raiseAmount = calculateBet(minRaise, maxRaise, Math.min(raisePercentage, 0.5));
                logger.log(`WildWolf делает рейз ${raiseAmount} (${Math.round(raisePercentage * 100)}%)`);
                return { action: 'raise', amount: raiseAmount };
            }

            if (actions.includes('call')) return { action: 'call' };
            if (actions.includes('check')) return { action: 'check' };

            const foldChance1 = 0.1 + randomFactor * 0.2 + Math.max(0, moodMods.foldModifier);
            if (Math.random() < foldChance1 && actions.includes('fold')) return { action: 'fold' };
            break;

        case 2: // SlyFox - хитрый, непредсказуемый средний игрок
            if (isUnusualBehavior) {
                if (Math.random() < 0.5) {
                    logger.log(`SlyFox сегодня в блефовом настроении!`);
                    if (Math.random() < 0.25 && (actions.includes('bet') || actions.includes('raise'))) {
                        const maxBet = legalActions.chipRange?.max || 100;
                        logger.log(`SlyFox БЛЕФУЕТ АГРЕССИВНО: ${maxBet}!`);
                        return { action: actions.includes('bet') ? 'bet' : 'raise', amount: maxBet };
                    }
                } else {
                    logger.log(`SlyFox играет очень пассивно!`);
                    if (actions.includes('check') && Math.random() < 0.8) return { action: 'check' };
                    if (Math.random() < 0.5 && actions.includes('fold')) return { action: 'fold' };
                }
            }

            const allinChance2 = 0.002 + randomFactor * 0.004 + Math.max(0, moodMods.allinModifier * 0.15);
            if (Math.random() < allinChance2 && (actions.includes('bet') || actions.includes('raise'))) {
                const maxBet = legalActions.chipRange?.max || 100;
                logger.log(`SlyFox хитро блефует ALL-IN: ${maxBet}!`);
                return { action: actions.includes('bet') ? 'bet' : 'raise', amount: maxBet };
            }

            const checkChance2 = 0.35 + randomFactor * 0.3 - Math.max(0, moodMods.aggressionModifier * 0.3);
            if (actions.includes('check') && Math.random() < checkChance2) return { action: 'check' };

            const callChance2 = 0.45 + randomFactor * 0.25 + Math.max(0, moodMods.currentMood.confidence - 50) * 0.01;
            const foldChance2 = 0.2 + randomFactor * 0.2 + Math.max(0, moodMods.foldModifier);

            if (actions.includes('call') && Math.random() < callChance2) {
                return { action: 'call' };
            } else if (actions.includes('fold') && Math.random() < foldChance2) {
                return { action: 'fold' };
            }

            const betChance2 = 0.3 + randomFactor * 0.2;
            if (actions.includes('bet') && Math.random() < betChance2) {
                const minBet = legalActions.chipRange?.min || 10;
                const maxBet = legalActions.chipRange?.max || 100;
                const betPercentage = Math.random() * 0.25 + 0.15 + aggressionBoost * 0.4 + moodMods.betSizeModifier;
                const betAmount = calculateBet(minBet, maxBet, Math.min(betPercentage, 0.65));
                logger.log(`SlyFox делает хитрую ставку ${betAmount} (${Math.round(betPercentage * 100)}%)`);
                return { action: 'bet', amount: betAmount };
            }

            if (actions.includes('check')) return { action: 'check' };
            if (actions.includes('call')) return { action: 'call' };
            if (actions.includes('fold')) return { action: 'fold' };
            break;

        case 3: // CoolBear - очень осторожный, тайтовый игрок
            if (isUnusualBehavior) {
                logger.log(`CoolBear сегодня неожиданно блефует!`);
                if (Math.random() < 0.15 && (actions.includes('bet') || actions.includes('raise'))) {
                    const maxBet = legalActions.chipRange?.max || 100;
                    logger.log(`CoolBear НЕОЖИДАННЫЙ БЛЕФ ОТ ТАЙТА: ${maxBet}!`);
                    return { action: actions.includes('bet') ? 'bet' : 'raise', amount: maxBet };
                }
            }

            const allinChance3 = 0.0005 + randomFactor * 0.0015 + Math.max(0, moodMods.allinModifier * 0.05);
            if (Math.random() < allinChance3 && (actions.includes('bet') || actions.includes('raise'))) {
                const maxBet = legalActions.chipRange?.max || 100;
                logger.log(`CoolBear УЛЬТРА РЕДКИЙ ALL-IN: ${maxBet}! (скорее всего натсы)`);
                return { action: actions.includes('bet') ? 'bet' : 'raise', amount: maxBet };
            }

            const checkChance3 = 0.6 + randomFactor * 0.25 + Math.max(0, (50 - moodMods.currentMood.aggression) * 0.005);
            if (actions.includes('check') && Math.random() < checkChance3) return { action: 'check' };

            const callChance3 = 0.35 + randomFactor * 0.3 + Math.max(0, (moodMods.currentMood.confidence - 40) * 0.01);
            const foldChance3 = 0.3 + randomFactor * 0.25 + Math.max(0, moodMods.foldModifier);

            if (actions.includes('call') && Math.random() < callChance3) {
                return { action: 'call' };
            } else if (actions.includes('fold') && Math.random() < foldChance3) {
                return { action: 'fold' };
            }

            const betChance3 = 0.15 + randomFactor * 0.15;
            if (actions.includes('bet') && Math.random() < betChance3) {
                const minBet = legalActions.chipRange?.min || 10;
                const maxBet = legalActions.chipRange?.max || 100;
                let betPercentage = Math.random() * 0.15 + 0.1;
                if (Math.random() < 0.08) {
                    betPercentage = Math.random() * 0.25 + 0.25;
                    logger.log(`CoolBear НЕОЖИДАННО делает БОЛЬШУЮ ставку!`);
                }
                betPercentage += aggressionBoost * 0.3 + moodMods.betSizeModifier;
                const betAmount = calculateBet(minBet, maxBet, Math.min(betPercentage, 0.55));
                logger.log(`CoolBear делает осторожную ставку ${betAmount} (${Math.round(betPercentage * 100)}%)`);
                return { action: 'bet', amount: betAmount };
            }

            if (actions.includes('call')) return { action: 'call' };
            break;

        case 4: // SharpHawk - наблюдательный, тактический игрок
            if (isUnusualBehavior) {
                logger.log(`SharpHawk меняет тактику!`);
                if (Math.random() < 0.3) {
                    if (actions.includes('check') && Math.random() < 0.6) return { action: 'check' };
                } else if (Math.random() < 0.2 && (actions.includes('bet') || actions.includes('raise'))) {
                    const minBet = legalActions.chipRange?.min || 10;
                    const maxBet = legalActions.chipRange?.max || 100;
                    const tacticalBet = calculateBet(minBet, maxBet, 0.5 + Math.random() * 0.3);
                    logger.log(`SharpHawk делает тактическую ставку: ${tacticalBet}!`);
                    return { action: actions.includes('bet') ? 'bet' : 'raise', amount: tacticalBet };
                }
            }

            const allinChance4 = 0.002 + randomFactor * 0.003 + Math.max(0, moodMods.allinModifier * 0.12);
            if (Math.random() < allinChance4 && (actions.includes('bet') || actions.includes('raise'))) {
                const maxBet = legalActions.chipRange?.max || 100;
                logger.log(`SharpHawk тактически идет ALL-IN: ${maxBet}!`);
                return { action: actions.includes('bet') ? 'bet' : 'raise', amount: maxBet };
            }

            const checkChance4 = 0.4 + randomFactor * 0.25;
            if (actions.includes('check') && Math.random() < checkChance4) return { action: 'check' };

            const betChance4 = 0.35 + randomFactor * 0.2;
            if (actions.includes('bet') && Math.random() < betChance4) {
                const minBet = legalActions.chipRange?.min || 10;
                const maxBet = legalActions.chipRange?.max || 100;
                const betPercentage = Math.random() * 0.3 + 0.2 + aggressionBoost * 0.4 + moodMods.betSizeModifier;
                const betAmount = calculateBet(minBet, maxBet, Math.min(betPercentage, 0.7));
                logger.log(`SharpHawk делает тактическую ставку ${betAmount} (${Math.round(betPercentage * 100)}%)`);
                return { action: 'bet', amount: betAmount };
            }

            if (actions.includes('call')) return { action: 'call' };

            const foldChance4 = 0.15 + randomFactor * 0.2 + Math.max(0, moodMods.foldModifier);
            if (Math.random() < foldChance4 && actions.includes('fold')) return { action: 'fold' };
            break;

        case 5: // BoldLion - смелый, решительный игрок
            if (isUnusualBehavior) {
                logger.log(`BoldLion в особенно смелом настроении!`);
                if (Math.random() < 0.25 && (actions.includes('bet') || actions.includes('raise'))) {
                    const maxBet = legalActions.chipRange?.max || 100;
                    logger.log(`BoldLion СМЕЛО идет ва-банк: ${maxBet}!`);
                    return { action: actions.includes('bet') ? 'bet' : 'raise', amount: maxBet };
                }
            }

            const allinChance5 = 0.004 + randomFactor * 0.006 + Math.max(0, moodMods.allinModifier * 0.25);
            if (Math.random() < allinChance5 && (actions.includes('bet') || actions.includes('raise'))) {
                const maxBet = legalActions.chipRange?.max || 100;
                logger.log(`BoldLion СМЕЛО идет ALL-IN: ${maxBet}!`);
                return { action: actions.includes('bet') ? 'bet' : 'raise', amount: maxBet };
            }

            const betChance5 = 0.45 + randomFactor * 0.2;
            if (actions.includes('bet') && Math.random() < betChance5) {
                const minBet = legalActions.chipRange?.min || 10;
                const maxBet = legalActions.chipRange?.max || 100;
                const betPercentage = Math.random() * 0.35 + 0.25 + aggressionBoost * 0.4 + moodMods.betSizeModifier;
                const betAmount = calculateBet(minBet, maxBet, Math.min(betPercentage, 0.75));
                logger.log(`BoldLion делает смелую ставку ${betAmount} (${Math.round(betPercentage * 100)}%)`);
                return { action: 'bet', amount: betAmount };
            }

            const raiseChance5 = 0.3 + randomFactor * 0.2;
            if (actions.includes('raise') && Math.random() < raiseChance5) {
                const minRaise = legalActions.chipRange?.min || 20;
                const maxRaise = legalActions.chipRange?.max || 100;
                const raisePercentage = Math.random() * 0.3 + 0.2 + aggressionBoost * 0.4 + moodMods.betSizeModifier;
                const raiseAmount = calculateBet(minRaise, maxRaise, Math.min(raisePercentage, 0.65));
                logger.log(`BoldLion делает смелый рейз ${raiseAmount} (${Math.round(raisePercentage * 100)}%)`);
                return { action: 'raise', amount: raiseAmount };
            }

            if (actions.includes('call')) return { action: 'call' };
            if (actions.includes('check')) return { action: 'check' };

            const foldChance5 = 0.08 + randomFactor * 0.15 + Math.max(0, moodMods.foldModifier);
            if (Math.random() < foldChance5 && actions.includes('fold')) return { action: 'fold' };
            break;
    }

    // Проверяем возможные ставки/рейзы для любого игрока, если не сработала специфическая логика
    if (actions.includes('bet')) {
        const minBet = legalActions.chipRange?.min || 10;
        const maxBet = legalActions.chipRange?.max || 100;

        // МАЛЫЙ шанс случайной ставки для разнообразия
        const shouldMakeRandomBet = Math.random() < 0.2; // 20% шанс сделать не минимальную ставку (снижено)
        if (shouldMakeRandomBet && maxBet > minBet) {
            const randomPercentage = Math.random() * 0.25 + 0.1; // 10-35% от диапазона (снижено)
            const betAmount = calculateBet(minBet, maxBet, randomPercentage);
            logger.log(`Используем МАЛУЮ случайную ставку: ${betAmount} (${Math.round(randomPercentage * 100)}% от диапазона)`);
            return { action: 'bet', amount: betAmount };
        }

        logger.log(`Используем дефолтную минимальную ставку: ${minBet}`);
        return { action: 'bet', amount: minBet };
    }

    if (actions.includes('raise')) {
        const minRaise = legalActions.chipRange?.min || 20;
        const maxRaise = legalActions.chipRange?.max || 100;

        // МАЛЫЙ шанс случайного рейза
        const shouldMakeRandomRaise = Math.random() < 0.15; // 15% шанс сделать не минимальный рейз (снижено)
        if (shouldMakeRandomRaise && maxRaise > minRaise) {
            const randomPercentage = Math.random() * 0.2 + 0.1; // 10-30% от диапазона (снижено)
            const raiseAmount = calculateBet(minRaise, maxRaise, randomPercentage);
            logger.log(`Используем МАЛЫЙ случайный рейз: ${raiseAmount} (${Math.round(randomPercentage * 100)}% от диапазона)`);
            return { action: 'raise', amount: raiseAmount };
        }

        logger.log(`Используем дефолтный минимальный рейз: ${minRaise}`);
        return { action: 'raise', amount: minRaise };
    }

    // Дефолтное действие с увеличенным рандомом в порядке приоритетов
    const actionPriority = Math.random();

    if (actionPriority < 0.15 && actions.includes('fold')) {
        logger.log('СЛУЧАЙНЫЙ фолд в качестве дефолтного действия');
        return { action: 'fold' };
    }

    // Иногда меняем приоритет между check и call
    if (actionPriority < 0.5) {
        if (actions.includes('check')) return { action: 'check' };
        if (actions.includes('call')) return { action: 'call' };
    } else {
        if (actions.includes('call')) return { action: 'call' };
        if (actions.includes('check')) return { action: 'check' };
    }
    if (actions.includes('fold')) return { action: 'fold' };

    return null;
}

// Глобальная функция для обработки tableState (теперь в основном для логирования)
let isProcessingTableState = false; // Флаг для предотвращения дублирования
function handleTableState(tableState) {
    logger.log('handleTableState вызвана');

    // Предотвращаем множественные одновременные вызовы
    if (isProcessingTableState) {
        logger.log('handleTableState уже обрабатывается, пропускаем дублирующий вызов');
        return;
    }

    isProcessingTableState = true;

    try {
        // Проверяем, есть ли handComplete с winners для задержки следующих действий
        if (tableState.handComplete && tableState.winners && tableState.winners.length > 0) {
            logger.log(`[handleTableState] Обнаружено завершение раздачи с победителями`);

            // Сохраняем время завершения раздачи для задержки следующих действий
            state.lastHandCompleteTime = Date.now();

            // Логируем информацию о победителях
            tableState.winners.forEach((winner, index) => {
                try {
                    // Более безопасное извлечение данных победителя
                    let seatIndex, cards, handData;

                    if (Array.isArray(winner) && winner.length >= 2) {
                        // Структура: [seatIndex, [cards, handData]]
                        seatIndex = winner[0];
                        if (Array.isArray(winner[1]) && winner[1].length >= 2) {
                            cards = winner[1][0];
                            handData = winner[1][1];
                        }
                    } else if (typeof winner === 'object' && winner !== null) {
                        // Структура объекта
                        seatIndex = winner.seatIndex || winner.seat || 'Unknown';
                        cards = winner.cards || winner.hand;
                        handData = winner.handData || winner.handInfo;
                    }

                    logger.log(`[handleTableState] Победитель ${index + 1}: Seat ${seatIndex}, Комбинация: ${JSON.stringify(cards)}, Сила: ${handData ? handData.strength : 'Unknown'}`);
                } catch (error) {
                    logger.log(`[handleTableState] Ошибка при обработке победителя ${index + 1}: ${error.message}. Данные: ${JSON.stringify(winner)}`);
                }
            });

            logger.log(`[handleTableState] Следующие действия будут задержаны на 20 секунд для просмотра результатов раздачи`);
        }

        logger.log(`Состояние игры: isHandInProgress=${tableState.isHandInProgress}, isBettingRoundInProgress=${tableState.isBettingRoundInProgress}`);
        logger.log(`playerToAct: ${tableState.playerToAct}, общие legalActions: ${JSON.stringify(tableState.legalActions)}`);

        if (!tableState.isHandInProgress || !tableState.isBettingRoundInProgress) {
            logger.log('Раунд ставок не активен');
            return;
        }

        // Логируем информацию, но не обрабатываем ходы здесь
        // Ходы обрабатываются в handlePlayerAction при получении privateState
        if (tableState.playerToAct !== null && tableState.playerToAct !== undefined) {
            logger.log(`Ожидается ход игрока с seatIndex: ${tableState.playerToAct}`);
        }

    } finally {
        // Сбрасываем флаг в любом случае через небольшую задержку  
        setTimeout(() => {
            isProcessingTableState = false;
        }, 500);
    }
}

// Сохраняем ссылку на функцию в state
state.handleTableState = handleTableState;

// Функция для имитации игрового процесса
function startGamePlay() {
    logger.log('Начинаем имитацию игрового процесса...');

    // Проверяем, что у нас есть хотя бы два игрока
    if (state.players.length < 2) {
        logger.error('Недостаточно игроков для начала игры', new Error('Not enough players'));
        return;
    }

    logger.log('Функция handleTableState уже установлена глобально');
}
// Основная функция запуска тестирования
async function runTest() {
    try {
        let sessionExists = false;
        // Если есть существующий roomId, попробуем к нему подключиться напрямую
        if (state.roomId) {
            logger.log(`Присоединяемся к существующей сессии с ID: ${state.roomId}`);
            try {
                // Пытаемся подключиться и подключить первого игрока сразу
                const socket1 = await connectSocket();
                logger.log(`Проверка сессии ${state.roomId} через прямое подключение игрока...`);
                try {
                    // Подготовка данных для запроса
                    const joinData = {
                        roomId: state.roomId,
                        name: config.players[0].name,
                        socketId: socket1.id || '',
                        buyIn: config.gameConfig.buyIn
                    };
                    logger.log(`Отправка запроса на join с данными: ${JSON.stringify(joinData)}`);
                    logger.log(`URL запроса: ${config.apiBaseUrl}/join`);
                    // Подключаем первого игрока для проверки существования сессии
                    const response = await axios_1.default.post(`${config.apiBaseUrl}/join`, joinData);
                    logger.log(`Получен ответ от сервера: ${JSON.stringify(response.data)}`);
                    // Если мы здесь, значит сессия существует
                    logger.log(`Сессия ${state.roomId} существует, первый игрок успешно подключен.`);
                    sessionExists = true;
                    // Сохраняем roomId в файл для удобства
                    saveRoomIdToFile(state.roomId);
                    // Продолжаем с первым игроком, формально оформляя его в нашу структуру
                    const playerData = {
                        name: config.players[0].name,
                        socketId: socket1.id || '',
                        playerId: response.data.playerId || "",
                        seatIndex: response.data.seatIndex || 0,
                        socket: socket1
                    };
                    state.players.push(playerData);
                    setupPlayerListeners(playerData);
                    // Подключаем остальных игроков по обычной процедуре
                    for (let i = 1; i < config.players.length; i++) {
                        const socket = await connectSocket();
                        await joinPlayer(config.players[i].name, socket);
                    }
                }
                catch (joinError) {
                    // Ошибка при присоединении - сессия не существует или другая проблема
                    if (axios_1.default.isAxiosError(joinError)) {
                        if (joinError.response) {
                            logger.error(`Ошибка при присоединении к сессии ${state.roomId}. Статус: ${joinError.response.status}`, joinError);
                            logger.log(`Ответ сервера: ${JSON.stringify(joinError.response.data)}`);
                        }
                        else if (joinError.request) {
                            logger.error(`Ошибка при присоединении к сессии ${state.roomId}. Нет ответа от сервера.`, joinError);
                        }
                        else {
                            logger.error(`Ошибка при присоединении к сессии ${state.roomId}. ${joinError.message}`, joinError);
                        }
                    }
                    else {
                        logger.error(`Ошибка при присоединении к сессии ${state.roomId}`, joinError);
                    }
                    logger.log(`Создаем новую сессию...`);
                    // Удаляем первое соединение, так как оно не удалось
                    socket1.disconnect();
                    // Создаем новую сессию
                    await createSession();
                    sessionExists = false;
                }
            }
            catch (error) {
                logger.error(`Ошибка при попытке подключения к существующей сессии`, error);
                await createSession();
                sessionExists = false;
            }
        }
        else {
            // Создаем новую сессию, если roomId не задан
            await createSession();
            sessionExists = false;
        }
        // Даем время пользователю скопировать roomId
        logger.log('Ожидаем 5 секунд перед продолжением...');
        await new Promise(resolve => setTimeout(resolve, 5000));
        // Повторно выводим roomId для удобства
        logger.log('\n\n');
        logger.log('*******************************************************');
        logger.log(`***             ROOM ID: ${state.roomId}                ***`);
        logger.log('*******************************************************');
        logger.log('\n\n');
        // Если мы создали новую сессию, нужно подключить всех игроков
        if (!sessionExists) {
            // Подключаем всех игроков
            for (let i = 0; i < config.players.length; i++) {
                const socket = await connectSocket();
                await joinPlayer(config.players[i].name, socket);
            }
        }
        // Подключаем спектатора
        const spectatorSocket = await connectSocket();
        await joinSpectator(spectatorSocket);
        logger.log('Тестовая сессия успешно настроена. Ожидаем начала игры...');
        // Еще раз выводим roomId для удобства
        logger.log('\n');
        logger.log('*******************************************************');
        logger.log(`***             ROOM ID: ${state.roomId}                ***`);
        logger.log('*******************************************************');
        logger.log('\n');
        // Принудительно запускаем игровой процесс через 20 секунд,
        // если он не запустился автоматически через слушатели событий
        setTimeout(() => {
            if (!state.gameStarted) {
                logger.log('Принудительный запуск игрового процесса...');
                state.gameStarted = true;
                startGamePlay();
            }
        }, 20000);
    }
    catch (error) {
        logger.error('Ошибка при запуске теста', error);
    }
}
// Выводим справку о режиме запуска
if (existingRoomId) {
    logger.log(`Запуск в режиме подключения к существующей сессии с ID: ${existingRoomId}`);
}
else {
    logger.log('Запуск в режиме создания новой сессии');
    logger.log('Чтобы подключиться к существующей сессии, запустите скрипт с указанием roomId:');
    logger.log('npx ts-node test-poker-session.ts ROOM_ID');
}
// Добавим вывод roomId каждые 30 секунд для удобства
setInterval(() => {
    if (state.roomId) {
        logger.log('\n');
        logger.log('*******************************************************');
        logger.log(`***        АКТИВНАЯ КОМНАТА: ${state.roomId}         ***`);
        logger.log('*******************************************************');
        logger.log('\n');
    }
}, 30000);
// Запускаем тест
runTest();
// Функция для обработки хода конкретного игрока
function handlePlayerAction(playerData, availableActions) {
    const { name, seatIndex } = playerData;

    logger.log(`[${name}] Обрабатываем ход игрока с seat ${seatIndex}`);

    // Проверяем, что есть доступные действия
    if (!availableActions || !availableActions.actions || availableActions.actions.length === 0) {
        logger.log(`[${name}] Нет доступных действий для обработки`);
        return;
    }

    // Определяем действие на основе доступных действий игрока
    const actionDecision = getActionForPlayer(seatIndex, availableActions, 'preflop'); // Используем 'preflop' как default

    if (!actionDecision) {
        logger.error(`[${name}] Не удалось определить действие`, new Error('No action determined'));
        return;
    }

    logger.log(`[${name}] Принято решение: ${JSON.stringify(actionDecision)}`);

    // Рассчитываем задержку перед выполнением действия
    let actionDelay = 3000; // Базовая задержка 3 секунды

    // Если недавно завершилась раздача с winners, добавляем дополнительную задержку
    const timeSinceHandComplete = Date.now() - state.lastHandCompleteTime;
    if (state.lastHandCompleteTime > 0 && timeSinceHandComplete < 20000) {
        const additionalDelay = 20000 - timeSinceHandComplete;
        actionDelay = Math.max(actionDelay, additionalDelay);
        logger.log(`[${name}] Добавляем задержку ${Math.round(additionalDelay / 1000)} секунд после завершения раздачи`);
    }

    // Выполняем действие с рассчитанной задержкой
    setTimeout(() => {
        logger.log(`[${name}] Выполняем действие ${actionDecision.action}`);
        if (actionDecision.amount) {
            performPlayerAction(playerData, actionDecision.action, actionDecision.amount);
        } else {
            performPlayerAction(playerData, actionDecision.action);
        }
    }, actionDelay);
}
