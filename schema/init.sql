-- Thucydides Research Platform - Database Schema
-- Run: ssh hetzner "sudo -u postgres psql -d thucydides < /tmp/init.sql"

-- Entities: people, organizations, events, technologies, patents, programs
CREATE TABLE IF NOT EXISTS entities (
    id SERIAL PRIMARY KEY,
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
    UNIQUE(type, name, topic)
);

-- Relationships: connections between entities
CREATE TABLE IF NOT EXISTS relationships (
    id SERIAL PRIMARY KEY,
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

-- Cross-topic connections
CREATE TABLE IF NOT EXISTS cross_connections (
    id SERIAL PRIMARY KEY,
    entity_id_1 INT REFERENCES entities(id) ON DELETE CASCADE,
    entity_id_2 INT REFERENCES entities(id) ON DELETE CASCADE,
    topic_1 VARCHAR(200),
    topic_2 VARCHAR(200),
    connection_type VARCHAR(100),
    description TEXT,
    discovered_shift INT,
    run_name VARCHAR(200),
    confidence FLOAT DEFAULT 0.5,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_entities_type ON entities(type);
CREATE INDEX IF NOT EXISTS idx_entities_topic ON entities(topic);
CREATE INDEX IF NOT EXISTS idx_entities_name ON entities(name);
CREATE INDEX IF NOT EXISTS idx_entities_run ON entities(run_name);
CREATE INDEX IF NOT EXISTS idx_relationships_type ON relationships(type);
CREATE INDEX IF NOT EXISTS idx_relationships_topic ON relationships(topic);
CREATE INDEX IF NOT EXISTS idx_relationships_from ON relationships(from_entity_id);
CREATE INDEX IF NOT EXISTS idx_relationships_to ON relationships(to_entity_id);
CREATE INDEX IF NOT EXISTS idx_sources_agent ON sources(agent);
CREATE INDEX IF NOT EXISTS idx_sources_topic ON sources(topic);
CREATE INDEX IF NOT EXISTS idx_threads_status ON threads(status);
CREATE INDEX IF NOT EXISTS idx_threads_topic ON threads(topic);
CREATE INDEX IF NOT EXISTS idx_shift_reports_run ON shift_reports(run_name);
CREATE INDEX IF NOT EXISTS idx_cross_connections_topics ON cross_connections(topic_1, topic_2);
