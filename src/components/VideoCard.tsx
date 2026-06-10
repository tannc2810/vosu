import React from 'react';
import { motion } from 'motion/react';
import { Video } from '../types';

interface VideoCardProps {
  key?: React.Key;
  video: Video;
  index: number;
}

export function VideoCard({ video, index }: VideoCardProps) {
  const aspectRatioClass = video.isShort ? 'aspect-[9/16]' : 'aspect-video';

  return (
    <motion.div
      className="group w-full h-full flex flex-col text-left bg-white/70 backdrop-blur-md rounded-2xl overflow-hidden border border-saffron-100/75 shadow-[0_8px_30px_rgba(43,59,48,0.03)] hover:border-saffron-300 hover:shadow-[0_24px_50px_rgba(43,59,48,0.08)] transition-all duration-500 ease-out"
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: Math.min(index * 0.04, 0.4) }}
    >
      <div 
        className={`relative w-full ${aspectRatioClass} bg-cover bg-center overflow-hidden`}
        style={{ backgroundImage: `url(${video.thumbnail})` }}
      >
        <iframe
          src={`https://www.youtube.com/embed/${video.id}?rel=0&playsinline=1`}
          title={video.title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="w-full h-full border-0 absolute top-0 left-0 bg-transparent"
          loading="lazy"
        ></iframe>
      </div>
      
      <div className="p-5 flex flex-col flex-1">
        <h3 className="font-serif text-base md:text-[18px] md:leading-[25px] font-medium text-saffron-950 line-clamp-2 mb-3.5 group-hover:text-saffron-600 transition-colors duration-300">
          {video.title}
        </h3>
        
        <div className="mt-auto pt-3 border-t border-saffron-100/60 flex items-center justify-between">
          <p className="text-xs text-saffron-700 font-light inline-flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5 text-saffron-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{video.published}</span>
          </p>
        </div>
      </div>
    </motion.div>
  );
}


