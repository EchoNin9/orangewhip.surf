import { motion } from 'framer-motion';
import { 
  EnvelopeIcon,
  PhoneIcon,
  MapPinIcon
} from '@heroicons/react/24/outline';

export function Footer() {
  const socialLinks = [
    { name: 'Instagram', href: 'https://instagram.com/orangewhip', icon: '📷' },
    { name: 'Facebook', href: 'https://facebook.com/orangewhip', icon: '📘' },
    { name: 'Twitter', href: 'https://twitter.com/orangewhip', icon: '🐦' },
    { name: 'YouTube', href: 'https://youtube.com/orangewhip', icon: '📺' },
  ];

  const quickLinks = [
    { name: 'Home', href: '/' },
    { name: 'Gigs', href: '/gigs' },
    { name: 'Press', href: '/press' },
    { name: 'Daily', href: '/daily' },
  ];

  return (
    <footer className="bg-secondary-900 border-t border-secondary-700">
      <div className="container-max">
        <div className="py-16">
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {/* Brand */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
              className="lg:col-span-1"
            >
              <div className="flex items-center space-x-2 mb-4">
                <div className="w-8 h-8 bg-gradient-to-r from-primary-400 to-primary-600 rounded-full flex items-center justify-center">
                  <span className="text-white font-bold text-sm">OW</span>
                </div>
                <span className="text-xl font-display font-bold text-gradient">
                  Orange Whip
                </span>
              </div>
              <p className="text-secondary-400 mb-6">
                Surf rock instrumentals from Vancouver. Experience the raw power of Orange Whip.
              </p>
              
              {/* Social Links */}
              <div className="flex space-x-4">
                {socialLinks.map((social) => (
                  <a
                    key={social.name}
                    href={social.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-10 h-10 bg-secondary-800 hover:bg-primary-600 rounded-lg flex items-center justify-center transition-colors duration-200"
                    title={social.name}
                  >
                    <span className="text-lg">{social.icon}</span>
                  </a>
                ))}
              </div>
            </motion.div>

            {/* Quick Links */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              viewport={{ once: true }}
            >
              <h3 className="text-lg font-semibold text-white mb-4">
                Quick Links
              </h3>
              <ul className="space-y-2">
                {quickLinks.map((link) => (
                  <li key={link.name}>
                    <a
                      href={link.href}
                      className="text-secondary-400 hover:text-white transition-colors duration-200"
                    >
                      {link.name}
                    </a>
                  </li>
                ))}
              </ul>
            </motion.div>

            {/* Contact Info */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              viewport={{ once: true }}
            >
              <h3 className="text-lg font-semibold text-white mb-4">
                Contact
              </h3>
              <div className="space-y-3">
                <div className="flex items-center space-x-3">
                  <EnvelopeIcon className="h-5 w-5 text-primary-400" />
                  <a
                    href="mailto:booking@orangewhip.surf"
                    className="text-secondary-400 hover:text-white transition-colors duration-200"
                  >
                    booking@orangewhip.surf
                  </a>
                </div>
                <div className="flex items-center space-x-3">
                  <PhoneIcon className="h-5 w-5 text-primary-400" />
                  <a
                    href="tel:+1234567890"
                    className="text-secondary-400 hover:text-white transition-colors duration-200"
                  >
                    (123) 456-7890
                  </a>
                </div>
                <div className="flex items-center space-x-3">
                  <MapPinIcon className="h-5 w-5 text-primary-400" />
                  <span className="text-secondary-400">
                    Vancouver, BC
                  </span>
                </div>
              </div>
            </motion.div>

            {/* Newsletter */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              viewport={{ once: true }}
            >
              <h3 className="text-lg font-semibold text-white mb-4">
                Stay Updated
              </h3>
              <p className="text-secondary-400 mb-4">
                Get notified about new shows, releases, and exclusive content.
              </p>
              <div className="space-y-3">
                <input
                  type="email"
                  placeholder="Enter your email"
                  className="w-full px-4 py-2 bg-secondary-800 border border-secondary-700 rounded-lg text-white placeholder-secondary-400 focus:outline-none focus:border-primary-500 transition-colors duration-200"
                />
                <button className="btn-primary w-full">
                  Subscribe
                </button>
              </div>
            </motion.div>
          </div>
        </div>

        {/* Bottom Bar */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="py-6 border-t border-secondary-700"
        >
          <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
            <p className="text-secondary-400 text-sm">
              © {new Date().getFullYear()} Orange Whip. All rights reserved.
            </p>
            <div className="flex space-x-6 text-sm">
              <a
                href="/privacy"
                className="text-secondary-400 hover:text-white transition-colors duration-200"
              >
                Privacy Policy
              </a>
              <a
                href="/terms"
                className="text-secondary-400 hover:text-white transition-colors duration-200"
              >
                Terms of Service
              </a>
            </div>
          </div>
        </motion.div>
      </div>
    </footer>
  );
}

