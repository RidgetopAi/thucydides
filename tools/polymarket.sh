#!/bin/bash
# Polymarket API helper for Thucydides trading agents
# Usage: polymarket.sh <command> [args...]
#
# Commands:
#   scan [--limit N]                          Discover active markets from Gamma API
#   market <slug>                             Get full event details by slug
#   price <token_id> [token_id2 ...]          Get midpoint price(s) from CLOB
#   spread <token_id>                         Get bid/ask/spread/mid from CLOB
#   book <token_id> [--depth N]               Get order book from CLOB
#   history <token_id> [--interval I] [--fidelity F]  Price history from CLOB
#   monitor <token_id1> [token_id2 ...]       Batch midpoint check for position monitoring

set -euo pipefail

GAMMA_API="https://gamma-api.polymarket.com"
CLOB_API="https://clob.polymarket.com"
CURL_TIMEOUT=15

# --- Helpers ---

die() { echo "{\"error\": \"$1\"}" >&2; exit 1; }

# Fetch URL, return body. Dies on HTTP error.
fetch() {
  local url="$1"
  local body
  local http_code
  local tmpfile
  tmpfile=$(mktemp)
  http_code=$(curl -s -o "$tmpfile" -w '%{http_code}' --max-time "$CURL_TIMEOUT" "$url" 2>/dev/null) || {
    rm -f "$tmpfile"
    die "Connection failed: $url"
  }
  body=$(cat "$tmpfile")
  rm -f "$tmpfile"
  if [[ "$http_code" -ge 400 ]]; then
    die "HTTP $http_code from $url: $(echo "$body" | head -c 200)"
  fi
  echo "$body"
}

