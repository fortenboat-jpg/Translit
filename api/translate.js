import { Resend } from 'resend';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  try {
    const d = req.body;
    const num   = 'BC-' + Date.now().toString().slice(-6);
    const today = new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
    const dobFmt = d.dob
      ? new Date(d.dob + 'T12:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
      : '—';
    const fullName = [d.lastName, d.firstName, d.middleName].filter(Boolean).join(' ');
    const translationText = buildText(d, dobFmt, fullName, num, today);

    if (d.email && process.env.RESEND_API_KEY) {
      const resend = new Resend(process.env.RESEND_API_KEY);
      await resend.emails.send({
        from: 'BirthCert Translation <onboarding@resend.dev>',
        to: d.email,
        subject: `Ваш перевод свидетельства о рождении — ${fullName} (№ ${num})`,
        html: buildEmailHtml(fullName, num, translationText),
      });
    }

    return res.status(200).json({ ok: true, translationText, orderNum: num });

  } catch (err) {
    console.error('Translate error:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}

function buildText(d, dobFmt, fullName, num, today) {
  return `                    Перевод с английского языка
══════════════════════════════════════════════════════

                        ШТАТ ФЛОРИДА

         БЮРО ЗАПИСИ АКТОВ ГРАЖДАНСКОГО СОСТОЯНИЯ
                  СВИДЕТЕЛЬСТВО О РОЖДЕНИИ

══════════════════════════════════════════════════════

НОМЕР РЕГИСТРАЦИИ В ШТАТЕ: ${d.stateRegNum || '—'}
ДАТА ВЫДАЧИ:               ${d.dateIssued || '—'}
ДАТА РЕГИСТРАЦИИ:          ${d.dateRegistered || '—'}

──────────────────────────────────────────────────────
ИНФОРМАЦИЯ О РЕБЁНКЕ
──────────────────────────────────────────────────────
ИМЯ:                   ${fullName}
ДАТА РОЖДЕНИЯ:         ${dobFmt}
ВРЕМЯ РОЖДЕНИЯ (24 Ч): ${d.timeOfBirth || '—'}
ПОЛ:                   ${d.sex || '—'}
ВЕС ПРИ РОЖДЕНИИ:      ${d.weight || '—'}
МЕСТО РОЖДЕНИЯ:        ${d.hospital || '—'}
ГОРОД, ОКРУГ РОЖДЕНИЯ: ${d.cityCounty || '—'}

──────────────────────────────────────────────────────
ИНФОРМАЦИЯ О МАТЕРИ / РОДИТЕЛЕ
(ИМЯ ДО ПЕРВОГО БРАКА, ЕСЛИ ПРИМЕНИМО)
──────────────────────────────────────────────────────
ИМЯ:                   ${d.motherName || '—'}
ДАТА РОЖДЕНИЯ:         ${d.motherDob || '—'}
МЕСТО РОЖДЕНИЯ:        ${d.motherBirthPlace || '—'}

──────────────────────────────────────────────────────
ИНФОРМАЦИЯ ОБ ОТЦЕ / РОДИТЕЛЕ
(ИМЯ ДО ПЕРВОГО БРАКА, ЕСЛИ ПРИМЕНИМО)
──────────────────────────────────────────────────────
ИМЯ:                   ${d.fatherName || '—'}
ДАТА РОЖДЕНИЯ:         ${d.fatherDob || '—'}
МЕСТО РОЖДЕНИЯ:        ${d.fatherBirthPlace || '—'}

══════════════════════════════════════════════════════
                   УДОСТОВЕРЕНИЕ ПЕРЕВОДА
══════════════════════════════════════════════════════

Я, нижеподписавшийся(аяся), сертифицированный переводчик
с английского языка на русский язык, настоящим удостоверяю,
что данный перевод является точным и полным переводом
оригинального документа — свидетельства о рождении,
выданного компетентным органом штата Флорида, США.

Перевод выполнен в соответствии с требованиями
Консульства Российской Федерации в США.

Переводчик: _______________________________
Дата:       ${today}
№ перевода: ${num}
Печать:     BirthCert Translation Services

══════════════════════════════════════════════════════`;
}

function buildEmailHtml(fullName, num, text) {
  const escaped = text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  return `
<div style="font-family:Arial,sans-serif;max-width:580px;margin:0 auto;border-radius:14px;overflow:hidden">
  <div style="background:#0c1b3a;padding:28px;text-align:center">
    <h2 style="color:white;margin:0;font-size:22px">BirthCert Translation</h2>
    <p style="color:rgba(255,255,255,0.6);margin:6px 0 0;font-size:13px">Официальный перевод для Консульства РФ в США</p>
  </div>
  <div style="background:#f4f6fb;padding:32px">
    <p style="color:#0e1c36;font-size:15px;margin:0 0 10px">Здравствуйте!</p>
    <p style="color:#5a6b90;font-size:14px;line-height:1.7">Ваш перевод готов. Распечатайте и подайте в консульство.</p>
    <div style="background:white;border:1.5px solid #d4daf0;border-radius:10px;padding:20px;margin:20px 0;font-family:monospace;font-size:11px;white-space:pre-wrap;line-height:1.7;color:#0e1c36">${escaped}</div>
    <div style="background:#e8f8f0;border-left:3px solid #0ea86e;padding:12px 16px;border-radius:0 8px 8px 0">
      <p style="margin:0;color:#0a6644;font-size:13px">При необходимости заверьте у нотариуса в США.</p>
    </div>
    <p style="color:#aab0c8;font-size:12px;margin-top:16px">№ перевода: <strong>${num}</strong> · BirthCert Translation</p>
  </div>
</div>`;
}
