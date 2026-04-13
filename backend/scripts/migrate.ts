import db from '../src/db.js';

const runMigrations = async () => {
  console.log('Running migrations...');
  const fs = await import('fs');
  const path = await import('path');
  const { fileURLToPath } = await import('url');
  const __dirname = path.dirname(fileURLToPath(import.meta.url));

  try {
    // Create migrations table if not exists
    await db.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const migrationsDir = path.join(__dirname, '../migrations');
    const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();

    for (const file of files) {
      const checkResult = await db.query('SELECT * FROM migrations WHERE name = $1', [file]);

      if (checkResult.rows.length === 0) {
        console.log(`Executing migration: ${file}`);
        const content = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
        const upSection = content.split('-- Up')[1].split('-- Down')[0].trim();

        await db.query(upSection);
        await db.query('INSERT INTO migrations (name) VALUES ($1)', [file]);
      }
    }

    console.log('✓ Migrations completed');
  } catch (error) {
    console.error('✗ Migration error:', error);
    throw error;
  }
};

export default runMigrations;

runMigrations()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
