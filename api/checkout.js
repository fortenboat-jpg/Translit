const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false });

  try {
    const d = req.body;

    // Stripe metadata: макс 50 ключей, 500 символов каждый
    const p = d;
    const metadata = {
      email:            (p.email            || '').substring(0, 200),
      orderNum:         (p.orderNum         || '').substring(0, 30),
      childName:        (p.childName        || '').substring(0, 200),
      firstName:        (p.firstName        || '').substring(0, 100),
      lastName:         (p.lastName         || '').substring(0, 100),
      middleName:       (p.middleName       || '').substring(0, 100),
      dob:              (p.dob              || '').substring(0, 20),
      sex:              (p.sex              || '').substring(0, 20),
      timeOfBirth:      (p.timeOfBirth      || '').substring(0, 20),
      weight:           (p.weight           || '').substring(0, 50),
      hospital:         (p.hospital         || '').substring(0, 200),
      hospitalType:     (p.hospitalType     || '').substring(0, 50),
      cityCounty:       (p.cityCounty       || '').substring(0, 200),
      stateRegNum:      (p.stateRegNum      || '').substring(0, 50),
      dateIssued:       (p.dateIssued       || '').substring(0, 50),
      dateRegistered:   (p.dateRegistered   || '').substring(0, 50),
      motherName:       (p.motherName       || '').substring(0, 200),
      motherDob:        (p.motherDob        || '').substring(0, 50),
      motherBirthPlace: (p.motherBirthPlace || '').substring(0, 100),
      fatherName:       (p.fatherName       || '').substring(0, 200),
      fatherDob:        (p.fatherDob        || '').substring(0, 50),
      fatherBirthPlace: (p.fatherBirthPlace || '').substring(0, 100),
      reqNum:           (p.reqNum           || '').substring(0, 30),
      barcodeNum:       (p.barcodeNum       || '').substring(0, 30),
      state:            (p.state            || 'florida').substring(0, 20),
      docType:          (p.docType          || 'birth').substring(0, 20),
    };

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: 'Перевод свидетельства о рождении (США) для Консульства РФ',
            description: `Имя: ${d.childName || '—'} · Рег. номер: ${d.stateRegNum || '—'}`,
            images: ['https://translit-gilt.vercel.app/logo.png'],
          },
          unit_amount: 5900, // $59.00
        },
        quantity: 1,
      }],
      mode: 'payment',
      customer_email: d.email || undefined,
      success_url: `${process.env.SITE_URL || 'https://translit-gilt.vercel.app'}/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${process.env.SITE_URL || 'https://translit-gilt.vercel.app'}/?cancelled=1`,
      metadata,
    });

    return res.status(200).json({ ok: true, url: session.url, sessionId: session.id });

  } catch (err) {
    console.error('Checkout error:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
};
