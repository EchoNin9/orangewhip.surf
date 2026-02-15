import { motion } from 'framer-motion';
import { PlayIcon, CalendarIcon } from '@heroicons/react/24/outline';

export function Hero() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-gradient-to-b from-secondary-900/50 via-secondary-900/30 to-secondary-900/80 z-10" />
        <div className="w-full h-full bg-gradient-to-br from-primary-900/20 to-secondary-900/40" />
      </div>

      {/* Content */}
      <div className="relative z-20 container-max text-center px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="space-y-8"
        >
          {/* Band Name */}
          <div className="space-y-4">
            <motion.h1
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="text-5xl sm:text-6xl lg:text-7xl font-display font-bold"
            >
              <span className="text-gradient">Orange Whip</span>
            </motion.h1>
            
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.4 }}
              className="text-xl sm:text-2xl text-secondary-300 font-medium"
            >
              Surf Rock Instrumentals from Vancouver
            </motion.p>
          </div>

          {/* Description */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.6 }}
            className="text-lg text-secondary-400 max-w-2xl mx-auto leading-relaxed"
          >
            Experience the electrifying sound of Orange Whip. From intimate venues to festival stages, 
            we bring the raw power of surf rock instrumentals to every performance.
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.8 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-8"
          >
            <a
              href="https://open.spotify.com/playlist/3Np0DOO7qnA1jWjmBV2Kjc"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary flex items-center space-x-2 group"
            >
              <PlayIcon className="h-5 w-5 group-hover:scale-110 transition-transform duration-200" />
              <span>Listen Now</span>
            </a>
            
            <a href="/gigs" className="btn-secondary flex items-center space-x-2 group">
              <CalendarIcon className="h-5 w-5 group-hover:scale-110 transition-transform duration-200" />
              <span>View Gigs</span>
            </a>
          </motion.div>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 1 }}
            className="grid grid-cols-3 gap-8 pt-16 max-w-md mx-auto"
          >
            <div className="text-center">
              <div className="text-2xl font-bold text-primary-400">50+</div>
              <div className="text-sm text-secondary-400">Shows Played</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-primary-400">10K+</div>
              <div className="text-sm text-secondary-400">Fans</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-primary-400">5</div>
              <div className="text-sm text-secondary-400">Years Active</div>
            </div>
          </motion.div>
        </motion.div>
      </div>

      {/* Scroll Indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, delay: 1.2 }}
        className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-20"
      >
        <div className="w-6 h-10 border-2 border-secondary-400 rounded-full flex justify-center">
          <motion.div
            animate={{ y: [0, 12, 0] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="w-1 h-3 bg-primary-400 rounded-full mt-2"
          />
        </div>
      </motion.div>
    </section>
  );
}

