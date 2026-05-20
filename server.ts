import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { Innertube, UniversalCache } from 'youtubei.js';

// Silence verbose internal parser warnings from youtubei.js
const originalConsoleWarn = console.warn;
const originalConsoleError = console.error;
console.warn = (...args) => {
  if (typeof args[0] === 'string' && args[0].includes('[YOUTUBEJS]')) return;
  originalConsoleWarn(...args);
};
console.error = (...args) => {
  if (typeof args[0] === 'string' && args[0].includes('[YOUTUBEJS]')) return;
  if (args[0] instanceof Error && args[0].message.includes('[YOUTUBEJS]')) return;
  originalConsoleError(...args);
};

let ytParams: any = null;

async function getInnertube() {
  if (!ytParams) {
    ytParams = await Innertube.create({ cache: new UniversalCache(false) });
  }
  return ytParams;
}

// Global cache to avoid spamming the YouTube API
let cacheData: any = null;
let lastFetchTime = 0;
const CACHE_DURATION = 1000 * 60; // Reduce to 1 minute to prevent stale data debugging

function translateVietnamese(text?: string) {
  if (!text) return 'Gần đây';
  let t = text;
  
  // Replace views
  t = t.replace(/views/gi, 'lượt xem');
  t = t.replace(/view/gi, 'lượt xem');
  t = t.replace(/([\d.]+)K /g, '$1N '); // 1.7K -> 1.7N
  t = t.replace(/([\d.]+)M /g, '$1Tr ');

  // Replace time
  t = t.replace(/seconds? ago/gi, 'giây trước');
  t = t.replace(/minutes? ago/gi, 'phút trước');
  t = t.replace(/hours? ago/gi, 'giờ trước');
  t = t.replace(/days? ago/gi, 'ngày trước');
  t = t.replace(/weeks? ago/gi, 'tuần trước');
  t = t.replace(/months? ago/gi, 'tháng trước');
  t = t.replace(/years? ago/gi, 'năm trước');

  // Misc
  t = t.replace(/Updated today/gi, 'Cập nhật hôm nay');
  t = t.replace(/Updated/gi, 'Cập nhật');

  return t;
}

function checkIsShort(item: any, plTitle?: string) {
  if (item.type === 'ShortsLockupView') return true;
  if (plTitle) {
    const titleL = plTitle.toLowerCase();
    if (titleL === 'kinh lời vàng phật dạy (pháp cú)' || titleL === 'kinh pháp cú - dhammapada' || titleL === '37 phẩm trợ đạo') {
       return true; // Mark as shorts to display in 9:16 aspect ratio
    }
  }
  if (item.duration?.seconds && item.duration.seconds <= 65) return true;
  const thumbs = item.thumbnails || item.thumbnail || item.on_tap_endpoint?.payload?.thumbnail?.thumbnails;
  if (thumbs?.[0]) {
    // 9:16 aspect ratio usually has height > width
    if (thumbs[0].height > thumbs[0].width) {
      return true;
    }
  }
  return false;
}

