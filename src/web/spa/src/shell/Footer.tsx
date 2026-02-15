import { Link } from "react-router-dom";

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-secondary-800 bg-secondary-900">
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
              <li><Link to="/shows" className="hover:text-primary-400 transition-colors">Shows</Link></li>
              <li><Link to="/updates" className="hover:text-primary-400 transition-colors">Updates</Link></li>
              <li><Link to="/press" className="hover:text-primary-400 transition-colors">Press</Link></li>
              <li><Link to="/media" className="hover:text-primary-400 transition-colors">Media</Link></li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="text-sm font-semibold text-secondary-200 uppercase tracking-wider mb-3">Contact</h3>
            <a
              href="mailto:band@orangewhip.surf"
              className="text-sm text-primary-400 hover:text-primary-300 transition-colors"
            >
              band@orangewhip.surf
            </a>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-secondary-800 text-center text-xs text-secondary-500">
          &copy; {year} Orange Whip. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
