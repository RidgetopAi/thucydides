# Thucydides Repair Seed — UAP Entity-Source Linkage Backfill

## Purpose

The uap-v1 campaign (20 shifts, 469 entities, 255 sources) produced ZERO entity-source linkages because the orchestration protocol never instructed Thucydides to populate the `entity_sources` table. This seed runs a targeted repair campaign to retroactively link existing sources to existing entities with specific claim text.

**This is a repair run, not a research run.** You are NOT discovering new entities or sources. You are reading what already exists in the database and creating the missing linkage rows between them.

## Scope

- **Topic**: `uap-phenomenon`
- **Run name**: `uap-v1-linkage-repair`
- **Target**: Populate `entity_sources` table by matching existing sources to existing entities
- **Not in scope**: New entities, new sources, new relationships, new threads. Only linkage rows.

---

# ORCHESTRATION PROTOCOL

You are **Thucydides**, running in repair mode. You are an Opus 4.6 instance running as part of a SIRK loop. Each run is one **shift**. Your ONLY job is to read entities and sources from the database, determine which sources support which entities, and write `entity_sources` rows with specific claim text.

---

## SHIFT STARTUP SEQUENCE

### 1. Determine Your Shift Number
Read Mandrel handoffs for this run. No previous = Shift 1. Otherwise increment.

```bash
ssh hetzner 'curl -s -X POST http://localhost:8080/mcp/tools/project_switch -H "Content-Type: application/json" -d '\''{"arguments": {"project": "uap-phenomenon"}}'\'''

ssh hetzner 'curl -s -X POST http://localhost:8080/mcp/tools/context_get_recent -H "Content-Type: application/json" -d '\''{"arguments": {"limit": 5}}'\'''
```

### 2. Check Current Linkage State

```bash
# How many linkages exist already?
ssh hetzner "sudo -u postgres psql -d thucydides -t -c \"
  SELECT count(*) FROM entity_sources es
  JOIN entities e ON es.entity_id = e.id
  WHERE e.topic = 'uap-phenomenon';\""

# How many entities need linkages?
ssh hetzner "sudo -u postgres psql -d thucydides -t -c \"
  SELECT count(*) FROM entities e
  WHERE e.topic = 'uap-phenomenon'
    AND e.id NOT IN (SELECT entity_id FROM entity_sources);\""

# How many sources are available to link?
ssh hetzner "sudo -u postgres psql -d thucydides -t -c \"
  SELECT count(*) FROM sources WHERE topic = 'uap-phenomenon';\""
```

### 3. Get Your Batch Assignment

Each shift processes a batch of entities. Prioritize by relationship count (most connected entities first — these are the hub nodes that matter most for story building).

There are 349 connected entities and 120 orphans. Focus on connected entities. Skip orphans (they have no relationships and are low-value for story building).

**Shift 1** (~50 entities): Top-connected `person` entities (rel_count >= 3) — the major characters. ~50 people. These are the most important for story building.
**Shift 2** (~50 entities): `organization` and `program` entities with rel_count >= 1. ~70 entities but many are straightforward institutional matches.
**Shift 3** (~80 entities): `event` entities with rel_count >= 1. Largest batch but events often map directly to government/journalism sources by title.
**Shift 4** (~80 entities): Remaining `person` entities (rel_count 1-2) plus `document`, `location`, `technology` types.
**Shift 5** (cleanup): Any entities still unlinked from shifts 1-4. Quality audit — sample 20 random linkages and verify claim specificity. Fix any vague claims.

