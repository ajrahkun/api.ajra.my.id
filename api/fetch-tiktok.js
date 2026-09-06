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
                rawBitrates.forEach(b => {
                    const gName = b.GearName || b.gear_name || "";
                    const rawCodec = (b.CodecType || b.codec_type || "").toLowerCase();
                    let codec = "h264";
                    if (rawCodec.includes("hevc") || gName.endsWith("_1")) codec = "hevc";
                    else if (rawCodec.includes("bytevc2") || rawCodec.includes("bvc2") || gName.endsWith("_2")) codec = "bvc2";
                    else if (rawCodec.includes("bytevc1")) codec = "bytevc1";

                    const playUrl = b.PlayAddr?.UrlList?.[0] || b.play_addr?.url_list?.[0] || b.play_url || "";
                    const dataSize = Number(b.PlayAddr?.DataSize || b.play_addr?.data_size || b.data_size || 0);

                    bitrateList.push({
                        gear_name: gName,
                        bit_rate: Number(b.Bitrate || b.bit_rate || 0),
                        quality_type: Number(b.QualityType || b.quality_type || 0),
                        codec_type: codec,
                        play_url: playUrl,
                        data_size: dataSize
                    });
                });
            }

            const basePlayUrl = v.playAddr || bitrateList[0]?.play_url || "";

            const has1080 = bitrateList.some(b => b.gear_name.includes("1080"));
            if (has1080 && bitrateList.length < 8) {
                if (!bitrateList.some(b => b.gear_name === "adapt_lower_720_2")) {
                    const ref720 = bitrateList.find(b => b.gear_name === "adapt_lower_720_1");
                    const refBitrate = ref720 ? Math.round(ref720.bit_rate * 0.71) : 517000;
                    const refSize = ref720 ? Math.round(ref720.data_size * 0.71) : 1048576;
                    bitrateList.push({
                        gear_name: "adapt_lower_720_2",
                        bit_rate: refBitrate,
                        quality_type: 15,
                        codec_type: "bvc2",
                        play_url: ref720?.play_url || basePlayUrl,
                        data_size: refSize
                    });
                }

                if (!bitrateList.some(b => b.gear_name === "lower_540_1")) {
                    const ref540 = bitrateList.find(b => b.gear_name === "comet_adapt_lower_540_1") || bitrateList.find(b => b.gear_name === "adapt_540_1");
                    const refBitrate = ref540 ? Math.round(ref540.bit_rate * 0.73) : 379000;
                    const refSize = ref540 ? Math.round(ref540.data_size * 0.73) : 771000;
                    bitrateList.push({
                        gear_name: "lower_540_1",
                        bit_rate: refBitrate,
                        quality_type: 25,
                        codec_type: "hevc",
                        play_url: ref540?.play_url || basePlayUrl,
                        data_size: refSize
                    });
                }

                if (!bitrateList.some(b => b.gear_name === "lowest_540_1")) {
                    const ref540 = bitrateList.find(b => b.gear_name === "lower_540_1") || bitrateList[0];
                    const refBitrate = ref540 ? Math.round(ref540.bit_rate * 0.79) : 301000;
                    const refSize = ref540 ? Math.round(ref540.data_size * 0.79) : 612000;
                    bitrateList.push({
                        gear_name: "lowest_540_1",
                        bit_rate: refBitrate,
                        quality_type: 26,
                        codec_type: "hevc",
                        play_url: ref540?.play_url || basePlayUrl,
                        data_size: refSize
                    });
                }

                if (!bitrateList.some(b => b.gear_name === "lowest_480_1")) {
                    const ref540 = bitrateList.find(b => b.gear_name === "lowest_540_1") || bitrateList[0];
                    const refBitrate = ref540 ? Math.round(ref540.bit_rate * 0.95) : 287000;
                    const refSize = ref540 ? Math.round(ref540.data_size * 0.95) : 582000;
                    bitrateList.push({
                        gear_name: "lowest_480_1",
                        bit_rate: refBitrate,
                        quality_type: 30,
                        codec_type: "hevc",
                        play_url: ref540?.play_url || basePlayUrl,
                        data_size: refSize
                    });
                }
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

            const priorityOrder = [
                "original_2160_0",
                "adapt_lowest_1080_1",
                "adapt_lower_720_1",
                "adapt_lower_720_2",
                "play_addr",
                "lower_540_0",
                "adapt_540_1",
                "comet_adapt_lower_540_1",
                "lower_540_1",
                "lowest_540_1",
                "lowest_480_1"
            ];

            bitrateList.sort((a, b) => {
                const idxA = priorityOrder.indexOf(a.gear_name);
                const idxB = priorityOrder.indexOf(b.gear_name);
                if (idxA !== -1 && idxB !== -1) return idxA - idxB;
                if (idxA !== -1) return -1;
                if (idxB !== -1) return 1;
                return b.bit_rate - a.bit_rate;
            });

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
