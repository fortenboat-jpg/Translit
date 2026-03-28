import { Resend } from 'resend';

// ── ТОЧНЫЕ КООРДИНАТЫ ПОЛЕЙ НА БЛАНКЕ (из редактора пользователя) ────
const FIELDS = [
  { id:'stateRegNum',      top:15.0, left:30.1, size:16 },
  { id:'dateIssued',       top:14.7, left:62.9, size:16 },
  { id:'dateRegistered',   top:16.8, left:62.9, size:16 },
  { id:'childName',        top:21.6, left:33.6, size:16 },
  { id:'dobFormatted',     top:26.5, left:33.6, size:16 },
  { id:'timeOfBirth',      top:26.8, left:78.7, size:16 },
  { id:'sex',              top:30.8, left:33.6, size:16 },
  { id:'weight',           top:31.0, left:70.5, size:16 },
  { id:'hospital',         top:34.3, left:33.6, size:16 },
  { id:'cityCounty',       top:38.1, left:33.7, size:16 },
  { id:'motherName',       top:49.0, left:33.5, size:16 },
  { id:'motherDob',        top:52.9, left:33.5, size:16 },
  { id:'motherBirthPlace', top:56.1, left:33.4, size:16 },
  { id:'fatherName',       top:65.2, left:33.4, size:16 },
  { id:'fatherDob',        top:69.7, left:33.4, size:16 },
  { id:'fatherBirthPlace', top:73.2, left:33.5, size:16 },
  { id:'reqNum',           top:84.6, left:75.1, size:16 },
  { id:'barcode',          top:96.6, left:17.9, size:14 },
];

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  try {
    const d = req.body;
    const num = 'BC-' + Date.now().toString().slice(-6);
    const today = new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
    
    // Форматируем дату рождения
    const dobFormatted = d.dob
      ? (() => {
          const dt = new Date(d.dob + 'T12:00:00');
          const months = ['ЯНВАРЯ','ФЕВРАЛЯ','МАРТА','АПРЕЛЯ','МАЯ','ИЮНЯ',
                          'ИЮЛЯ','АВГУСТА','СЕНТЯБРЯ','ОКТЯБРЯ','НОЯБРЯ','ДЕКАБРЯ'];
          return `${String(dt.getDate()).padStart(2,'0')} ${months[dt.getMonth()]} ${dt.getFullYear()} г.`;
        })()
      : '';

    // Штрихкод
    const barcodeNum = (d.reqNum || '').replace(/[^0-9]/g, '');
    const barcodeText = barcodeNum ? '*' + barcodeNum + '*' : '';

    // Данные для подстановки в бланк
    // childName — собираем из компонентов если пришёл пустым
    const childName = d.childName ||
      [d.lastName, d.firstName, d.middleName].filter(Boolean).join(' ') || '';

    const values = {
      stateRegNum:      d.stateRegNum || '',
      dateIssued:       d.dateIssued || '',
      dateRegistered:   d.dateRegistered || '',
      childName:        childName,
      dobFormatted:     dobFormatted,
      timeOfBirth:      d.timeOfBirth || '',
      sex:              d.sex || '',
      weight:           d.weight || '',
      hospital:         d.hospital || '',
      cityCounty:       d.cityCounty || '',
      motherName:       d.motherName || '',
      motherDob:        d.motherDob || '',
      motherBirthPlace: d.motherBirthPlace || '',
      fatherName:       d.fatherName || '',
      fatherDob:        d.fatherDob || '',
      fatherBirthPlace: d.fatherBirthPlace || '',
      reqNum:           barcodeNum,
      barcode:          barcodeText,
    };

    const bgUrl = process.env.BACKGROUND_URL || 'https://translit-gilt.vercel.app/bg.jpg';
    const styledHtml = buildHtml(values, bgUrl, num, today);
    const docxBuffer = buildDocx(values, num, today);

    // Email
    if (d.email && process.env.RESEND_API_KEY) {
      const resend = new Resend(process.env.RESEND_API_KEY);
      await resend.emails.send({
        from: 'BirthCert Translation <onboarding@resend.dev>',
        to: d.email,
        subject: `Перевод свидетельства — ${d.childName} (№ ${num})`,
        html: buildEmail(d.childName, num),
        attachments: [
          { filename: `Перевод_${num}.docx`, content: docxBuffer.toString('base64') },
          { filename: `Перевод_бланк_${num}.html`, content: Buffer.from(styledHtml,'utf-8').toString('base64') },
        ]
      });
    }

    return res.status(200).json({
      ok: true,
      values,
      fields: FIELDS,
      bgUrl,
      pdfHtml: styledHtml,
      docxBase64: docxBuffer.toString('base64'),
      orderNum: num,
      translationText: buildPlainText(values, num, today),
    });

  } catch (err) {
    console.error('Translate error:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}

// ── HTML С БЛАНКОМ ───────────────────────────────────────
function buildHtml(v, bgUrl, num, today) {
  const fieldsHtml = FIELDS.map(f => {
    const val = v[f.id];
    if (!val) return '';
    return `<div style="position:absolute;top:${f.top}%;left:${f.left}%;font-size:${f.size}px;font-weight:700;color:#000;font-family:'Times New Roman',Times,serif;white-space:nowrap;line-height:1">${val}</div>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="ru"><head><meta charset="UTF-8">
<title>Перевод — ${v.childName}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#888;display:flex;flex-direction:column;align-items:center;padding:20px;font-family:Arial,sans-serif}
.page{position:relative;width:794px;flex-shrink:0;box-shadow:0 8px 40px rgba(0,0,0,.4)}
.page img{display:block;width:100%;height:auto}
.fields{position:absolute;inset:0}
.cert{background:white;width:794px;margin-top:20px;padding:30px;box-shadow:0 4px 20px rgba(0,0,0,.2)}
.cert h3{color:#0c1b3a;font-size:14px;text-align:center;border-bottom:2px solid #c8a84b;padding-bottom:10px;margin-bottom:16px}
.cert p{font-size:11px;color:#333;line-height:1.8;margin-bottom:6px}
.sign-row{display:flex;justify-content:space-between;margin-top:20px;padding-top:14px;border-top:1px dashed #c8a84b}
.sign-item{text-align:center;font-size:10px;color:#555}
.sign-line{border-bottom:1px solid #000;width:140px;margin:0 auto 4px}
@media print{body{background:white;padding:0}.page{box-shadow:none;width:100%}.cert{margin-top:0;padding:20px}}
</style></head>
<body>
<div class="page">
  <img src="${bgUrl}" alt="бланк свидетельства о рождении">
  <div class="fields">${fieldsHtml}</div>
</div>
<div class="cert">
  <h3>УДОСТОВЕРЕНИЕ ПЕРЕВОДА</h3>
  <p>Я, нижеподписавшийся(аяся), сертифицированный переводчик с английского языка на русский язык, настоящим удостоверяю, что данный перевод является точным и полным переводом оригинального документа — свидетельства о рождении, выданного компетентным органом штата Флорида, США.</p>
  <p>Перевод выполнен в соответствии с требованиями Консульства Российской Федерации в США.</p>
  <div class="sign-row">
    <div class="sign-item"><div class="sign-line"></div>Подпись переводчика</div>
    <div class="sign-item"><div class="sign-line"></div>Дата: ${today}</div>
    <div class="sign-item"><div class="sign-line"></div>№ ${num}</div>
  </div>
</div>
<p style="color:white;font-size:12px;margin-top:12px">Для печати: Ctrl+P → масштаб 100% → без колонтитулов</p>
</body></html>`;
}

// ── PLAIN TEXT ───────────────────────────────────────────
function buildPlainText(v, num, today) {
  return `ШТАТ ФЛОРИДА
БЮРО ЗАПИСИ АКТОВ ГРАЖДАНСКОГО СОСТОЯНИЯ
СВИДЕТЕЛЬСТВО О РОЖДЕНИИ
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
НОМЕР РЕГИСТРАЦИИ: ${v.stateRegNum}
ДАТА ВЫДАЧИ: ${v.dateIssued}
ДАТА РЕГИСТРАЦИИ: ${v.dateRegistered}

ИМЯ: ${v.childName}
ДАТА РОЖДЕНИЯ: ${v.dobFormatted}  ВРЕМЯ: ${v.timeOfBirth}
ПОЛ: ${v.sex}  ВЕС: ${v.weight}
МЕСТО РОЖДЕНИЯ: ${v.hospital}
ГОРОД, ОКРУГ: ${v.cityCounty}

МАТЬ: ${v.motherName}
ДАТА РОЖДЕНИЯ: ${v.motherDob}
МЕСТО РОЖДЕНИЯ: ${v.motherBirthPlace}

ОТЕЦ: ${v.fatherName}
ДАТА РОЖДЕНИЯ: ${v.fatherDob}
МЕСТО РОЖДЕНИЯ: ${v.fatherBirthPlace}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Перевод № ${num} от ${today}`;
}

// ── DOCX ─────────────────────────────────────────────────
function buildDocx(v, num, today) {
  function esc(s){return(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}
  function row(label,val){return`<w:tr>
    <w:tc><w:tcPr><w:tcW w:w="3500" w:type="dxa"/><w:shd w:val="clear" w:fill="F0F2F8"/></w:tcPr>
    <w:p><w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:sz w:val="20"/><w:color w:val="333355"/></w:rPr><w:t>${esc(label)}</w:t></w:r></w:p></w:tc>
    <w:tc><w:tcPr><w:tcW w:w="5300" w:type="dxa"/></w:tcPr>
    <w:p><w:r><w:rPr><w:b/><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:sz w:val="22"/></w:rPr><w:t>${esc(val||'—')}</w:t></w:r></w:p></w:tc>
  </w:tr>`}
  function sec(title){return`<w:tr>
    <w:tc><w:tcPr><w:tcW w:w="8800" w:type="dxa"/><w:gridSpan w:val="2"/><w:shd w:val="clear" w:fill="0C1B3A"/></w:tcPr>
    <w:p><w:r><w:rPr><w:b/><w:sz w:val="22"/><w:color w:val="FFFFFF"/><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/></w:rPr><w:t>${esc(title)}</w:t></w:r></w:p></w:tc>
  </w:tr>`}

  const docXml=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:body>
<w:p><w:pPr><w:jc w:val="center"/></w:pPr>
  <w:r><w:rPr><w:b/><w:sz w:val="32"/><w:color w:val="0C1B3A"/><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/></w:rPr>
  <w:t>СВИДЕТЕЛЬСТВО О РОЖДЕНИИ</w:t></w:r></w:p>
<w:p><w:pPr><w:jc w:val="center"/></w:pPr>
  <w:r><w:rPr><w:i/><w:sz w:val="18"/><w:color w:val="666666"/><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/></w:rPr>
  <w:t>Перевод с английского языка на русский язык | штат Флорида, США</w:t></w:r></w:p>
<w:p><w:r><w:t> </w:t></w:r></w:p>
<w:tbl>
  <w:tblPr>
    <w:tblW w:w="8800" w:type="dxa"/>
    <w:tblBorders>
      <w:top w:val="single" w:sz="6" w:color="C8A84B"/>
      <w:bottom w:val="single" w:sz="6" w:color="C8A84B"/>
      <w:insideH w:val="single" w:sz="2" w:color="CCCCCC"/>
    </w:tblBorders>
    <w:tblCellMar><w:top w:w="80" w:type="dxa"/><w:left w:w="120" w:type="dxa"/><w:bottom w:w="80" w:type="dxa"/><w:right w:w="120" w:type="dxa"/></w:tblCellMar>
  </w:tblPr>
  <w:tblGrid><w:gridCol w:w="3500"/><w:gridCol w:w="5300"/></w:tblGrid>
  ${sec('РЕКВИЗИТЫ')}
  ${row('Номер регистрации',v.stateRegNum)}
  ${row('Дата выдачи',v.dateIssued)}
  ${row('Дата регистрации',v.dateRegistered)}
  ${sec('ИНФОРМАЦИЯ О РЕБЁНКЕ')}
  ${row('ФИО',v.childName)}
  ${row('Дата рождения',v.dobFormatted)}
  ${row('Время рождения',v.timeOfBirth)}
  ${row('Пол',v.sex)}
  ${row('Вес при рождении',v.weight)}
  ${row('Место рождения',v.hospital)}
  ${row('Город, округ',v.cityCounty)}
  ${sec('ИНФОРМАЦИЯ О МАТЕРИ')}
  ${row('ФИО',v.motherName)}
  ${row('Дата рождения',v.motherDob)}
  ${row('Место рождения',v.motherBirthPlace)}
  ${sec('ИНФОРМАЦИЯ ОБ ОТЦЕ')}
  ${row('ФИО',v.fatherName)}
  ${row('Дата рождения',v.fatherDob)}
  ${row('Место рождения',v.fatherBirthPlace)}
</w:tbl>
<w:p><w:r><w:t> </w:t></w:r></w:p>
<w:p><w:r><w:rPr><w:b/><w:sz w:val="22"/><w:color w:val="0C1B3A"/><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/></w:rPr>
  <w:t>УДОСТОВЕРЕНИЕ ПЕРЕВОДА</w:t></w:r></w:p>
<w:p><w:r><w:rPr><w:sz w:val="20"/><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/></w:rPr>
  <w:t xml:space="preserve">Я, нижеподписавшийся(аяся), сертифицированный переводчик с английского языка на русский язык, настоящим удостоверяю, что данный перевод является точным и полным переводом оригинального документа.</w:t></w:r></w:p>
<w:p><w:r><w:rPr><w:sz w:val="20"/><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/></w:rPr>
  <w:t xml:space="preserve">Переводчик: _______________________   Дата: ${esc(today)}   № ${esc(num)}</w:t></w:r></w:p>
<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="720" w:right="720" w:bottom="720" w:left="1080"/></w:sectPr>
</w:body></w:document>`;

  const rels=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;
  const styles=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/><w:sz w:val="20"/></w:rPr></w:rPrDefault></w:docDefaults></w:styles>`;
  const ct=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>`;
  const rootRels=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`;

  return buildZip([
    {name:'[Content_Types].xml',data:ct},
    {name:'_rels/.rels',data:rootRels},
    {name:'word/document.xml',data:docXml},
    {name:'word/_rels/document.xml.rels',data:rels},
    {name:'word/styles.xml',data:styles},
  ]);
}

function buildEmail(name, num){return`<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto"><div style="background:#0c1b3a;padding:24px;text-align:center"><h2 style="color:white;margin:0">📄 BirthCert Translation</h2><p style="color:rgba(255,255,255,.6);margin:6px 0 0;font-size:13px">Официальный перевод для Консульства РФ</p></div><div style="background:#f4f6fb;padding:28px"><p style="color:#0e1c36;font-size:15px;margin:0 0 10px">Здравствуйте!</p><p style="color:#5a6b90;font-size:14px">Ваш перевод готов. К письму прикреплены 2 файла:</p><div style="background:white;border:1px solid #d4daf0;border-radius:8px;padding:14px;margin:16px 0"><p style="margin:0 0 6px;font-size:13px">📝 <strong>Перевод_${num}.docx</strong> — открыть в Word</p><p style="margin:0;font-size:13px">🎨 <strong>Перевод_бланк_${num}.html</strong> — данные на бланке → распечатать</p></div><div style="background:#fff8e6;border-left:3px solid #c8a84b;padding:10px 14px;border-radius:0 6px 6px 0"><p style="margin:0;color:#7a5a00;font-size:13px">🖨️ HTML файл: открыть в браузере → Ctrl+P → масштаб 100%</p></div><p style="color:#aab0c8;font-size:12px;margin-top:16px">№ ${num} · BirthCert Translation</p></div></div>`;}

function buildZip(files){
  const lp=[],cp=[];let offset=0;
  for(const f of files){
    const name=Buffer.from(f.name,'utf-8'),data=Buffer.from(f.data,'utf-8'),crc=crc32(data);
    const lh=Buffer.alloc(30+name.length);
    lh.writeUInt32LE(0x04034b50,0);lh.writeUInt16LE(20,4);lh.writeUInt16LE(0,6);lh.writeUInt16LE(0,8);
    lh.writeUInt16LE(0,10);lh.writeUInt16LE(0,12);lh.writeUInt32LE(crc,14);lh.writeUInt32LE(data.length,18);
    lh.writeUInt32LE(data.length,22);lh.writeUInt16LE(name.length,26);lh.writeUInt16LE(0,28);name.copy(lh,30);
    lp.push(lh,data);
    const ch=Buffer.alloc(46+name.length);
    ch.writeUInt32LE(0x02014b50,0);ch.writeUInt16LE(20,4);ch.writeUInt16LE(20,6);ch.writeUInt16LE(0,8);
    ch.writeUInt16LE(0,10);ch.writeUInt16LE(0,12);ch.writeUInt16LE(0,14);ch.writeUInt32LE(crc,16);
    ch.writeUInt32LE(data.length,20);ch.writeUInt32LE(data.length,24);ch.writeUInt16LE(name.length,28);
    ch.writeUInt16LE(0,30);ch.writeUInt16LE(0,32);ch.writeUInt16LE(0,34);ch.writeUInt16LE(0,36);
    ch.writeUInt32LE(0,38);ch.writeUInt32LE(offset,42);name.copy(ch,46);
    cp.push(ch);offset+=30+name.length+data.length;
  }
  const cd=Buffer.concat(cp),end=Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50,0);end.writeUInt16LE(0,4);end.writeUInt16LE(0,6);
  end.writeUInt16LE(files.length,8);end.writeUInt16LE(files.length,10);
  end.writeUInt32LE(cd.length,12);end.writeUInt32LE(offset,16);end.writeUInt16LE(0,20);
  return Buffer.concat([...lp,cd,end]);
}
function crc32(buf){const t=new Uint32Array(256);for(let i=0;i<256;i++){let c=i;for(let j=0;j<8;j++)c=(c&1)?(0xEDB88320^(c>>>1)):(c>>>1);t[i]=c;}let crc=0xFFFFFFFF;for(let i=0;i<buf.length;i++)crc=(crc>>>8)^t[(crc^buf[i])&0xFF];return(crc^0xFFFFFFFF)>>>0;}
