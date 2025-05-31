const fs = require('fs');
const path = require('path');

module.exports = (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const filePath = path.join(__dirname, '../studentId.json');

  let existingIds;
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    existingIds = JSON.parse(raw);
    if (!Array.isArray(existingIds)) {
      throw new Error('studentId.json must be an array');
    }
  } catch (err) {
    return res.status(500).json({ error: 'Unable to read studentId.json', details: err.message });
  }

  let newId;
  const maxAttempts = 10;
  let attempts = 0;

  do {
    const randomEight = Math.floor(10000000 + Math.random() * 90000000);
    newId = `S${randomEight}`;
    attempts += 1;
    if (attempts >= maxAttempts) {
      return res.status(500).json({ error: 'Failed to generate a unique student ID' });
    }
  } while (existingIds.includes(newId));

  existingIds.push(newId);
  try {
    fs.writeFileSync(filePath, JSON.stringify(existingIds, null, 2), 'utf8');
  } catch (err) {
    return res.status(500).json({ error: 'Unable to update studentId.json', details: err.message });
  }

  return res.status(200).json({ studentId: newId });
};
