# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/), and this project adheres to [Semantic Versioning](https://semver.org/).

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
- AIPlayer with three difficulty levels:
  - Easy: random shots
  - Medium: hunt + target mode
  - Hard: probability-density targeting algorithm
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
