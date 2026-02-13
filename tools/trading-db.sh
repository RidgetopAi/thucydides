#!/bin/bash
# Trading database helper for Thucydides polymarket agents
# Eliminates SSH quoting issues by piping SQL via stdin to psql
#
# Commands:
#   portfolio                    Get full portfolio state as JSON
#   record-trade [--args]        Atomic: prediction + snapshot + lifecycle + backfill
#   record-skip [--args]         Record skip/watchlist reasoning trace
#   monitor [--args]             Record monitoring snapshot for a position
#   shift-report [--args]        Record shift report

set -euo pipefail

SSH_HOST="hetzner"
DB_CMD="sudo -u postgres psql -d thucydides -tA"

# --- Helpers ---

die() { echo "{\"error\": \"$1\"}" >&2; exit 1; }

# Escape single quotes for PostgreSQL strings
sql_escape() { echo "${1//\'/\'\'}"; }

# Pipe SQL to psql via SSH stdin — no quoting issues
run_sql() {
  printf '%s' "$1" | ssh "$SSH_HOST" "$DB_CMD" 2>/dev/null
}

# --- Commands ---

cmd_portfolio() {
  local sql
  sql="SELECT json_build_object(
    'bankroll', COALESCE((SELECT (value::text)::numeric FROM trading_config WHERE key = 'dry_run_virtual_bankroll'), 1000),
    'mode', COALESCE((SELECT value#>>'{}' FROM trading_config WHERE key = 'mode'), 'dry_run'),
    'max_bet_size', COALESCE((SELECT (value::text)::numeric FROM trading_config WHERE key = 'max_bet_size_usd'), 10),
    'kelly_fraction', COALESCE((SELECT (value::text)::numeric FROM trading_config WHERE key = 'kelly_fraction'), 0.25),
    'min_edge', COALESCE((SELECT (value::text)::numeric FROM trading_config WHERE key = 'min_edge_threshold'), 0.05),
    'max_positions', COALESCE((SELECT (value::text)::numeric FROM trading_config WHERE key = 'max_positions'), 12),
    'kill_switch', COALESCE((SELECT (value::text)::boolean FROM trading_config WHERE key = 'kill_switch'), false),
    'positions', COALESCE((
      SELECT json_agg(pos ORDER BY (pos->>'entered_shift')::int)
      FROM (
        SELECT json_build_object(
          'prediction_id', p.id,
          'market_slug', p.market_id,
          'question', p.question,
          'category', p.category,
          'side', p.position_side,
          'bet_size', p.bet_size,
          'our_prob', p.prediction_probability,
          'market_prob', p.market_probability,
          'edge', p.edge,
          'entered_shift', p.shift_number,
          'entry_price', pl.price_at_action,
          'yes_token_id', ms.market_metadata->'clob_token_ids'->>'yes',
          'no_token_id', ms.market_metadata->'clob_token_ids'->>'no',
          'latest_pnl', COALESCE(latest.unrealized_pnl, 0)
        ) as pos
        FROM predictions p
        LEFT JOIN position_lifecycle pl ON pl.prediction_id = p.id AND pl.action = 'enter'
        LEFT JOIN market_snapshots ms ON ms.prediction_id = p.id AND ms.snapshot_type = 'entry'
        LEFT JOIN LATERAL (
          SELECT unrealized_pnl FROM market_snapshots
          WHERE prediction_id = p.id ORDER BY created_at DESC LIMIT 1
        ) latest ON true
        WHERE p.mode = 'polymarket' AND p.status = 'active'
      ) sub
    ), '[]'::json),
    'total_deployed', COALESCE((SELECT SUM(bet_size) FROM predictions WHERE mode = 'polymarket' AND status = 'active'), 0),
    'unrealized_pnl', COALESCE((
      SELECT SUM(latest.pnl)
      FROM predictions p
      LEFT JOIN LATERAL (
        SELECT unrealized_pnl as pnl FROM market_snapshots
        WHERE prediction_id = p.id ORDER BY created_at DESC LIMIT 1
      ) latest ON true
      WHERE p.mode = 'polymarket' AND p.status = 'active'
    ), 0),
    'realized_pnl', COALESCE((
      SELECT SUM(profit_loss) FROM prediction_outcomes po
      JOIN predictions p ON p.id = po.prediction_id WHERE p.mode = 'polymarket'
    ), 0),
    'last_shift', COALESCE((SELECT MAX(shift_number) FROM shift_reports WHERE mode = 'polymarket'), 0),
    'strategy_rules', COALESCE((
      SELECT json_agg(json_build_object(
        'id', id, 'rule_type', rule_type, 'rule_text', rule_text,
        'confidence', confidence, 'times_applied', times_applied,
        'success_rate', success_rate
      )) FROM strategy_rules WHERE active = true
    ), '[]'::json)
  );"

  local result
  result=$(run_sql "$sql") || die "Failed to query portfolio"
  echo "$result" | jq '.'
}

cmd_record_trade() {
  local slug="" question="" category="" our_prob="" market_prob=""
  local bet_size="" side="" reasoning="" yes_token="" no_token=""
  local shift="" kelly_frac="0.25" run_name="trading-v1"

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --slug) slug="$2"; shift 2 ;;
      --question) question="$2"; shift 2 ;;
      --category) category="$2"; shift 2 ;;
      --our-prob) our_prob="$2"; shift 2 ;;
      --market-prob) market_prob="$2"; shift 2 ;;
      --bet-size) bet_size="$2"; shift 2 ;;
      --side) side="$2"; shift 2 ;;
      --reasoning) reasoning="$2"; shift 2 ;;
      --yes-token) yes_token="$2"; shift 2 ;;
      --no-token) no_token="$2"; shift 2 ;;
      --shift) shift="$2"; shift 2 ;;
      --kelly-frac) kelly_frac="$2"; shift 2 ;;
      --run-name) run_name="$2"; shift 2 ;;
      *) shift ;;
    esac
  done

  [[ -z "$slug" ]] && die "Missing --slug"
  [[ -z "$our_prob" ]] && die "Missing --our-prob"
  [[ -z "$market_prob" ]] && die "Missing --market-prob"
  [[ -z "$bet_size" ]] && die "Missing --bet-size"
  [[ -z "$shift" ]] && die "Missing --shift"

  # Escape strings for SQL
  local s_slug s_question s_category s_reasoning s_side s_run
  s_slug=$(sql_escape "$slug")
  s_question=$(sql_escape "${question:-$slug}")
  s_category=$(sql_escape "${category:-uncategorized}")
  s_reasoning=$(sql_escape "${reasoning:-}")
  s_side=$(sql_escape "${side:-YES}")
  s_run=$(sql_escape "$run_name")

  # Step 1: Insert prediction, get ID back
  local pred_sql="INSERT INTO predictions (
    mode, market_id, question, category,
    prediction_probability, market_probability, edge,
    confidence_reasoning, bet_size, bet_price, position_side,
    status, shift_number, run_name, predicted_at
  ) VALUES (
    'polymarket', '${s_slug}', '${s_question}', '${s_category}',
    ${our_prob}, ${market_prob}, ${our_prob} - ${market_prob},
    '${s_reasoning}', ${bet_size}, ${market_prob}, '${s_side}',
    'active', ${shift}, '${s_run}', NOW()
  ) RETURNING id;"

  local pred_id
  pred_id=$(run_sql "$pred_sql" | head -1 | tr -d ' \n\r') || die "Failed to insert prediction"
  [[ -z "$pred_id" ]] && die "No prediction ID returned"

  # Step 2: Insert snapshot + lifecycle + backfill assessments
  local link_sql="
    INSERT INTO market_snapshots (
      prediction_id, market_slug, snapshot_type,
      market_probability, our_position_size, unrealized_pnl,
      market_metadata, created_at
    ) VALUES (
      ${pred_id}, '${s_slug}', 'entry',
      ${market_prob}, ${bet_size}, 0,
      '{\"clob_token_ids\": {\"yes\": \"${yes_token}\", \"no\": \"${no_token}\"}}'::jsonb,
      NOW()
    );

    INSERT INTO position_lifecycle (
      prediction_id, action, action_reason,
      size_before, size_after, price_at_action,
      market_prob_at_action, our_prob_at_action, edge_at_action,
      kelly_fraction_used, trigger, shift_number, run_name
    ) VALUES (
      ${pred_id}, 'enter', '${s_reasoning}',
      0, ${bet_size}, ${market_prob},
      ${market_prob}, ${our_prob}, ${our_prob} - ${market_prob},
      ${kelly_frac}, 'new_analysis', ${shift}, '${s_run}'
    );

    UPDATE agent_assessments SET prediction_id = ${pred_id}
    WHERE market_slug = '${s_slug}' AND prediction_id IS NULL;"

  run_sql "$link_sql" || die "Failed to link prediction ${pred_id}"

  echo "{\"prediction_id\": ${pred_id}, \"market_slug\": \"${slug}\", \"bet_size\": ${bet_size}}"
}

