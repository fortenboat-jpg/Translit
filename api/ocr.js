module.exports = async function handler(req, res) {
  req.config = { api: { bodyParser: false } };
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

    if (mime === 'application/pdf') {
      return res.status(400).json({ ok: false, error: 'PDF конвертируется на клиенте' });
    }

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
- hospital: translate to RUSSIAN using transliteration for the hospital name, but translate city names to their proper Russian names. Example: "BAYFRONT HEALTH ST PETERSBURG" -> "БЭЙФРОНТ ХЕЛС, Г. САНКТ-ПЕТЕРБУРГ", "ORLANDO HEALTH ORLANDO REGIONAL MEDICAL CENTER" -> "ОРЛАНДО ХЕЛС ОРЛАНДО РИДЖИНАЛ МЕДИКАЛ СЕНТЕР", "JACKSON MEMORIAL HOSPITAL" -> "ДЖЭКСОН МЕМОРИАЛ". City names: "ST PETERSBURG"/"SAINT PETERSBURG" -> "Г. САНКТ-ПЕТЕРБУРГ", "MIAMI" -> "Г. МАЙАМИ", "ORLANDO" -> "Г. ОРЛАНДО", "TAMPA" -> "Г. ТАМПА", "JACKSONVILLE" -> "Г. ДЖЭКСОНВИЛЛ". Remove the word HOSPITAL or MEDICAL CENTER from the beginning if it appears alone before the name.
- hospitalType: write only "БОЛЬНИЦА" if place of birth is a hospital, or "МЕДИЦИНСКИЙ ЦЕНТР" if it is a medical center.
- sex: write only "MALE" or "FEMALE"
- dob: YYYY-MM-DD format
- timeOfBirth: HH:MM format
- weightLbs and weightOz: numbers only
- motherBirthCountry and fatherBirthCountry: translate to RUSSIAN uppercase. Always write COUNTRY NAME (noun, not adjective). Examples: "RUSSIA"/"RUSSIAN" -> "РОССИЯ", "COLOMBIA"/"COLOMBIAN" -> "КОЛУМБИЯ", "CUBA"/"CUBAN" -> "КУБА", "MEXICO"/"MEXICAN" -> "МЕКСИКА", "UKRAINE"/"UKRAINIAN" -> "УКРАИНА", "BELARUS"/"BELARUSIAN" -> "БЕЛАРУСЬ", "GEORGIA" -> "ГРУЗИЯ", "FLORIDA" -> "ФЛОРИДА, США". If birthplace is a US state - write Russian name + ", США".

{
  "firstName": "child first name",
  "middleName": "child middle name",
  "lastName": "child last name",
  "dob": "YYYY-MM-DD",
  "sex": "MALE or FEMALE",
  "timeOfBirth": "HH:MM",
  "weightLbs": "number",
  "weightOz": "number",
  "hospital": "hospital name translated to Russian transliteration with city in Russian",
  "hospitalType": "БОЛЬНИЦА or МЕДИЦИНСКИЙ ЦЕНТР",
  "cityCounty": "exact text from document",
  "stateRegNum": "state file number",
  "dateIssued": "MONTH DD, YYYY",
  "dateRegistered": "MONTH DD, YYYY",
  "motherFirstName": "first name",
  "motherMiddleName": "middle name",
  "motherLastName": "last name",
  "motherDob": "MONTH DD, YYYY",
  "motherBirthCountry": "country in RUSSIAN uppercase",
  "fatherFirstName": "first name",
  "fatherMiddleName": "middle name",
  "fatherLastName": "last name",
  "fatherDob": "MONTH DD, YYYY",
  "fatherBirthCountry": "country in RUSSIAN uppercase",
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

    result.childName  = [result.lastName, result.firstName, result.middleName].filter(Boolean).join(' ');
    result.motherName = [result.motherLastName, result.motherFirstName, result.motherMiddleName].filter(Boolean).join(' ');
    result.fatherName = [result.fatherLastName, result.fatherFirstName, result.fatherMiddleName].filter(Boolean).join(' ');

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
  'rosa':'РОЗА','rose':'РОЗА','joie':'ДЖОИ','joy':'ДЖОЙ',
  'taylor':'ТЕЙЛОР','jefferson':'ДЖЕФФЕРСОН','alonzo':'АЛОНЗО',
  'david':'ДЭВИД','harms':'ХАРМС',
  'brad':'БРЭД','brandon':'БРЭНДОН','brenda':'БРЕНДА','brady':'БРЭДИ',
  'black':'БЛЭК','white':'УАЙТ','green':'ГРИН','brown':'БРАУН',
  'sally':'САЛЛИ','sam':'СЭМ','sean':'ШОН','seth':'СЕТ',
  'smith':'СМИТ','jones':'ДЖОНС','williams':'УИЛЬЯМС','davis':'ДЭВИС',
  'miller':'МИЛЛЕР','wilson':'УИЛСОН','moore':'МУР',
  'anderson':'АНДЕРСОН','jackson':'ДЖЕКСОН','harris':'ХАРРИС',
  'martin':'МАРТИН','garcia':'ГАРСИА','robinson':'РОБИНСОН',
  'clark':'КЛАРК','rodriguez':'РОДРИГЕЗ','lewis':'ЛЬЮИС',
  'walker':'УОКЕР','hall':'ХОЛЛ','allen':'АЛЛЕН','young':'ЯНГ',
  'hernandez':'ЭРНАНДЕЗ','king':'КИНГ','wright':'РАЙТ','lopez':'ЛОПЕЗ',
  'hill':'ХИЛЛ','adams':'АДАМС','baker':'БЕЙКЕР','nelson':'НЕЛЬСОН',
  'carter':'КАРТЕР','mitchell':'МИТЧЕЛЛ','perez':'ПЕРЕЗ','roberts':'РОБЕРТС',
  'turner':'ТЕРНЕР','campbell':'КЭМПБЕЛЛ','parker':'ПАРКЕР','evans':'ЭВАНС',
  'edwards':'ЭДВАРДС','collins':'КОЛЛИНЗ','stewart':'СТЮАРТ',
  'morris':'МОРРИС','rogers':'РОДЖЕРС','reed':'РИД','cook':'КУК',
  'morgan':'МОРГАН','bell':'БЕЛЛ','murphy':'МЁРФИ','bailey':'БЕЙЛИ',
  'rivera':'РИВЕРА','cooper':'КУПЕР','howard':'ГОВАРД','ward':'УОРД',
  'torres':'ТОРРЕС','peterson':'ПИТЕРСОН','gray':'ГРЕЙ','watson':'УОТСОН',
  'brooks':'БРУКС','kelly':'КЕЛЛИ','sanders':'САНДЕРС','price':'ПРАЙС',
  'bennett':'БЕННЕТТ','wood':'ВУД','barnes':'БАРНС','ross':'РОСС',
  'henderson':'ХЕНДЕРСОН','jenkins':'ДЖЕНКИНС','perry':'ПЕРРИ',
  'powell':'ПАУЭЛЛ','long':'ЛОНГ','hughes':'ХЬЮЗ','flores':'ФЛОРЕС',
  'butler':'БАТЛЕР','simmons':'СИММОНС','foster':'ФОСТЕР','bryant':'БРАЙАНТ',
  'russell':'РАССЕЛЛ','griffin':'ГРИФФИН','diaz':'ДИАЗ','hayes':'ХЕЙС',
  'myers':'МАЙЕРС','ford':'ФОРД','hamilton':'ХЭМИЛТОН','graham':'ГРЭХЕМ',
  'sullivan':'САЛЛИВАН','cole':'КОУЛ','west':'УЭСТ','owens':'ОУЭНС',
  'fisher':'ФИШЕР','ellis':'ЭЛЛИС','harrison':'ХАРРИСОН','gibson':'ГИБСОН',
  'cruz':'КРУЗ','marshall':'МАРШАЛЛ','ortiz':'ОРТИЗ','gomez':'ГОМЕЗ',
  'murray':'МЮРРЕЙ','freeman':'ФРИМЕН','wells':'УЭЛЛС','webb':'УЭББ',
  'tucker':'ТАКЕР','porter':'ПОРТЕР','hunter':'ХАНТЕР','boyd':'БОЙД',
  'kennedy':'КЕННЕДИ','warren':'УОРРЕН','dixon':'ДИКСОН','ramos':'РАМОС',
  'burns':'БЕРНС','gordon':'ГОРДОН','shaw':'ШОУ','holmes':'ХОЛМЗ',
  'rice':'РАЙС','hunt':'ХАНТ',
  'michael':'МАЙКЛ','james':'ДЖЕЙМС','john':'ДЖОН','robert':'РОБЕРТ',
  'william':'УИЛЬЯМ','richard':'РИЧАРД','joseph':'ДЖОЗЕФ','thomas':'ТОМАС',
  'charles':'ЧАРЛЬЗ','christopher':'КРИСТОФЕР','daniel':'ДЭНИЕЛ',
  'matthew':'МЭТТЬЮ','anthony':'ЭНТОНИ','donald':'ДОНАЛЬД',
  'paul':'ПОЛ','steven':'СТИВЕН','kenneth':'КЕННЕТ',
  'joshua':'ДЖОШУА','kevin':'КЕВИН','brian':'БРАЙАН','george':'ДЖОРДЖ',
  'mary':'МЭРИ','patricia':'ПАТРИЦИЯ','linda':'ЛИНДА','barbara':'БАРБАРА',
  'elizabeth':'ЭЛИЗАБЕТ','jennifer':'ДЖЕННИФЕР',
  'susan':'СЬЮЗАН','margaret':'МАРГАРЕТ','dorothy':'ДОРОТИ',
  'lisa':'ЛИЗА','nancy':'НЭНСИ','karen':'КАРЕН','betty':'БЕТТИ',
  'helen':'ХЕЛЕН','sandra':'САНДРА','donna':'ДОННА','carol':'КЭРОЛ',
  'ruth':'РУТ','sharon':'ШАРОН','michelle':'МИШЕЛЬ','laura':'ЛОРА',
  'sarah':'САРА','kimberly':'КИМБЕРЛИ','jessica':'ДЖЕССИКА',
  'shirley':'ШИРЛИ','angela':'АНДЖЕЛА','melissa':'МЕЛИССА',
  'amy':'ЭЙМ','rebecca':'РЕБЕККА',
  'virginia':'ВИРДЖИНИЯ','kathleen':'КЭТЛИН','pamela':'ПАМЕЛА',
  'martha':'МАРТА','debra':'ДЕБРА','amanda':'АМАНДА','stephanie':'СТЕФАНИ',
  'caroline':'КАРОЛИН','henry':'ГЕНРИ','arthur':'АРТУР','ryan':'РАЙАН',
  'jacob':'ДЖЕЙКОБ','gary':'ГЭРИ','nicholas':'НИКОЛАС','eric':'ЭРИК',
  'jonathan':'ДЖОНАТАН','stephen':'СТИВЕН','larry':'ЛАРРИ','justin':'ДЖАСТИН',
  'scott':'СКОТТ','benjamin':'БЕНДЖАМИН','samuel':'СЭМЮЭЛ',
  'raymond':'РЕЙМОНД','gregory':'ГРЕГОРИ','frank':'ФРЭНК',
  'patrick':'ПАТРИК','jack':'ДЖЕК','dennis':'ДЕННИС','jerry':'ДЖЕРРИ',
  'tyler':'ТАЙЛЕР','aaron':'ААРОН','jose':'ХОСЕ','adam':'АДАМ',
  'nathan':'НАТАН','douglas':'ДУГЛАС','zachary':'ЗАХАРИ',
  'kyle':'КАЙЛ','ethan':'ИТАН','walter':'УОЛТЕР',
  'noah':'НОА','jeremy':'ДЖЕРЕМИ','christian':'КРИСТИАН','harold':'ХАРОЛД',
  'jordan':'ДЖОРДАН','wayne':'УЭЙН','alan':'АЛАН','juan':'ХУАН',
  'trinity':'ТРИНИТИ','lynn':'ЛИНН','vosburgh':'ВОСБУРГ',
  'derek':'ДЕРЕК','marie':'МАРИ',
  // Слова в названиях больниц
  'health':'ХЕЛС','regional':'РИДЖИНАЛ','bayfront':'БЭЙФРОНТ',
  'general':'ДЖЕНЕРАЛ','memorial':'МЕМОРИАЛ','community':'КОМЬЮНИТИ',
  'center':'СЕНТЕР','medical':'МЕДИКАЛ','university':'ЮНИВЕРСИТИ',
  'south':'САУТ','north':'НОРТ','east':'ИСТ','west':'УЭСТ',
  'st':'СТ','saint':'СЕЙНТ',
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
  // Латинская Америка
  'colombia':'КОЛУМБИЯ','columbia':'КОЛУМБИЯ',
  'mexico':'МЕКСИКА','cuba':'КУБА','venezuela':'ВЕНЕСУЭЛА',
  'argentina':'АРГЕНТИНА','brazil':'БРАЗИЛИЯ','peru':'ПЕРУ',
  'ecuador':'ЭКВАДОР','chile':'ЧИЛИ','bolivia':'БОЛИВИЯ',
  'dominican republic':'ДОМИНИКАНСКАЯ РЕСПУБЛИКА',
  'puerto rico':'ПУЭРТО-РИКО','haiti':'ГАИТИ','jamaica':'ЯМАЙКА',
  'el salvador':'ЭЛЬ-САЛЬВАДОР','guatemala':'ГВАТЕМАЛА',
  'honduras':'ГОНДУРАС','nicaragua':'НИКАРАГУА','costa rica':'КОСТА-РИКА',
  'panama':'ПАНАМА',
  // Европа
  'canada':'КАНАДА','england':'АНГЛИЯ',
  'united kingdom':'ВЕЛИКОБРИТАНИЯ','uk':'ВЕЛИКОБРИТАНИЯ',
  'spain':'ИСПАНИЯ','italy':'ИТАЛИЯ','portugal':'ПОРТУГАЛИЯ',
  'romania':'РУМЫНИЯ','hungary':'ВЕНГРИЯ','czech republic':'ЧЕХИЯ',
  'slovakia':'СЛОВАКИЯ','bulgaria':'БОЛГАРИЯ','serbia':'СЕРБИЯ',
  'croatia':'ХОРВАТИЯ','greece':'ГРЕЦИЯ','turkey':'ТУРЦИЯ',
  // Ближний восток / Африка
  'iran':'ИРАН','iraq':'ИРАК','syria':'СИРИЯ','egypt':'ЕГИПЕТ',
  'ethiopia':'ЭФИОПИЯ','nigeria':'НИГЕРИЯ','kenya':'КЕНИЯ',
  'south africa':'ЮАР','ghana':'ГАНА',
  // Азия
  'india':'ИНДИЯ','pakistan':'ПАКИСТАН','bangladesh':'БАНГЛАДЕШ',
  'nepal':'НЕПАЛ','philippines':'ФИЛИППИНЫ','vietnam':'ВЬЕТНАМ',
  'thailand':'ТАИЛАНД','south korea':'ЮЖНАЯ КОРЕЯ','korea':'КОРЕЯ',
  'japan':'ЯПОНИЯ','indonesia':'ИНДОНЕЗИЯ','malaysia':'МАЛАЙЗИЯ',
  'singapore':'СИНГАПУР',
  // Океания
  'australia':'АВСТРАЛИЯ','new zealand':'НОВАЯ ЗЕЛАНДИЯ',
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
    ['shch','щ'],['sch','щ'],['zh','ж'],['kh','х'],['ph','ф'],['th','т'],
    ['ts','ц'],['ch','ч'],['sh','ш'],
    ['juan','хуан'],['ju','ху'],['jo','хо'],['ja','я'],
    ['qu','кв'],
    ['yu','ю'],['ya','я'],['yo','ё'],['ye','е'],
    ['tion','шн'],['tia','ша'],
    ['wr','р'],['wh','в'],
    ['a','а'],['b','б'],['c','к'],['d','д'],['e','е'],['f','ф'],['g','г'],
    ['h','х'],['i','и'],['j','дж'],['k','к'],['l','л'],['m','м'],['n','н'],
    ['o','о'],['p','п'],['q','к'],['r','р'],['s','с'],['t','т'],['u','у'],
    ['v','в'],['w','в'],['x','кс'],['y','й'],['z','з'],
  ];
  const preY = word.toLowerCase().replace(/([bcdfghjklmnpqrstvwxz])y/g, '$1ей');
  let r = '', i = 0, w = preY;
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
  if (s === 'FEMALE' || s === 'F' || s.startsWith('FEMALE')) return 'ЖЕНСКИЙ';
  return 'МУЖСКОЙ';
}