# jq filter to parse Gamma's stringified JSON arrays
# Usage: echo "$json" | parse_gamma_markets
JQ_PARSE_GAMMA='
def parse_str: if type == "string" then (fromjson // .) else . end;

[.[] | .markets[]? // . | {
  slug: .slug,
  question: .question,
  description: ((.description // "")[:500]),
  outcomes: (.outcomes | parse_str),
  outcome_prices: (.outcomePrices | parse_str | if type == "array" then map(tonumber) else [] end),
  clob_token_ids: (.clobTokenIds | parse_str),
  volume: (.volumeNum // 0),
  volume_1wk: (.volume1wk // 0),
  spread: (.spread // null),
  end_date: .endDate,
  active: .active,
  closed: .closed,
  condition_id: .conditionId
}]'

# --- Commands ---

cmd_scan() {
  local limit=50
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --limit) limit="$2"; shift 2 ;;
      --limit=*) limit="${1#*=}"; shift ;;
      *) shift ;;
    esac
  done

  local url="${GAMMA_API}/events?active=true&closed=false&limit=${limit}"
  local raw
  raw=$(fetch "$url")
  echo "$raw" | jq "$JQ_PARSE_GAMMA"
}

cmd_market() {
  local slug="${1:?Usage: polymarket.sh market <slug>}"
  local url="${GAMMA_API}/markets?slug=${slug}"
  local raw
  raw=$(fetch "$url")

  echo "$raw" | jq '
    def parse_str: if type == "string" then (fromjson // .) else . end;
    .[0] // empty | {
      slug: .slug,
      question: .question,
      description: .description,
      outcomes: (.outcomes | parse_str),
      outcome_prices: (.outcomePrices | parse_str | if type == "array" then map(tonumber) else [] end),
      clob_token_ids: (.clobTokenIds | parse_str),
      volume: (.volumeNum // 0),
      volume_1wk: (.volume1wk // 0),
      spread: (.spread // null),
      end_date: .endDate,
      condition_id: .conditionId,
      resolution_source: .resolutionSource,
      active: .active,
      closed: .closed
    }'
}

cmd_price() {
  [[ $# -eq 0 ]] && die "Usage: polymarket.sh price <token_id> [token_id2 ...]"
  local results="[]"
  for token_id in "$@"; do
    local url="${CLOB_API}/midpoint?token_id=${token_id}"
    local raw
    raw=$(fetch "$url")
    local mid
    mid=$(echo "$raw" | jq -r '.mid // empty' 2>/dev/null)
    if [[ -z "$mid" ]]; then
      results=$(echo "$results" | jq --arg t "$token_id" '. + [{"token_id": $t, "error": "no midpoint"}]')
    else
      results=$(echo "$results" | jq --arg t "$token_id" --arg m "$mid" '. + [{"token_id": $t, "mid": ($m | tonumber)}]')
    fi
  done
  if [[ $# -eq 1 ]]; then
    echo "$results" | jq '.[0]'
  else
    echo "$results"
  fi
}

cmd_spread() {
  local token_id="${1:?Usage: polymarket.sh spread <token_id>}"

  local mid_raw buy_raw sell_raw spread_raw
  mid_raw=$(fetch "${CLOB_API}/midpoint?token_id=${token_id}")
  buy_raw=$(fetch "${CLOB_API}/price?token_id=${token_id}&side=buy")
  sell_raw=$(fetch "${CLOB_API}/price?token_id=${token_id}&side=sell")
  spread_raw=$(fetch "${CLOB_API}/spread?token_id=${token_id}")

  jq -n \
    --arg t "$token_id" \
    --argjson mid "$mid_raw" \
    --argjson buy "$buy_raw" \
    --argjson sell "$sell_raw" \
    --argjson sp "$spread_raw" \
    '{
      token_id: $t,
      mid: ($mid.mid // null | if . then tonumber else null end),
      best_bid: ($sell.price // null | if . then tonumber else null end),
      best_ask: ($buy.price // null | if . then tonumber else null end),
      spread: ($sp.spread // null | if . then tonumber else null end)
    }'
}

cmd_book() {
  local token_id=""
  local depth=0
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --depth) depth="$2"; shift 2 ;;
      --depth=*) depth="${1#*=}"; shift ;;
      *) token_id="$1"; shift ;;
    esac
  done
  [[ -z "$token_id" ]] && die "Usage: polymarket.sh book <token_id> [--depth N]"

  local raw
  raw=$(fetch "${CLOB_API}/book?token_id=${token_id}")

  local depth_filter
  if [[ "$depth" -gt 0 ]]; then
    depth_filter="
      | .bids = (.bids[:${depth}])
      | .asks = (.asks[:${depth}])"
  else
    depth_filter=""
  fi

  echo "$raw" | jq "
    {
      token_id: \"${token_id}\",
      bids: [(.bids // [])[] | {price: (.price | tonumber), size: (.size | tonumber)}],
      asks: [(.asks // [])[] | {price: (.price | tonumber), size: (.size | tonumber)}],
      bid_depth: ([(.bids // [])[] | .size | tonumber] | add // 0),
      ask_depth: ([(.asks // [])[] | .size | tonumber] | add // 0)
    }
    ${depth_filter}"
}

cmd_history() {
  local token_id=""
  local interval="1d"
  local fidelity="60"
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --interval) interval="$2"; shift 2 ;;
      --interval=*) interval="${1#*=}"; shift ;;
      --fidelity) fidelity="$2"; shift 2 ;;
      --fidelity=*) fidelity="${1#*=}"; shift ;;
      *) token_id="$1"; shift ;;
    esac
  done
  [[ -z "$token_id" ]] && die "Usage: polymarket.sh history <token_id> [--interval 1d] [--fidelity 60]"

  local url="${CLOB_API}/prices-history?market=${token_id}&interval=${interval}&fidelity=${fidelity}"
  local raw
  raw=$(fetch "$url")

  echo "$raw" | jq '{
    token_id: "'"${token_id}"'",
    interval: "'"${interval}"'",
    count: (.history | length),
    history: [.history[] | {t: .t, p: .p, time: (.t | todate)}],
    latest: (.history[-1].p // null),
    earliest: (.history[0].p // null)
  }'
}

cmd_monitor() {
  [[ $# -eq 0 ]] && die "Usage: polymarket.sh monitor <token_id1> [token_id2 ...]"
  local results="[]"
  for token_id in "$@"; do
    local url="${CLOB_API}/midpoint?token_id=${token_id}"
    local raw
    raw=$(fetch "$url") 2>/dev/null || raw='{"mid": null}'
    local mid
    mid=$(echo "$raw" | jq -r '.mid // "null"' 2>/dev/null)
    results=$(echo "$results" | jq --arg t "$token_id" --arg m "$mid" \
      '. + [{"token_id": $t, "mid": (if $m == "null" then null else ($m | tonumber) end)}]')
  done
  echo "$results" | jq '.'
}

cmd_help() {
  cat <<'EOF'
Polymarket API Tool for Thucydides Trading Agents

USAGE:
  polymarket.sh <command> [args...]

COMMANDS:
  scan [--limit N]                             Discover active markets (default limit: 50)
  market <slug>                                Get full event details by slug
  price <token_id> [token_id2 ...]             Get midpoint price(s)
  spread <token_id>                            Get bid/ask/spread/mid
  book <token_id> [--depth N]                  Get order book (optionally truncated)
  history <token_id> [--interval I] [--fidelity F]  Price history (default: 1d, 60min)
  monitor <token_id1> [token_id2 ...]          Batch midpoint check

NOTES:
  - All output is JSON
  - Token IDs come from Gamma API's clobTokenIds field
  - For binary markets: first token = YES, second = NO
  - No authentication required (read-only endpoints)
  - Errors return {"error": "..."} on stderr with exit code 1
EOF
}

# --- Dispatch ---

case "${1:-help}" in
  scan)     shift; cmd_scan "$@" ;;
  market)   shift; cmd_market "$@" ;;
  price)    shift; cmd_price "$@" ;;
  spread)   shift; cmd_spread "$@" ;;
  book)     shift; cmd_book "$@" ;;
  history)  shift; cmd_history "$@" ;;
  monitor)  shift; cmd_monitor "$@" ;;
  help|--help|-h) cmd_help ;;
  *)        echo "Unknown command: $1" >&2; cmd_help; exit 1 ;;
esac