cmd_record_skip() {
  local slug="" decision="skip" reasoning="" shift="" market_prob=""
  local our_prob="" run_name="trading-v1"
  local question="" category="" side="" bet_size="" yes_token="" no_token=""

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --slug) slug="$2"; shift 2 ;;
      --decision) decision="$2"; shift 2 ;;
      --reasoning) reasoning="$2"; shift 2 ;;
      --shift) shift="$2"; shift 2 ;;
      --market-prob) market_prob="$2"; shift 2 ;;
      --our-prob) our_prob="$2"; shift 2 ;;
      --run-name) run_name="$2"; shift 2 ;;
      --question) question="$2"; shift 2 ;;
      --category) category="$2"; shift 2 ;;
      --side) side="$2"; shift 2 ;;
      --bet-size) bet_size="$2"; shift 2 ;;
      --yes-token) yes_token="$2"; shift 2 ;;
      --no-token) no_token="$2"; shift 2 ;;
      *) shift ;;
    esac
  done

  [[ -z "$slug" ]] && die "Missing --slug"
  [[ -z "$shift" ]] && die "Missing --shift"

  local s_slug s_decision s_reasoning s_run s_question
  s_slug=$(sql_escape "$slug")
  s_decision=$(sql_escape "$decision")
  s_reasoning=$(sql_escape "${reasoning:-No edge found}")
  s_run=$(sql_escape "$run_name")
  s_question=$(sql_escape "${question:-$slug}")

  local sql="INSERT INTO reasoning_traces (
    trace_type, phase, decision, decision_reasoning,
    confidence_at_decision,
    input_context, reasoning_steps,
    shift_number, run_name, created_at
  ) VALUES (
    'pre_trade', 'decision', '${s_decision}', '${s_reasoning}',
    0,
    '{\"market\": {\"slug\": \"${s_slug}\", \"question\": \"${s_question}\", \"probability\": ${market_prob:-0}, \"liquidity\": 0}}'::jsonb,
    '[]'::jsonb,
    ${shift}, '${s_run}', NOW()
  ) RETURNING id;"

  local trace_id
  trace_id=$(run_sql "$sql" | head -1 | tr -d ' \n\r') || die "Failed to insert reasoning trace"

  # If position data provided (--side), also create a shadow prediction for counterfactual tracking
  local shadow_id=""
  if [[ -n "$side" && -n "$our_prob" && -n "$market_prob" ]]; then
    local s_category s_side
    s_category=$(sql_escape "${category:-uncategorized}")
    s_side=$(sql_escape "$side")
    local shadow_bet="${bet_size:-5}"

    local shadow_sql="INSERT INTO predictions (
      mode, market_id, question, category,
      prediction_probability, market_probability, edge,
      confidence_reasoning, bet_size, bet_price, position_side,
      status, shift_number, run_name, predicted_at
    ) VALUES (
      'polymarket', '${s_slug}', '${s_question}', '${s_category}',
      ${our_prob}, ${market_prob}, ${our_prob} - ${market_prob},
      '${s_reasoning}', ${shadow_bet}, ${market_prob}, '${s_side}',
      'shadow', ${shift}, '${s_run}', NOW()
    ) RETURNING id;"

    shadow_id=$(run_sql "$shadow_sql" | head -1 | tr -d ' \n\r') || die "Failed to insert shadow prediction"

    # Create entry snapshot so cron can track this market, and link reasoning trace
    local snap_sql="INSERT INTO market_snapshots (
      prediction_id, market_slug, snapshot_type,
      market_probability, our_position_size, unrealized_pnl,
      market_metadata, created_at
    ) VALUES (
      ${shadow_id}, '${s_slug}', 'entry',
      ${market_prob}, ${shadow_bet}, 0,
      '{\"clob_token_ids\": {\"yes\": \"${yes_token}\", \"no\": \"${no_token}\"}}'::jsonb,
      NOW()
    );"

    run_sql "$snap_sql" > /dev/null || die "Failed to create shadow snapshot"

    if [[ -n "$trace_id" ]]; then
      local link_sql="UPDATE reasoning_traces SET prediction_id = ${shadow_id} WHERE id = ${trace_id};"
      run_sql "$link_sql" > /dev/null || true
    fi
  fi

  if [[ -n "$shadow_id" ]]; then
    echo "{\"trace_id\": ${trace_id:-0}, \"shadow_prediction_id\": ${shadow_id}, \"decision\": \"${decision}\", \"market_slug\": \"${slug}\"}"
  else
    echo "{\"trace_id\": ${trace_id:-0}, \"decision\": \"${decision}\", \"market_slug\": \"${slug}\"}"
  fi
}

