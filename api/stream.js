export const config = {
    runtime: 'nodejs'
};

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Range');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const { url } = req.query;
    if (!url) return res.status(400).send('URL video diperlukan');

    try {
        const decodedUrl = decodeURIComponent(url);

        const rangeHeader = req.headers.range;
        const fetchHeaders = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
            'Referer': 'https://www.tiktok.com/',
            'Accept': '*/*'
        };

        if (rangeHeader) {
            fetchHeaders['Range'] = rangeHeader;
        }

        const videoResponse = await fetch(decodedUrl, {
            headers: fetchHeaders
        });

        if (!videoResponse.ok && videoResponse.status !== 206) {
            return res.redirect(302, decodedUrl);
        }

        res.status(videoResponse.status);

        const contentType = videoResponse.headers.get('content-type') || 'video/mp4';
        const contentLength = videoResponse.headers.get('content-length');
        const contentRange = videoResponse.headers.get('content-range');
        const acceptRanges = videoResponse.headers.get('accept-ranges') || 'bytes';

        res.setHeader('Content-Type', contentType);
        res.setHeader('Accept-Ranges', acceptRanges);
        if (contentLength) res.setHeader('Content-Length', contentLength);
        if (contentRange) res.setHeader('Content-Range', contentRange);

        const arrayBuffer = await videoResponse.arrayBuffer();
        return res.end(Buffer.from(arrayBuffer));

    } catch (err) {
        return res.status(500).send('Gagal memutar video: ' + err.message);
    }
}
