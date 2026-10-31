/**
 * Local PostgreSQL launcher for machines without Docker or a system Postgres.
 *
 *   pnpm add -Dw embedded-postgres
 *   node scripts/dev/postgres.js
 *
 * It bootstraps a persistent cluster under PG_DATA_DIR (default: ./.devdata/pg)
 * with the credentials from apps/api/.env, then keeps the server in the
 * foreground until SIGINT/SIGTERM.
 */
const path = require("path");
const fs = require("fs");

const PORT = Number(process.env.PG_PORT || 5432);
const USER = process.env.PG_USER || "aivideo";
const PASSWORD = process.env.PG_PASSWORD || "aivideo";
const DATABASE = process.env.PG_DATABASE || "aivideo";
const DATA_DIR =
  process.env.PG_DATA_DIR || path.resolve(__dirname, "../../.devdata/pg");

let EmbeddedPostgres;
try {
  EmbeddedPostgres = require("embedded-postgres");
} catch {
  console.error(
    "embedded-postgres is not installed.\n" +
      "Run `pnpm add -Dw embedded-postgres`, or install PostgreSQL 16 and start it with:\n" +
      "  brew services start postgresql@16",
  );
  process.exit(1);
}

const Pg = EmbeddedPostgres.default || EmbeddedPostgres;

(async () => {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const pg = new Pg({
    databaseDir: DATA_DIR,
    user: USER,
    password: PASSWORD,
    port: PORT,
    persistent: true,
  });

  if (!fs.existsSync(path.join(DATA_DIR, "PG_VERSION"))) {
    await pg.initialise();
    console.log(`initialised cluster at ${DATA_DIR}`);
  }

  await pg.start();
  console.log(`postgres listening on 127.0.0.1:${PORT} (db=${DATABASE}, user=${USER})`);

  try {
    await pg.createDatabase(DATABASE);
    console.log(`created database ${DATABASE}`);
  } catch {
    console.log(`database ${DATABASE} already exists`);
  }

  const stop = async () => {
    console.log("\nstopping postgres...");
    await pg.stop().catch(() => {});
    process.exit(0);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);

  setInterval(() => {}, 1 << 30);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
