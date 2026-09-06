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
                        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
                    }
                });
                const finalUrl = headRes.url || url;
                const matchRedirect = finalUrl.match(/\/video\/(\d+)/) || finalUrl.match(/\/v\/(\d+)/) || finalUrl.match(/modal_id=(\d+)/);
                if (matchRedirect) {
                    videoId = matchRedirect[1];
                }
            } catch (e) {}
        }

        const formData = new URLSearchParams();
        formData.append('url', url);
        formData.append('count', '12');
        formData.append('cursor', '0');
        formData.append('web', '1');
        formData.append('hd', '1');

        const tikwmRes = await fetch('https://tikwm.com/api/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            },
            body: formData.toString()
        });

        const tikwmJson = await tikwmRes.json();

        if (!tikwmJson || tikwmJson.code !== 0 || !tikwmJson.data) {
            return res.status(404).json({
                Status: false,
                msg: "Gagal mengambil data video dari TikTok"
            });
        }

        const d = tikwmJson.data;
        const ensureAbsolute = (link) => {
            if (!link) return '';
            if (link.startsWith('//')) return 'https:' + link;
            if (link.startsWith('/')) return 'https://www.tikwm.com' + link;
            return link;
        };

        const playUrl = ensureAbsolute(d.play);
        const hdPlayUrl = ensureAbsolute(d.hdplay) || playUrl;

        let videoQualityScore = 66.32;
        let vWidth = d.size_video ? d.size_video[0] : 1080;
        let vHeight = d.size_video ? d.size_video[1] : 1920;

        let streamList = [];

        if (Array.isArray(d.bitrate) && d.bitrate.length > 0) {
            streamList = d.bitrate.map(item => {
                let sUrl = '';
                if (item.play_addr && Array.isArray(item.play_addr.url_list) && item.play_addr.url_list.length > 0) {
                    sUrl = item.play_addr.url_list[0];
                } else if (typeof item.play_addr === 'string') {
                    sUrl = item.play_addr;
                } else {
                    sUrl = playUrl;
                }
                return {
                    gear_name: item.gear_name || 'lower_540_0',
                    quality_type: item.quality_type || 20,
                    bit_rate: item.bit_rate || 1600000,
                    codec_type: item.codec_type || 'hevc',
                    size: item.size || 3200000,
                    fps: item.fps || 60,
                    width: item.width || vWidth,
                    height: item.height || vHeight,
                    play_url: sUrl
                };
            });
        }

        const hasGear = (name) => streamList.some(s => s.gear_name === name);
        const getStreamByGear = (name) => streamList.find(s => s.gear_name === name);

        const ref540 = getStreamByGear('lower_540_0') || streamList[0] || {};
        const refBaseUrl = ref540.play_url || playUrl;

        const defaultGears = [
            { gear_name: 'original_2160_0', quality_type: 40, bit_rate: 4500000, codec_type: 'hevc', size: 9500000, fps: 60, width: 2160, height: 3840, play_url: (getStreamByGear('adapt_lowest_1080_1') || {}).play_url || hdPlayUrl },
            { gear_name: 'adapt_lowest_1080_1', quality_type: 30, bit_rate: 2600000, codec_type: 'hevc', size: 5500000, fps: 60, width: 1080, height: 1920, play_url: hdPlayUrl },
            { gear_name: 'adapt_540_1', quality_type: 25, bit_rate: 1800000, codec_type: 'hevc', size: 3800000, fps: 60, width: 720, height: 1280, play_url: refBaseUrl },
            { gear_name: 'adapt_lower_720_2', quality_type: 24, bit_rate: 1600000, codec_type: 'bytevc1', size: 3400000, fps: 60, width: 720, height: 1280, play_url: refBaseUrl },
            { gear_name: 'normal_540_1', quality_type: 22, bit_rate: 1400000, codec_type: 'hevc', size: 3000000, fps: 30, width: 576, height: 1024, play_url: refBaseUrl },
            { gear_name: 'lower_540_0', quality_type: 20, bit_rate: 1200000, codec_type: 'hevc', size: 2600000, fps: 30, width: 576, height: 1024, play_url: refBaseUrl },
            { gear_name: 'lower_540_1', quality_type: 18, bit_rate: 1000000, codec_type: 'h264', size: 2200000, fps: 30, width: 576, height: 1024, play_url: refBaseUrl },
            { gear_name: 'lowest_540_1', quality_type: 15, bit_rate: 800000, codec_type: 'h264', size: 1800000, fps: 30, width: 576, height: 1024, play_url: refBaseUrl },
            { gear_name: 'lowest_480_1', quality_type: 10, bit_rate: 600000, codec_type: 'h264', size: 1400000, fps: 30, width: 480, height: 854, play_url: refBaseUrl }
        ];

        defaultGears.forEach(dg => {
            if (!hasGear(dg.gear_name)) {
                streamList.push(dg);
            }
        });

        const knownOrder = [
            'original_2160_0',
            'adapt_lowest_1080_1',
            'adapt_540_1',
            'adapt_lower_720_2',
            'normal_540_1',
            'lower_540_0',
            'lower_540_1',
            'lowest_540_1',
            'lowest_480_1'
        ];

        streamList.sort((a, b) => {
            const idxA = knownOrder.indexOf(a.gear_name);
            const idxB = knownOrder.indexOf(b.gear_name);
            if (idxA !== -1 && idxB !== -1) return idxA - idxB;
            if (idxA !== -1) return -1;
            if (idxB !== -1) return 1;
            return (b.width * b.height) - (a.width * a.height);
        });

        return res.status(200).json({
            Status: true,
            Code: 200,
            code: 0,
            msg: "success",
            data: {
                aweme_id: d.id || videoId,
                id: d.id || videoId,
                desc: d.title || "",
                create_time: d.create_time || Math.floor(Date.now() / 1000),
                region: d.region || "ID",
                author: {
                    unique_id: d.author?.unique_id || "",
                    nickname: d.author?.nickname || ""
                },
                music: {
                    title: d.music_info?.title || "",
                    author: d.music_info?.author || "",
                    play_url: {
                        url_list: [ensureAbsolute(d.music)]
                    },
                    duration: d.duration || 0
                },
                statistics: {
                    play_count: d.play_count || 0,
                    digg_count: d.digg_count || 0,
                    comment_count: d.comment_count || 0,
                    share_count: d.share_count || 0,
                    download_count: d.download_count || 0,
                    collect_count: d.collect_count || 0
                },
                cover: ensureAbsolute(d.cover),
                origin_cover: ensureAbsolute(d.origin_cover || d.cover),
                play: playUrl,
                hdplay: hdPlayUrl,
                original_resolution: `${vWidth}x${vHeight}`,
                vq_score: videoQualityScore,
                browser_quality: '576p30',
                phone_quality: '1080p60',
                stream_list: streamList
            }
        });

    } catch (error) {
        return res.status(500).json({
            Status: false,
            msg: error.message || "Internal server error"
        });
    }
}
