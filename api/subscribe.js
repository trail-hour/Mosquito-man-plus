export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });

  const API_KEY = process.env.MAILCHIMP_API_KEY;
  const AUDIENCE_ID = '8d31240673';
  const SERVER = 'us11';

  const response = await fetch(`https://${SERVER}.api.mailchimp.com/3.0/lists/${AUDIENCE_ID}/members`, {
    method: 'POST',
    headers: {
      Authorization: `apikey ${API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email_address: email, status: 'subscribed' }),
  });

  const data = await response.json();
  if (response.ok) return res.status(200).json({ success: true });
  if (data.title === 'Member Exists') return res.status(200).json({ success: true, existing: true });
  return res.status(500).json({ error: data.detail || 'Subscription failed' });
}
