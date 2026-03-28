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
  { id:'hospitalLine2',    top:36.2, left:33.6, size:16 },
  { id:'cityCounty',       top:38.1, left:33.7, size:16 },
  { id:'motherName',       top:49.0, left:33.5, size:16 },
  { id:'motherDob',        top:52.9, left:33.5, size:16 },
  { id:'motherBirthPlace', top:56.1, left:33.4, size:16 },
  { id:'fatherName',       top:65.2, left:33.4, size:16 },
  { id:'fatherDob',        top:69.7, left:33.4, size:16 },
  { id:'fatherBirthPlace', top:73.2, left:33.5, size:16 },
  { id:'reqNum',           top:84.6, left:75.1, size:16 },
  { id:'barcode',          top:96.6, left:27.9, size:14 },
];

// ── ПЕРЕВОД ИМЁН (для случая когда OCR не перевёл) ──────
const NAMES_DICT = {
  'mark':'МАРК','alekseevich':'АЛЕКСЕЕВИЧ','kirzov':'КИРЗОВ',
  'aleksei':'АЛЕКСЕЙ','aleksey':'АЛЕКСЕЙ','alexei':'АЛЕКСЕЙ','alexey':'АЛЕКСЕЙ',
  'ekaterina':'ЕКАТЕРИНА','katerina':'ЕКАТЕРИНА','olegovna':'ОЛЕГОВНА',
  'golod':'ГОЛОД','leonidovich':'ЛЕОНИДОВИЧ','leonidovna':'ЛЕОНИДОВНА',
  'alexander':'АЛЕКСАНДР','alexandra':'АЛЕКСАНДРА',
  'mikhail':'МИХАИЛ','mikhailovich':'МИХАЙЛОВИЧ','mikhailovna':'МИХАЙЛОВНА',
  'sergei':'СЕРГЕЙ','sergey':'СЕРГЕЙ','sergeevich':'СЕРГЕЕВИЧ','sergeevna':'СЕРГЕЕВНА',
  'ivan':'ИВАН','ivanovich':'ИВАНОВИЧ','ivanova':'ИВАНОВА','ivanov':'ИВАНОВ','ivanovna':'ИВАНОВНА',
  'anna':'АННА','dmitry':'ДМИТРИЙ','dmitri':'ДМИТРИЙ','dmitrievich':'ДМИТРИЕВИЧ','dmitrievna':'ДМИТРИЕВНА',
  'nikolai':'НИКОЛАЙ','nikolaevich':'НИКОЛАЕВИЧ','nikolaevna':'НИКОЛАЕВНА',
  'natalia':'НАТАЛЬЯ','natalya':'НАТАЛЬЯ','vladimir':'ВЛАДИМИР','vladimirovich':'ВЛАДИМИРОВИЧ',
  'andrei':'АНДРЕЙ','andreevich':'АНДРЕЕВИЧ','elena':'ЕЛЕНА',
  'evgeny':'ЕВГЕНИЙ','evgenia':'ЕВГЕНИЯ','petr':'ПЁТР','peter':'ПЁТР','petrovich':'ПЕТРОВИЧ',
  'yuri':'ЮРИЙ','yurii':'ЮРИЙ','yurevich':'ЮРЬЕВИЧ','tatiana':'ТАТЬЯНА','olga':'ОЛЬГА',
  'maxim':'МАКСИМ','roman':'РОМАН','pavel':'ПАВЕЛ','artem':'АРТЁМ',
  'maria':'МАРИЯ','marina':'МАРИНА','galina':'ГАЛИНА','irina':'ИРИНА',
  'svetlana':'СВЕТЛАНА','valentina':'ВАЛЕНТИНА','victoria':'ВИКТОРИЯ',
  'konstantin':'КОНСТАНТИН','konstantinovich':'КОНСТАНТИНОВИЧ',
  'leonid':'ЛЕОНИД','vadim':'ВАДИМ','viktor':'ВИКТОР','viktorovich':'ВИКТОРОВИЧ',
  'boris':'БОРИС','borisovich':'БОРИСОВИЧ','igor':'ИГОРЬ','igorevich':'ИГОРЕВИЧ',
  'oleg':'ОЛЕГ','olegovich':'ОЛЕГОВИЧ','gennady':'ГЕННАДИЙ','anatoly':'АНАТОЛИЙ',
};

