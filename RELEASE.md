# Выпуск новой версии

## Проверка

```bash
npm ci
npm test -- --reporter=dot
npx tsc --noEmit
npm run lint
npm run build
npm run test:e2e
```

Браузерный smoke-тест запускает собранный content script в Chrome при
1366x768 и 1024x768, открывает вкладки «База» и «Настройки» и проверяет, что
панель не выходит за границы экрана.

## Номер версии

Версия должна совпадать в `package.json`, `package-lock.json` и четырёх файлах
`src/manifest.*.json`. Для обновления пакета используйте:

```bash
npm version 5.4.0 --no-git-tag-version
```

## Локальные готовые версии

```bash
npm run package:release
npm run validate:release
```

Результат появляется в `releases/` и в папке `ГОТОВЫЕ ВЕРСИИ`. Закрытый ключ
CRX хранится вне репозитория в `~/.codex/nmo-helper-signing/nmo-helper.pem`.

## GitHub Release

После слияния изменений в `main` создайте тег с той же версией:

```bash
git tag v5.4.0
git push origin main
git push origin v5.4.0
```

Workflow `.github/workflows/release.yml` сам запускает тесты, собирает пакеты,
проверяет архивы и публикует Release. Секрет `NMO_CRX_PRIVATE_KEY_BASE64`
должен быть настроен в репозитории.

## Магазины

Публикация в Firefox Add-ons, Chrome Web Store, Edge Add-ons, Opera Add-ons и
Apple App Store требует соответствующих учётных записей разработчика и ручной
проверки. Подробности находятся в [STORE_SUBMISSION.md](STORE_SUBMISSION.md).
