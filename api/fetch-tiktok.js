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
        let videoId = null;
        const matchDirect = url.match(/\/video\/(\d+)/) || url.match(/(\d{18,20})/);
        if (matchDirect) {
          videoId = matchDirect[1];
        } else {
          const redirectRes = await fetch(url, {
            headers: {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"
            },
            redirect: "follow"
          });
          const finalUrl = redirectRes.url || "";
          const matchRedirect = finalUrl.match(/\/video\/(\d+)/) || finalUrl.match(/(\d{18,20})/);
          if (matchRedirect) {
            videoId = matchRedirect[1];
          }
        }

        if (videoId) {
          const awemeUrl = `https://api16-normal-c-useast1a.tiktokv.com/aweme/v1/feed/?aweme_id=${videoId}&iid=7318518857994389254&device_id=7318517321748022790&channel=googleplay&app_name=musical_ly&version_code=300904&device_platform=android&device_type=Pixel%207`;
          const awemeRes = await fetch(awemeUrl, {
            headers: {
              "User-Agent": "com.zhiliaoapp.musically/2022609040 (Linux; U; Android 13; en_US; Pixel 7; Build/TQ3A.230901.001; Cronet/58.0.2991.0)"
            }
          });
          const awemeJson = await awemeRes.json();
          if (awemeJson?.aweme_list && awemeJson.aweme_list.length > 0) {
            const item = awemeJson.aweme_list[0];
            return res.status(200).json({
              Status: true,
              Code: 200,
              code: 0,
              msg: "success",
              data: item
            });
          }
        }

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
