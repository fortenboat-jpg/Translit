// api/translate.js — Vercel Serverless Function
// Принимает JSON с данными, генерирует PDF, отправляет email

import nodemailer from 'nodemailer';
import PDFDocument from 'pdfkit';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  try {
    const d = req.body;
    const num   = 'BC-' + Date.now().toString().slice(-6);
    const today = new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
    const dobFmt = d.dob
      ? new Date(d.dob + 'T12:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
      : '—';
    const fullName = [d.lastName, d.firstName, d.middleName].filter(Boolean).join(' ');

    const translationText = buildTranslation(d, dobFmt, fullName, num, today);
    const pdfBuffer = await generatePDF(translationText, num);

    // Send email
    if (d.email) {
      await sendEmail(d.email, fullName, translationText, pdfBuffer, num);
    }

    return res.status(200).json({
      ok: true,
      translationText,
      pdfBase64: pdfBuffer.toString('base64'),
      orderNum: num
    });

  } catch (err) {
    console.error('Translate error:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}

// ─── BUILD TRANSLATION TEXT ───────────────────────────────
function buildTranslation(d, dobFmt, fullName, num, today) {
  return `                    Перевод с английского языка
══════════════════════════════════════════════════════

                        ШТАТ ФЛОРИДА

         БЮРО ЗАПИСИ АКТОВ ГРАЖДАНСКОГО СОСТОЯНИЯ
                  СВИДЕТЕЛЬСТВО О РОЖДЕНИИ

══════════════════════════════════════════════════════

НОМЕР РЕГИСТРАЦИИ В ШТАТЕ: ${d.stateRegNum || '—'}
ДАТА ВЫДАЧИ:               ${d.dateIssued || '—'}
ДАТА РЕГИСТРАЦИИ:          ${d.dateRegistered || '—'}

──────────────────────────────────────────────────────
ИНФОРМАЦИЯ О РЕБЁНКЕ
──────────────────────────────────────────────────────
ИМЯ:                   ${fullName}
ДАТА РОЖДЕНИЯ:         ${dobFmt}
ВРЕМЯ РОЖДЕНИЯ (24 Ч): ${d.timeOfBirth || '—'}
ПОЛ:                   ${d.sex || '—'}
ВЕС ПРИ РОЖДЕНИИ:      ${d.weight || '—'}
МЕСТО РОЖДЕНИЯ:        ${d.hospital || '—'}
ГОРОД, ОКРУГ РОЖДЕНИЯ: ${d.cityCounty || '—'}

──────────────────────────────────────────────────────
ИНФОРМАЦИЯ О МАТЕРИ / РОДИТЕЛЕ
(ИМЯ ДО ПЕРВОГО БРАКА, ЕСЛИ ПРИМЕНИМО)
──────────────────────────────────────────────────────
ИМЯ:                   ${d.motherName || '—'}
ДАТА РОЖДЕНИЯ:         ${d.motherDob || '—'}
МЕСТО РОЖДЕНИЯ:        ${d.motherBirthPlace || '—'}

──────────────────────────────────────────────────────
ИНФОРМАЦИЯ ОБ ОТЦЕ / РОДИТЕЛЕ
(ИМЯ ДО ПЕРВОГО БРАКА, ЕСЛИ ПРИМЕНИМО)
──────────────────────────────────────────────────────
ИМЯ:                   ${d.fatherName || '—'}
ДАТА РОЖДЕНИЯ:         ${d.fatherDob || '—'}
МЕСТО РОЖДЕНИЯ:        ${d.fatherBirthPlace || '—'}

══════════════════════════════════════════════════════
                   УДОСТОВЕРЕНИЕ ПЕРЕВОДА
══════════════════════════════════════════════════════

Я, нижеподписавшийся(аяся), сертифицированный переводчик
с английского языка на русский язык, настоящим удостоверяю,
что данный перевод является точным и полным переводом
оригинального документа — свидетельства о рождении,
выданного компетентным органом штата Флорида, США.

Перевод выполнен в соответствии с требованиями
Консульства Российской Федерации в США.

Переводчик: _______________________________
Дата:       ${today}
№ перевода: ${num}
Печать:     BirthCert Translation Services

══════════════════════════════════════════════════════`;
}

// ─── GENERATE PDF ─────────────────────────────────────────
function generatePDF(text, num) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    doc.on('data', c => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const W = doc.page.width;

    // Header
    doc.rect(0, 0, W, 50).fill('#0c1b3a');
    doc.fillColor('white').fontSize(11).font('Helvetica-Bold')
       .text('BirthCert Translation', 0, 15, { align: 'center', width: W });
    doc.fillColor('white').fontSize(8).font('Helvetica')
       .text('birthcert-translation.com  |  Официальный перевод для Консульства РФ', 0, 31, { align: 'center', width: W });

    // Gold line
    doc.moveTo(50, 64).lineTo(W - 50, 64).strokeColor('#d4aa3e').lineWidth(1.5).stroke();

    // Title
    doc.fillColor('#0c1b3a').fontSize(14).font('Helvetica-Bold')
       .text('СВИДЕТЕЛЬСТВО О РОЖДЕНИИ', 0, 74, { align: 'center', width: W });
    doc.fillColor('#5a6b90').fontSize(9).font('Helvetica')
       .text('Перевод с английского языка на русский язык  |  Certificate of Live Birth', 0, 93, { align: 'center', width: W });
    doc.moveTo(50, 107).lineTo(W - 50, 107).strokeColor('#d4daf0').lineWidth(0.5).stroke();

    // Body
    const lines = text.split('\n');
    let y = 117;
    lines.forEach(line => {
      if (y > 758) {
        doc.addPage();
        y = 40;
      }
      const isSectionHead = line.startsWith('ИНФОРМАЦИЯ') || line.startsWith('УДОСТОВЕРЕНИЕ') || line.startsWith('НОМЕР') || line.startsWith('ДАТА');
      const isSep = line.includes('═') || line.includes('──');
      doc.font(isSectionHead ? 'Helvetica-Bold' : 'Helvetica')
         .fillColor(isSep ? '#aab0c8' : '#0e1c36')
         .fontSize(9.5)
         .text(line, 50, y, { width: W - 100, lineGap: 0 });
      y += 13.5;
    });

    // Footer
    const pH = doc.page.height;
    doc.rect(0, pH - 38, W, 38).fill('#0c1b3a');
    doc.fillColor('white').fontSize(7.5).font('Helvetica')
       .text(`© BirthCert Translation  |  № ${num}  |  Принимается консульствами РФ в США`, 0, pH - 22, { align: 'center', width: W });

    doc.end();
  });
}

// ─── SEND EMAIL ───────────────────────────────────────────
async function sendEmail(toEmail, fullName, text, pdfBuffer, num) {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_PASS   // App Password (16 chars)
    }
  });

  await transporter.sendMail({
    from: `"BirthCert Translation" <${process.env.GMAIL_USER}>`,
    to: toEmail,
    subject: `Ваш перевод свидетельства о рождении — ${fullName} (№ ${num})`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:580px;margin:0 auto;border-radius:14px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.1)">
        <div style="background:#0c1b3a;padding:28px;text-align:center">
          <h2 style="color:white;margin:0;font-size:22px">📄 BirthCert Translation</h2>
          <p style="color:rgba(255,255,255,0.6);margin:6px 0 0;font-size:13px">Официальный перевод для Консульства РФ в США</p>
        </div>
        <div style="background:#f4f6fb;padding:32px">
          <p style="color:#0e1c36;font-size:16px;margin:0 0 12px">Здравствуйте!</p>
          <p style="color:#5a6b90;font-size:14px;line-height:1.7">Ваш перевод свидетельства о рождении готов.<br>PDF-документ прикреплён к этому письму.</p>
          <div style="background:white;border:1.5px solid #d4daf0;border-radius:10px;padding:18px;margin:20px 0">
            <p style="margin:0;color:#0e1c36;font-weight:600;font-size:14px">📎 Вложение:</p>
            <p style="margin:5px 0 0;color:#5a6b90;font-size:13px">BirthCert_${num}.pdf</p>
            <p style="margin:3px 0 0;color:#5a6b90;font-size:12px">Перевод свидетельства о рождении на русский язык</p>
          </div>
          <div style="background:#e8f8f0;border-left:3px solid #0ea86e;padding:12px 16px;border-radius:0 8px 8px 0;margin-bottom:20px">
            <p style="margin:0;color:#0a6644;font-size:13px">🖨️ <strong>Распечатайте документ</strong> и подайте в консульство.<br>При необходимости заверьте у нотариуса в США.</p>
          </div>
          <div style="border-top:1px solid #d4daf0;padding-top:16px;margin-top:8px">
            <p style="color:#aab0c8;font-size:12px;margin:0">№ перевода: <strong style="color:#5a6b90">${num}</strong></p>
            <p style="color:#aab0c8;font-size:12px;margin:4px 0 0">© BirthCert Translation — birthcert-translation.com</p>
          </div>
        </div>
      </div>
    `,
    attachments: [{
      filename: `BirthCert_${num}.pdf`,
      content: pdfBuffer,
      contentType: 'application/pdf'
    }]
  });
}
