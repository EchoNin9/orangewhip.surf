import { motion } from 'framer-motion';

export function DailyList({ dailyItems }) {
  return (
    <div className="space-y-8">
      {dailyItems.map((daily, index) => {
        const dailyDate = new Date(daily.data.date);
        const formattedDate = dailyDate.toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        });
        const totalEvents = (daily.data.today?.length || 0) + (daily.data.thisWeek?.length || 0) + (daily.data.next?.length || 0);

        return (
          <motion.div
            key={daily.id}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: index * 0.1 }}
            viewport={{ once: true }}
            className="bg-secondary-900 rounded-lg p-6 border border-secondary-700 hover:border-primary-500 transition-colors duration-300"
          >
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-xl font-semibold text-white">
                  <a href={`/daily/${daily.slug}`} className="hover:text-primary-300 transition-colors">
                    {formattedDate}
                  </a>
                </h3>
                <p className="text-secondary-400">{totalEvents} events found</p>
              </div>
              <a href={`/daily/${daily.slug}`} className="btn-secondary text-sm">
                View Details
              </a>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div className="bg-secondary-800 p-4 rounded-lg">
                <h4 className="font-semibold text-primary-400 mb-2">Today ({daily.data.today?.length || 0})</h4>
                {daily.data.today && daily.data.today.length > 0 ? (
                  <ul className="space-y-1">
                    {daily.data.today.slice(0, 3).map(event => (
                      <li key={event.title} className="text-secondary-300 truncate">{event.title}</li>
                    ))}
                    {daily.data.today.length > 3 && (
                      <li className="text-secondary-400">+{daily.data.today.length - 3} more</li>
                    )}
                  </ul>
                ) : (
                  <p className="text-secondary-500">No events today</p>
                )}
              </div>

              <div className="bg-secondary-800 p-4 rounded-lg">
                <h4 className="font-semibold text-primary-400 mb-2">This Week ({daily.data.thisWeek?.length || 0})</h4>
                {daily.data.thisWeek && daily.data.thisWeek.length > 0 ? (
                  <ul className="space-y-1">
                    {daily.data.thisWeek.slice(0, 3).map(event => (
                      <li key={event.title} className="text-secondary-300 truncate">{event.title}</li>
                    ))}
                    {daily.data.thisWeek.length > 3 && (
                      <li className="text-secondary-400">+{daily.data.thisWeek.length - 3} more</li>
                    )}
                  </ul>
                ) : (
                  <p className="text-secondary-500">No events this week</p>
                )}
              </div>

              <div className="bg-secondary-800 p-4 rounded-lg">
                <h4 className="font-semibold text-primary-400 mb-2">Next ({daily.data.next?.length || 0})</h4>
                {daily.data.next && daily.data.next.length > 0 ? (
                  <ul className="space-y-1">
                    {daily.data.next.slice(0, 3).map(event => (
                      <li key={event.title} className="text-secondary-300 truncate">{event.title}</li>
                    ))}
                    {daily.data.next.length > 3 && (
                      <li className="text-secondary-400">+{daily.data.next.length - 3} more</li>
                    )}
                  </ul>
                ) : (
                  <p className="text-secondary-500">No upcoming events</p>
                )}
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
