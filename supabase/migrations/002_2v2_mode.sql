-- Who Wins — 2v2 Battle Mode Migration

-- Add battle_mode to lobbies (default '1v1' preserves backward compat)
ALTER TABLE lobbies
  ADD COLUMN IF NOT EXISTS battle_mode TEXT NOT NULL DEFAULT '1v1'
  CHECK (battle_mode IN ('1v1', '2v2'));

-- Teams table (groups 2 players per team in 2v2)
CREATE TABLE IF NOT EXISTS teams (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lobby_id   UUID NOT NULL REFERENCES lobbies(id) ON DELETE CASCADE,
  team_slot  INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all" ON teams FOR ALL TO anon USING (true) WITH CHECK (true);
ALTER PUBLICATION supabase_realtime ADD TABLE teams;

-- Add team_id to players (NULL for 1v1 or before teams are formed)
ALTER TABLE players ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES teams(id);

-- Extend brackets for 2v2:
--   player3_id = team A's second member
--   player4_id = team B's second member
--   weapon3_id = team A second member's weapon
--   weapon4_id = team B second member's weapon
ALTER TABLE brackets
  ADD COLUMN IF NOT EXISTS player3_id UUID REFERENCES players(id),
  ADD COLUMN IF NOT EXISTS player4_id UUID REFERENCES players(id),
  ADD COLUMN IF NOT EXISTS weapon3_id UUID REFERENCES weapons(id),
  ADD COLUMN IF NOT EXISTS weapon4_id UUID REFERENCES weapons(id);
