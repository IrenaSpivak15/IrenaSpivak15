const { chromium } = require('playwright');
(async () => {
  const [,, html, outDir, secs] = process.argv;
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  await p.goto('file://' + html); await p.waitForTimeout(300);
  await p.evaluate(() => document.getAnimations().forEach(a => a.pause()));
  const n = Math.round(+secs * 30);
  for (let i = 0; i < n; i++) {
    await p.evaluate((t) => document.getAnimations().forEach(a => { a.currentTime = t; }), i * 1000 / 30);
    await p.screenshot({ path: `${outDir}/f${String(i).padStart(4, '0')}.png`, omitBackground: true });
  }
  await b.close(); console.log('frames', n);
})();