cmd_monitor() {
  local pred_id="" slug="" current_prob="" our_size="" pnl=""
  local edge="" action="hold" action_reason="" shift=""
  local yes_token="" no_token="" our_prob="" run_name="trading-v1"

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --prediction-id) pred_id="$2"; shift 2 ;;
      --slug) slug="$2"; shift 2 ;;
      --current-prob) current_prob="$2"; shift 2 ;;
      --our-size) our_size="$2"; shift 2 ;;
      --pnl) pnl="$2"; shift 2 ;;
      --edge) edge="$2"; shift 2 ;;
      --our-prob) our_prob="$2"; shift 2 ;;
      --action) action="$2"; shift 2 ;;
      --action-reason) action_reason="$2"; shift 2 ;;
      --yes-token) yes_token="$2"; shift 2 ;;
      --no-token) no_token="$2"; shift 2 ;;
      --shift) shift="$2"; shift 2 ;;
      --run-name) run_name="$2"; shift 2 ;;
      *) shift ;;
    esac
  done

  [[ -z "$pred_id" ]] && die "Missing --prediction-id"
  [[ -z "$slug" ]] && die "Missing --slug"
  [[ -z "$current_prob" ]] && die "Missing --current-prob"
  [[ -z "$shift" ]] && die "Missing --shift"

  local s_slug s_action_reason s_action s_run
  s_slug=$(sql_escape "$slug")
  s_action=$(sql_escape "$action")
  s_action_reason=$(sql_escape "${action_reason:-Monitoring}")
  s_run=$(sql_escape "$run_name")

  local sql="
    INSERT INTO market_snapshots (
      prediction_id, market_slug, snapshot_type,
      market_probability, our_position_size, unrealized_pnl,
      market_metadata, created_at
    ) VALUES (
      ${pred_id}, '${s_slug}', 'monitoring',
      ${current_prob}, ${our_size:-0}, ${pnl:-0},
      '{\"clob_token_ids\": {\"yes\": \"${yes_token}\", \"no\": \"${no_token}\"}}'::jsonb,
      NOW()
    );

    INSERT INTO position_lifecycle (
      prediction_id, action, action_reason,
      size_before, size_after, price_at_action,
      market_prob_at_action, our_prob_at_action, edge_at_action,
      trigger, shift_number, run_name
    ) VALUES (
      ${pred_id}, '${s_action}', '${s_action_reason}',
      ${our_size:-0}, ${our_size:-0}, ${current_prob},
      ${current_prob}, ${our_prob:-0}, ${edge:-0},
      'monitoring', ${shift}, '${s_run}'
    );"

  # If action is 'exit', also close the prediction
  if [[ "$action" == "exit" ]]; then
    sql="${sql}
    UPDATE predictions SET status = 'cancelled', updated_at = NOW() WHERE id = ${pred_id};"
  fi

  run_sql "$sql" || die "Failed to record monitoring for prediction ${pred_id}"
  echo "{\"prediction_id\": ${pred_id}, \"action\": \"${action}\", \"pnl\": ${pnl:-0}}"
}

