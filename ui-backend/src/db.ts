import pg from 'pg';

const pool = new pg.Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'thucydides',
  user: process.env.DB_USER || 'mandrel',
  password: process.env.DB_PASSWORD || 'mandrel2024',
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('Unexpected pool error:', err);
});

export async function query<T extends pg.QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<pg.QueryResult<T>> {
  const start = Date.now();
  const result = await pool.query<T>(text, params);
  const duration = Date.now() - start;
  if (duration > 100) {
    console.log(`Slow query (${duration}ms): ${text.substring(0, 80)}`);
  }
  return result;
}

export async function checkHealth(): Promise<boolean> {
  try {
    await pool.query('SELECT 1');
    return true;
  } catch {
    return false;
  }
}

export default pool;
