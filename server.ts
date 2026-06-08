import express from 'express';
import path from 'path';
import fs from 'fs';
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
const CACHE_DURATION = 1000 * 60 * 60 * 12; // 12 hours
let isFetchingData = false;

const CACHE_FILE = path.join(process.cwd(), 'youtube_cache.json');

function loadCache() {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const raw = fs.readFileSync(CACHE_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed && parsed.allVideos && parsed.playlists) {
        cacheData = parsed;
        const stats = fs.statSync(CACHE_FILE);
        lastFetchTime = stats.mtimeMs;
        console.log(`[Cache] Loaded ${parsed.allVideos.length} videos from disk cache. Last modified: ${stats.mtime}`);
        return true;
      }
    }
  } catch (e) {
    console.error('[Cache] Failed to load disk cache:', e);
  }
  return false;
}

function saveCache(data: any) {
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(data, null, 2), 'utf-8');
    console.log(`[Cache] Saved ${data.allVideos.length} videos to disk cache.`);
  } catch (e) {
    console.error('[Cache] Failed to save disk cache:', e);
  }
}

function translateVietnamese(text?: string) {
  if (!text) return 'Gần đây';
  let t = text.trim();
  
  // Replace views
  t = t.replace(/views/gi, 'lượt xem');
  t = t.replace(/view/gi, 'lượt xem');
  t = t.replace(/([\d.]+)K /g, '$1N '); // 1.7K -> 1.7N
  t = t.replace(/([\d.]+)M /g, '$1Tr ');

  // Live / Premiere / Streamed status
  t = t.replace(/Streamed live/gi, 'Phát trực tiếp');
  t = t.replace(/Streamed/gi, 'Đã phát trực tiếp');
  t = t.replace(/Premiered/gi, 'Đã công chiếu');
  t = t.replace(/Premieres/gi, 'Công chiếu');
  t = t.replace(/Live/gi, 'Trực tiếp');

  // English articles representing "1"
  t = t.replace(/\ba\s+second\s+ago/gi, '1 giây trước');
  t = t.replace(/\ba\s+minute\s+ago/gi, '1 phút trước');
  t = t.replace(/\ban?\s+hour\s+ago/gi, '1 giờ trước');
  t = t.replace(/\ba\s+day\s+ago/gi, '1 ngày trước');
  t = t.replace(/\ba\s+week\s+ago/gi, '1 tuần trước');
  t = t.replace(/\ba\s+month\s+ago/gi, '1 tháng trước');
  t = t.replace(/\ba\s+year\s+ago/gi, '1 năm trước');

  t = t.replace(/\ba\s+second\b/gi, '1 giây');
  t = t.replace(/\ba\s+minute\b/gi, '1 phút');
  t = t.replace(/\ban?\s+hour\b/gi, '1 giờ');
  t = t.replace(/\ba\s+day\b/gi, '1 ngày');
  t = t.replace(/\ba\s+week\b/gi, '1 tuần');
  t = t.replace(/\ba\s+month\b/gi, '1 tháng');
  t = t.replace(/\ba\s+year\b/gi, '1 năm');

  // Replace time units with 'ago'
  t = t.replace(/seconds?\s+ago/gi, 'giây trước');
  t = t.replace(/minutes?\s+ago/gi, 'phút trước');
  t = t.replace(/hours?\s+ago/gi, 'giờ trước');
  t = t.replace(/days?\s+ago/gi, 'ngày trước');
  t = t.replace(/weeks?\s+ago/gi, 'tuần trước');
  t = t.replace(/months?\s+ago/gi, 'tháng trước');
  t = t.replace(/years?\s+ago/gi, 'năm trước');

  // Loose replacements just in case
  t = t.replace(/\byesterday\b/gi, 'Hôm qua');
  t = t.replace(/\bjust\s+now\b/gi, 'Vừa xong');
  
  // Plural/singular fallback replacements
  t = t.replace(/\bseconds?\b/gi, 'giây');
  t = t.replace(/\bminutes?\b/gi, 'phút');
  t = t.replace(/\bhours?\b/gi, 'giờ');
  t = t.replace(/\bdays?\b/gi, 'ngày');
  t = t.replace(/\bweeks?\b/gi, 'tuần');
  t = t.replace(/\bmonths?\b/gi, 'tháng');
  t = t.replace(/\byears?\b/gi, 'năm');
  t = t.replace(/\bago\b/gi, 'trước');

  // Misc
  t = t.replace(/Updated today/gi, 'Cập nhật hôm nay');
  t = t.replace(/Updated/gi, 'Cập nhật');

  return t;
}

