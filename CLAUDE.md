# Who Wins — Game Plan & Instructions

## Context
Build "Who Wins" from scratch in this empty directory. It's a real-time multiplayer web game with arcade fighting game aesthetics where 2–16 players vote on who would win in matchups, with a tournament bracket format.

**Starting point**: Empty folder
**Supabase**: Create project from scratch
**Images**: Upload to Supabase Storage
**Sets management**: Dedicated /sets admin page
**Audio**: Web Audio API only (no audio files)

---

## Tech Stack
- **Frontend**: Vite + React + TypeScript
- **Backend/DB**: Supabase (PostgreSQL + Realtime + Storage)
- **State**: Zustand
- **Router**: React Router v6
- **Styling**: CSS Modules + global arcade utility classes (no Tailwind)
- **Deploy**: Vercel via GitHub PR

---

## Game Rules
- **Players**: minimum 2, maximum 16
- **Formats**: 1v1 (2), semis (4), quarters (8), octavos (16)
- **No login**: Session UUID stored in localStorage
- **Bots**: Auto-fill empty slots with characters from selected character set; They participate in the scoring phase like any human player (they are scored by all participants).

---

## Game Flow
0. Host creates lobby → selects format (2/4/8/16), character set, weapon set
1. Players join via 6-char code → enter name + upload photo
2. If real players < format slots → fill with bot characters from the set
3. Rating phase: each human player rates every other participant, bots includes (strength, skill, resistance — 1–5 stars, half-star allowed). Bots appear in the scoring queue with their photo and character name. Bots do not score anyone.
4. Game computes power scores → generates balanced snake-seeded bracket → assigns weapons (inverse power/danger balance)
5. Voting phase per match: host opens each match, players debate and vote, host closes when ready
6. Winner of match-up shown → next match opens
7. When all matches in a round finish → weapons reassign → next round starts
8. Last player standing = winner

---

## Project Structure
```
who-wins/
├── .github/workflows/preview.yml       # Vercel preview on PR
├── public/favicon.ico
├── supabase/migrations/001_initial.sql
├── src/
│   ├── main.tsx / App.tsx
│   ├── router/index.tsx
│   ├── lib/
│   │   ├── supabase.ts                 # client singleton
│   │   ├── session.ts                  # localStorage UUID
│   │   ├── constants.ts
│   │   └── utils.ts
│   ├── types/
│   │   ├── database.ts                 # supabase gen types
│   │   └── game.ts                     # domain types
│   ├── algorithms/
│   │   ├── bracket.ts                  # snake seeding + bracket gen
│   │   ├── weaponAssignment.ts         # inverse power-danger balance
│   │   └── powerScore.ts              # weighted composite score
│   ├── store/index.ts                  # Zustand store
│   ├── hooks/
│   │   ├── useLobbyRealtime.ts         # central multiplayer sync
│   │   ├── useSession.ts
│   │   ├── useIsHost.ts
│   │   └── useAudio.ts
│   ├── services/
│   │   ├── lobbyService.ts
│   │   ├── playerService.ts
│   │   ├── ratingService.ts
│   │   ├── bracketService.ts
│   │   ├── voteService.ts
│   │   ├── setsService.ts
│   │   └── storageService.ts
│   ├── audio/
│   │   ├── audioEngine.ts              # AudioContext singleton
│   │   └── sounds.ts                   # all synthesized SFX
│   ├── pages/
│   │   ├── Home/                       # create + join lobby
│   │   ├── Lobby/                      # waiting room
│   │   ├── Rating/                     # rate all players
│   │   ├── Bracket/                    # bracket tree view
│   │   ├── Match/                      # VS screen + voting
│   │   ├── Results/                    # winner reveal
│   │   └── Sets/                       # admin: manage sets
│   ├── components/
│   │   ├── ui/                         # ArcadeButton, StarInput, Modal, etc.
│   │   ├── layout/                     # AppLayout, ArcadeFrame, scanlines
│   │   └── game/                       # VsScreen, PlayerAvatar, WeaponBadge
│   └── styles/
│       ├── variables.css               # design tokens (neon colors, fonts)
│       ├── globals.css
│       ├── arcade.css                  # scanlines, CRT, glow, flicker
│       └── animations.css             # keyframes library
├── .env.example
├── vercel.json
├── package.json / tsconfig.json / vite.config.ts
```

