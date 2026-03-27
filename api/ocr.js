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
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url: `data:${mime};base64,${b64}`, detail: 'high' }
            },
            {
              type: 'text',
              text: `This is a US birth certificate from Florida. Extract ALL fields carefully and translate them to Russian where needed.

IMPORTANT RULES:
- lastName, firstName, middleName: extract from NAME field, split into parts
- dob: convert to YYYY-MM-DD format (e.g. FEBRUARY 26, 2022 → 2022-02-26)
- sex: translate to Russian: MALE→МУЖСКОЙ, FEMALE→ЖЕНСКИЙ
- timeOfBirth: extract time digits (e.g. 1411 → 14:11)
- weight: translate to Russian (e.g. 8 LBS 0 OZ → 8 фунтов 0 унций)
- hospital: full hospital name from PLACE OF BIRTH field (translate HOSPITAL→БОЛЬНИЦА, MEDICAL CENTER→МЕДИЦИНСКИЙ ЦЕНТР)
- cityCounty: from CITY, COUNTY OF BIRTH (translate: ST PETERSBURG→Г. САНКТ-ПЕТЕРБУРГ, PINELLAS COUNTY→ОКРУГ ПИНЕЛЛАС)
- stateRegNum: STATE FILE NUMBER value
- dateIssued: translate month to Russian (e.g. MARCH 8, 2022 → 08 МАРТА 2022 г.)
- dateRegistered: same format
- motherName, fatherName: translate to Russian transcription if in English
- motherDob, fatherDob: translate month to Russian (e.g. AUGUST 28, 1990 → 28 АВГУСТА 1990 г.)
- motherBirthPlace, fatherBirthPlace: translate to Russian (BELARUS→БЕЛАРУСЬ, RUSSIA→РОССИЯ, USA→США)

Return ONLY valid JSON, no markdown, no explanation:
{
  "lastName": "",
  "firstName": "",
  "middleName": "",
  "dob": "YYYY-MM-DD",
  "sex": "МУЖСКОЙ или ЖЕНСКИЙ",
  "timeOfBirth": "HH:MM",
  "weight": "X фунтов X унций",
  "hospital": "",
  "cityCounty": "",
  "stateRegNum": "",
  "dateIssued": "DD МЕСЯЦ YYYY г.",
  "dateRegistered": "DD МЕСЯЦ YYYY г.",
  "motherName": "",
  "motherDob": "DD МЕСЯЦ YYYY г.",
  "motherBirthPlace": "",
  "fatherName": "",
  "fatherDob": "DD МЕСЯЦ YYYY г.",
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
    const parsed = JSON.parse(txt);
    return res.status(200).json({ ok: true, data: parsed });

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
