const MAILCHIMP_SERVER = "us11";
const MAILCHIMP_AUDIENCE_ID = "8d31240673";

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const email = req.body && req.body.email;

  if (!email || typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    res.status(400).json({ error: "A valid email is required" });
    return;
  }

  const apiKey = process.env.MAILCHIMP_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "Server is not configured" });
    return;
  }

  try {
    const mailchimpResponse = await fetch(
      `https://${MAILCHIMP_SERVER}.api.mailchimp.com/3.0/lists/${MAILCHIMP_AUDIENCE_ID}/members`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${Buffer.from(`anystring:${apiKey}`).toString("base64")}`,
        },
        body: JSON.stringify({
          email_address: email,
          status: "subscribed",
        }),
      }
    );

    const data = await mailchimpResponse.json();

    if (!mailchimpResponse.ok) {
      if (data.title === "Member Exists") {
        res.status(200).json({ success: true, message: "You're already subscribed." });
        return;
      }
      res.status(mailchimpResponse.status).json({ error: data.detail || "Unable to subscribe" });
      return;
    }

    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Unable to reach Mailchimp" });
  }
};
