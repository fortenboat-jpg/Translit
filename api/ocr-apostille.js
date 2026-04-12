// api/ocr-apostille.js
const { IncomingForm } = require('formidable');
const fs = require('fs');
const fetch = require('node-fetch');

export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  try {
    const form = new IncomingForm({ maxFileSize: 15 * 1024 * 1024 });
    const [, files] = await form.parse(req);
    const file = files.file?.[0] || files['file'];
    if (!file) return res.status(400).json({ ok: false, error: 'No file' });

    const fileBytes = fs.readFileSync(file.filepath || file.path);
    const base64 = fileBytes.toString('base64');
    const mimeType = file.mimetype || file.type || 'image/jpeg';

    const prompt = `You are extracting data from a Florida Apostille document (Hague Convention apostille).

Extract these fields exactly as they appear in the document:
- field2: "has been signed by" value — the name of the person who signed (e.g. "KENNETH KEN T. JOHNSON")
- field3: "acting in the capacity of" value — their title/capacity (e.g. "STATE REGISTRAR OF VITAL STATISTICS")
- field4: "bears the seal/stamp of" value — the seal description (e.g. "THE GREAT SEAL OF THE STATE OF FLORIDA")
- field5: "at" value — the city/location (e.g. "Tallahassee, Florida")
- field6: "the" value — the date in words as written (e.g. "Twelfth day of September, 2024")
- field7: "by" value — who certified it (e.g. "Secretary of State, State of Florida")
- field8: "No." value — the apostille number (e.g. "2024-123456")
- backNumber: number printed on the back/reverse side if visible

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
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        max_tokens: 600,
        messages: [{
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}`, detail: 'high' } },
            { type: 'text', text: prompt }
          ]
        }]
      })
    });

    const ocrResult = await response.json();
    const raw = ocrResult.choices?.[0]?.message?.content || '';
    const clean = raw.replace(/```json|```/g, '').trim();
    const data = JSON.parse(clean);

    return res.status(200).json({ ok: true, data });
  } catch (err) {
    console.error('OCR Apostille error:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
