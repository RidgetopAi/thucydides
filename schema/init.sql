-- Thucydides Research Platform - Database Schema
-- Supports multiple research modes: history, skills, polymarket
-- Run: ssh hetzner "sudo -u postgres psql -d thucydides < /tmp/init.sql"

-- Entities: people, organizations, events, technologies, skills, methodologies, etc.
CREATE TABLE IF NOT EXISTS entities (
    id SERIAL PRIMARY KEY,
    mode VARCHAR(50) DEFAULT 'history',        -- research mode: history, skills, polymarket
    type VARCHAR(50) NOT NULL,
    name VARCHAR(500) NOT NULL,
    aliases TEXT[],
    description TEXT,
    metadata JSONB,
    topic VARCHAR(200),
    run_name VARCHAR(200),
    shift_discovered INT,
    discovered_by VARCHAR(50),
    confidence FLOAT DEFAULT 0.5,
    challenged BOOLEAN DEFAULT FALSE,
    challenge_outcome VARCHAR(50),          -- accepted, qualified, disputed, investigate
    dispute_note TEXT,                       -- if disputed: what both sides argue
    dispute_status VARCHAR(50),              -- open, investigating, resolved
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(type, name, topic, mode)
);

-- Relationships: connections between entities
CREATE TABLE IF NOT EXISTS relationships (
    id SERIAL PRIMARY KEY,
    mode VARCHAR(50) DEFAULT 'history',
    from_entity_id INT REFERENCES entities(id) ON DELETE CASCADE,
    to_entity_id INT REFERENCES entities(id) ON DELETE CASCADE,
    type VARCHAR(100) NOT NULL,
    description TEXT,
    period VARCHAR(100),
    metadata JSONB,
    topic VARCHAR(200),
    run_name VARCHAR(200),
    shift_discovered INT,
    discovered_by VARCHAR(50),
    confidence FLOAT DEFAULT 0.5,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Sources: provenance tracking
CREATE TABLE IF NOT EXISTS sources (
    id SERIAL PRIMARY KEY,
    mode VARCHAR(50) DEFAULT 'history',
    url TEXT,
    title VARCHAR(500),
    type VARCHAR(50),
    author VARCHAR(500),
    publication_date VARCHAR(100),
    agent VARCHAR(50),
    description TEXT,
    reliability FLOAT DEFAULT 0.5,
    topic VARCHAR(200),
    run_name VARCHAR(200),
    shift_discovered INT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Entity-source links (provenance chain)
CREATE TABLE IF NOT EXISTS entity_sources (
    entity_id INT REFERENCES entities(id) ON DELETE CASCADE,
    source_id INT REFERENCES sources(id) ON DELETE CASCADE,
    claim TEXT,
    PRIMARY KEY (entity_id, source_id)
);

-- Threads: open lines of inquiry
CREATE TABLE IF NOT EXISTS threads (
    id SERIAL PRIMARY KEY,
    mode VARCHAR(50) DEFAULT 'history',
    title VARCHAR(500) NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'open',
    priority VARCHAR(50) DEFAULT 'medium',
    opened_by VARCHAR(50),
    opened_shift INT,
    resolved_shift INT,
    resolution TEXT,
    topic VARCHAR(200),
    run_name VARCHAR(200),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Shift reports: the handoff record
CREATE TABLE IF NOT EXISTS shift_reports (
    id SERIAL PRIMARY KEY,
    mode VARCHAR(50) DEFAULT 'history',
    run_name VARCHAR(200) NOT NULL,
    shift_number INT NOT NULL,
    topic VARCHAR(200),
    summary TEXT,
    new_entities INT DEFAULT 0,
    new_relationships INT DEFAULT 0,
    new_sources INT DEFAULT 0,
    threads_opened TEXT[],
    threads_progressed TEXT[],
    threads_resolved TEXT[],
    jester_challenges JSONB,
    key_findings TEXT,
    next_priorities TEXT,
    agent_reports JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(run_name, shift_number)
);

-- Cross-topic connections (bridges entities across topics AND modes)
CREATE TABLE IF NOT EXISTS cross_connections (
    id SERIAL PRIMARY KEY,
    entity_id_1 INT REFERENCES entities(id) ON DELETE CASCADE,
    entity_id_2 INT REFERENCES entities(id) ON DELETE CASCADE,
    mode_1 VARCHAR(50),
    mode_2 VARCHAR(50),
    topic_1 VARCHAR(200),
    topic_2 VARCHAR(200),
    connection_type VARCHAR(100),
    description TEXT,
    discovered_shift INT,
    run_name VARCHAR(200),
    confidence FLOAT DEFAULT 0.5,
    created_at TIMESTAMP DEFAULT NOW()
);

-- =============================================================================
-- PREDICTIONS SYSTEM (used by polymarket mode, designed now for future use)
-- =============================================================================

-- Predictions: individual prediction market positions
CREATE TABLE IF NOT EXISTS predictions (
    id SERIAL PRIMARY KEY,
    mode VARCHAR(50) DEFAULT 'polymarket',
    topic VARCHAR(200),                         -- research topic that informed this
    market_id VARCHAR(500),                     -- polymarket slug or external ID
    market_url TEXT,                            -- link to the market
    question TEXT NOT NULL,                     -- what are we predicting?
    category VARCHAR(100),                      -- politics, crypto, sports, science, tech, etc.
    prediction_probability FLOAT NOT NULL,      -- our predicted probability (0.0-1.0)
    market_probability FLOAT,                   -- market price at time of prediction
    edge FLOAT,                                 -- prediction_probability - market_probability
    confidence_reasoning TEXT,                  -- WHY this probability (detailed)
    methodology_used TEXT[],                    -- which skills-mode findings informed this
    information_sources INT[],                  -- entity_ids from research that informed this
    base_rate FLOAT,                            -- historical base rate for this type of event
    base_rate_source TEXT,                      -- where did we get the base rate
    bet_size FLOAT,                             -- amount wagered (if any)
    bet_price FLOAT,                            -- price paid per share
    potential_payout FLOAT,                     -- max payout if correct
    status VARCHAR(50) DEFAULT 'active',        -- active, resolved, cancelled, expired
    predicted_at TIMESTAMP DEFAULT NOW(),
    resolves_at TIMESTAMP,                      -- when market resolves
    resolved_at TIMESTAMP,                      -- when actually resolved
    resolution_source TEXT,                     -- how resolution was determined
    actual_outcome BOOLEAN,                     -- true/false (did it happen?)
    run_name VARCHAR(200),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Prediction outcomes: post-resolution analysis
CREATE TABLE IF NOT EXISTS prediction_outcomes (
    id SERIAL PRIMARY KEY,
    prediction_id INT REFERENCES predictions(id) ON DELETE CASCADE,
    outcome VARCHAR(50) NOT NULL,               -- correct, incorrect, partial, cancelled
    profit_loss FLOAT,                          -- actual P&L
    brier_score FLOAT,                          -- (prediction - outcome)^2
    lessons_learned TEXT,                        -- what did we learn?
    what_was_missed TEXT,                        -- what information did we not have?
    what_worked TEXT,                            -- what reasoning was correct?
    surprise_factor FLOAT,                      -- how surprised were we? (0=expected, 1=total surprise)
    calibration_bucket VARCHAR(20),             -- 0-10, 10-20, 20-30, ..., 90-100
    methodology_effective BOOLEAN,              -- did the methodology we used work?
    methodology_notes TEXT,                     -- details on methodology effectiveness
    created_at TIMESTAMP DEFAULT NOW()
);

-- Calibration scores: periodic accuracy tracking
CREATE TABLE IF NOT EXISTS calibration_scores (
    id SERIAL PRIMARY KEY,
    period_type VARCHAR(20) NOT NULL,           -- weekly, monthly, quarterly
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    total_predictions INT DEFAULT 0,
    total_resolved INT DEFAULT 0,
    correct_predictions INT DEFAULT 0,
    accuracy FLOAT,                             -- correct / resolved
    brier_score_avg FLOAT,                      -- average brier score (lower = better)
    log_score_avg FLOAT,                        -- average log score
    profit_loss_total FLOAT DEFAULT 0,
    profit_loss_by_category JSONB,              -- {"politics": 150, "crypto": -50, ...}
    accuracy_by_bucket JSONB,                   -- {"0-10": {predicted: 5, actual: 0.8}, ...}
    strongest_categories TEXT[],                -- categories where we perform best
    weakest_categories TEXT[],                  -- categories where we perform worst
    methodology_correlations JSONB,             -- which skills findings correlated with success
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- =============================================================================
-- INDEXES
-- =============================================================================

-- Entity indexes
CREATE INDEX IF NOT EXISTS idx_entities_type ON entities(type);
CREATE INDEX IF NOT EXISTS idx_entities_topic ON entities(topic);
CREATE INDEX IF NOT EXISTS idx_entities_name ON entities(name);
CREATE INDEX IF NOT EXISTS idx_entities_run ON entities(run_name);
CREATE INDEX IF NOT EXISTS idx_entities_mode ON entities(mode);

-- Relationship indexes
CREATE INDEX IF NOT EXISTS idx_relationships_type ON relationships(type);
CREATE INDEX IF NOT EXISTS idx_relationships_topic ON relationships(topic);
CREATE INDEX IF NOT EXISTS idx_relationships_from ON relationships(from_entity_id);
CREATE INDEX IF NOT EXISTS idx_relationships_to ON relationships(to_entity_id);
CREATE INDEX IF NOT EXISTS idx_relationships_mode ON relationships(mode);

-- Source indexes
CREATE INDEX IF NOT EXISTS idx_sources_agent ON sources(agent);
CREATE INDEX IF NOT EXISTS idx_sources_topic ON sources(topic);
CREATE INDEX IF NOT EXISTS idx_sources_mode ON sources(mode);

-- Thread indexes
CREATE INDEX IF NOT EXISTS idx_threads_status ON threads(status);
CREATE INDEX IF NOT EXISTS idx_threads_topic ON threads(topic);
CREATE INDEX IF NOT EXISTS idx_threads_mode ON threads(mode);

-- Shift report indexes
CREATE INDEX IF NOT EXISTS idx_shift_reports_run ON shift_reports(run_name);
CREATE INDEX IF NOT EXISTS idx_shift_reports_mode ON shift_reports(mode);

-- Cross-connection indexes
CREATE INDEX IF NOT EXISTS idx_cross_connections_topics ON cross_connections(topic_1, topic_2);
CREATE INDEX IF NOT EXISTS idx_cross_connections_modes ON cross_connections(mode_1, mode_2);

-- Prediction indexes
CREATE INDEX IF NOT EXISTS idx_predictions_status ON predictions(status);
CREATE INDEX IF NOT EXISTS idx_predictions_category ON predictions(category);
CREATE INDEX IF NOT EXISTS idx_predictions_mode ON predictions(mode);
CREATE INDEX IF NOT EXISTS idx_predictions_market ON predictions(market_id);
CREATE INDEX IF NOT EXISTS idx_prediction_outcomes_prediction ON prediction_outcomes(prediction_id);
CREATE INDEX IF NOT EXISTS idx_calibration_period ON calibration_scores(period_type, period_start);
