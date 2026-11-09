
CREATE TABLE IF NOT EXISTS business_leads (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name  text        NOT NULL,
  contact_person text       NOT NULL,
  phone         text        NOT NULL,
  email         text        NOT NULL,
  city          text        NOT NULL,
  created_at    timestamptz DEFAULT now()
);

ALTER TABLE business_leads ENABLE ROW LEVEL SECURITY;

-- Anyone (anon) may submit a lead — no reading back
CREATE POLICY "insert_business_leads"
  ON business_leads FOR INSERT TO anon
  WITH CHECK (true);
