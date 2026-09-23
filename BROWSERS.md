# 🌍 NMO Helper: выбор браузера

📖 **[Подробная инструкция по установке](https://github.com/Samyray24/nmo-helper/blob/main/INSTALL.md)** · 📦 **[Скачать готовую версию](https://github.com/Samyray24/nmo-helper/releases/latest)**

Готовые пакеты устанавливаются без Node.js и npm. Windows и Linux используют одинаковые браузерные сборки. Вместо `<версия>` в имени архива указан номер выпуска.

| Браузер | Готовый файл / папка в общем комплекте | Что учитывать |
|---|---|---|
| 🟡 Яндекс Браузер | `nmo-helper-yandex-windows-linux-<версия>.crx` или папка `chromium` | CRX устанавливается через `browser://tune`; ZIP — через режим разработчика |
| 🌐 Chrome, Chromium, Edge, Brave, Opera, Vivaldi | `nmo-helper-chromium-<версия>.zip` / `chromium` | Manifest V3; загрузка распакованной папки |
| 🦊 Firefox 140+ | `firefox` | Manifest V3; пока временная установка |
| 🦊 Firefox 102–139, включая ESR на Astra Linux | `firefox-esr` | Manifest V2; пока временная установка |
| 🍎 Safari | `safari-source` | Только исходники для конвертации в Xcode, готового установщика нет |

Общий архив называется `nmo-helper-all-browsers-<версия>.zip`. Linux-комплект — `nmo-helper-linux-<версия>.tar.gz`.

## ✅ Что проверено

Для выпуска 5.5.1 выполнены автоматические проверки и браузерные проверки в Chrome / Chromium на Windows. Это не заменяет проверку реального теста НМО. Отдельные проверки в Яндексе, Firefox и Astra Linux пока не выполнены.

Firefox ниже 102, Internet Explorer и мобильные браузеры не поддерживаются этим комплектом. Минимальная версия в манифесте не гарантирует работу во всех промежуточных версиях браузера.

## 🦊 Почему Firefox устанавливается временно

Пакеты этой версии пока не подписаны Mozilla. Файлы `*-unsigned.xpi` и `mozilla-*-UNSIGNED.zip` не являются готовыми подписанными дополнениями из магазина.

Для проверки распакуйте общий архив, откройте `about:debugging#/runtime/this-firefox`, нажмите «Загрузить временное дополнение» и выберите `manifest.json` из подходящей папки. После перезапуска Firefox дополнение удаляется. Перед перезапуском экспортируйте важные данные.

[Подробные шаги для Firefox](https://github.com/Samyray24/nmo-helper/blob/main/INSTALL.md#firefox) · [Подготовка подписи Mozilla](https://github.com/Samyray24/nmo-helper/blob/main/docs/MOZILLA_SIGNING.md)

## 🛠️ Для разработчиков

Сборка всех вариантов из исходников: `npm ci`, затем `npm run package:all`. Для Linux-комплекта — `npm run package:linux`; для Яндекса — `npm run package:yandex`.

Если вы просто устанавливаете расширение, используйте готовые файлы из Releases и пошаговую инструкцию по ссылке выше.
