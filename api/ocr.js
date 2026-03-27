export const config = { api: { bodyParser: false } };

// ─── СЛОВАРИ ──────────────────────────────────────────────

const MONTHS = {
  'january':'ЯНВАРЯ','february':'ФЕВРАЛЯ','march':'МАРТА','april':'АПРЕЛЯ',
  'may':'МАЯ','june':'ИЮНЯ','july':'ИЮЛЯ','august':'АВГУСТА',
  'september':'СЕНТЯБРЯ','october':'ОКТЯБРЯ','november':'НОЯБРЯ','december':'ДЕКАБРЯ',
  'jan':'ЯНВАРЯ','feb':'ФЕВРАЛЯ','mar':'МАРТА','apr':'АПРЕЛЯ',
  'jun':'ИЮНЯ','jul':'ИЮЛЯ','aug':'АВГУСТА','sep':'СЕНТЯБРЯ',
  'oct':'ОКТЯБРЯ','nov':'НОЯБРЯ','dec':'ДЕКАБРЯ',
};

const COUNTRIES = {
  'russia':'РОССИЯ','russian federation':'РОССИЙСКАЯ ФЕДЕРАЦИЯ',
  'belarus':'БЕЛАРУСЬ','ukraine':'УКРАИНА','kazakhstan':'КАЗАХСТАН',
  'usa':'США','united states':'США','united states of america':'США',
  'georgia':'ГРУЗИЯ','moldova':'МОЛДОВА','latvia':'ЛАТВИЯ',
  'lithuania':'ЛИТВА','estonia':'ЭСТОНИЯ','armenia':'АРМЕНИЯ',
  'azerbaijan':'АЗЕРБАЙДЖАН','uzbekistan':'УЗБЕКИСТАН',
  'kyrgyzstan':'КЫРГЫЗСТАН','tajikistan':'ТАДЖИКИСТАН',
  'turkmenistan':'ТУРКМЕНИСТАН','germany':'ГЕРМАНИЯ',
  'france':'ФРАНЦИЯ','italy':'ИТАЛИЯ','spain':'ИСПАНИЯ',
  'poland':'ПОЛЬША','israel':'ИЗРАИЛЬ','china':'КИТАЙ',
};

const CITIES = {
  'st petersburg':'Г. САНКТ-ПЕТЕРБУРГ','st. petersburg':'Г. САНКТ-ПЕТЕРБУРГ',
  'saint petersburg':'Г. САНКТ-ПЕТЕРБУРГ',
  'miami':'Г. МАЙАМИ','orlando':'Г. ОРЛАНДО','tampa':'Г. ТАМПА',
  'jacksonville':'Г. ДЖЭКСОНВИЛЛ','clearwater':'Г. КЛИРУОТЕР',
  'fort lauderdale':'Г. ФОРТ-ЛОДЕРДЕЙЛ','tallahassee':'Г. ТАЛЛАХАССИ',
  'gainesville':'Г. ГЕЙНСВИЛЛ','pensacola':'Г. ПЕНСАКОЛА',
};

const COUNTIES = {
  'pinellas county':'ОКРУГ ПИНЕЛЛАС','hillsborough county':'ОКРУГ ХИЛЛСБОРО',
  'orange county':'ОКРУГ ОРИНДЖ','miami-dade county':'ОКРУГ МАЙАМИ-ДЕЙД',
  'broward county':'ОКРУГ БРОУАРД','palm beach county':'ОКРУГ ПАЛМ-БИЧ',
  'duval county':'ОКРУГ ДЮВАЛЬ','lee county':'ОКРУГ ЛИ',
  'polk county':'ОКРУГ ПОЛК','volusia county':'ОКРУГ ВОЛУША',
};

