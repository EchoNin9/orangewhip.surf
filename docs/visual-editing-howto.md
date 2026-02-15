# Visual Editing Guide for orangewhip.surf

How to make visual changes to the Orange Whip website using Cursor's browser preview.

## Quick Start

1. Open a terminal in the project root
2. Install dependencies (first time only):
   ```bash
   cd src/web/spa && npm install
   ```
3. Start the dev server:
   ```bash
   cd src/web/spa && npm run dev
   ```
4. Open http://localhost:3000 in Cursor's built-in browser (or your regular browser)
5. Edit files — changes appear instantly via Vite HMR (Hot Module Replacement)

## Project Structure for Visual Edits

```
src/web/spa/src/
├── index.css              ← Global styles, Tailwind utilities, fonts
├── shell/
│   ├── Header.tsx         ← Top navigation bar + social links
│   ├── Footer.tsx         ← Site footer
│   └── AppLayout.tsx      ← Page layout wrapper + routing
└── features/
    ├── home/HomePage.tsx  ← Homepage (hero, updates, shows preview)
    ├── shows/             ← Shows listing and detail pages
    ├── updates/           ← Updates listing
    ├── press/             ← Press page
    ├── media/             ← Media browser
    ├── auth/              ← Sign in / sign up
    ├── profile/           ← User profile
    └── admin/             ← Admin pages (shows, media, updates, press, etc.)
```

## Color Scheme Reference

The site uses a dark theme with orange accents. All colors are defined in `tailwind.config.js`:

### Primary (Orange)
| Class | Hex | Usage |
|-------|-----|-------|
| `primary-50` | `#fff7ed` | Lightest orange background |
| `primary-100` | `#ffedd5` | Light orange |
| `primary-200` | `#fed7aa` | Soft orange |
| `primary-300` | `#fdba74` | Medium light orange |
| `primary-400` | `#fb923c` | Active/hover states, links |
| `primary-500` | `#f97316` | **Main brand orange** |
| `primary-600` | `#ea580c` | Button gradients, dark orange |
| `primary-700` | `#c2410c` | Hover states for buttons |
| `primary-800` | `#9a3412` | Deep orange |
| `primary-900` | `#7c2d12` | Darkest orange |

### Secondary (Slate)
| Class | Hex | Usage |
|-------|-----|-------|
| `secondary-900` | `#0f172a` | **Main background** |
| `secondary-800` | `#1e293b` | Card backgrounds, sections |
| `secondary-700` | `#334155` | Borders, dividers |
| `secondary-600` | `#475569` | Muted elements |
| `secondary-500` | `#64748b` | Disabled text |
| `secondary-400` | `#94a3b8` | Placeholder text, icons |
| `secondary-300` | `#cbd5e1` | Body text, nav links |
| `secondary-200` | `#e2e8f0` | Headings, emphasis |
| `secondary-50` | `#f8fafc` | White text alternative |

## Typography

- **Headings:** `font-display` → Oswald (bold, uppercase feel)
- **Body text:** `font-sans` → Inter (clean, readable)
- **Gradient text:** Use `text-gradient` class for the orange gradient effect

```html
<h1 class="font-display text-5xl font-bold text-gradient">Orange Whip</h1>
<p class="text-secondary-300">Body text in light slate</p>
```

## Common Components / Utility Classes

| Class | Effect |
|-------|--------|
| `container-max` | Responsive centered container (max-w-7xl, auto margins, horizontal padding) |
| `section-padding` | Standard section vertical padding (py-16 md:py-24) |
| `btn-primary` | Orange gradient button with hover scale effect |
| `btn-secondary` | Dark slate button with border |
| `text-gradient` | Orange gradient text (from-primary-400 via-500 to-600) |

## Common Edit Tasks

### Change the band name or tagline
Edit `src/web/spa/src/features/home/HomePage.tsx` — look for the hero section at the top of the component.

### Modify navigation links
Edit `src/web/spa/src/shell/Header.tsx` — the `NavLink` components in the desktop nav section.

### Update social media URLs
Edit `src/web/spa/src/shell/Header.tsx` — the `socialLinks` array at the top of the file:
```tsx
const socialLinks = [
  { name: "Spotify", href: "https://open.spotify.com/YOUR_LINK", Icon: SpotifyIcon },
  { name: "Instagram", href: "https://instagram.com/YOUR_HANDLE", Icon: InstagramIcon },
  // ... etc
];
```

### Change the contact email
Edit `src/web/spa/src/features/press/PressPage.tsx` — search for `band@orangewhip.surf` and `src/web/spa/src/shell/Footer.tsx`.

### Modify the homepage hero section
Edit `src/web/spa/src/features/home/HomePage.tsx` — the first `<section>` in the return JSX contains the hero with the animated title and tagline.

### Add a new page
1. Create `src/web/spa/src/features/yourpage/YourPage.tsx`
2. Add a route in `src/web/spa/src/shell/AppLayout.tsx`
3. Add a nav link in `src/web/spa/src/shell/Header.tsx`

### Change card styles
Most cards use these patterns:
```tsx
<div className="bg-secondary-800 rounded-xl border border-secondary-700 p-6 hover:border-primary-500/50 transition-colors">
  <h3 className="text-lg font-semibold text-secondary-100">Card Title</h3>
  <p className="text-secondary-400">Card content</p>
</div>
```

### Change button styles
Edit `src/web/spa/src/index.css` — the `.btn-primary` and `.btn-secondary` classes in `@layer components`.

## Animations

The site uses Framer Motion for animations. Common patterns:

```tsx
import { motion } from "framer-motion";

// Fade in on mount
<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>
  Content
</motion.div>

// Staggered list items
{items.map((item, i) => (
  <motion.div
    key={item.id}
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: i * 0.1 }}
  >
    {item.title}
  </motion.div>
))}
```

## Tips for Cursor Browser Testing

1. **Live reload:** Vite automatically reloads when you save files. No need to refresh manually.
2. **Mobile testing:** Resize the Cursor browser panel to test responsive layouts. Key breakpoints: `sm:` (640px), `md:` (768px), `lg:` (1024px).
3. **Auth testing:** Without a deployed backend, the site runs in "guest" mode. To test authenticated views, you can temporarily modify `AuthContext.tsx` to return a mock user.
4. **Dark theme:** The background is `bg-secondary-900` (`#0f172a`). Make sure all text has sufficient contrast — use `text-secondary-300` or lighter for readability.
