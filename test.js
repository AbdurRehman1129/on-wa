const puppeteer = require('puppeteer-core');

(async () => {
  const browser = await puppeteer.launch({
    executablePath: './node_modules/puppeteer-core/.local-chromium/linux-*/chrome-linux/chrome',
    headless: true,
  });
  console.log('Browser launched successfully');
  await browser.close();
})();
