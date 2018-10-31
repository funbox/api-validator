# @funbox/api-validator

## Описание

**api-validator** — это средство проверки соответствия ответа от сервера документации apib.

## Извлечение JSON-схем API в проекте

1. Добавить в зависимости проекта `@funbox/api-validator`;
2. Добавить в `package.json` проекта поле `doc` вида:
    ```
    "doc": {
      "repo": "git@github.com:your-username/your-apib-repository.git",
      "branch": "master",
      "file": "doc.apib"
    }
    ```
    где:
    - `repo` - адрес репозитория (обязательное поле);
    - `branch` - название ветки (обязательное поле);
    - `file` - название файла внутри репозитория (необязательное поле, по умолчанию - `doc.apib`).
3. Добавить в `scripts` в `package.json` проекта команду:
    ```
    "update-schemas": "update-schemas"
    ```
4. Запустить обновление схем командой `npm run update-schemas`.
5. Команда сохранит в папке проекта файлы:
- `src/api-schemas/schemas.json` (содержит схемы);
- `src/api-schemas/doc-version.txt` (содержит ID коммита, использованного при создании схем). 
