import React, { useState, useEffect, useMemo } from 'react';
import { Loader2, Search, Sparkles, BookOpen, Quote, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Video, Playlist, YouTubeResponse } from './types';
import { VideoCard } from './components/VideoCard';

const BUDDHA_QUOTES = [
  {
    vi: "Mưa dẫu xiết rơi không ướt lòng đá tảng. Lời khen hay tiếng chê ngoài đời dẫu xôn xao, không lay động được tâm kẻ trí tĩnh lặng khinh an.",
    pali: "Selo yathā ekaghano, vātena na samījati; Evaṃ nindāpasaṃsāsu, na samiñjanti paṇḍitā.",
    ref: "Kinh Pháp Cú (Dhammapada) - Kệ số 81"
  },
  {
    vi: "Hãy tự mình là ngọn đèn cho chính mình, hãy tự mình nương tựa chính mình. Dùng Chánh pháp làm ngọn đèn dẫn lối, dùng Chánh pháp làm chỗ trú ẩn kiên cố.",
    pali: "Attadīpā viharatha attasaraṇā anaññasaraṇā, dhammadīpā dhammasaraṇā.",
    ref: "Trường Bộ Kinh - Đại Bát Niết Bàn (DN 16)"
  },
  {
    vi: "Chiến thắng vạn quân thù nơi bãi chiến trường lừng lẫy dẫu vẻ quang cũng không bằng tự chiến thắng chính tâm mình. Đó mới là chiến công oanh liệt nhất.",
    pali: "Attā have jitaṃ seyyo, yā cāyaṃ itarā pajā; Attadantassa poṣassa, sadāsaṃyatacārino.",
    ref: "Kinh Pháp Cú (Dhammapada) - Kệ số 104"
  },
  {
    vi: "Với người có tâm thanh tịnh tịch lặng, mỗi bước chân lướt qua mặt đất thô ráp đều thanh thiết tựa như hoa sen lành hé nở giữa bùn nhơ.",
    pali: "Yathāpi ruciraṃ pupphaṃ, vaṇṇavantaṃ sagandhakaṃ; Evaṃ subhāsitā vācā, saphalā hoti kubbatoti.",
    ref: "Kinh Pháp Cú (Dhammapada) - Kệ số 52"
  },
  {
    vi: "Sự bình yên thảnh thơi thực sự không nằm ở chỗ gặt hái thêm nhiều thứ, mà nằm ở việc biết buông xả bớt gánh nặng hư hao trong tâm trí.",
    pali: "Sabbadānaṃ dhammadānaṃ jināti, sabbaṃ rasaṃ dhammaraso jināti.",
    ref: "Kinh Pháp Cú (Dhammapada) - Kệ số 354"
  }
];

const CHANNEL_ID = 'UClxiXO5JjB3k5y3-4OtAzug';

function cleanStringValue(val: any): string {
  if (!val) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'object') {
    if (typeof val.content === 'string') return val.content;
    if (typeof val.text === 'string') return val.text;
    if (Array.isArray(val.runs)) {
      return val.runs.map((r: any) => typeof r === 'string' ? r : (r?.text || '')).join('');
    }
    return val.content || val.text || (typeof val.toString === 'function' ? val.toString() : '') || 'Untitled';
  }
  return String(val);
}

