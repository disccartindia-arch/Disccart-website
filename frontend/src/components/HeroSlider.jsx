import { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { getSlides } from '../lib/api';

export default function HeroSlider() {
  const [slides, setSlides] = useState([]);
  const [current, setCurrent] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const intervalRef = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await getSlides();
        setSlides(data);
      } catch {
        setSlides([]);
      }
    })();
  }, []);

  const nextSlide = useCallback(() => {
    setCurrent(prev => (prev + 1) % slides.length);
  }, [slides.length]);

  const prevSlide = useCallback(() => {
    setCurrent(prev => (prev - 1 + slides.length) % slides.length);
  }, [slides.length]);

  useEffect(() => {
    if (isPlaying && slides.length > 1) {
      intervalRef.current = setInterval(nextSlide, 4000);
    }
    return () => clearInterval(intervalRef.current);
  }, [isPlaying, slides.length, nextSlide]);

  const togglePlay = () => {
    setIsPlaying(prev => !prev);
  };

  if (slides.length === 0) return null;

  const slide = slides[current];

  const content = (
    <div className="relative w-full aspect-[21/9] sm:aspect-[3/1] rounded-2xl overflow-hidden bg-gray-100" data-testid="hero-slider">
      <AnimatePresence mode="wait">
        <motion.div
          key={current}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          className="absolute inset-0"
        >
          <img
            src={slide.image_url}
            alt={`Slide ${current + 1}`}
            className="w-full h-full object-cover"
            loading="eager"
          />
        </motion.div>
      </AnimatePresence>

      {/* Controls overlay */}
      <div className="absolute inset-0 flex items-center justify-between px-3 sm:px-6">
        {slides.length > 1 && (
          <>
            <button
              onClick={prevSlide}
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-black/30 backdrop-blur-sm text-white flex items-center justify-center hover:bg-black/50 transition-colors"
              data-testid="slider-prev"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={nextSlide}
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-black/30 backdrop-blur-sm text-white flex items-center justify-center hover:bg-black/50 transition-colors"
              data-testid="slider-next"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </>
        )}
      </div>

      {/* Bottom bar: dots + pause */}
      <div className="absolute bottom-3 left-0 right-0 flex items-center justify-center gap-3">
        {slides.length > 1 && (
          <div className="flex items-center gap-2 bg-black/30 backdrop-blur-sm rounded-full px-3 py-1.5">
            {slides.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrent(i)}
                className={`w-2 h-2 rounded-full transition-all ${i === current ? 'bg-white w-5' : 'bg-white/50'}`}
                data-testid={`slider-dot-${i}`}
              />
            ))}
            <button
              onClick={togglePlay}
              className="ml-1 text-white/80 hover:text-white transition-colors"
              data-testid="slider-toggle-play"
            >
              {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            </button>
          </div>
        )}
      </div>
    </div>
  );

  if (slide.redirect_url) {
    return (
      <a href={slide.redirect_url} target="_blank" rel="noopener noreferrer" className="block">
        {content}
      </a>
    );
  }

  return content;
}