// Словарь имён EN→RU
const NAMES = {
  'mark':'МАРК','alekseevich':'АЛЕКСЕЕВИЧ','aleksei':'АЛЕКСЕЙ','aleksey':'АЛЕКСЕЙ',
  'kirzov':'КИРЗОВ','ekaterina':'ЕКАТЕРИНА','olegovna':'ОЛЕГОВНА','golod':'ГОЛОД',
  'leonidovich':'ЛЕОНИДОВИЧ','alexander':'АЛЕКСАНДР','alexandra':'АЛЕКСАНДРА',
  'mikhail':'МИХАИЛ','mikhailovich':'МИХАЙЛОВИЧ','sergei':'СЕРГЕЙ','sergey':'СЕРГЕЙ',
  'sergeevich':'СЕРГЕЕВИЧ','ivan':'ИВАН','ivanovich':'ИВАНОВИЧ','ivanov':'ИВАНОВ',
  'ivanova':'ИВАНОВА','anna':'АННА','anatolievna':'АНАТОЛЬЕВНА',
  'dmitrievna':'ДМИТРИЕВНА','dmitry':'ДМИТРИЙ','dmitri':'ДМИТРИЙ',
  'nikolai':'НИКОЛАЙ','nikolaevich':'НИКОЛАЕВИЧ','natalia':'НАТАЛЬЯ',
  'natalya':'НАТАЛЬЯ','vladimir':'ВЛАДИМИР','vladimirovich':'ВЛАДИМИРОВИЧ',
  'andrei':'АНДРЕЙ','andreevich':'АНДРЕЕВИЧ','elena':'ЕЛЕНА',
  'evgeny':'ЕВГЕНИЙ','evgenia':'ЕВГЕНИЯ','peter':'ПЁТР','petr':'ПЁТР',
  'petrovich':'ПЕТРОВИЧ','yuri':'ЮРИЙ','yurii':'ЮРИЙ','yurevich':'ЮРЬЕВИЧ',
  'tatiana':'ТАТЬЯНА','tatiyana':'ТАТЬЯНА','olga':'ОЛЬГА','olegovich':'ОЛЕГОВИЧ',
  'maxim':'МАКСИМ','maximovich':'МАКСИМОВИЧ','roman':'РОМАН','romanovich':'РОМАНОВИЧ',
  'pavel':'ПАВЕЛ','pavlovich':'ПАВЛОВИЧ','artem':'АРТЁМ','artemovich':'АРТЁМОВИЧ',
  'maria':'МАРИЯ','marina':'МАРИНА','galina':'ГАЛИНА','irina':'ИРИНА',
  'larisa':'ЛАРИСА','liudmila':'ЛЮДМИЛА','ludmila':'ЛЮДМИЛА','svetlana':'СВЕТЛАНА',
  'valentina':'ВАЛЕНТИНА','victoria':'ВИКТОРИЯ','viktoria':'ВИКТОРИЯ',
  'konstantin':'КОНСТАНТИН','konstantinovich':'КОНСТАНТИНОВИЧ',
  'leonid':'ЛЕОНИД','leonidovna':'ЛЕОНИДОВНА','vadim':'ВАДИМ',
  'vadimovich':'ВАДИМОВИЧ','viktor':'ВИКТОР','viktorovich':'ВИКТОРОВИЧ',
  'gennady':'ГЕННАДИЙ','gennadievich':'ГЕННАДЬЕВИЧ',
  'anatoly':'АНАТОЛИЙ','anatolyevich':'АНАТОЛЬЕВИЧ',
  'boris':'БОРИС','borisovich':'БОРИСОВИЧ','igor':'ИГОРЬ',
  'igorevich':'ИГОРЕВИЧ','oleg':'ОЛЕГ',
};

// ─── ФУНКЦИИ ПЕРЕВОДА ─────────────────────────────────────

function translateName(str) {
  if (!str) return '';
  return str.split(' ').map(word => {
    const key = word.toLowerCase().replace(/[^a-zа-яё]/gi, '');
    if (NAMES[key]) return NAMES[key];
    // Если уже русское — вернуть заглавными
    if (/[а-яё]/i.test(word)) return word.toUpperCase();
    // Транслит посимвольно
    return translitWord(word).toUpperCase();
  }).join(' ');
}

function translitWord(word) {
  const map = {
    'shch':'щ','sch':'щ','zh':'ж','kh':'х','ts':'ц','ch':'ч','sh':'ш',
    'yu':'ю','ya':'я','yo':'ё','ye':'е',
    'a':'а','b':'б','c':'к','d':'д','e':'е','f':'ф','g':'г','h':'х',
    'i':'и','j':'й','k':'к','l':'л','m':'м','n':'н','o':'о','p':'п',
    'q':'к','r':'р','s':'с','t':'т','u':'у','v':'в','w':'в','x':'кс',
    'y':'й','z':'з',
  };
  let r = '', i = 0, w = word.toLowerCase();
  while (i < w.length) {
    if (map[w.slice(i,i+4)]) { r+=map[w.slice(i,i+4)]; i+=4; }
    else if (map[w.slice(i,i+3)]) { r+=map[w.slice(i,i+3)]; i+=3; }
    else if (map[w.slice(i,i+2)]) { r+=map[w.slice(i,i+2)]; i+=2; }
    else { r+=map[w[i]]||w[i]; i++; }
  }
  return r.charAt(0).toUpperCase() + r.slice(1);
}

