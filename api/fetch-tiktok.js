export const config = {
  runtime: 'nodejs'
};

export default async function FETCH_TIKTOK(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  const { url } = req.query;

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed. Use GET method.' });
  }

  if (!url) {
    return res.status(400).json({ error: 'TikTok URL parameter is required.' });
  }

  try {
    const params = new URLSearchParams({
      url: url,
      hd: "1"
    });

    const response = await fetch("https://www.tikwm.com/api/", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.6723.86 Mobile Safari/537.36"
      },
      body: params.toString()
    });

    const json = await response.json();

    return res.status(200).json({
      Status: json.code === 0,
      Code: json.code === 0 ? 200 : json.code,
      ...json
    });
  } catch (err) {
    return res.status(500).json({
      Status: false,
      Code: 500,
      code: 500,
      msg: err.message,
      data: null
    });
  }
}
