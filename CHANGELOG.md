# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/), and this project adheres to [Semantic Versioning](https://semver.org/).

## [2.0.0] - 2026-04-03

### BREAKING
- **PostgreSQL is dead, long live MySQL** — full database migration. Existing PG data is not compatible. Fresh start, fresh vibes.
- **JWT tokens slimmed down** — removed email from the payload. Lighter tokens, less PII floating around in base64.
- **Passwords got standards** — must now contain at least one letter and one number. Sorry, `00000000`.

### Added
- **Helmet security headers** — your browser now gets told to behave itself
- **CORS lockdown** — configurable via `ALLOWED_ORIGINS` env var (defaults to wide open for dev, because we trust you... for now)
- **Per-socket rate limiting** — 30 events/sec per connection. No more turbo-clicking your way to victory.
- **Input validation on all socket events** — row/col must be integers 0-9, ships must be an array, difficulty must be real. No more sending `{row: "DROP TABLE"}`.
- **Error message sanitization** — internal errors no longer leak to clients. You get "Something went wrong" like everyone else.
- **Crypto-secure room codes** — replaced `Math.random()` with `crypto.randomBytes()` + collision checking. Your room codes are now unguessable.
- **JWT algorithm pinning** — HS256 explicitly enforced on both signing and verification
- **MySQL connection pool hardening** — connection limits, timeouts, and optional SSL support
- **10kb body size limit** — in case someone tries to POST a novel

### Fixed
- Schema indexes now defined inline (no more failing re-init)
- `.gitignore` expanded to catch `.DS_Store`, coverage reports, and env file variants
- `.env.example` updated to reflect the MySQL reality

## [1.7.0] - 2026-04-03

### Added
- **Typewriter notifications** with blinking block cursor
- **Glitch text** RGB split effect on title and headings
- **Shot queueing** — click during AI turn to queue your next shot
- **Juicier hit feedback** — 4 distinct shake styles, board ripple on incoming hits, ready button pulse

### Fixed
- CRT effects tuned up (scanlines, vignette, phosphor glow were too subtle)
- Matrix rain fixed (was hiding behind the background like a coward)
- Various notification and animation glitches squashed

## [1.6.0] - 2026-04-03

### Added
- **Login/auth system** — register, login, JWT tokens, bcrypt, rate limiting, in-memory fallback
- **Full CRT aesthetic overhaul** — scanlines, vignette, phosphor afterglow, VHS tracking distortion, matrix rain, cursor trail, crosshair pulse

### Security
- JWT_SECRET validated at startup, input sanitization, rate limiting on auth

## [1.5.0] - 2026-04-02

### Added
- **Stats dashboard** — career stats with per-mode breakdowns, streaks, hit rates
- **Sunk ships tracker** — red pixel-block cards show destroyed enemy fleet
- **Difficulty badge** and career hit rate display
- **AI turn delay** — 800-1500ms for that "thinking..." feel

### Fixed
- Game-over handling unified — accuracy, confetti, and defeat effects all work properly now

## [1.4.0] - 2026-04-02

### Added
- **Thematic micro copy** — rotating military/cyber messages with oscilloscope transitions
- **Explosion sound** — synthesized boom on ship sinking (it slaps)
- **Motion toggle** — respects `prefers-reduced-motion`
- **Pixel-block ship visuals** throughout UI
- **Keyboard shortcuts** — Escape drops held ship, plus existing R/S/Enter

### Fixed
- Hover preview, font sizes, fleet alignment polish

## [1.3.0] - 2026-04-02

### Added
- **Side-by-side game layout** — big enemy board left, your fleet small on the right
- **3D water ripple** on impacts, **screen shake** on hits/sinks
- **Turn alerts** with audio beep and status pulse
- **Undo placement** [Z], **Play Again** shortcut, improved menu hierarchy

## [1.2.0] - 2026-04-02

### Added
- Rebranded to **Cyber Ship Battle**
- **Victory confetti** and slam animation, **defeat wave distortion**
- Changelog page at `/changelog`
- Click-to-copy room codes
- Keyboard shortcuts for placement (R, S, Enter)

## [1.1.0] - 2026-04-01

### Added
- Settings menu, sound persistence, tabbed mode selection
- Crosshair favicon/cursor/icon theme
- Ship repositioning — click to pick up and move placed ships

## [1.0.0] - 2026-03-31

### Added
- The whole damn game — battleship vs AI (3 difficulties) or multiplayer
- Express + Socket.io server, PostgreSQL backend, JWT auth
- Retro terminal theme with CRT effects
- Private rooms, matchmaking, game-over stats
- Sound effects, placement previews, the works

## [0.2.0] - 2026-03-31
- Game client, UI, sound effects, SEO markup, retro CSS theme

## [0.1.0] - 2026-03-31
- Initial scaffold — board logic, AI, game rooms, database, auth, API routes
