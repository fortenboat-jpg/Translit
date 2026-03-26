# 🚀 BirthCert Translation — Деплой на Vercel

## Структура проекта
```
birthcert-vercel/
├── api/
│   ├── ocr.js          ← Serverless: считывает скан через OpenAI Vision
│   └── translate.js    ← Serverless: генерирует PDF + отправляет email
├── public/
│   └── index.html      ← Фронтенд сайта
├── package.json
├── vercel.json
└── .env.example        ← Шаблон переменных окружения
```

---

## Шаг 1 — Получи новый OpenAI ключ
1. Зайди на https://platform.openai.com/api-keys
2. Нажми **Create new secret key**
3. Скопируй ключ (он показывается только один раз!)

---

## Шаг 2 — Настрой Gmail App Password
1. Зайди https://myaccount.google.com/security
2. Включи **Двухэтапную аутентификацию** (если не включена)
3. Перейди в **Пароли приложений**
4. Выбери: Приложение → "Другое", введи "BirthCert"
5. Скопируй **16-значный пароль** (формат: `xxxx xxxx xxxx xxxx`)

---

## Шаг 3 — Задеплой на Vercel

### Вариант A: через GitHub (рекомендуется)
```bash
# 1. Установи Vercel CLI
npm install -g vercel

# 2. Создай репозиторий на GitHub и запушь папку
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/ТВОЙusername/birthcert.git
git push -u origin main

# 3. Зайди на vercel.com → New Project → импортируй репо
```

### Вариант B: прямо из терминала
```bash
npm install -g vercel
cd birthcert-vercel
vercel
# Следуй инструкциям в терминале
```

---

## Шаг 4 — Добавь переменные окружения в Vercel

На vercel.com → твой проект → **Settings → Environment Variables**

Добавь три переменные:

| Name | Value |
|------|-------|
| `OPENAI_API_KEY` | `sk-proj-...` (новый ключ) |
| `GMAIL_USER` | `твой@gmail.com` |
| `GMAIL_PASS` | `xxxx xxxx xxxx xxxx` |

После добавления нажми **Redeploy**.

---

## Шаг 5 — Готово! 🎉

Сайт доступен по адресу: `https://birthcert-XXXX.vercel.app`

Можешь подключить свой домен:
Vercel → Settings → Domains → Add domain

---

## Как это работает

```
Пользователь загружает скан
         ↓
POST /api/ocr  →  OpenAI GPT-4o Vision
         ↓
Заполняются поля формы автоматически
         ↓
POST /api/translate  →  Генерация текста перевода
         ↓
         →  pdfkit → PDF файл в памяти
         ↓
         →  nodemailer → Gmail → PDF на email клиента
         ↓
Клиент получает PDF для скачивания + письмо на email
```
