ALTER TABLE config_data ADD COLUMN prevent_lyric_overlaps INTEGER NOT NULL DEFAULT 1 CHECK (prevent_lyric_overlaps IN (0, 1));
