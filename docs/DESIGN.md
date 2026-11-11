# HandMeDown: design system

A buy, sell and give-away board for students of one college. This concept adopts the Figma
"Handmade Shop" e-commerce kit (Maison Artisan) as its visual base, then adapts and upgrades it.

**Big idea:** *Things passed from one hand to the next.* The kit's warm, crafted palette already reads as
"pre-loved". We keep it and add physical moments that echo a real handover: a **SOLD / RESERVED stamp**
that thumps onto the photo, photos you flick like a stack of prints, and a filter sheet you can toss away.

This document records the approved design concept that the app implements: what was kept from the kit, what was upgraded, and the final tokens.

---

## 1. Kept from the Figma kit

| Kit element | Kept as |
|---|---|
| Palette: Primary `#483724`, Accent `#C88042`, Accent Light `#F7E7D8`, Background `#FCF7F0`, Surface `#FFF`, Text Dark `#261E17`, Text Muted `#736960`, Border `#E0D8D0`, Tag BG `#E6DCD2` | All 9 hex values unchanged and used for the same roles |
| Inter-style grotesk, bold, tight headings | Inter (variable 400–800); same scale (64/32/20/16/14/12/11) |
| White navbar: logo left, nav centre with caramel active link, icon tiles right | Same layout. The cart tile becomes a chats tile with an unread badge |
| Split hero: Accent Light panel on the left, large Tag-coloured circles behind a rounded image | Same composition; the photo becomes a 3-cell illustration collage |
| "Handcrafted with Love" pill | "Only for students of {College}" pill |
| Floating "4.9 · Top Rated" chip | "37 items handed down this week · demo" chip plus a mini listing card |
| Stats row (2,400+ / 180+ / 98%) | Listings up now / items handed down / verified students, labelled demo |
| Overlay-gradient category cards | 7 campus categories, with the same bottom gradient and white label |
| Pill filter chips (dark selected, tag-bg unselected) | All / Free / Exchange / Under ₹500 / Like new |
| White product card: inset image, pastel badge, name, bold price + struck price, full-width dark pill CTA | Listing card: same anatomy. Struck price = "₹1,150 new", so students see the saving. CTA = "Chat with seller" |
| Pastel badges (mint "New", peach "Best seller") | Mint = Verified / Free / Just listed, peach = Exchange, tag = Book, accent-light = Reserved, dark = Sold |
| Dark-brown "Meet the Makers" banner + caramel button | "Graduating? Pass it on." + "Post a listing" |
| Newsletter band on Accent Light, pill input + dark button | Wishlist alert: "Waiting for something specific?" |
| Dark-brown footer with 4 columns | Same, with campus links |
| Pill buttons (dark, caramel, white outlined), pill input, 16px card radius | Unchanged shapes |

**Removed kit fluff:** About/Blog/Contact nav, star ratings and review counts (meaningless for one-off
second-hand items), testimonial quotes (would be fake), Sale/€ pricing, "Shop now / Our story". The kit's
Testimonials slot became an honest **How it works** (post → chat in-app → meet at a campus spot).

## 2. Upgrades on top of the kit (and why)

1. **Spring physics engine** (`spring.js`, ~70 lines, semi-implicit Euler with fixed 1/120 s sub-steps). Every physical
   effect shares it, so they all feel like they're made of the same material.
2. **Spring press** on cards, buttons, chips, tiles and tabs. They squash on pointer-down and overshoot slightly on release. Cards
   press less than buttons because they're heavier.
3. **Swipeable gallery** (detail page): drag with 1:1 tracking, **momentum projection** (a flick carries
   to the next photo even when the drag was short), an **iOS-style rubber band** past the first and last photo, and a spring snap.
   Also arrows, dots, thumbnails and the keyboard arrow keys.
