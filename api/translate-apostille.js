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

    const GOTENBERG = process.env.GOTENBERG_URL || 'https://pdf.fortendocs.online';
    let pdfBytes = null;
    try {
      const form = new FormData();
      form.append('files', new Blob([html], { type: 'text/html' }), 'index.html');
      form.append('paperWidth', '8.27');
      form.append('paperHeight', '11.69');
      form.append('marginTop', '0.6');
      form.append('marginBottom', '0.6');
      form.append('marginLeft', '0.8');
      form.append('marginRight', '0.8');
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

async function translateFields(d) {
  const prompt = `Переведи поля апостиля штата Флорида с английского на русский язык.

Правила:
- Имена людей — транслитерируй фонетически (KENNETH → КЕННЕТ, JOHNSON → ДЖОНСОН, KEN → КЕН)
- Прозвища в кавычках — тоже транслитерируй и оставляй в кавычках-ёлочках
- Должности — переводи (STATE REGISTRAR OF VITAL STATISTICS → РЕГИСТРАТОР ЗАГС ШТАТА)
- Печать — переводи (THE GREAT SEAL OF THE STATE OF FLORIDA → ГЕРБОВОЙ ПЕЧАТЬЮ ШТАТА ФЛОРИДА)
- Дата словами — в родительном падеже (Twelfth day of September, 2024 → Двенадцатого сентября 2024 года)
- Город — (Tallahassee, Florida → г. Таллахасси, штат Флорида)
- Уполномоченный — (Secretary of State, State of Florida → Секретарем штата, штат Флорида)

Поля:
field2: "${d.field2 || ''}"
field3: "${d.field3 || ''}"
field4: "${d.field4 || ''}"
field5: "${d.field5 || ''}"
field6: "${d.field6 || ''}"
field7: "${d.field7 || ''}"

Верни ТОЛЬКО JSON без markdown:
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

function buildHtml(v, num, today) {
  function esc(s) {
    return (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
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
    padding: 40px 72px;
  }
  .top-right { text-align: right; font-style: italic; text-decoration: underline; font-size: 13px; margin-bottom: 24px; }
  .header { text-align: center; margin-bottom: 22px; }
  .header .state { font-size: 17px; font-weight: bold; letter-spacing: 2px; margin-bottom: 2px; }
  .header .emblem { font-style: italic; font-size: 12px; color: #444; margin-bottom: 2px; }
  .header .dept { font-size: 14px; font-weight: bold; margin-bottom: 14px; }
  .header .apostille-title { font-size: 16px; font-weight: bold; letter-spacing: 1px; margin-bottom: 3px; }
  .header .convention { font-size: 13px; }
  .field { display: flex; align-items: baseline; margin-bottom: 10px; font-size: 14px; gap: 6px; }
  .num { min-width: 20px; flex-shrink: 0; }
  .label { flex-shrink: 0; }
  .value-red { font-weight: bold; color: #c00000; text-decoration: underline; }
  .value-plain { text-decoration: underline; }
  .plain-text { margin-left: 26px; margin-bottom: 10px; font-size: 14px; }
  .certified { text-align: center; font-size: 15px; font-weight: bold; margin: 18px 0 14px; }
  .bottom-section { display: flex; justify-content: space-between; margin-top: 24px; align-items: flex-start; }
  .stamp-label { font-size: 13px; margin-bottom: 4px; }
  .stamp-block { font-style: italic; font-size: 12px; color: #555; line-height: 1.5; }
  .sig-label { font-size: 13px; margin-bottom: 4px; }
  .sig-name { font-weight: bold; font-size: 14px; }
  .sig-title-red { color: #c00000; font-weight: bold; font-size: 13px; }
  .dsde { font-size: 11px; color: #c00000; margin-top: 20px; }
  .notes { margin-top: 18px; font-size: 12px; font-style: italic; color: #444; line-height: 1.75; }
  .back-number { margin-top: 10px; font-size: 12px; font-style: italic; }
  .footer { margin-top: 36px; border-top: 1px solid #ccc; padding-top: 8px; font-size: 10px; color: #aaa; text-align: center; }
  @media print { body { padding: 20mm 22mm; } @page { size: A4; margin: 0; } }
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

<div class="field">
  <span class="num">1.</span>
  <span class="label">Страна:&nbsp;&nbsp;&nbsp;&nbsp;</span>
  <span class="value-red">СОЕДИНЁННЫЕ ШТАТЫ АМЕРИКИ</span>
</div>

<div class="plain-text">Настоящий официальный документ</div>

<div class="field">
  <span class="num">2.</span>
  <span class="label">Был подписан:</span>
  <span style="flex:1;border-bottom:1px solid #000;min-width:40px;margin:0 8px"></span>
  <span class="value-red">${esc(v.field2)}</span>
</div>

<div class="field">
  <span class="num">3.</span>
  <span class="label">Выступающим(-ей) в качестве:</span>
  <span style="flex:1;border-bottom:1px solid #000;min-width:20px;margin:0 8px"></span>
  <span class="value-red">${esc(v.field3)}</span>
</div>

<div class="field">
  <span class="num">4.</span>
  <span class="label">Скреплён печатью/штампом:</span>
  <span style="flex:1;border-bottom:1px solid #000;min-width:20px;margin:0 8px"></span>
  <span class="value-red">${esc(v.field4)}</span>
</div>

<div class="certified">Удостоверено</div>

<div class="field">
  <span class="num">5.</span>
  <span class="label">в</span>
  <span class="value-plain">&nbsp;${esc(v.field5)}</span>
</div>

<div class="field">
  <span class="num">6.</span>
  <span class="value-plain">${esc(v.field6)}</span>
</div>

<div class="field">
  <span class="num">7.</span>
  <span class="value-plain">${esc(v.field7)}</span>
</div>

<div class="field">
  <span class="num">8.</span>
  <span class="label">№</span>
  <span class="value-red">&nbsp;${esc(v.field8)}</span>
</div>

<div class="bottom-section">
  <div>
    <div class="stamp-label">9. Печать/штамп:</div>
    <div class="stamp-block">[ГЕРБОВАЯ ПЕЧАТЬ<br>ШТАТА ФЛОРИДА]</div>
  </div>
  <div>
    <div class="sig-label">10. Подпись:</div>
    <div class="sig-name">[ПОДПИСЬ]</div>
    <div class="sig-title-red">СЕКРЕТАРЬ ШТАТА</div>
  </div>
</div>

<div class="dsde">DSDE 99 (2/12)</div>

<div class="notes">
  [<em>В рамке вверху на полях</em>: Черно-белая копия этого документа не является официальной].<br>
  [<em>В рамке слева на полях</em>: При фотокопировании появляется слово «VOID» (ничтожно)].<br>
  [<em>В рамке справа на полях</em>: На лицевой стороне настоящего документа размером 8½ на 11 дюймов мелкими буквами напечатаны слова «State of Florida» (штат Флорида)].<br>
  [<em>В рамке внизу на полях</em>: Настоящий документ содержит водяной знак. Посмотрите на просвет, чтобы увидеть слова «SAFE» (защищено) и «VERIFY FIRST» (сначала проверить)].
</div>

${v.backNumber ? `<div class="back-number">[<em>Номер на обороте</em>: ${esc(v.backNumber)}]</div>` : ''}

<div class="footer">BirthCert Translation · Перевод апостиля · No. ${num} · ${today}</div>

</body>
</html>`;
}

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
6. ${v.field6}
7. ${v.field7}
8. № ${v.field8}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Перевод No. ${num} от ${today}`;
}

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
