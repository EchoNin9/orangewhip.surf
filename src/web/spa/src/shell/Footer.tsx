import { Link } from "react-router-dom";

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="bg-secondary-900">
      {/* Gradient separator */}
      <div className="h-px bg-gradient-to-r from-transparent via-secondary-700 to-transparent" />

      <div className="container-max py-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Brand */}
          <div>
            <Link to="/" className="text-xl font-display font-bold text-gradient">
              Orange Whip
            </Link>
            <p className="mt-2 text-sm text-secondary-400">
              Industrial Surf Rock
            </p>
          </div>

          {/* Quick links */}
          <div>
            <h3 className="text-sm font-semibold text-secondary-200 uppercase tracking-wider mb-3">Navigate</h3>
            <ul className="space-y-2 text-sm text-secondary-400">
              <li><Link to="/shows" className="hover:text-primary-400 transition-colors duration-200">Shows</Link></li>
              <li><Link to="/updates" className="hover:text-primary-400 transition-colors duration-200">Updates</Link></li>
              <li><Link to="/press" className="hover:text-primary-400 transition-colors duration-200">Press</Link></li>
              <li><Link to="/media" className="hover:text-primary-400 transition-colors duration-200">Media</Link></li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="text-sm font-semibold text-secondary-200 uppercase tracking-wider mb-3">Contact</h3>
            <a
              href="mailto:band@orangewhip.surf"
              className="text-sm text-primary-400 hover:text-primary-300 transition-colors duration-200"
            >
              band@orangewhip.surf
            </a>
          </div>
        </div>

        <div className="mt-8 pt-6">
          <div className="h-px bg-gradient-to-r from-transparent via-secondary-800 to-transparent mb-6" />
          <p className="text-center text-xs text-secondary-500">
            &copy; {year} Orange Whip. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