---

## Database Schema (Supabase)

### Tables
| Table | Purpose |
|---|---|
| `character_sets` | Named collections of characters |
| `characters` | id, set_id, name, image_url |
| `weapon_sets` | Named collections of weapons |
| `weapons` | id, set_id, name, image_url, danger_level (1–10 internal, shown as 1–5 stars) |
| `lobbies` | id, code (6-char), host_session_id, format (2/4/8/16), character_set_id, weapon_set_id, status, current_round |
| `players` | id, lobby_id, session_id (NULL for bots), player_type, name, photo_url, slot_number, is_eliminated |
| `ratings` | id, lobby_id, rater_id, target_id, strength, skill, resistance (UNIQUE per rater+target) |
| `player_power_scores` | player_id, avg_strength, avg_skill, avg_resistance, power_score, bracket_seed |
| `brackets` | id, lobby_id, round_number, match_number, player1_id, player2_id, weapon1_id, weapon2_id, status, winner_id |
| `votes` | id, bracket_id, voter_id, voted_for_id (UNIQUE per bracket+voter) |
| `lobby_events` | event log driving realtime transitions |

### Lobby Status Flow
```
waiting → rating → bracket → voting → between_rounds → voting → ... → finished
```
All transitions triggered by host action writing to `lobbies.status` + `lobby_events`.