function weightToRu(lbs, oz) {
  if (!lbs && !oz) return '';
  return `${(lbs||'0').toString().trim()} ФУНТОВ ${(oz||'0').toString().trim()} УНЦИЙ`;
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

// GPT уже переводит страны на русский — просто возвращаем uppercase как страховка
function countryToRu(str) {
  if (!str) return '';
  if (/[а-яё]/i.test(str)) return str.toUpperCase();
  // Страховка на случай если GPT вернул прилагательное на английском
  const ADJECTIVES = {
    'colombian':'КОЛУМБИЯ','cuban':'КУБА','mexican':'МЕКСИКА',
    'russian':'РОССИЯ','ukrainian':'УКРАИНА','belarusian':'БЕЛАРУСЬ',
    'georgian':'ГРУЗИЯ','armenian':'АРМЕНИЯ','azerbaijani':'АЗЕРБАЙДЖАН',
    'kazakh':'КАЗАХСТАН','uzbek':'УЗБЕКИСТАН','moldovan':'МОЛДОВА',
    'latvian':'ЛАТВИЯ','lithuanian':'ЛИТВА','estonian':'ЭСТОНИЯ',
    'american':'США','venezuelan':'ВЕНЕСУЭЛА','peruvian':'ПЕРУ',
    'ecuadorian':'ЭКВАДОР','bolivian':'БОЛИВИЯ','chilean':'ЧИЛИ',
    'argentinian':'АРГЕНТИНА','brazilian':'БРАЗИЛИЯ',
    'dominican':'ДОМИНИКАНСКАЯ РЕСПУБЛИКА','haitian':'ГАИТИ',
    'jamaican':'ЯМАЙКА','salvadoran':'ЭЛЬ-САЛЬВАДОР',
    'guatemalan':'ГВАТЕМАЛА','honduran':'ГОНДУРАС','nicaraguan':'НИКАРАГУА',
    'panamanian':'ПАНАМА','indian':'ИНДИЯ','pakistani':'ПАКИСТАН',
    'chinese':'КИТАЙ','japanese':'ЯПОНИЯ','korean':'КОРЕЯ',
    'vietnamese':'ВЬЕТНАМ','thai':'ТАИЛАНД','philippine':'ФИЛИППИНЫ',
    'turkish':'ТУРЦИЯ','iranian':'ИРАН','iraqi':'ИРАК','syrian':'СИРИЯ',
    'egyptian':'ЕГИПЕТ','nigerian':'НИГЕРИЯ','ethiopian':'ЭФИОПИЯ',
    'ghanaian':'ГАНА','kenyan':'КЕНИЯ','german':'ГЕРМАНИЯ',
    'french':'ФРАНЦИЯ','spanish':'ИСПАНИЯ','italian':'ИТАЛИЯ',
    'portuguese':'ПОРТУГАЛИЯ','greek':'ГРЕЦИЯ','polish':'ПОЛЬША',
    'romanian':'РУМЫНИЯ','canadian':'КАНАДА','australian':'АВСТРАЛИЯ',
    'british':'ВЕЛИКОБРИТАНИЯ','english':'ВЕЛИКОБРИТАНИЯ',
    'israeli':'ИЗРАИЛЬ',
  };
  const key = str.toLowerCase().trim();
  return COUNTRIES_DICT[key] || ADJECTIVES[key] || str.toUpperCase();
}

// ── hospitalToRu: GPT уже переводит — просто возвращаем как есть
function hospitalToRu(str) {
  if (!str) return '';
  return str.toUpperCase().trim();
}

function hospitalTypeToRu(str) {
  if (!str) return 'БОЛЬНИЦА';
  const up = str.toUpperCase();
  if (up.includes('MEDICAL CENTER') || up.includes('MEDICAL CENTRE')) return 'МЕДИЦИНСКИЙ ЦЕНТР';
  return 'БОЛЬНИЦА';
}

// Словарь городов с ручным переводом (нестандартные)
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
  'ST JOHNS':'СТ. ДЖОНС',
  'ST. JOHNS':'СТ. ДЖОНС',
  'SAINT JOHNS':'СТ. ДЖОНС',
  'ORANGE':'ОРИНДЖ',
  'LEE':'ЛИ',
};

