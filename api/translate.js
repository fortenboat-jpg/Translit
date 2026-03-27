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

    const bgUrl = process.env.BACKGROUND_URL || 'https://translit-gilt.vercel.app/bg.jpg';
    const overlayHtml = buildOverlayHtml(d, dobFmt, fullName, num, today, bgUrl);
    const docxBuffer  = buildDocx(d, dobFmt, fullName, num, today);

    if (d.email && process.env.RESEND_API_KEY) {
      const resend = new Resend(process.env.RESEND_API_KEY);
      await resend.emails.send({
        from: 'BirthCert Translation <onboarding@resend.dev>',
        to: d.email,
        subject: `Перевод свидетельства о рождении — ${fullName} (№ ${num})`,
        html: buildEmailHtml(fullName, num),
        attachments: [
          {
            filename: `Перевод_${fullName}_${num}.docx`,
            content: docxBuffer.toString('base64'),
          },
          {
            filename: `Перевод_с_бланком_${fullName}_${num}.html`,
            content: Buffer.from(overlayHtml, 'utf-8').toString('base64'),
          }
        ]
      });
    }

    return res.status(200).json({
      ok: true,
      translationText: buildPlainText(d, dobFmt, fullName, num, today),
      orderNum: num,
      docxBase64: docxBuffer.toString('base64'),
      pdfHtml: overlayHtml,
    });

  } catch (err) {
    console.error('Translate error:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}

// ─── HTML: текст поверх бланка ────────────────────────────
// Бланк bg.jpg пропорции ~794x1123px (A4)
// Все позиции в % от размера бланка
function buildOverlayHtml(d, dobFmt, fullName, num, today, bgUrl) {
  const v = (val) => val || '';

  // Штрих-код: номер запроса в формате *XXXXXXXX* (Code 39 шрифт имитируется жирным моноширинным)
  const barcodeVal = v(d.reqNum) || num;
  const barcodeText = '*' + barcodeVal + '*';

  // Точные координаты с редактора (size 24px ≈ 12.4pt при 150dpi)
  const fields = [
    { top:14.9, left:29.2, size:16, val: v(d.stateRegNum)      },
    { top:14.7, left:63.4, size:16, val: v(d.dateIssued)        },
    { top:16.7, left:63.4, size:16, val: v(d.dateRegistered)    },
    { top:21.6, left:34.1, size:16, val: fullName               },
    { top:26.5, left:34.0, size:16, val: dobFmt                 },
    { top:26.7, left:79.4, size:16, val: v(d.timeOfBirth)       },
    { top:30.7, left:33.9, size:16, val: v(d.sex)               },
    { top:30.8, left:71.6, size:16, val: v(d.weight)            },
    { top:34.3, left:33.8, size:16, val: v(d.hospital)          },
    { top:38.1, left:33.9, size:16, val: v(d.cityCounty)        },
    { top:49.1, left:33.6, size:16, val: v(d.motherName)        },
    { top:52.8, left:33.5, size:16, val: v(d.motherDob)         },
    { top:56.0, left:33.3, size:16, val: v(d.motherBirthPlace)  },
    { top:65.1, left:33.9, size:16, val: v(d.fatherName)        },
    { top:69.7, left:34.0, size:16, val: v(d.fatherDob)         },
    { top:73.3, left:34.1, size:16, val: v(d.fatherBirthPlace)  },
    { top:84.4, left:75.6, size:16, val: barcodeVal             },
    { top:96.6, left:17.9, size:16, val: barcodeText },
  ];

  const fieldHtml = fields.map(f => `
    <div style="
      position:absolute;
      top:${f.top}%;
      left:${f.left}%;
      font-size:${f.size}px;
      font-weight:700;
      color:#000000;
      font-family:'Times New Roman', Times, serif;
      white-space:nowrap;
      line-height:1;
    ">${f.val}</div>
  `).join('');

  return `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<title>Перевод — ${fullName}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body {
    background: #888;
    display: flex;
    justify-content: center;
    align-items: flex-start;
    min-height: 100vh;
    padding: 20px;
  }
  .page {
    position: relative;
    width: 794px;
    height: 1123px;
    flex-shrink: 0;
    box-shadow: 0 8px 40px rgba(0,0,0,0.4);
  }
  .bg {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: fill;
    display: block;
  }
  .fields {
    position: absolute;
    inset: 0;
  }
  @media print {
    body { background: white; padding: 0; margin: 0; }
    .page { box-shadow: none; width: 100vw; height: 100vh; }
    .bg { width: 100%; height: 100%; }
  }
</style>
</head>
<body>
<div class="page">
  <img class="bg" src="${bgUrl}" alt="бланк">
  <div class="fields">
    ${fieldHtml}
  </div>
</div>
<div style="margin-top:16px;text-align:center;color:white;font-family:Arial,sans-serif;font-size:13px">
  Для печати: Ctrl+P → убрать галочку "Колонтитулы" → масштаб 100% → печать
</div>
</body>
</html>`;
}

// ─── PLAIN TEXT (для предпросмотра) ──────────────────────
function buildPlainText(d, dobFmt, fullName, num, today) {
  return `ШТАТ ФЛОРИДА
БЮРО ЗАПИСИ АКТОВ ГРАЖДАНСКОГО СОСТОЯНИЯ
СВИДЕТЕЛЬСТВО О РОЖДЕНИИ
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
НОМЕР РЕГИСТРАЦИИ В ШТАТЕ: ${d.stateRegNum || '—'}
ДАТА ВЫДАЧИ: ${d.dateIssued || '—'}
ДАТА РЕГИСТРАЦИИ: ${d.dateRegistered || '—'}

ИНФОРМАЦИЯ О РЕБЁНКЕ
ИМЯ: ${fullName}
ДАТА РОЖДЕНИЯ: ${dobFmt}   ВРЕМЯ РОЖДЕНИЯ (24 ЧАСА): ${d.timeOfBirth || '—'}
ПОЛ: ${d.sex || '—'}   ВЕС ПРИ РОЖДЕНИИ: ${d.weight || '—'}
МЕСТО РОЖДЕНИЯ: ${d.hospital || '—'}
ГОРОД, ОКРУГ РОЖДЕНИЯ: ${d.cityCounty || '—'}

ИНФОРМАЦИЯ О МАТЕРИ/РОДИТЕЛЕ
ИМЯ: ${d.motherName || '—'}
ДАТА РОЖДЕНИЯ: ${d.motherDob || '—'}
МЕСТО РОЖДЕНИЯ: ${d.motherBirthPlace || '—'}

ИНФОРМАЦИЯ ОБ ОТЦЕ/РОДИТЕЛЕ
ИМЯ: ${d.fatherName || '—'}
ДАТА РОЖДЕНИЯ: ${d.fatherDob || '—'}
МЕСТО РОЖДЕНИЯ: ${d.fatherBirthPlace || '—'}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Перевод № ${num} от ${today}
BirthCert Translation Services`;
}

// ─── DOCX: заполненный бланк в Word-таблице ──────────────
function buildDocx(d, dobFmt, fullName, num, today) {

  function row(label, value, bold = false) {
    const val = value || '—';
    return `<w:tr>
      <w:tc>
        <w:tcPr><w:tcW w:w="3200" w:type="dxa"/>
          <w:shd w:val="clear" w:color="auto" w:fill="F5F5F0"/>
        </w:tcPr>
        <w:p><w:r><w:rPr>
          <w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/>
          <w:sz w:val="20"/><w:szCs w:val="20"/>
          <w:color w:val="444444"/>
        </w:rPr><w:t>${esc(label)}</w:t></w:r></w:p>
      </w:tc>
      <w:tc>
        <w:tcPr><w:tcW w:w="5600" w:type="dxa"/></w:tcPr>
        <w:p><w:r><w:rPr>
          <w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/>
          <w:sz w:val="22"/><w:szCs w:val="22"/>
          ${bold ? '<w:b/>' : ''}
          <w:color w:val="8B0000"/>
        </w:rPr><w:t>${esc(val)}</w:t></w:r></w:p>
      </w:tc>
    </w:tr>`;
  }

  function section(title) {
    return `<w:tr>
      <w:tc><w:tcPr>
        <w:tcW w:w="8800" w:type="dxa"/>
        <w:gridSpan w:val="2"/>
        <w:shd w:val="clear" w:color="auto" w:fill="1a3266"/>
      </w:tcPr>
      <w:p><w:r><w:rPr>
        <w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/>
        <w:b/><w:sz w:val="22"/><w:szCs w:val="22"/>
        <w:color w:val="FFFFFF"/>
      </w:rPr><w:t>${esc(title)}</w:t></w:r></w:p>
      </w:tc>
    </w:tr>`;
  }

  function esc(s) {
    return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  const docXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
            xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<w:body>

  <!-- Заголовок -->
  <w:p><w:pPr><w:jc w:val="center"/><w:spacing w:before="0" w:after="80"/></w:pPr>
    <w:r><w:rPr><w:b/><w:sz w:val="14"/><w:color w:val="1a3266"/>
      <w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/>
    </w:rPr><w:t>ШТАТ ФЛОРИДА</w:t></w:r>
  </w:p>
  <w:p><w:pPr><w:jc w:val="center"/><w:spacing w:before="0" w:after="40"/></w:pPr>
    <w:r><w:rPr><w:sz w:val="18"/><w:color w:val="333333"/>
      <w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/>
    </w:rPr><w:t>БЮРО ЗАПИСИ АКТОВ ГРАЖДАНСКОГО СОСТОЯНИЯ</w:t></w:r>
  </w:p>
  <w:p><w:pPr><w:jc w:val="center"/><w:spacing w:before="0" w:after="120"/></w:pPr>
    <w:r><w:rPr><w:b/><w:sz w:val="28"/><w:color w:val="1a3266"/>
      <w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/>
    </w:rPr><w:t>СВИДЕТЕЛЬСТВО О РОЖДЕНИИ</w:t></w:r>
  </w:p>
  <w:p><w:pPr><w:jc w:val="center"/><w:spacing w:before="0" w:after="160"/></w:pPr>
    <w:r><w:rPr><w:i/><w:sz w:val="18"/><w:color w:val="666666"/>
      <w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/>
    </w:rPr><w:t>Перевод с английского языка на русский язык</w:t></w:r>
  </w:p>

  <!-- Таблица с данными -->
  <w:tbl>
    <w:tblPr>
      <w:tblW w:w="8800" w:type="dxa"/>
      <w:tblBorders>
        <w:top w:val="single" w:sz="4" w:color="C8A84B"/>
        <w:bottom w:val="single" w:sz="4" w:color="C8A84B"/>
        <w:insideH w:val="single" w:sz="2" w:color="DDDDDD"/>
      </w:tblBorders>
      <w:tblCellMar>
        <w:top w:w="80" w:type="dxa"/>
        <w:left w:w="140" w:type="dxa"/>
        <w:bottom w:w="80" w:type="dxa"/>
        <w:right w:w="140" w:type="dxa"/>
      </w:tblCellMar>
    </w:tblPr>
    <w:tblGrid>
      <w:gridCol w:w="3200"/>
      <w:gridCol w:w="5600"/>
    </w:tblGrid>

    ${section('РЕКВИЗИТЫ ДОКУМЕНТА')}
    ${row('Номер регистрации в штате', d.stateRegNum, true)}
    ${row('Дата выдачи', d.dateIssued, true)}
    ${row('Дата регистрации', d.dateRegistered, true)}

    ${section('ИНФОРМАЦИЯ О РЕБЁНКЕ')}
    ${row('Имя', fullName, true)}
    ${row('Дата рождения', dobFmt, true)}
    ${row('Время рождения (24 ч)', d.timeOfBirth, true)}
    ${row('Пол', d.sex, true)}
    ${row('Вес при рождении', d.weight, true)}
    ${row('Место рождения (больница)', d.hospital, true)}
    ${row('Город, округ рождения', d.cityCounty, true)}

    ${section('ИНФОРМАЦИЯ О МАТЕРИ / РОДИТЕЛЕ')}
    ${row('ФИО (имя до первого брака)', d.motherName, true)}
    ${row('Дата рождения', d.motherDob, true)}
    ${row('Место рождения', d.motherBirthPlace, true)}

    ${section('ИНФОРМАЦИЯ ОБ ОТЦЕ / РОДИТЕЛЕ')}
    ${row('ФИО (имя до первого брака)', d.fatherName, true)}
    ${row('Дата рождения', d.fatherDob, true)}
    ${row('Место рождения', d.fatherBirthPlace, true)}

  </w:tbl>

  <!-- Удостоверение -->
  <w:p><w:pPr><w:spacing w:before="240" w:after="80"/></w:pPr></w:p>
  <w:p><w:pPr><w:spacing w:before="0" w:after="60"/></w:pPr>
    <w:r><w:rPr><w:b/><w:sz w:val="22"/><w:color w:val="1a3266"/>
      <w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/>
    </w:rPr><w:t>УДОСТОВЕРЕНИЕ ПЕРЕВОДА</w:t></w:r>
  </w:p>
  <w:p><w:pPr><w:spacing w:before="0" w:after="60"/></w:pPr>
    <w:r><w:rPr><w:sz w:val="20"/>
      <w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/>
    </w:rPr><w:t xml:space="preserve">Я, нижеподписавшийся(аяся), сертифицированный переводчик с английского языка на русский язык, настоящим удостоверяю, что данный перевод является точным и полным переводом оригинального документа — свидетельства о рождении, выданного компетентным органом штата Флорида, США. Перевод выполнен в соответствии с требованиями Консульства Российской Федерации в США.</w:t></w:r>
  </w:p>
  <w:p><w:pPr><w:spacing w:before="120" w:after="60"/></w:pPr>
    <w:r><w:rPr><w:sz w:val="20"/>
      <w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/>
    </w:rPr><w:t xml:space="preserve">Переводчик: _______________________________    Дата: ${esc(today)}    № ${esc(num)}</w:t></w:r>
  </w:p>
  <w:p><w:pPr><w:spacing w:before="0" w:after="60"/></w:pPr>
    <w:r><w:rPr><w:sz w:val="18"/><w:color w:val="666666"/>
      <w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/>
    </w:rPr><w:t>Печать: BirthCert Translation Services · birthcert-translation.com</w:t></w:r>
  </w:p>

  <w:sectPr>
    <w:pgSz w:w="11906" w:h="16838"/>
    <w:pgMar w:top="720" w:right="720" w:bottom="720" w:left="1080"/>
  </w:sectPr>
</w:body>
</w:document>`;

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
    { name: '[Content_Types].xml',          data: contentTypes },
    { name: '_rels/.rels',                  data: rootRels },
    { name: 'word/document.xml',            data: docXml },
    { name: 'word/_rels/document.xml.rels', data: relsXml },
    { name: 'word/styles.xml',              data: stylesXml },
  ]);
}

// ─── EMAIL HTML ───────────────────────────────────────────
function buildEmailHtml(fullName, num) {
  return `
<div style="font-family:Arial,sans-serif;max-width:580px;margin:0 auto;border-radius:14px;overflow:hidden">
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
      <p style="margin:0 0 10px;color:#0e1c36;font-weight:600">📎 Вложения:</p>
      <p style="margin:0 0 8px;font-size:14px">
        📝 <strong>Перевод_${fullName}_${num}.docx</strong><br>
        <span style="color:#5a6b90;font-size:12px">Открыть в Microsoft Word — таблица с переведёнными данными</span>
      </p>
      <p style="margin:0;font-size:14px">
        🎨 <strong>Перевод_с_бланком_${fullName}_${num}.html</strong><br>
        <span style="color:#5a6b90;font-size:12px">Открыть в браузере — данные поверх официального бланка Флориды</span>
      </p>
    </div>
    <div style="background:#fff8e6;border-left:3px solid #c8a84b;padding:12px 16px;border-radius:0 8px 8px 0;margin-bottom:16px">
      <p style="margin:0;color:#7a5a00;font-size:13px">
        🖨️ Для подачи в консульство: откройте <strong>HTML файл</strong> в браузере →
        <strong>Ctrl+P</strong> → масштаб 100% → убрать колонтитулы → печатать
      </p>
    </div>
    <p style="color:#aab0c8;font-size:12px;margin:0">
      № перевода: <strong style="color:#5a6b90">${num}</strong> &nbsp;·&nbsp;
      © BirthCert Translation
    </p>
  </div>
</div>`;
}

// ─── ZIP BUILDER ──────────────────────────────────────────
function buildZip(files) {
  const lp = [], cp = [];
  let offset = 0;
  for (const f of files) {
    const name = Buffer.from(f.name, 'utf-8');
    const data = Buffer.from(f.data, 'utf-8');
    const crc  = crc32(data);
    const lh   = Buffer.alloc(30 + name.length);
    lh.writeUInt32LE(0x04034b50,0); lh.writeUInt16LE(20,4);
    lh.writeUInt16LE(0,6); lh.writeUInt16LE(0,8);
    lh.writeUInt16LE(0,10); lh.writeUInt16LE(0,12);
    lh.writeUInt32LE(crc,14); lh.writeUInt32LE(data.length,18);
    lh.writeUInt32LE(data.length,22); lh.writeUInt16LE(name.length,26);
    lh.writeUInt16LE(0,28); name.copy(lh,30);
    lp.push(lh, data);
    const ch = Buffer.alloc(46 + name.length);
    ch.writeUInt32LE(0x02014b50,0); ch.writeUInt16LE(20,4);
    ch.writeUInt16LE(20,6); ch.writeUInt16LE(0,8);
    ch.writeUInt16LE(0,10); ch.writeUInt16LE(0,12);
    ch.writeUInt16LE(0,14); ch.writeUInt32LE(crc,16);
    ch.writeUInt32LE(data.length,20); ch.writeUInt32LE(data.length,24);
    ch.writeUInt16LE(name.length,28); ch.writeUInt16LE(0,30);
    ch.writeUInt16LE(0,32); ch.writeUInt16LE(0,34);
    ch.writeUInt16LE(0,36); ch.writeUInt32LE(0,38);
    ch.writeUInt32LE(offset,42); name.copy(ch,46);
    cp.push(ch);
    offset += 30 + name.length + data.length;
  }
  const cd  = Buffer.concat(cp);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50,0); end.writeUInt16LE(0,4);
  end.writeUInt16LE(0,6); end.writeUInt16LE(files.length,8);
  end.writeUInt16LE(files.length,10); end.writeUInt32LE(cd.length,12);
  end.writeUInt32LE(offset,16); end.writeUInt16LE(0,20);
  return Buffer.concat([...lp, cd, end]);
}

function crc32(buf) {
  const t = new Uint32Array(256);
  for (let i=0;i<256;i++){let c=i;for(let j=0;j<8;j++)c=(c&1)?(0xEDB88320^(c>>>1)):(c>>>1);t[i]=c;}
  let crc=0xFFFFFFFF;
  for (let i=0;i<buf.length;i++) crc=(crc>>>8)^t[(crc^buf[i])&0xFF];
  return (crc^0xFFFFFFFF)>>>0;
}
