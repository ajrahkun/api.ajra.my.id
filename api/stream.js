export const config = {
    runtime: 'nodejs'
};

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    const { url } = req.query;

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
    if (!url) return res.status(400).json({ error: 'Parameter url wajib diisi' });

    try {
        let videoId = "";
        const idMatch = url.match(/\/video\/(\d+)/) || url.match(/\/v\/(\d+)/) || url.match(/modal_id=(\d+)/) || url.match(/item_id=(\d+)/);
        if (idMatch) {
            videoId = idMatch[1];
        } else {
            try {
                const headRes = await fetch(url, {
                    method: "GET",
                    redirect: "follow",
                    headers: {
                        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"
                    }
                });
                const finalUrl = headRes.url || "";
                const finalMatch = finalUrl.match(/\/video\/(\d+)/) || finalUrl.match(/\/v\/(\d+)/);
                if (finalMatch) videoId = finalMatch[1];
            } catch (e) {}
        }

        const params = new URLSearchParams({
            url: url,
            hd: "1"
        });

        const tikwmRes = await fetch("https://www.tikwm.com/api/", {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"
            },
            body: params.toString()
        });

        const json = await tikwmRes.json();

        if (!json || json.code !== 0 || !json.data) {
            return res.status(404).json({
                Status: false,
                msg: "Gagal mengambil data video dari TikTok"
            });
        }

        const d = json.data;
        const vId = d.id || videoId;

        const fixUrl = (link) => {
            if (!link) return '';
            if (link.startsWith('//')) return 'https:' + link;
            if (link.startsWith('/')) return 'https://www.tikwm.com' + link;
            return link;
        };

        const standardPlayUrl = fixUrl(d.play);
        const hdPlayUrl = fixUrl(d.hdplay) || standardPlayUrl;

        const vWidth = d.size_video ? d.size_video[0] : (d.width || 1080);
        const vHeight = d.size_video ? d.size_video[1] : (d.height || 1920);
        const duration = Number(d.duration) || 1;
        const sizeBytes = Number(d.hd_size) || Number(d.size) || 15000000;
        const normalSizeBytes = Number(d.size) || Math.round(sizeBytes * 0.6);

        const hdBitrate = Math.round((sizeBytes * 8) / duration);
        const normalBitrate = Math.round((normalSizeBytes * 8) / duration);

        const streamList = [
            {
                gear_name: "play_addr",
                quality_type: 1,
                bit_rate: normalBitrate,
                codec_type: "h264",
                size: normalSizeBytes,
                fps: 30,
                width: vWidth > vHeight ? 1024 : 576,
                height: vWidth > vHeight ? 576 : 1024,
                play_url: standardPlayUrl
            },
            {
                gear_name: "original_1080_0",
                quality_type: 10,
                bit_rate: hdBitrate,
                codec_type: "h264",
                size: sizeBytes,
                fps: 60,
                width: vWidth,
                height: vHeight,
                play_url: hdPlayUrl
            }
        ];

        return res.status(200).json({
            Status: true,
            Code: 200,
            code: 0,
            msg: "success",
            data: {
                aweme_id: String(vId),
                id: String(vId),
                desc: d.title || "",
                create_time: Number(d.create_time) || Math.floor(Date.now() / 1000),
                region: d.region || "ID",
                author: {
                    unique_id: d.author?.unique_id || "",
                    nickname: d.author?.nickname || "User"
                },
                music: {
                    title: d.music_info?.title || "original sound",
                    author: d.music_info?.author || "",
                    play_url: {
                        url_list: [fixUrl(d.music || d.music_info?.play)]
                    },
                    duration: Number(d.music_info?.duration) || duration
                },
                statistics: {
                    play_count: Number(d.play_count) || 0,
                    digg_count: Number(d.digg_count) || 0,
                    comment_count: Number(d.comment_count) || 0,
                    share_count: Number(d.share_count) || 0,
                    collect_count: Number(d.collect_count) || 0,
                    download_count: Number(d.download_count) || 0
                },
                video: {
                    width: vWidth,
                    height: vHeight,
                    duration: duration,
                    bit_rate: streamList,
                    play_addr: {
                        url_list: [standardPlayUrl]
                    }
                },
                cover: fixUrl(d.cover),
                origin_cover: fixUrl(d.origin_cover || d.cover),
                play: standardPlayUrl,
                hdplay: hdPlayUrl,
                original_resolution: `${vWidth}x${vHeight}`,
                vq_score: 66.32,
                browser_quality: "576p30",
                phone_quality: "1080p60",
                stream_list: streamList
            }
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