function isExcludedPlaylist(title?: string) {
  if (!title) return false;
  const lower = title.toLowerCase();
  return (lower.includes('musique') && lower.includes('thong nguyen')) || 
         lower.includes('musique — thong nguyen') || 
         lower.includes('musique - thong nguyen');
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

async function doFetchData(channelId: string) {
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
        
        if (isExcludedPlaylist(plTitle)) {
          console.log(`[Filter] Skipping excluded playlist: ${plTitle}`);
          continue;
        }
        
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
  saveCache(cacheData);
  
  return cacheData;
}

async function fetchChannelData(channelId: string) {
  const isExpired = Date.now() - lastFetchTime > CACHE_DURATION;
  
  if (cacheData && (!isExpired || isFetchingData)) {
    // If expired but we are not fetching yet, kick off background fetch
    if (isExpired && !isFetchingData) {
      isFetchingData = true;
      console.log('Cache expired. Starting background fetch...');
      doFetchData(channelId).then(() => {
         console.log('Background fetch completed');
         isFetchingData = false;
      }).catch(e => {
         console.error('Background fetch failed:', e);
         isFetchingData = false;
      });
    }
    return cacheData; // Return immediately (stale-while-revalidate)
  }

  // If no cache, block and wait
  isFetchingData = true;
  try {
    console.log('No cache found. Blocking fetch started...');
    const data = await doFetchData(channelId);
    isFetchingData = false;
    return data;
  } catch (e) {
    isFetchingData = false;
    throw e;
  }
}

const VISITS_FILE = path.join(process.cwd(), 'visits.json');

interface VisitsDB {
  totalVisits: number;
  dailyStats: Record<string, number>;
  uniqueTrack: Record<string, string[]>;
}

function loadVisits(): VisitsDB {
  try {
    if (fs.existsSync(VISITS_FILE)) {
      const data = fs.readFileSync(VISITS_FILE, 'utf-8');
      const db = JSON.parse(data);
      const total = typeof db.totalVisits === 'number' ? db.totalVisits : 21789;
      return {
        totalVisits: Math.max(total, 21789),
        dailyStats: db.dailyStats || {},
        uniqueTrack: db.uniqueTrack || {}
      };
    }
  } catch (e) {
    console.error('Failed to read visits database, using defaults:', e);
  }
  return {
    totalVisits: 21789,
    dailyStats: {},
    uniqueTrack: {}
  };
}

const activeSessions = new Map<string, number>();

function recordActivity(visitorId: string) {
  if (visitorId && typeof visitorId === 'string') {
    activeSessions.set(visitorId, Date.now());
  }
}

function getOnlineCount(): number {
  const now = Date.now();
  // Clean up sessions older than 5 minutes (300,000 ms)
  for (const [vId, timestamp] of activeSessions.entries()) {
    if (now - timestamp > 5 * 60 * 1000) {
      activeSessions.delete(vId);
    }
  }
  // Ensure we show at least 1 online session (for the current connecting user)
  return Math.max(1, activeSessions.size);
}

function saveVisits(db: VisitsDB) {
  try {
    const activeDates = Object.keys(db.uniqueTrack).sort().slice(-3);
    const cleanedUniqueTrack: Record<string, string[]> = {};
    for (const d of activeDates) {
      cleanedUniqueTrack[d] = db.uniqueTrack[d];
    }
    db.uniqueTrack = cleanedUniqueTrack;
    fs.writeFileSync(VISITS_FILE, JSON.stringify(db, null, 2), 'utf-8');
  } catch (e) {
    console.error('Failed to save visits database:', e);
  }
}

async function startServer() {
  loadCache();

  const app = express();
  const PORT = 3000;

  app.use(express.json());

  app.post('/api/visit', (req, res) => {
    try {
      const { visitorId, date } = req.body;
      if (!visitorId || !date || typeof visitorId !== 'string' || typeof date !== 'string') {
        return res.status(400).json({ error: 'Missing visitorId or date' });
      }

      recordActivity(visitorId);

      const db = loadVisits();
      if (!db.uniqueTrack[date]) {
        db.uniqueTrack[date] = [];
      }
      if (db.dailyStats[date] === undefined) {
        db.dailyStats[date] = 0;
      }

      const alreadyTracked = db.uniqueTrack[date].includes(visitorId);
      if (!alreadyTracked) {
        db.uniqueTrack[date].push(visitorId);
        db.totalVisits += 1;
        db.dailyStats[date] += 1;
        saveVisits(db);
      }

      res.json({
        totalVisits: db.totalVisits,
        todayVisits: db.dailyStats[date] || 0,
        onlineCount: getOnlineCount(),
        dailyStats: db.dailyStats
      });
    } catch (e) {
      console.error('API visit tracking error:', e);
      res.status(500).json({ error: 'Server error' });
    }
  });

  app.get('/api/visit/stats', (req, res) => {
    try {
      const date = req.query.date as string;
      const visitorId = req.query.visitorId as string;
      if (!date || typeof date !== 'string') {
        return res.status(400).json({ error: 'Missing date parameter' });
      }

      if (visitorId) {
        recordActivity(visitorId);
      }

      const db = loadVisits();
      res.json({
        totalVisits: db.totalVisits,
        todayVisits: db.dailyStats[date] || 0,
        onlineCount: getOnlineCount(),
        dailyStats: db.dailyStats
      });
    } catch (e) {
      console.error('API visit stats error:', e);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // Health check endpoint cho cron-job hoặc UptimeRobot ping
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.get('/api/data', async (req, res) => {
    try {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      
      const channelId = req.query.channelId || 'UClxiXO5JjB3k5y3-4OtAzug';
      const data = await fetchChannelData(channelId as string);
      
      if (data && data.playlists) {
        const filteredPlaylists = data.playlists.filter((p: any) => !isExcludedPlaylist(p.title));
        
        // Gather and cache IDs of videos belonging to valid/included playlists
        const goodVideoIds = new Set();
        filteredPlaylists.forEach((pl: any) => {
          if (pl.videos) {
            pl.videos.forEach((v: any) => goodVideoIds.add(v.id));
          }
        });
        
        // Only output videos that are shorts or belong to valid playlists
        const filteredAllVideos = data.allVideos
          ? data.allVideos.filter((v: any) => v.isShort || goodVideoIds.has(v.id))
          : [];
          
        res.json({
          ...data,
          playlists: filteredPlaylists,
          allVideos: filteredAllVideos
        });
      } else {
        res.json(data);
      }
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
    
    // Warm up the cache immediately so horizontal scaling or cold starts feel faster
    console.log('Pre-warming cache in background...');
    fetchChannelData('UClxiXO5JjB3k5y3-4OtAzug').catch(console.error);
  });
}

startServer();
