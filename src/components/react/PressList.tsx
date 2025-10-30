import { motion } from 'framer-motion';
import type { SanityPress } from '@/types/sanity';

interface Props {
  pressItems: SanityPress[];
}

export function PressList({ pressItems }: Props) {
  return (
    <div className="space-y-8">
      {pressItems.map((press, index) => (
        <motion.div
          key={press._id}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: index * 0.1 }}
          viewport={{ once: true }}
          className="bg-secondary-900 rounded-lg p-6 border border-secondary-700 hover:border-primary-500 transition-colors duration-300"
        >
          <article>
            <div className="flex flex-col sm:flex-row gap-6">
              {press.heroImage?.asset?.url && (
                <div className="sm:w-1/3">
                  <a href={`/press/${press.slug}`}>
                    <img
                      src={press.heroImage.asset.url}
                      alt={press.title}
                      className="w-full h-auto object-cover rounded-lg"
                    />
                  </a>
                </div>
              )}
              <div className="flex-1">
                <p className="text-sm text-primary-400 mb-2">
                  {press.date ? new Date(press.date).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  }) : ''}
                </p>
                <h3 className="text-xl font-semibold text-white mb-3">
                  <a href={`/press/${press.slug}`} className="hover:text-primary-300 transition-colors">
                    {press.title}
                  </a>
                </h3>
                {press.description && (
                  <p className="text-secondary-400 line-clamp-3">
                    {press.description}
                  </p>
                )}
                <a href={`/press/${press.slug}`} className="text-primary-400 hover:text-primary-300 font-medium mt-4 inline-block">
                  Read More →
                </a>
              </div>
            </div>
          </article>
        </motion.div>
      ))}
    </div>
  );
}
