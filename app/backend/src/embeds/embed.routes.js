// app/backend/src/embeds/embed.routes.js
import { Router } from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const router = Router();

// === Ruta absoluta al build del widget ===
// Estamos en: app/backend/src/embeds/embed.routes.js
// Subimos 3 niveles hasta app/, luego widget/dist/widget.js
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const ROOT_DIR   = path.resolve(__dirname, '../../..'); // -> app/
const WIDGET_DIST = path.resolve(ROOT_DIR, 'widget', 'dist', 'widget.js');

router.get('/widget.js', (req, res) => {
  // Evita cachear en dev para no servir un bundle viejo
  res.set({
    'Content-Type': 'application/javascript; charset=utf-8',
    'Cross-Origin-Resource-Policy': 'cross-origin',
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
    'Surrogate-Control': 'no-store',
  });

  res.sendFile(WIDGET_DIST, (err) => {
    if (err) {
      // Si no existe el build, mejor devolvemos un mensaje claro
      // en vez de un fallback sin `sid` que confunde.
      res.status(404).send(
        `/* widget.js not found at: ${WIDGET_DIST}
         * Run:  cd app/widget && npm run build
         */`
      );
    }
  });
});

export default router;
