const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false });

  try {
    const d = req.body;

    // Сохраняем данные перевода в metadata (макс 500 символов на поле)
    const metadata = {
      childName:        (d.childName        || '').substring(0, 100),
      stateRegNum:      (d.stateRegNum      || '').substring(0, 50),
      email:            (d.email            || '').substring(0, 100),
      orderNum:         (d.orderNum         || '').substring(0, 20),
      // Сохраняем весь payload как JSON в одном поле
      payload:          JSON.stringify(d).substring(0, 490),
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
          unit_amount: 5500, // $55.00
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
