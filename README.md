# NMO Helper v5.3.0

> Умный помощник в прохождении тестов НМО на портале [edu.rosminzdrav.ru](https://a.edu.rosminzdrav.ru) — бесплатное расширение для браузера с открытым исходным кодом.

Авто-поиск по базам ответов, автоответ с настраиваемым интервалом, AI-режим (GPT, Gemini, Claude, DeepSeek), PDF-режим: поиск по клиническим рекомендациям — всё работает из коробки.

[![Firefox Add-ons](https://img.shields.io/amo/v/nmo-helper?style=flat-square&label=Firefox%20Add-ons&color=ff9500&logo=firefox-browser&logoColor=white)](https://addons.mozilla.org/ru/firefox/addon/nmo-helper/)
[![Downloads](https://img.shields.io/github/downloads/Samyray24/nmo-helper/total?style=flat-square&label=скачиваний&color=667eea&cacheSeconds=3600)](https://github.com/Samyray24/nmo-helper/releases)
[![Stars](https://img.shields.io/github/stars/Samyray24/nmo-helper?style=flat-square&color=fbbf24&cacheSeconds=3600)](https://github.com/Samyray24/nmo-helper)
[![License](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](https://github.com/Samyray24/nmo-helper/blob/main/LICENSE)
[![VirusTotal](https://img.shields.io/badge/VirusTotal-Clean-brightgreen?style=flat-square&logo=virustotal)](https://www.virustotal.com/gui/file/dd746259d7a4eefdaadd88e33c2fec39eca2ee848b05cee036a6713b29459c7d?nocache=1)

🌐 **Сайт:** [nmo-helper.ru](https://nmo-helper.ru)<br>
📖 **Инструкция:** [nmo-helper.ru/instruction](https://nmo-helper.ru/instruction)<br>
💬 **Обратная связь:** [nmo-helper.ru/feedback](https://nmo-helper.ru/feedback)<br>
🐞 **Баги и предложения:** [GitHub Issues](https://github.com/Samyray24/nmo-helper/issues)

---

## Возможности

| Функция | Описание |
|---|---|
| **Авто-поиск** | Автоматически находит тему теста и ищет её в базах ответов |
| **AI-режим** | Решает тесты бесплатными моделями без ключа либо через ProxyAPI / свой endpoint |
| **Общая база NMO Helper** | Ищет ответы в собственной базе; завершённым тестом можно поделиться только с согласия пользователя |
| **PDF-режим** | Поиск по клиническим рекомендациям из локального PDF, со score для вариантов |
| **Ручной поиск** | Поиск ответов по названию теста в поддерживаемых базах |
| **Автоподсветка** | Правильные ответы подсвечиваются при переходе между вопросами |
| **Автоответ** | Может автоматически отмечать найденные ответы и переходить дальше с заданным интервалом |
| **Кеширование** | Ответы кешируются — при навигации назад/вперёд повторных запросов нет |
| **Локальная база** | Импорт JSON, CSV или ZIP для быстрого поиска без сети |
| **Умный резерв** | При отсутствии ответа автоматически подключает дополнительные базы и выбранный AI |
| **Восстановление** | Продолжает тест после обновления страницы без повторного клика |
| **Диагностика** | Проверяет DOM НМО, браузер, хранилище и сетевые источники без раскрытия токенов |
| **Умное сопоставление** | Нормализация тире, смешанных кириллица/латиница, нечёткий поиск |
| **Плавающая панель** | Перетаскивание, сворачивание, сохранение позиции между сессиями |
| **Обход CORS** | Работает без дополнительных плагинов |

## Требования

- **Google Chrome** / Яндекс Браузер / Edge / Brave / Opera (любой Chromium-браузер)
- **Mozilla Firefox 140+** или отдельная сборка **Firefox ESR 102+** для Astra Linux

---

## Установка

### Комплект браузеров: Windows и Linux

`npm run package:all` создаёт общий ZIP: Chromium-браузеры, Firefox 140+ и отдельный
Firefox 102+ на Manifest V2. XPI пока не подписаны Mozilla. Исходники для конвертации
Safari также включены; готового приложения Safari нет. Подробности: [BROWSERS.md](BROWSERS.md).

### Windows и Linux — единый пакет для Яндекс Браузера

`npm run package:yandex` создаёт CRX3 для прямой установки в Яндекс Браузер и ZIP
для установки из папки. Оба содержат текущие изменения. Инструкция: [INSTALL.md](INSTALL.md).

### Linux — текущая изменённая сборка

Инструкция для Chrome/Chromium и Firefox: [LINUX.md](LINUX.md).
Команда `npm run package:linux` собирает архив `releases/nmo-helper-linux-5.3.0.tar.gz`
с исправлениями и дополнительными базами. Для установки готового архива Node.js не нужен.

### Chrome / Yandex / Edge / Brave / Opera

1. Скачайте [`nmo-helper-chromium-5.3.0.zip`](https://github.com/Samyray24/nmo-helper/releases/download/v5.3.0/nmo-helper-chromium-5.3.0.zip)
2. Разархивируйте в удобную папку
3. Откройте `chrome://extensions/` в адресной строке
4. Включите **«Режим разработчика»** (правый верхний угол)
5. Нажмите **«Загрузить распакованное расширение»**
6. Выберите папку `nmo-helper-chrome-5.3.0`

<details>
<summary>📹 Показать GIF-инструкцию</summary>

![Установка Chrome](demo/setup_1.gif)
</details>

### Mozilla Firefox

**Способ 1 (рекомендуется) — из Firefox Add-ons:**

Откройте страницу расширения в [Firefox Add-ons](https://addons.mozilla.org/ru/firefox/addon/nmo-helper/) и нажмите **«Добавить в Firefox»**. Расширение проверено и подписано Mozilla, обновляется автоматически.

**Способ 2 — прямая установка `.xpi`:**

1. Скачайте [`nmo-helper-firefox-5.3.0-unsigned.xpi`](https://github.com/Samyray24/nmo-helper/releases/download/v5.3.0/nmo-helper-firefox-5.3.0-unsigned.xpi)
2. Перетащите `.xpi` в окно Firefox, или откройте `about:addons` → ⚙ → **«Установить дополнение из файла»**
3. Подтвердите установку

<details>
<summary>📹 Показать GIF-инструкцию</summary>

![Установка Firefox](demo/setup_2.gif)
</details>

> **Почему в Chrome нет магазинной версии?** Расширение использует парсинг сайтов с готовыми ответами — политика Chrome Web Store это запрещает, и расширение быстро удалят. Ручная установка через `chrome://extensions` занимает пару минут и работает надёжно.

---

## Использование

После установки откройте страницу тестирования НМО — в правом верхнем углу появится панель **NMO Helper**.

![Установка Firefox](demo/setup_3.png)

### Режимы работы

Переключение между режимами через таб-бар в панели: **Авто** / **Сайты** / **AI** / **PDF**.

### Авто

Панель сама определяет тему теста, ищет ответы и подсвечивает правильные варианты. Никаких действий не требуется.

- Сначала проверяет NMO Helper, РосМедИнфо, 24forcare и Testotvet
- Если подходящего ответа нет, автоматически ищет в РешТестНМО, ОТВ НМО, test-nmo.ru, pro-nmo.ru и tests-nmo.ru
- В резервных базах ищет по названию теста, затем по тексту текущего вопроса; выбирает лучшее совпадение с вариантами на странице
- Если одна база недоступна — работает с остальными
- Показывает источник, точность, совпавший вопрос и прямую ссылку на страницу с ответом
- При конфликте надёжных баз останавливает автопрохождение и показывает ответы каждой базы
- Слабые совпадения подсвечивает жёлтым и не применяет автоматически
- Автоответ отмечает варианты, переходит к следующему вопросу и завершает тест после последнего вопроса; для новых установок он включён по умолчанию
- Ответы кешируются при навигации

### Сайты

1. Введите название теста в поиск
2. Выберите результат из любой из девяти баз — ответы загрузятся автоматически
3. При необходимости остановите выбранный источник кнопкой **Остановить**

### PDF

Загрузите PDF с клиническими рекомендациями — расширение выполнит поиск по документу и покажет score рядом с вариантами.

- PDF обрабатывается локально в браузере и не загружается на сервер
- Score отображается перед radio/checkbox, не сдвигая текст варианта
- Режим экспериментальный: примерно 56-80% ответов могут быть правильными

### AI

Подключите нейросеть для решения тестов. Доступны три варианта:

**Бесплатно** (по умолчанию) — работает без токена и настроек. Расширение сначала
использует OVH, затем AI Horde как резерв. Скорость зависит от нагрузки бесплатных сервисов.

**ProxyAPI** — российский прокси с оплатой в рублях и без VPN:
1. Зарегистрируйтесь на [proxyapi.ru](https://proxyapi.ru) и пополните баланс
2. Получите API-ключ на [console.proxyapi.ru/keys](https://console.proxyapi.ru/keys)
3. Вставьте ключ и выберите модель
4. Нажмите **Запуск AI**

**Свой endpoint** — переключите свитч «Свой endpoint» и укажите:
- API Endpoint (OpenAI-совместимый, например `https://api.deepseek.com/v1/chat/completions`)
- API Token
- Название модели

### Локальная база

Во вкладке **База** можно загрузить собственный JSON, CSV или ZIP, объединить его
с текущими ответами и экспортировать вопросы, которых нет ни в одном источнике.
Данные остаются в браузере и доступны при нестабильной сети.

### Диагностика

Откройте настройки и нажмите **Проверить расширение**. Отчёт показывает состояние
страницы НМО, браузера, локальной базы и последних сетевых запросов. API-ключи,
cookies и полный текст вопроса в отчёт по умолчанию не попадают.

### Модели (ProxyAPI)

| Уровень | Модели | Описание |
|---------|--------|----------|
| 🟢 low | gpt-5.4-nano, gemini-2.0-flash, claude-haiku-4.5 | Быстрые и дешёвые |
| 🔵 medium | gpt-5.4-mini, gpt-5.6-luna, gemini-2.5-flash | Баланс цена/качество |
| 🟡 high | gpt-5.4, gpt-5.6-terra, claude-sonnet-5 | Высокая точность |
| 🟣 ultra | gpt-5.6-sol, claude-fable-5, gemini-3.1-pro | Максимальная точность |

> **Disclaimer:** AI-модели решают медицинские тесты НМО в среднем на оценку 3 — вопросы основаны на специфических клинических рекомендациях РФ. Рекомендуем использовать AI как вспомогательный инструмент, а основной упор делать на **авто-поиск**.

---

## Структура проекта

```
src/
├── api/               # DOM, сеть, хранилище, обновления и баг-репорты
├── components/        # React-компоненты режимов Авто, Сайты, AI и PDF
├── contexts/          # Общее состояние панели и текущего вопроса
├── icons/             # Иконки расширения
├── libs/              # Локальные вспомогательные библиотеки
├── utils/             # Парсинг, сопоставление и нормализация текста
├── App.tsx            # Корневой React-компонент
├── Panel.tsx          # Панель расширения
├── content.ts         # Точка входа content script
├── background.ts      # Service worker и сетевой proxy
└── manifest.*.json    # Манифесты Chrome, Firefox и AMO

build.js               # Сборка расширения
```

### Сборка

```bash
npm install
npm run build       # Собрать dist/chrome, dist/firefox, dist/firefox-store
npm run dev         # Сборка в watch-режиме
npm test            # Запустить тесты
```

---

## Безопасность

Расширение **не требует пользовательской регистрации**, **не отправляет аналитику** и **не подсовывает реферальные ссылки**. Для собственной базы NMO Helper создаётся анонимный ID установки и локальная пара ключей: закрытый ключ не покидает браузер, сервер получает только открытый ключ и подписанные запросы. Но не верьте на слово — проверьте сами:

- Исходный код открыт на GitHub
- Проверено через [VirusTotal](https://www.virustotal.com/gui/file/dd746259d7a4eefdaadd88e33c2fec39eca2ee848b05cee036a6713b29459c7d?nocache=1)
- Подписано и опубликовано в [Firefox Add-ons](https://addons.mozilla.org/ru/firefox/addon/nmo-helper/)
- PDF-файлы обрабатываются локально в браузере и не отправляются на сервер
- Вопросы и правильные ответы из завершённого теста отправляются в общую базу только после согласия пользователя
- Баг-репорт отправляется только вручную после подтверждения пользователя
- Политика конфиденциальности: [nmo-helper.ru/privacy](https://nmo-helper.ru/privacy)

## Поддержать проект

Проект создан на альтруистических началах — просто чтобы помочь. Если расширение оказалось полезным:

[![Support on Boosty](https://img.shields.io/badge/Boosty-Поддержать-orange?style=for-the-badge)](https://boosty.to/kolabrod/donate)
[![Support on CloudTips](https://img.shields.io/badge/CloudTips-Поддержать-blue?style=for-the-badge)](https://pay.cloudtips.ru/p/181ccc33)

## Предыдущие минорные версии

Ниже только последние релизы минорных веток. Новые сборки доступны в [GitHub Releases](https://github.com/Samyray24/nmo-helper/releases), исторические — в исходном репозитории.

- [v4.3.0](https://github.com/lKolabrodl/nmo-helper/tree/v4.3.0) — обновлённая панель, расширенный поиск по базам и просмотр источника PDF
- [v4.2.0](https://github.com/lKolabrodl/nmo-helper/tree/v4.2.0) — автоответ с настраиваемым интервалом
- [v4.1.1](https://github.com/lKolabrodl/nmo-helper/tree/v4.1.1) — обновление подписанного Firefox-пакета
- [v4.0.0](https://github.com/lKolabrodl/nmo-helper/tree/v4.0.0) — крупное обновление панели и подготовка к релизам 4.x
- [v3.1.5](https://github.com/lKolabrodl/nmo-helper/tree/v3.1.5) — мелкие правки extractor'ов и баг-репорта
- [v3.0.1](https://github.com/lKolabrodl/nmo-helper/tree/v3.0.1) — публикация в Firefox Add-ons
- [v2.3.0](https://github.com/lKolabrodl/nmo-helper/tree/v2.3.0) — новые AI-модели, обновлённый парсинг
- [v2.2.2](https://github.com/lKolabrodl/nmo-helper/tree/v2.2.2) — миграция на TypeScript, тесты, JSDoc
- [v2.1.1](https://github.com/lKolabrodl/nmo-helper/tree/v2.1.1) — реструктуризация, esbuild сборка
- [v2.0.0](https://github.com/lKolabrodl/nmo-helper/tree/v2.0.0) — AI-режим, авто-поиск
- [v1.4.2](https://github.com/lKolabrodl/nmo-helper/tree/v1.4.2) — только поиск по сайтам, без AI

## Лицензия

MIT