// Дата: "FEBRUARY 26, 2022" → "26 ФЕВРАЛЯ 2022 г."
function translateDate(str) {
  if (!str) return '';
  if (/[а-яё]/i.test(str) && str.includes('г.')) return str.toUpperCase().replace('Г.','г.');
  const m = str.match(/(\w+)\s+(\d{1,2})[,\s]+(\d{4})/);
  if (m) {
    const ru = MONTHS[m[1].toLowerCase()];
    if (ru) return `${m[2].padStart(2,'0')} ${ru} ${m[3]} г.`;
  }
  // fallback
  let r = str;
  for (const [en,ru] of Object.entries(MONTHS)) {
    r = r.replace(new RegExp('\\b'+en+'\\b','gi'), ru);
  }
  if (/\d{4}/.test(r) && !r.includes('г.')) r += ' г.';
  return r.toUpperCase().replace('Г.','г.');
}

// Страна
function translateCountry(str) {
  if (!str) return '';
  const key = str.toLowerCase().trim();
  if (COUNTRIES[key]) return COUNTRIES[key];
  if (/[а-яё]/i.test(str)) return str.toUpperCase();
  return str.toUpperCase();
}

// Город + округ
function translateCity(str) {
  if (!str) return '';
  const low = str.toLowerCase().trim();
  // Проверяем точные совпадения
  for (const [en,ru] of Object.entries(CITIES)) {
    if (low.includes(en)) {
      // Добавляем округ если есть
      for (const [cen,cru] of Object.entries(COUNTIES)) {
        if (low.includes(cen.toLowerCase())) return ru + ', ' + cru;
      }
      return ru;
    }
  }
  // Если уже русское
  if (/[а-яё]/i.test(str)) return str.toUpperCase();
  // Переводим округ
  let r = str.toUpperCase();
  for (const [cen,cru] of Object.entries(COUNTIES)) {
    r = r.replace(new RegExp(cen,'gi'), cru);
  }
  r = r.replace(/\bCOUNTY\b/gi,'ОКРУГ').replace(/\bCITY\b/gi,'Г.');
  return r;
}

// Больница
function translateHospital(str) {
  if (!str) return '';
  return str
    .replace(/\bHOSPITAL\b/gi,'БОЛЬНИЦА')
    .replace(/\bMEDICAL CENTER\b/gi,'МЕДИЦИНСКИЙ ЦЕНТР')
    .replace(/\bMEDICAL CENTRE\b/gi,'МЕДИЦИНСКИЙ ЦЕНТР')
    .replace(/\bST\.?\s*PETERSBURG\b/gi,'СТ. ПИТЕРСБУРГ')
    .replace(/\bSAINT\s+PETERSBURG\b/gi,'САНКТ-ПЕТЕРБУРГ')
    .toUpperCase();
}

// Вес: "8 LBS 0 OZ" → "8 ФУНТОВ 0 УНЦИЙ"
function translateWeight(str) {
  if (!str) return '';
  return str
    .replace(/\bLBS?\b/gi,'ФУНТОВ')
    .replace(/\bOZS?\b/gi,'УНЦИЙ')
    .toUpperCase();
}

// ПОЛ — детерминированно без GPT
function translateSex(str) {
  if (!str) return 'МУЖСКОЙ';
  const s = str.toUpperCase().replace(/[^A-ZА-ЯЁ]/g,'');
  console.log('SEX from GPT:', JSON.stringify(str), '→ cleaned:', s);
  // FEMALE первым — содержит MALE внутри
  if (s.includes('FEMALE') || s.includes('ЖЕНСКИЙ') || s === 'F') return 'ЖЕНСКИЙ';
  if (s.includes('MALE') || s.includes('МУЖСКОЙ') || s === 'M') return 'МУЖСКОЙ';
  // Цифры — возможно 1=male, 2=female в некоторых форматах
  const n = str.trim();
  if (n === '2' || n === 'F' || n === 'f') return 'ЖЕНСКИЙ';
  return 'МУЖСКОЙ'; // default
}

