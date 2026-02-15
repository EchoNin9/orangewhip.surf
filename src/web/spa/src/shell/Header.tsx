import { useState, useEffect } from "react";
import { Link, NavLink } from "react-router-dom";
import { Bars3Icon, XMarkIcon, UserCircleIcon } from "@heroicons/react/24/outline";
import { useAuth, canEditContent, canAdminister } from "./AuthContext";

/* ── SVG social icons (inline so we don't need extra deps) ── */
function SpotifyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
    </svg>
  );
}
function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
    </svg>
  );
}
function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}
function BlueskyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 10.8c-1.087-2.114-4.046-6.053-6.798-7.995C2.566.944 1.561 1.266.902 1.565.139 1.908 0 3.08 0 3.768c0 .69.378 5.65.624 6.479.785 2.627 3.6 3.476 6.158 3.226-4.363.655-7.093 2.256-3.782 7.89 3.827 5.527 6.726.543 9-3.363 2.274 3.906 4.488 8.178 9 3.363 3.311-5.634.581-7.235-3.782-7.89 2.558.25 5.373-.599 6.158-3.226.246-.829.624-5.789.624-6.479 0-.688-.139-1.86-.902-2.203-.659-.299-1.664-.621-4.3 1.24C16.046 4.747 13.087 8.686 12 10.8z" />
    </svg>
  );
}
function YouTubeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  );
}
function SoundCloudIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M1.175 12.225c-.051 0-.094.046-.101.1l-.233 2.154.233 2.105c.007.058.05.098.101.098.05 0 .09-.04.099-.098l.255-2.105-.27-2.154c-.009-.057-.049-.1-.099-.1zm-.899.828c-.06 0-.091.037-.104.094L0 14.479l.172 1.308c.013.06.045.094.104.094.057 0 .09-.037.104-.094l.193-1.308-.193-1.332c-.014-.057-.047-.094-.104-.094zm1.8-.801c-.064 0-.104.044-.11.108l-.217 2.127.217 2.071c.006.064.046.108.11.108.063 0 .104-.044.11-.108l.243-2.071-.244-2.127c-.006-.064-.047-.108-.11-.108zm.899-.478c-.074 0-.12.046-.126.12l-.199 2.606.199 2.495c.006.076.052.12.126.12s.12-.044.127-.12l.227-2.495-.227-2.606c-.007-.074-.053-.12-.127-.12zm.901-.31c-.083 0-.135.055-.141.136l-.181 2.916.181 2.802c.006.083.058.136.141.136.082 0 .134-.053.14-.136l.204-2.802-.204-2.916c-.006-.081-.058-.136-.14-.136zm.899-.206c-.094 0-.15.06-.155.148l-.163 3.122.163 2.907c.005.09.061.148.155.148.092 0 .15-.058.155-.148l.185-2.907-.185-3.122c-.005-.088-.063-.148-.155-.148zm.902-.144c-.104 0-.166.066-.17.163l-.146 3.266.146 2.93c.004.1.066.163.17.163.103 0 .166-.063.17-.163l.166-2.93-.166-3.266c-.004-.097-.067-.163-.17-.163zm.899 0c-.11 0-.179.074-.183.18l-.129 3.266.129 2.896c.004.11.073.18.183.18.11 0 .179-.07.183-.18l.147-2.896-.147-3.266c-.004-.106-.074-.18-.183-.18zm.901-.074c-.121 0-.197.08-.2.194l-.114 3.34.114 2.867c.003.117.079.194.2.194.12 0 .197-.077.2-.194l.129-2.867-.129-3.34c-.003-.114-.08-.194-.2-.194zm5.38-.299c-.207 0-.397.035-.578.1a5.378 5.378 0 00-5.332-4.725c-.365 0-.726.04-1.079.117-.135.03-.17.063-.17.126v9.351c0 .065.04.122.107.132h7.052A2.89 2.89 0 0024 11.643a2.89 2.89 0 00-2.942-2.902zm-6.478.138c-.13 0-.213.087-.216.21l-.097 3.19.097 2.848c.003.123.086.21.216.21.13 0 .213-.087.216-.21l.11-2.848-.11-3.19c-.003-.123-.087-.21-.216-.21z" />
    </svg>
  );
}

