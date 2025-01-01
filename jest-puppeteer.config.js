/** @type {import('jest-environment-puppeteer').JestPuppeteerConfig} */
const config = {
  launch: {
    headless: process.env.CI === "true",
  },
  server: {
    command: `npm run start:${process.env.NODE_ENV}`,
    port: process.env.NODE_ENV === 'production' ? 3000 : 4000,
    launchTimeout: 180000,
  },
};

export default config;
