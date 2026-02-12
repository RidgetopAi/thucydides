-- Migration 002: Polymarket Trading Agent System
-- Adds 6 new tables for trading infrastructure + training data capture
-- Run: scp /home/ridgetop/projects/thucydides/schema/migrate-002-polymarket-trading.sql hetzner:/tmp/
--      ssh hetzner "sudo -u postgres psql -d thucydides -f /tmp/migrate-002-polymarket-trading.sql"

BEGIN;

-- =============================================================================
-- ALTER EXISTING PREDICTIONS TABLE
-- =============================================================================

ALTER TABLE predictions ADD COLUMN IF NOT EXISTS execution_mode VARCHAR(20) DEFAULT 'dry_run';
ALTER TABLE predictions ADD COLUMN IF NOT EXISTS consensus_probability FLOAT;
ALTER TABLE predictions ADD COLUMN IF NOT EXISTS disagreement_score FLOAT;
ALTER TABLE predictions ADD COLUMN IF NOT EXISTS skills_entities_used INT[];
ALTER TABLE predictions ADD COLUMN IF NOT EXISTS shift_number INT;
ALTER TABLE predictions ADD COLUMN IF NOT EXISTS position_side VARCHAR(10);
ALTER TABLE predictions ADD COLUMN IF NOT EXISTS current_market_prob FLOAT;
ALTER TABLE predictions ADD COLUMN IF NOT EXISTS last_reviewed_at TIMESTAMP;

-- =============================================================================
-- TABLE 1: AGENT ASSESSMENTS
-- Each agent's individual reasoning per market (training data gold)
-- =============================================================================

