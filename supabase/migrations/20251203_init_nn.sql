-- Create table for storing Neural Network weights
CREATE TABLE IF NOT EXISTS model_weights (
  id TEXT PRIMARY KEY, -- 'active_model'
  weights JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  generation INTEGER DEFAULT 0
);

-- Create table for the background scraping queue
CREATE TABLE IF NOT EXISTS scraping_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain TEXT NOT NULL,
  status TEXT DEFAULT 'pending', -- pending, processing, completed, failed
  result JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add RLS policies (assuming public access for now for simplicity, or authenticated)
ALTER TABLE model_weights ENABLE ROW LEVEL SECURITY;
ALTER TABLE scraping_queue ENABLE ROW LEVEL SECURITY;

-- Allow read/write for authenticated users (admins)
CREATE POLICY "Allow full access to model_weights for authenticated users"
ON model_weights
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow full access to scraping_queue for authenticated users"
ON scraping_queue
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);
