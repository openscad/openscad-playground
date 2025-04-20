module.exports = {
  launch: {
    headless: process.env.CI === "true",
    args: [
      // https://chromium.googlesource.com/chromium/src/+/main/docs/security/apparmor-userns-restrictions.md#what-if-i-dont-have-root-access-to-the-machine-and-cant-install-anything
      '--no-sandbox',
    ],
  },
  server: {
    command: `npm run start:${process.env.NODE_ENV}`,
    port: process.env.NODE_ENV === 'production' ? 3000 : 4000,
    launchTimeout: 180000,
  },
};
