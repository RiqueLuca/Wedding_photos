const express = require('express');
const pool    = require('../db');

const router = express.Router();

/* ── GET /api/photos/:id — serve photo binary ── */
router.get('/:id', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT photo_data, photo_mime FROM posts WHERE id = $1',
      [req.params.id],
    );

    if (!rows.length) return res.status(404).send('Foto não encontrada');

    const { photo_data, photo_mime } = rows[0];
    res.set('Content-Type', photo_mime);
    res.set('Cache-Control', 'public, max-age=31536000, immutable');
    res.send(photo_data);
  } catch (err) {
    next(err);
  }
});

/* ── GET /api/photos/:id/download — force download ── */
router.get('/:id/download', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT photo_data, photo_mime FROM posts WHERE id = $1',
      [req.params.id],
    );

    if (!rows.length) return res.status(404).send('Foto não encontrada');

    const { photo_data, photo_mime } = rows[0];
    res.set('Content-Type', photo_mime);
    res.set('Content-Disposition', `attachment; filename="henrique-thayna-${req.params.id}.jpg"`);
    res.send(photo_data);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
