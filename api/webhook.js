const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// Webhook обрабатывает успешную оплату и вызывает /api/translate
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;
  try {
    // Vercel: нужен raw body
    const rawBody = await getRawBody(req);
    if (webhookSecret) {
      event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
    } else {
      // В тестовом режиме без webhook secret
      event = JSON.parse(rawBody.toString());
    }
  } catch (err) {
    console.error('Webhook signature error:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    console.log('Payment completed:', session.id, session.customer_email);

    try {
      // Восстанавливаем все поля из metadata
      const meta = session.metadata || {};
      const payload = {
        email:            meta.email || session.customer_email || '',
        orderNum:         meta.orderNum || '',
        childName:        meta.childName || '',
        firstName:        meta.firstName || '',
        lastName:         meta.lastName || '',
        middleName:       meta.middleName || '',
        dob:              meta.dob || '',
        sex:              meta.sex || '',
        timeOfBirth:      meta.timeOfBirth || '',
        weight:           meta.weight || '',
        hospital:         meta.hospital || '',
        hospitalType:     meta.hospitalType || 'БОЛЬНИЦА',
        cityCounty:       meta.cityCounty || '',
        stateRegNum:      meta.stateRegNum || '',
        dateIssued:       meta.dateIssued || '',
        dateRegistered:   meta.dateRegistered || '',
        motherName:       meta.motherName || '',
        motherDob:        meta.motherDob || '',
        motherBirthPlace: meta.motherBirthPlace || '',
        fatherName:       meta.fatherName || '',
        fatherDob:        meta.fatherDob || '',
        fatherBirthPlace: meta.fatherBirthPlace || '',
        reqNum:           meta.reqNum || '',
        barcodeNum:       meta.barcodeNum || '',
        state:            meta.state || 'florida',
        docType:          meta.docType || 'birth',
      };
      console.log('Payload email:', payload.email, 'childName:', payload.childName);

      // Вызываем /api/translate для генерации и отправки PDF
      const baseUrl = process.env.SITE_URL || 'https://translit-gilt.vercel.app';
      const translateResp = await fetch(`${baseUrl}/api/translate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({...payload, paid: true}),
      });

      const result = await translateResp.json();
      console.log('Translate result:', result.ok, result.orderNum);

    } catch (err) {
      console.error('Post-payment processing error:', err.message);
    }
  }

  return res.status(200).json({ received: true });
};

// Получаем raw body для верификации подписи Stripe
async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}
