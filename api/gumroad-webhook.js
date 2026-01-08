// This receives webhooks from Gumroad
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // TODO: Add Gumroad webhook verification
  const { sale_id, email, product_permalink, subscription_id, cancelled } = req.body;

  // For now, just log it
  console.log('Webhook received:', { email, product_permalink, cancelled });

  // In next step, we'll store this in a database
  return res.status(200).json({ received: true });
}
