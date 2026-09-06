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

        let itemInfo = null;

        if (videoId) {
            try {
                const pageRes = await fetch(`https://www.tiktok.com/@i/video/${videoId}`, {
                    headers: {
                        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
                        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
                        "Accept-Language": "en-US,en;q=0.9"
                    }
                });
                const html = await pageRes.text();
                const scriptMatch = html.match(/<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__" type="application\/json">([\s\S]*?)<\/script>/);
                if (scriptMatch && scriptMatch[1]) {
                    const parsedData = JSON.parse(scriptMatch[1]);
                    const defaultScope = parsedData?.["__DEFAULT_SCOPE__"];
                    const detail = defaultScope?.["webapp.video-detail"];
                    if (detail && detail.itemInfo && detail.itemInfo.itemStruct) {
                        itemInfo = detail.itemInfo.itemStruct;
                    }
                }
            } catch (e) {}
        };

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
        const d = json.data || {};

        const fixUrl = (link) => {
            if (!link) return '';
            if (link.startsWith('//')) return 'https:' + link;
            if (link.startsWith('/')) return 'https://www.tikwm.com' + link;
            return link;
        };

        const standardPlayUrl = fixUrl(d.play);
        const hdPlayUrl = fixUrl(d.hdplay) || standardPlayUrl;

        let bitrateList = [];
        let vqScore = 65.71;
        let detectedSource = "Phone (Gallery)";

        if (itemInfo) {
            const v = itemInfo.video || {};
            const rawBitrates = v.bitrateInfo || v.bit_rate || [];

            if (Array.isArray(rawBitrates) && rawBitrates.length > 0) {
                rawBitrates.forEach(b => {
                    const gName = b.GearName || b.gear_name || "";
                    const rawCodec = (b.CodecType || b.codec_type || "").toLowerCase();
                    let codec = "h264";
                    if (rawCodec.includes("hevc") || gName.endsWith("_1")) codec = "hevc";
                    else if (rawCodec.includes("bytevc2") || rawCodec.includes("bvc2") || gName.endsWith("_2")) codec = "bvc2";
                    else if (rawCodec.includes("bytevc1")) codec = "bytevc1";

                    const isHd = gName.includes('1080') || gName.includes('720') || gName.includes('2160');
                    const targetPlayUrl = isHd ? hdPlayUrl : standardPlayUrl;
                    const dataSize = Number(b.PlayAddr?.DataSize || b.play_addr?.data_size || b.data_size || 0);

                    bitrateList.push({
                        gear_name: gName,
                        bit_rate: Number(b.Bitrate || b.bit_rate || 0),
                        quality_type: Number(b.QualityType || b.quality_type || 0),
                        codec_type: codec,
                        play_url: targetPlayUrl,
                        data_size: dataSize
                    })
                })
            };

            if (v.VQScore !== undefined && v.VQScore !== null) {
                vqScore = Number(v.VQScore);
            } else if (v.vq_score !== undefined && v.vq_score !== null) {
                vqScore = Number(v.vq_score);
            }

            if (itemInfo.anchors && itemInfo.anchors.some(a => (a.keyword || "").toLowerCase().includes("capcut") || a.type === 28)) {
                detectedSource = "CapCut";
            } else if (itemInfo.isDuet) {
                detectedSource = "Duet";
            } else if (itemInfo.isStitch) {
                detectedSource = "Stitch";
            } else if (bitrateList.some(b => b.gear_name.includes("original_"))) {
                detectedSource = "Browser";
            }
        };

        if (bitrateList.length === 0) {
            bitrateList = [
                {
                    gear_name: "play_addr",
                    bit_rate: Math.round(((Number(d.size) || 15000000) * 8) / (Number(d.duration) || 1)),
                    quality_type: 1,
                    codec_type: "h264",
                    play_url: standardPlayUrl,
                    data_size: Number(d.size || 0)
                },
                {
                    gear_name: "original_1080_0",
                    bit_rate: Math.round(((Number(d.hd_size) || 25000000) * 8) / (Number(d.duration) || 1)),
                    quality_type: 10,
                    codec_type: "h264",
                    play_url: hdPlayUrl,
                    data_size: Number(d.hd_size || d.size || 0)
                }
            ]
        };

        const authorObj = itemInfo?.author || d.author || {};
        const statsObj = itemInfo?.stats || d || {};

        return res.status(200).json({
            Status: true,
            Code: 200,
            code: 0,
            msg: "success",
            data: {
                aweme_id: String(videoId || d.id || "0"),
                id: String(videoId || d.id || "0"),
                desc: itemInfo?.desc || d.title || "",
                create_time: Number(itemInfo?.createTime || d.create_time || Math.floor(Date.now() / 1000)),
                region: itemInfo?.locationCreated || d.region || "ID",
                author: {
                    unique_id: authorObj.uniqueId || authorObj.unique_id || "",
                    nickname: authorObj.nickname || "User"
                },
                music: {
                    title: itemInfo?.music?.title || d.music_info?.title || "original sound",
                    author: itemInfo?.music?.authorName || d.music_info?.author || "",
                    play_url: {
                        url_list: [fixUrl(d.music || d.music_info?.play)]
                    },
                    duration: Number(itemInfo?.music?.duration || d.duration || 0)
                },
                statistics: {
                    play_count: Number(statsObj.playCount || statsObj.play_count || 0),
                    digg_count: Number(statsObj.diggCount || statsObj.digg_count || 0),
                    comment_count: Number(statsObj.commentCount || statsObj.comment_count || 0),
                    share_count: Number(statsObj.shareCount || statsObj.share_count || 0),
                    collect_count: Number(statsObj.collectCount || statsObj.collect_count || 0),
                    download_count: Number(statsObj.downloadCount || statsObj.download_count || 0)
                },
                video: {
                    width: Number(itemInfo?.video?.width || d.width || 576),
                    height: Number(itemInfo?.video?.height || d.height || 1024),
                    duration: Number(itemInfo?.video?.duration || d.duration || 1),
                    bit_rate: bitrateList,
                    play_addr: {
                        url_list: [standardPlayUrl]
                    }
                },
                misc_info: JSON.stringify({
                    source: detectedSource,
                    vq_score: vqScore
                }),
                play: standardPlayUrl,
                hdplay: hdPlayUrl,
                size: Number(d.size || 0),
                hd_size: Number(d.hd_size || d.size || 0)
            }
        })
    } catch (err) {
        return res.status(500).json({
            Status: false,
            Code: 500,
            code: 500,
            msg: err.message,
            data: null
        })
    }
};
