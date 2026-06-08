import React, { useState, useEffect, useMemo } from 'react';
import { Loader2, Search } from 'lucide-react';
import { motion } from 'motion/react';
import { Video, Playlist, YouTubeResponse } from './types';
import { VideoCard } from './components/VideoCard';

const CHANNEL_ID = 'UClxiXO5JjB3k5y3-4OtAzug';

export default function App() {
  const [data, setData] = useState<YouTubeResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [localSearchQuery, setLocalSearchQuery] = useState('');
  const [visitorStats, setVisitorStats] = useState<{
    totalVisits: number;
    todayVisits: number;
    onlineCount?: number;
    dailyStats?: Record<string, number>;
  } | null>(null);

  // Debounce the search input to eliminate typing lag
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(localSearchQuery);
    }, 220);
    return () => clearTimeout(timer);
  }, [localSearchQuery]);

  useEffect(() => {
    fetchData();
    trackVisitor();

    // Periodic ping to keep session alive and retrieve real-time stats
    const interval = setInterval(() => {
      pingStats();
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, []);

  const pingStats = async () => {
    try {
      const visitorId = localStorage.getItem('sh_visitor_id');
      if (!visitorId) return;

      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const dd = String(today.getDate()).padStart(2, '0');
      const dateStr = `${yyyy}-${mm}-${dd}`;

      const res = await fetch(`/api/visit/stats?date=${dateStr}&visitorId=${visitorId}`);
      if (res.ok) {
        const stats = await res.json();
        setVisitorStats(stats);
      }
    } catch (err) {
      console.error('Failed to ping stats:', err);
    }
  };

  const trackVisitor = async () => {
    try {
      let visitorId = localStorage.getItem('sh_visitor_id');
      if (!visitorId) {
        visitorId = 'vis_' + Math.random().toString(36).substring(2, 11) + Date.now().toString(36);
        localStorage.setItem('sh_visitor_id', visitorId);
      }

      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const dd = String(today.getDate()).padStart(2, '0');
      const dateStr = `${yyyy}-${mm}-${dd}`;

      const lastVisitDate = localStorage.getItem('sh_last_visit_date');

      let url = `/api/visit/stats?date=${dateStr}&visitorId=${visitorId}`;
      let options: RequestInit = { method: 'GET' };

      if (!lastVisitDate || lastVisitDate !== dateStr) {
        url = '/api/visit';
        options = {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ visitorId, date: dateStr })
        };
      }

      const res = await fetch(url, options);
      if (res.ok) {
        const stats = await res.json();
        setVisitorStats(stats);
        if (!lastVisitDate || lastVisitDate !== dateStr) {
          localStorage.setItem('sh_last_visit_date', dateStr);
        }
      }
    } catch (err) {
      console.error('Failed to track visitor stats:', err);
    }
  };

  const fetchData = async () => {
    setIsLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/data?channelId=${CHANNEL_ID}`);
      const result: YouTubeResponse = await res.json();
      
      if (!res.ok) {
        throw new Error(result.error || 'Failed to fetch videos');
      }

      setData(result);
    } catch (err: any) {
      setError(err.message || 'Có lỗi xảy ra khi tải dữ liệu.');
    } finally {
      setIsLoading(false);
    }
  };

  const displayedVideos = useMemo(() => {
    if (!data) return [];
    
    let filtered = [];
    if (activeTab === 'all') {
      filtered = data.allVideos || [];
    } else {
      const playlist = data.playlists?.find(p => p.id === activeTab);
      filtered = playlist && playlist.videos ? playlist.videos : [];
    }

    const query = searchQuery.trim();
    if (query) {
      const normalizeText = (text: string) => {
        return text
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toLowerCase()
          .replace(/đ/g, 'd')
          .replace(/Đ/g, 'd')
          .replace(/[^a-z0-9\s]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
      };

      const normalizedQuery = normalizeText(query);
      const queryTokens = normalizedQuery.split(' ').filter(Boolean);
      
      if (queryTokens.length === 0) return filtered;

      const scoredItems = filtered.map(v => {
        const titleNormalized = normalizeText(v.title);
        
        let allTokensMatched = true;
        let score = 0;

        for (const token of queryTokens) {
          if (!titleNormalized.includes(token)) {
            allTokensMatched = false;
            break;
          }
        }

        if (allTokensMatched) {
          score += 1000;
          // Exact text match priority boost
          if (titleNormalized.includes(normalizedQuery)) {
            score += 5000;
          }
          // Starts with query boost
          if (titleNormalized.startsWith(normalizedQuery)) {
            score += 2000;
          }
          // Length penalty to prefer cleaner/shorter titles first
          score -= titleNormalized.length * 0.1;
        }

        return { video: v, score };
      });

      filtered = scoredItems
        .filter(item => item.score > 0)
        .sort((a, b) => b.score - a.score)
        .map(item => item.video);
    }

    return filtered;
  }, [data, activeTab, searchQuery]);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header/Hero Section */}
      <header className="pt-16 md:pt-20 pb-8 md:pb-12 px-4 md:px-6 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 pointer-events-none flex items-center justify-center">
          <div className="w-[600px] h-[600px] md:w-[800px] md:h-[800px] rounded-full bg-saffron-500 blur-3xl absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 mix-blend-multiply" />
        </div>
        
        <div className="max-w-5xl mx-auto text-center relative z-10 flex flex-col items-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="mb-4 md:mb-6 p-4 rounded-full bg-saffron-100/50 text-saffron-700 mx-auto w-fit"
          >
            <svg 
              className="w-8 h-8 md:w-10 md:h-10" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="1.5" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            >
              <path d="M12 2c0 0-4 7-4 10a4 4 0 008 0c0-3-4-10-4-10z" />
              <path d="M12 22a6 6 0 01-6-6c0-2.5 4-10 4-10" />
              <path d="M12 22a6 6 0 006-6c0-2.5-4-10-4-10" />
              <path d="M22 17a4 4 0 00-4-4c-2.5 0-6 3-6 9 3 0 7.5-1.5 10-5z" />
              <path d="M2 17a4 4 0 014-4c2.5 0 6 3 6 9-3 0-7.5-1.5-10-5z" />
            </svg>
          </motion.div>

          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl text-saffron-950 font-serif leading-tight mb-3 md:mb-4 px-2"
          >
            {data?.channelTitle ? data.channelTitle : 'Chữa Lành & Tỉnh Thức'}
          </motion.h1>
          
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="text-base sm:text-lg text-saffron-800 max-w-2xl mx-auto font-light leading-relaxed px-4"
          >
            Lắng đọng tâm hồn, tìm về sự bình yên bên trong qua những bài giảng và chia sẻ đầy ý nghĩa.
          </motion.p>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 pb-20 md:pb-24">
        
        {/* Toolbar: Search and Tabs */}
        {!isLoading && !error && data && (
          <div className="sticky top-0 z-40 bg-saffron-50/90 backdrop-blur-md py-4 mb-6 md:mb-8 flex flex-col gap-4 items-start justify-between -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 shadow-[0_4px_20px_-10px_rgba(0,0,0,0.1)] border-b border-saffron-200/60">
            <div className="flex flex-col gap-1.5 w-full">
              <label htmlFor="category-select" className="text-saffron-800 text-sm font-semibold uppercase tracking-wider">
                MỜI CHỌN CHỦ ĐỀ PHÁP ÂM ĐỂ NGHE
              </label>
              <select
                id="category-select"
                value={activeTab}
                onChange={(e) => setActiveTab(e.target.value)}
                className="w-full px-4 py-2.5 bg-white border border-saffron-200 rounded-xl text-saffron-950 text-sm md:text-base font-medium focus:ring-2 focus:ring-saffron-500 outline-none shadow-sm cursor-pointer"
              >
                <option value="all">Tất cả</option>
                {data.playlists?.map(pl => (
                  <option key={pl.id} value={pl.id}>{pl.title}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5 w-full">
               <label htmlFor="search-input" className="text-saffron-800 text-sm font-semibold uppercase tracking-wider">
                TÌM KIẾM
              </label>
              <div className="relative w-full">
                <Search className="w-4 h-4 md:w-5 md:h-5 absolute left-4 top-1/2 -translate-y-1/2 text-saffron-400" />
                <input
                  id="search-input"
                  type="text"
                  placeholder="Tìm kiếm video..."
                  value={localSearchQuery}
                  onChange={(e) => setLocalSearchQuery(e.target.value)}
                  className="w-full pl-11 pr-4 py-2.5 text-sm md:text-base bg-white rounded-xl outline-none focus:ring-2 focus:ring-saffron-500 border border-saffron-200 transition-all shadow-sm"
                />
              </div>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 text-saffron-600">
            <Loader2 className="w-8 h-8 md:w-10 md:h-10 animate-spin mb-4" />
            <p className="animate-pulse flex items-center gap-2 text-sm md:text-base"><span>Đang tải video</span><span className="text-2xl mt-[-6px]">...</span></p>
          </div>
        ) : error ? (
          <div className="text-center py-10 md:py-12 text-sm md:text-base text-red-600 bg-red-50 rounded-2xl border border-red-100 max-w-2xl mx-auto mx-4 md:mx-auto">
            <p>{error}</p>
          </div>
        ) : displayedVideos.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
            {displayedVideos.map((video, idx) => (
              <VideoCard key={`${video.id}-${idx}`} video={video} index={idx} />
            ))}
          </div>
        ) : (
          <div className="text-center py-20 opacity-60">
            <p className="text-saffron-800 text-base md:text-lg">Không tìm thấy video nào.</p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="py-8 md:py-12 px-4 text-center text-saffron-700 text-xs md:text-sm border-t border-saffron-200/50 flex flex-col items-center gap-4 md:gap-6 bg-saffron-50/30">
        <div className="flex flex-col items-center gap-1.5 md:gap-2">
          <p className="font-medium">Chớ làm các điều ác (Chư ác mạc tác)</p>
          <p className="font-medium">Siêng làm các điều lành (Chúng thiện phụng hành)</p>
          <p className="font-medium">Giữ tâm ý trong sạch (Tự tịnh kỳ ý)</p>
          <p className="font-medium">Ấy lời chư Phật dạy (Thị chư Phật giáo)</p>
          <p className="mt-2 font-serif italic text-saffron-800 text-sm md:text-base">Kinh Pháp Cú, Số 183. Namo Sakya Muni Buddha!</p>
        </div>

        {/* Thống kê truy cập */}
        <div className="w-full max-w-lg mx-auto pt-4 border-t border-saffron-200/40 flex flex-col items-center gap-3">
          <div className="grid grid-cols-3 gap-3 md:gap-4 w-full px-2 sm:px-4">
            <div className="bg-white/60 backdrop-blur-sm rounded-xl p-3 border border-saffron-100 shadow-sm flex flex-col items-center justify-center">
              <span className="text-[9px] md:text-xs font-semibold uppercase tracking-wider text-saffron-600 mb-1 text-center leading-tight">
                TỔNG TRUY CẬP
              </span>
              <span className="text-base md:text-lg font-bold font-mono text-saffron-900">
                {visitorStats ? visitorStats.totalVisits.toLocaleString('vi-VN') : '21.670'}
              </span>
            </div>
            <div className="bg-white/60 backdrop-blur-sm rounded-xl p-3 border border-saffron-100 shadow-sm flex flex-col items-center justify-center">
              <span className="text-[9px] md:text-xs font-semibold uppercase tracking-wider text-saffron-600 mb-1 text-center leading-tight">
                ĐANG ONLINE
              </span>
              <span className="text-base md:text-lg font-bold font-mono text-saffron-900 flex items-center gap-1">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                {visitorStats ? (visitorStats.onlineCount || 1).toLocaleString('vi-VN') : '1'}
              </span>
            </div>
            <div className="bg-white/60 backdrop-blur-sm rounded-xl p-3 border border-saffron-100 shadow-sm flex flex-col items-center justify-center">
              <span className="text-[9px] md:text-xs font-semibold uppercase tracking-wider text-saffron-600 mb-1 text-center leading-tight">
                HÔM NAY
              </span>
              <span className="text-base md:text-lg font-bold font-mono text-saffron-900">
                {visitorStats ? visitorStats.todayVisits.toLocaleString('vi-VN') : '1'}
              </span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
