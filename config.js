const config = {
  appName: 'Deployment Workflow Demo v2',
  environment: process.env.NODE_ENV || 'development',
  logLevel: 'debug',
  maxRetries: 5,
  timeout: 10000,
  featureFlags: {
    darkMode: true,
    betaApi: false,
  },
};

module.exports = config;
