export const config = {
  api: {
    bodyParser: false, // Required for Stripe signature verification
  },
};

async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, stripe-signature');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
  const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

  try {
    const rawBody = await getRawBody(req);
    const signature = req.headers['stripe-signature'];

    // Verify webhook signature
    const { createHmac } = await import('crypto');
    const elements = signature.split(',');
    const timestamp = elements.find(e => e.startsWith('t=')).slice(2);
    const receivedSig = elements.find(e => e.startsWith('v1=')).slice(3);
    const payload = `${timestamp}.${rawBody.toString()}`;
    const expectedSig = createHmac('sha256', STRIPE_WEBHOOK_SECRET)
      .update(payload)
      .digest('hex');

    if (receivedSig !== expectedSig) {
      return res.status(400).json({ error: 'Invalid signature' });
    }

    const event = JSON.parse(rawBody.toString());
    console.log('Stripe event received:', event.type);

    const SUPABASE_HEADERS = {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'resolution=merge-duplicates'
    };

    if (event.type === 'customer.subscription.created' || 
        event.type === 'customer.subscription.updated' ||
        event.type === 'invoice.payment_succeeded') {
      
      const subscription = event.data.object;
      const customerId = subscription.customer || event.data.object.customer;
      
      // Get customer email from Stripe
      const customerRes = await fetch(
        `https://api.stripe.com/v1/customers/${customerId}`,
        {
          headers: {
            'Authorization': `Basic ${Buffer.from(STRIPE_SECRET_KEY + ':').toString('base64')}`
          }
        }
      );
      const customer = await customerRes.json();
      const email = customer.email;

      if (!email) {
        console.error('No email found for customer:', customerId);
        return res.status(200).json({ received: true });
      }

      // Upsert subscriber in Supabase
      await fetch(`${SUPABASE_URL}/rest/v1/subscribers`, {
        method: 'POST',
        headers: SUPABASE_HEADERS,
        body: JSON.stringify({
          email,
          stripe_customer_id: customerId,
          stripe_subscription_id: subscription.id,
          product_permalink: 'stripe',
          status: 'active',
          subscribed_at: new Date().toISOString()
        })
      });

      console.log('Subscriber activated:', email);
    }

    if (event.type === 'customer.subscription.deleted' ||
        event.type === 'invoice.payment_failed') {
      
      const subscription = event.data.object;
      const customerId = subscription.customer;

      // Get customer email
      const customerRes = await fetch(
        `https://api.stripe.com/v1/customers/${customerId}`,
        {
          headers: {
            'Authorization': `Basic ${Buffer.from(STRIPE_SECRET_KEY + ':').toString('base64')}`
          }
        }
      );
      const customer = await customerRes.json();
      const email = customer.email;

      if (email) {
        // Mark as cancelled in Supabase
        await fetch(
          `${SUPABASE_URL}/rest/v1/subscribers?email=eq.${encodeURIComponent(email)}`,
          {
            method: 'PATCH',
            headers: SUPABASE_HEADERS,
            body: JSON.stringify({
              status: 'cancelled',
              cancelled_at: new Date().toISOString()
            })
          }
        );
        console.log('Subscriber cancelled:', email);
      }
    }

    return res.status(200).json({ received: true });

  } catch (error) {
    console.error('Stripe webhook error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
```

Save the file.

**Step 8: Set Up Stripe Webhook in Stripe Dashboard**
1. In Stripe dashboard go to **Developers → Webhooks**
2. Click **Add endpoint**
3. Enter your endpoint URL:
```
   https://blackfriday-365-backend.vercel.app/api/stripe-webhook