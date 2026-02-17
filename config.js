const config = {
  appName: 'Deployment Workflow Demo',
  environment: process.env.NODE_ENV || 'development',
  logLevel: 'info',
  maxRetries: 3,
  timeout: 5000,
};

module.exports = config;
