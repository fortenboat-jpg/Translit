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

// ── КООРДИНАТЫ ПОЛЕЙ ДЛЯ ВТОРОГО БЛАНКА (bg2.jpg) ──────
const FIELDS2 = [
  { id:'stateRegNum',      top:21.3, left:12.8, size:15 },
  { id:'dateIssued',       top:20.0, left:68.6, size:15 },
  { id:'dateRegistered',   top:21.6, left:73.6, size:15 },
  { id:'childName',        top:26.2, left:38.0, size:15 },
  { id:'dobFormatted',     top:28.7, left:37.7, size:15 },
  { id:'timeOfBirth',      top:28.8, left:84.8, size:15 },
  { id:'sex',              top:31.3, left:37.9, size:15 },
  { id:'weight',           top:31.4, left:76.6, size:15 },
  { id:'hospital',         top:33.7, left:37.7, size:15 },
  { id:'hospitalLine2',    top:35.5, left:37.6, size:15 },
  { id:'cityCounty',       top:37.6, left:37.5, size:15 },
  { id:'motherName',       top:44.5, left:37.8, size:15 },
  { id:'motherDob',        top:47.0, left:37.5, size:15 },
  { id:'motherBirthPlace', top:49.5, left:37.5, size:15 },
  { id:'fatherName',       top:57.5, left:37.9, size:15 },
  { id:'fatherDob',        top:60.1, left:37.9, size:15 },
  { id:'fatherBirthPlace', top:62.7, left:37.7, size:15 },
  { id:'reqNum',           top:65.6, left:71.1, size:15 },
  { id:'barcode',          top:86.1, left:42.7, size:11 },
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
  if (/[а-яёА-ЯЁ]/.test(str)) return str.toUpperCase();
  return str.split(' ').map(word => {
    const key = word.toLowerCase().replace(/[^a-z]/g, '');
    if (NAMES_DICT[key]) return NAMES_DICT[key];
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

// Словарь городов с ручным переводом
const CITY_DICT = {
  'ST PETERSBURG':'Г. САНКТ-ПЕТЕРБУРГ','ST. PETERSBURG':'Г. САНКТ-ПЕТЕРБУРГ',
  'SAINT PETERSBURG':'Г. САНКТ-ПЕТЕРБУРГ',
  'MIAMI':'Г. МАЙАМИ','ORLANDO':'Г. ОРЛАНДО','TAMPA':'Г. ТАМПА',
  'JACKSONVILLE':'Г. ДЖЭКСОНВИЛЛ','CLEARWATER':'Г. КЛИРУОТЕР',
  'FORT LAUDERDALE':'Г. ФОРТ-ЛОДЕРДЕЙЛ','TALLAHASSEE':'Г. ТАЛЛАХАССИ',
  'GAINESVILLE':'Г. ГЕЙНСВИЛЛ','PENSACOLA':'Г. ПЕНСАКОЛА',
  'NAPLES':'Г. НЕАПОЛЬ','SARASOTA':'Г. САРАСОТА','SARASAOTA':'Г. САРАСОТА',
  'FORT MYERS':'Г. ФОРТ-МАЙЕРС','CAPE CORAL':'Г. КЕЙП-КОРАЛ',
  'DAYTONA BEACH':'Г. ДАЙТОНА-БИЧ','BOCA RATON':'Г. БОКА-РАТОН',
  'HIALEAH':'Г. ХАЙАЛИА','WEST PALM BEACH':'Г. УЭСТ-ПАЛМ-БИЧ',
  'PALM BEACH':'Г. ПАЛМ-БИЧ','CORAL GABLES':'Г. КОРАЛ-ГЕЙБЛС',
  'POMPANO BEACH':'Г. ПОМПАНО-БИЧ','HOLLYWOOD':'Г. ГОЛЛИВУД',
  'KISSIMMEE':'Г. КИССИММИ','OCALA':'Г. ОКАЛА',
};

// Словарь округов с нестандартным переводом
const COUNTY_DICT = {
  'MIAMI-DADE':'МАЙАМИ-ДЕДИ',
  'PALM BEACH':'ПАЛМ-БИЧ',
  'ST JOHNS':'СТ. ДЖОНС','ST. JOHNS':'СТ. ДЖОНС','SAINT JOHNS':'СТ. ДЖОНС',
  'ORANGE':'ОРИНДЖ',
  'LEE':'ЛИ',
};

function autoTranslitWord(word) {
  const pairs = [
    ['shch','щ'],['sch','щ'],['zh','ж'],['kh','х'],['ph','ф'],['th','т'],
    ['ts','ц'],['ch','ч'],['sh','ш'],['qu','кв'],
    ['yu','ю'],['ya','я'],['yo','ё'],['ye','е'],['wr','р'],['wh','в'],
    ['a','а'],['b','б'],['c','к'],['d','д'],['e','е'],['f','ф'],['g','г'],
    ['h','х'],['i','и'],['j','дж'],['k','к'],['l','л'],['m','м'],['n','н'],
    ['o','о'],['p','п'],['q','к'],['r','р'],['s','с'],['t','т'],['u','у'],
    ['v','в'],['w','в'],['x','кс'],['y','й'],['z','з'],
  ];
  const w = word.toLowerCase().replace(/([bcdfghjklmnpqrstvwxz])y/g,'$1ей');
  let r='',i=0;
  while(i<w.length){
    let matched=false;
    for(const[en,ru]of pairs){if(w.startsWith(en,i)){r+=ru;i+=en.length;matched=true;break;}}
    if(!matched){r+=w[i];i++;}
  }
  return(r.charAt(0).toUpperCase()+r.slice(1)).toUpperCase();
}

function translateCityCounty(str) {
  if (!str) return '';
  if (/[А-ЯЁ]{3,}/.test(str)) return str.toUpperCase();
  let result = str.toUpperCase().trim();

  // 1. СНАЧАЛА округа — до замены городов!
  // Иначе MIAMI в MIAMI-DADE заменится на Г. МАЙАМИ и матч сломается
  result = result.replace(/\b([\w][\w\s-]*?)\s+COUNTY\b/g, (match, countyName) => {
    const key = countyName.trim();
    if (COUNTY_DICT[key]) return 'ОКРУГ ' + COUNTY_DICT[key];
    const translitted = key.split(/[\s-]/).map(w => w ? autoTranslitWord(w) : '').join('-').replace(/--+/g,'-');
    return 'ОКРУГ ' + translitted;
  });
  result = result.replace(/\bCOUNTY\b/g, 'ОКРУГ');

  // 2. ПОТОМ города из словаря (длинные первыми)
  const cityEntries = Object.entries(CITY_DICT).sort((a,b) => b[0].length - a[0].length);
  for (const [en, ru] of cityEntries) {
    result = result.replace(new RegExp('\\b' + en.replace(/[.*+?^${}()|[\]\\]/g,'\\$&') + '\\b', 'g'), ru);
  }

  // 3. Оставшиеся латинские слова (3+ букв) — автотранслит
  result = result.replace(/\b([A-Z]{3,})\b/g, match => autoTranslitWord(match));

  return result.replace(/\s+/g,' ').trim();
}

// ── hospitalLine2: название больницы остаётся на английском как есть
//    убираем только тип учреждения из начала строки
function buildHospitalLine2(hospitalRaw) {
  if (!hospitalRaw) return '';
  return hospitalRaw.toUpperCase().trim()
    .replace(/^HOSPITAL\s+/i, '')
    .replace(/^MEDICAL\s+CENT(?:ER|RE)\s+/i, '')
    .replace(/\s+/g, ' ').trim();
}

module.exports = async function handler(req, res) {
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

    const dobFormatted = d.dob
      ? (() => {
          const dt = new Date(d.dob + 'T12:00:00');
          const months = ['ЯНВАРЯ','ФЕВРАЛЯ','МАРТА','АПРЕЛЯ','МАЯ','ИЮНЯ',
                          'ИЮЛЯ','АВГУСТА','СЕНТЯБРЯ','ОКТЯБРЯ','НОЯБРЯ','ДЕКАБРЯ'];
          return `${String(dt.getDate()).padStart(2,'0')} ${months[dt.getMonth()]} ${dt.getFullYear()} г.`;
        })()
      : '';

    const barcodeNum = (d.reqNum || '').replace(/[^0-9]/g, '');
    const barcodeText = barcodeNum ? '*' + barcodeNum + '*' : '';

    const rawLast  = d.lastName  || '';
    const rawFirst = d.firstName || '';
    const rawMid   = d.middleName || '';
    const childName = d.childName ||
      [translateNamePart(rawLast), translateNamePart(rawFirst), translateNamePart(rawMid)]
      .filter(Boolean).join(' ') || '';

    const hospitalRaw  = (d.hospital     || '').toUpperCase().trim();
    const hospitalType = (d.hospitalType || 'БОЛЬНИЦА').toUpperCase().trim();

    const hospitalLine1 = hospitalType;
    // ── Строка 2: транслит названия без замены городов ──
    const hospitalLine2 = buildHospitalLine2(hospitalRaw);

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
      cityCounty:       translateCityCounty(d.cityCounty || ''),
      motherName:       d.motherName || '',
      motherDob:        d.motherDob || '',
      motherBirthPlace: d.motherBirthPlace || '',
      fatherName:       d.fatherName || '',
      fatherDob:        d.fatherDob || '',
      fatherBirthPlace: d.fatherBirthPlace || '',
      reqNum:           barcodeNum,
      barcode:          barcodeText,
    };

    const bgUrl  = process.env.BACKGROUND_URL  || 'https://translit-gilt.vercel.app/bg.jpg';
    const bg2Url = process.env.BACKGROUND_URL2 || 'https://translit-gilt.vercel.app/bg2.jpg';
    const styledHtml  = await buildHtml(values, bgUrl,  num, today);
    const styledHtml2 = await buildHtml(values, bg2Url, num, today, FIELDS2);
    const docxBuffer  = buildDocx(values, num, today);

    if (d.email && process.env.RESEND_API_KEY) {
      try {
        const emailResp = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.RESEND_API_KEY}`
          },
          body: JSON.stringify({
            from: 'BirthCert Translation <onboarding@resend.dev>',
            to: d.email,
            subject: `Перевод свидетельства — ${d.childName || 'документ'} (№ ${num})`,
            html: buildEmail(d.childName, num),
            attachments: [
              { filename: `Перевод_бланк1_${num}.html`, content: Buffer.from(styledHtml,  'utf-8').toString('base64') },
              { filename: `Перевод_бланк2_${num}.html`, content: Buffer.from(styledHtml2, 'utf-8').toString('base64') },
              { filename: `Перевод_${num}.docx`,         content: docxBuffer.toString('base64') },
            ]
          })
        });
        const emailResult = await emailResp.json();
        console.log('EMAIL RESULT:', JSON.stringify(emailResult));
      } catch(emailErr) {
        console.error('EMAIL ERROR:', emailErr.message);
      }
    } else {
      console.log('EMAIL SKIP: email=', d.email, 'key=', !!process.env.RESEND_API_KEY);
    }

    return res.status(200).json({
      ok: true,
      values,
      fields: FIELDS,
      bgUrl,
      pdfHtml:  styledHtml,
      pdfHtml2: styledHtml2,
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
async function buildHtml(v, bgUrl, num, today, fields) {
  const FLDS = fields || FIELDS;
  let bgData = bgUrl;
  try {
    const resp = await fetch(bgUrl);
    const buf = await resp.arrayBuffer();
    const b64 = Buffer.from(buf).toString('base64');
    const mime = resp.headers.get('content-type') || 'image/jpeg';
    bgData = `data:${mime};base64,${b64}`;
  } catch(e) {
    console.error('Could not embed bg:', e.message);
  }

  const fieldsHtml = FLDS.map(f => {
    const val = v[f.id];
    if (!val) return '';
    return `<div style="position:absolute;top:${f.top}%;left:${f.left}%;font-size:${f.size}px;font-weight:700;color:#000;font-family:'Times New Roman',Times,serif;white-space:nowrap;line-height:1">${val}</div>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="ru"><head><meta charset="UTF-8">
<title>Перевод — ${v.childName}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Times New Roman',Times,serif;background:#666;display:flex;flex-direction:column;align-items:center;padding:20px;gap:20px}
.sheet{background:white;box-shadow:0 4px 20px rgba(0,0,0,.3)}
.sheet-blank{position:relative;width:794px;height:1123px;overflow:hidden}
.sheet-blank img{position:absolute;top:0;left:0;width:794px;height:1123px;object-fit:fill;display:block}
.fields{position:absolute;inset:0;z-index:1}
.sheet-cert{width:794px;height:1123px;padding:80px 80px 60px;display:flex;flex-direction:column}
.cert-title{text-align:center;font-size:18px;font-weight:bold;color:#0c1b3a;letter-spacing:1px;margin-bottom:40px;padding-bottom:16px;border-bottom:2px solid #c8a84b}
.cert-body{font-size:14px;line-height:2.2;color:#222;flex:1}
.cert-body p{margin-bottom:20px}
.cert-sign{display:flex;justify-content:space-between;margin-top:60px;padding-top:20px;border-top:1px dashed #c8a84b}
.cert-sign-item{text-align:center;font-size:13px;color:#333}
.cert-sign-line{border-bottom:1.5px solid #000;width:160px;margin:0 auto 8px;height:40px}
.cert-footer{margin-top:auto;text-align:center;font-size:11px;color:#999;padding-top:20px}
.hint{color:white;font-size:12px;text-align:center;margin-top:10px}
@media print{
  *{-webkit-print-color-adjust:exact;print-color-adjust:exact}
  html,body{width:210mm;margin:0;padding:0;background:white;display:block}
  .hint{display:none}
  .sheet{box-shadow:none;margin:0;display:block}
  .sheet-blank{width:210mm;height:297mm;page-break-after:always;break-after:page;overflow:hidden}
  .sheet-blank img{width:210mm;height:297mm;object-fit:fill}
  .sheet-cert{width:210mm;height:297mm;padding:20mm 20mm 15mm;page-break-after:avoid;break-after:avoid}
}
@page{margin:0;size:A4}
</style></head>
<body>
<div class="sheet sheet-blank">
  <img src="${bgData}" alt="бланк">
  <div class="fields">${fieldsHtml}</div>
</div>
<div class="sheet sheet-cert">
  <div class="cert-title">УДОСТОВЕРЕНИЕ ПЕРЕВОДА</div>
  <div class="cert-body">
    <p>Я, нижеподписавшийся(аяся), сертифицированный переводчик с английского языка на русский язык, настоящим удостоверяю, что данный перевод является точным и полным переводом оригинального документа — свидетельства о рождении, выданного компетентным органом штата Флорида, США.</p>
    <p>Перевод выполнен в соответствии с требованиями Консульства Российской Федерации в США.</p>
    <p>Настоящим подтверждаю, что являюсь компетентным переводчиком русского и английского языков и данный перевод соответствует оригиналу документа.</p>
  </div>
  <div class="cert-sign">
    <div class="cert-sign-item"><div class="cert-sign-line"></div>Подпись переводчика</div>
    <div class="cert-sign-item"><div class="cert-sign-line"></div>Дата: ${today}</div>
    <div class="cert-sign-item"><div class="cert-sign-line"></div>№ ${num}</div>
  </div>
  <div class="cert-footer">BirthCert Translation Services &nbsp;·&nbsp; Официальный перевод для Консульства РФ в США</div>
</div>
<p class="hint">Для печати: Ctrl+P → масштаб 100% → без полей → 2 страницы А4</p>
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
${v.hospitalLine2}
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
  function row(label,val){
    return `<w:tr>
    <w:tc><w:tcPr><w:tcW w:w="3500" w:type="dxa"/><w:shd w:val="clear" w:fill="F0F2F8"/></w:tcPr>
    <w:p><w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:sz w:val="20"/><w:color w:val="555577"/></w:rPr><w:t>${esc(label)}</w:t></w:r></w:p></w:tc>
    <w:tc><w:tcPr><w:tcW w:w="5300" w:type="dxa"/></w:tcPr>
    <w:p><w:r><w:rPr><w:b/><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:sz w:val="22"/></w:rPr><w:t xml:space="preserve">${esc(val||'—')}</w:t></w:r></w:p></w:tc>
  </w:tr>`;
  }
  function sec(title){
    return `<w:tr>
    <w:tc><w:tcPr><w:tcW w:w="8800" w:type="dxa"/><w:gridSpan w:val="2"/><w:shd w:val="clear" w:fill="0C1B3A"/></w:tcPr>
    <w:p><w:r><w:rPr><w:b/><w:sz w:val="22"/><w:color w:val="FFFFFF"/><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/></w:rPr><w:t>${esc(title)}</w:t></w:r></w:p></w:tc>
  </w:tr>`;
  }

  const docXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:body>
<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:before="0" w:after="120"/></w:pPr>
  <w:r><w:rPr><w:b/><w:sz w:val="32"/><w:color w:val="0C1B3A"/><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/></w:rPr>
  <w:t>СВИДЕТЕЛЬСТВО О РОЖДЕНИИ</w:t></w:r></w:p>
<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:before="0" w:after="160"/></w:pPr>
  <w:r><w:rPr><w:i/><w:sz w:val="18"/><w:color w:val="666666"/><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/></w:rPr>
  <w:t>Перевод с английского языка на русский язык | штат Флорида, США</w:t></w:r></w:p>
<w:tbl>
  <w:tblPr>
    <w:tblW w:w="8800" w:type="dxa"/>
    <w:tblBorders>
      <w:top    w:val="single" w:sz="6" w:color="C8A84B"/>
      <w:bottom w:val="single" w:sz="6" w:color="C8A84B"/>
      <w:insideH w:val="single" w:sz="2" w:color="CCCCCC"/>
    </w:tblBorders>
    <w:tblCellMar>
      <w:top w:w="80" w:type="dxa"/><w:left w:w="120" w:type="dxa"/>
      <w:bottom w:w="80" w:type="dxa"/><w:right w:w="120" w:type="dxa"/>
    </w:tblCellMar>
  </w:tblPr>
  <w:tblGrid><w:gridCol w:w="3500"/><w:gridCol w:w="5300"/></w:tblGrid>
  ${sec('РЕКВИЗИТЫ ДОКУМЕНТА')}
  ${row('Номер регистрации в штате', v.stateRegNum)}
  ${row('Дата выдачи', v.dateIssued)}
  ${row('Дата регистрации', v.dateRegistered)}
  ${sec('ИНФОРМАЦИЯ О РЕБЁНКЕ')}
  ${row('ФИО', v.childName)}
  ${row('Дата рождения', v.dobFormatted)}
  ${row('Время рождения (24 ч)', v.timeOfBirth)}
  ${row('Пол', v.sex)}
  ${row('Вес при рождении', v.weight)}
  ${row('Место рождения', v.hospital)}
  ${row('Название / город', v.hospitalLine2)}
  ${row('Город, округ рождения', v.cityCounty)}
  ${sec('ИНФОРМАЦИЯ О МАТЕРИ / РОДИТЕЛЕ')}
  ${row('ФИО', v.motherName)}
  ${row('Дата рождения', v.motherDob)}
  ${row('Место рождения', v.motherBirthPlace)}
  ${sec('ИНФОРМАЦИЯ ОБ ОТЦЕ / РОДИТЕЛЕ')}
  ${row('ФИО', v.fatherName)}
  ${row('Дата рождения', v.fatherDob)}
  ${row('Место рождения', v.fatherBirthPlace)}
</w:tbl>
<w:p><w:r><w:t xml:space="preserve"> </w:t></w:r></w:p>
<w:p><w:r><w:rPr><w:b/><w:sz w:val="24"/><w:color w:val="0C1B3A"/><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/></w:rPr>
  <w:t>УДОСТОВЕРЕНИЕ ПЕРЕВОДА</w:t></w:r></w:p>
<w:p><w:pPr><w:spacing w:before="80" w:after="80"/></w:pPr>
  <w:r><w:rPr><w:sz w:val="20"/><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/></w:rPr>
  <w:t xml:space="preserve">Я, нижеподписавшийся(аяся), сертифицированный переводчик с английского языка на русский язык, настоящим удостоверяю, что данный перевод является точным и полным переводом оригинального документа — свидетельства о рождении, выданного компетентным органом штата Флорида, США. Перевод выполнен в соответствии с требованиями Консульства Российской Федерации в США.</w:t></w:r></w:p>
<w:p><w:pPr><w:spacing w:before="160" w:after="60"/></w:pPr>
  <w:r><w:rPr><w:sz w:val="20"/><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/></w:rPr>
  <w:t xml:space="preserve">Переводчик: _______________________     Дата: ${esc(today)}     № ${esc(num)}</w:t></w:r></w:p>
<w:sectPr>
  <w:pgSz w:w="11906" w:h="16838"/>
  <w:pgMar w:top="1080" w:right="850" w:bottom="1080" w:left="1701"/>
</w:sectPr>
</w:body></w:document>`;

  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:docDefaults><w:rPrDefault><w:rPr>
  <w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/>
  <w:sz w:val="20"/>
</w:rPr></w:rPrDefault></w:docDefaults></w:styles>`;

  const ct = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml"  ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml"   ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`;

  const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

  return buildZip([
    {name:'[Content_Types].xml',          data:ct},
    {name:'_rels/.rels',                  data:rootRels},
    {name:'word/document.xml',            data:docXml},
    {name:'word/_rels/document.xml.rels', data:rels},
    {name:'word/styles.xml',              data:styles},
  ]);
}

function buildEmail(name, num){return`<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto"><div style="background:#0c1b3a;padding:24px;text-align:center"><h2 style="color:white;margin:0">📄 BirthCert Translation</h2><p style="color:rgba(255,255,255,.6);margin:6px 0 0;font-size:13px">Официальный перевод для Консульства РФ</p></div><div style="background:#f4f6fb;padding:28px"><p style="color:#0e1c36;font-size:15px;margin:0 0 10px">Здравствуйте!</p><p style="color:#5a6b90;font-size:14px;margin-bottom:16px">Ваш перевод готов. К письму прикреплены <strong>3 файла</strong>:</p><div style="background:white;border:1px solid #d4daf0;border-radius:8px;padding:14px;margin:0 0 16px"><p style="margin:0 0 8px;font-size:13px">🎨 <strong>Перевод_бланк1_${num}.html</strong> — перевод с цветным фоном</p><p style="margin:0 0 8px;font-size:13px">📄 <strong>Перевод_бланк2_${num}.html</strong> — перевод на белом фоне</p><p style="margin:0;font-size:13px">📝 <strong>Перевод_${num}.docx</strong> — документ Word</p></div><div style="background:#fff8e6;border-left:3px solid #c8a84b;padding:10px 14px;border-radius:0 6px 6px 0;margin-bottom:16px"><p style="margin:0;color:#7a5a00;font-size:13px">🖨️ Для подачи в консульство: откройте HTML файл в браузере → Ctrl+P → масштаб 100% → без полей</p></div><p style="color:#aab0c8;font-size:12px;margin:0">№ ${num} · BirthCert Translation</p></div></div>`;}

function buildZipMixed(files){
  const lp=[],cp=[];let offset=0;
  for(const f of files){
    const name = Buffer.from(f.name,'utf-8');
    const data = f.binary ? Buffer.from(f.data,'base64') : Buffer.from(f.data,'utf-8');
    const crc  = crc32(data);
    const lh   = Buffer.alloc(30+name.length);
    lh.writeUInt32LE(0x04034b50,0);lh.writeUInt16LE(20,4);lh.writeUInt16LE(0,6);
    lh.writeUInt16LE(0,8);lh.writeUInt16LE(0,10);lh.writeUInt16LE(0,12);
    lh.writeUInt32LE(crc,14);lh.writeUInt32LE(data.length,18);
    lh.writeUInt32LE(data.length,22);lh.writeUInt16LE(name.length,26);
    lh.writeUInt16LE(0,28);name.copy(lh,30);
    lp.push(lh,data);
    const ch=Buffer.alloc(46+name.length);
    ch.writeUInt32LE(0x02014b50,0);ch.writeUInt16LE(20,4);ch.writeUInt16LE(20,6);
    ch.writeUInt16LE(0,8);ch.writeUInt16LE(0,10);ch.writeUInt16LE(0,12);
    ch.writeUInt16LE(0,14);ch.writeUInt32LE(crc,16);
    ch.writeUInt32LE(data.length,20);ch.writeUInt32LE(data.length,24);
    ch.writeUInt16LE(name.length,28);ch.writeUInt16LE(0,30);ch.writeUInt16LE(0,32);
    ch.writeUInt16LE(0,34);ch.writeUInt16LE(0,36);ch.writeUInt32LE(0,38);
    ch.writeUInt32LE(offset,42);name.copy(ch,46);
    cp.push(ch);offset+=30+name.length+data.length;
  }
  const cd=Buffer.concat(cp),end=Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50,0);end.writeUInt16LE(0,4);end.writeUInt16LE(0,6);
  end.writeUInt16LE(files.length,8);end.writeUInt16LE(files.length,10);
  end.writeUInt32LE(cd.length,12);end.writeUInt32LE(offset,16);end.writeUInt16LE(0,20);
  return Buffer.concat([...lp,cd,end]);
}

function buildZip(files){return buildZipMixed(files.map(f=>({...f,binary:false})));}
function crc32(buf){const t=new Uint32Array(256);for(let i=0;i<256;i++){let c=i;for(let j=0;j<8;j++)c=(c&1)?(0xEDB88320^(c>>>1)):(c>>>1);t[i]=c;}let crc=0xFFFFFFFF;for(let i=0;i<buf.length;i++)crc=(crc>>>8)^t[(crc^buf[i])&0xFF];return(crc^0xFFFFFFFF)>>>0;}
