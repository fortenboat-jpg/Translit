const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  let event;
  try {
    const rawBody = await getRawBody(req);
    if (webhookSecret) {
      event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
    } else {
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
      const meta = session.metadata || {};
      const docType = meta.docType || 'birth';
      const baseUrl = process.env.SITE_URL || 'https://translit-gilt.vercel.app';

      let endpoint, payload;

      if (docType === 'apostille') {
        // ── Апостиль ──────────────────────────────────────
        payload = {
          email:      meta.email || session.customer_email || '',
          orderNum:   meta.orderNum || '',
          field2:     meta.field2 || '',
          field3:     meta.field3 || '',
          field4:     meta.field4 || '',
          field5:     meta.field5 || '',
          field6:     meta.field6 || '',
          field7:     meta.field7 || '',
          field8:     meta.field8 || '',
          backNumber: meta.backNumber || '',
          state:      meta.state || 'florida',
          docType:    'apostille',
          paid:       true,
          _paymentToken: process.env.PAYMENT_TOKEN,
        };
        endpoint = `${baseUrl}/api/translate-apostille`;
      } else {
        // ── Birth cert ────────────────────────────────────
        payload = {
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
          docType:          'birth',
          paid:             true,
          _paymentToken:    process.env.PAYMENT_TOKEN,
        };
        endpoint = `${baseUrl}/api/translate`;
      }

      console.log('Calling endpoint:', endpoint, 'docType:', docType, 'email:', payload.email);

      const translateResp = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await translateResp.json();
      console.log('Translate result:', result.ok, result.orderNum);
    } catch (err) {
      console.error('Post-payment processing error:', err.message);
    }
  }

  return res.status(200).json({ received: true });
};

async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}
