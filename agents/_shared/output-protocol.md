# Shared Output Protocol

All research agents (Scholar, Digger, Archivist) across ALL modes use this structured output format. One item per line. Use `|` as delimiter.

## Output Lines

```
ENTITY|type|name|description|confidence
RELATIONSHIP|from_name|to_name|rel_type|period|description|confidence
SOURCE|url_or_citation|title|source_type|description|reliability
THREAD|title|description|priority
CLAIM|entity_or_rel_description|source_title|specific_claim_text
```

## Jester Output Lines

```
CHALLENGE|claim_summary|challenge_text|severity|search_performed
ASSESSMENT|claim_summary|strong_or_disputed_or_weak|reasoning|recommended_action
THREAD|title|description|priority
```

## Judge Output Lines

```
EVIDENCE_REVIEW|claim_summary|evidence_for|evidence_against
VERDICT|claim_summary|accepted_or_modified_or_rejected|confidence|reasoning
RECOMMENDATION|action_to_take|description
```

## Mode-Specific Entity Types

### History Mode
- **Entity types**: person, organization, event, technology, patent, program, location
- **Relationship types**: employed-by, funded-by, founded, invented, mentored, collaborated, spun-off, preceded, succeeded, contracted-with, managed, advised, patented, published, rivaled, conflicted-with, influenced

### Skills Mode
- **Entity types**: skill, practitioner, methodology, framework, habit, outcome, metric, cognitive_bias, decision_pattern, feedback_mechanism, study, dataset
- **Relationship types**: practices, developed, mastered, teaches, requires, leads_to, correlated_with, contradicts, improves, degrades, measured_by, evidence_for, evidence_against, prerequisite_for, complementary_to, studied_by, validated_by, debunked_by

### Polymarket Mode
- **Entity types**: market, prediction, indicator, signal, analyst, resolution, category, timeframe, model, strategy
- **Relationship types**: predicts, contradicts, supports, correlates_with, informed_by, resolved_as, outperformed, underperformed, derived_from, calibrated_by

## Polymarket Trading Output Lines

Polymarket mode uses specialized agents (Scanner, Analyst, Sentinel, Contrarian, Arbiter) with trading-specific output lines:

### Scanner Output Lines
```
MARKET|slug|question|category|market_prob|volume_24h|liquidity|end_date|best_bid|best_ask
SIGNAL|market_slug|signal_type|description|strength|source
FILTER|market_slug|pass_or_reject|reason
```
- **signal_type**: news_divergence, base_rate_gap, structural_bias, volume_spike, information_asymmetry, category_pattern, resolution_edge
- **strength**: weak, moderate, strong

### Analyst Output Lines
```
ASSESSMENT|market_slug|our_probability|confidence|methodology_used|reasoning_chain
EVIDENCE|market_slug|evidence_type|description|impact_direction|magnitude|source
BASE_RATE|market_slug|reference_class|rate|source|applicability_score
BIAS_CHECK|market_slug|bias_type|risk_level|mitigation
```
- **evidence_type**: statistical, news, expert_opinion, structural, precedent, decomposition
- **impact_direction**: increases, decreases, neutral
- **magnitude**: minimal (1-3pp), moderate (3-8pp), significant (8-15pp), major (15pp+)
- **bias_type**: base_rate_neglect, overconfidence, anchoring, conjunction_fallacy, availability, pro_yes, favourite_longshot, narrative_bias

### Sentinel Output Lines
```
SIZING|market_slug|edge|kelly_full|kelly_recommended|dollar_size|max_allowed|reasoning
RISK|risk_type|current_level|threshold|action_required
PORTFOLIO|total_exposure|positions_count|by_category_json|correlation_flags|diversification_score
LIMIT|limit_type|current_value|max_value|status
```
- **risk_type**: drawdown, concentration, correlation, liquidity, execution, ruin
- **action_required**: none, warn, reduce, block
- **limit status**: ok, warning, exceeded

### Contrarian Output Lines
```
CHALLENGE|position_thesis|challenge_text|severity|search_performed
ASSESSMENT|position_thesis|strong_or_disputed_or_weak|reasoning|recommended_action
RESOLUTION_RISK|market_slug|risk_description|severity
```
(Same severity/assessment fields as Jester)

### Arbiter Output Lines

Tiebreaker mode:
```
EVIDENCE_REVIEW|position_thesis|evidence_for|evidence_against
VERDICT|position_thesis|trade_or_skip_or_reduce|confidence|reasoning
```

Post-resolution mode:
```
LESSON|market_slug|lesson_type|description|applicability
RULE_PROPOSAL|rule_type|rule_text|confidence|supporting_predictions|category_scope
AGENT_ACCURACY|market_slug|agent_name|accuracy_rating|notes
QUALITY_SCORE|market_slug|score|justification
```
- **lesson_type**: methodology, bias, timing, category, resolution, sizing, information_gap
- **applicability**: specific, category, universal
- **accuracy_rating**: excellent, good, fair, poor

## Shared Fields

- **Priority** (threads): low, medium, high, critical
- **Confidence/Reliability**: 0.0 to 1.0
- **Severity** (jester): minor, moderate, serious, critical
- **Recommended Actions** (jester): accept, qualify, dispute, investigate

## Rules (All Modes)

1. Every entity MUST have at least one source (CLAIM line linking it)
2. Report what you FOUND, not what you think should exist
3. Contradictions between sources → report both + open a THREAD
4. Include more rather than less — Thucydides will filter
5. Agents return findings TO Thucydides. They do NOT write to DB or Mandrel directly.
