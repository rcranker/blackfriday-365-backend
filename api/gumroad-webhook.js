// This receives webhooks from Gumroad
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, product_permalink, subscription_id, cancelled } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email required' });
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

  try {
    if (cancelled) {
      // Mark subscription as cancelled
      await fetch(`${SUPABASE_URL}/rest/v1/subscribers?email=eq.${email}`, {
        method: 'PATCH',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          status: 'cancelled',
          cancelled_at: new Date().toISOString()
        })
      });
    } else {
      // Add or reactivate subscription
      await fetch(`${SUPABASE_URL}/rest/v1/subscribers`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify({
          email,
          gumroad_subscription_id: subscription_id,
          product_permalink,
          status: 'active',
          subscribed_at: new Date().toISOString()
        })
      });
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
