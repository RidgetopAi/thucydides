#!/usr/bin/env npx tsx
/**
 * Polymarket Price Updater for Thucydides Trading System
 *
 * Updates current market prices for active polymarket predictions,
 * recalculates edge, and creates monitoring snapshots.
 *
 * Usage:
 *   cd /opt/thucydides-ui/backend && npx tsx scripts/update-prices.ts
 *
 * Cron example (every 5 minutes):
 *   0,5,10,15,20,25,30,35,40,45,50,55 * * * * cd /opt/thucydides-ui/backend && npx tsx scripts/update-prices.ts >> /var/log/thucydides-prices.log 2>&1
 */

import pg from 'pg';

// Database configuration
const pool = new pg.Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'thucydides',
  user: process.env.DB_USER || 'mandrel',
  password: process.env.DB_PASSWORD || 'mandrel2024',
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

// Types
interface ActivePrediction {
  id: number;
  market_id: string;
  question: string;
  position_side: 'yes' | 'no' | null;
  bet_size: number | null;
  bet_price: number | null;
  prediction_probability: number;
  current_market_prob: number | null;
}

interface GammaMarketResponse {
  slug?: string;
  clobTokenIds?: string;   // JSON string: '["token1", "token2"]'
  outcomes?: string;       // JSON string: '["Yes", "No"]'
  outcomePrices?: string;  // JSON string: '["0.15", "0.85"]'
  [key: string]: unknown;
}

interface MarketPriceInfo {
  yesPrice: number;
  noPrice: number;
  slug: string;
  yesTokenId: string;
  noTokenId: string;
}

// Logging helper
function log(level: 'INFO' | 'WARN' | 'ERROR', message: string, data?: Record<string, unknown>): void {
  const timestamp = new Date().toISOString();
  const dataStr = data ? ` ${JSON.stringify(data)}` : '';
  console.log(`[${timestamp}] [${level}] ${message}${dataStr}`);
}

// Parse JSON string safely
function parseJsonString<T>(str: string | undefined): T | null {
  if (!str) return null;
  try {
    return JSON.parse(str) as T;
  } catch {
    return null;
  }
}

