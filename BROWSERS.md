# NMO Helper: браузеры Windows, Linux и исходники Safari

Во всех вариантах включены наши исправления и автоматический поиск в новых базах.
Для установки готового расширения Node.js и npm не нужны.

| Браузер | Пакет / папка | Состояние |
|---|---|---|
| Яндекс Браузер, Windows и Linux | `.crx` либо `chromium` | CRX3 упакован и проверен; установка в Яндексе ещё не проверена |
| Chrome, Chromium, Edge, Brave, Opera, Vivaldi | `chromium` | Общая сборка Manifest V3; нужна проверка запуска в каждом браузере |
| Firefox 140+ | `firefox` / `nmo-helper-firefox-5.4.0-unsigned.xpi` | Неподписанный пакет для проверки |
| Firefox 102+, включая ESR 102/115/128 | `firefox-esr` / `nmo-helper-firefox-esr-5.4.0-unsigned.xpi` | Сборка Manifest V2 с целевой версией JS Firefox 102; запуск на Астре ещё не проверен |
| Safari на macOS | `safari-source` | Только исходники расширения для конвертации в Xcode; готового установщика нет |

Firefox ниже 102, Internet Explorer и мобильные браузеры этим комплектом не охвачены.
Сборка не означает проверенную совместимость со всеми версиями браузера.

## Яндекс Браузер

Откройте `browser://tune`, перетащите файл `.crx` из комплекта в окно браузера
и подтвердите установку. Затем обновите страницу теста НМО.

[Инструкция Яндекса](https://browser.yandex.ru/help/ru/personalization/extension).

## Chromium-браузеры: Windows и Linux

1. Распакуйте общий ZIP в постоянную папку.
2. Откройте страницу расширений:

| Браузер | Адрес |
|---|---|
| Яндекс | `browser://extensions` |
| Chrome / Chromium | `chrome://extensions` |
| Edge | `edge://extensions` |
| Brave | `brave://extensions` |
| Opera | `opera://extensions` |
| Vivaldi | `vivaldi://extensions` |

3. Включите «Режим разработчика».
4. Нажмите «Загрузить распакованное расширение» и выберите папку `chromium`, где находится `manifest.json`.
5. Откройте или обновите https://a.edu.rosminzdrav.ru.

Можно вместо общего комплекта распаковать `nmo-helper-chromium-5.4.0.zip` и выбрать
папку его содержимого. Сохраняйте установленную папку; после её обновления нажмите
перезагрузку расширения. Если другая копия NMO Helper уже установлена, отключите её.

[Пример установки в Chrome](https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world#load-unpacked).

## Firefox и Астра Linux

Для Firefox ниже 140 выбирайте папку `firefox-esr`.

**Проверка неподписанной сборки:**

1. Откройте `about:debugging#/runtime/this-firefox`.
2. Нажмите «Загрузить временное дополнение».
3. Выберите `manifest.json` в папке `firefox-esr` (или `firefox` для версии 140+).
4. Обновите страницу НМО.

Временное дополнение работает до перезапуска Firefox. XPI в комплекте явно помечены
`unsigned`: переименование ZIP в XPI не даёт подпись Mozilla. Старый подписанный
Старый подписанный XPI версии 5.0.0 удалён: он не содержал текущих изменений.

**Постоянная обычная установка:** после получения подписи Mozilla откройте
`about:addons` → шестерёнка → «Установить дополнение из файла» и выберите подписанный XPI.
Подписанных пакетов нашей версии пока нет: нужен доступ к учётной записи Mozilla
и проверка требований сервиса к выбранной версии Firefox. Для новой регистрации
старого пакета также нужно согласовать с Mozilla действующие требования к декларации данных;
старый манифест нельзя считать автоматически готовым к подписанию.

В ESR Mozilla также допускает установку неподписанных дополнений после изменения
`xpinstall.signatures.required` в `about:config`, но это меняет проверку подписей
для всего профиля. В комплекте эта настройка не изменяется. На управляемой Астре
установка может определяться политиками администратора.

У старых Firefox есть дополнительное ограничение: из-за истечения корневого
сертификата подписанные дополнения требуют актуализированного Firefox 115 ESR
или Firefox 128 и новее. Одного снижения `strict_min_version` недостаточно.

Источники: [временная установка](https://extensionworkshop.com/documentation/develop/temporary-installation-in-firefox/),
[подпись Mozilla и ESR](https://extensionworkshop.com/documentation/publish/signing-and-distribution-overview/),
[версии Firefox и подписи](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/browser_specific_settings).

## Safari

`safari-source` содержит ресурсы WebExtension, а не приложение для установки.
Для получения установочного приложения нужны macOS, Xcode, конвертация проекта,
проверка API и подпись Apple. Это не выполнено на текущем компьютере с Windows.

[Официальная документация Apple](https://developer.apple.com/safari/extensions/).

## Пересборка комплекта

В локальной копии проекта с нашими изменениями:

```bash
npm ci
npm run package:all
```

Результат появится в `releases/`. ZIP и неподписанные XPI собираются одинаково
в Windows и Linux. CRX3 добавляется, если найден установленный Chrome/Chromium;
путь к нему можно указать в `CHROME_BIN`. Закрытые ключи в комплект не входят.