function translateNamePart(str) {
  if (!str) return '';
  // Если уже русское — вернуть заглавными
  if (/[а-яёА-ЯЁ]/.test(str)) return str.toUpperCase();
  return str.split(' ').map(word => {
    const key = word.toLowerCase().replace(/[^a-z]/g, '');
    if (NAMES_DICT[key]) return NAMES_DICT[key];
    // Транслит
    const pairs = [
      ['shch','щ'],['sch','щ'],['zh','ж'],['kh','х'],['ts','ц'],
      ['ch','ч'],['sh','ш'],['yu','ю'],['ya','я'],['yo','ё'],
      ['a','а'],['b','б'],['c','к'],['d','д'],['e','е'],['f','ф'],['g','г'],
      ['h','х'],['i','и'],['j','й'],['k','к'],['l','л'],['m','м'],['n','н'],
      ['o','о'],['p','п'],['r','р'],['s','с'],['t','т'],['u','у'],
      ['v','в'],['w','в'],['x','кс'],['y','й'],['z','з'],
    ];
    let r = '', i = 0, w = word.toLowerCase();
    while (i < w.length) {
      let matched = false;
      for (const [en,ru] of pairs) {
        if (w.startsWith(en,i)) { r+=ru; i+=en.length; matched=true; break; }
      }
      if (!matched) { r+=w[i]; i++; }
    }
    return (r.charAt(0).toUpperCase()+r.slice(1)).toUpperCase();
  }).join(' ');
}