async function fetchChannelData(channelId: string) {
  if (cacheData && (Date.now() - lastFetchTime < CACHE_DURATION)) {
    return cacheData;
  }
  
  const yt = await getInnertube();
  const channel = await yt.getChannel(channelId);
  const channelTitle = channel.metadata.title;

  let allVideosMap = new Map();
  let playlistsResult = [];

  // Fetch Playlists and Shorts concurrently
  const [playlistsData, shortsData] = await Promise.all([
    channel.getPlaylists().catch(e => { console.error("Error fetching playlists:", e); return null; }),
    channel.getShorts().catch(e => { console.error("Error fetching shorts:", e); return null; })
  ]);

  if (playlistsData?.playlists) {
    const pList = playlistsData.playlists.filter((p: any) => p.content_type === 'PLAYLIST');
        playlistsResult = [];
      for (const p of pList) {
        const plId = p.content_id;
        const plTitle = p.metadata?.title?.text || p.title?.text || 'Untitled';
        
        let videos = [];
        try {
          const pl = await yt.getPlaylist(plId);
          videos = pl.items.map((item: any) => {
            const id = item.id || item.video_id || (item.on_tap_endpoint?.payload?.videoId);
            const title = item.title?.text || item.overlay_metadata?.primary_text?.text || 'Untitled';
            const thumbnail = item.thumbnails?.[0]?.url || item.thumbnail?.[0]?.url || item.on_tap_endpoint?.payload?.thumbnail?.thumbnails?.[0]?.url || `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
            
            let published = item.published?.text || item.overlay_metadata?.secondary_text?.text;
            if (!published && item.video_info?.runs?.length > 0) {
               published = item.video_info.runs[item.video_info.runs.length - 1].text;
            } else if (!published && item.video_info?.text) {
               published = item.video_info.text.split('•').pop()?.trim();
            }
            
            return {
              id,
              title,
              link: `https://www.youtube.com/watch?v=${id}`,
              thumbnail,
              author: item.author?.name || channelTitle,
              published: translateVietnamese(published),
              duration: item.duration?.text || '',
              isShort: checkIsShort(item, plTitle)
            };
          });
        } catch (e) {
          console.error(`Failed to fetch playlist ${plId}`, e);
        }

        // Replace and deduplicate videos
        videos = videos.map((v: any) => {
          if (!allVideosMap.has(v.id)) {
            allVideosMap.set(v.id, v);
            return v;
          }
          return allVideosMap.get(v.id);
        });

        playlistsResult.push({
          id: plId,
          title: plTitle,
          videos
        });
      }
  }

  // Process Shorts for the All tab
  if (shortsData?.videos?.length) {
    shortsData.videos.forEach((item: any) => {
      const id = item.id || item.video_id || (item.on_tap_endpoint?.payload?.videoId);
      if (id && !allVideosMap.has(id)) {
        allVideosMap.set(id, {
            id: id,
            title: item.title?.text || item.overlay_metadata?.primary_text?.text || 'Video',
            link: `https://www.youtube.com/watch?v=${id}`,
            thumbnail: item.thumbnails?.[0]?.url || item.thumbnail?.[0]?.url || item.on_tap_endpoint?.payload?.thumbnail?.thumbnails?.[0]?.url || `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
            author: channelTitle,
            published: translateVietnamese(item.overlay_metadata?.secondary_text?.text),
            isShort: true
        });
      }
    });
  }

  const allVideos = Array.from(allVideosMap.values());

  // Fill in missing dates (for shorts or items without dates)
  const missingDates = allVideos.filter((v: any) => 
    !v.published || v.published === 'Gần đây' || v.published.includes('lượt xem')
  );
  
  if (missingDates.length > 0) {
      console.log(`Fetching missing dates for ${missingDates.length} videos...`);
      for (let i = 0; i < missingDates.length; i += 20) {
          const chunk = missingDates.slice(i, i + 20);
          await Promise.all(chunk.map(async (v: any) => {
              try {
                  const info = await yt.getInfo(v.id);
                  let dateText = info.primary_info?.relative_date?.text || info.primary_info?.published?.text;
                  if (dateText) {
                      v.published = translateVietnamese(dateText);
                  } else {
                      v.published = 'Gần đây';
                  }
              } catch (e) {
                  v.published = 'Gần đây';
              }
          }));
      }
  }

  cacheData = {
    channelTitle,
    playlists: playlistsResult,
    allVideos
  };
  lastFetchTime = Date.now();
  
  return cacheData;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  app.get('/api/data', async (req, res) => {
    try {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      
      const channelId = req.query.channelId || 'UClxiXO5JjB3k5y3-4OtAzug';
      const data = await fetchChannelData(channelId as string);
      res.json(data);
    } catch (error) {
      console.error('Error fetching data:', error);
      res.status(500).json({ error: 'Không thể tải video, vui lòng thử lại sau.' });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
