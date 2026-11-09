# FastType

Тренажёр скорости печати. GitHub сам собирает из него APK для Android.

## Как получить APK

1. Загрузи все файлы проекта в репозиторий (включая папку `.github`)
2. Открой вкладку Actions, дождись зелёной галочки у запуска Build APK (5–10 минут)
3. Открой запуск и в разделе Artifacts скачай FastType-apk
4. Распакуй архив, перенеси app-debug.apk на телефон и установи (разреши установку из неизвестных источников)

Запустить сборку вручную: Actions, Build APK, Run workflow.

## Структура

- `www/` — само приложение (HTML, CSS, JS)
- `.github/workflows/build-apk.yml` — инструкция для GitHub, как собрать APK
- `package.json`, `capacitor.config.json` — настройки обёртки Capacitor
