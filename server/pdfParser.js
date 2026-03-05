import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');

export async function parsePdf(buffer) {
  const data = await pdfParse(buffer);
  return data.text;
}

export function truncateText(text, maxLength = 2000) {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
}