// ─── HANDLER ──────────────────────────────────────────────

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ ok:false, error:'Method not allowed' });

  try {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = Buffer.concat(chunks);
    const boundary = (req.headers['content-type']||'').split('boundary=')[1];
    if (!boundary) return res.status(400).json({ ok:false, error:'No boundary' });

    const { b64, mime } = extractFile(body, boundary);
    if (!b64) return res.status(400).json({ ok:false, error:'No file' });

    // GPT только считывает сырой текст — не переводит
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type':'application/json', 'Authorization':`Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: 'gpt-4o',
        max_tokens: 800,
        messages: [{
          role: 'user',
          content: [
            { type:'image_url', image_url:{ url:`data:${mime};base64,${b64}`, detail:'high' } },
            { type:'text', text:`Read this US birth certificate carefully. Extract ONLY raw values exactly as printed. Do NOT translate anything.

Return ONLY valid JSON, no markdown:
{
  "lastName": "LAST name only from NAME field",
  "firstName": "FIRST name only from NAME field",
  "middleName": "MIDDLE name only from NAME field (patronymic)",
  "dob": "YYYY-MM-DD",
  "sex": "write exactly: MALE or FEMALE",
  "timeOfBirth": "HH:MM format",
  "weight": "e.g. 8 LBS 0 OZ",
  "hospital": "full hospital name from PLACE OF BIRTH",
  "cityCounty": "full city and county from CITY COUNTY OF BIRTH",
  "stateRegNum": "STATE FILE NUMBER",
  "dateIssued": "e.g. MARCH 8, 2022",
  "dateRegistered": "e.g. FEBRUARY 27, 2022",
  "motherName": "full name from MOTHER NAME field",
  "motherDob": "e.g. AUGUST 28, 1990",
  "motherBirthPlace": "country",
  "fatherName": "full name from FATHER NAME field",
  "fatherDob": "e.g. NOVEMBER 9, 1982",
  "fatherBirthPlace": "country",
  "reqNum": "REQ number at bottom, digits only"
}

IMPORTANT: For NAME field - the order is usually FIRST MIDDLE LAST. Split correctly:
Example: "MARK ALEKSEEVICH KIRZOV" → firstName="MARK", middleName="ALEKSEEVICH", lastName="KIRZOV"` }
          ]
        }]
      })
    });

    const data = await response.json();
    if (data.error) return res.status(400).json({ ok:false, error:data.error.message });

    let txt = (data.choices?.[0]?.message?.content||'{}').replace(/```json|```/g,'').trim();
    const raw = JSON.parse(txt);

    // Весь перевод — на сервере, без GPT
    const result = {
      lastName:         translateName(raw.lastName),
      firstName:        translateName(raw.firstName),
      middleName:       translateName(raw.middleName),
      dob:              raw.dob || '',
      sex:              translateSex(raw.sex),
      timeOfBirth:      raw.timeOfBirth || '',
      weight:           translateWeight(raw.weight),
      hospital:         translateHospital(raw.hospital),
      cityCounty:       translateCity(raw.cityCounty),
      stateRegNum:      raw.stateRegNum || '',
      dateIssued:       translateDate(raw.dateIssued),
      dateRegistered:   translateDate(raw.dateRegistered),
      motherName:       translateName(raw.motherName),
      motherDob:        translateDate(raw.motherDob),
      motherBirthPlace: translateCountry(raw.motherBirthPlace),
      fatherName:       translateName(raw.fatherName),
      fatherDob:        translateDate(raw.fatherDob),
      fatherBirthPlace: translateCountry(raw.fatherBirthPlace),
      reqNum:           (raw.reqNum||'').replace(/[^0-9]/g,''),
    };

    return res.status(200).json({ ok:true, data:result });

  } catch(err) {
    console.error('OCR error:', err);
    return res.status(500).json({ ok:false, error:err.message });
  }
}

function extractFile(body, boundary) {
  const sep = Buffer.from('--'+boundary);
  const parts = splitBuf(body, sep);
  for (const part of parts) {
    const hEnd = part.indexOf('\r\n\r\n');
    if (hEnd === -1) continue;
    const headers = part.slice(0,hEnd).toString();
    if (!headers.includes('filename')) continue;
    const mm = headers.match(/Content-Type:\s*([^\r\n]+)/i);
    const mime = mm ? mm[1].trim() : 'image/jpeg';
    return { b64: part.slice(hEnd+4, part.length-2).toString('base64'), mime };
  }
  return { b64:null, mime:null };
}

function splitBuf(buf, sep) {
  const parts=[]; let start=0, idx;
  while((idx=buf.indexOf(sep,start))!==-1){ parts.push(buf.slice(start,idx)); start=idx+sep.length; }
  parts.push(buf.slice(start));
  return parts.filter(p=>p.length>4);
}
