// api/ocr-apostille.js
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  try {
    // Читаем тело запроса вручную — точно как в ocr.js
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

    const prompt = `This is a Florida Apostille document (Hague Convention 1961).
Extract these fields EXACTLY as written in English — do NOT translate:
- field2: full name after "has been signed by"
- field3: title/capacity after "acting in the capacity of"
- field4: seal description after "bears the seal/stamp of"
- field5: city/location after "at" (field 5)
- field6: date in words after "the" (field 6), e.g. "Twelfth day of September, 2024"
- field7: certifying authority after "by" (field 7)
- field8: apostille number after "No." (field 8)
- backNumber: number on the reverse side if visible, otherwise empty string

Return ONLY valid JSON, no markdown, no explanation:
{
  "field2": "",
  "field3": "",
  "field4": "",
  "field5": "",
  "field6": "",
  "field7": "",
  "field8": "",
  "backNumber": ""
}`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        max_tokens: 600,
        messages: [{
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: `data:${mime};base64,${b64}`, detail: 'high' } },
            { type: 'text', text: prompt }
          ]
        }]
      })
    });

    const ocrResult = await response.json();
    console.log('OCR Apostille raw:', JSON.stringify(ocrResult).slice(0, 400));

    if (ocrResult.error) {
      return res.status(400).json({ ok: false, error: ocrResult.error.message });
    }

    const raw = (ocrResult.choices?.[0]?.message?.content || '').replace(/```json|```/g, '').trim();

    // Защита: если GPT вернул не JSON (отказ, sorry и т.д.)
    if (!raw.startsWith('{')) {
      console.error('GPT non-JSON response:', raw.slice(0, 200));
      return res.status(200).json({
        ok: true,
        data: { field2:'', field3:'', field4:'', field5:'', field6:'', field7:'', field8:'', backNumber:'' }
      });
    }

    const data = JSON.parse(raw);
    console.log('OCR Apostille parsed:', JSON.stringify(data));

    return res.status(200).json({ ok: true, data });

  } catch (err) {
    console.error('OCR Apostille error:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
};

// ── Те же функции что в ocr.js ─────────────────────────────
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
  while ((idx = buf.indexOf(sep, start)) !== -1) {
    parts.push(buf.slice(start, idx));
    start = idx + sep.length;
  }
  parts.push(buf.slice(start));
  return parts.filter(p => p.length > 4);
}
