const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const fontkit = require('@pdf-lib/fontkit');

const fs = require('fs');
const path = require('path');

// ── Загрузка кириллического шрифта из репо ───────────────
// Положи файлы в /public/fonts/ в репо на GitHub:
// NotoSans-Bold.ttf и NotoSans-Regular.ttf
let _fontBoldBytes = null;
let _fontRegBytes  = null;

function getCyrillicFonts() {
  if (!_fontBoldBytes) {
    const fontDir = path.join(process.cwd(), 'public', 'fonts');
    _fontBoldBytes = fs.readFileSync(path.join(fontDir, 'NotoSans-Bold.ttf'));
    _fontRegBytes  = fs.readFileSync(path.join(fontDir, 'NotoSans-Regular.ttf'));
  }
  return { boldBytes: _fontBoldBytes, regBytes: _fontRegBytes };
}

async function createPdfDoc() {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);
  const { boldBytes, regBytes } = getCyrillicFonts();
  const fontBold = await pdfDoc.embedFont(boldBytes);
  const fontReg  = await pdfDoc.embedFont(regBytes);
  return { pdfDoc, fontBold, fontReg };
}

// ── PDF бланк 1: фон bg.jpg + текст поверх ───────────────
async function buildPdfBlanк1(values, bgUrl, fields) {
  const { pdfDoc, fontBold, fontReg } = await createPdfDoc();
  const page = pdfDoc.addPage([595, 842]); // A4

  // Загружаем фон
  try {
    const bgResp = await fetch(bgUrl);
    const bgBytes = await bgResp.arrayBuffer();
    let bgImage;
    const ct = bgResp.headers.get('content-type') || '';
    if (ct.includes('png')) bgImage = await pdfDoc.embedPng(bgBytes);
    else bgImage = await pdfDoc.embedJpg(bgBytes);
    page.drawImage(bgImage, { x: 0, y: 0, width: 595, height: 842 });
  } catch(e) {
    console.error('bg load error:', e.message);
  }

  const font = fontBold;
  const { width, height } = page.getSize();

  for (const f of fields) {
    const val = values[f.id];
    if (!val) continue;
    const fontSize = f.size * 0.75;
    const x = (f.left / 100) * width;
    // pdf-lib: Y снизу вверх; top% — верхний край → вычитаем fontSize
    const y = height - (f.top / 100) * height - fontSize;
    page.drawText(val, {
      x, y,
      size: fontSize,
      font,
      color: rgb(0, 0, 0),
    });
  }

  return await pdfDoc.save();
}

