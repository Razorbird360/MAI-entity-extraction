// api/extract.js

import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const fileName = fileURLToPath(import.meta.url);
const dirName  = path.dirname(fileName);

const app = express();
app.use(express.json());

const definitionsPath = path.join(dirName, '../issueDefinitions.json');
let definitions = [];

try {
  const raw = fs.readFileSync(definitionsPath, 'utf-8');
  definitions = JSON.parse(raw);
} catch (err) {
  console.error('Error reading or parsing issueDefinitions.json:', err);
  //exit so server does not start with invalid data
  process.exit(1);
}

//escaoe regex special characters in a string
const escapeRegex = (str) =>
  str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Precompute every “pattern” (device, component, issue, description, solution, regex)
const patterns = [];
const componentsByDevice = {};  

definitions.forEach((deviceDef) => {
  const dev = deviceDef.device.trim().toLowerCase();
  componentsByDevice[dev] = [];

  //wifi and bluetooth devices
  if (deviceDef.issues) {
    for (const [issueKey, { description, solution }] of Object.entries(deviceDef.issues)) {
      const keyword = issueKey.trim().toLowerCase();
      const regex   = new RegExp(`\\b${escapeRegex(keyword)}\\b`, 'i');

      patterns.push({
        device: dev,
        component: null, // top‐level (no sub‐component)
        issue: keyword,
        description,
        solution,
        regex,
      });
    }
  }

  if (deviceDef.components) {
    for (const [componentKey, componentObj] of Object.entries(deviceDef.components)) {
      const comp = componentKey.trim().toLowerCase();
      componentsByDevice[dev].push(comp); // record that "comp" belongs to this device

      // each componentObj itself is a map from issueKey → { description, solution}
      for (const [issueKey, issueDetail] of Object.entries(componentObj)) {
        if (
          typeof issueDetail !== 'object' ||
          issueDetail === null ||
          !('description' in issueDetail) ||
          !('solution' in issueDetail)
        ) {
          continue;
        }

        const keyword = issueKey.trim().toLowerCase();
        const regex   = new RegExp(`\\b${escapeRegex(keyword)}\\b`, 'i');

        patterns.push({
          device: dev,
          component: comp,
          issue: keyword,
          description: issueDetail.description,
          solution: issueDetail.solution,
          regex,
        });
      }
    }
  }
});

app.get('/health', (_req, res) => {
  return res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
  });
});


app.post('/extract', (req, res) => {
  const rawText = (req.body.text || '').trim();
  const text    = rawText.toLowerCase();

  if (!text) {
    return res.status(400).json({ error: 'Missing "text" in request body' });
  }

  //check for device mentions in the text
  let detectedDevice = null;
  for (const deviceDef of definitions) {
    const devName = deviceDef.device.trim().toLowerCase();
    // check word boundary so that "phone" does not match "smartphone" accidentally
    const deviceRegex = new RegExp(`\\b${escapeRegex(devName)}\\b`, 'i');
    if (deviceRegex.test(text)) {
      detectedDevice = devName;
      break;
    }
  }

  //if a device was detected, check for components
  let detectedComponent = null;
  if (detectedDevice && componentsByDevice[detectedDevice]) {
    for (const compName of componentsByDevice[detectedDevice]) {
      const compRegex = new RegExp(`\\b${escapeRegex(compName)}\\b`, 'i');
      if (compRegex.test(text)) {
        detectedComponent = compName;
        break;
      }
    }
  }

  //filter the patterns based on detected device and component
  let candidatePatterns = [];

  if (detectedDevice) {
    //if both device and component were found, only match patterns under that device and component
    if (detectedComponent) {
      candidatePatterns = patterns.filter(
        (p) => p.device === detectedDevice && p.component === detectedComponent
      );
    }
    //if device found but no component matched, match all issues under that device
    if (!detectedComponent) {
      candidatePatterns = patterns.filter((p) => p.device === detectedDevice);
    }
  }
  //if no device was mentioned, fallback to matching EVERY pattern
  if (!detectedDevice) {
    candidatePatterns = patterns.slice();
  }

  //run the regex tests on the candidate patterns
  const matches = [];
  for (const pat of candidatePatterns) {
    if (pat.regex.test(text)) {
      matches.push({
        device: pat.device,
        component: pat.component, // string or null
        issue: pat.issue,
        description: pat.description,
        solution: pat.solution,
      });
    }
  }

  return res.json({
    input: rawText,
    matches: matches,
  });
});

// export for vercel
export default app;
