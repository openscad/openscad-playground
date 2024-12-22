const isProd = process.env.START_MODE === 'prod';

module.exports = {
  launch: {
    headless: process.env.CI === "true",
  },
  server: {
    command: `npm run start:${isProd ? 'prod' : 'dev'}`,
    port: isProd ? 3000 : 4000,
    launchTimeout: 180000,
  },
};