// ── PDF бланк 2: белый лист + таблица ────────────────────
async function buildPdfBlanк2(values, num, today) {
  const { pdfDoc, fontBold, fontReg } = await createPdfDoc();
  const page = pdfDoc.addPage([595, 842]);
  const font = fontBold;
  const { width, height } = page.getSize();

  const navy = rgb(0.047, 0.106, 0.227);
  const gold = rgb(0.784, 0.643, 0.294);
  const white = rgb(1, 1, 1);
  const lightBg = rgb(0.941, 0.945, 0.973);
  const black = rgb(0, 0, 0);
  const gray = rgb(0.333, 0.420, 0.565);

  let y = height - 30;
  const lm = 40; // left margin
  const rm = width - 40; // right margin
  const colW = 195;
  const rowH = 18;

  // Заголовок
  page.drawText('СВИДЕТЕЛЬСТВО О РОЖДЕНИИ', {
    x: lm, y, size: 14, font, color: navy,
  });
  y -= 16;
  page.drawText('Перевод с английского языка на русский язык | штат Флорида, США', {
    x: lm, y, size: 8, font: fontReg, color: gray,
  });
  y -= 8;

  // Линия золотая
  page.drawLine({ start: {x:lm, y}, end: {x:rm, y}, thickness: 1.5, color: gold });
  y -= 14;

  function drawRow(label, val, isHeader) {
    if (isHeader) {
      page.drawRectangle({ x: lm, y: y-2, width: rm-lm, height: rowH, color: navy });
      page.drawText(label, { x: lm+4, y: y+3, size: 8, font, color: white });
      y -= rowH + 2;
      return;
    }
    // Label cell
    page.drawRectangle({ x: lm, y: y-2, width: colW, height: rowH, color: lightBg });
    page.drawText(label, { x: lm+4, y: y+3, size: 7.5, font: fontReg, color: gray });
    // Value cell
    const safeVal = (val || '—').substring(0, 55);
    page.drawText(safeVal, { x: lm+colW+6, y: y+3, size: 8.5, font, color: black });
    // Bottom line
    page.drawLine({ start:{x:lm,y:y-2}, end:{x:rm,y:y-2}, thickness:0.3, color:rgb(0.8,0.8,0.8) });
    y -= rowH + 1;
  }

  drawRow('РЕКВИЗИТЫ ДОКУМЕНТА', '', true);
  drawRow('Номер регистрации', values.stateRegNum);
  drawRow('Дата выдачи', values.dateIssued);
  drawRow('Дата регистрации', values.dateRegistered);
  y -= 3;

  drawRow('ИНФОРМАЦИЯ О РЕБЁНКЕ', '', true);
  drawRow('ФИО', values.childName);
  drawRow('Дата рождения', values.dobFormatted);
  drawRow('Время рождения', values.timeOfBirth);
  drawRow('Пол', values.sex);
  drawRow('Вес при рождении', values.weight);
  drawRow('Место рождения', values.hospital);
  drawRow('Название больницы', values.hospitalLine2);
  drawRow('Город, округ', values.cityCounty);
  y -= 3;

  drawRow('ИНФОРМАЦИЯ О МАТЕРИ / РОДИТЕЛЕ', '', true);
  drawRow('ФИО', values.motherName);
  drawRow('Дата рождения', values.motherDob);
  drawRow('Место рождения', values.motherBirthPlace);
  y -= 3;

  drawRow('ИНФОРМАЦИЯ ОБ ОТЦЕ / РОДИТЕЛЕ', '', true);
  drawRow('ФИО', values.fatherName);
  drawRow('Дата рождения', values.fatherDob);
  drawRow('Место рождения', values.fatherBirthPlace);
  y -= 6;

  // Золотая линия
  page.drawLine({ start:{x:lm,y}, end:{x:rm,y}, thickness:1.5, color:gold });
  y -= 16;

  // Удостоверение
  page.drawText('УДОСТОВЕРЕНИЕ ПЕРЕВОДА', { x:lm, y, size:11, font, color:navy });
  y -= 14;
  const certText = 'Я, нижеподписавшийся(аяся), сертифицированный переводчик, настоящим удостоверяю, что';
  const certText2 = 'данный перевод является точным и полным переводом оригинала — свидетельства о рождении,';
  const certText3 = 'выданного компетентным органом штата Флорида, США.';
  page.drawText(certText,  { x:lm, y,    size:8, font:fontReg, color:black });
  page.drawText(certText2, { x:lm, y:y-10, size:8, font:fontReg, color:black });
  page.drawText(certText3, { x:lm, y:y-20, size:8, font:fontReg, color:black });
  y -= 38;

  page.drawText(`Переводчик: _______________________   Дата: ${today}   No. ${num}`, {
    x:lm, y, size:8, font:fontReg, color:black
  });
  y -= 14;
  page.drawText('Нотариус: _______________________   Дата: _______________________', {
    x:lm, y, size:8, font:fontReg, color:black
  });

  // Footer
  page.drawLine({ start:{x:lm,y:25}, end:{x:rm,y:25}, thickness:0.5, color:rgb(0.8,0.8,0.8) });
  page.drawText(`BirthCert Translation · Официальный перевод для Консульства РФ в США · No. ${num}`, {
    x:lm, y:12, size:6.5, font:fontReg, color:gray
  });

  return await pdfDoc.save();
}

