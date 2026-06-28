-- ============================================
-- Dynamic QR Code System — Supabase Schema
-- Paste this into the Supabase SQL Editor
-- ============================================

-- Table 1: qr_links
-- Stores all dynamic QR code links
CREATE TABLE IF NOT EXISTS qr_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  short_code TEXT UNIQUE NOT NULL,
  destination_url TEXT NOT NULL,
  title TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index on short_code for fast lookups during redirects
CREATE INDEX IF NOT EXISTS idx_qr_links_short_code ON qr_links (short_code);

-- Table 2: scan_analytics
-- Tracks every QR code scan for analytics
CREATE TABLE IF NOT EXISTS scan_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id UUID NOT NULL REFERENCES qr_links(id) ON DELETE CASCADE,
  user_agent TEXT,
  scanned_at TIMESTAMPTZ DEFAULT now()
);

-- Index on link_id for fast aggregate queries (scan counts)
CREATE INDEX IF NOT EXISTS idx_scan_analytics_link_id ON scan_analytics (link_id);

-- Disable Row Level Security for frictionless redirects
-- The admin UI is protected by middleware-level Basic Auth instead
ALTER TABLE qr_links DISABLE ROW LEVEL SECURITY;
ALTER TABLE scan_analytics DISABLE ROW LEVEL SECURITY;