CREATE TABLE IF NOT EXISTS agent_assessments (
    id SERIAL PRIMARY KEY,
    prediction_id INT REFERENCES predictions(id) ON DELETE CASCADE,
    market_slug VARCHAR(500) NOT NULL,
    agent_name VARCHAR(50) NOT NULL,
    agent_role VARCHAR(50) NOT NULL,
    assessment_type VARCHAR(50) NOT NULL,
    probability_estimate FLOAT,
    confidence FLOAT,
    reasoning_text TEXT NOT NULL,
    methodology_used TEXT[],
    skills_entities_referenced INT[],
    evidence_cited JSONB,
    biases_considered TEXT[],
    dissent_from_consensus BOOLEAN DEFAULT FALSE,
    dissent_reasoning TEXT,
    run_name VARCHAR(200),
    shift_number INT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- =============================================================================
-- TABLE 2: MARKET SNAPSHOTS
-- Market state at each decision point
-- =============================================================================

CREATE TABLE IF NOT EXISTS market_snapshots (
    id SERIAL PRIMARY KEY,
    prediction_id INT REFERENCES predictions(id) ON DELETE CASCADE,
    market_slug VARCHAR(500) NOT NULL,
    snapshot_type VARCHAR(50) NOT NULL,
    market_probability FLOAT NOT NULL,
    best_bid FLOAT,
    best_ask FLOAT,
    spread FLOAT,
    volume_24h FLOAT,
    volume_total FLOAT,
    liquidity FLOAT,
    our_position_size FLOAT,
    our_avg_price FLOAT,
    unrealized_pnl FLOAT,
    portfolio_state JSONB,
    market_metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

-- =============================================================================
-- TABLE 3: POSITION LIFECYCLE
-- Complete position history with reasoning at each action
-- =============================================================================

CREATE TABLE IF NOT EXISTS position_lifecycle (
    id SERIAL PRIMARY KEY,
    prediction_id INT REFERENCES predictions(id) ON DELETE CASCADE,
    action VARCHAR(50) NOT NULL,
    action_reason TEXT NOT NULL,
    size_before FLOAT,
    size_after FLOAT,
    price_at_action FLOAT,
    market_prob_at_action FLOAT,
    our_prob_at_action FLOAT,
    edge_at_action FLOAT,
    kelly_fraction_used FLOAT,
    trigger VARCHAR(100),
    shift_number INT,
    run_name VARCHAR(200),
    created_at TIMESTAMP DEFAULT NOW()
);

-- =============================================================================
-- TABLE 4: REASONING TRACES
-- Core training data table - complete decision episodes
-- =============================================================================

CREATE TABLE IF NOT EXISTS reasoning_traces (
    id SERIAL PRIMARY KEY,
    prediction_id INT REFERENCES predictions(id) ON DELETE CASCADE,
    trace_type VARCHAR(50) NOT NULL,
    phase VARCHAR(50) NOT NULL,
    input_context JSONB NOT NULL,
    reasoning_steps JSONB NOT NULL,
    agent_assessments_summary JSONB,
    disagreement_points JSONB,
    decision VARCHAR(50),
    decision_reasoning TEXT,
    confidence_at_decision FLOAT,
    actual_outcome BOOLEAN,
    outcome_surprise FLOAT,
    reasoning_quality_score FLOAT,
    what_was_missed TEXT,
    what_was_right TEXT,
    shift_number INT,
    run_name VARCHAR(200),
    token_count INT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- =============================================================================
-- TABLE 5: STRATEGY RULES
-- Extracted rules from outcomes (the learning loop)
-- =============================================================================

CREATE TABLE IF NOT EXISTS strategy_rules (
    id SERIAL PRIMARY KEY,
    rule_type VARCHAR(50) NOT NULL,
    rule_text TEXT NOT NULL,
    derived_from_predictions INT[],
    supporting_evidence TEXT,
    contradicting_evidence TEXT,
    confidence FLOAT DEFAULT 0.5,
    times_applied INT DEFAULT 0,
    times_successful INT DEFAULT 0,
    success_rate FLOAT,
    category_scope TEXT[],
    active BOOLEAN DEFAULT TRUE,
    superseded_by INT REFERENCES strategy_rules(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- =============================================================================
-- TABLE 6: TRADING CONFIG
-- Runtime safety limits and parameters
-- =============================================================================

CREATE TABLE IF NOT EXISTS trading_config (
    id SERIAL PRIMARY KEY,
    key VARCHAR(100) UNIQUE NOT NULL,
    value JSONB NOT NULL,
    description TEXT,
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Seed defaults
INSERT INTO trading_config (key, value, description) VALUES
    ('mode', '"dry_run"', 'Operating mode: dry_run, paper_trade, live'),
    ('max_bet_size_usd', '10', 'Maximum single position size in USD'),
    ('max_daily_exposure_usd', '50', 'Maximum new exposure per day'),
    ('max_portfolio_value_usd', '200', 'Maximum total portfolio value'),
    ('max_positions', '12', 'Maximum concurrent positions (8-12 uncorrelated pattern)'),
    ('max_category_concentration', '0.30', 'Maximum fraction of portfolio in one category'),
    ('kelly_fraction', '0.25', 'Fraction of Kelly to use (quarter-Kelly default)'),
    ('min_edge_threshold', '0.05', 'Minimum edge (our_prob - market_prob) to consider trading'),
    ('min_liquidity_usd', '5000', 'Minimum market liquidity to consider'),
    ('min_volume_24h', '1000', 'Minimum 24h volume to consider'),
    ('stop_loss_pct', '0.50', 'Exit if position loses this fraction of entry value'),
    ('max_drawdown_pct', '0.25', 'Pause all trading if portfolio draws down this fraction from peak'),
    ('kill_switch', 'false', 'Emergency stop: no new trades, no modifications'),
    ('categories_enabled', '["politics", "crypto", "science", "tech", "world"]', 'Allowed market categories'),
    ('categories_disabled', '["sports"]', 'Disallowed categories'),
    ('review_frequency_hours', '24', 'How often to review open positions'),
    ('dry_run_virtual_bankroll', '1000', 'Virtual bankroll for dry-run mode in USD')
ON CONFLICT (key) DO NOTHING;

-- =============================================================================
-- INDEXES
-- =============================================================================

-- Agent assessments
CREATE INDEX IF NOT EXISTS idx_agent_assessments_prediction ON agent_assessments(prediction_id);
CREATE INDEX IF NOT EXISTS idx_agent_assessments_market ON agent_assessments(market_slug);
CREATE INDEX IF NOT EXISTS idx_agent_assessments_agent ON agent_assessments(agent_name);
CREATE INDEX IF NOT EXISTS idx_agent_assessments_dissent ON agent_assessments(dissent_from_consensus) WHERE dissent_from_consensus = TRUE;

-- Market snapshots
CREATE INDEX IF NOT EXISTS idx_market_snapshots_prediction ON market_snapshots(prediction_id);
CREATE INDEX IF NOT EXISTS idx_market_snapshots_type ON market_snapshots(snapshot_type);
CREATE INDEX IF NOT EXISTS idx_market_snapshots_slug ON market_snapshots(market_slug);

-- Position lifecycle
CREATE INDEX IF NOT EXISTS idx_position_lifecycle_prediction ON position_lifecycle(prediction_id);
CREATE INDEX IF NOT EXISTS idx_position_lifecycle_action ON position_lifecycle(action);

-- Reasoning traces
CREATE INDEX IF NOT EXISTS idx_reasoning_traces_prediction ON reasoning_traces(prediction_id);
CREATE INDEX IF NOT EXISTS idx_reasoning_traces_type ON reasoning_traces(trace_type);
CREATE INDEX IF NOT EXISTS idx_reasoning_traces_phase ON reasoning_traces(phase);

-- Strategy rules
CREATE INDEX IF NOT EXISTS idx_strategy_rules_type ON strategy_rules(rule_type);
CREATE INDEX IF NOT EXISTS idx_strategy_rules_active ON strategy_rules(active) WHERE active = TRUE;

-- Predictions (new columns)
CREATE INDEX IF NOT EXISTS idx_predictions_execution_mode ON predictions(execution_mode);
CREATE INDEX IF NOT EXISTS idx_predictions_shift ON predictions(shift_number);

COMMIT;
