module.exports = (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const randomEight = Math.floor(10000000 + Math.random() * 90000000);
  const newId = `S${randomEight}`;
  return res.status(200).json({ studentId: newId });
};