function translateCityCounty(str) {
  if (!str) return '';
  const up = str.toUpperCase().trim();
  // Уже русское
  if (/[А-ЯЁ]{3,}/.test(up)) return up;

  const CITIES = {
    'ST PETERSBURG':'Г. САНКТ-ПЕТЕРБУРГ','ST. PETERSBURG':'Г. САНКТ-ПЕТЕРБУРГ',
    'SAINT PETERSBURG':'Г. САНКТ-ПЕТЕРБУРГ',
    'MIAMI':'Г. МАЙАМИ','ORLANDO':'Г. ОРЛАНДО','TAMPA':'Г. ТАМПА',
    'JACKSONVILLE':'Г. ДЖЭКСОНВИЛЛ','CLEARWATER':'Г. КЛИРУОТЕР',
    'FORT LAUDERDALE':'Г. ФОРТ-ЛОДЕРДЕЙЛ','TALLAHASSEE':'Г. ТАЛЛАХАССИ',
    'GAINESVILLE':'Г. ГЕЙНСВИЛЛ','PENSACOLA':'Г. ПЕНСАКОЛА',
    'NAPLES':'Г. НЕАПОЛЬ','SARASOTA':'Г. САРАСОТА',
    'HIALEAH':'Г. ХАЙАЛИА','CAPE CORAL':'Г. КЕЙП-КОРАЛ',
  };
  const COUNTIES = {
    'PINELLAS COUNTY':'ОКРУГ ПИНЕЛЛАС','HILLSBOROUGH COUNTY':'ОКРУГ ХИЛЛСБОРО',
    'ORANGE COUNTY':'ОКРУГ ОРИНДЖ','MIAMI-DADE COUNTY':'ОКРУГ МАЙАМИ-ДЕЙД',
    'BROWARD COUNTY':'ОКРУГ БРОУАРД','PALM BEACH COUNTY':'ОКРУГ ПАЛМ-БИЧ',
    'DUVAL COUNTY':'ОКРУГ ДЮВАЛЬ','LEE COUNTY':'ОКРУГ ЛИ',
    'POLK COUNTY':'ОКРУГ ПОЛК','VOLUSIA COUNTY':'ОКРУГ ВОЛУША',
    'SARASOTA COUNTY':'ОКРУГ САРАСОТА','MANATEE COUNTY':'ОКРУГ МАНАТИ',
    'COLLIER COUNTY':'ОКРУГ КОЛЬЕ','BREVARD COUNTY':'ОКРУГ БРЕВАРД',
    'SEMINOLE COUNTY':'ОКРУГ СЕМИНОЛ','PINELLAS':'ОКРУГ ПИНЕЛЛАС',
    'HILLSBOROUGH':'ОКРУГ ХИЛЛСБОРО','ORANGE':'ОКРУГ ОРИНДЖ',
  };

  let result = up;
  // Заменяем города
  for (const [en, ru] of Object.entries(CITIES)) {
    result = result.replace(new RegExp('\\b' + en + '\\b', 'g'), ru);
  }
  // Заменяем округа
  for (const [en, ru] of Object.entries(COUNTIES)) {
    result = result.replace(new RegExp('\\b' + en + '\\b', 'g'), ru);
  }
  // Если осталось COUNTY — общий перевод
  result = result.replace(/\bCOUNTY\b/g, 'ОКРУГ');
  return result.replace(/\s+/g, ' ').trim();
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  try {
    const d = req.body;
    console.log('TRANSLATE INPUT:', JSON.stringify({
      childName: d.childName,
      firstName: d.firstName,
      lastName: d.lastName,
      middleName: d.middleName,
      fatherName: d.fatherName,
      motherName: d.motherName,
    }));
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

    // childName — приходит уже переведённым из OCR
    // Если пустой — собираем из компонентов и переводим
    const rawLast  = d.lastName  || '';
    const rawFirst = d.firstName || '';
    const rawMid   = d.middleName || '';
    const childName = d.childName ||
      [translateNamePart(rawLast), translateNamePart(rawFirst), translateNamePart(rawMid)]
      .filter(Boolean).join(' ') || '';

    // МЕСТО РОЖДЕНИЯ — две строки:
    // Строка 1: из поля hospitalType (БОЛЬНИЦА / МЕДИЦИНСКИЙ ЦЕНТР / РОДДОМ)
    // Строка 2: название госпиталя + город
    const hospitalRaw  = (d.hospital     || '').toUpperCase().trim();
    const hospitalType = (d.hospitalType || 'БОЛЬНИЦА').toUpperCase().trim();

    const hospitalLine1 = hospitalType;

    const hospitalLine2 = hospitalRaw
      .replace(/\bMEDICAL\s+CENT(?:ER|RE)\b/gi, '')
      .replace(/\bHOSPITAL\b/gi, '')
      .replace(/\bST\.?\s*PETERSBURG\b/gi, 'Г. САНКТ-ПЕТЕРБУРГ')
      .replace(/\bSAINT\s+PETERSBURG\b/gi, 'Г. САНКТ-ПЕТЕРБУРГ')
      .replace(/\s+/g, ' ').trim();

    const values = {
      stateRegNum:      d.stateRegNum || '',
      dateIssued:       d.dateIssued || '',
      dateRegistered:   d.dateRegistered || '',
      childName:        childName,
      dobFormatted:     dobFormatted,
      timeOfBirth:      d.timeOfBirth || '',
      sex:              d.sex || '',
      weight:           d.weight || '',
      hospital:         hospitalLine1,
      hospitalLine2:    hospitalLine2,
      cityCounty:       (d.cityCounty || '').toUpperCase(),
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
    const styledHtml = await buildHtml(values, bgUrl, num, today);
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
      _debug: { childName: d.childName, firstName: d.firstName, lastName: d.lastName, fatherName: d.fatherName },
    });

  } catch (err) {
    console.error('Translate error:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}

// ── HTML С БЛАНКОМ ───────────────────────────────────────
async function buildHtml(v, bgUrl, num, today) {
  // Загружаем фон как base64 чтобы работало в любом окне
  let bgData = bgUrl;
  try {
    const resp = await fetch(bgUrl);
    const buf = await resp.arrayBuffer();
    const b64 = Buffer.from(buf).toString('base64');
    const mime = resp.headers.get('content-type') || 'image/jpeg';
    bgData = `data:${mime};base64,${b64}`;
  } catch(e) {
    console.error('Could not embed bg:', e.message);
    // fallback to URL
  }

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
/* Экранный вид */
body{background:#666;display:flex;flex-direction:column;align-items:center;padding:20px;gap:20px;font-family:'Times New Roman',Times,serif}
.sheet{background:white;box-shadow:0 4px 20px rgba(0,0,0,.3)}
/* Лист 1 — бланк */
.sheet-blank{position:relative;width:794px}
.sheet-blank img{display:block;width:794px;height:auto}
.fields{position:absolute;inset:0}
/* Лист 2 — удостоверение */
.sheet-cert{width:794px;min-height:1123px;padding:60px 70px;display:flex;flex-direction:column}
.cert-title{text-align:center;font-size:16px;font-weight:bold;color:#0c1b3a;letter-spacing:1px;margin-bottom:30px;padding-bottom:14px;border-bottom:2px solid #c8a84b}
.cert-body{font-size:13px;line-height:2;color:#222;margin-bottom:30px;flex:1}
.cert-sign{display:flex;justify-content:space-between;margin-top:40px;padding-top:16px;border-top:1px dashed #c8a84b}
.cert-sign-item{text-align:center;font-size:12px;color:#444}
.cert-sign-line{border-bottom:1.5px solid #000;width:160px;margin:0 auto 6px}
.cert-footer{margin-top:auto;padding-top:20px;border-top:1px solid #ddd;text-align:center;font-size:11px;color:#888}
.hint{color:white;font-size:12px;text-align:center}
/* Печать — два листа А4 */
@media print{
  body{background:white;padding:0;gap:0}
  .sheet{box-shadow:none;page-break-after:always}
  .sheet-blank{width:210mm;height:297mm;overflow:hidden}
  .sheet-blank img{width:210mm;height:297mm;object-fit:fill}
  .sheet-cert{width:210mm;min-height:297mm;padding:20mm 20mm}
  .hint{display:none}
}
</style></head>
<body>
<!-- ЛИСТ 1: БЛАНК -->
<div class="sheet sheet-blank">
  <img src="${bgData}" alt="бланк свидетельства о рождении">
  <div class="fields">${fieldsHtml}</div>
</div>

<!-- ЛИСТ 2: УДОСТОВЕРЕНИЕ ПЕРЕВОДА -->
<div class="sheet sheet-cert">
  <div class="cert-title">УДОСТОВЕРЕНИЕ ПЕРЕВОДА</div>
  <div class="cert-body">
    <p style="margin-bottom:16px">Я, нижеподписавшийся(аяся), сертифицированный переводчик с английского языка на русский язык, настоящим удостоверяю, что данный перевод является точным и полным переводом оригинального документа — свидетельства о рождении, выданного компетентным органом штата Флорида, США.</p>
    <p style="margin-bottom:16px">Перевод выполнен в соответствии с требованиями Консульства Российской Федерации в США.</p>
    <p>Настоящим подтверждаю, что являюсь компетентным переводчиком русского и английского языков и данный перевод соответствует оригиналу документа.</p>
  </div>
  <div class="cert-sign">
    <div class="cert-sign-item">
      <div class="cert-sign-line"></div>
      Подпись переводчика
    </div>
    <div class="cert-sign-item">
      <div class="cert-sign-line"></div>
      Дата: ${today}
    </div>
    <div class="cert-sign-item">
      <div class="cert-sign-line"></div>
      № ${num}
    </div>
  </div>
  <div class="cert-footer">
    BirthCert Translation Services &nbsp;·&nbsp; Официальный перевод для Консульства РФ в США
  </div>
</div>

<p class="hint">Для печати: Ctrl+P → масштаб 100% → без колонтитулов → две страницы А4</p>
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