cmd_shift_report() {
  local shift="" summary="" run_name="trading-v1"
  local new_positions=0 markets_evaluated=0

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --shift) shift="$2"; shift 2 ;;
      --summary) summary="$2"; shift 2 ;;
      --run-name) run_name="$2"; shift 2 ;;
      --new-positions) new_positions="$2"; shift 2 ;;
      --markets-evaluated) markets_evaluated="$2"; shift 2 ;;
      *) shift ;;
    esac
  done

  [[ -z "$shift" ]] && die "Missing --shift"

  local s_summary s_run
  s_summary=$(sql_escape "${summary:-Shift ${shift} completed}")
  s_run=$(sql_escape "$run_name")

  local sql="INSERT INTO shift_reports (
    mode, run_name, shift_number, topic, summary,
    new_entities, new_relationships, new_sources, created_at
  ) VALUES (
    'polymarket', '${s_run}', ${shift}, 'polymarket-trading',
    '${s_summary}',
    ${new_positions}, ${markets_evaluated}, 0, NOW()
  ) ON CONFLICT (run_name, shift_number) DO UPDATE SET
    summary = EXCLUDED.summary,
    new_entities = EXCLUDED.new_entities,
    new_relationships = EXCLUDED.new_relationships
  RETURNING id;"

  local report_id
  report_id=$(run_sql "$sql" | head -1 | tr -d ' \n\r') || die "Failed to insert shift report"
  echo "{\"shift_report_id\": ${report_id}, \"shift\": ${shift}}"
}