### Storage Buckets
- `player-photos` — public, max 5MB, image/*
- `set-images` — public, max 10MB, image/*

### RLS
Permissive anonymous policies (no auth). All tables allow SELECT by all. INSERT/UPDATE allowed for all (game is public and ephemeral by design).

---

## Realtime Strategy
Single Supabase channel per lobby, subscribed to all relevant tables filtered by `lobby_id`:

```ts
supabase.channel(`lobby:${lobbyId}`)
  .on('postgres_changes', { table: 'lobbies',      filter: `id=eq.${lobbyId}` }, ...)
  .on('postgres_changes', { table: 'players',      filter: `lobby_id=eq.${lobbyId}` }, ...)
  .on('postgres_changes', { table: 'ratings',      filter: `lobby_id=eq.${lobbyId}` }, ...)
  .on('postgres_changes', { table: 'brackets',     filter: `lobby_id=eq.${lobbyId}` }, ...)
  .on('postgres_changes', { table: 'votes',        filter: `lobby_id=eq.${lobbyId}` }, ...)
  .on('postgres_changes', { table: 'lobby_events', filter: `lobby_id=eq.${lobbyId}` }, ...)
  .subscribe()
```

### Driven Navigation (all players navigate together)
```ts
// useLobbyRealtime.ts
switch (lobby.status) {
  case 'rating':         navigate('/rate');    break
  case 'bracket':        navigate('/bracket'); break
  case 'voting':         navigate('/match');   break
  case 'between_rounds': navigate('/bracket'); break
  case 'finished':       navigate('/results'); break
}
```

---

## Key Algorithms

### Power Score (`src/algorithms/powerScore.ts`)
```
powerScore = ((strength×0.35 + skill×0.40 + resistance×0.25) − 1) / 4 × 100
```
- All participants (humans and bots) receive their power score based on the average of the ratings given by human players during the rating phase.
- Bots do not give ratings; they only receive ratings from human players.
- The ratings table allows target_id to point to any player, regardless of whether they are human or a bot.

### Bracket Generation — Snake Seeding (`src/algorithms/bracket.ts`)
```
Seeds sorted by powerScore DESC: [1..N]
Match 1: seed[0]   vs seed[N-1]     (strongest vs weakest)
Match 2: seed[1]   vs seed[N-2]
...
Match N/2: seed[N/2-1] vs seed[N/2]
```
Round 2+ shells created with null player IDs, filled after each round completes via `advanceWinners()`.

### Weapon Assignment — Inverse Balance (`src/algorithms/weaponAssignment.ts`)
```
For each match:
  stronger player → weapon with LOWER danger
  weaker player   → weapon with HIGHER danger
  gap = |p1.score - p2.score| / 100
  dangerBudget = floor(gap × weapons.length)
  strongerWeapon = random from bottom dangerBudget weapons (sorted danger ASC)
  weakerWeapon   = random from top dangerBudget weapons
```
Weapon pool refreshes at start of each new round.

---

## Session Management
```ts
// src/lib/session.ts
function getSessionId(): string {
  let id = localStorage.getItem('whowins_session')
  if (!id) { id = crypto.randomUUID(); localStorage.setItem('whowins_session', id) }
  return id
}
```
No login. Host identity = `session_id === lobby.host_session_id`.

---

## Pages & Routes
| Route | Page | Description |
|---|---|---|
| `/` | Home | Create lobby / Join by code |
| `/lobby/:code` | Lobby | Waiting room, player grid, host controls |
| `/rate` | Rating | Rate each participant 1–5 stars (half-star allowed) |
| `/bracket` | Bracket | Visual tournament tree, weapon reveals |
| `/match` | Match | VS screen, live vote bar, host close button |
| `/results` | Results | Winner cinematic + full bracket recap |
| `/sets` | Sets | Admin: CRUD for character sets and weapon sets |

---

## Aesthetic
Modern cartoon fighting game style (Street Fighter 6 / Guilty Gear Strive): bold, vibrant, clean, cel-shaded. No CRT/scanlines.

- **Fonts**: Bangers (headers/buttons/display) + Nunito 800 (body/UI) — Google Fonts
- **Palette**: Navy-black bg (`#0d0f1a`), orange-red primary, electric blue secondary, gold accent
- **Effects**: Solid 3D button shadows, diagonal texture overlay, `border-radius` everywhere, no neon glow
- **Animations**: `bounceIn` (winner), spring curves for slides, `fightBurst` for FIGHT! text
- **VS Screen**: Diagonal split (red/blue bg tint), Bangers FIGHT! with double shadow, clean vote bar
- **Mobile**: Single column, oversized touch targets, horizontal scroll for bracket tree

### Design Tokens (key CSS variables)
```css
--color-bg:           #0d0f1a;
--color-primary:      #ff4500;   /* orange-red — main action */
--color-secondary:    #0096ff;   /* electric blue */
--color-accent-gold:  #ffcc00;   /* champion, selected */
--color-accent-green: #00d96e;
--font-display:       'Bangers', 'Impact', cursive;
--font-arcade:        var(--font-display);
--font-ui:            'Nunito', system-ui, sans-serif;
--radius-md:          12px;
--shadow-btn-primary: 0 5px 0 #cc3500;
--shadow-display:     3px 3px 0 rgba(0,0,0,0.6);
```

---

## Audio (Web Audio API — no files)
All sounds synthesized via AudioContext oscillators + noise. AudioEngine is a singleton initialized on first user click (browser autoplay policy).

| Sound | Trigger |
|---|---|
| `menuSelect` | Button hover |
| `menuConfirm` | Button click |
| `playerJoined` | New player joins lobby |
| `starFill` | Each half-star added in rating |
| `vsSlam` | VS screen appears |
| `voteCast` | Player casts vote |
| `matchClose` | Host closes match voting |
| `knockout` | Match winner declared |
| `winner` | Final winner cinematic |
| Background music | Step-sequencer loop, 3 phases: lobby / rating / battle |

---

## Deployment

### vercel.json
```json
{
  "rewrites": [{ "source": "/((?!api/).*)", "destination": "/index.html" }]
}
```

### GitHub Actions (`.github/workflows/preview.yml`)
- Triggers on PR to `main`
- Runs `npm ci && npm run build`
- Deploys preview to Vercel via `amondnet/vercel-action`
- Posts preview URL as PR comment

### Required Secrets
```
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
VERCEL_TOKEN
VERCEL_ORG_ID
VERCEL_PROJECT_ID
```

### .env.example
```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJxxxxxx
```

---

## Build Order

### Phase 1 — Foundation
1. `npm create vite@latest who-wins -- --template react-ts`
2. Install: `zustand react-router-dom @supabase/supabase-js`
3. Create Supabase project → run migration SQL → configure Storage buckets
4. `src/lib/supabase.ts`, `session.ts`, `constants.ts`
5. All CSS design system (`styles/`)
6. `AppLayout`, `ArcadeFrame`, core UI components (ArcadeButton, ArcadeInput, StarInput, Modal)
7. Zustand store (`src/store/index.ts`)

### Phase 2 — Lobby + Player Join
8. `lobbyService.ts`, `playerService.ts`, `storageService.ts`
9. `HomePage` (create + join forms)
10. `LobbyPage` (waiting room, player grid, copy/share code)
11. Join flow modal (name + photo upload to Supabase Storage)
12. `useLobbyRealtime.ts` + driven navigation wiring

### Phase 3 — Rating Phase
13. `ratingService.ts`
14. `RatingPage` with `RatingCard` + `StarInput` (half-star)
15. `powerScore.ts` algorithm
16. Host "close ratings" → compute scores → transition to bracket

### Phase 4 — Bracket + Voting
17. `bracket.ts` + `weaponAssignment.ts` algorithms
18. `bracketService.ts`, `voteService.ts`
19. `BracketPage` with `BracketTree` + weapon reveal animation
20. `MatchPage`: `VsScreen`, `FighterDisplay`, `VoteBar`, host close button
21. Round completion → advance winners → weapon reassignment → next round

### Phase 5 — Audio + Polish
22. `audioEngine.ts`, `sounds.ts`, background music sequencer
23. Wire all sounds to game events
24. CSS animations: glitch, flicker, FIGHT!, KO overlay
25. `ResultsPage` winner reveal cinematic

### Phase 6 — Sets Admin + Bot Fill
26. `SetsPage` full CRUD (character sets + weapon sets with image upload)
27. Bot fill logic: when real players < format, add characters from set as bots (photo = character image, name = character name)
28. Bots appear in the rating queue for all human players to rate; bots cannot vote and do not emit ratings

### Phase 7 — Deploy
29. `git init` + push to GitHub
30. Connect repo to Vercel, set env vars
31. GitHub Actions workflow for PR previews
32. Full end-to-end mobile + desktop test

---

## Verification Checklist
- [ ] Create a character set and weapon set via `/sets`
- [ ] Host creates lobby (octavos format), copies share code
- [ ] 6 players join on separate browser tabs with name + photo
- [ ] Host starts game → 2 bot players auto-fill to 8
- [ ] All 6 human players rate all 8 participants including the 2 bots (bots appear in rating queue)
- [ ] Host closes ratings → power scores computed → bracket generated
- [ ] Bracket shows balanced match-ups with weapons assigned (weaker player has more dangerous weapon)
- [ ] Host opens match 1 → players vote → host closes → winner shown on all screens
- [ ] All 4 Round 1 matches complete → weapons reassign → Round 2 starts
- [ ] Final match → winner announced cinematically on all screens simultaneously
- [ ] Supabase Realtime delivers all events < 500ms across tabs
- [ ] Mobile layout works for lobby, rating, voting, and bracket pages
- [ ] Vercel PR preview deploys correctly with env vars
