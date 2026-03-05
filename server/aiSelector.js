import Anthropic from '@anthropic-ai/sdk';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let client = null;
let activityCatalog = null;

function getClient() {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!client) {
    client = new Anthropic();
  }
  return client;
}

function getActivityCatalog() {
  if (!activityCatalog) {
    const raw = readFileSync(join(__dirname, '..', 'src', 'data', 'activities.json'), 'utf-8');
    const activities = JSON.parse(raw);
    activityCatalog = activities.map((a) => ({
      id: a.id,
      name: a.name,
      phase: a.phase,
      owner: a.owner,
      notes: a.notes,
      considerations: a.considerations,
      dependencies: a.dependencies,
      optional: a.optional || false,
      postLaunch: a.postLaunch || false,
    }));
  }
  return activityCatalog;
}

export async function suggestActivities(projectInputs) {
  const anthropic = getClient();
  if (!anthropic) return { aiAvailable: false };

  const catalog = getActivityCatalog();
  const catalogText = catalog
    .map(
      (a) =>
        `${a.id}: ${a.name} (${a.phase}, owner: ${a.owner})${a.notes ? ' — ' + a.notes : ''}${a.considerations ? ' [' + a.considerations + ']' : ''}${a.dependencies.length ? ' deps: ' + a.dependencies.join(',') : ''}${a.optional ? ' [OPTIONAL post-launch]' : ''}`
    )
    .join('\n');

  const signalsContext =
    projectInputs.rfpSignals?.length > 0
      ? `\nExtracted RFP Signals: ${projectInputs.rfpSignals.join(', ')}`
      : '';

  const prompt = `You are an expert digital project planner at a design agency. Analyze the project details below and recommend which activities should be included in the project plan.

## Activity Catalog
${catalogText}

## Project Details
Description: ${projectInputs.description}
RFP Text: ${projectInputs.rfpText || 'None provided'}
Industry: ${projectInputs.industry}
Client Country: ${projectInputs.clientCountry}${signalsContext}

## Instructions
- Select activities that are specifically relevant based on the project description, industry, and any RFP requirements.
- Always include phase gate activities (I17, V12) and core activities (I1, I3, V1, V3, V4, E1, E2, E4) unless there's a strong reason not to.
- Do NOT include optional post-launch activities (E21, E22) unless the project explicitly mentions post-launch optimization or experimentation.
- If the RFP mentions accessibility, compliance, or regulated industries, include I7 and E18.
- Consider dependencies: if you include an activity, include its dependencies too.
- Provide a short reasoning for each suggested activity explaining WHY it's relevant to this specific project.

Return ONLY valid JSON in this exact format:
{
  "suggestions": ["I1", "I2", ...],
  "reasoning": {
    "I1": "Short reason why this activity is relevant",
    ...
  }
}`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6-20250620',
    max_tokens: 2000,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content[0].text;
  const match = text.match(/\{[\s\S]*\}/);
  if (match) {
    try {
      const parsed = JSON.parse(match[0]);
      return {
        suggestions: parsed.suggestions || [],
        reasoning: parsed.reasoning || {},
        aiAvailable: true,
      };
    } catch {
      // JSON parse failed, try to extract array fallback
      const arrMatch = text.match(/\[[\s\S]*?\]/);
      if (arrMatch) {
        return { suggestions: JSON.parse(arrMatch[0]), reasoning: {}, aiAvailable: true };
      }
    }
  }
  return { suggestions: [], reasoning: {}, aiAvailable: true };
}

export async function summarizePdf(text) {
  const anthropic = getClient();
  if (!anthropic) return null;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6-20250620',
    max_tokens: 800,
    messages: [
      {
        role: 'user',
        content: `Analyze this RFP document and return a JSON response with:
1. A 2-3 sentence summary focusing on project scope, goals, and key requirements
2. An array of extracted signals — key themes, mentioned requirements, compliance needs, and technical constraints

Return ONLY valid JSON in this exact format:
{
  "summary": "2-3 sentence summary here",
  "signals": ["accessibility requirements", "WCAG compliance", "content migration needed", ...]
}

RFP Text:
${text.slice(0, 6000)}`,
      },
    ],
  });

  const responseText = response.content[0].text;
  const match = responseText.match(/\{[\s\S]*\}/);
  if (match) {
    try {
      const parsed = JSON.parse(match[0]);
      return {
        summary: parsed.summary || responseText,
        signals: parsed.signals || [],
      };
    } catch {
      return { summary: responseText, signals: [] };
    }
  }
  return { summary: responseText, signals: [] };
}

export async function analyzeUrl(url) {
  const anthropic = getClient();
  if (!anthropic) return { aiAvailable: false };

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6-20250620',
    max_tokens: 500,
    messages: [
      {
        role: 'user',
        content: `Analyze this website URL and estimate the number of unique screen templates/pages it likely has: ${url}

Consider: homepage, product/service pages, about, contact, blog, listing pages, detail pages, account pages, checkout flow, etc.

Return JSON: {"estimatedScreenCount": number, "breakdown": "brief description of page types counted"}`,
      },
    ],
  });

  const text = response.content[0].text;
  const match = text.match(/\{[\s\S]*?\}/);
  if (match) {
    return { ...JSON.parse(match[0]), aiAvailable: true };
  }
  return { estimatedScreenCount: 20, breakdown: 'Could not parse response', aiAvailable: true };
}

export async function analyzeApp(url) {
  const anthropic = getClient();
  if (!anthropic) return { aiAvailable: false };

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6-20250620',
    max_tokens: 500,
    messages: [
      {
        role: 'user',
        content: `Analyze this app store listing and estimate the number of unique screen templates the app likely has: ${url}

Consider: onboarding, home/dashboard, navigation tabs, detail screens, settings, profile, search, list views, etc.

Return JSON: {"estimatedScreenCount": number, "breakdown": "brief description of screen types counted"}`,
      },
    ],
  });

  const text = response.content[0].text;
  const match = text.match(/\{[\s\S]*?\}/);
  if (match) {
    return { ...JSON.parse(match[0]), aiAvailable: true };
  }
  return { estimatedScreenCount: 25, breakdown: 'Could not parse response', aiAvailable: true };
}