// Fetch market price info from slug using Gamma API
async function getMarketPriceFromSlug(slug: string): Promise<MarketPriceInfo | null> {
  const url = `https://gamma-api.polymarket.com/markets?slug=${encodeURIComponent(slug)}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      log('WARN', `Gamma API returned ${response.status} for slug`, { slug });
      return null;
    }

    const data = await response.json() as GammaMarketResponse[];

    // The API returns an array of markets
    if (!Array.isArray(data) || data.length === 0) {
      log('WARN', 'No markets found for slug', { slug });
      return null;
    }

    const market = data[0];
    const marketSlug = market.slug || slug;

    // Parse the JSON strings
    const tokenIds = parseJsonString<string[]>(market.clobTokenIds);
    const outcomes = parseJsonString<string[]>(market.outcomes);
    const prices = parseJsonString<string[]>(market.outcomePrices);

    if (!tokenIds || !outcomes || !prices) {
      log('WARN', 'Missing market data fields', { slug, tokenIds, outcomes, prices });
      return null;
    }

    if (tokenIds.length < 2 || outcomes.length < 2 || prices.length < 2) {
      log('WARN', 'Insufficient market data', { slug, tokenIds: tokenIds.length, outcomes: outcomes.length });
      return null;
    }

    // Find Yes and No indices
    const yesIndex = outcomes.findIndex(o => o.toLowerCase() === 'yes');
    const noIndex = outcomes.findIndex(o => o.toLowerCase() === 'no');

    if (yesIndex === -1 || noIndex === -1) {
      log('WARN', 'Could not find Yes/No outcomes', { slug, outcomes });
      return null;
    }

    const yesPrice = parseFloat(prices[yesIndex]);
    const noPrice = parseFloat(prices[noIndex]);

    if (isNaN(yesPrice) || isNaN(noPrice)) {
      log('WARN', 'Invalid price values', { slug, yesPrice, noPrice });
      return null;
    }

    return {
      yesPrice,
      noPrice,
      slug: marketSlug,
      yesTokenId: tokenIds[yesIndex],
      noTokenId: tokenIds[noIndex],
    };
  } catch (error) {
    log('ERROR', 'Failed to fetch from Gamma API', {
      slug,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

// Calculate edge based on position side
function calculateEdge(
  positionSide: 'yes' | 'no' | null,
  predictionProbability: number,
  currentMarketProb: number
): number {
  // Edge = our predicted probability - market probability (for YES side)
  // For NO side, we flip the logic
  if (positionSide === 'yes') {
    return predictionProbability - currentMarketProb;
  } else if (positionSide === 'no') {
    // If we're betting NO, our edge is based on (1 - market_prob) vs (1 - prediction_prob)
    // But more intuitively: if market says 60% and we say 40%, betting NO gives us edge
    return currentMarketProb - predictionProbability;
  }
  // If no position side, just return the difference
  return predictionProbability - currentMarketProb;
}

// Calculate unrealized PnL
function calculateUnrealizedPnl(
  positionSide: 'yes' | 'no' | null,
  betSize: number | null,
  betPrice: number | null,
  currentPrice: number
): number {
  if (!betSize || !betPrice || !positionSide) {
    return 0;
  }

  // Calculate shares purchased: shares = bet_size / bet_price
  // Current value: current_value = shares * current_price
  // Unrealized PnL: current_value - bet_size

  if (positionSide === 'yes') {
    const shares = betSize / betPrice;
    const currentValue = shares * currentPrice;
    return currentValue - betSize;
  } else {
    // For NO position, shares = bet_size / (1 - bet_price)
    // Current value = shares * (1 - current_price)
    const noPrice = 1 - betPrice;
    const shares = betSize / noPrice;
    const currentNoPrice = 1 - currentPrice;
    const currentValue = shares * currentNoPrice;
    return currentValue - betSize;
  }
}

// Cache for market info to avoid repeated Gamma API calls
const marketPriceCache = new Map<string, MarketPriceInfo>();

async function getMarketPrice(slug: string): Promise<MarketPriceInfo | null> {
  // Don't use cache for prices - we want fresh prices each run
  // Cache is only useful within a single run for multiple positions in same market
  if (marketPriceCache.has(slug)) {
    return marketPriceCache.get(slug)!;
  }

  const info = await getMarketPriceFromSlug(slug);
  if (info) {
    marketPriceCache.set(slug, info);
  }
  return info;
}

// Main update function
async function updatePrices(): Promise<void> {
  log('INFO', 'Starting price update run');

  const client = await pool.connect();

  try {
    // Query active polymarket predictions
    const predictionsResult = await client.query<ActivePrediction>(`
      SELECT
        id,
        market_id,
        question,
        position_side,
        bet_size,
        bet_price,
        prediction_probability,
        current_market_prob
      FROM predictions
      WHERE status = 'active' AND mode = 'polymarket'
      ORDER BY id
    `);

    const predictions = predictionsResult.rows;
    log('INFO', `Found ${predictions.length} active polymarket predictions`);

    if (predictions.length === 0) {
      log('INFO', 'No active predictions to update');
      return;
    }

    let successCount = 0;
    let errorCount = 0;

    for (const prediction of predictions) {
      try {
        log('INFO', `Processing prediction ${prediction.id}`, {
          marketId: prediction.market_id,
          question: prediction.question?.substring(0, 50),
        });

        // Get market price info
        const marketInfo = await getMarketPrice(prediction.market_id);
        if (!marketInfo) {
          log('WARN', `Skipping prediction ${prediction.id}: could not fetch market info`);
          errorCount++;
          continue;
        }

        // Use the YES price as market probability
        const currentPrice = marketInfo.yesPrice;

        log('INFO', `Got price for prediction ${prediction.id}`, {
          yesPrice: currentPrice,
          previousPrice: prediction.current_market_prob,
        });

        // Calculate new edge
        const newEdge = calculateEdge(
          prediction.position_side,
          prediction.prediction_probability,
          currentPrice
        );

        // Calculate unrealized PnL
        const unrealizedPnl = calculateUnrealizedPnl(
          prediction.position_side,
          prediction.bet_size,
          prediction.bet_price,
          currentPrice
        );

        // Begin transaction for updates
        await client.query('BEGIN');

        try {
          // Update predictions table
          await client.query(`
            UPDATE predictions
            SET
              current_market_prob = $1,
              edge = $2,
              updated_at = NOW()
            WHERE id = $3
          `, [currentPrice, newEdge, prediction.id]);

          // Insert monitoring snapshot
          await client.query(`
            INSERT INTO market_snapshots (
              prediction_id,
              market_slug,
              snapshot_type,
              market_probability,
              unrealized_pnl,
              created_at
            ) VALUES ($1, $2, $3, $4, $5, NOW())
          `, [prediction.id, marketInfo.slug, 'monitoring', currentPrice, unrealizedPnl]);

          await client.query('COMMIT');

          log('INFO', `Updated prediction ${prediction.id}`, {
            newPrice: currentPrice,
            newEdge: newEdge.toFixed(4),
            unrealizedPnl: unrealizedPnl.toFixed(2),
          });

          successCount++;
        } catch (txError) {
          await client.query('ROLLBACK');
          throw txError;
        }

        // Small delay to be respectful to the API
        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (predictionError) {
        log('ERROR', `Failed to update prediction ${prediction.id}`, {
          error: predictionError instanceof Error ? predictionError.message : String(predictionError),
        });
        errorCount++;
      }
    }

    log('INFO', 'Price update run completed', {
      total: predictions.length,
      success: successCount,
      errors: errorCount,
    });
  } finally {
    client.release();
  }
}

// Run the script
async function main(): Promise<void> {
  try {
    await updatePrices();
  } catch (error) {
    log('ERROR', 'Fatal error in price updater', {
      error: error instanceof Error ? error.message : String(error),
    });
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
