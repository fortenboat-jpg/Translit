// api/test-send.js
// Тестовый endpoint — только для разработки!
// Вызывает translate-apostille или translate напрямую и отправляет email
// Использование: GET /api/test-send?email=your@email.com&type=apostille
// или POST с JSON телом

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Блокируем в продакшене (раскомментируй когда всё проверишь)
  // if (process.env.NODE_ENV === 'production') {
  //   return res.status(403).json({ ok: false, error: 'Disabled in production' });
  // }

  const baseUrl = process.env.SITE_URL || 'https://translit-gilt.vercel.app';

  // Берём email и тип из query или body
  let email, docType;
  if (req.method === 'GET') {
    email   = req.query?.email || 'test@example.com';
    docType = req.query?.type  || 'apostille';
  } else {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = JSON.parse(Buffer.concat(chunks).toString() || '{}');
    email   = body.email   || 'test@example.com';
    docType = body.docType || 'apostille';
  }

  let endpoint, payload;

  if (docType === 'apostille') {
    // Тестовые данные апостиля — такие же как в PDF sample
    payload = {
      email,
      field2:     'KENNETH "KEN" T. JOHNSON',
      field3:     'REGISTRAR OF VITAL STATISTICS',
      field4:     'THE GREAT SEAL OF THE STATE OF FLORIDA',
      field5:     'Tallahassee, Florida',
      field6:     'Twelfth day of September, 2024',
      field7:     'Secretary of State, State of Florida',
      field8:     '2024-654321',
      backNumber: '7654321',
      state:      'florida',
      docType:    'apostille',
      paid:       true,
      _paymentToken: process.env.PAYMENT_TOKEN,
    };
    endpoint = `${baseUrl}/api/translate-apostille`;
  } else {
    // Тестовые данные birth cert
    payload = {
      email,
      lastName:        'ИВАНОВ',
      firstName:       'ИВАН',
      middleName:      'ИВАНОВИЧ',
      dob:             '2020-01-15',
      sex:             'МУЖСКОЙ',
      timeOfBirth:     '10:30',
      weight:          '7 ФУНТОВ 5 УНЦИЙ',
      hospitalType:    'БОЛЬНИЦА',
      hospital:        'БЭЙФРОНТ ХЕЛС, Г. САНКТ-ПЕТЕРБУРГ',
      cityCounty:      'Г. САНКТ-ПЕТЕРБУРГ, ОКРУГ ПИНЕЛЛАС',
      stateRegNum:     '115-2020-012345',
      dateIssued:      '15 ЯНВАРЯ 2020 г.',
      dateRegistered:  '16 ЯНВАРЯ 2020 г.',
      motherName:      'ИВАНОВА МАРИЯ ОЛЕГОВНА',
      motherDob:       '10 МАЯ 1990 г.',
      motherBirthPlace:'РОССИЯ',
      fatherName:      'ИВАНОВ ИВАН ИВАНОВИЧ',
      fatherDob:       '05 МАРТА 1988 г.',
      fatherBirthPlace:'РОССИЯ',
      reqNum:          '123456',
      barcodeNum:      '987654321',
      childName:       'ИВАНОВ ИВАН ИВАНОВИЧ',
      state:           'florida',
      docType:         'birth',
      paid:            true,
      _paymentToken:   process.env.PAYMENT_TOKEN,
    };
    endpoint = `${baseUrl}/api/translate`;
  }

  try {
    console.log('TEST SEND → endpoint:', endpoint, 'email:', email, 'type:', docType);

    const resp = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const result = await resp.json();

    console.log('TEST SEND result:', result.ok, result.orderNum, result.error);

    return res.status(200).json({
      ok: result.ok,
      orderNum: result.orderNum,
      error: result.error || null,
      sentTo: email,
      docType,
      message: result.ok
        ? `✓ Письмо отправлено на ${email} (No. ${result.orderNum})`
        : `✗ Ошибка: ${result.error}`,
    });
  } catch (err) {
    console.error('TEST SEND error:', err.message);
    return res.status(500).json({ ok: false, error: err.message });
  }
};
