require('dotenv').config();

const express = require('express');
const cors    = require('cors');
const path    = require('path');
const fs      = require('fs');
const pool    = require('./db');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

/* ── API routes ── */
app.use('/api/posts',  require('./routes/posts'));
app.use('/api/photos', require('./routes/photos'));

/* ── Health check (used by Railway / Render) ── */
app.get('/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', db: 'connected', ts: new Date().toISOString() });
  } catch (err) {
    res.status(503).json({ status: 'error', db: err.message });
  }
});

/* ── Global error handler ── */
app.use((err, _req, res, _next) => {
  const status = err.status || 500;
  console.error(`[${status}] ${err.message}`);
  res.status(status).json({ error: err.message });
});

/* ── Boot ── */
async function start() {
  const schema = fs.readFileSync(path.join(__dirname, 'db', 'schema.sql'), 'utf8');
  await pool.query(schema);
  console.log('✓ Database schema ready');

  app.listen(PORT, () => {
    console.log(`💒 Wedding Gallery → http://localhost:${PORT}`);
  });
}

start().catch(err => {
  console.error('Failed to start:', err.message);
  process.exit(1);
});
