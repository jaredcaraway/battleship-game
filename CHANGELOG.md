# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/), and this project adheres to [Semantic Versioning](https://semver.org/).

## [1.4.0] - 2026-04-02

### Added
- **Thematic micro copy**: rotating military/cyber turn messages, oscilloscope canvas transition between turns, styled status bar with separated flavor text and turn indicator
- **Explosion sound**: synthesized Web Audio API explosion (noise burst + bass punch) on ship sinking
- **Motion toggle**: settings option to disable all animations, respects `prefers-reduced-motion`
- **Sound/motion toggle visuals**: speaker SVG icon, red/green state colors
- **Pixel-block ship visuals**: placement ship list and How to Play fleet section show block representations
- **Placement instruction hint**: subtle text explaining click-to-place and click-to-reposition
- **How to Play restyle**: terminal-themed headings, custom counters, `>` prompt markers, color-coded difficulty fieldset cards with legend borders
- Immediate ship pickup with hover preview refresh on reposition

### Fixed
- Hover preview refreshes after picking up a ship (no stale 1-cell preview)
- SEO content font sizes bumped for readability (14px body, 16px/13px headings)
- Fleet block alignment with fixed-width name column

## [1.3.0] - 2026-04-02

### Added
- **Game UI rework**: side-by-side desktop layout — enemy board (large, left) + player board (small, right) with ship status beneath
- **3D water ripple effect**: perspective-based undulating wave radiates from impact point on each shot, amplitude decays with distance
- **Screen shake**: light shake on hits, heavy shake on ship sinking — JS-driven decaying random jitter
- **Turn change alerts**: 880Hz beep via Web Audio API + status bar green pulse on turn change
- **Targeting highlight**: enemy board cells glow with inner/outer box-shadow on hover (excludes already-hit cells)
- **Menu visual hierarchy**: underline-style tabs, color-coded difficulty buttons (green/amber/red), secondary leaderboard button
- **Undo placement**: Undo [Z] button reverts last placed ship during placement phase
- **Play Again shortcut**: replays same AI difficulty from game over screen without returning to menu
- Board labels styled as subtle uppercase headers, enemy label brighter

### Fixed
- Player board thumbnail no longer resizes after first hit (explicit width instead of max-width only)
- Difficulty button colors now properly override base `.btn-terminal` styles (specificity fix)
- Screen shake duration increased for better feel (was too subtle)

## [1.2.0] - 2026-04-02

### Added
- Rebranded to **Cyber Ship Battle**
- Victory screen: confetti celebration (canvas-confetti, green-themed, lazy-loaded from CDN)
- Victory screen: "VICTORY!" slam animation with triple-layer green glow
- Defeat screen: SNES-style horizontal wave distortion via SVG turbulence filter
- Defeat screen: red text with layered glow
- Game over screen vertically centered with flexbox layout
- Onsite changelog page at `/changelog` rendering from CHANGELOG.md
- Changelog footer link with `>_ changelog` terminal prompt
- Click-to-copy room code with SVG copy icon and "Copied!" confirmation
- Room lobby and matchmaking screens centered with consistent styling
- Reusable CSS style guide patterns (`.screen-centered`, `.screen-heading`, `.screen-subtitle`)
- Keyboard shortcuts for all placement buttons: Rotate [R], Randomize [S], Ready [Enter]

### Fixed
- All links underlined for UX discoverability
- Placement controls flush beneath game board

## [1.1.0] - 2026-04-01

### Added
- Settings menu accessible from nav bar with modal overlay
- Sound preference persisted in localStorage across sessions
- Tabbed interface for AI vs Multiplayer mode selection
- Crosshair reticle SVG favicon and heading icon with glow effect
- Crosshair cursor site-wide to match visual theme
- "Pick up" tooltip when hovering placed ships on board
- Toggleable ship selection — click placed ships to pick up and reposition
- Click board cells to pick up placed ships directly
- Keyboard shortcut (R) for rotation with instant preview refresh
- Rotate button shows persistent `[R]` shortcut label
- Placement preview refreshes immediately on rotation (no mouse move needed)

### Fixed
- Placement controls now flush beneath the game board (not floating below)
- Player ships visible on "Your Fleet" board during gameplay (server sends ship names, not literal 'ship' string)
- Vertical spacing between multiplayer button groups
- AI difficulty buttons centered with space-around layout

## [1.0.0] - 2026-03-31

### Added
- Complete battleship game — playable vs AI or multiplayer
- Express server with Socket.io real-time game events
- Board class with ship placement validation, attack logic, and state views
- AIPlayer with three difficulty levels (Easy: random shots, Medium: hunt + target mode, Hard: probability-density targeting)
- GameRoom with turn management, AI integration, and 30s reconnection grace period
- PostgreSQL database integration for users, games, leaderboard, and stats
- JWT authentication with register/login routes and middleware
- Leaderboard, stats, and game history API routes
- SEO-optimized HTML with schema.org markup and below-fold content
- Retro terminal CSS theme with CRT scanline effects and responsive layout
- Client-side game.js with board rendering, Socket.io client, and game loop
- UI controls: ship placement, auth forms, and screen management
- Sound effects (fire, hit, miss, sunk) with lazy loading and mute toggle
- Green/red placement preview on hover showing ship size and validity
- Private room creation with shareable room code
- Matchmaking queue for random opponents
- Game over screen with stats (turns, duration, accuracy)

### Fixed
- Scroll to top on screen change, hide SEO content during gameplay
- Ship placement case mismatch allowing unlimited placements
- Menu container padding
- Leaderboard table styling with proper spacing and alignment
- Placement screen layout — centered heading, proper board size, centered controls

## [0.2.0] - 2026-03-31

### Added
- Game client: board rendering, Socket.io connection, game loop
- UI layer: ship placement interaction, auth modals, screen management
- Sound effects with lazy loading (fire, hit, miss, sunk WAV files)
- SEO-optimized HTML with all game screens and schema.org VideoGame markup
- Retro terminal CSS theme with CRT scanline overlay and responsive breakpoints

## [0.1.0] - 2026-03-31

### Added
- Project scaffold with dependencies, database schema, directory structure
- Board class with ship placement, attack resolution, and state serialization
- AIPlayer with easy/medium/hard difficulty strategies
- GameRoom with turn management, AI integration, and reconnection handling
- Database query module for users, games, leaderboard, and stats
- Auth routes (register/login) with JWT middleware
- Leaderboard, stats, and game history API routes
- Express server entrypoint with Socket.io game event handlers
