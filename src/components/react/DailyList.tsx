import { motion } from 'framer-motion';
import type { SanityDaily } from '@/types/sanity';

interface DailyListProps {
  dailyItems: SanityDaily[];
}

function formatDate(value?: string) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function DailyList({ dailyItems }: DailyListProps) {
  if (!dailyItems || dailyItems.length === 0) {
    return null;
  }

  return (
    <div className="space-y-8">
      {dailyItems.map((daily, index) => {
        const formattedDate = formatDate(daily.date) ?? daily.title ?? 'Daily Roundup';
        const totalHighlights = daily.items?.length ?? 0;
        const highlights = (daily.items ?? []).slice(0, 3);

        return (
          <motion.div
            key={daily._id}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: index * 0.1 }}
            viewport={{ once: true }}
            className="bg-secondary-900 rounded-lg p-6 border border-secondary-700 hover:border-primary-500 transition-colors duration-300"
          >
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
              <div>
                <h3 className="text-xl font-semibold text-white">
                  <a href={`/daily/${daily.slug}`} className="hover:text-primary-300 transition-colors">
                    {formattedDate}
                  </a>
                </h3>
                <p className="text-secondary-400">
                  {totalHighlights} {totalHighlights === 1 ? 'story' : 'stories'} highlighted
                </p>
                {daily.generatedAt && (
                  <p className="text-xs text-secondary-500 mt-1">
                    Updated {formatDate(daily.generatedAt)}
                  </p>
                )}
              </div>
              <a href={`/daily/${daily.slug}`} className="btn-secondary text-sm self-start">
                View Details
              </a>
            </div>

            {highlights.length > 0 ? (
              <div className="space-y-3">
                {highlights.map((item, idx) => (
                  <div key={`${daily._id}-${idx}`} className="bg-secondary-800 p-4 rounded-lg">
                    <p className="text-secondary-200 font-medium">
                      {item.title ?? 'Untitled highlight'}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-xs uppercase tracking-wide text-secondary-500">
                      {item.source && <span>{item.source}</span>}
                      {item.publishedAt && (
                        <span>{formatDate(item.publishedAt)}</span>
                      )}
                      {item.link && (
                        <a
                          href={item.link}
                          className="text-primary-400 hover:text-primary-300"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Read
                        </a>
                      )}
                    </div>
                    {item.description && (
                      <p className="mt-3 text-sm text-secondary-400 overflow-hidden text-ellipsis">
                        {item.description}
                      </p>
                    )}
                  </div>
                ))}
                {totalHighlights > highlights.length && (
                  <p className="text-secondary-400 text-sm">
                    +{totalHighlights - highlights.length} more stories in this roundup
                  </p>
                )}
              </div>
            ) : (
              <p className="text-secondary-500 text-sm">No stories captured for this roundup.</p>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}
