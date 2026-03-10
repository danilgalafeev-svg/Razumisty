# Messenger (Supabase + Realtime)

Простой веб‑мессенджер (SPA) по ТЗ из `tz.txt`: регистрация/вход по никнейму и паролю, emoji‑аватар, общий чат, ответы (reply), realtime‑обновления через Supabase.

## Инструкция “без программирования” (всё через браузер + копипаст)

Ниже — максимально простой путь: вы создаёте проект в Supabase, один раз вставляете SQL, затем выкладываете этот репозиторий на GitHub — сайт сам соберётся и опубликуется на GitHub Pages.

### Шаг A — создать проект в Supabase

1. Зарегистрируйтесь/войдите на Supabase и создайте **New project**.
2. Откройте в проекте: **Settings → API**.
3. Скопируйте и сохраните в заметки:
   - **Project URL**
   - **anon public key** (это публичный ключ — его можно использовать на сайте)
   - **service_role key** (это секретный ключ — его нельзя публиковать)

### Шаг B — создать таблицы (SQL)

1. Откройте: **SQL Editor**.
2. Создайте новый запрос (**New query**).
3. Откройте файл `supabase/migrations/0001_init.sql`, скопируйте весь текст в редактор Supabase.
4. Нажмите **Run**.

### Шаг C — включить Realtime для сообщений

Обычно скрипт уже добавляет таблицу в realtime‑публикацию, но на всякий случай проверьте:

1. Откройте: **Database → Replication** (или раздел Realtime/Replication).
2. Убедитесь, что таблица `messages` включена для Realtime.

### Шаг D — задеплоить Edge Functions (важно)

Этот проект использует 5 Edge Functions, потому что по ТЗ авторизация “своя”, через БД:

- `register`, `login`, `logout`, `update_avatar`, `send_message`

В каждой функции нужно **отключить Verify JWT** (иначе сайт не сможет вызывать функции).

Самый простой способ — через Supabase CLI (это просто команды “копировать‑вставить”):

1. Установите Supabase CLI по официальной инструкции:
   - `https://supabase.com/docs/guides/cli`
2. В этой папке проекта откройте терминал и выполните:

```bash
supabase login
supabase link --project-ref <PROJECT_REF>

supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<ВАШ_SERVICE_ROLE_KEY>

supabase functions deploy register --no-verify-jwt
supabase functions deploy login --no-verify-jwt
supabase functions deploy logout --no-verify-jwt
supabase functions deploy update_avatar --no-verify-jwt
supabase functions deploy send_message --no-verify-jwt
```

Где взять `<PROJECT_REF>`: Supabase Dashboard → **Settings → General** (Project Ref / Reference ID).

Если вы совсем не хотите ставить CLI: попросите знакомого один раз сделать шаг D — без него регистрация/вход/отправка сообщений работать не будут.

### Шаг E — выложить сайт на GitHub Pages

1. Создайте новый репозиторий на GitHub (лучше **Public**) и назовите как угодно.
2. Загрузите в него все файлы из этой папки (можно через кнопку **Add file → Upload files** в браузере).
3. В репозитории откройте: **Settings → Secrets and variables → Actions → New repository secret**.
4. Создайте 2 секрета (значения возьмите из Supabase **Settings → API**):
   - `VITE_SUPABASE_URL` = Project URL
   - `VITE_SUPABASE_ANON_KEY` = anon public key
5. Откройте: **Settings → Pages** и в “Build and deployment” выберите **Source: GitHub Actions**.
6. Перейдите во вкладку **Actions** и дождитесь, пока workflow “Deploy to GitHub Pages” закончится успешно.

После этого сайт будет доступен по адресу GitHub Pages (GitHub покажет ссылку в **Settings → Pages**).

### Проверка

Откройте сайт → зарегистрируйтесь → выберите emoji → отправьте сообщение → попробуйте “Ответить” на сообщение.

### Если что-то не работает (самое частое)

- Видите ошибку про `Missing env` — не добавили secrets `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` в GitHub.
- Не получается зарегистрироваться/отправить сообщение — проверьте, что edge functions задеплоены с `--no-verify-jwt` и задан secret `SUPABASE_SERVICE_ROLE_KEY` в Supabase.

## Локальный запуск (не обязательно)

Нужен только если вы хотите запускать сайт у себя на компьютере.

1. Установите Node.js 18+.
2. Создайте `.env` по примеру `.env.example`.
3. В этой папке выполните:

```bash
npm install
npm run dev
```