export default function App() {
  const [data, setData] = useState<YouTubeResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [localSearchQuery, setLocalSearchQuery] = useState('');
  const [quoteIndex, setQuoteIndex] = useState(0);
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

    // Select a random quote for start
    setQuoteIndex(Math.floor(Math.random() * BUDDHA_QUOTES.length));

    // Periodic ping to keep session alive and retrieve real-time stats
    const interval = setInterval(() => {
      pingStats();
    }, 30000); // 30 seconds

    return () => {
      clearInterval(interval);
    };
  }, []);

  const cycleQuote = () => {
    setQuoteIndex((prev) => (prev + 1) % BUDDHA_QUOTES.length);
  };

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

      if (result) {
        if (result.channelTitle) {
          result.channelTitle = cleanStringValue(result.channelTitle);
        }
        if (Array.isArray(result.allVideos)) {
          result.allVideos.forEach(v => {
            if (v) {
              v.title = cleanStringValue(v.title);
              v.author = cleanStringValue(v.author);
              v.published = cleanStringValue(v.published);
            }
          });
        }
        if (Array.isArray(result.playlists)) {
          result.playlists.forEach(pl => {
            if (pl) {
              pl.title = cleanStringValue(pl.title);
              if (Array.isArray(pl.videos)) {
                pl.videos.forEach(v => {
                  if (v) {
                    v.title = cleanStringValue(v.title);
                    v.author = cleanStringValue(v.author);
                    v.published = cleanStringValue(v.published);
                  }
                });
              }
            }
          });
        }
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

      // Separate query tokens into pure numbers vs alphabet words
      const numberTokens: string[] = [];
      const wordTokens: string[] = [];

      for (const token of queryTokens) {
        if (/^\d+$/.test(token)) {
          numberTokens.push(token);
        } else {
          wordTokens.push(token);
        }
      }

      const scoredItems = filtered.map(v => {
        const titleNormalized = normalizeText(v.title);
        
        let allMatched = true;

        // 1. Strict number matching: number tokens must exist as isolated numbers
        // e.g., if query has "3", it should not pass "310", but matches "3" or "03"
        for (const numToken of numberTokens) {
          const reg = new RegExp('(?<!\\d)' + numToken + '(?!\\d)');
          if (!reg.test(titleNormalized)) {
            allMatched = false;
            break;
          }
        }

        if (!allMatched) return { video: v, score: 0 };

        // 2. Word tokens must be contained as substrings
        for (const wordToken of wordTokens) {
          if (!titleNormalized.includes(wordToken)) {
            allMatched = false;
            break;
          }
        }

        if (!allMatched) return { video: v, score: 0 };

        // 3. Math scoring for sorting matches perfectly
        let score = 1000;

        // Big boost for exact phrase sequence inside the title
        if (titleNormalized.includes(normalizedQuery)) {
          score += 10000;
        }

        // Boost for starting with the query
        if (titleNormalized.startsWith(normalizedQuery)) {
          score += 5000;
        }

        // Whole-word match boosts for word tokens to prioritize full words over parts of words
        for (const wordToken of wordTokens) {
          const regWord = new RegExp('\\b' + wordToken + '\\b');
          if (regWord.test(titleNormalized)) {
            score += 1200;
          }
        }

        // Relational order check (matches in correct left-to-right order)
        let lastIdx = -1;
        let termsInOrder = true;
        for (const token of queryTokens) {
          const idx = titleNormalized.indexOf(token);
          if (idx < lastIdx) {
            termsInOrder = false;
          }
          lastIdx = idx;
        }
        if (termsInOrder) {
          score += 2500;
        }

        // Position of the first matched term boost (earlier is better)
        const firstMatchIndex = titleNormalized.indexOf(queryTokens[0]);
        if (firstMatchIndex !== -1) {
          score += Math.max(0, 100 - firstMatchIndex) * 15;
        }

        // Short title specificity bonus
        score -= titleNormalized.length * 0.4;

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
    <div className="min-h-screen flex flex-col selection:bg-saffron-100 selection:text-saffron-900 relative">
      
      {/* Background Zen Glowing Mist */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[-10%] left-[5%] w-[45vw] h-[45vw] rounded-full bg-emerald-500/5 blur-[120px] animate-breath" style={{ animationDuration: '14s' }} />
        <div className="absolute top-[30%] right-[-10%] w-[50vw] h-[50vw] rounded-full bg-saffron-500/5 blur-[140px] animate-breath" style={{ animationDuration: '20s' }} />
        <div className="absolute bottom-[10%] left-[20%] w-[40vw] h-[40vw] rounded-full bg-emerald-500/3 blur-[110px] animate-breath" style={{ animationDuration: '16s' }} />
      </div>

      {/* Header/Hero Section */}
      <header className="pt-12 md:pt-20 pb-10 md:pb-16 px-4 md:px-6 relative z-10">
        <div className="max-w-4xl mx-auto text-center flex flex-col items-center">
          
          {/* Zen Lotus Wind Chime Badge */}
          <motion.div
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1, ease: "easeOut" }}
            className="mb-5 md:mb-7 p-3.5 rounded-full bg-white/70 backdrop-blur-md text-saffron-700 shadow-sm border border-saffron-100/50 flex items-center justify-center animate-sway"
          >
            <svg 
              className="w-10 h-10 text-saffron-600" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="1.2" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            >
              {/* Artistic Lotus Flower petals */}
              <path d="M12 2C12 2 10 7 10 11C10 15 12 22 12 22C12 22 14 15 14 11C14 7 12 2 12 2Z" />
              <path d="M12 11C12 11 7 12 6 15C5.2 17.5 7.5 20 10 19C11.5 18.5 12 17 12 17" />
              <path d="M12 11C12 11 17 12 18 15C18.8 17.5 16.5 20 14 19C12.5 18.5 12 17 12 17" />
              <path d="M6 15C4 13 4.5 10 7 9C9 8.2 11 10 11 10" />
              <path d="M18 15C20 13 19.5 10 17 9C15 8.2 13 10 13 10" />
            </svg>
          </motion.div>

          {/* Majestic Heading */}
          <motion.h1 
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.2 }}
            className="text-4xl sm:text-5xl md:text-6xl text-saffron-950 font-serif font-normal tracking-wide leading-tight mb-4 px-2"
          >
            {data?.channelTitle ? data.channelTitle : 'Kênh Vô Sự'}
          </motion.h1>
          
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.3 }}
            className="w-12 h-[1px] bg-saffron-300 my-2"
          />

          <motion.p 
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.4 }}
            className="text-sm md:text-base text-saffron-700 tracking-widest uppercase font-sans font-medium mb-8"
          >
            Lắng đọng tâm hồn • Tìm về nẻo bình yên bên trong
          </motion.p>

          {/* Wisdom Quote Slate (Phiến đá Tuệ Giác) */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.5 }}
            className="w-full max-w-2xl bg-[#F6EFE5]/50 backdrop-blur-md rounded-2xl p-6 md:p-8 border border-saffron-200/45 shadow-[0_12px_40px_-10px_rgba(43,59,48,0.05)] relative overflow-hidden group hover:bg-[#F6EFE5]/75 transition-colors duration-500"
          >
            {/* Absolute watermark leaf */}
            <div className="absolute right-0 bottom-[-15px] opacity-[0.03] text-saffron-950 pointer-events-none select-none">
              <svg className="w-48 h-48" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12,2A10,10,0,0,1,22,12C22,18.5,15.5,22,12,22c-3.1,0-4.8-1.5-6.5-3.5S2,14.5,2,12A10,10,0,0,1,12,2M12,4a8,8,0,0,0-8,8c0,5.7,3.9,7.5,6.5,9.5C12.3,19.3,13.5,18,15,16c2.4-3.1,5-4.5,5-4A8,8,0,0,0,12,4Z"/>
              </svg>
            </div>

            <div className="flex justify-between items-start mb-3.5 text-saffron-400">
              <Quote className="w-7 h-7 opacity-30" />
              <button 
                onClick={cycleQuote}
                className="p-1 px-2.5 rounded-full bg-white/60 hover:bg-white text-xs text-saffron-700 hover:text-saffron-950 border border-saffron-200/40 hover:border-saffron-300 flex items-center gap-1.5 shadow-sm active:scale-95 transition-all cursor-pointer"
                title="Đổi kệ ngôn Pháp Cú"
              >
                <RefreshCw className="w-3 h-3 text-saffron-500" />
                Đổi Kệ Khác
              </button>
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={quoteIndex}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.4 }}
                className="min-h-[120px] flex flex-col justify-center"
              >
                <blockquote className="text-base sm:text-lg text-saffron-950 italic font-serif leading-relaxed px-1">
                  "{BUDDHA_QUOTES[quoteIndex].vi}"
                </blockquote>
                
                <p className="text-[13px] text-saffron-600 font-light italic mt-3 block font-serif tracking-wide leading-relaxed">
                  {BUDDHA_QUOTES[quoteIndex].pali}
                </p>

                <cite className="block not-italic mt-4 text-[11px] sm:text-xs font-sans font-semibold tracking-wider text-saffron-700 uppercase">
                  — {BUDDHA_QUOTES[quoteIndex].ref}
                </cite>
              </motion.div>
            </AnimatePresence>
          </motion.div>

        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 pb-24 relative z-10">
        
        {/* Toolbar: Search, Select & Category Pebbles */}
        {!isLoading && !error && data && (
          <div className="sticky top-4 z-40 bg-white/95 backdrop-blur-xl rounded-2xl p-4 md:p-5 mb-8 md:mb-12 border border-saffron-100/70 shadow-[0_16px_50px_-15px_rgba(43,59,48,0.08)]">
            
            {/* Search and Select Frame */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
              
              {/* Category selector on Mobile / Search on desktop */}
              <div className="col-span-1 md:col-span-4 flex flex-col gap-2">
                <label htmlFor="category-select" className="text-saffron-800 text-[11px] font-bold uppercase tracking-widest block pl-1">
                  Chủ Đề Pháp Âm
                </label>
                <select
                  id="category-select"
                  value={activeTab}
                  onChange={(e) => setActiveTab(e.target.value)}
                  className="w-full px-4 py-2.5 bg-[#FAF8F5] border border-saffron-200/50 rounded-xl text-saffron-950 text-sm font-serif font-medium focus:ring-2 focus:ring-saffron-500/50 focus:border-saffron-500 outline-none shadow-inner cursor-pointer transition-all h-11"
                >
                  <option value="all">Tất cả pháp âm</option>
                  {data.playlists?.map(pl => (
                    <option key={pl.id} value={pl.id}>{pl.title}</option>
                  ))}
                </select>
              </div>

              {/* Advanced search bar */}
              <div className="col-span-1 md:col-span-5 flex flex-col gap-2">
                <label id="search-label" htmlFor="search-input" className="text-saffron-800 text-[11px] font-bold uppercase tracking-widest block pl-1">
                  Từ khóa tìm kiếm
                </label>
                <div className="relative w-full">
                  <Search className="w-4 h-4 md:w-[18px] md:h-[18px] absolute left-3.5 top-1/2 -translate-y-1/2 text-saffron-500" />
                  <input
                    id="search-input"
                    aria-labelledby="search-label"
                    type="text"
                    placeholder="Tìm câu kinh, bài giảng v.v..."
                    value={localSearchQuery}
                    onChange={(e) => setLocalSearchQuery(e.target.value)}
                    className="w-full pl-11 pr-4 py-2.5 text-sm bg-[#FAF8F5] rounded-xl outline-none focus:ring-2 focus:ring-saffron-500/50 border border-saffron-200/50 text-saffron-950 font-medium transition-all shadow-inner h-11 placeholder:text-saffron-400"
                  />
                </div>
              </div>

              {/* Status display counts on toolbar right */}
              <div className="col-span-1 md:col-span-3">
                <div className="bg-[#FCFAF6] border border-saffron-100 rounded-xl p-2.5 h-11 flex items-center justify-around text-center select-none shadow-sm class-stats shrink-0">
                  <div className="flex flex-col items-center">
                    <span className="text-[9px] font-semibold tracking-wider text-saffron-500 uppercase leading-none">Online</span>
                    <span className="text-xs font-bold font-mono text-saffron-900 flex items-center gap-1 mt-0.5">
                      <span className="relative flex h-1.5 w-1.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                      </span>
                      {visitorStats ? (visitorStats.onlineCount || 1).toLocaleString('vi-VN') : '1'}
                    </span>
                  </div>
                  <div className="h-6 w-[1px] bg-saffron-150" />
                  <div className="flex flex-col items-center">
                    <span className="text-[9px] font-semibold tracking-wider text-saffron-500 uppercase leading-none">Hôm Nay</span>
                    <span className="text-xs font-bold font-mono text-saffron-900 mt-0.5">
                      {visitorStats ? visitorStats.todayVisits.toLocaleString('vi-VN') : '1'}
                    </span>
                  </div>
                  <div className="h-6 w-[1px] bg-saffron-150" />
                  <div className="flex flex-col items-center">
                    <span className="text-[9px] font-semibold tracking-wider text-saffron-500 uppercase leading-none">Tổng Nghe</span>
                    <span className="text-xs font-bold font-mono text-saffron-900 mt-0.5">
                      {visitorStats ? visitorStats.totalVisits.toLocaleString('vi-VN') : '21.789'}
                    </span>
                  </div>
                </div>
              </div>

            </div>

          </div>
        )}

        {/* Video Grid */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-24 text-saffron-600">
            <Loader2 className="w-9 h-9 animate-spin text-saffron-500 mb-4" />
            <p className="animate-pulse flex items-center gap-2 text-sm font-serif tracking-widest font-normal uppercase text-saffron-700">
              <span>Đang lắng lọc pháp âm</span>
              <span className="text-2xl mt-[-6px]">...</span>
            </p>
          </div>
        ) : error ? (
          <div className="text-center py-12 text-sm text-red-700 bg-red-50/50 rounded-2xl border border-red-100 max-w-2xl mx-auto px-4 font-serif">
            <p className="italic">"{error}"</p>
            <p className="mt-2 text-xs font-sans text-red-500">Mời bạn kiểm tra đường truyền hoặc làm mới lại trang.</p>
          </div>
        ) : displayedVideos.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 md:gap-7 lg:gap-8">
            {displayedVideos.map((video, idx) => (
              <VideoCard key={`${video.id}-${idx}`} video={video} index={idx} />
            ))}
          </div>
        ) : (
          <div className="text-center py-24 opacity-60 bg-saffron-100/20 rounded-2xl border border-dashed border-saffron-200 p-8 max-w-xl mx-auto">
            <p className="text-saffron-800 text-lg font-serif">Chưa tìm thấy Pháp âm phù hợp.</p>
            <p className="text-xs text-saffron-600 mt-1 font-sans">Mời bạn điều chỉnh từ khóa tìm kiếm hoặc chọn danh mục chủ đề khác.</p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="py-12 md:py-20 px-4 text-center text-saffron-700 text-xs md:text-sm border-t border-saffron-200/50 flex flex-col items-center gap-6 bg-saffron-50/30 relative z-10">
        
        {/* Pure Lotus Blossom SVG Graphic inside Footer */}
        <div className="text-saffron-300">
          <svg className="w-16 h-10 mx-auto" viewBox="0 0 100 40" fill="none" stroke="currentColor" strokeWidth="1.2">
            <path d="M50 5 Q40 25, 30 30 Q25 15, 50 35 Q75 15, 70 30 Q60 25, 50 5Z" />
            <path d="M50 20 Q44 28, 40 32" />
            <path d="M50 20 Q56 28, 60 32" />
            <line x1="15" y1="35" x2="85" y2="35" strokeDasharray="4,4" />
          </svg>
        </div>

        <div className="flex flex-col items-center gap-2.5 max-w-lg mx-auto leading-relaxed">
          <p className="font-serif italic text-base font-semibold text-saffron-900">“Chư ác mạc tác, chúng thiện phụng hành, tự tịnh kỳ ý, thị chư Phật giáo.”</p>
          <div className="w-8 h-[1px] bg-saffron-200 my-1" />
          <p className="font-serif font-medium text-saffron-800 mt-1">Chớ làm các điều ác — Siêng làm các điều lành</p>
          <p className="font-serif font-medium text-saffron-800">Giữ tâm ý trong sạch — Ấy lời chư Phật dạy</p>
          <p className="mt-4 font-serif italic text-saffron-600 text-xs tracking-wide">Trích Kinh Pháp Cú, Kệ Số 183 • Nam Mô Bổn Sư Thích Ca Mâu Ni Phật</p>
        </div>
      </footer>
    </div>
  );
}
