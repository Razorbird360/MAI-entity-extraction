// api/extract.js

let issueDefinitions = null;
const ISSUE_DEFS_URL = process.env.ISSUE_DEFS_URL 
  || 'https://6835e768cd78db2058c39c38.mockapi.io/api/issueDefinitions';

// Load and cache the issue definitions once per cold start
async function loadIssueDefinitions() {
  if (issueDefinitions) return issueDefinitions;
  const res = await fetch(ISSUE_DEFS_URL);
  if (!res.ok) throw new Error(`Failed to fetch issue definitions: ${res.status}`);
  const data = await res.json();
  // Expect data like:
  // [
  //   { componentType: "display", issues: [
  //       { issueType: "screen goes black", keywords: ["black", "no display", "blank screen"] },
  //       { issueType: "dim screen", keywords: ["dim", "low brightness"] },
  //       ... 
  //     ]
  //   },
  //   { componentType: "battery", issues: [
  //       { issueType: "not charging", keywords: ["not charging","won't charge"] },
  //       ...
  //     ]
  //   },
  //   ...
  // ]
  issueDefinitions = data;
  return data;
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    return res.status(200).json({ status: 'healthy', timestamp: new Date().toISOString() });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST','GET']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { text } = req.body;
  if (typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({ error: 'Missing or empty text field' });
  }

  const lower = text.toLowerCase();
  const result = {
    deviceType: null,
    componentType: null,
    issueTypes: [],
    connectionType: null,
    timestamp: new Date().toISOString()
  };

  // 1) deviceType
  if (/\blaptop\b/.test(lower)) result.deviceType = 'laptop';
  else if (/\bdesktop\b|\bpc\b/.test(lower)) result.deviceType = 'desktop';
  else if (/\bserver\b/.test(lower)) result.deviceType = 'server';

  // 2) componentType
  const compMap = {
    display: /\bscreen\b|\bdisplay\b/,
    gpu: /\bgpu\b|\bgraphics card\b|\bnvidia\b|\bamd\b/,
    cpu: /\bcpu\b|\bprocessor\b/,
    ram: /\bram\b|\bmemory\b/,
    storage: /\bssd\b|\bhdd\b|\bhard drive\b/,
    keyboard: /\bkeyboard\b/,
    touchpad: /\btouchpad\b/,
    speakers: /\bspeaker\b|\baudio\b|no sound\b/,
    fans: /\bfan\b|\boverheat\b|\bhot\b/,
    network: /\bwifi\b|\bbluetooth\b|\bethernet\b|\bnetwork\b/
  };
  for (const [comp, regex] of Object.entries(compMap)) {
    if (regex.test(lower)) {
      result.componentType = comp;
      break;
    }
  }

  // 3) connectionType
  if (/\bwifi\b/.test(lower)) result.connectionType = 'wifi';
  else if (/\bbluetooth\b/.test(lower)) result.connectionType = 'bluetooth';
  else if (/\bethernet\b|\bnetwork\b/.test(lower)) result.connectionType = 'ethernet';

  // 4) issueTypes matching via MockAPI definitions
  if (result.componentType) {
    try {
      const definitions = await loadIssueDefinitions();
      const compDef = definitions.find(d => d.componentType === result.componentType);
      if (compDef && Array.isArray(compDef.issues)) {
        for (const { issueType, keywords } of compDef.issues) {
          for (const kw of keywords) {
            const pat = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // escape
            if (new RegExp(`\\b${pat.toLowerCase()}\\b`).test(lower)) {
              result.issueTypes.push(issueType);
              break; // move to next issueType once matched
            }
          }
        }
      }
    } catch (err) {
      console.error('Error loading issue definitions:', err);
    }
  }

  return res.status(200).json(result);
}
