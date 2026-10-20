// Renders scene.html frame by frame into frames/NNNN.jpg (1080x1920, 30fps, 15s).
// Usage: node render.js [fps] [scene file]
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const FPS = Number(process.argv[2] || 30);
const DURATION = 15;
const SCENE = process.argv[3] || 'scene.html';
const out = path.join(__dirname, 'frames');

(async () => {
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
  await page.goto('file://' + path.join(__dirname, SCENE), { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  const total = FPS * DURATION;
  for (let i = 0; i < total; i++) {
    await page.evaluate(t => window.render(t), i / FPS);
    await page.screenshot({ path: path.join(out, String(i).padStart(4, '0') + '.jpg'), type: 'jpeg', quality: 92 });
    if (i % 60 === 0) console.log(`frame ${i}/${total}`);
  }
  await browser.close();
})();
