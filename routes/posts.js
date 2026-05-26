const express = require('express');
const sharp   = require('sharp');
const pool    = require('../db');
const upload  = require('../middleware/upload');

const router = express.Router();

/* ── POST /api/posts — create a post ── */
router.post('/', upload.single('photo'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Foto é obrigatória' });
    }

    const name    = (req.body.name    || 'Convidado').trim().slice(0, 60);
    const message = (req.body.message || '').trim().slice(0, 400);

    // Resize + compress before storing (max 1920px, JPEG 85%)
    const compressed = await sharp(req.file.buffer)
      .resize({ width: 1920, height: 1920, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 85, progressive: true })
      .toBuffer();

    const { rows } = await pool.query(
      `INSERT INTO posts (name, message, photo_data, photo_mime)
       VALUES ($1, $2, $3, 'image/jpeg')
       RETURNING id, name, message, created_at`,
      [name, message, compressed],
    );

    const post = rows[0];
    res.status(201).json({ ...post, photo_url: `/api/photos/${post.id}` });
  } catch (err) {
    next(err);
  }
});

/* ── GET /api/posts — list all posts (metadata only) ── */
router.get('/', async (_req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, name, message, created_at FROM posts ORDER BY created_at DESC`,
    );
    res.json(rows.map(p => ({ ...p, photo_url: `/api/photos/${p.id}` })));
  } catch (err) {
    next(err);
  }
});

/* ── DELETE /api/posts/:id ── */
router.delete('/:id', async (req, res, next) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM posts WHERE id = $1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: 'Post não encontrado' });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