function autoTranslitForCity(word) {
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

function cityCountyToRu(str) {
  if (!str) return '';
  if (/[А-ЯЁ]{3,}/.test(str)) return str.toUpperCase();
  let result = str.toUpperCase().trim();

  // 1. СНАЧАЛА округа — до замены городов!
  // Сначала дефисные округа (MIAMI-DADE и т.д.) — \b не работает с дефисом
  result = result.replace(/([A-Z][\w]*(?:-[A-Z][\w]*)+)\s+COUNTY/g, (match, countyName) => {
    const key = countyName.trim();
    if (COUNTY_DICT[key]) return 'ОКРУГ ' + COUNTY_DICT[key];
    const translitted = key.split(/[\s-]/).map(w => w ? autoTranslitForCity(w) : '').join('-').replace(/--+/g,'-');
    return 'ОКРУГ ' + translitted;
  });
  // Потом обычные округа без дефиса
  result = result.replace(/\b([A-Z][A-Z\s]*?)\s+COUNTY\b/g, (match, countyName) => {
    const key = countyName.trim();
    if (COUNTY_DICT[key]) return 'ОКРУГ ' + COUNTY_DICT[key];
    const translitted = key.split(/\s+/).map(w => w ? autoTranslitForCity(w) : '').join(' ');
    return 'ОКРУГ ' + translitted;
  });
  result = result.replace(/\bCOUNTY\b/g, 'ОКРУГ');

  // 2. ПОТОМ города из словаря (длинные первыми)
  const cityEntries = Object.entries(CITY_DICT).sort((a,b) => b[0].length - a[0].length);
  for (const [en, ru] of cityEntries) {
    result = result.replace(new RegExp('\\b' + en.replace(/[.*+?^${}()|[\]\\]/g,'\\$&') + '\\b', 'g'), ru);
  }

  // 3. Оставшиеся латинские слова (3+ букв) — автотранслит
  result = result.replace(/\b([A-Z]{3,})\b/g, match => autoTranslitForCity(match));

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
