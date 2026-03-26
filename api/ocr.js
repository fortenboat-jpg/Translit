// api/ocr.js — Vercel Serverless Function
// Принимает multipart/form-data с файлом, отдаёт JSON с данными документа

import { OpenAI } from 'openai';

export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  try {
    // Read raw body
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = Buffer.concat(chunks);

    // Parse multipart manually to get base64 image
    const contentType = req.headers['content-type'] || '';
    const boundary = contentType.split('boundary=')[1];
    if (!boundary) return res.status(400).json({ ok: false, error: 'No boundary in multipart' });

    const { b64, mime } = extractFileFromMultipart(body, boundary);
    if (!b64) return res.status(400).json({ ok: false, error: 'No file found in request' });

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 700,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: { url: `data:${mime};base64,${b64}`, detail: 'high' }
          },
          {
            type: 'text',
            text: `Это американское свидетельство о рождении (возможно уже переведено на русский).
Извлеки ВСЕ поля и верни ТОЛЬКО валидный JSON без markdown и без пояснений:
{
  "lastName": "",
  "firstName": "",
  "middleName": "",
  "dob": "YYYY-MM-DD",
  "sex": "МУЖСКОЙ или ЖЕНСКИЙ",
  "timeOfBirth": "HH:MM",
  "weight": "например: 8 фунтов 0 унций",
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
    });

    let txt = (completion.choices[0]?.message?.content || '{}')
      .replace(/```json|```/g, '').trim();
    const data = JSON.parse(txt);
    return res.status(200).json({ ok: true, data });

  } catch (err) {
    console.error('OCR error:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}

function extractFileFromMultipart(body, boundary) {
  const sep = Buffer.from('--' + boundary);
  const parts = splitBuffer(body, sep);

  for (const part of parts) {
    const headerEnd = part.indexOf('\r\n\r\n');
    if (headerEnd === -1) continue;
    const headers = part.slice(0, headerEnd).toString();
    if (!headers.includes('filename')) continue;

    const mimeMatch = headers.match(/Content-Type:\s*([^\r\n]+)/i);
    const mime = mimeMatch ? mimeMatch[1].trim() : 'image/jpeg';
    const fileData = part.slice(headerEnd + 4, part.length - 2); // strip trailing \r\n
    return { b64: fileData.toString('base64'), mime };
  }
  return { b64: null, mime: null };
}

function splitBuffer(buf, sep) {
  const parts = [];
  let start = 0;
  let idx;
  while ((idx = buf.indexOf(sep, start)) !== -1) {
    parts.push(buf.slice(start, idx));
    start = idx + sep.length;
  }
  parts.push(buf.slice(start));
  return parts.filter(p => p.length > 4);
}