// ── PDF заверение ─────────────────────────────────────────
async function buildPdfCert(values, num, today) {
  const { pdfDoc, fontBold, fontReg } = await createPdfDoc();
  const page = pdfDoc.addPage([595, 842]);
  const font = fontBold;
  const { width, height } = page.getSize();

  const navy = rgb(0.047, 0.106, 0.227);
  const gold = rgb(0.784, 0.643, 0.294);
  const black = rgb(0, 0, 0);
  const gray = rgb(0.333, 0.420, 0.565);
  const lightBg = rgb(0.973, 0.969, 0.933);

  // Внешняя рамка
  page.drawRectangle({ x:20, y:20, width:555, height:802, borderColor:navy, borderWidth:2, color:rgb(1,1,1) });
  page.drawRectangle({ x:28, y:28, width:539, height:786, borderColor:gold, borderWidth:1, color:rgb(1,1,1) });

  let y = height - 60;
  const lm = 50;
  const rm = width - 50;

  // Номер заказа
  page.drawText(`No. ${num} · ${today}`, { x:rm-120, y, size:8, font:fontReg, color:gray });
  y -= 20;

  // Заголовок
  page.drawText('УДОСТОВЕРЕНИЕ ПЕРЕВОДА', { x:width/2-100, y, size:14, font, color:navy });
  y -= 12;
  page.drawText('Свидетельство о рождении · Штат Флорида, США', { x:width/2-90, y, size:9, font:fontReg, color:gray });
  y -= 6;
  page.drawLine({ start:{x:lm,y}, end:{x:rm,y}, thickness:1.5, color:gold });
  y -= 18;

  // Информация о документе
  page.drawRectangle({ x:lm, y:y-50, width:rm-lm, height:68, color:lightBg, borderColor:rgb(0.85,0.85,0.85), borderWidth:0.5 });
  page.drawText('Документ:', { x:lm+10, y:y-8, size:8.5, font, color:navy });
  page.drawText('Свидетельство о рождении (Certification of Birth), штат Флорида, США', { x:lm+75, y:y-8, size:8.5, font:fontReg, color:black });
  page.drawText('Имя ребёнка:', { x:lm+10, y:y-22, size:8.5, font, color:navy });
  page.drawText(values.childName || '—', { x:lm+75, y:y-22, size:8.5, font:fontReg, color:black });
  page.drawText('Дата рождения:', { x:lm+10, y:y-36, size:8.5, font, color:navy });
  page.drawText(values.dobFormatted || '—', { x:lm+75, y:y-36, size:8.5, font:fontReg, color:black });
  page.drawText('Номер регистрации:', { x:lm+10, y:y-50, size:8.5, font, color:navy });
  page.drawText(values.stateRegNum || '—', { x:lm+75, y:y-50, size:8.5, font:fontReg, color:black });
  y -= 76;

  // Текст удостоверения
  const lines = [
    'Я, нижеподписавшийся(аяся), сертифицированный переводчик с английского языка на русский',
    'язык, настоящим удостоверяю, что выполненный мной перевод вышеуказанного документа',
    'является точным, полным и верным переводом оригинала.',
    '',
    'Перевод выполнен в соответствии с требованиями Консульства Российской Федерации в США',
    'и может быть использован для подачи в консульские учреждения РФ на территории США.',
    '',
    'Настоящим подтверждаю, что являюсь компетентным переводчиком русского и английского',
    'языков, и данный перевод соответствует тексту оригинала документа.',
  ];
  for (const line of lines) {
    if (line) page.drawText(line, { x:lm, y, size:9, font:fontReg, color:black });
    y -= 13;
  }
  y -= 10;

  page.drawLine({ start:{x:lm,y}, end:{x:rm,y}, thickness:0.8, color:navy });
  y -= 20;

  // Подписи — два блока рядом
  const colMid = width / 2;

  // Переводчик
  page.drawText('ПЕРЕВОДЧИК', { x:lm, y, size:8, font, color:navy });
  y -= 36;
  page.drawLine({ start:{x:lm,y}, end:{x:colMid-20,y}, thickness:1, color:black });
  page.drawText('Подпись переводчика', { x:lm+30, y:y-10, size:7, font:fontReg, color:gray });
  y -= 30;
  page.drawLine({ start:{x:lm,y}, end:{x:colMid-20,y}, thickness:1, color:black });
  page.drawText('ФИО (печатными буквами)', { x:lm+30, y:y-10, size:7, font:fontReg, color:gray });
  y -= 30;
  page.drawLine({ start:{x:lm,y}, end:{x:colMid-20,y}, thickness:1, color:black });
  page.drawText('Дата', { x:lm+30, y:y-10, size:7, font:fontReg, color:gray });

  // Нотариус — правый блок (сбрасываем y на уровень начала блока)
  let y2 = y + 96;
  page.drawText('НОТАРИУС', { x:colMid+10, y:y2, size:8, font, color:navy });
  y2 -= 36;
  page.drawLine({ start:{x:colMid+10,y:y2}, end:{x:rm,y:y2}, thickness:1, color:black });
  page.drawText('Подпись нотариуса', { x:colMid+40, y:y2-10, size:7, font:fontReg, color:gray });
  y2 -= 30;
  page.drawLine({ start:{x:colMid+10,y:y2}, end:{x:rm,y:y2}, thickness:1, color:black });
  page.drawText('ФИО (печатными буквами)', { x:colMid+40, y:y2-10, size:7, font:fontReg, color:gray });
  y2 -= 30;
  page.drawLine({ start:{x:colMid+10,y:y2}, end:{x:rm,y:y2}, thickness:1, color:black });
  page.drawText('Дата · Комиссия действительна до', { x:colMid+40, y:y2-10, size:7, font:fontReg, color:gray });

  y -= 50;

  // Печати — два круга
  const stampY = y - 50;
  // Печать переводчика
  page.drawEllipse({ x:lm+60, y:stampY, xScale:55, yScale:55, borderColor:gray, borderWidth:1.5, color:rgb(1,1,1) });
  page.drawText('ПЕЧАТЬ', { x:lm+35, y:stampY+8, size:7, font, color:gray });
  page.drawText('ПЕРЕВОДЧИКА', { x:lm+28, y:stampY-4, size:7, font, color:gray });
  // Печать нотариуса
  page.drawEllipse({ x:colMid+80, y:stampY, xScale:55, yScale:55, borderColor:gray, borderWidth:1.5, color:rgb(1,1,1) });
  page.drawText('НОТАРИАЛЬНАЯ', { x:colMid+43, y:stampY+8, size:7, font, color:gray });
  page.drawText('ПЕЧАТЬ', { x:colMid+58, y:stampY-4, size:7, font, color:gray });

  // Footer
  page.drawLine({ start:{x:lm,y:38}, end:{x:rm,y:38}, thickness:0.5, color:rgb(0.8,0.8,0.8) });
  page.drawText(`BirthCert Translation Services · Официальный перевод для Консульства РФ в США · No. ${num}`, {
    x:lm, y:26, size:6.5, font:fontReg, color:gray
  });

  return await pdfDoc.save();
}

