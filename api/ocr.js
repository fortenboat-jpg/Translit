export const config = { api: { bodyParser: false } };

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
    const boundary = (req.headers['content-type'] || '').split('boundary=')[1];
    if (!boundary) return res.status(400).json({ ok: false, error: 'No boundary' });

    const { b64, mime } = extractFile(body, boundary);
    if (!b64) return res.status(400).json({ ok: false, error: 'No file' });

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        max_tokens: 800,
        messages: [{
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: `data:${mime};base64,${b64}`, detail: 'high' } },
            {
              type: 'text',
              text: `This is a US Florida birth certificate. Extract data and return ONLY valid JSON.

STRICT RULES:
- cityCounty: copy the EXACT text from "CITY, COUNTY OF BIRTH" field as printed. Do not change anything.
- hospital: copy the EXACT text from "PLACE OF BIRTH" field as printed. Do not change anything.
- sex: write only "MALE" or "FEMALE"
- dob: YYYY-MM-DD format
- timeOfBirth: HH:MM format
- weightLbs and weightOz: numbers only

{
  "firstName": "child first name",
  "middleName": "child middle name",
  "lastName": "child last name",
  "dob": "YYYY-MM-DD",
  "sex": "MALE or FEMALE",
  "timeOfBirth": "HH:MM",
  "weightLbs": "number",
  "weightOz": "number",
  "hospital": "exact text from document",
  "cityCounty": "exact text from document",
  "stateRegNum": "state file number",
  "dateIssued": "MONTH DD, YYYY",
  "dateRegistered": "MONTH DD, YYYY",
  "motherFirstName": "first name",
  "motherMiddleName": "middle name",
  "motherLastName": "last name",
  "motherDob": "MONTH DD, YYYY",
  "motherBirthCountry": "country",
  "fatherFirstName": "first name",
  "fatherMiddleName": "middle name",
  "fatherLastName": "last name",
  "fatherDob": "MONTH DD, YYYY",
  "fatherBirthCountry": "country",
  "reqNum": "REQ number digits only"
}

NAME order in US certificates: FIRST MIDDLE LAST
Example: "MARK ALEKSEEVICH KIRZOV" → firstName=MARK, middleName=ALEKSEEVICH, lastName=KIRZOV`
            }
          ]
        }]
      })
    });

    const data = await response.json();
    if (data.error) return res.status(400).json({ ok: false, error: data.error.message });

    let txt = (data.choices?.[0]?.message?.content || '{}').replace(/```json|```/g, '').trim();
    const raw = JSON.parse(txt);
    console.log('RAW OCR:', JSON.stringify(raw));

    // All translation happens HERE on server - deterministic, no GPT
    const result = {
      firstName:        nameToRu(raw.firstName),
      middleName:       nameToRu(raw.middleName),
      lastName:         nameToRu(raw.lastName),
      dob:              raw.dob || '',
      sex:              sexToRu(raw.sex),
      timeOfBirth:      raw.timeOfBirth || '',
      weight:           weightToRu(raw.weightLbs, raw.weightOz),
      hospital:         hospitalToRu(raw.hospital),
      hospitalType:     hospitalTypeToRu(raw.hospital),
      cityCounty:       cityCountyToRu(raw.cityCounty || (raw.city && raw.county ? raw.city+', '+raw.county : raw.city || raw.county || '')),
      stateRegNum:      raw.stateRegNum || '',
      dateIssued:       dateToRu(raw.dateIssued),
      dateRegistered:   dateToRu(raw.dateRegistered),
      motherFirstName:  nameToRu(raw.motherFirstName),
      motherMiddleName: nameToRu(raw.motherMiddleName),
      motherLastName:   nameToRu(raw.motherLastName),
      motherDob:        dateToRu(raw.motherDob),
      motherBirthPlace: countryToRu(raw.motherBirthCountry),
      fatherFirstName:  nameToRu(raw.fatherFirstName),
      fatherMiddleName: nameToRu(raw.fatherMiddleName),
      fatherLastName:   nameToRu(raw.fatherLastName),
      fatherDob:        dateToRu(raw.fatherDob),
      fatherBirthPlace: countryToRu(raw.fatherBirthCountry),
      reqNum:           (raw.reqNum || '').replace(/[^0-9]/g, ''),
    };

    // Combine full names
    result.childName     = [result.lastName, result.firstName, result.middleName].filter(Boolean).join(' ');
    result.motherName    = [result.motherLastName, result.motherFirstName, result.motherMiddleName].filter(Boolean).join(' ');
    result.fatherName    = [result.fatherLastName, result.fatherFirstName, result.fatherMiddleName].filter(Boolean).join(' ');

    console.log('RESULT:', JSON.stringify(result));
    return res.status(200).json({ ok: true, data: result });

  } catch (err) {
    console.error('OCR error:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}

// ── TRANSLATION FUNCTIONS ────────────────────────────────

const MONTHS_EN = {
  'january':'ЯНВАРЯ','february':'ФЕВРАЛЯ','march':'МАРТА','april':'АПРЕЛЯ',
  'may':'МАЯ','june':'ИЮНЯ','july':'ИЮЛЯ','august':'АВГУСТА',
  'september':'СЕНТЯБРЯ','october':'ОКТЯБРЯ','november':'НОЯБРЯ','december':'ДЕКАБРЯ',
};

const NAMES_DICT = {
  'mark':'МАРК','alekseevich':'АЛЕКСЕЕВИЧ','kirzov':'КИРЗОВ',
  'aleksei':'АЛЕКСЕЙ','aleksey':'АЛЕКСЕЙ','alexei':'АЛЕКСЕЙ','alexey':'АЛЕКСЕЙ',
  'ekaterina':'ЕКАТЕРИНА','katerina':'КАТЕРИНА','katya':'КАТЯ',
  'olegovna':'ОЛЕГОВНА','olegovich':'ОЛЕГОВИЧ',
  'golod':'ГОЛОД','kirzova':'КИРЗОВА',
  'leonidovich':'ЛЕОНИДОВИЧ','leonidovna':'ЛЕОНИДОВНА','leonid':'ЛЕОНИД',
  'alexander':'АЛЕКСАНДР','alexandra':'АЛЕКСАНДРА',
  'mikhail':'МИХАИЛ','mikhailovich':'МИХАЙЛОВИЧ','mikhailovna':'МИХАЙЛОВНА',
  'sergei':'СЕРГЕЙ','sergey':'СЕРГЕЙ','sergeevich':'СЕРГЕЕВИЧ','sergeevna':'СЕРГЕЕВНА',
  'ivan':'ИВАН','ivanovich':'ИВАНОВИЧ','ivanova':'ИВАНОВА','ivanov':'ИВАНОВ','ivanovna':'ИВАНОВНА',
  'anna':'АННА','anatolievich':'АНАТОЛЬЕВИЧ','anatolievna':'АНАТОЛЬЕВНА','anatoly':'АНАТОЛИЙ',
  'dmitrievich':'ДМИТРИЕВИЧ','dmitrievna':'ДМИТРИЕВНА','dmitry':'ДМИТРИЙ','dmitri':'ДМИТРИЙ',
  'nikolai':'НИКОЛАЙ','nikolaevich':'НИКОЛАЕВИЧ','nikolaevna':'НИКОЛАЕВНА',
  'natalia':'НАТАЛЬЯ','natalya':'НАТАЛЬЯ','natalievna':'НАТАЛЬЕВНА',
  'vladimir':'ВЛАДИМИР','vladimirovich':'ВЛАДИМИРОВИЧ','vladimirovna':'ВЛАДИМИРОВНА',
  'andrei':'АНДРЕЙ','andreevich':'АНДРЕЕВИЧ','andreevna':'АНДРЕЕВНА',
  'elena':'ЕЛЕНА','evgeny':'ЕВГЕНИЙ','evgenia':'ЕВГЕНИЯ','evgenevich':'ЕВГЕНЬЕВИЧ','evgenevna':'ЕВГЕНЬЕВНА',
  'petr':'ПЁТР','peter':'ПЁТР','petrovich':'ПЕТРОВИЧ','petrovna':'ПЕТРОВНА',
  'yuri':'ЮРИЙ','yurii':'ЮРИЙ','yurevich':'ЮРЬЕВИЧ','yurevna':'ЮРЬЕВНА',
  'tatiana':'ТАТЬЯНА','tatiyana':'ТАТЬЯНА',
  'olga':'ОЛЬГА','maxim':'МАКСИМ','maximovich':'МАКСИМОВИЧ','maximovna':'МАКСИМОВНА',
  'roman':'РОМАН','romanovich':'РОМАНОВИЧ','romanovna':'РОМАНОВНА',
  'pavel':'ПАВЕЛ','pavlovich':'ПАВЛОВИЧ','pavlovna':'ПАВЛОВНА',
  'artem':'АРТЁМ','artemovich':'АРТЁМОВИЧ','artemovna':'АРТЁМОВНА',
  'maria':'МАРИЯ','marina':'МАРИНА','galina':'ГАЛИНА','irina':'ИРИНА',
  'svetlana':'СВЕТЛАНА','valentina':'ВАЛЕНТИНА','victoria':'ВИКТОРИЯ','viktoria':'ВИКТОРИЯ',
  'konstantin':'КОНСТАНТИН','konstantinovich':'КОНСТАНТИНОВИЧ','konstantinovna':'КОНСТАНТИНОВНА',
  'vadim':'ВАДИМ','vadimovich':'ВАДИМОВИЧ','vadimovna':'ВАДИМОВНА',
  'viktor':'ВИКТОР','viktorovich':'ВИКТОРОВИЧ','viktorovna':'ВИКТОРОВНА',
  'boris':'БОРИС','borisovich':'БОРИСОВИЧ','borisovna':'БОРИСОВНА',
  'igor':'ИГОРЬ','igorevich':'ИГОРЕВИЧ','igorevna':'ИГОРЕВНА',
  'oleg':'ОЛЕГ','gennady':'ГЕННАДИЙ','gennadievich':'ГЕННАДЬЕВИЧ',
  // Английские имена
  'rosa':'РОЗА','rose':'РОЗА','joie':'ДЖОИ','joy':'ДЖОЙ',
  'taylor':'ТЕЙЛОР','jefferson':'ДЖЕФФЕРСОН','alonzo':'АЛОНЗО',
  'david':'ДЭВИД','harms':'ХАРМС','central':'СЕНТРАЛ',
  'michael':'МАЙКЛ','james':'ДЖЕЙМС','john':'ДЖОН','robert':'РОБЕРТ',
  'william':'УИЛЬЯМ','richard':'РИЧАРД','joseph':'ДЖОЗЕФ','thomas':'ТОМАС',
  'charles':'ЧАРЛЬЗ','christopher':'КРИСТОФЕР','daniel':'ДЭНИЕЛ',
  'matthew':'МЭТТЬЮ','anthony':'ЭНТОНИ','donald':'ДОНАЛЬД',
  'mark':'МАРК','paul':'ПОЛ','steven':'СТИВЕН','kenneth':'КЕННЕТ',
  'joshua':'ДЖОШУА','kevin':'КЕВИН','brian':'БРАЙАН','george':'ДЖОРДЖ',
  'mary':'МЭРИ','patricia':'ПАТРИЦИЯ','linda':'ЛИНДА','barbara':'БАРБАРА',
  'elizabeth':'ЭЛИЗАБЕТ','jennifer':'ДЖЕННИФЕР','maria':'МАРИЯ',
  'susan':'СЬЮЗАН','margaret':'МАРГАРЕТ','dorothy':'ДОРОТИ',
  'lisa':'ЛИЗА','nancy':'НЭНСИ','karen':'КАРЕН','betty':'БЕТТИ',
  'helen':'ХЕЛЕН','sandra':'САНДРА','donna':'ДОННА','carol':'КЭРОЛ',
  'ruth':'РУТ','sharon':'ШАРОН','michelle':'МИШЕЛЬ','laura':'ЛОРА',
  'sarah':'САРА','kimberly':'КИМБЕРЛИ','jessica':'ДЖЕССИКА',
  'shirley':'ШИРЛИ','angela':'АНДЖЕЛА','melissa':'МЕЛИССА',
  'brenda':'БРЕНДА','amy':'ЭЙМ','anna':'АННА','rebecca':'РЕБЕККА',
  'virginia':'ВИРДЖИНИЯ','kathleen':'КЭТЛИН','pamela','ПАМЕЛА',
  'martha':'МАРТА','debra':'ДЕБРА','amanda':'АМАНДА','stephanie':'СТЕФАНИ',
  'caroline':'КАРОЛИН','henry':'ГЕНРИ','arthur':'АРТУР','ryan':'РАЙАН',
  'jacob':'ДЖЕЙКОБ','gary':'ГЭРИ','nicholas':'НИКОЛАС','eric':'ЭРИК',
  'jonathan':'ДЖОНАТАН','stephen':'СТИВЕН','larry':'ЛАРРИ','justin':'ДЖАСТИН',
  'scott':'СКОТТ','brandon':'БРЭНДОН','benjamin':'БЕНДЖАМИН','samuel':'СЭМЮЭЛ',
  'raymond':'РЕЙМОНД','gregory':'ГРЕГОРИ','frank':'ФРЭНК','alexander':'АЛЕКСАНДР',
  'patrick':'ПАТРИК','jack':'ДЖЕК','dennis':'ДЕННИС','jerry':'ДЖЕРРИ',
  'tyler':'ТАЙЛЕР','aaron':'ААРОН','jose':'ХОСЕ','adam':'АДАМ',
  'nathan':'НАТАН','henry':'ГЕНРИ','douglas':'ДУГЛАС','zachary':'ЗАХАРИ',
  'peter':'ПИТЕР','kyle':'КАЙЛ','ethan':'ИТАН','walter':'УОЛТЕР',
  'noah':'НОА','jeremy':'ДЖЕРЕМИ','christian':'КРИСТИАН','harold':'ХАРОЛД',
  'jordan':'ДЖОРДАН','wayne':'УЭЙН','alan':'АЛАН','juan':'ХУАН',
};

const COUNTRIES_DICT = {
  'russia':'РОССИЯ','russian federation':'РОССИЙСКАЯ ФЕДЕРАЦИЯ',
  'belarus':'БЕЛАРУСЬ','ukraine':'УКРАИНА','kazakhstan':'КАЗАХСТАН',
  'usa':'США','united states':'США','united states of america':'США',
  'georgia':'ГРУЗИЯ','moldova':'МОЛДОВА','latvia':'ЛАТВИЯ',
  'lithuania':'ЛИТВА','estonia':'ЭСТОНИЯ','armenia':'АРМЕНИЯ',
  'azerbaijan':'АЗЕРБАЙДЖАН','uzbekistan':'УЗБЕКИСТАН','kyrgyzstan':'КЫРГЫЗСТАН',
  'tajikistan':'ТАДЖИКИСТАН','turkmenistan':'ТУРКМЕНИСТАН','germany':'ГЕРМАНИЯ',
  'france':'ФРАНЦИЯ','israel':'ИЗРАИЛЬ','china':'КИТАЙ','poland':'ПОЛЬША',
  'ohio':'ОГАЙО, США','florida':'ФЛОРИДА, США','california':'КАЛИФОРНИЯ, США',
  'new york':'НЬЮ-ЙОРК, США','texas':'ТЕХАС, США','illinois':'ИЛЛИНОЙС, США',
  'pennsylvania':'ПЕНСИЛЬВАНИЯ, США','michigan':'МИЧИГАН, США',
  'north carolina':'СЕВЕРНАЯ КАРОЛИНА, США','new jersey':'НЬЮ-ДЖЕРСИ, США',
  'virginia':'ВИРДЖИНИЯ, США','washington':'ВАШИНГТОН, США',
  'arizona':'АРИЗОНА, США','massachusetts':'МАССАЧУСЕТС, США',
  'tennessee':'ТЕННЕССИ, США','indiana':'ИНДИАНА, США',
  'missouri':'МИССУРИ, США','colorado':'КОЛОРАДО, США',
  'alabama':'АЛАБАМА, США','louisiana':'ЛУИЗИАНА, США',
};

const CITIES_DICT = {
  'st petersburg':'Г. САНКТ-ПЕТЕРБУРГ','st. petersburg':'Г. САНКТ-ПЕТЕРБУРГ',
  'saint petersburg':'Г. САНКТ-ПЕТЕРБУРГ',
  'miami':'Г. МАЙАМИ','orlando':'Г. ОРЛАНДО','tampa':'Г. ТАМПА',
  'jacksonville':'Г. ДЖЭКСОНВИЛЛ','clearwater':'Г. КЛИРУОТЕР',
  'fort lauderdale':'Г. ФОРТ-ЛОДЕРДЕЙЛ','tallahassee':'Г. ТАЛЛАХАССИ',
  'gainesville':'Г. ГЕЙНСВИЛЛ','pensacola':'Г. ПЕНСАКОЛА',
  'naples':'Г. НЕАПОЛЬ','sarasota':'Г. САРАСОТА',
};

const COUNTIES_DICT = {
  'pinellas':'ОКРУГ ПИНЕЛЛАС','hillsborough':'ОКРУГ ХИЛЛСБОРО',
  'orange':'ОКРУГ ОРИНДЖ','miami-dade':'ОКРУГ МАЙАМИ-ДЕЙД','broward':'ОКРУГ БРОУАРД',
  'palm beach':'ОКРУГ ПАЛМ-БИЧ','duval':'ОКРУГ ДЮВАЛЬ','lee':'ОКРУГ ЛИ',
  'polk':'ОКРУГ ПОЛК','volusia':'ОКРУГ ВОЛУША','collier':'ОКРУГ КОЛЬЕ',
  'sarasota':'ОКРУГ САРАСОТА','manatee':'ОКРУГ МАНАТИ',
};

function nameToRu(str) {
  if (!str) return '';
  return str.split(/[\s-]/).map(word => {
    const key = word.toLowerCase().replace(/[^a-zа-яё]/gi, '');
    if (!key) return '';
    if (NAMES_DICT[key]) return NAMES_DICT[key];
    if (/[а-яё]/i.test(word)) return word.toUpperCase();
    return translitWord(word).toUpperCase();
  }).join(' ').trim();
}

function translitWord(word) {
  const pairs = [
    ['shch','щ'],['sch','щ'],['zh','ж'],['kh','х'],['ts','ц'],
    ['ch','ч'],['sh','ш'],['yu','ю'],['ya','я'],['yo','ё'],['ye','е'],
    ['a','а'],['b','б'],['c','к'],['d','д'],['e','е'],['f','ф'],['g','г'],
    ['h','х'],['i','и'],['j','й'],['k','к'],['l','л'],['m','м'],['n','н'],
    ['o','о'],['p','п'],['q','к'],['r','р'],['s','с'],['t','т'],['u','у'],
    ['v','в'],['w','в'],['x','кс'],['y','й'],['z','з'],
  ];
  let r = '', i = 0, w = word.toLowerCase();
  while (i < w.length) {
    let matched = false;
    for (const [en, ru] of pairs) {
      if (w.startsWith(en, i)) { r += ru; i += en.length; matched = true; break; }
    }
    if (!matched) { r += w[i]; i++; }
  }
  return r.charAt(0).toUpperCase() + r.slice(1);
}

function sexToRu(str) {
  if (!str) return 'МУЖСКОЙ';
  const s = str.toUpperCase().replace(/[^A-ZА-ЯЁ]/g, '');
  console.log('SEX INPUT:', JSON.stringify(str), 'CLEANED:', s);
  if (s === 'FEMALE' || s === 'F') return 'ЖЕНСКИЙ';
  if (s.startsWith('FEMALE')) return 'ЖЕНСКИЙ';
  if (s === 'MALE' || s === 'M') return 'МУЖСКОЙ';
  if (s.startsWith('MALE')) return 'МУЖСКОЙ';
  return 'МУЖСКОЙ';
}

function weightToRu(lbs, oz) {
  if (!lbs && !oz) return '';
  const l = (lbs || '0').toString().trim();
  const o = (oz || '0').toString().trim();
  return `${l} ФУНТОВ ${o} УНЦИЙ`;
}

function dateToRu(str) {
  if (!str) return '';
  const m = str.match(/(\w+)\s+(\d{1,2})[,\s]+(\d{4})/);
  if (m) {
    const ru = MONTHS_EN[m[1].toLowerCase()];
    if (ru) return `${m[2].padStart(2,'0')} ${ru} ${m[3]} г.`;
  }
  return str;
}

function countryToRu(str) {
  if (!str) return '';
  const key = str.toLowerCase().trim();
  return COUNTRIES_DICT[key] || ((/[а-яё]/i.test(str)) ? str.toUpperCase() : str.toUpperCase());
}

function hospitalToRu(str) {
  if (!str) return '';
  const up = str.toUpperCase().trim();
  // Убираем тип учреждения из названия — он пойдёт в отдельную строку
  return up
    .replace(/^HOSPITAL\s*/i, '')
    .replace(/^MEDICAL\s+CENT(?:ER|RE)\s*/i, '')
    .replace(/\bMEDICAL\s+CENT(?:ER|RE)\b/gi, '')
    .replace(/\bHOSPITAL\b/gi, '')
    .replace(/\bST\.?\s*PETERSBURG\b/gi, 'Г. САНКТ-ПЕТЕРБУРГ')
    .replace(/\bSAINT\s+PETERSBURG\b/gi, 'Г. САНКТ-ПЕТЕРБУРГ')
    .replace(/\s+/g,' ').trim();
}

function hospitalTypeToRu(str) {
  if (!str) return 'БОЛЬНИЦА';
  const up = str.toUpperCase();
  if (up.includes('MEDICAL CENTER') || up.includes('MEDICAL CENTRE') ||
      up.includes('МЕДИЦИНСКИЙ ЦЕНТР')) return 'МЕДИЦИНСКИЙ ЦЕНТР';
  return 'БОЛЬНИЦА';
}

function cityCountyToRu(str) {
  if (!str) return '';
  // Если уже русское — вернуть заглавными
  if (/[А-ЯЁ]{3,}/.test(str)) return str.toUpperCase();
  
  let result = str.toUpperCase().trim();
  
  // Переводим города
  const cityReplacements = [
    [/\bST\.?\s*PETERSBURG\b/g, 'Г. САНКТ-ПЕТЕРБУРГ'],
    [/\bSAINT\s+PETERSBURG\b/g, 'Г. САНКТ-ПЕТЕРБУРГ'],
    [/\bMIAMI\b/g, 'Г. МАЙАМИ'],
    [/\bORLANDO\b/g, 'Г. ОРЛАНДО'],
    [/\bTAMPA\b/g, 'Г. ТАМПА'],
    [/\bJACKSONVILLE\b/g, 'Г. ДЖЭКСОНВИЛЛ'],
    [/\bCLEARWATER\b/g, 'Г. КЛИРУОТЕР'],
    [/\bFORT\s+LAUDERDALE\b/g, 'Г. ФОРТ-ЛОДЕРДЕЙЛ'],
    [/\bTALLAHASSEE\b/g, 'Г. ТАЛЛАХАССИ'],
    [/\bGAINESVILLE\b/g, 'Г. ГЕЙНСВИЛЛ'],
    [/\bPENSACOLA\b/g, 'Г. ПЕНСАКОЛА'],
  ];
  for (const [re, ru] of cityReplacements) result = result.replace(re, ru);

  // Переводим округа
  const countyReplacements = [
    [/\bPINELLAS\s+COUNTY\b/g, 'ОКРУГ ПИНЕЛЛАС'],
    [/\bHILLSBOROUGH\s+COUNTY\b/g, 'ОКРУГ ХИЛЛСБОРО'],
    [/\bORANGE\s+COUNTY\b/g, 'ОКРУГ ОРИНДЖ'],
    [/\bMIAMI-DADE\s+COUNTY\b/g, 'ОКРУГ МАЙАМИ-ДЕЙ'],
    [/\bBROWARD\s+COUNTY\b/g, 'ОКРУГ БРОУАРД'],
    [/\bPALM\s+BEACH\s+COUNTY\b/g, 'ОКРУГ ПАЛМ-БИЧ'],
    [/\bDUVAL\s+COUNTY\b/g, 'ОКРУГ ДЮВАЛЬ'],
    [/\bPOLK\s+COUNTY\b/g, 'ОКРУГ ПОЛК'],
    [/\bVOLUSIA\s+COUNTY\b/g, 'ОКРУГ ВОЛУША'],
    [/\bCOUNTY\b/g, 'ОКРУГ'],
  ]; 
  for (const [re, ru] of countyReplacements) result = result.replace(re, ru);

  return result.replace(/\s+/g,' ').trim();
}

function extractFile(body, boundary) {
  const sep = Buffer.from('--' + boundary);
  const parts = splitBuf(body, sep);
  for (const part of parts) {
    const hEnd = part.indexOf('\r\n\r\n');
    if (hEnd === -1) continue;
    const headers = part.slice(0, hEnd).toString();
    if (!headers.includes('filename')) continue;
    const mm = headers.match(/Content-Type:\s*([^\r\n]+)/i);
    const mime = mm ? mm[1].trim() : 'image/jpeg';
    return { b64: part.slice(hEnd + 4, part.length - 2).toString('base64'), mime };
  }
  return { b64: null, mime: null };
}

function splitBuf(buf, sep) {
  const parts = []; let start = 0, idx;
  while ((idx = buf.indexOf(sep, start)) !== -1) { parts.push(buf.slice(start, idx)); start = idx + sep.length; }
  parts.push(buf.slice(start));
  return parts.filter(p => p.length > 4);
}