4. **Draggable filter bottom sheet** (mobile): drag the grip, **velocity-based dismiss** (> 0.5 px/ms or
   > 35 % of the sheet's height), rubber band when pulled up, and the scrim fades with position. The footer shows a live
   "Show 13 listings" count.
5. **Chip spring-pop** on select (low damping, so you see the bounce). The segmented control's thumb and the switch
   thumbs also move on springs.
6. **Hero circles** follow the pointer at different depths (desktop) and drift with scroll (all sizes), on
   soft springs. The chip and mini card move the opposite way, which adds parallax.
7. **SOLD / RESERVED stamp** (signature moment): marking a listing drops a rubber stamp from 2.2× scale
   onto the photo. Cards show the stamp statically.
8. **Swipe-to-dismiss toasts** in the kit's style: a white card with a mint check and an Undo action.
9. **Real client-side photo compression** on Sell: canvas downscale to 1280 px and JPEG 0.72, with a
   "3.8 MB → 210 KB" progress readout. The "Add demo photos" link shows the same thing without picking files.
10. **Product upgrades:** search by title *or ISBN*; an ISBN-10/13 checksum check; a warning when a phone number is typed in chat;
    the listing pinned at the top of every thread; quick replies; an empty search state that offers "Alert me when it's listed";
    alert prefill from the home band ("cycle under 2000" fills keyword = cycle, max = 2000); Undo on every destructive action.
11. **Mobile-first:** 360 px with zero horizontal overflow (checked on every route), a bottom tab bar with a raised Sell
    button, a sticky price + CTA bar on the detail page, single-pane chats on mobile and two panes on desktop, and admin table rows that turn into cards on mobile.
12. **Dark theme** in warm espresso tones (not grey). It follows `prefers-color-scheme`, the manual toggle is saved to localStorage, and the
    illustrations re-tint through CSS variables.
13. **Accessibility:** skip link, semantic landmarks, labelled inputs, `aria-invalid` + inline errors +
    a focusable error summary, `role="switch"` / `radiogroup`, `aria-live` results and messages, a focus trap in the sheet,
    Esc closes popovers, and a 2 px accent-ink focus ring.
14. **Reduced motion:** springs jump straight to their end value, the shimmer and typing animations stop, and the hero drift is not attached.
    Nothing depends on motion to work.

## 3. Final tokens

### Colour

| Token | Light | Dark | Use |
|---|---|---|---|
| `--primary` | `#483724` | `#F0DFCC` | Primary CTA fill, sent bubbles, selected chip |
| `--on-primary` | `#FFFFFF` | `#211913` | Text on primary |
| `--accent` | `#C88042` | `#C88042` | **Fills only**: alt CTA, badges dots, progress, stamps |
| `--accent-ink` | `#8F531F` | `#E3A96F` | Accent used as text, active nav, links, focus ring |
| `--on-accent` | `#261E17` | `#17110C` | Text on caramel fills |
| `--accent-light` | `#F7E7D8` | `#2E2219` | Hero, alert band, icon tiles, book block |
| `--bg` | `#FCF7F0` | `#17110C` | Canvas |
| `--surface` | `#FFFFFF` | `#211913` | Navbar, cards, inputs |
| `--surface-2` | `#F6EFE6` | `#2B2119` | Received bubbles, hovers, skeletons |
| `--text` | `#261E17` | `#F3E9DD` | Body |
| `--heading` | `#483724` | `#F3E9DD` | Headings |
| `--muted` | `#736960` | `#B5A493` | Secondary text on canvas / white |
| `--muted-strong` | `#6B5F55` | `#B5A493` | Secondary text on accent-light / tag fills |
| `--border` | `#E0D8D0` | `#3A2D22` | Decorative dividers only |
| `--border-strong` | `#958779` | `#85715F` | Input / control outlines |
| `--tag` | `#E6DCD2` | `#33261B` | Unselected chips, circles |
| mint bg / ink | `#E3F3EA` / `#1E6B4A` | `#1F2A22` / `#9FD8B8` | Verified, Free, success |
| peach bg / ink | `#FBE4D3` / `#9A4B1E` | `#3A2819` / `#F0C29B` | Exchange |
| rose bg / ink | `#F8DEDA` / `#8A3B2E` | `#3A221E` / `#F2A39A` | Errors, blocked, hidden |
| `--danger` | `#B42318` | `#F2A39A` | Error text and borders |

### Contrast notes (WCAG 2.x, computed)

- **Caramel `#C88042` fails as text**: 2.98:1 on the canvas. It is now **fill only**. Accent text uses
  `#8F531F` (5.75:1 on the canvas, 5.07:1 on Accent Light, 6.13:1 on white).
- **White on caramel fails** (3.17:1), so the kit's "Discover Artisans" style button now uses dark text `#261E17` on caramel (5.17:1).
- `#736960` muted passes on the canvas (5.03) and on white (5.36) but **fails on Accent Light (4.43) and Tag BG (3.96)**. On those
  fills we use `#6B5F55` (5.12 / 4.58).
- The kit border `#E0D8D0` is 1.32:1, which is fine for decoration but not for input edges. Inputs use `#958779` (3.49:1 on white, meeting the 3:1 non-text minimum).
- Primary `#483724` on white is 11.4:1. Footer text `#F7E7D8` on `#483724` is 9.4:1.
- Dark theme: text `#F3E9DD` on `#17110C` is 15.6:1, muted `#B5A493` is 7.75:1, and accent `#D99A5F`/`#E3A96F` is ≥ 7:1.
- The focus ring uses `--accent-ink` (≥ 5:1), not caramel.

### Type scale (Inter)

| Role | Size | Weight / tracking |
|---|---|---|
| Display (hero) | `clamp(36px → 64px)` | 800, -0.035em, lh 1.02 |
| Title (section) | `clamp(24px → 32px)` | 700, -0.02em |
| Subtitle | 20px | 600–700 |
| Body | 16px | 400, lh 1.55 |
| Small / card title | 14px | 400 / 600 |
| Price | 18px mobile, 20px desktop, 28px detail | 700, tabular numerals |
| Caption | 12px | 400–500 |
| Badge | 11px | 600 |

### Spacing (4/8 scale)
`4, 8, 12, 16, 24, 32, 48, 64, 96` → `--s1 … --s9`. Container: 1200 px max, gutters 16 / 24 / 32.

### Radius
`--r-xs 6` · `--r-sm 10` (icon tiles, thumbs) · `--r-md 12` (inset images, inputs-in-grid, toasts) ·
`--r-lg 16` (cards, panels, kit card radius) · `--r-xl 24` (hero frame, banner, sheet) · `--r-pill 999` (buttons, chips, inputs).

### Motion
- CSS transitions: `--dur-1 120ms`, `--dur-2 180ms`, `cubic-bezier(.2,.8,.2,1)`. All under 200 ms.
- Springs (stiffness k, damping c, mass 1):

| Preset | k | c | Feel |
|---|---|---|---|
| press | 520 | 26 | Quick squash, tiny overshoot |
| chip | 640 | 16 | Visible bounce on select, switch and segment thumbs |
| snap | 300 | 30 | Gallery settle, critically damped |
| sheet | 380 | 34 | Bottom sheet open and return |
| stamp | 420 | 18 | Stamp landing with a wobble |
| drift | 50 | 13 | Lazy hero circles |
| toast | 460 | 30 | Toast enter and exit |

- Gallery: momentum projection `x + v × 220ms`, at most one slide per flick, rubber band `(1 − 1/(d·0.55/dim + 1))·dim`.
- Sheet: dismiss when `v > 0.5 px/ms` or `y > 35 %` of its height.
- `prefers-reduced-motion`: springs jump to their target, and CSS animations and transitions drop to 0.01 ms.

## 4. Tailwind theme mapping

```js
// tailwind.config.ts (colors resolve to CSS variables so dark mode is a variable swap)
export default {
  darkMode: ["variant", ["@media (prefers-color-scheme: dark) { &:not([data-theme=light] *) }", "&:is([data-theme=dark] *)"]],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: "var(--primary)", fg: "var(--on-primary)" },
        accent: { DEFAULT: "var(--accent)", ink: "var(--accent-ink)", fg: "var(--on-accent)", light: "var(--accent-light)" },
        canvas: "var(--bg)",
        surface: { DEFAULT: "var(--surface)", 2: "var(--surface-2)" },
        ink: { DEFAULT: "var(--text)", heading: "var(--heading)", muted: "var(--muted)", "muted-strong": "var(--muted-strong)" },
        line: { DEFAULT: "var(--border)", strong: "var(--border-strong)" },
        tag: "var(--tag)",
        mint: { DEFAULT: "var(--mint-bg)", ink: "var(--mint-ink)" },
        peach: { DEFAULT: "var(--peach-bg)", ink: "var(--peach-ink)" },
        rose: { DEFAULT: "var(--rose-bg)", ink: "var(--rose-ink)" },
        danger: "var(--danger)",
      },
      fontFamily: { sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"] },
      fontSize: {
        display: ["clamp(2.25rem,1.05rem + 4.6vw,4rem)", { lineHeight: "1.02", letterSpacing: "-0.035em", fontWeight: "800" }],
        title: ["clamp(1.5rem,1.2rem + 1.2vw,2rem)", { lineHeight: "1.15", letterSpacing: "-0.02em", fontWeight: "700" }],
        subtitle: ["1.25rem", { lineHeight: "1.3", fontWeight: "600" }],
        body: ["1rem", "1.55"], sm: ["0.875rem", "1.45"], price: ["1.25rem", { fontWeight: "700" }],
        caption: ["0.75rem", "1.4"], badge: ["0.6875rem", { fontWeight: "600" }],
      },
      spacing: { 1: "4px", 2: "8px", 3: "12px", 4: "16px", 6: "24px", 8: "32px", 12: "48px", 16: "64px", 24: "96px" },
      borderRadius: { xs: "6px", sm: "10px", md: "12px", lg: "16px", xl: "24px", pill: "999px" },
      boxShadow: { 1: "var(--shadow-1)", 2: "var(--shadow-2)", 3: "var(--shadow-3)" },
      transitionDuration: { 1: "120ms", 2: "180ms" },
      transitionTimingFunction: { out: "cubic-bezier(.2,.8,.2,1)" },
    },
  },
};
```
In the Next.js build, the springs map to Motion: `transition={{ type: "spring", stiffness: 520, damping: 26 }}`, and so on.
The gallery and sheet use `drag` + `dragElastic` + `onDragEnd` velocity checks.

## 5. References (brief research)

A quick search did not surface a 2025 Awwwards Site of the Day for a second-hand marketplace, so these are
**pattern references, not award claims**:
- **2nd STREET USA** (second-hand clothing, listed on Awwwards inspiration): a calm warm-neutral product grid
  that lets items, not chrome, carry the page. Borrowed: keep the grid quiet and let the badges and price do the talking.
- **Depop** (resale app; community platform by Finn Partners): chat is attached to the item. Borrowed: the listing is
  pinned at the top of every thread, plus quick replies.
- **HEWI** (pre-loved luxury, recommerce excellence award): trust signals shown up front. Borrowed: the Verified student
  badge on every seller and a safety line right above the CTA.
- A common mobile-commerce pattern (Airbnb, Vinted): a filter sheet whose button shows a **live result count**
  ("Show 13 listings") so you never apply filters into an empty page.


## 6. Notes from the concept stage
- The illustrations stand in for listing photos (to avoid using copyrighted images). Real photo uploads do work on the Sell screen.
- Chat replies, OTP, notifications (it does call the real `Notification.requestPermission`) and admin actions are simulated in memory, and a reload resets them.
- The college name, domain and every number, person and listing are demo data.
