import { motion } from 'framer-motion';
import { CalendarIcon, MapPinIcon } from '@heroicons/react/24/outline';
import type { SanityGig } from '@/types/sanity';

interface Props {
  gigs: SanityGig[];
}

export function GigsList({ gigs }: Props) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
      {gigs.map((gig, index) => (
        <motion.div
          key={gig._id}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: index * 0.1 }}
          viewport={{ once: true }}
          className="bg-secondary-900 rounded-lg p-6 border border-secondary-700 hover:border-primary-500 transition-colors duration-300 flex flex-col"
        >
          <div className="flex-grow">
            <div className="flex items-center space-x-2 text-primary-400 mb-4">
              <CalendarIcon className="h-5 w-5" />
              <span className="font-semibold">
                {gig.date ? new Date(gig.date).toLocaleDateString('en-US', {
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                }) : 'Date TBA'}
              </span>
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">{gig.title}</h3>
            <div className="flex items-center space-x-2 text-secondary-400 mb-4">
              <MapPinIcon className="h-4 w-4" />
              <span>{[gig.venue, gig.city].filter(Boolean).join(', ') || 'Location TBA'}</span>
            </div>
            {gig.description && (
              <p className="text-secondary-400 text-sm line-clamp-3">{gig.description}</p>
            )}
          </div>
          <div className="pt-4 mt-auto">
            <a
              href={`/gigs/${gig.slug}`}
              className="btn-primary w-full text-center block"
            >
              View Details
            </a>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
