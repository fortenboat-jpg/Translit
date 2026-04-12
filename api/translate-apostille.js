// api/translate-apostille.js
const nodemailer = require('nodemailer');
const fetch = require('node-fetch');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  try {
    const d = req.body;
    const num = 'AP-' + Date.now().toString().slice(-6);
    const today = new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });

    const translated = await translateFields(d);

    const values = {
      field2:     translated.field2     || d.field2     || '',
      field3:     translated.field3     || d.field3     || '',
      field4:     translated.field4     || d.field4     || '',
      field5:     translated.field5     || d.field5     || '',
      field6:     translated.field6     || d.field6     || '',
      field7:     translated.field7     || d.field7     || '',
      field8:     d.field8 || '',
      backNumber: d.backNumber || '',
    };

    const html = buildHtml(values, num, today);

    // PDF через Gotenberg
    const GOTENBERG = process.env.GOTENBERG_URL || 'https://pdf.fortendocs.online';
    let pdfBytes = null;
    try {
      const form = new FormData();
      form.append('files', new Blob([html], { type: 'text/html' }), 'index.html');
      form.append('paperWidth', '8.27');
      form.append('paperHeight', '11.69');
      form.append('marginTop', '0');
      form.append('marginBottom', '0');
      form.append('marginLeft', '0');
      form.append('marginRight', '0');
      form.append('scale', '1.0');
      form.append('printBackground', 'true');
      const r = await fetch(`${GOTENBERG}/forms/chromium/convert/html`, {
        method: 'POST', body: form,
        signal: AbortSignal.timeout(25000),
      });
      if (!r.ok) throw new Error(`Gotenberg ${r.status}`);
      pdfBytes = Buffer.from(await r.arrayBuffer());
    } catch (e) {
      console.error('Gotenberg apostille error:', e.message);
    }

    // Email — только при оплате через webhook
    const isPaid = d.paid === true && d._paymentToken === process.env.PAYMENT_TOKEN;
    if (d.email && process.env.GMAIL_USER && process.env.GMAIL_PASS && isPaid) {
      try {
        const transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_PASS }
        });
        await transporter.sendMail({
          from: `BirthCert Translation <${process.env.GMAIL_USER}>`,
          to: d.email,
          subject: `Перевод апостиля — No. ${num}`,
          html: buildEmail(num),
          attachments: [{
            filename: pdfBytes ? `Апостиль_перевод_${num}.pdf` : `Апостиль_перевод_${num}.html`,
            content: pdfBytes ? Buffer.from(pdfBytes) : Buffer.from(html, 'utf-8'),
          }],
        });
      } catch (e) {
        console.error('Email apostille error:', e.message);
      }
    }

    return res.status(200).json({
      ok: true,
      values,
      pdfHtml: html,
      orderNum: num,
      translationText: buildPlainText(values, num, today),
    });

  } catch (err) {
    console.error('Translate apostille error:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
};

// ── GPT перевод полей ──────────────────────────────────────
async function translateFields(d) {
  const prompt = `Переведи поля апостиля штата Флорида с английского на русский язык.

Правила:
- Имена людей — транслитерируй фонетически (KENNETH → КЕННЕТ, JOHNSON → ДЖОНСОН, "KEN" → «КЕН»)
- Прозвища в кавычках — транслитерируй и оставляй в кавычках-ёлочках «»
- Должности и названия органов — переводи (STATE REGISTRAR OF VITAL STATISTICS → РЕГИСТРАТОР ЗАГС ШТАТА)
- Описание печати — переводи (THE GREAT SEAL OF THE STATE OF FLORIDA → ГЕРБОВОЙ ПЕЧАТЬЮ ШТАТА ФЛОРИДА)
- Дата словами — в родительном падеже, без слова "года" в конце (Twelfth day of September, 2024 → Двенадцатого сентября 2024)
- Город — (Tallahassee, Florida → г. Таллахасси, штат Флорида)
- Уполномоченный — (Secretary of State, State of Florida → Секретарем штата, штат Флорида)
- Поле 8 (номер) — не переводить, вернуть как есть

Входные данные:
field2 (подписан): "${d.field2 || ''}"
field3 (в должности): "${d.field3 || ''}"
field4 (печать): "${d.field4 || ''}"
field5 (в городе): "${d.field5 || ''}"
field6 (дата словами): "${d.field6 || ''}"
field7 (уполномочен): "${d.field7 || ''}"

Верни ТОЛЬКО JSON без markdown и пояснений:
{"field2":"","field3":"","field4":"","field5":"","field6":"","field7":""}`;

  try {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        max_tokens: 400,
        messages: [{ role: 'user', content: prompt }]
      })
    });
    const j = await r.json();
    const raw = j.choices?.[0]?.message?.content || '{}';
    return JSON.parse(raw.replace(/```json|```/g, '').trim());
  } catch (e) {
    console.error('GPT translate apostille error:', e.message);
    return {};
  }
}

