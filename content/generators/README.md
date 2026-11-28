# Генераторы банка задач

Скрипты, из которых собраны черновики `content/drafts/bank/<предмет>/<тема>/` (`templates.json`, `topic.json`).
Один файл — одна тема (`f75.py` — Ф7.5 и т. д.), общие помощники — в `lib.py`.

```bash
cd content/generators && python3 f75.py
```

После правки запустите `pnpm content:check-drafts`. Тексты — черновики `ai_draft`: публикует учитель после проверки в студии.
