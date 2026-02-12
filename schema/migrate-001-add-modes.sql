-- Migration 001: Add multi-mode support + predictions system
-- Run: ssh hetzner "PGPASSWORD=mandrel psql -U mandrel -h localhost -d thucydides -f /tmp/migrate-001-add-modes.sql"

BEGIN;

-- =============================================================================
-- ADD MODE COLUMN TO EXISTING TABLES
-- =============================================================================

-- Entities
ALTER TABLE entities ADD COLUMN IF NOT EXISTS mode VARCHAR(50) DEFAULT 'history';
UPDATE entities SET mode = 'history' WHERE mode IS NULL;

-- Drop old unique constraint and add new one including mode
ALTER TABLE entities DROP CONSTRAINT IF EXISTS entities_type_name_topic_key;
ALTER TABLE entities ADD CONSTRAINT entities_type_name_topic_mode_key UNIQUE(type, name, topic, mode);

-- Relationships
ALTER TABLE relationships ADD COLUMN IF NOT EXISTS mode VARCHAR(50) DEFAULT 'history';
UPDATE relationships SET mode = 'history' WHERE mode IS NULL;

-- Sources
ALTER TABLE sources ADD COLUMN IF NOT EXISTS mode VARCHAR(50) DEFAULT 'history';
UPDATE sources SET mode = 'history' WHERE mode IS NULL;

-- Threads
ALTER TABLE threads ADD COLUMN IF NOT EXISTS mode VARCHAR(50) DEFAULT 'history';
UPDATE threads SET mode = 'history' WHERE mode IS NULL;

-- Shift reports
ALTER TABLE shift_reports ADD COLUMN IF NOT EXISTS mode VARCHAR(50) DEFAULT 'history';
UPDATE shift_reports SET mode = 'history' WHERE mode IS NULL;

-- Cross-connections: add mode fields
ALTER TABLE cross_connections ADD COLUMN IF NOT EXISTS mode_1 VARCHAR(50);
ALTER TABLE cross_connections ADD COLUMN IF NOT EXISTS mode_2 VARCHAR(50);
UPDATE cross_connections SET mode_1 = 'history', mode_2 = 'history' WHERE mode_1 IS NULL;

-- =============================================================================
-- NEW INDEXES FOR MODE
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_entities_mode ON entities(mode);
CREATE INDEX IF NOT EXISTS idx_relationships_mode ON relationships(mode);
CREATE INDEX IF NOT EXISTS idx_sources_mode ON sources(mode);
CREATE INDEX IF NOT EXISTS idx_threads_mode ON threads(mode);
CREATE INDEX IF NOT EXISTS idx_shift_reports_mode ON shift_reports(mode);
CREATE INDEX IF NOT EXISTS idx_cross_connections_modes ON cross_connections(mode_1, mode_2);

-- =============================================================================
-- PREDICTIONS SYSTEM
-- =============================================================================

CREATE TABLE IF NOT EXISTS predictions (
    id SERIAL PRIMARY KEY,
    mode VARCHAR(50) DEFAULT 'polymarket',
    topic VARCHAR(200),
    market_id VARCHAR(500),
    market_url TEXT,
    question TEXT NOT NULL,
    category VARCHAR(100),
    prediction_probability FLOAT NOT NULL,
    market_probability FLOAT,
    edge FLOAT,
    confidence_reasoning TEXT,
    methodology_used TEXT[],
    information_sources INT[],
    base_rate FLOAT,
    base_rate_source TEXT,
    bet_size FLOAT,
    bet_price FLOAT,
    potential_payout FLOAT,
    status VARCHAR(50) DEFAULT 'active',
    predicted_at TIMESTAMP DEFAULT NOW(),
    resolves_at TIMESTAMP,
    resolved_at TIMESTAMP,
    resolution_source TEXT,
    actual_outcome BOOLEAN,
    run_name VARCHAR(200),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS prediction_outcomes (
    id SERIAL PRIMARY KEY,
    prediction_id INT REFERENCES predictions(id) ON DELETE CASCADE,
    outcome VARCHAR(50) NOT NULL,
    profit_loss FLOAT,
    brier_score FLOAT,
    lessons_learned TEXT,
    what_was_missed TEXT,
    what_worked TEXT,
    surprise_factor FLOAT,
    calibration_bucket VARCHAR(20),
    methodology_effective BOOLEAN,
    methodology_notes TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS calibration_scores (
    id SERIAL PRIMARY KEY,
    period_type VARCHAR(20) NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    total_predictions INT DEFAULT 0,
    total_resolved INT DEFAULT 0,
    correct_predictions INT DEFAULT 0,
    accuracy FLOAT,
    brier_score_avg FLOAT,
    log_score_avg FLOAT,
    profit_loss_total FLOAT DEFAULT 0,
    profit_loss_by_category JSONB,
    accuracy_by_bucket JSONB,
    strongest_categories TEXT[],
    weakest_categories TEXT[],
    methodology_correlations JSONB,
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Prediction indexes
CREATE INDEX IF NOT EXISTS idx_predictions_status ON predictions(status);
CREATE INDEX IF NOT EXISTS idx_predictions_category ON predictions(category);
CREATE INDEX IF NOT EXISTS idx_predictions_mode ON predictions(mode);
CREATE INDEX IF NOT EXISTS idx_predictions_market ON predictions(market_id);
CREATE INDEX IF NOT EXISTS idx_prediction_outcomes_prediction ON prediction_outcomes(prediction_id);
CREATE INDEX IF NOT EXISTS idx_calibration_period ON calibration_scores(period_type, period_start);

COMMIT;
