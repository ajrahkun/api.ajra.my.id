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
        const params = new URLSearchParams({
            url: url,
            hd: "1"
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

            const width = Number(videoStruct.width || 720);
            const height = Number(videoStruct.height || 1280);
            const duration = Number(json.data.duration || 1);
            const sizeBytes = Number(json.data.hd_size || json.data.size || 0);
            const bitrateKbps = duration > 0 ? (sizeBytes * 8) / (duration * 1000) : 0;

            const bitrates = videoStruct.bitrateInfo || [];
            const hasBytevc1 = bitrates.some(b => 
                (b.CodecType || b.codec_type || b.GearName || '').toLowerCase().includes('bytevc1')
            );
            const hasOriginalWebTag = bitrates.some(b => 
                (b.GearName || '').includes('original_') || (b.gear_name || '').includes('original_')
            );

            let detectedSource = "Phone (Gallery)";

            const anchors = rawItem.anchors || json.data.anchors || [];
            const isCapCut = Array.isArray(anchors) && anchors.some(a => 
                (a.keyword && a.keyword.toLowerCase().includes("capcut")) || 
                (a.description && a.description.toLowerCase().includes("capcut")) ||
                a.type === 28
            );

            if (isCapCut) {
                detectedSource = "CapCut";
            } else if (rawItem.is_duet || json.data.is_duet) {
                detectedSource = "Duet";
            } else if (rawItem.is_stitch || json.data.is_stitch) {
                detectedSource = "Stitch";
            } else if (hasOriginalWebTag || bitrateKbps > 4500 || (!hasBytevc1 && bitrates.length > 0 && sizeBytes > 10000000)) {
                detectedSource = "Browser";
            } else {
                detectedSource = "Phone (Gallery)";
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
                        width: width,
                        height: height,
                        duration: json.data.duration || 0,
                        play_addr: {
                            url_list: [json.data.hdplay || json.data.play]
                        }
                    },
                    misc_info: JSON.stringify({
                        source: detectedSource,
                        vq_score: 0
                    }),
                    play: json.data.play,
                    hdplay: json.data.hdplay,
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
