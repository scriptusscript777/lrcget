ALTER TABLE config_data ADD COLUMN export_elrc INTEGER NOT NULL DEFAULT 0 CHECK (export_elrc IN (0, 1));
