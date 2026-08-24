import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;
const publicDir = path.join(__dirname, 'public');

// Serve static assets
app.use(express.static(publicDir));

// Fallback for HTML routing if needed
app.get('/', (req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

app.get('/equipment', (req, res) => {
  res.sendFile(path.join(publicDir, 'equipment.html'));
});

app.get('/calendar', (req, res) => {
  res.sendFile(path.join(publicDir, 'calendar.html'));
});

app.get('/booking', (req, res) => {
  res.sendFile(path.join(publicDir, 'booking.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(publicDir, 'admin.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running at http://0.0.0.0:${PORT}`);
});