// ── ТОЧНЫЕ КООРДИНАТЫ ПОЛЕЙ НА БЛАНКЕ (из редактора пользователя) ────
const FIELDS = [
  { id:'stateRegNum',      top:15.17, left:30.1, size:16 },
  { id:'dateIssued',       top:14.87, left:62.9, size:16 },
  { id:'dateRegistered',   top:16.97, left:62.9, size:16 },
  { id:'childName',        top:21.77, left:33.6, size:16 },
  { id:'dobFormatted',     top:26.67, left:33.6, size:16 },
  { id:'timeOfBirth',      top:26.97, left:78.7, size:16 },
  { id:'sex',              top:30.97, left:33.6, size:16 },
  { id:'weight',           top:31.1, left:70.5, size:16 },
  { id:'hospital',         top:34.47, left:33.6, size:16 },
  { id:'hospitalLine2',    top:36.37, left:33.6, size:16 },
  { id:'cityCounty',       top:38.3, left:33.7, size:16 },
  { id:'motherName',       top:49.17, left:33.5, size:16 },
  { id:'motherDob',        top:53.07, left:33.5, size:16 },
  { id:'motherBirthPlace', top:56.27, left:33.4, size:16 },
  { id:'fatherName',       top:65.37, left:33.4, size:16 },
  { id:'fatherDob',        top:69.87, left:33.4, size:16 },
  { id:'fatherBirthPlace', top:73.37, left:33.5, size:16 },
  { id:'reqNum',           top:84.77, left:75.1, size:16 },
  { id:'barcode',          top:96.42, left:27.9, size:14 },
];

