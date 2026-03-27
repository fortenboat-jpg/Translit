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
    const docxBuffer      = buildDocx(translationText, num);
    const bgUrl           = process.env.BACKGROUND_URL || '';
    const styledHtml      = buildStyledHtml(d, dobFmt, fullName, num, today, bgUrl);

    // Send email with both attachments
    if (d.email && process.env.RESEND_API_KEY) {
      const resend = new Resend(process.env.RESEND_API_KEY);
      await resend.emails.send({
        from: 'BirthCert Translation <onboarding@resend.dev>',
        to: d.email,
        subject: `Ваш перевод свидетельства о рождении — ${fullName} (№ ${num})`,
        html: buildEmailHtml(fullName, num, translationText),
        attachments: [
          {
            filename: `BirthCert_${num}.docx`,
            content: docxBuffer.toString('base64'),
          },
          {
            filename: `BirthCert_${num}_с_фоном.html`,
            content: Buffer.from(styledHtml, 'utf-8').toString('base64'),
          }
        ]
      });
    }

    return res.status(200).json({
      ok: true,
      translationText,
      orderNum: num,
      docxBase64: docxBuffer.toString('base64'),
      pdfHtml: styledHtml,
    });

  } catch (err) {
    console.error('Translate error:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}

// ─── PLAIN TEXT TRANSLATION ───────────────────────────────
function buildText(d, dobFmt, fullName, num, today) {
  return `Перевод с английского языка
══════════════════════════════════════════════════════

ШТАТ ФЛОРИДА
БЮРО ЗАПИСИ АКТОВ ГРАЖДАНСКОГО СОСТОЯНИЯ
СВИДЕТЕЛЬСТВО О РОЖДЕНИИ

══════════════════════════════════════════════════════
НОМЕР РЕГИСТРАЦИИ В ШТАТЕ: ${d.stateRegNum || '—'}
ДАТА ВЫДАЧИ:               ${d.dateIssued || '—'}
ДАТА РЕГИСТРАЦИИ:          ${d.dateRegistered || '—'}

ИНФОРМАЦИЯ О РЕБЁНКЕ
──────────────────────────────────────────────────────
ИМЯ:                   ${fullName}
ДАТА РОЖДЕНИЯ:         ${dobFmt}
ВРЕМЯ РОЖДЕНИЯ (24 Ч): ${d.timeOfBirth || '—'}
ПОЛ:                   ${d.sex || '—'}
ВЕС ПРИ РОЖДЕНИИ:      ${d.weight || '—'}
МЕСТО РОЖДЕНИЯ:        ${d.hospital || '—'}
ГОРОД, ОКРУГ РОЖДЕНИЯ: ${d.cityCounty || '—'}

ИНФОРМАЦИЯ О МАТЕРИ / РОДИТЕЛЕ
(ИМЯ ДО ПЕРВОГО БРАКА, ЕСЛИ ПРИМЕНИМО)
──────────────────────────────────────────────────────
ИМЯ:                   ${d.motherName || '—'}
ДАТА РОЖДЕНИЯ:         ${d.motherDob || '—'}
МЕСТО РОЖДЕНИЯ:        ${d.motherBirthPlace || '—'}

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

// ─── STYLED HTML WITH BACKGROUND ─────────────────────────
function buildStyledHtml(d, dobFmt, fullName, num, today, bgUrl) {
  const hasBg = bgUrl && bgUrl.length > 0;

  // Background style: real image if provided, else decorative gradient
  const bgStyle = hasBg
    ? `background: url('${bgUrl}') center center / cover no-repeat;`
    : `background: linear-gradient(160deg, #f0f2f8 0%, #e8eaf4 100%);`;

  function row(label, value) {
    return `<tr>
      <td style="padding:5px 8px 5px 0;color:#4a5568;font-size:10.5px;width:52mm;vertical-align:top;border-bottom:1px solid rgba(0,0,0,0.06)">${label}</td>
      <td style="padding:5px 0 5px 8px;font-weight:700;color:#1a202c;font-size:10.5px;border-bottom:1px solid rgba(0,0,0,0.06)">${value || '—'}</td>
    </tr>`;
  }

  return `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<title>Перевод — ${fullName} (№ ${num})</title>
<link href="https://fonts.googleapis.com/css2?family=PT+Serif:ital,wght@0,400;0,700;1,400&display=swap" rel="stylesheet">
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  font-family: 'PT Serif', 'Times New Roman', serif;
  ${bgStyle}
  min-height: 100vh;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 30px 20px;
}
.overlay {
  position: fixed; inset: 0;
  ${hasBg ? 'background: rgba(255,255,255,0.82);' : ''}
  pointer-events: none;
  z-index: 0;
}
.page {
  position: relative;
  z-index: 1;
  width: 210mm;
  min-height: 297mm;
  background: rgba(255,255,255,${hasBg ? '0.97' : '1'});
  box-shadow: 0 8px 48px rgba(0,0,0,0.22);
  display: flex;
  flex-direction: column;
}
/* Декоративная рамка */
.frame { position: absolute; inset: 7mm; border: 1.5px solid rgba(200,168,75,0.5); pointer-events: none; z-index: 2; }
.frame-inner { position: absolute; inset: 9mm; border: 0.5px solid rgba(200,168,75,0.25); pointer-events: none; z-index: 2; }
.corner { position: absolute; width: 16px; height: 16px; }
.c-tl { top:5mm; left:5mm; border-top:2.5px solid #c8a84b; border-left:2.5px solid #c8a84b; }
.c-tr { top:5mm; right:5mm; border-top:2.5px solid #c8a84b; border-right:2.5px solid #c8a84b; }
.c-bl { bottom:5mm; left:5mm; border-bottom:2.5px solid #c8a84b; border-left:2.5px solid #c8a84b; }
.c-br { bottom:5mm; right:5mm; border-bottom:2.5px solid #c8a84b; border-right:2.5px solid #c8a84b; }
/* Шапка */
.hdr { background: linear-gradient(135deg,#0c1b3a,#1a3266); padding:16px 18mm; text-align:center; position:relative; z-index:3; }
.hdr-title { color:#fff; font-size:15px; font-weight:700; letter-spacing:2px; text-transform:uppercase; margin-bottom:4px; }
.hdr-sub { color:rgba(255,255,255,0.55); font-size:9.5px; letter-spacing:0.8px; }
.gold-bar { height:3px; background:linear-gradient(90deg,transparent,#c8a84b 20%,#f0cc6a 50%,#c8a84b 80%,transparent); }
/* Контент */
.body { padding:10mm 16mm 10mm; flex:1; position:relative; z-index:3; }
.meta-row { display:flex; justify-content:space-between; margin-bottom:10px; padding-bottom:8px; border-bottom:1px solid rgba(200,168,75,0.3); font-size:9px; color:#5a6b90; }
.sec { margin-bottom:4px; }
.sec-title { background:linear-gradient(135deg,rgba(12,27,58,0.06),rgba(12,27,58,0.02)); border-left:3px solid #c8a84b; padding:4px 10px; font-size:9.5px; font-weight:700; color:#0c1b3a; letter-spacing:0.5px; text-transform:uppercase; margin:10px 0 4px; }
table { width:100%; border-collapse:collapse; }
/* Блок сертификации */
.cert { margin-top:10px; padding:10px 12px; background:rgba(244,246,251,0.8); border:1px solid rgba(212,218,240,0.8); border-radius:3px; font-size:9.5px; color:#2a3a5a; line-height:1.85; }
.cert-title { font-weight:700; color:#0c1b3a; font-size:10px; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:8px; display:block; }
.sign-row { display:flex; justify-content:space-between; margin-top:18px; padding-top:10px; border-top:1px dashed rgba(200,168,75,0.6); }
.sign-item { text-align:center; }
.sign-line { border-bottom:1px solid #0c1b3a; width:46mm; margin:0 auto 4px; }
.sign-label { font-size:8.5px; color:#5a6b90; }
.stamp-row { display:flex; align-items:center; gap:14px; margin-top:12px; }
.stamp { width:52px; height:52px; border-radius:50%; border:2px solid #1a46b8; display:flex; align-items:center; justify-content:center; flex-shrink:0; font-size:6px; font-weight:700; color:#1a46b8; text-align:center; text-transform:uppercase; letter-spacing:0.3px; line-height:1.5; padding:4px; }
.stamp-text { font-size:9px; color:#5a6b90; line-height:1.7; }
/* Футер */
.ftr { background:#0c1b3a; padding:7px 18mm; display:flex; justify-content:space-between; align-items:center; position:relative; z-index:3; }
.ftr-l { color:rgba(255,255,255,0.45); font-size:7.5px; }
.ftr-r { color:#c8a84b; font-size:7.5px; font-weight:700; }
@media print {
  body { padding:0; background:white !important; }
  .overlay { display:none; }
  .page { box-shadow:none; width:100%; }
}
</style>
</head>
<body>
${hasBg ? '<div class="overlay"></div>' : ''}
<div class="page">
  <div class="frame"></div><div class="frame-inner"></div>
  <div class="corner c-tl"></div><div class="corner c-tr"></div>
  <div class="corner c-bl"></div><div class="corner c-br"></div>

  <div class="hdr">
    <div class="hdr-title">Свидетельство о рождении</div>
    <div class="hdr-sub">Перевод с английского языка на русский язык &nbsp;·&nbsp; Certificate of Live Birth &nbsp;·&nbsp; штат Флорида, США</div>
  </div>
  <div class="gold-bar"></div>

  <div class="body">
    <div class="meta-row">
      <span>РЕГ. №: <strong>${d.stateRegNum||'—'}</strong></span>
      <span>ВЫДАН: <strong>${d.dateIssued||'—'}</strong></span>
      <span>ЗАРЕГ.: <strong>${d.dateRegistered||'—'}</strong></span>
    </div>

    <div class="sec">
      <div class="sec-title">Информация о ребёнке</div>
      <table>
        ${row('Фамилия, имя, отчество', [d.lastName,d.firstName,d.middleName].filter(Boolean).join(' '))}
        ${row('Дата рождения', dobFmt)}
        ${row('Время рождения (24 ч)', d.timeOfBirth)}
        ${row('Пол', d.sex)}
        ${row('Вес при рождении', d.weight)}
        ${row('Место рождения (больница)', d.hospital)}
        ${row('Город, округ рождения', d.cityCounty)}
      </table>
    </div>

    <div class="sec">
      <div class="sec-title">Информация о матери / родителе</div>
      <table>
        ${row('ФИО (до первого брака)', d.motherName)}
        ${row('Дата рождения', d.motherDob)}
        ${row('Место рождения', d.motherBirthPlace)}
      </table>
    </div>

    <div class="sec">
      <div class="sec-title">Информация об отце / родителе</div>
      <table>
        ${row('ФИО (до первого брака)', d.fatherName)}
        ${row('Дата рождения', d.fatherDob)}
        ${row('Место рождения', d.fatherBirthPlace)}
      </table>
    </div>

    <div class="cert">
      <span class="cert-title">Удостоверение перевода</span>
      Я, нижеподписавшийся(аяся), сертифицированный переводчик с английского языка на русский язык,
      настоящим удостоверяю, что данный перевод является точным и полным переводом оригинального документа —
      свидетельства о рождении, выданного компетентным органом штата Флорида, США.
      Перевод выполнен в соответствии с требованиями Консульства Российской Федерации в США.
      <div class="sign-row">
        <div class="sign-item"><div class="sign-line"></div><div class="sign-label">Подпись переводчика</div></div>
        <div class="sign-item"><div class="sign-line"></div><div class="sign-label">Дата: ${today}</div></div>
        <div class="sign-item"><div class="sign-line"></div><div class="sign-label">№ ${num}</div></div>
      </div>
      <div class="stamp-row">
        <div class="stamp">Certified<br>Translator<br>★<br>BirthCert</div>
        <div class="stamp-text">
          <strong style="color:#0c1b3a;display:block;margin-bottom:2px">BirthCert Translation Services</strong>
          Официальный перевод для Консульства РФ в США<br>
          birthcert-translation.com
        </div>
      </div>
    </div>
  </div>

  <div class="ftr">
    <div class="ftr-l">© BirthCert Translation &nbsp;·&nbsp; Принимается консульствами РФ в США</div>
    <div class="ftr-r">№ ${num}</div>
  </div>
</div>
</body>
</html>`;
}

// ─── DOCX (pure Office Open XML) ─────────────────────────
function buildDocx(text, num) {
  const lines = text.split('\n');
  const paragraphs = lines.map(line => {
    const isBold = line.startsWith('ИНФОРМАЦИЯ') || line.startsWith('УДОСТОВЕРЕНИЕ') ||
                   line.startsWith('ШТАТ') || line.startsWith('БЮРО') ||
                   line.startsWith('СВИДЕТЕЛЬСТВО') || line.startsWith('Перевод с');
    const isCenter = line.startsWith('СВИДЕТЕЛЬСТВО') || line.startsWith('ШТАТ') || line.startsWith('БЮРО');
    const escaped = line.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    return `<w:p>
      <w:pPr><w:spacing w:line="280" w:lineRule="auto"/>${isCenter ? '<w:jc w:val="center"/>' : ''}</w:pPr>
      <w:r>
        <w:rPr>${isBold ? '<w:b/>' : ''}<w:sz w:val="20"/><w:szCs w:val="20"/>
          <w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/>
        </w:rPr>
        <w:t xml:space="preserve">${escaped || ' '}</w:t>
      </w:r>
    </w:p>`;
  }).join('');

  const docXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:body>
  <w:p><w:pPr><w:jc w:val="center"/></w:pPr>
    <w:r><w:rPr><w:b/><w:sz w:val="32"/><w:szCs w:val="32"/>
      <w:color w:val="0C1B3A"/>
      <w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/>
    </w:rPr><w:t>СВИДЕТЕЛЬСТВО О РОЖДЕНИИ</w:t></w:r></w:p>
  <w:p><w:pPr><w:jc w:val="center"/></w:pPr>
    <w:r><w:rPr><w:sz w:val="18"/><w:szCs w:val="18"/><w:color w:val="5A6B90"/>
      <w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/>
    </w:rPr><w:t>Перевод с английского языка на русский язык | Certificate of Live Birth</w:t></w:r></w:p>
  <w:p><w:r><w:t> </w:t></w:r></w:p>
  ${paragraphs}
  <w:sectPr>
    <w:pgSz w:w="11906" w:h="16838"/>
    <w:pgMar w:top="1134" w:right="850" w:bottom="1134" w:left="1701"/>
  </w:sectPr>
</w:body></w:document>`;

  const relsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults><w:rPrDefault><w:rPr>
    <w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/>
    <w:sz w:val="20"/><w:szCs w:val="20"/>
  </w:rPr></w:rPrDefault></w:docDefaults>
</w:styles>`;

  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`;

  const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

  return buildZip([
    { name: '[Content_Types].xml',         data: contentTypes },
    { name: '_rels/.rels',                 data: rootRels },
    { name: 'word/document.xml',           data: docXml },
    { name: 'word/_rels/document.xml.rels',data: relsXml },
    { name: 'word/styles.xml',             data: stylesXml },
  ]);
}

// ─── ZIP BUILDER (no deps) ────────────────────────────────
function buildZip(files) {
  const localParts = [], centralParts = [];
  let offset = 0;
  for (const file of files) {
    const name = Buffer.from(file.name, 'utf-8');
    const data = Buffer.from(file.data, 'utf-8');
    const crc  = crc32(data);
    const local = Buffer.alloc(30 + name.length);
    local.writeUInt32LE(0x04034b50,0); local.writeUInt16LE(20,4);
    local.writeUInt16LE(0,6); local.writeUInt16LE(0,8);
    local.writeUInt16LE(0,10); local.writeUInt16LE(0,12);
    local.writeUInt32LE(crc,14); local.writeUInt32LE(data.length,18);
    local.writeUInt32LE(data.length,22); local.writeUInt16LE(name.length,26);
    local.writeUInt16LE(0,28); name.copy(local,30);
    localParts.push(local, data);
    const central = Buffer.alloc(46 + name.length);
    central.writeUInt32LE(0x02014b50,0); central.writeUInt16LE(20,4);
    central.writeUInt16LE(20,6); central.writeUInt16LE(0,8);
    central.writeUInt16LE(0,10); central.writeUInt16LE(0,12);
    central.writeUInt16LE(0,14); central.writeUInt32LE(crc,16);
    central.writeUInt32LE(data.length,20); central.writeUInt32LE(data.length,24);
    central.writeUInt16LE(name.length,28); central.writeUInt16LE(0,30);
    central.writeUInt16LE(0,32); central.writeUInt16LE(0,34);
    central.writeUInt16LE(0,36); central.writeUInt32LE(0,38);
    central.writeUInt32LE(offset,42); name.copy(central,46);
    centralParts.push(central);
    offset += 30 + name.length + data.length;
  }
  const cd  = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50,0); end.writeUInt16LE(0,4);
  end.writeUInt16LE(0,6); end.writeUInt16LE(files.length,8);
  end.writeUInt16LE(files.length,10); end.writeUInt32LE(cd.length,12);
  end.writeUInt32LE(offset,16); end.writeUInt16LE(0,20);
  return Buffer.concat([...localParts, cd, end]);
}

function crc32(buf) {
  const t = new Uint32Array(256);
  for (let i=0;i<256;i++){let c=i;for(let j=0;j<8;j++)c=(c&1)?(0xEDB88320^(c>>>1)):(c>>>1);t[i]=c;}
  let crc=0xFFFFFFFF;
  for (let i=0;i<buf.length;i++) crc=(crc>>>8)^t[(crc^buf[i])&0xFF];
  return (crc^0xFFFFFFFF)>>>0;
}

// ─── EMAIL HTML ───────────────────────────────────────────
function buildEmailHtml(fullName, num, text) {
  const escaped = text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  return `
<div style="font-family:Arial,sans-serif;max-width:580px;margin:0 auto;border-radius:14px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.1)">
  <div style="background:#0c1b3a;padding:28px;text-align:center">
    <h2 style="color:white;margin:0;font-size:22px">📄 BirthCert Translation</h2>
    <p style="color:rgba(255,255,255,0.6);margin:6px 0 0;font-size:13px">Официальный перевод для Консульства РФ в США</p>
  </div>
  <div style="background:#f4f6fb;padding:32px">
    <p style="color:#0e1c36;font-size:15px;margin:0 0 10px">Здравствуйте!</p>
    <p style="color:#5a6b90;font-size:14px;line-height:1.7;margin-bottom:20px">
      Ваш перевод свидетельства о рождении готов.<br>
      К письму прикреплены <strong>два файла</strong>:
    </p>
    <div style="background:white;border:1.5px solid #d4daf0;border-radius:10px;padding:16px;margin-bottom:16px">
      <p style="margin:0 0 8px;color:#0e1c36;font-weight:600;font-size:14px">📎 Вложения:</p>
      <p style="margin:0 0 6px;font-size:13px">📝 <strong>BirthCert_${num}.docx</strong> — открыть в Microsoft Word</p>
      <p style="margin:0;font-size:13px">🎨 <strong>BirthCert_${num}_с_фоном.html</strong> — красивый вариант с фоном бланка</p>
    </div>
    <div style="background:#e8f8f0;border-left:3px solid #0ea86e;padding:12px 16px;border-radius:0 8px 8px 0;margin-bottom:20px">
      <p style="margin:0;color:#0a6644;font-size:13px">
        🖨️ Для подачи в консульство — откройте <strong>HTML файл</strong> в браузере и нажмите <strong>Ctrl+P → Печать</strong>
      </p>
    </div>
    <details style="margin-bottom:16px">
      <summary style="cursor:pointer;color:#5a6b90;font-size:13px;margin-bottom:8px">Показать текст перевода</summary>
      <pre style="font-size:10px;color:#0e1c36;white-space:pre-wrap;font-family:monospace;line-height:1.7;background:white;border:1px solid #d4daf0;border-radius:8px;padding:14px;margin-top:8px">${escaped}</pre>
    </details>
    <p style="color:#aab0c8;font-size:12px;margin:0">№ перевода: <strong style="color:#5a6b90">${num}</strong> &nbsp;·&nbsp; © BirthCert Translation</p>
  </div>
</div>`;
}
