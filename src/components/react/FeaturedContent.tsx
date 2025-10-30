import { motion } from 'framer-motion';
import { CalendarIcon, MapPinIcon } from '@heroicons/react/24/outline';
import { urlFor } from '../../lib/sanity';

export function FeaturedContent({ upcomingGigs, latestPress, latestDaily }) {
  return (
    <>
      {/* Upcoming Shows */}
      {upcomingGigs && upcomingGigs.length > 0 && (
        <section className="section-padding bg-secondary-800">
          <div className="container-max">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
              className="text-center mb-16"
            >
              <h2 className="text-4xl sm:text-5xl font-display font-bold text-gradient mb-4">
                Upcoming Shows
              </h2>
              <p className="text-xl text-secondary-300 max-w-2xl mx-auto">
                Catch us live at these upcoming shows. Don't miss out on the raw energy of Orange Whip!
              </p>
            </motion.div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {upcomingGigs.map((gig, index) => (
                <motion.div
                  key={gig._id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: index * 0.1 }}
                  viewport={{ once: true }}
                  className="bg-secondary-900 rounded-lg p-6 border border-secondary-700 hover:border-primary-500 transition-colors duration-300"
                >
                  <div className="space-y-4">
                    <div className="flex items-center space-x-2 text-primary-400">
                      <CalendarIcon className="h-5 w-5" />
                      <span className="font-semibold">
                        {new Date(gig.date).toLocaleDateString('en-US', { 
                          month: 'short', 
                          day: 'numeric', 
                          year: 'numeric' 
                        })}
                      </span>
                    </div>

                    <div>
                      <h3 className="text-xl font-semibold text-white mb-1">
                        {gig.title}
                      </h3>
                      <div className="flex items-center space-x-2 text-secondary-400">
                        <MapPinIcon className="h-4 w-4" />
                        <span>{gig.venue}</span>
                      </div>
                    </div>

                    <div className="pt-4">
                      <a
                        href={`/gigs/${gig.slug.current}`}
                        className="btn-primary w-full text-center block"
                      >
                        View Details
                      </a>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
            
            {upcomingGigs.length > 3 && (
              <div className="text-center mt-8">
                <a href="/gigs" className="btn-secondary">
                  View All Shows
                </a>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Latest Press */}
      {latestPress && latestPress.length > 0 && (
        <section className="section-padding bg-secondary-900">
          <div className="container-max">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
              className="text-center mb-16"
            >
              <h2 className="text-4xl sm:text-5xl font-display font-bold text-gradient mb-4">
                Latest Press
              </h2>
              <p className="text-xl text-secondary-300 max-w-2xl mx-auto">
                What people are saying about Orange Whip
              </p>
            </motion.div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {latestPress.map((press, index) => (
                <motion.div
                  key={press._id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: index * 0.1 }}
                  viewport={{ once: true }}
                  className="bg-secondary-800 rounded-lg p-6 border border-secondary-700 hover:border-primary-500 transition-colors duration-300"
                >
                  <div className="text-primary-400 text-sm mb-2">
                    {new Date(press.date).toLocaleDateString('en-US', { 
                      month: 'long', 
                      day: 'numeric', 
                      year: 'numeric' 
                    })}
                  </div>
                  <h3 className="text-xl font-semibold text-white mb-3">
                    {press.title}
                  </h3>
                  <p className="text-secondary-400 line-clamp-3">
                    {press.description || 'Read more...'}
                  </p>
                  <a
                    href={`/press/${press.slug.current}`}
                    className="text-primary-400 hover:text-primary-300 font-medium mt-4 inline-block"
                  >
                    Read More →
                  </a>
                </motion.div>
              ))}
            </div>

            <div className="text-center mt-8">
              <a href="/press" className="btn-secondary">
                View All Press
              </a>
            </div>
          </div>
        </section>
      )}

      {/* Daily Roundup */}
      {latestDaily && (
        <section className="section-padding bg-secondary-800">
          <div className="container-max">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
              className="text-center mb-16"
            >
              <h2 className="text-4xl sm:text-5xl font-display font-bold text-gradient mb-4">
                Vancouver Shows
              </h2>
              <p className="text-xl text-secondary-300 max-w-2xl mx-auto">
                What's happening in Vancouver's music scene
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
              className="bg-secondary-900 rounded-lg p-8 border border-secondary-700 max-w-4xl mx-auto"
            >
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-2xl font-semibold text-white mb-2">
                    {new Date(latestDaily.data.date).toLocaleDateString('en-US', { 
                      weekday: 'long', 
                      year: 'numeric', 
                      month: 'long', 
                      day: 'numeric' 
                    })}
                  </h3>
                </div>
                <a href="/daily" className="text-primary-400 hover:text-primary-300 font-medium">
                  View All →
                </a>
              </div>
              
              {latestDaily.data.today && latestDaily.data.today.length > 0 && (
                <div className="mb-6">
                  <h4 className="font-semibold text-white mb-3">Today</h4>
                  <ul className="space-y-2">
                    {latestDaily.data.today.slice(0, 5).map((event, idx) => (
                      <li key={idx} className="flex justify-between items-center py-2 border-b border-secondary-700 last:border-b-0">
                        <div>
                          <span className="font-medium text-white">{event.title}</span>
                          <span className="text-secondary-400 ml-2">— {event.venue}</span>
                        </div>
                        {event.url && (
                          <a href={event.url} target="_blank" rel="noopener noreferrer" className="text-primary-400 hover:text-primary-300 text-sm">
                            Tickets →
                          </a>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {latestDaily.data.thisWeek && latestDaily.data.thisWeek.length > 0 && (
                <div>
                  <h4 className="font-semibold text-white mb-3">This Week</h4>
                  <ul className="space-y-2">
                    {latestDaily.data.thisWeek.slice(0, 3).map((event, idx) => (
                      <li key={idx} className="flex justify-between items-center py-2 border-b border-secondary-700 last:border-b-0">
                        <div>
                          <span className="font-medium text-white">{event.title}</span>
                          <span className="text-secondary-400 ml-2">— {event.venue}</span>
                        </div>
                        {event.url && (
                          <a href={event.url} target="_blank" rel="noopener noreferrer" className="text-primary-400 hover:text-primary-300 text-sm">
                            Tickets →
                          </a>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </motion.div>

            <div className="text-center mt-8">
              <a href="/daily" className="btn-secondary">
                View All Daily Updates
              </a>
            </div>
          </div>
        </section>
      )}
    </>
  );
}

