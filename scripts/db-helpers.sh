#!/bin/bash
# Thucydides DB Helper Scripts
# Usage: source this file, then call functions
# All functions execute via SSH to VPS PostgreSQL

THUC_DB="thucydides"
THUC_USER="mandrel"
THUC_HOST="localhost"

# Base query function - runs SQL on VPS and returns result
thuc_query() {
    local sql="$1"
    ssh hetzner "PGPASSWORD=mandrel psql -U $THUC_USER -h $THUC_HOST -d $THUC_DB -t -A -c \"$sql\""
}

# Insert entity - returns entity ID
# Usage: thuc_insert_entity "person" "William Shockley" "Physicist" "transistor-history" "run-v1" 1 "scholar" 0.9
thuc_insert_entity() {
    local type="$1" name="$2" description="$3" topic="$4" run_name="$5" shift="$6" agent="$7" confidence="$8"
    # Escape single quotes in text fields
    name="${name//\'/\'\'}"
    description="${description//\'/\'\'}"
    local sql="INSERT INTO entities (type, name, description, topic, run_name, shift_discovered, discovered_by, confidence) VALUES ('$type', '$name', '$description', '$topic', '$run_name', $shift, '$agent', $confidence) ON CONFLICT (type, name, topic) DO UPDATE SET description = EXCLUDED.description, confidence = GREATEST(entities.confidence, EXCLUDED.confidence), updated_at = NOW() RETURNING id;"
    thuc_query "$sql"
}

# Insert relationship - returns relationship ID
# Usage: thuc_insert_relationship entity_from_id entity_to_id "employed-by" "1945-1951" "description" "topic" "run" 1 "scholar" 0.9
thuc_insert_relationship() {
    local from_id="$1" to_id="$2" type="$3" period="$4" description="$5" topic="$6" run_name="$7" shift="$8" agent="$9" confidence="${10}"
    description="${description//\'/\'\'}"
    local sql="INSERT INTO relationships (from_entity_id, to_entity_id, type, period, description, topic, run_name, shift_discovered, discovered_by, confidence) VALUES ($from_id, $to_id, '$type', '$period', '$description', '$topic', '$run_name', $shift, '$agent', $confidence) RETURNING id;"
    thuc_query "$sql"
}

# Insert source - returns source ID
# Usage: thuc_insert_source "https://..." "Title" "academic" "Author" "1947" "scholar" "Description" 0.9 "topic" "run" 1
thuc_insert_source() {
    local url="$1" title="$2" type="$3" author="$4" pub_date="$5" agent="$6" description="$7" reliability="$8" topic="$9" run_name="${10}" shift="${11}"
    url="${url//\'/\'\'}"
    title="${title//\'/\'\'}"
    author="${author//\'/\'\'}"
    description="${description//\'/\'\'}"
    local sql="INSERT INTO sources (url, title, type, author, publication_date, agent, description, reliability, topic, run_name, shift_discovered) VALUES ('$url', '$title', '$type', '$author', '$pub_date', '$agent', '$description', $reliability, '$topic', '$run_name', $shift) RETURNING id;"
    thuc_query "$sql"
}

# Link entity to source
# Usage: thuc_link_entity_source entity_id source_id "specific claim text"
thuc_link_entity_source() {
    local entity_id="$1" source_id="$2" claim="$3"
    claim="${claim//\'/\'\'}"
    local sql="INSERT INTO entity_sources (entity_id, source_id, claim) VALUES ($entity_id, $source_id, '$claim') ON CONFLICT DO NOTHING;"
    thuc_query "$sql"
}

# Open a thread
# Usage: thuc_open_thread "Title" "Description" "high" "scholar" 1 "topic" "run"
thuc_open_thread() {
    local title="$1" description="$2" priority="$3" agent="$4" shift="$5" topic="$6" run_name="$7"
    title="${title//\'/\'\'}"
    description="${description//\'/\'\'}"
    local sql="INSERT INTO threads (title, description, priority, opened_by, opened_shift, topic, run_name) VALUES ('$title', '$description', '$priority', '$agent', $shift, '$topic', '$run_name') RETURNING id;"
    thuc_query "$sql"
}

# Update thread status
# Usage: thuc_update_thread thread_id "investigating" 2 "resolution text"
thuc_update_thread() {
    local thread_id="$1" status="$2" shift="$3" resolution="$4"
    resolution="${resolution//\'/\'\'}"
    local sql="UPDATE threads SET status = '$status', resolved_shift = $shift, resolution = '$resolution', updated_at = NOW() WHERE id = $thread_id;"
    thuc_query "$sql"
}