// ── HTML — точно по образцу скрина ────────────────────────
function buildHtml(v, num, today) {
  function esc(s) {
    return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  return `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<title>Апостиль — перевод ${num}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Times New Roman', Times, serif;
    background: #fff;
    color: #000;
    font-size: 14px;
    line-height: 1.7;
    padding: 36px 72px 40px;
  }

  /* Верхний правый угол */
  .top-right {
    text-align: right;
    font-style: italic;
    text-decoration: underline;
    font-size: 13px;
    margin-bottom: 20px;
  }

  /* Шапка по центру */
  .header {
    text-align: center;
    margin-bottom: 18px;
  }
  .header .state {
    font-size: 16px;
    font-weight: bold;
    letter-spacing: 1px;
  }
  .header .emblem {
    font-style: italic;
    font-size: 12px;
    color: #333;
    margin: 1px 0;
  }
  .header .dept {
    font-size: 14px;
    font-weight: bold;
    margin-bottom: 14px;
  }
  .header .apostille-title {
    font-size: 15px;
    font-weight: bold;
    letter-spacing: 0.5px;
    margin-bottom: 2px;
  }
  .header .convention {
    font-size: 13px;
  }

  /* Поля 1–4 */
  .section-top {
    margin-top: 14px;
    margin-bottom: 8px;
  }
  .field-row {
    display: flex;
    align-items: baseline;
    margin-bottom: 8px;
    font-size: 14px;
  }
  .field-num {
    min-width: 22px;
    flex-shrink: 0;
  }
  .field-label {
    flex-shrink: 0;
    margin-right: 4px;
  }
  /* Подчёркнутое значение (поля 5,6,7) */
  .field-val-underline {
    text-decoration: underline;
  }
  /* Пустая линия после метки (поля 2,3,4) */
  .field-line {
    flex: 1;
    border-bottom: 1px solid #000;
    margin-left: 6px;
    min-width: 120px;
  }
  /* Подчёркнутое значение полей 2,3,4 — вставляется после линии справа */
  .field-val-red {
    font-weight: bold;
    text-decoration: underline;
    margin-left: 0;
    white-space: nowrap;
  }

  /* "Настоящий официальный документ" — отступ как в оригинале */
  .indent-text {
    margin-left: 26px;
    margin-bottom: 8px;
    font-size: 14px;
  }

  /* Удостоверено */
  .certified {
    text-align: center;
    font-size: 15px;
    font-weight: bold;
    margin: 18px 0 12px;
  }

  /* Поля 5–8 — с подчёркиванием текста */
  .field-56 {
    display: flex;
    align-items: baseline;
    margin-bottom: 8px;
    font-size: 14px;
  }

  /* Поле 6: "6. ______ года" */
  .field6-wrap {
    display: flex;
    align-items: baseline;
    gap: 6px;
    margin-bottom: 8px;
    font-size: 14px;
  }
  .field6-val {
    text-decoration: underline;
    min-width: 180px;
  }

  /* Нижняя секция: печать + подпись */
  .bottom-section {
    display: flex;
    justify-content: space-between;
    margin-top: 22px;
    align-items: flex-start;
  }
  .stamp-label { font-size: 13px; margin-bottom: 4px; }
  .stamp-text  { font-style: italic; font-size: 12px; color: #444; line-height: 1.5; }
  .sig-label   { font-size: 13px; margin-bottom: 4px; }
  .sig-name    { font-weight: bold; font-size: 14px; }

  /* DSDE */
  .dsde { font-size: 11px; color: #c00000; margin-top: 22px; }

  /* Примечания в рамках */
  .notes {
    margin-top: 16px;
    font-size: 12px;
    font-style: italic;
    color: #333;
    line-height: 1.75;
  }

  /* Номер на обороте */
  .back-number { margin-top: 10px; font-size: 12px; font-style: italic; }

  /* Футер */
  .footer {
    margin-top: 32px;
    border-top: 1px solid #ccc;
    padding-top: 8px;
    font-size: 10px;
    color: #aaa;
    text-align: center;
  }

  @media print {
    body { padding: 18mm 20mm; }
    @page { size: A4; margin: 0; }
  }
</style>
</head>
<body>

<div class="top-right">Перевод с английского языка</div>

<div class="header">
  <div class="state">ШТАТ ФЛОРИДА</div>
  <div class="emblem">[ЭМБЛЕМА ШТАТА ФЛОРИДА]</div>
  <div class="dept">ДЕПАРТАМЕНТ ШТАТА</div>
  <div class="apostille-title">АПОСТИЛЬ</div>
  <div class="convention">(Гаагская конвенция от 5 октября 1961 года)</div>
</div>

<div class="section-top">

  <!-- Поле 1 — фиксированное -->
  <div class="field-row">
    <span class="field-num">1.</span>
    <span class="field-label">Страна:&nbsp;&nbsp;&nbsp;&nbsp;</span>
    <span style="font-weight:bold">СОЕДИНЁННЫЕ ШТАТЫ АМЕРИКИ</span>
  </div>

  <div class="indent-text">Настоящий официальный документ</div>

  <!-- Поле 2 -->
  <div class="field-row">
    <span class="field-num">2.</span>
    <span class="field-label">Был подписан:</span>
    <span class="field-line"></span>
    <span class="field-val-red">&nbsp;${esc(v.field2)}</span>
  </div>

  <!-- Поле 3 -->
  <div class="field-row">
    <span class="field-num">3.</span>
    <span class="field-label">Выступающим(-ей) в качестве:</span>
    <span class="field-line"></span>
    <span class="field-val-red">&nbsp;${esc(v.field3)}</span>
  </div>

  <!-- Поле 4 -->
  <div class="field-row">
    <span class="field-num">4.</span>
    <span class="field-label">Скреплён печатью/штампом:</span>
    <span class="field-line"></span>
    <span class="field-val-red">&nbsp;${esc(v.field4)}</span>
  </div>

</div>

<div class="certified">Удостоверено</div>

<!-- Поле 5 -->
<div class="field-56">
  <span class="field-num">5.</span>
  <span class="field-label">в</span>
  <span class="field-val-underline">&nbsp;${esc(v.field5)}</span>
</div>

<!-- Поле 6: значение + "года" -->
<div class="field6-wrap">
  <span class="field-num">6.</span>
  <span class="field6-val">${esc(v.field6)}</span>
  <span>года</span>
</div>

<!-- Поле 7 -->
<div class="field-56">
  <span class="field-num">7.</span>
  <span class="field-val-underline">${esc(v.field7)}</span>
</div>

<!-- Поле 8 -->
<div class="field-56" style="margin-top:4px">
  <span class="field-num">8.</span>
  <span class="field-label">№</span>
  <span>&nbsp;${esc(v.field8)}</span>
</div>

<!-- Нижняя секция -->
<div class="bottom-section">
  <div>
    <div class="stamp-label">9. Печать/штамп:</div>
    <div class="stamp-text">[ГЕРБОВАЯ ПЕЧАТЬ<br>ШТАТА ФЛОРИДА]</div>
  </div>
  <div>
    <div class="sig-label">10. Подпись:</div>
    <div class="sig-name">[ПОДПИСЬ]</div>
  </div>
</div>

<div class="dsde">DSDE 99 (2/12)</div>

<div class="notes">
  [<em>В рамке вверху на полях</em>: Черно-белая копия этого документа не является официальной].<br>
  [<em>В рамке слева на полях</em>: При фотокопировании появляется слово «VOID» (ничтожно)].<br>
  [<em>В рамке справа на полях</em>: На лицевой стороне настоящего документа размером 8½ на 11 дюймов мелкими буквами напечатаны слова «State of Florida» (штат Флорида)].<br>
  [<em>В рамке внизу на полях</em>: Настоящий документ содержит водяной знак. Посмотрите на просвет, чтобы увидеть слова «SAFE» (защищено) и «VERIFY FIRST» (сначала проверить)].
</div>

<div class="back-number">[<em>Номер на обороте</em>:&nbsp;${esc(v.backNumber)}&nbsp;]</div>

<div class="footer">BirthCert Translation · Перевод апостиля · No. ${num} · ${today}</div>

</body>
</html>`;
}

// ── Plain text ─────────────────────────────────────────────
function buildPlainText(v, num, today) {
  return `АПОСТИЛЬ (Гаагская конвенция от 5 октября 1961 года)
Штат Флорида · Перевод с английского языка
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. Страна: СОЕДИНЁННЫЕ ШТАТЫ АМЕРИКИ
2. Был подписан: ${v.field2}
3. В качестве: ${v.field3}
4. Печать: ${v.field4}
   Удостоверено
5. в ${v.field5}
6. ${v.field6} года
7. ${v.field7}
8. № ${v.field8}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Перевод No. ${num} от ${today}`;
}

// ── Email ──────────────────────────────────────────────────
function buildEmail(num) {
  return `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto">
<div style="background:#0c1b3a;padding:24px;text-align:center">
  <h2 style="color:white;margin:0">📄 BirthCert Translation</h2>
  <p style="color:rgba(255,255,255,.6);margin:6px 0 0;font-size:13px">Перевод апостиля для Консульства РФ</p>
</div>
<div style="background:#f4f6fb;padding:28px">
  <p style="color:#0e1c36;font-size:15px;margin:0 0 10px">Здравствуйте!</p>
  <p style="color:#5a6b90;font-size:14px;margin-bottom:16px">Ваш перевод апостиля готов. К письму прикреплён <strong>1 файл</strong>:</p>
  <div style="background:white;border:1px solid #d4daf0;border-radius:8px;padding:14px;margin:0 0 16px">
    <p style="margin:0;font-size:13px">📄 <strong>Апостиль_перевод_${num}.pdf</strong> — сертифицированный перевод апостиля</p>
  </div>
  <div style="background:#fff8e6;border-left:3px solid #c8a84b;padding:10px 14px;border-radius:0 6px 6px 0;margin-bottom:16px">
    <p style="margin:0;color:#7a5a00;font-size:13px">📋 Распечатайте перевод и приложите к оригиналу апостиля при подаче в Консульство РФ.</p>
  </div>
  <p style="color:#aab0c8;font-size:12px;margin:0">No. ${num} · BirthCert Translation</p>
</div></div>`;
}
