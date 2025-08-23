# API и Socket.IO События Покерного Бэкенда

Данный документ описывает HTTP API и Socket.IO события, доступные в покерном бэкенде. Он предназначен для синхронизации интерфейсов фронтенда и бэкенда.

## Оглавление

1. [HTTP API Endpoints](#http-api-endpoints)
   - [Создание сессии](#создание-сессии)
   - [Присоединение игрока](#присоединение-игрока)
   - [Режим наблюдателя](#режим-наблюдателя)
   - [Отключение наблюдателя](#отключение-наблюдателя)
   - [Переподключение игрока](#переподключение-игрока)
   - [Выход игрока](#выход-игрока)
2. [Socket.IO События](#socketio-события)
   - [События от сервера к клиенту](#события-от-сервера-к-клиенту)
   - [События от клиента к серверу](#события-от-клиента-к-серверу)
3. [Структуры данных](#структуры-данных)
   - [TableState](#tablestate)
   - [PrivateState](#privatestate)
   - [Winners](#winners)

## HTTP API Endpoints

Все эндпоинты относятся к базовому URL: `http://localhost:3001/api/sessions/`

### Создание сессии

**Endpoint**: `POST /create`

**Параметры запроса**:
```json
{
  "ante": 10,
  "bigBlind": 50,
  "smallBlind": 25,
  "numSeats": 6,
  "buyIn": 1000
}
```

**Ответ**:
```json
{
  "roomId": "123456",
  "message": "Table created successfully"
}
```

### Присоединение игрока

**Endpoint**: `POST /join`

**Параметры запроса**:
```json
{
  "roomId": "123456",
  "name": "Player1",
  "socketId": "socket_id_from_client"
}
```

**Ответ**:
```json
{
  "message": "Player Player1 joined successfully",
  "playerId": "player_unique_id",
  "seatIndex": 0,
  "stack": 1000
}
```

**Действия сервера**:
1. Добавляет игрока в сессию
2. Присоединяет сокет к комнате
3. Транслирует текущее состояние стола всем игрокам и наблюдателям
4. Отправляет приватное состояние только что присоединившемуся игроку (если игра идет)
5. Уведомляет всех игроков о новом участнике через событие `playerJoined`

### Режим наблюдателя

**Endpoint**: `POST /spectate`

**Параметры запроса**:
```json
{
  "roomId": "123456",
  "socketId": "socket_id_from_client"
}
```

**Ответ**:
```json
{
  "message": "Spectator joined successfully",
  "spectatorCount": 1,
  "tableState": {
    // Полное состояние стола, см. структуру TableState
  }
}
```

**Действия сервера**:
1. Добавляет наблюдателя в сессию
2. Присоединяет сокет к комнате
3. Отправляет текущее состояние стола наблюдателю
4. Уведомляет остальных о подключении наблюдателя через событие `spectatorJoined`

### Отключение наблюдателя

**Endpoint**: `POST /leave-spectate`

**Параметры запроса**:
```json
{
  "roomId": "123456",
  "socketId": "socket_id_from_client"
}
```

**Ответ**:
```json
{
  "message": "Spectator left successfully",
  "spectatorCount": 0
}
```

### Переподключение игрока

**Endpoint**: `POST /reconnect`

**Параметры запроса**:
```json
{
  "roomId": "123456",
  "playerId": "player_unique_id",
  "socketId": "new_socket_id_from_client"
}
```

**Ответ**:
```json
{
  "message": "Player reconnected successfully",
  "playerId": "player_unique_id",
  "seatIndex": 0,
  "stack": 950
}
```

### Выход игрока

**Endpoint**: `POST /leave`

**Параметры запроса**:
```json
{
  "roomId": "123456",
  "seatIndex": 0,
  "socketId": "socket_id_from_client"
}
```

**Ответ**:
```json
{
  "message": "Player left the session successfully",
  "isTableEmpty": false
}
```

## Socket.IO События

### События от сервера к клиенту

| Название события | Описание | Формат данных |
|------------------|----------|--------------|
| `connected` | Подтверждение соединения | `{ socketId: string }` |
| `socket_id` | Отправка ID сокета клиенту | `{ socketId: string }` |
| `tableState` | Обновление состояния стола | [См. структуру TableState](#tablestate) |
| `privateState` | Приватная информация игрока | [См. структуру PrivateState](#privatestate) |
| `error` | Ошибка | `{ message: string }` |
| `message` | Информационное сообщение | `{ type: string, data: any }` |
| `actionSuccess` | Подтверждение успешной обработки действия | `{ message: string }` |
| `actionPerformed` | Уведомление о действии игрока | `{ playerId: string, action: string, amount: number, timestamp: number }` |
| `showdownResults` | Результаты вскрытия карт | `{ winners: [См. структуру Winners](#winners) }` |
| `playerJoined` | Новый игрок присоединился | `{ roomId: string, message: string, playerName: string }` |
| `spectatorJoined` | Новый наблюдатель присоединился | `{ message: string, spectatorCount: number }` |

### События от клиента к серверу

| Название события | Описание | Формат данных | Ответное событие |
|------------------|----------|--------------|------------------|
| `pokerAction` | Действие игрока (ставка, фолд и т.д.) | `{ roomId: string, playerId: string, action: string, amount: number }` | `actionSuccess` или `error` |
| `joinRoom` | Подключение к комнате | `{ roomId: string, playerId: string }` | `tableState` |
| `leaveRoom` | Отключение от комнаты | `{ roomId: string, playerId: string }` | - |
| `reconnectPlayer` | Переподключение игрока | `{ roomId: string, playerId: string }` | `tableState` и `privateState` |
| `startGame` | Запрос на начало игры | `{ roomId: string, playerId: string }` | `tableState` |
| `getTableState` | Запрос актуального состояния стола | `{ roomId: string }` | `tableState` |
| `get_socket_id` | Запрос ID сокета | - | `socket_id` |
| `client_ready` | Сигнал готовности клиента | - | `socket_id` |
| `request_socket_id` | Устаревший запрос ID сокета (для обратной совместимости) | - | `socket_id` |

## Структуры данных

### TableState

```typescript
{
  // Информация о местах за столом (массив объектов или null для пустых мест)
  seats: [
    { stack: number, betSize: number, totalChips: number },
    null,
    { stack: number, betSize: number, totalChips: number },
    // ...
  ],
  
  // Массив индексов активных игроков в текущей раздаче
  handPlayers: number[],
  
  // Общие карты на столе
  communityCards: [
    { rank: string, suit: string }, // Например: { rank: "A", suit: "h" }
    // ...
  ],
  
  // Текущий раунд торговли
  roundOfBetting: "preflop" | "flop" | "turn" | "river" | null,
  
  // Банки (основной и побочные)
  pots: [
    { size: number, eligiblePlayers: number[] },
    // ...
  ],
  
  // Индекс игрока, чья очередь делать ход
  playerToAct: number | null,
  
  // Доступные действия для текущего игрока
  legalActions: {
    actions: string[], // Например: ["fold", "check", "bet"]
    chipRange: { min: number, max: number } | null
  },
  
  // Флаги состояния игры
  isHandInProgress: boolean,
  isBettingRoundInProgress: boolean,
  areBettingRoundsCompleted: boolean,
  numActivePlayers: number,
  
  // Список игроков за столом с минимальной информацией
  playersState: [
    {
      playerId: string,
      name: string,
      seatIndex: number
    },
    // ...
  ]
}
```

### PrivateState

```typescript
{
  // Все поля игрока
  playerId: string,
  name: string,
  seatIndex: number,
  socketId: string,
  originalData: {
    totalChips: number,
    stack: number,
    betSize: number
  },
  
  // Приватные данные игрока
  privateData: {
    holeCards: [
      { rank: string, suit: string },
      { rank: string, suit: string }
    ] | null
  },
  
  // Доступные действия для игрока
  availableActions: {
    actions: string[], // Например: ["fold", "check", "bet"]
    chipRange: { min: number, max: number } | null
  }
}
```

### Winners

```typescript
[
  // Для каждого банка (основного и побочных)
  [
    // Для каждого победителя этого банка:
    [
      seatIndex, // Индекс места победителя
      { 
        cards: [{ rank: string, suit: string }, ...], // Карты игрока
        ranking: string, // Название комбинации (например, "Flush")
        strength: number // Числовая сила комбинации
      },
      [{ rank: string, suit: string }, ...] // Общие карты на столе
    ],
    // ... другие победители этого банка
  ],
  // ... другие банки
]
```

## Примечания по реализации

### Синхронизация между playersState и seats

- `playersState` содержит список игроков за столом с минимальным набором данных: `playerId`, `name` и `seatIndex`
- `seats` содержит технические данные о стеке, размере ставки и т.д.
- Соответствие между игроком и его данными в `seats` устанавливается по индексу места (`seatIndex`)

### Получение данных о стеке и ставке игрока

```javascript
// Неправильно (устаревший подход):
const playerStack = playersState[i].stack;

// Правильно (текущий подход):
const seatIndex = playersState[i].seatIndex;
const playerStack = tableState.seats[seatIndex].stack;
```

### Обработка действий игрока

1. Клиент отправляет событие `pokerAction` с данными действия
2. Сервер проверяет валидность действия (очередь хода, допустимые действия, размер ставки)
3. Сервер применяет действие к столу через `table.actionTaken(action, amount)`
4. Сервер синхронизирует данные с помощью `composeStateWithActivePlayers` 
5. Сервер отправляет подтверждение клиенту через `actionSuccess`
6. Сервер транслирует новое состояние стола всем через `tableState`
7. Сервер отправляет приватные состояния активным игрокам через `privateState`
8. Сервер транслирует информацию о действии всем через `actionPerformed`

### Запрос актуального состояния стола

Клиент может в любой момент запросить актуальное состояние стола, отправив событие `getTableState`:

```javascript
socket.emit('getTableState', { roomId: 'your_room_id' });

// Получение ответа
socket.on('tableState', (tableStateData) => {
  console.log('Актуальное состояние стола:', tableStateData);
});
```

### Последовательность взаимодействия для наблюдателя (spectator)

1. Клиент подключается через Socket.IO
2. Клиент получает свой socketId через событие `socket_id`
3. Клиент отправляет HTTP запрос `/spectate` с полученным socketId и roomId
4. Сервер добавляет наблюдателя в сессию и отправляет текущее состояние стола
5. Клиент получает обновления через Socket.IO событие `tableState`

### Последовательность взаимодействия для игрока

1. Клиент подключается через Socket.IO
2. Клиент получает свой socketId через событие `socket_id`
3. Клиент отправляет HTTP запрос `/join` с socketId, roomId и именем игрока
4. Сервер добавляет игрока в сессию и отправляет все необходимые состояния
5. Клиент получает обновления через Socket.IO события `tableState` и `privateState`
6. Клиент отправляет действия через событие `pokerAction`

## Что реализовано и что предстоит реализовать

### Реализовано:
- ✅ Полная система управления сессиями
- ✅ Режим наблюдателя (spectator)
- ✅ Оптимизированная структура `playersState` без дублирования данных
- ✅ Синхронизация данных игроков с состоянием мест за столом
- ✅ Система сохранения и восстановления сессий
- ✅ Обработка действий игроков
- ✅ Транслирование состояний стола и приватных данных

### Предстоит реализовать:
- 🚧 Детальная реализация сценариев для игроков
- 🚧 Улучшение интерфейса для режима игрока
- 🚧 Улучшение обработки отключений игроков
- 🚧 Обработка конца игры и распределения выигрышей
