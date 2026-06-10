import React, { useState } from 'react';
import { PlayCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Video } from '../types';

interface VideoCardProps {
  key?: React.Key;
  video: Video;
  index: number;
}

export function VideoCard({ video, index }: VideoCardProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  
  const aspectRatioClass = video.isShort ? 'aspect-[9/16]' : 'aspect-video';

  return (
    <motion.div
      className="group w-full h-full flex flex-col text-left bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 border border-saffron-100/50"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.05 }}
      whileHover={isPlaying ? {} : { y: -4 }}
    >
      <div className={`relative w-full ${aspectRatioClass} bg-saffron-100 overflow-hidden`}>
        <AnimatePresence mode="wait">
          {!isPlaying ? (
            <motion.div
              key="thumbnail"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 cursor-pointer"
              onClick={() => setIsPlaying(true)}
            >
              <img
                src={video.thumbnail}
                alt={video.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors duration-300" />
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <PlayCircle className="w-16 h-16 text-white drop-shadow-md" strokeWidth={1.5} />
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="player"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute inset-0"
            >
              <iframe
                src={`https://www.youtube.com/embed/${video.id}?autoplay=1`}
                title={video.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="w-full h-full border-0 absolute top-0 left-0"
              ></iframe>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      
      <div 
        className={`p-5 flex flex-col flex-1 ${!isPlaying ? 'cursor-pointer' : ''}`} 
        onClick={() => !isPlaying && setIsPlaying(true)}
      >
        <h3 className="font-serif text-lg font-medium text-saffron-950 line-clamp-2 mb-2 group-hover:text-saffron-700 transition-colors">
          {video.title}
        </h3>
        <p className="text-sm text-saffron-700 inline-flex items-center gap-2 mt-auto">
          <span>{video.published}</span>
        </p>
      </div>
    </motion.div>
  );
}

