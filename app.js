const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.json({ message: 'Hello, world!', version: '1.0.0' });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

const config = require('./config');
const { formatDate } = require('./utils');

app.get('/info', (req, res) => {
  res.json({
    app: config.appName,
    env: config.environment,
    date: formatDate(new Date()),
  });
});