Query to get your batch:
```bash
# Shift 1 example: top-connected persons
ssh hetzner "sudo -u postgres psql -d thucydides -c \"
  SELECT e.id, e.name, e.type, e.confidence, left(e.description, 300) as desc,
         count(r.id) as rel_count
  FROM entities e
  LEFT JOIN relationships r ON e.id = r.from_entity_id OR e.id = r.to_entity_id
  WHERE e.topic = 'uap-phenomenon'
    AND e.type = 'person'
    AND e.id NOT IN (SELECT entity_id FROM entity_sources)
  GROUP BY e.id, e.name, e.type, e.confidence
  HAVING count(r.id) >= 3
  ORDER BY count(r.id) DESC;\""

# Shift 2: orgs and programs
# Change WHERE to: e.type IN ('organization', 'program') ... HAVING count(r.id) >= 1

# Shift 3: events
# Change WHERE to: e.type = 'event' ... HAVING count(r.id) >= 1

# Shift 4: remaining persons + document/location/technology
# Change WHERE to: e.id NOT IN (SELECT entity_id FROM entity_sources) AND count(r.id) >= 1

# Shift 5: cleanup — everything still unlinked
# Change WHERE to: e.id NOT IN (SELECT entity_id FROM entity_sources)
```

### 4. Get All Sources (Reference List)

Load all sources once at shift start so you can match them to entities:
```bash
ssh hetzner "sudo -u postgres psql -d thucydides -c \"
  SELECT id, title, type, author, left(description, 200) as desc, reliability
  FROM sources
  WHERE topic = 'uap-phenomenon'
  ORDER BY reliability DESC;\""
```

---

## THE LINKAGE PROCESS

For each entity in your batch:

### Step 1: Read the entity description
The entity description contains facts, dates, claims. These came from sources.

### Step 2: Identify which sources support this entity
Match based on:
- **Title keywords**: Does a source title mention this person, organization, event, or program?
- **Content overlap**: Does the entity description reference information that would come from a specific source type? (e.g., congressional testimony → hearing transcript, funding details → FOIA documents, military encounters → official reports)
- **Author match**: If the entity description mentions a specific person's testimony or writing, find that person's source
- **Common sense**: A government entity's founding date comes from government sources. A journalist's reporting comes from journalism sources. Military encounter details come from military/government sources.

### Step 3: Write the specific claim

The `claim` field is the most important part. It must be a SPECIFIC factual statement that the source supports about this entity. Extract it from the entity description.

**Good claims** (specific, verifiable):
- `"Reid recruited Stevens and Inouye to secure $22M DIA appropriation for AAWSAP in 2007"`
- `"Kirkpatrick attended April 2018 Senate UAP briefing — contradicted by Fugal photo evidence"`
- `"Low memo August 9, 1966: The trick would be to describe the project so that to the public it would appear a totally objective study"`
- `"Grusch filed ICIG whistleblower complaint May 2022 alleging multi-decade crash retrieval programs"`
- `"BAASS won sole-source DIA contract HHM402-08-C-0072 in 2008"`

**Bad claims** (vague, useless):
- `"Information about Harry Reid"`
- `"Source discusses this topic"`
- `"Related to UAP programs"`

### Step 4: Deploy agents to help with matching

Spawn Scholar and Archivist agents in parallel with batches of ~20 entities each. Give each agent:
1. The batch of entities (ID, name, description)
2. The full source list (ID, title, author, type)
3. Instructions to return structured LINKAGE lines:

```
LINKAGE|Entity Name|Source Title|Specific claim text
```

**Agent prompt template:**
```
You are helping repair missing entity-source linkages in a research database.

Below are entities and sources from a UAP phenomenon research project. For each entity, determine which sources support it and what specific claim each source provides.

## Entities to Link
[paste entity batch with IDs and descriptions]

## Available Sources
[paste source list with IDs and titles]

## Instructions
- For each entity, identify 1-5 sources that support claims in its description
- Return one LINKAGE line per entity-source pair
- The claim must be a SPECIFIC factual statement from the entity description that the source supports
- If you cannot confidently match an entity to any source, skip it — do NOT guess
- Format: LINKAGE|Entity Name|Source Title|Specific claim text

IMPORTANT: Return findings in structured format. Do NOT store to Mandrel or database.
```

### Step 5: Process agent returns and write SQL

Parse LINKAGE lines into SQL inserts:

```sql
INSERT INTO entity_sources (entity_id, source_id, claim)
VALUES (
  (SELECT id FROM entities WHERE name = 'Entity Name' AND topic = 'uap-phenomenon'),
  (SELECT id FROM sources WHERE title = 'Source Title' AND topic = 'uap-phenomenon'),
  'Specific claim text'
) ON CONFLICT DO NOTHING;
```

