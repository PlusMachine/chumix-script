# Poker Test Session Script

Скрипт для тестирования покерной сессии с ботами.

## Конфигурация

### Настройка количества игроков

В файле `first-player.config.json` можно настроить количество игроков-ботов:

```json
{
  "gameConfig": {
    "playerCount": 6
  },
  "firstPlayerAction": {
    "mode": "force",
    "scope": "first-action-each-hand",
    "forceAction": "fold",
    "fallbackOnUnavailable": "fold",
    "betSizing": {
      "type": "min",
      "percent": 0.5
    }
  }
}
```

**Параметры:**
- `playerCount` - количество игроков (от 3 до 6)
  - `3` - TightTiger, WildWolf, SlyFox
  - `4` - TightTiger, WildWolf, SlyFox, CoolBear
  - `5` - TightTiger, WildWolf, SlyFox, CoolBear, SharpHawk
  - `6` - TightTiger, WildWolf, SlyFox, CoolBear, SharpHawk, BoldLion

### Настройка действий первого игрока

В секции `firstPlayerAction` можно настроить поведение первого игрока:

- `mode` - режим действия:
  - `"bot"` - стандартное поведение бота
  - `"force"` - принудительное действие
  - `"random"` - случайное действие из доступных

- `scope` - область применения:
  - `"always"` - всегда
  - `"first-action-session"` - только первое действие в сессии
  - `"first-action-each-hand"` - первое действие в каждой раздаче

- `forceAction` - принудительное действие (для режима "force"):
  - `"fold"`, `"check"`, `"call"`, `"bet"`, `"raise"`, `"allin"`

- `fallbackOnUnavailable` - действие при недоступности требуемого:
  - `"call"`, `"check"`, `"fold"`

- `betSizing` - настройки размера ставки:
  - `type` - тип: `"min"`, `"max"`, `"percent"`
  - `percent` - процент от диапазона (для типа "percent")

## Запуск

```bash
# Создание новой сессии
node dist/test-poker-session.js

# Подключение к существующей сессии
node dist/test-poker-session.js ROOM_ID
```

## Игроки

Скрипт поддерживает до 6 различных типов игроков:

1. **TightTiger** - консервативный игрок
2. **WildWolf** - агрессивный игрок
3. **SlyFox** - хитрый средний игрок
4. **CoolBear** - осторожный игрок
5. **SharpHawk** - наблюдательный игрок
6. **BoldLion** - смелый игрок

Каждый игрок имеет уникальные характеристики и стиль игры, которые влияют на их решения в игре. 