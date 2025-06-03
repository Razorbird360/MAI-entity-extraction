const express = require('express');
const fs = require('fs');
const path = require('path');
const Fuse = require('fuse.js');

const app = express();
app.use(express.json());

const definitionsPath = path.join(__dirname, '../issueDefinitions.json');
let definitions = [];

try {
  const filedata = fs.readFileSync(definitionsPath, 'utf-8');
  definitions = JSON.parse(filedata);
} catch (e) {
  console.error('cant read file', e);
  process.exit(1);
}

const escapeRegex = (str) =>
  str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const patterns = []; //flat array of all patterns to match against text
const componentsByDevice = {}; //map each device name to array of component names, wifi and bluetooth are top level so no components

definitions.forEach((deviceDef) => { //fill the patterns and componentsByDevice arrays
  const dev = deviceDef.device.trim().toLowerCase();
  componentsByDevice[dev] = [];

  //wifi and bluetooth
  if (deviceDef.issues) {
    for (const [issueKey, { description, solution }] of Object.entries(deviceDef.issues)) {
      const keyword = issueKey.trim().toLowerCase();

      patterns.push({
        device: dev,
        component: null,
        issue: keyword,
        description,
        solution,
      });
    }
  }

  //phone laptop desktop
  if (deviceDef.components) {
    for (const [componentKey, componentObj] of Object.entries(deviceDef.components)) {
      const comp = componentKey.trim().toLowerCase();
      componentsByDevice[dev].push(comp);

      for (const [issueKey, issueDetail] of Object.entries(componentObj)) {
        if (
          typeof issueDetail !== 'object' ||
          issueDetail === null ||
          !('description' in issueDetail) ||
          !('solution' in issueDetail)
        ) {
          continue; // skip invalid entries
        }

        const keyword = issueKey.trim().toLowerCase();
        patterns.push({
          device: dev,
          component: comp,
          issue: keyword,
          description: issueDetail.description,
          solution: issueDetail.solution,
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
  const userText = (req.body.text || '').trim();
  const text = userText.toLowerCase();

  if (!text) {
    return res.status(400).json({ error: 'no text in request body' });
  }

  // Detect device by exact boundary regex
  let detectedDevice = null;
  for (const deviceDef of definitions) {
    const devName = deviceDef.device.trim().toLowerCase();
    const deviceRegex = new RegExp(`\\b${escapeRegex(devName)}\\b`, 'i'); // \\b is a word boundary anchor in JavaScript’s RegExp. It ensures that “phone” matches “my phone” or “Phone” but does not match “smartphone.”
    if (deviceRegex.test(text)) {
      detectedDevice = devName;
      break;
    }
  }

  // If a device was detected, detect component by exact boundary regex
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

  let candidatePatterns = [];

  if (detectedDevice) {
    if (detectedComponent) {
      candidatePatterns = patterns.filter(
        (p) => p.device === detectedDevice && p.component === detectedComponent
      );
    } else {
      candidatePatterns = patterns.filter((p) => p.device === detectedDevice && p.component === null);
    }
  } else {
    // no device → search across all patterns
    candidatePatterns = patterns.slice();
  }
  
  let fuzzyResults = [];

  if (candidatePatterns.length > 0) {
    const fuseOptions = {
      includeScore: true,
      threshold: 0.4,
      distance: 100,
      ignoreLocation: true,
    };

    // Creates a Fuse instance that will search within the user's text.
    const fuseForUserText = new Fuse([text], fuseOptions);

    for (const p of candidatePatterns) {
      const keywordToFind = p.issue;
      const results = fuseForUserText.search(keywordToFind);

      if (results.length > 0) {
        fuzzyResults.push({
          item: p,
          score: results[0].score,
        });
      }
    }
  }

  // take only the top result
  if (fuzzyResults.length > 0) {
    fuzzyResults.sort((a, b) => a.score - b.score); 
    const best = fuzzyResults[0].item;    // the pattern object

    let finalComponentValue = best.component; 
    if ((best.device === 'wifi' || best.device === 'bluetooth') && best.component === null) {
      finalComponentValue = "network";
    }
    const matches = {
      device: best.device,
      component: finalComponentValue,
      issue: best.issue,
      description: best.description,
      solution: best.solution,
    };

    return res.json({
      input: userText,
      matches,
    });
  } else {
    return res.json({
      input: userText,
      matches: [],
    });
  }

});

module.exports = app;
