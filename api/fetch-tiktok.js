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
        }

        if (itemInfo) {
            const v = itemInfo.video || {};
            const rawBitrates = v.bitrateInfo || v.bit_rate || [];

            let bitrateList = [];
            if (Array.isArray(rawBitrates) && rawBitrates.length > 0) {
                bitrateList = rawBitrates.map(b => {
                    const gName = b.GearName || b.gear_name || "";
                    const rawCodec = (b.CodecType || b.codec_type || "").toLowerCase();
                    const codec = rawCodec.includes("hevc") ? "hevc" : (rawCodec.includes("bytevc2") || rawCodec.includes("bvc2") ? "bvc2" : (rawCodec.includes("bytevc1") ? "bytevc1" : "h264"));
                    const playUrl = b.PlayAddr?.UrlList?.[0] || b.play_addr?.url_list?.[0] || b.play_url || "";
                    const dataSize = Number(b.PlayAddr?.DataSize || b.play_addr?.data_size || b.data_size || 0);

                    return {
                        gear_name: gName,
                        bit_rate: Number(b.Bitrate || b.bit_rate || 0),
                        quality_type: Number(b.QualityType || b.quality_type || 0),
                        codec_type: codec,
                        play_url: playUrl,
                        data_size: dataSize
                    };
                });
            }

            if (v.playAddr && !bitrateList.some(b => b.gear_name === "play_addr")) {
                bitrateList.push({
                    gear_name: "play_addr",
                    bit_rate: Number(v.bitrate || 853000),
                    quality_type: 1,
                    codec_type: "h264",
                    play_url: v.playAddr,
                    data_size: Number(v.size || 0)
                });
            }

            let vqScore = 0;
            if (v.VQScore !== undefined && v.VQScore !== null) {
                vqScore = Number(v.VQScore);
            } else if (v.vq_score !== undefined && v.vq_score !== null) {
                vqScore = Number(v.vq_score);
            }

            let detectedSource = "Phone (Gallery)";
            if (itemInfo.anchors && itemInfo.anchors.some(a => (a.keyword || "").toLowerCase().includes("capcut") || a.type === 28)) {
                detectedSource = "CapCut";
            } else if (itemInfo.isDuet) {
                detectedSource = "Duet";
            } else if (itemInfo.isStitch) {
                detectedSource = "Stitch";
            } else if (bitrateList.some(b => b.gear_name.includes("original_"))) {
                detectedSource = "Browser";
            }

            const stats = itemInfo.stats || {};
            const author = itemInfo.author || {};
            const music = itemInfo.music || {};

            return res.status(200).json({
                Status: true,
                Code: 200,
                code: 0,
                msg: "success",
                data: {
                    aweme_id: itemInfo.id,
                    id: itemInfo.id,
                    desc: itemInfo.desc || "",
                    create_time: Number(itemInfo.createTime || 0),
                    region: itemInfo.locationCreated || "ID",
                    author: {
                        unique_id: author.uniqueId || "",
                        nickname: author.nickname || "User"
                    },
                    music: {
                        title: music.title || "original sound",
                        author: music.authorName || "",
                        play_url: {
                            url_list: [music.playUrl || ""]
                        },
                        duration: Number(music.duration || 0)
                    },
                    statistics: {
                        play_count: Number(stats.playCount || 0),
                        digg_count: Number(stats.diggCount || 0),
                        comment_count: Number(stats.commentCount || 0),
                        share_count: Number(stats.shareCount || 0),
                        collect_count: Number(stats.collectCount || 0),
                        download_count: Number(stats.downloadCount || 0)
                    },
                    video: {
                        width: Number(v.width || 720),
                        height: Number(v.height || 1280),
                        duration: Number(v.duration || 0),
                        bit_rate: bitrateList,
                        play_addr: {
                            url_list: [v.playAddr || ""]
                        }
                    },
                    misc_info: JSON.stringify({
                        source: detectedSource,
                        vq_score: vqScore
                    }),
                    play: v.playAddr || "",
                    hdplay: bitrateList[0]?.play_url || v.playAddr || "",
                    size: Number(v.size || 0),
                    hd_size: bitrateList[0]?.data_size || Number(v.size || 0)
                }
            });
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

        if (json.code === 0 && json.data) {
            const rawItem = json.data.itemStruct || json.data;
            const videoStruct = rawItem.video || json.data;

            const width = Number(videoStruct.width || json.data.width || 720);
            const height = Number(videoStruct.height || json.data.height || 1280);
            const duration = Number(json.data.duration || videoStruct.duration || 1);
            const sizeBytes = Number(json.data.hd_size || json.data.size || 0);
            const bitrateKbps = duration > 0 ? (sizeBytes * 8) / (duration * 1000) : 0;

            const rawBitrates = videoStruct.bitrateInfo || rawItem.video?.bitrateInfo || videoStruct.bit_rate || rawItem.bit_rate || [];

            let bitrateList = [];
            if (Array.isArray(rawBitrates) && rawBitrates.length > 0) {
                bitrateList = rawBitrates.map(b => {
                    const rawCodec = (b.CodecType || b.codec_type || "").toLowerCase();
                    const codec = rawCodec.includes("hevc") ? "hevc" : (rawCodec.includes("bytevc2") || rawCodec.includes("bvc2") ? "bvc2" : (rawCodec.includes("bytevc1") ? "bytevc1" : "h264"));
                    return {
                        gear_name: b.GearName || b.gear_name || "",
                        bit_rate: Number(b.Bitrate || b.bit_rate || 0),
                        quality_type: Number(b.QualityType || b.quality_type || 0),
                        codec_type: codec,
                        play_url: b.PlayAddr?.UrlList?.[0] || b.play_addr?.url_list?.[0] || b.play_url || "",
                        data_size: Number(b.PlayAddr?.DataSize || b.play_addr?.data_size || 0)
                    };
                });
            }

            if (bitrateList.length === 0) {
                const playUrl = json.data.hdplay ? `https://www.tikwm.com${json.data.hdplay.startsWith('/') ? '' : '/'}${json.data.hdplay}` : (json.data.play ? `https://www.tikwm.com${json.data.play.startsWith('/') ? '' : '/'}${json.data.play}` : "");
                bitrateList.push({
                    gear_name: "play_addr",
                    bit_rate: Math.round(bitrateKbps * 1000),
                    quality_type: 1,
                    codec_type: "h264",
                    play_url: playUrl,
                    data_size: sizeBytes
                });
            }

            let vqScore = 0;
            if (videoStruct.VQScore !== undefined && videoStruct.VQScore !== null) {
                vqScore = Number(videoStruct.VQScore);
            } else if (rawItem.video?.VQScore !== undefined && rawItem.video?.VQScore !== null) {
                vqScore = Number(rawItem.video.VQScore);
            } else if (json.data.vq_score !== undefined && json.data.vq_score !== null) {
                vqScore = Number(json.data.vq_score);
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
                            url_list: [json.data.music ? `https://www.tikwm.com${json.data.music.startsWith('/') ? '' : '/'}${json.data.music}` : ""]
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
                        width: width,
                        height: height,
                        duration: json.data.duration || 0,
                        bit_rate: bitrateList,
                        play_addr: {
                            url_list: [bitrateList[0]?.play_url || ""]
                        }
                    },
                    misc_info: JSON.stringify({
                        source: "Phone (Gallery)",
                        vq_score: vqScore
                    }),
                    play: bitrateList[0]?.play_url || "",
                    hdplay: bitrateList[0]?.play_url || "",
                    size: json.data.size,
                    hd_size: json.data.hd_size
                }
            });
        }

        return res.status(200).json({
            Status: false,
            Code: json.code || 400,
            msg: json.msg || "Gagal mengambil data video TikTok"
        });

    } catch (err) {
        return res.status(500).json({
            Status: false,
            Code: 500,
            msg: err.message
        });
    }
}
