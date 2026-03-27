export const config = { api: { bodyParser: false } };

// Таблица транслитерации EN→RU
const TRANSLIT = {
  'a':'а','b':'б','c':'к','d':'д','e':'е','f':'ф','g':'г','h':'х',
  'i':'и','j':'й','k':'к','l':'л','m':'м','n':'н','o':'о','p':'п',
  'q':'к','r':'р','s':'с','t':'т','u':'у','v':'в','w':'в','x':'кс',
  'y':'й','z':'з',
  'ch':'ч','sh':'ш','shch':'щ','zh':'ж','kh':'х','ts':'ц','yu':'ю','ya':'я',
  'A':'А','B':'Б','C':'К','D':'Д','E':'Е','F':'Ф','G':'Г','H':'Х',
  'I':'И','J':'Й','K':'К','L':'Л','M':'М','N':'Н','O':'О','P':'П',
  'Q':'К','R':'Р','S':'С','T':'Т','U':'У','V':'В','W':'В','X':'КС',
  'Y':'Й','Z':'З',
};

// Известные имена EN→RU
const KNOWN_NAMES = {
  'mark':'Марк','alekseevich':'Алексеевич','kirzov':'Кирзов',
  'ekaterina':'Екатерина','olegovna':'Олеговна','golod':'Голод',
  'aleksei':'Алексей','leonidovich':'Леонидович',
  'alexander':'Александр','alexandra':'Александра',
  'mikhail':'Михаил','mikhailovich':'Михайлович',
  'sergei':'Сергей','sergey':'Сергей','sergeevich':'Сергеевич',
  'ivan':'Иван','ivanovich':'Иванович','ivanova':'Иванова','ivanov':'Иванов',
  'anna':'Анна','anatolievna':'Анатольевна','анатольевна':'Анатольевна',
  'dmitrievna':'Дмитриевна','dmitry':'Дмитрий','dmitri':'Дмитрий',
  'nikolai':'Николай','nikolaevich':'Николаевич',
  'natalia':'Наталья','natalya':'Наталья',
  'vladimir':'Владимир','vladimirovich':'Владимирович',
  'andrei':'Андрей','andreevich':'Андреевич',
  'elena':'Елена','evgeny':'Евгений','evgenia':'Евгения',
  'peter':'Пётр','petr':'Пётр','petrovich':'Петрович',
  'yuri':'Юрий','yurii':'Юрий','yurevich':'Юрьевич',
  'tatiana':'Татьяна','tatiyana':'Татьяна',
  'olga':'Ольга','olegovich':'Олегович',
  'maxim':'Максим','maximovich':'Максимович',
  'roman':'Роман','romanovich':'Романович',
  'pavel':'Павел','pavlovich':'Павлович',
  'artem':'Артём','artemovich':'Артёмович',
};

function translitName(str) {
  if (!str) return '';
  // Check if already in Russian
  if (/[а-яёА-ЯЁ]/.test(str)) return str;
  
  return str.split(' ').map(word => {
    const lower = word.toLowerCase();
    if (KNOWN_NAMES[lower]) return KNOWN_NAMES[lower];
    // Simple char-by-char transliteration
    let result = '';
    let i = 0;
    while (i < word.length) {
      const ch4 = word.slice(i, i+4).toLowerCase();
      const ch3 = word.slice(i, i+3).toLowerCase();
      const ch2 = word.slice(i, i+2).toLowerCase();
      const ch1 = word[i];
      if (ch4 === 'shch') { result += 'щ'; i += 4; }
      else if (ch3 === 'sch') { result += 'щ'; i += 3; }
      else if (ch2 === 'ch') { result += 'ч'; i += 2; }
      else if (ch2 === 'sh') { result += 'ш'; i += 2; }
      else if (ch2 === 'zh') { result += 'ж'; i += 2; }
      else if (ch2 === 'kh') { result += 'х'; i += 2; }
      else if (ch2 === 'ts') { result += 'ц'; i += 2; }
      else if (ch2 === 'yu') { result += 'ю'; i += 2; }
      else if (ch2 === 'ya') { result += 'я'; i += 2; }
      else if (ch2 === 'yo') { result += 'ё'; i += 2; }
      else if (ch2 === 'ye') { result += 'е'; i += 2; }
      else {
        const mapped = TRANSLIT[ch1];
        result += mapped || ch1;
        i++;
      }
    }
    // Capitalize first letter
    return result.charAt(0).toUpperCase() + result.slice(1);
  }).join(' ');
}

// Перевод месяцев EN→RU
const MONTHS_EN_RU = {
  'january':'ЯНВАРЯ','february':'ФЕВРАЛЯ','march':'МАРТА','april':'АПРЕЛЯ',
  'may':'МАЯ','june':'ИЮНЯ','july':'ИЮЛЯ','august':'АВГУСТА',
  'september':'СЕНТЯБРЯ','october':'ОКТЯБРЯ','november':'НОЯБРЯ','december':'ДЕКАБРЯ',
};

