-- Create flights table
CREATE TABLE IF NOT EXISTS flights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    origin_code TEXT NOT NULL, -- IATA code (DXB)
    origin_city TEXT NOT NULL,
    destination_code TEXT NOT NULL, -- IATA code (YUL)
    destination_city TEXT NOT NULL,
    departure_time TIMESTAMPTZ NOT NULL,
    arrival_time TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('scheduled', 'in-air', 'landed', 'cancelled')),
    type TEXT NOT NULL CHECK (type IN ('past', 'future')),
    confirmed_at TIMESTAMPTZ, -- For manual move to history
    user_id UUID REFERENCES auth.users(id) -- Optional: for multi-user support
);

-- Create app_state table for synchronization
CREATE TABLE IF NOT EXISTS app_state (
    id UUID PRIMARY KEY DEFAULT '00000000-0000-0000-0000-000000000000', -- Single row state
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    partner_city_code TEXT NOT NULL DEFAULT 'YUL',
    partner_city_name TEXT NOT NULL DEFAULT 'Montreal, CA',
    last_persona TEXT NOT NULL DEFAULT 'home' CHECK (last_persona IN ('plane', 'home'))
);

-- Insert initial state if not exists
INSERT INTO app_state (id, partner_city_code, partner_city_name, last_persona)
VALUES ('00000000-0000-0000-0000-000000000000', 'YUL', 'Montreal, CA', 'home')
ON CONFLICT (id) DO NOTHING;

-- Enable Row Level Security (RLS) - simplified for internal/shared use
ALTER TABLE flights ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_state ENABLE ROW LEVEL SECURITY;

-- Allow public access for now as per "shared world" requirement (can be tightened later)
CREATE POLICY "Allow public read/write on flights" ON flights FOR ALL USING (true);
CREATE POLICY "Allow public read/write on app_state" ON app_state FOR ALL USING (true);

-- Functions for dynamic location logic
CREATE OR REPLACE FUNCTION get_current_location() 
RETURNS TEXT AS $$
BEGIN
    -- Logic to find the "gap" as requested in requirements
    -- This will be handled in the application layer most likely, but ready here
    RETURN 'DXB'; 
END;
$$ LANGUAGE plpgsql;
