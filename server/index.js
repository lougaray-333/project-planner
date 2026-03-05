import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { parsePdf, truncateText } from './pdfParser.js';
import { suggestActivities, summarizePdf, analyzeUrl, analyzeApp } from './aiSelector.js';

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

app.use(cors());
app.use(express.json());

// Parse PDF
app.post('/api/parse-pdf', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const text = await parsePdf(req.file.buffer);
    let summary = null;
    let signals = [];
    try {
      const aiResult = await summarizePdf(text);
      if (aiResult && typeof aiResult === 'object') {
        summary = aiResult.summary;
        signals = aiResult.signals || [];
      } else {
        summary = aiResult;
      }
    } catch (aiErr) {
      console.warn('AI summary unavailable:', aiErr.message);
    }
    res.json({
      text: truncateText(text),
      summary: summary || truncateText(text, 500),
      signals,
    });
  } catch (err) {
    console.error('PDF parse error:', err);
    res.status(500).json({ error: 'Failed to parse PDF' });
  }
});

// AI activity suggestions
app.post('/api/suggest-activities', async (req, res) => {
  try {
    const result = await suggestActivities(req.body);
    res.json(result);
  } catch (err) {
    console.error('AI suggestion error:', err);
    res.json({ aiAvailable: false, error: err.message });
  }
});

// Analyze website URL for screen count
app.post('/api/analyze-url', async (req, res) => {
  try {
    const result = await analyzeUrl(req.body.url);
    res.json(result);
  } catch (err) {
    console.error('URL analysis error:', err);
    res.json({ aiAvailable: false, error: err.message });
  }
});

// Analyze app store listing for screen count
app.post('/api/analyze-app', async (req, res) => {
  try {
    const result = await analyzeApp(req.body.url);
    res.json(result);
  } catch (err) {
    console.error('App analysis error:', err);
    res.json({ aiAvailable: false, error: err.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  if (!process.env.ANTHROPIC_API_KEY) {
    console.log('No ANTHROPIC_API_KEY found — AI features disabled, rule-based mode only');
  }
});