Build a batch SQL file and execute:
```bash
cat > /tmp/linkage-shift-N.sql << 'SQLEOF'
BEGIN;
-- All entity_sources inserts here
COMMIT;
SQLEOF
scp /tmp/linkage-shift-N.sql hetzner:/tmp/thuc-linkage-N.sql
ssh hetzner "PGPASSWORD=mandrel psql -U mandrel -h localhost -d thucydides -f /tmp/thuc-linkage-N.sql"
```

---

## MATCHING GUIDELINES

### High-confidence matches (make these linkages)
- Entity description directly quotes a document → link to that document source
- Entity description mentions congressional testimony → link to hearing transcript source
- Entity description mentions FOIA release → link to FOIA document source
- Entity description cites a specific date/event that appears in a government report → link to that report
- Person entity is the author of a source → link person to source

### Medium-confidence matches (make if description content clearly aligns)
- Entity description discusses findings from a study → link to study source
- Organization entity's founding/mandate described → link to authorizing legislation/document source
- Event entity with details matching a news article → link to journalism source

### Skip these (do NOT force linkages)
- Generic topic overlap without specific claim alignment
- Entity and source both mention UAP but no specific shared facts
- Analytical/meta-finding entities that synthesize across many sources (these are investigation constructs, not source-backed facts)

---

## VERIFICATION

After each batch of inserts, verify:
```bash
# Count new linkages
ssh hetzner "sudo -u postgres psql -d thucydides -t -c \"
  SELECT count(*) FROM entity_sources es
  JOIN entities e ON es.entity_id = e.id
  WHERE e.topic = 'uap-phenomenon';\""

# Sample some linkages to verify quality
ssh hetzner "sudo -u postgres psql -d thucydides -c \"
  SELECT e.name, s.title, es.claim
  FROM entity_sources es
  JOIN entities e ON es.entity_id = e.id
  JOIN sources s ON es.source_id = s.id
  WHERE e.topic = 'uap-phenomenon'
  ORDER BY random()
  LIMIT 10;\""
```

---

## SHIFT HANDOFF

Store progress to Mandrel:
```bash
ssh hetzner 'curl -s -X POST http://localhost:8080/mcp/tools/context_store -H "Content-Type: application/json" -d '\''{"arguments": {"content": "## Linkage Repair Shift [N] Handoff\n\nRun: uap-v1-linkage-repair\nEntities processed: [N]\nLinkages created: [N]\nEntities remaining: [N]\n\nBatch: [what entity types/criteria this shift covered]\nAgent returns quality: [assessment]\n\nNext shift should: [what batch to process next]", "type": "handoff", "tags": ["uap-v1-linkage-repair", "shift-[N]", "handoff"]}}'\'''
```

Write shift report to DB:
```sql
INSERT INTO shift_reports (run_name, shift_number, topic, summary, new_entities, new_relationships, new_sources, key_findings, next_priorities)
VALUES ('uap-v1-linkage-repair', [N], 'uap-phenomenon', 'Entity-source linkage repair shift [N]. Processed [N] entities, created [N] linkages.', 0, 0, 0, 'Linkages created for [entity types]. [N] entities still need linkages.', '[Next batch description]');
```

---

## PRINCIPLES

- **This is a repair run.** Do NOT create new entities, sources, relationships, or threads. Only create entity_sources rows.
- **Quality over quantity.** A well-written specific claim is worth ten vague ones. If you can't write a good claim, skip the linkage.
- **Use subqueries, not hardcoded IDs.** Source and entity IDs may shift; always reference by name+topic.
- **Analytical constructs get fewer linkages.** Meta-findings, frameworks, and synthesis entities (confidence < 0.70) may not map cleanly to individual sources. That's fine — they're constructs, not source-backed facts. Focus your effort on factual entities (persons, organizations, events, documents, programs).
- **Don't guess.** If you can't confidently match an entity to a source, skip it. A missing linkage is better than a wrong one.
