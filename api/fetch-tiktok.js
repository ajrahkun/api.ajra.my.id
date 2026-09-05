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
            try {
                const webApiUrl = `https://www.tiktok.com/api/item/detail/?itemId=${videoId}`;
                const webRes = await fetch(webApiUrl, {
                    headers: {
                        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
                        "Referer": "https://www.tiktok.com/",
                        "Accept": "application/json, text/plain, */*"
                    }
                });
                const webRaw = await webRes.text();
                if (webRaw.startsWith("{")) {
                    const webJson = JSON.parse(webRaw);
                    const itemDetail = webJson?.itemInfo?.itemStruct;
                    if (itemDetail) {
                        return res.status(200).json({
                            Status: true,
                            Code: 200,
                            code: 0,
                            msg: "success",
                            data: {
                                aweme_id: itemDetail.id,
                                id: itemDetail.id,
                                desc: itemDetail.desc,
                                create_time: itemDetail.createTime,
                                author: {
                                    unique_id: itemDetail.author?.uniqueId,
                                    nickname: itemDetail.author?.nickname,
                                    avatar: itemDetail.author?.avatarLarger
                                },
                                music: {
                                    title: itemDetail.music?.title,
                                    author: itemDetail.music?.authorName,
                                    play_url: {
                                        url_list: [itemDetail.music?.playUrl]
                                    },
                                    duration: itemDetail.music?.duration
                                },
                                statistics: {
                                    play_count: itemDetail.stats?.playCount,
                                    digg_count: itemDetail.stats?.diggCount,
                                    comment_count: itemDetail.stats?.commentCount,
                                    share_count: itemDetail.stats?.shareCount,
                                    collect_count: itemDetail.stats?.collectCount,
                                    download_count: 0
                                },
                                video: {
                                    width: itemDetail.video?.width,
                                    height: itemDetail.video?.height,
                                    ratio: itemDetail.video?.ratio,
                                    duration: itemDetail.video?.duration,
                                    bit_rate: (itemDetail.video?.bitrateInfo || []).map(b => ({
                                        gear_name: b.GearName,
                                        bit_rate: b.Bitrate,
                                        quality_type: b.QualityType,
                                        is_bytevc1: b.CodecType?.includes("bytevc1") ? 1 : 0,
                                        play_addr: {
                                            url_list: [b.PlayAddr?.UrlList?.[0]],
                                            data_size: b.PlayAddr?.DataSize
                                        }
                                    })),
                                    play_addr: {
                                        url_list: [itemDetail.video?.playAddr]
                                    }
                                },
                                misc_info: JSON.stringify({
                                    source: "Phone (Gallery)",
                                    vq_score: itemDetail.video?.VQScore || 0
                                }),
                                region: "ID"
                            }
                        });
                    }
                }
            } catch (awemeErr) {}
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

        const tikwmRaw = await response.text();
        if (!tikwmRaw.startsWith("{")) {
            throw new Error("TikTok upstream provider rate-limited or blocked.");
        }

        const json = JSON.parse(tikwmRaw);

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