function translateDate(str) {
  if (!str) return '';
  if (/[а-яёА-ЯЁ]/.test(str)) return str; // already Russian
  
  // Match: MONTH D, YYYY or MONTH DD, YYYY
  const m = str.match(/(\w+)\s+(\d{1,2}),?\s+(\d{4})/);
  if (m) {
    const monthRu = MONTHS_EN_RU[m[1].toLowerCase()];
    if (monthRu) {
      const day = m[2].padStart(2, '0');
      return `${day} ${monthRu} ${m[3]} г.`;
    }
  }
  // Fallback: just replace month names
  let result = str;
  for (const [en, ru] of Object.entries(MONTHS_EN_RU)) {
    result = result.replace(new RegExp(en, 'gi'), ru);
  }
  result = result.trim();
  if (result && !result.endsWith('г.') && /\d{4}/.test(result)) result += ' г.';
  return result;
}

// Перевод стран/мест EN→RU
function translatePlace(str) {
  if (!str) return '';
  if (/[а-яёА-ЯЁ]/.test(str)) return str;
  const map = {
    'RUSSIA': 'РОССИЯ', 'RUSSIAN FEDERATION': 'РОССИЙСКАЯ ФЕДЕРАЦИЯ',
    'BELARUS': 'БЕЛАРУСЬ', 'UKRAINE': 'УКРАИНА', 'KAZAKHSTAN': 'КАЗАХСТАН',
    'USA': 'США', 'UNITED STATES': 'США', 'UNITED STATES OF AMERICA': 'США',
    'GEORGIA': 'ГРУЗИЯ', 'MOLDOVA': 'МОЛДОВА', 'LATVIA': 'ЛАТВИЯ',
    'LITHUANIA': 'ЛИТВА', 'ESTONIA': 'ЭСТОНИЯ', 'ARMENIA': 'АРМЕНИЯ',
    'AZERBAIJAN': 'АЗЕРБАЙДЖАН', 'UZBEKISTAN': 'УЗБЕКИСТАН',
    'KYRGYZSTAN': 'КЫРГЫЗСТАН', 'TAJIKISTAN': 'ТАДЖИКИСТАН',
    'TURKMENISTAN': 'ТУРКМЕНИСТАН',
  };
  const upper = str.toUpperCase().trim();
  return map[upper] || str;
}

function translateHospital(str) {
  if (!str) return '';
  if (/[а-яёА-ЯЁ]{4,}/.test(str)) return str;
  return str
    .replace(/\bHOSPITAL\b/gi, 'БОЛЬНИЦА')
    .replace(/\bMEDICAL CENTER\b/gi, 'МЕДИЦИНСКИЙ ЦЕНТР')
    .replace(/\bMEDICAL CENTRE\b/gi, 'МЕДИЦИНСКИЙ ЦЕНТР')
    .replace(/\bST\.?\s+PETERSBURG\b/gi, 'СТ. ПИТЕРСБУРГ')
    .replace(/\bSAINT\s+PETERSBURG\b/gi, 'САНКТ-ПЕТЕРБУРГ')
    .replace(/\bBAYFRONT\b/gi, 'BAYFRONT')
    .replace(/\bHEALTH\b/gi, 'HEALTH');
}