# Mark entity as challenged by Jester
# Usage: thuc_challenge_entity entity_id "upheld|revised|withdrawn"
thuc_challenge_entity() {
    local entity_id="$1" outcome="$2"
    local sql="UPDATE entities SET challenged = TRUE, challenge_outcome = '$outcome', updated_at = NOW() WHERE id = $entity_id;"
    thuc_query "$sql"
}

# Write shift report
# Usage: thuc_write_shift_report "run" 1 "topic" "summary" 5 3 4 "key findings" "next priorities"
thuc_write_shift_report() {
    local run_name="$1" shift="$2" topic="$3" summary="$4" new_ent="$5" new_rel="$6" new_src="$7" findings="$8" next="$9"
    summary="${summary//\'/\'\'}"
    findings="${findings//\'/\'\'}"
    next="${next//\'/\'\'}"
    local sql="INSERT INTO shift_reports (run_name, shift_number, topic, summary, new_entities, new_relationships, new_sources, key_findings, next_priorities) VALUES ('$run_name', $shift, '$topic', '$summary', $new_ent, $new_rel, $new_src, '$findings', '$next') ON CONFLICT (run_name, shift_number) DO UPDATE SET summary = EXCLUDED.summary, new_entities = EXCLUDED.new_entities, new_relationships = EXCLUDED.new_relationships, new_sources = EXCLUDED.new_sources, key_findings = EXCLUDED.key_findings, next_priorities = EXCLUDED.next_priorities RETURNING id;"
    thuc_query "$sql"
}

# Look up entity ID by name and topic
# Usage: thuc_find_entity "William Shockley" "transistor-history"
thuc_find_entity() {
    local name="$1" topic="$2"
    name="${name//\'/\'\'}"
    local sql="SELECT id FROM entities WHERE name = '$name' AND topic = '$topic' LIMIT 1;"
    thuc_query "$sql"
}

# Get open threads for a topic
# Usage: thuc_get_open_threads "transistor-history"
thuc_get_open_threads() {
    local topic="$1"
    local sql="SELECT id, title, priority, description FROM threads WHERE topic = '$topic' AND status IN ('open', 'investigating') ORDER BY CASE priority WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 WHEN 'low' THEN 4 END;"
    thuc_query "$sql"
}

# Get entity count for a topic
# Usage: thuc_entity_count "transistor-history"
thuc_entity_count() {
    local topic="$1"
    local sql="SELECT type, COUNT(*) FROM entities WHERE topic = '$topic' GROUP BY type ORDER BY count DESC;"
    thuc_query "$sql"
}

# Get current state summary for a topic (for shift start)
thuc_topic_summary() {
    local topic="$1"
    echo "=== Entities ==="
    thuc_query "SELECT type, COUNT(*) as cnt FROM entities WHERE topic = '$topic' GROUP BY type ORDER BY cnt DESC;"
    echo "=== Relationships ==="
    thuc_query "SELECT type, COUNT(*) as cnt FROM relationships WHERE topic = '$topic' GROUP BY type ORDER BY cnt DESC;"
    echo "=== Open Threads ==="
    thuc_query "SELECT priority, title FROM threads WHERE topic = '$topic' AND status IN ('open', 'investigating') ORDER BY CASE priority WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 WHEN 'low' THEN 4 END;"
    echo "=== Last Shift Report ==="
    thuc_query "SELECT shift_number, summary, next_priorities FROM shift_reports WHERE topic = '$topic' ORDER BY shift_number DESC LIMIT 1;"
}

# Batch SQL execution - for running multiple inserts in one SSH call
# Usage: thuc_batch "SQL statement 1; SQL statement 2; ..."
thuc_batch() {
    local sql="$1"
    ssh hetzner "PGPASSWORD=mandrel psql -U $THUC_USER -h $THUC_HOST -d $THUC_DB -c \"$sql\""
}

echo "Thucydides DB helpers loaded. Functions available:"
echo "  thuc_insert_entity, thuc_insert_relationship, thuc_insert_source"
echo "  thuc_link_entity_source, thuc_open_thread, thuc_update_thread"
echo "  thuc_challenge_entity, thuc_write_shift_report"
echo "  thuc_find_entity, thuc_get_open_threads, thuc_entity_count"
echo "  thuc_topic_summary, thuc_batch, thuc_query"