// ── КООРДИНАТЫ ПОЛЕЙ ДЛЯ ВТОРОГО БЛАНКА (bg2.jpg) ──────
const FIELDS2 = [
  { id:'stateRegNum',      top:21.47, left:12.8, size:15 },
  { id:'dateIssued',       top:20.03, left:68.6, size:15 },
  { id:'dateRegistered',   top:21.77, left:73.6, size:15 },
  { id:'childName',        top:26.37, left:38.0, size:15 },
  { id:'dobFormatted',     top:28.73, left:37.7, size:15 },
  { id:'timeOfBirth',      top:28.83, left:84.8, size:15 },
  { id:'sex',              top:31.47, left:37.9, size:15 },
  { id:'weight',           top:31.43, left:76.6, size:15 },
  { id:'hospital',         top:33.87, left:37.7, size:15 },
  { id:'hospitalLine2',    top:35.67, left:37.6, size:15 },
  { id:'cityCounty',       top:37.63, left:37.5, size:15 },
  { id:'motherName',       top:44.67, left:37.8, size:15 },
  { id:'motherDob',        top:47.17, left:37.5, size:15 },
  { id:'motherBirthPlace', top:49.67, left:37.5, size:15 },
  { id:'fatherName',       top:57.67, left:37.9, size:15 },
  { id:'fatherDob',        top:60.27, left:37.9, size:15 },
  { id:'fatherBirthPlace', top:62.87, left:37.7, size:15 },
  { id:'reqNum',           top:65.77, left:71.1, size:15 },
  { id:'barcode',          top:86.27, left:42.7, size:11 },
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
  // Сначала дефисные округа (MIAMI-DADE и т.д.) — \b не работает с дефисом
  result = result.replace(/([A-Z][\w]*(?:-[A-Z][\w]*)+)\s+COUNTY/g, (match, countyName) => {
    const key = countyName.trim();
    if (COUNTY_DICT[key]) return 'ОКРУГ ' + COUNTY_DICT[key];
    const translitted = key.split(/[\s-]/).map(w => w ? autoTranslitWord(w) : '').join('-').replace(/--+/g,'-');
    return 'ОКРУГ ' + translitted;
  });
  // Потом обычные округа без дефиса
  result = result.replace(/\b([A-Z][A-Z\s]*?)\s+COUNTY\b/g, (match, countyName) => {
    const key = countyName.trim();
    if (COUNTY_DICT[key]) return 'ОКРУГ ' + COUNTY_DICT[key];
    const translitted = key.split(/\s+/).map(w => w ? autoTranslitWord(w) : '').join(' ');
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

// ── buildHospitalLine2: данные уже переведены GPT — просто возвращаем
function buildHospitalLine2(hospitalRaw) {
  if (!hospitalRaw) return '';
  return hospitalRaw.toUpperCase().trim();
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

    // reqNum — поле REQ справа на бланке (номер запроса)
    const reqNumClean = (d.reqNum || '').replace(/[^0-9]/g, '');
    // barcodeNum — цифры под штрихкодом внизу документа (отдельное поле)
    const barcodeNum = (d.barcodeNum || d.reqNum || '').replace(/[^0-9]/g, '');
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
      reqNum:           reqNumClean,
      barcode:          barcodeText,
    };

    const bgUrl  = process.env.BACKGROUND_URL  || 'https://translit-gilt.vercel.app/bg.jpg';
    const bg2Url = process.env.BACKGROUND_URL2 || 'https://translit-gilt.vercel.app/bg2.jpg';
    const styledHtml  = await buildHtml(values, bgUrl,  num, today);
    const styledHtml2 = await buildHtml(values, bg2Url, num, today, FIELDS2);
    const docxBuffer  = buildDocx(values, num, today);

    // Конвертируем HTML в PDF через Gotenberg на Pi
    const GOTENBERG = process.env.GOTENBERG_URL || 'https://pdf.fortendocs.online';
    let pdf1Bytes = null, pdf2Bytes = null, pdf3Bytes = null;

    async function htmlToPdf(html) {
      const form = new FormData();
      form.append('files', new Blob([html], {type:'text/html'}), 'index.html');
      // A4: 210x297mm, без полей, масштаб 1
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
      return Buffer.from(await r.arrayBuffer());
    }

    try {
      const certHtml = buildCertHtml(values, num, today);
      [pdf1Bytes, pdf2Bytes, pdf3Bytes] = await Promise.all([
        htmlToPdf(styledHtml),
        htmlToPdf(styledHtml2),
        htmlToPdf(certHtml),
      ]);
      console.log('PDF generated via Gotenberg OK');
    } catch(pdfErr) {
      console.error('Gotenberg error:', pdfErr.message);
      // fallback — отправим HTML
    }

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
            subject: `Перевод свидетельства — ${d.childName || 'документ'} (No. ${num})`,
            html: buildEmail(d.childName, num),
            attachments: [
              { filename: pdf1Bytes ? `Перевод_бланк1_${num}.pdf` : `Перевод_бланк1_${num}.html`,
                content: pdf1Bytes ? Buffer.from(pdf1Bytes).toString('base64') : Buffer.from(styledHtml,'utf-8').toString('base64') },
              { filename: pdf2Bytes ? `Перевод_бланк2_${num}.pdf` : `Перевод_бланк2_${num}.html`,
                content: pdf2Bytes ? Buffer.from(pdf2Bytes).toString('base64') : Buffer.from(styledHtml2,'utf-8').toString('base64') },
              { filename: pdf3Bytes ? `Заверение_${num}.pdf` : `Заверение_${num}.html`,
                content: pdf3Bytes ? Buffer.from(pdf3Bytes).toString('base64') : Buffer.from(buildCertHtml(values, num, today),'utf-8').toString('base64') },
              { filename: `Перевод_${num}.docx`, content: docxBuffer.toString('base64') },
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
    <div class="cert-sign-item"><div class="cert-sign-line"></div>No. ${num}</div>
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
Перевод No. ${num} от ${today}`;
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
<w:p><w:pPr><w:spacing w:before="160" w:after="80"/></w:pPr>
  <w:r><w:rPr><w:b/><w:sz w:val="24"/><w:color w:val="0C1B3A"/><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/></w:rPr>
  <w:t>УДОСТОВЕРЕНИЕ ПЕРЕВОДА</w:t></w:r></w:p>
<w:p><w:pPr><w:spacing w:before="80" w:after="80"/></w:pPr>
  <w:r><w:rPr><w:sz w:val="20"/><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/></w:rPr>
  <w:t xml:space="preserve">Я, нижеподписавшийся(аяся), сертифицированный переводчик с английского языка на русский язык, настоящим удостоверяю, что данный перевод является точным и полным переводом оригинального документа — свидетельства о рождении, выданного компетентным органом штата Флорида, США. Перевод выполнен в соответствии с требованиями Консульства Российской Федерации в США.</w:t></w:r></w:p>
<w:p><w:pPr><w:spacing w:before="160" w:after="60"/></w:pPr>
  <w:r><w:rPr><w:sz w:val="20"/><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/></w:rPr>
  <w:t xml:space="preserve">Переводчик: _______________________     Дата: ${esc(today)}     No. ${esc(num)}</w:t></w:r></w:p>
<w:p><w:pPr><w:spacing w:before="80" w:after="60"/></w:pPr>
  <w:r><w:rPr><w:sz w:val="20"/><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/></w:rPr>
  <w:t xml:space="preserve">Нотариус: _______________________     Дата: _______________________</w:t></w:r></w:p>
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


// ── СТРАНИЦА ЗАВЕРЕНИЯ ПЕРЕВОДА ──────────────────────────
function buildCertHtml(v, num, today) {
  return `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<style>
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Times New Roman', Times, serif;
    background: white;
    width: 210mm;
    min-height: 297mm;
    padding: 20mm 22mm 18mm;
    color: #111;
  }
  .border {
    border: 2px solid #0c1b3a;
    padding: 16mm 18mm;
    min-height: 257mm;
    display: flex;
    flex-direction: column;
  }
  .inner-border {
    border: 1px solid #c8a84b;
    padding: 12mm 14mm;
    flex: 1;
    display: flex;
    flex-direction: column;
  }
  .header {
    text-align: center;
    border-bottom: 2px solid #c8a84b;
    padding-bottom: 10px;
    margin-bottom: 18px;
  }
  .header h1 {
    font-size: 16pt;
    font-weight: bold;
    color: #0c1b3a;
    letter-spacing: 2px;
    text-transform: uppercase;
    margin-bottom: 4px;
  }
  .header p {
    font-size: 10pt;
    color: #555;
  }
  .doc-info {
    background: #f8f6ee;
    border: 1px solid #ddd;
    border-radius: 4px;
    padding: 10px 14px;
    margin-bottom: 18px;
    font-size: 10pt;
    line-height: 1.8;
  }
  .doc-info strong { color: #0c1b3a; }
  .cert-text {
    font-size: 11pt;
    line-height: 1.9;
    text-align: justify;
    margin-bottom: 16px;
  }
  .cert-text p { margin-bottom: 10px; }
  .sign-section {
    margin-top: auto;
  }
  .sign-title {
    font-size: 11pt;
    font-weight: bold;
    color: #0c1b3a;
    border-bottom: 1px solid #c8a84b;
    padding-bottom: 6px;
    margin-bottom: 18px;
    text-transform: uppercase;
    letter-spacing: 1px;
  }
  .sign-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
    margin-bottom: 20px;
  }
  .sign-block {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .sign-block-title {
    font-size: 9pt;
    font-weight: bold;
    color: #555;
    text-transform: uppercase;
    letter-spacing: 1px;
    margin-bottom: 4px;
  }
  .sign-line {
    border-bottom: 1.5px solid #333;
    height: 40px;
    margin-bottom: 4px;
  }
  .sign-label {
    font-size: 8.5pt;
    color: #444;
    text-align: center;
  }
  .stamp-area {
    border: 2px dashed #aaa;
    border-radius: 50%;
    width: 90px;
    height: 90px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto;
    color: #bbb;
    font-size: 7pt;
    text-align: center;
    line-height: 1.4;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .footer {
    text-align: center;
    font-size: 8pt;
    color: #999;
    border-top: 1px solid #ddd;
    padding-top: 10px;
    margin-top: 16px;
  }
  .order-num {
    text-align: right;
    font-size: 9pt;
    color: #888;
    margin-bottom: 8px;
    font-style: italic;
  }
</style>
</head>
<body>
<div class="border">
<div class="inner-border">

  <div class="order-num">No. ${num} · ${today}</div>

  <div class="header">
    <h1>Удостоверение перевода</h1>
    <p>Свидетельство о рождении · Штат Флорида, США</p>
  </div>

  <div class="doc-info">
    <strong>Документ:</strong> Свидетельство о рождении (Certification of Birth), штат Флорида, США<br>
    <strong>Имя ребёнка:</strong> ${v.childName || '—'}<br>
    <strong>Дата рождения:</strong> ${v.dobFormatted || '—'}<br>
    <strong>Номер регистрации:</strong> ${v.stateRegNum || '—'}<br>
    <strong>Дата выдачи:</strong> ${v.dateIssued || '—'}
  </div>

  <div class="cert-text">
    <p>Я, нижеподписавшийся(аяся), сертифицированный переводчик с английского языка на русский язык, настоящим удостоверяю, что выполненный мной перевод вышеуказанного документа является точным, полным и верным переводом оригинала.</p>
    <p>Перевод выполнен в соответствии с требованиями Консульства Российской Федерации в США и может быть использован для подачи в консульские учреждения Российской Федерации на территории Соединённых Штатов Америки.</p>
    <p>Настоящим подтверждаю, что являюсь компетентным переводчиком русского и английского языков, и данный перевод соответствует тексту оригинала документа.</p>
  </div>

  <div class="sign-section">
    <div class="sign-title">Подписи и удостоверение</div>

    <div class="sign-grid">
      <div class="sign-block">
        <div class="sign-block-title">Переводчик</div>
        <div class="sign-line"></div>
        <div class="sign-label">Подпись переводчика</div>
        <div style="height:8px"></div>
        <div class="sign-line"></div>
        <div class="sign-label">ФИО переводчика (печатными буквами)</div>
        <div style="height:8px"></div>
        <div class="sign-line"></div>
        <div class="sign-label">Дата</div>
      </div>

      <div class="sign-block">
        <div class="sign-block-title">Нотариус</div>
        <div class="sign-line"></div>
        <div class="sign-label">Подпись нотариуса</div>
        <div style="height:8px"></div>
        <div class="sign-line"></div>
        <div class="sign-label">ФИО нотариуса (печатными буквами)</div>
        <div style="height:8px"></div>
        <div class="sign-line"></div>
        <div class="sign-label">Дата · Комиссия действительна до</div>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">
      <div style="text-align:center">
        <div class="sign-block-title" style="margin-bottom:8px">Печать переводчика</div>
        <div class="stamp-area">Печать<br>переводчика</div>
      </div>
      <div style="text-align:center">
        <div class="sign-block-title" style="margin-bottom:8px">Печать нотариуса</div>
        <div class="stamp-area">Нотариальная<br>печать</div>
      </div>
    </div>
  </div>

  <div class="footer">
    BirthCert Translation Services &nbsp;·&nbsp; Официальный перевод для Консульства РФ в США &nbsp;·&nbsp; No. ${num}
  </div>

</div>
</div>
</body>
</html>`;
}

function buildEmail(name, num){return`<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto"><div style="background:#0c1b3a;padding:24px;text-align:center"><h2 style="color:white;margin:0">📄 BirthCert Translation</h2><p style="color:rgba(255,255,255,.6);margin:6px 0 0;font-size:13px">Официальный перевод для Консульства РФ</p></div><div style="background:#f4f6fb;padding:28px"><p style="color:#0e1c36;font-size:15px;margin:0 0 10px">Здравствуйте!</p><p style="color:#5a6b90;font-size:14px;margin-bottom:16px">Ваш перевод готов. К письму прикреплены <strong>4 файла</strong>:</p><div style="background:white;border:1px solid #d4daf0;border-radius:8px;padding:14px;margin:0 0 16px"><p style="margin:0 0 8px;font-size:13px">📋 <strong>Перевод_бланк1_${num}.html</strong> — бланк с цветным фоном (открыть в браузере → Ctrl+P → PDF)</p><p style="margin:0 0 8px;font-size:13px">📄 <strong>Перевод_бланк2_${num}.html</strong> — бланк на белом фоне (открыть в браузере → Ctrl+P → PDF)</p><p style="margin:0 0 8px;font-size:13px">✍️ <strong>Заверение_${num}.html</strong> — страница заверения (распечатать, подписать)</p><p style="margin:0;font-size:13px">📝 <strong>Перевод_${num}.docx</strong> — документ Word (редактируемый)</p></div><div style="background:#fff8e6;border-left:3px solid #c8a84b;padding:10px 14px;border-radius:0 6px 6px 0;margin-bottom:16px"><p style="margin:0;color:#7a5a00;font-size:13px">🖨️ Для печати: откройте HTML файл в браузере → Ctrl+P → масштаб 100% → без полей → Сохранить как PDF</p></div><p style="color:#aab0c8;font-size:12px;margin:0">No. ${num} · BirthCert Translation</p></div></div>`;}

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