cmd_help() {
  cat <<'EOF'
Trading Database Helper for Thucydides Polymarket Agents

USAGE:
  trading-db.sh <command> [args...]

COMMANDS:
  portfolio                          Get full portfolio state as JSON
  record-trade [--args]              Record new trade (atomic: prediction + snapshot + lifecycle)
  record-skip [--args]               Record skip/watchlist reasoning trace
  monitor [--args]                   Record monitoring snapshot + lifecycle entry
  shift-report [--args]              Record shift report

RECORD-TRADE ARGS:
  --slug <market_slug>               Market slug (required)
  --question <text>                  Market question
  --category <text>                  Market category (politics, crypto, etc.)
  --our-prob <float>                 Our probability estimate (required)
  --market-prob <float>              Market price (required)
  --bet-size <float>                 Dollar bet size (required)
  --side <YES|NO>                    Position side (default: YES)
  --reasoning <text>                 Why we're trading
  --yes-token <token_id>             CLOB YES token ID
  --no-token <token_id>              CLOB NO token ID
  --shift <int>                      Shift number (required)
  --kelly-frac <float>               Kelly fraction used (default: 0.25)

RECORD-SKIP ARGS:
  --slug <market_slug>               Market slug (required)
  --decision <skip|watchlist>        Decision type (default: skip)
  --reasoning <text>                 Why we're skipping
  --market-prob <float>              Market price
  --our-prob <float>                 Our probability estimate
  --shift <int>                      Shift number (required)
  --question <text>                  Market question (for shadow prediction)
  --category <text>                  Market category (for shadow prediction)
  --side <YES|NO>                    Position side we would have taken (triggers shadow creation)
  --bet-size <float>                 Hypothetical bet size (default: 5)
  --yes-token <token_id>             CLOB YES token ID (for shadow price tracking)
  --no-token <token_id>              CLOB NO token ID (for shadow price tracking)

MONITOR ARGS:
  --prediction-id <int>              Prediction ID (required)
  --slug <market_slug>               Market slug (required)
  --current-prob <float>             Current market price (required)
  --our-size <float>                 Position size in dollars
  --pnl <float>                      Unrealized P&L
  --edge <float>                     Current edge
  --our-prob <float>                 Our current probability estimate
  --action <hold|exit>               Action taken (default: hold)
  --action-reason <text>             Why this action
  --yes-token <token_id>             CLOB YES token ID
  --no-token <token_id>              CLOB NO token ID
  --shift <int>                      Shift number (required)

SHIFT-REPORT ARGS:
  --shift <int>                      Shift number (required)
  --summary <text>                   Shift summary
  --new-positions <int>              New positions opened
  --markets-evaluated <int>          Markets evaluated

NOTES:
  - All SQL is piped via stdin to psql (no SSH quoting issues)
  - String values are automatically escaped for SQL safety
  - record-trade is atomic: creates prediction, snapshot, lifecycle, and backfills agent_assessments
  - portfolio returns comprehensive JSON for agent brief construction
  - Output is JSON for machine consumption
EOF
}

# --- Dispatch ---

case "${1:-help}" in
  portfolio)     shift; cmd_portfolio "$@" ;;
  record-trade)  shift; cmd_record_trade "$@" ;;
  record-skip)   shift; cmd_record_skip "$@" ;;
  monitor)       shift; cmd_monitor "$@" ;;
  shift-report)  shift; cmd_shift_report "$@" ;;
  help|--help|-h) cmd_help ;;
  *)             echo "Unknown command: $1" >&2; cmd_help; exit 1 ;;
esac
