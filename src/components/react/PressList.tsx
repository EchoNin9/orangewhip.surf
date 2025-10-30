import { motion } from 'framer-motion';

export function PressList({ pressItems }) {
  return (
    <div className="space-y-8">
      {pressItems.map((press, index) => (
        <motion.div
          key={press.id}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: index * 0.1 }}
          viewport={{ once: true }}
          className="bg-secondary-900 rounded-lg p-6 border border-secondary-700 hover:border-primary-500 transition-colors duration-300"
        >
          <article>
            <div className="flex flex-col sm:flex-row gap-6">
              {press.data.heroImage && (
                <div className="sm:w-1/3">
                  <a href={`/press/${press.slug}`}>
                    <img
                      src={press.data.heroImage}
                      alt={press.data.title}
                      className="w-full h-auto object-cover rounded-lg"
                    />
                  </a>
                </div>
              )}
              <div className="flex-1">
                <p className="text-sm text-primary-400 mb-2">
                  {new Date(press.data.date).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </p>
                <h3 className="text-xl font-semibold text-white mb-3">
                  <a href={`/press/${press.slug}`} className="hover:text-primary-300 transition-colors">
                    {press.data.title}
                  </a>
                </h3>
                <p className="text-secondary-400 line-clamp-3">
                  {press.data.description || press.body.slice(0, 150) + '...'}
                </p>
                <a href={`/press/${press.slug}`} className="text-primary-400 hover:text-primary-300 font-medium mt-4 inline-block">
                  Read More &rarr;
                </a>
              </div>
            </div>
          </article>
        </motion.div>
      ))}
    </div>
  );
}
