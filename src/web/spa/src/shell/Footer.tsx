import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiGet } from "../utils/api";
import { socialLinks } from "./Header";

/* OW redesign footer (OW-12, docs/ow-redesign-2 §9) */
export function Footer() {
  const [bookingEmail, setBookingEmail] = useState("hello@orangewhip.surf");

  /* Same admin-editable setting as the About Booking button (OW-20) */
  useEffect(() => {
    apiGet<{ bookingEmail?: string }>("/branding")
      .then((b) => b.bookingEmail && setBookingEmail(b.bookingEmail))
      .catch(() => {});
  }, []);

  return (
    <footer className="border-t border-ow-hairline bg-ow-bg font-grotesk">
      <div className="mx-auto w-full max-w-[1240px] px-7 pb-8 pt-[34px]">
        <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-5">
          <Link to="/" className="font-cooper text-[32px] font-semibold italic leading-none text-ow-accent">
            Orange Whip
          </Link>
          <nav aria-label="Social links" className="flex flex-wrap gap-x-6 gap-y-2">
            {socialLinks.map(({ name, href }) => (
              <a
                key={name}
                href={href}
                target="_blank"
                rel="noreferrer"
                className="text-sm font-semibold uppercase text-ow-dim transition-colors hover:text-ow-accent"
              >
                {name}
              </a>
            ))}
          </nav>
        </div>
        <p className="mt-6 text-[13px] text-ow-dimmer">
          © {new Date().getFullYear()} Orange Whip · Vancouver, BC · Booking:{" "}
          <a href={`mailto:${bookingEmail}`} className="hover:text-ow-accent">
            {bookingEmail}
          </a>
        </p>
      </div>
    </footer>
  );
}