function translateCity(str) {
  if (!str) return '';
  if (/[а-яёА-ЯЁ]{4,}/.test(str)) return str;
  return str
    .replace(/\bST\.?\s+PETERSBURG\b/gi, 'Г. САНКТ-ПЕТЕРБУРГ')
    .replace(/\bSAINT\s+PETERSBURG\b/gi, 'Г. САНКТ-ПЕТЕРБУРГ')
    .replace(/\bPINELLAS\s+COUNTY\b/gi, 'ОКРУГ ПИНЕЛЛАС')
    .replace(/\bHILLSBOROUGH\s+COUNTY\b/gi, 'ОКРУГ ХИЛЛСБОРО')
    .replace(/\bORANGE\s+COUNTY\b/gi, 'ОКРУГ ОРИНДЖ')
    .replace(/\bBROWARD\s+COUNTY\b/gi, 'ОКРУГ БРОУАРД')
    .replace(/\bMIAMI.DADE\s+COUNTY\b/gi, 'ОКРУГ МАЙАМИ-ДЕЙД')
    .replace(/\bCOUNTY\b/gi, 'ОКРУГ')
    .replace(/\bMIAMI\b/gi, 'Г. МАЙАМИ')
    .replace(/\bORLANDO\b/gi, 'Г. ОРЛАНДО')
    .replace(/\bTAMPA\b/gi, 'Г. ТАМПА')
    .replace(/\bJACKSONVILLE\b/gi, 'Г. ДЖЭКСОНВИЛЛ')
    .replace(/\bFORT LAUDERDALE\b/gi, 'Г. ФОРТ-ЛОДЕРДЕЙЛ')
    .replace(/\bCLEARWATER\b/gi, 'Г. КЛИРУОТЕР');
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  try {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = Buffer.concat(chunks);
    const contentType = req.headers['content-type'] || '';
    const boundary = contentType.split('boundary=')[1];
    if (!boundary) return res.status(400).json({ ok: false, error: 'No boundary' });

    const { b64, mime } = extractFile(body, boundary);
    if (!b64) return res.status(400).json({ ok: false, error: 'No file in request' });

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        max_tokens: 1200,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url: `data:${mime};base64,${b64}`, detail: 'high' }
            },
            {
              type: 'text',
              text: `You are extracting data from a US Florida birth certificate. Read ALL text carefully.

CRITICAL RULES - follow exactly:

1. NAME field contains child's full name. Split into:
   - firstName = FIRST name only (e.g. "MARK")  
   - middleName = MIDDLE name only (e.g. "ALEKSEEVICH") 
   - lastName = LAST name only (e.g. "KIRZOV")

2. SEX field: read it carefully. If it says "MALE" or "M" → output "MALE". If "FEMALE" or "F" → output "FEMALE". Do NOT guess.

3. DATE OF BIRTH: output as YYYY-MM-DD. Example: FEBRUARY 26, 2022 → "2022-02-26"

4. TIME OF BIRTH: digits only formatted as HH:MM. Example: 1411 → "14:11"

5. WEIGHT: exact text. Example: 8 LBS 0 OZ

6. PLACE OF BIRTH: copy the FULL hospital name exactly as written, including city

7. CITY, COUNTY OF BIRTH: copy the FULL city and county exactly as written

8. STATE FILE NUMBER: exact number

9. DATE ISSUED and DATE FILED/REGISTERED: exact text as written (e.g. "MARCH 8, 2022")

10. MOTHER and FATHER names: copy exactly as written, include all three name parts

11. Mother/Father dates and birthplaces: copy exactly as written

Return ONLY this JSON, no markdown:
{
  "lastName": "",
  "firstName": "",
  "middleName": "",
  "dob": "YYYY-MM-DD",
  "sex": "MALE or FEMALE",
  "timeOfBirth": "HH:MM",
  "weight": "",
  "hospital": "",
  "cityCounty": "",
  "stateRegNum": "",
  "dateIssued": "",
  "dateRegistered": "",
  "motherName": "",
  "motherDob": "",
  "motherBirthPlace": "",
  "fatherName": "",
  "fatherDob": "",
  "fatherBirthPlace": ""
}`
            }
          ]
        }]
      })
    });

    const data = await response.json();
    if (data.error) return res.status(400).json({ ok: false, error: data.error.message });

    let txt = (data.choices?.[0]?.message?.content || '{}').replace(/```json|```/g, '').trim();
    const raw = JSON.parse(txt);

    // Post-process: translate everything to Russian
    const result = {
      lastName:        translitName(raw.lastName),
      firstName:       translitName(raw.firstName),
      middleName:      translitName(raw.middleName),
      dob:             raw.dob || '',
     sex: (() => {
  const s = (raw.sex || '').toUpperCase().trim();
  console.log('RAW SEX VALUE:', JSON.stringify(raw.sex), '| PROCESSED:', s);
  if (s === 'FEMALE' || s === 'F' || s.includes('FEMALE')) return 'ЖЕНСКИЙ';
  if (s === 'MALE' || s === 'M' || s.includes('MALE')) return 'МУЖСКОЙ';
  return 'МУЖСКОЙ';
  })(),
      timeOfBirth:     raw.timeOfBirth || '',
      weight:          (raw.weight || '')
                         .replace(/LBS?/gi, 'фунтов')
                         .replace(/OZS?/gi, 'унций')
                         .replace(/\s+/g, ' ').trim(),
      hospital:        translateHospital(raw.hospital),
      cityCounty:      translateCity(raw.cityCounty),
      stateRegNum:     raw.stateRegNum || '',
      dateIssued:      translateDate(raw.dateIssued),
      dateRegistered:  translateDate(raw.dateRegistered),
      motherName:      translitName(raw.motherName),
      motherDob:       translateDate(raw.motherDob),
      motherBirthPlace:translatePlace(raw.motherBirthPlace),
      fatherName:      translitName(raw.fatherName),
      fatherDob:       translateDate(raw.fatherDob),
      fatherBirthPlace:translatePlace(raw.fatherBirthPlace),
    };

    return res.status(200).json({ ok: true, data: result });

  } catch (err) {
    console.error('OCR error:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}

function extractFile(body, boundary) {
  const sep = Buffer.from('--' + boundary);
  const parts = splitBuf(body, sep);
  for (const part of parts) {
    const hEnd = part.indexOf('\r\n\r\n');
    if (hEnd === -1) continue;
    const headers = part.slice(0, hEnd).toString();
    if (!headers.includes('filename')) continue;
    const mimeMatch = headers.match(/Content-Type:\s*([^\r\n]+)/i);
    const mime = mimeMatch ? mimeMatch[1].trim() : 'image/jpeg';
    const fileData = part.slice(hEnd + 4, part.length - 2);
    return { b64: fileData.toString('base64'), mime };
  }
  return { b64: null, mime: null };
}

function splitBuf(buf, sep) {
  const parts = [];
  let start = 0, idx;
  while ((idx = buf.indexOf(sep, start)) !== -1) {
    parts.push(buf.slice(start, idx));
    start = idx + sep.length;
  }
  parts.push(buf.slice(start));
  return parts.filter(p => p.length > 4);
}