const socialLinks = [
  { name: "Spotify", href: "https://open.spotify.com/playlist/3Np0DOO7qnA1jWjmBV2Kjc", Icon: SpotifyIcon },
  { name: "Instagram", href: "https://instagram.com/orangewhip.surf", Icon: InstagramIcon },
  { name: "Facebook", href: "https://facebook.com/orangewhipmusic", Icon: FacebookIcon },
  { name: "Bluesky", href: "https://bsky.app/profile/jinks.ninja", Icon: BlueskyIcon },
  { name: "YouTube", href: "https://www.youtube.com/watch?v=cThz9hTD74E&list=PLQDmWUyxw2hQXcrCibYxB8GLsRH9eKnaq", Icon: YouTubeIcon },
  { name: "SoundCloud", href: "https://soundcloud.com", Icon: SoundCloudIcon },
];

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `transition-colors duration-200 ${isActive ? "text-primary-400 font-semibold" : "text-secondary-300 hover:text-white"}`;

export function Header() {
  const { user, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const showAdmin = user && canAdminister(user);
  const showEditor = user && canEditContent(user);

  return (
    <header
      className={`sticky top-0 z-50 transition-all duration-300 ${
        scrolled ? "bg-secondary-900/95 backdrop-blur-sm shadow-lg" : "bg-secondary-900"
      }`}
    >
      {/* Social bar */}
      <div className="border-b border-secondary-800">
        <div className="container-max flex items-center justify-end gap-4 py-1.5">
          {socialLinks.map(({ name, href, Icon }) => (
            <a
              key={name}
              href={href}
              title={name}
              className="text-secondary-400 hover:text-primary-400 transition-colors"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Icon className="w-4 h-4" />
              <span className="sr-only">{name}</span>
            </a>
          ))}
        </div>
      </div>

      {/* Main nav */}
      <nav className="container-max flex items-center justify-between py-3">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-r from-primary-400 to-primary-600 rounded-full flex items-center justify-center">
            <span className="text-white font-bold text-sm">OW</span>
          </div>
          <span className="text-xl font-display font-bold text-gradient">Orange Whip</span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-6 text-sm font-medium">
          <NavLink to="/shows" className={navLinkClass}>Shows</NavLink>
          <NavLink to="/updates" className={navLinkClass}>Updates</NavLink>
          <NavLink to="/press" className={navLinkClass}>Press</NavLink>
          <NavLink to="/media" className={navLinkClass}>Media</NavLink>

          {user ? (
            <div className="flex items-center gap-4 ml-4 pl-4 border-l border-secondary-700">
              {(showEditor || showAdmin) && (
                <NavLink to="/admin" className={navLinkClass}>Admin</NavLink>
              )}
              <NavLink to="/profile" className={navLinkClass}>
                <UserCircleIcon className="w-5 h-5" />
              </NavLink>
              <button onClick={signOut} className="text-secondary-400 hover:text-red-400 transition-colors text-xs">
                Sign Out
              </button>
            </div>
          ) : (
            <NavLink to="/login" className="btn-primary text-xs !px-4 !py-1.5 ml-4">Sign In</NavLink>
          )}
        </div>

        {/* Mobile hamburger */}
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="md:hidden p-2 text-secondary-300 hover:text-white"
        >
          {mobileOpen ? <XMarkIcon className="w-6 h-6" /> : <Bars3Icon className="w-6 h-6" />}
        </button>
      </nav>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-secondary-800 bg-secondary-900/95 backdrop-blur-sm">
          <div className="container-max py-4 space-y-2">
            {[
              { to: "/shows", label: "Shows" },
              { to: "/updates", label: "Updates" },
              { to: "/press", label: "Press" },
              { to: "/media", label: "Media" },
              ...(showEditor || showAdmin ? [{ to: "/admin", label: "Admin" }] : []),
              ...(user ? [{ to: "/profile", label: "Profile" }] : [{ to: "/login", label: "Sign In" }]),
            ].map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `block px-3 py-2 rounded-md transition-colors ${
                    isActive ? "bg-secondary-800 text-primary-400" : "text-secondary-300 hover:bg-secondary-800 hover:text-white"
                  }`
                }
                onClick={() => setMobileOpen(false)}
              >
                {item.label}
              </NavLink>
            ))}
            {user && (
              <button
                onClick={() => { signOut(); setMobileOpen(false); }}
                className="block w-full text-left px-3 py-2 rounded-md text-red-400 hover:bg-secondary-800 transition-colors"
              >
                Sign Out
              </button>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
