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
            hd: "1",
            web: "1"
        });

        const response = await fetch("https://www.tikwm.com/api/", {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"
            },
            body: params.toString()
        });

        const json = await response.json();

        if (json.code === 0 && json.data) {
            const rawItem = json.data.itemStruct || json.data;
            const videoStruct = rawItem.video || json.data;

            let bitrateList = [];
            if (videoStruct.bitrateInfo && Array.isArray(videoStruct.bitrateInfo)) {
                bitrateList = videoStruct.bitrateInfo.map(b => ({
                    gear_name: b.GearName || "",
                    bit_rate: b.Bitrate || 0,
                    quality_type: b.QualityType || 0,
                    is_bytevc1: (b.CodecType || "").includes("bytevc1") ? 1 : 0,
                    is_h265: (b.CodecType || "").includes("hevc") || (b.CodecType || "").includes("h265") ? 1 : 0,
                    codec_type: b.CodecType || "h264",
                    play_addr: {
                        url_list: b.PlayAddr?.UrlList || [json.data.play],
                        data_size: b.PlayAddr?.DataSize || json.data.size || 0
                    }
                }));
            }

            const anchors = rawItem.anchors || json.data.anchors || [];
            const isCapCut = Array.isArray(anchors) && anchors.some(a => 
                (a.keyword && a.keyword.toLowerCase().includes("capcut")) || 
                (a.description && a.description.toLowerCase().includes("capcut")) ||
                (a.name && a.name.toLowerCase().includes("capcut")) ||
                a.type === 28
            );

            const isDuet = Boolean(rawItem.is_duet || rawItem.duet_info?.duet_origin_item_id || json.data.is_duet);
            const isStitch = Boolean(rawItem.is_stitch || rawItem.stitch_info || json.data.is_stitch);
            const isLive = Boolean(rawItem.is_live_replay || rawItem.item_source === "live");

            let determinedSource = "Phone (Gallery)";

            if (isCapCut) {
                determinedSource = "CapCut";
            } else if (isDuet) {
                determinedSource = "Duet";
            } else if (isStitch) {
                determinedSource = "Stitch";
            } else if (isLive) {
                determinedSource = "Live Highlight";
            } else {
                const shootWay = rawItem.shoot_way ?? rawItem.shoot_tab ?? videoStruct.shoot_way;
                if (shootWay !== undefined && shootWay !== null) {
                    const sWay = String(shootWay).toLowerCase();
                    if (sWay === "1" || sWay === "camera" || sWay === "direct") {
                        determinedSource = "Phone (Camera)";
                    } else if (sWay === "0" || sWay === "gallery" || sWay === "import") {
                        determinedSource = "Phone (Gallery)";
                    }
                } else {
                    const isMobileAspect = (videoStruct.height || 1920) >= (videoStruct.width || 1080);
                    const isWebUpload = rawItem.create_scene === "web" || rawItem.item_source === "web";
                    if (isWebUpload && !isMobileAspect) {
                        determinedSource = "Browser";
                    } else {
                        determinedSource = "Phone (Gallery)";
                    }
                }
            }

            return res.status(200).json({
                Status: true,
                Code: 200,
                code: 0,
                msg: "success",
                data: {
                    aweme_id: json.data.id,
                    id: json.data.id,
                    desc: json.data.title || rawItem.desc || "",
                    create_time: json.data.create_time || rawItem.createTime || 0,
                    region: json.data.region || "ID",
                    author: {
                        unique_id: json.data.author?.unique_id || rawItem.author?.uniqueId || "",
                        nickname: json.data.author?.nickname || rawItem.author?.nickname || "User"
                    },
                    music: {
                        title: json.data.music_info?.title || rawItem.music?.title || "original sound",
                        author: json.data.music_info?.author || rawItem.music?.authorName || "",
                        play_url: {
                            url_list: [json.data.music || json.data.music_info?.play || ""]
                        },
                        duration: json.data.music_info?.duration || json.data.duration || 0
                    },
                    statistics: {
                        play_count: json.data.play_count || 0,
                        digg_count: json.data.digg_count || 0,
                        comment_count: json.data.comment_count || 0,
                        share_count: json.data.share_count || 0,
                        collect_count: json.data.collect_count || 0,
                        download_count: json.data.download_count || 0
                    },
                    video: {
                        width: videoStruct.width || 1080,
                        height: videoStruct.height || 1920,
                        duration: json.data.duration || 0,
                        bit_rate: bitrateList,
                        play_addr: {
                            url_list: [json.data.hdplay || json.data.play]
                        }
                    },
                    misc_info: JSON.stringify({
                        source: determinedSource,
                        vq_score: videoStruct.VQScore || 0
                    }),
                    play: json.data.play,
                    hdplay: json.data.hdplay,
                    size: json.data.size,
                    hd_size: json.data.hd_size
                }
            });
        }

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
