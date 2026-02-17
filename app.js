const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

const config = require('./config');
const { formatDate, generateId } = require('./utils');

app.use(express.json());

app.get('/', (req, res) => {
  res.json({ message: 'Hello, world!', version: '2.0.0', requestId: generateId('req') });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

app.get('/info', (req, res) => {
  res.json({
    app: config.appName,
    env: config.environment,
    date: formatDate(new Date()),
    features: config.featureFlags,
  });
});

app.post('/echo', (req, res) => {
  res.json({ received: req.body, timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`${config.appName} running on port ${PORT}`);
});
