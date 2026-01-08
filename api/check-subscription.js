// This checks if an email has an active subscription
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email } = req.query;

  if (!email) {
    return res.status(400).json({ error: 'Email required' });
  }

  // TODO: Check database for active subscription
  // For now, return false
  return res.json({ active: false, email });
}
