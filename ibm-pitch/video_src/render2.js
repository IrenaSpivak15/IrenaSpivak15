const { chromium } = require('playwright');
// usage: node render2.js page.html outDir seconds fps alpha(0/1)
(async () => {
  const [,, html, outDir, secs, fpsArg, alphaArg] = process.argv;
  const fps = +fpsArg || 30, alpha = alphaArg === '1';
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1.5 });
  await p.goto('file://' + html);
  await p.waitForTimeout(300);
  await p.evaluate(() => document.getAnimations().forEach(a => a.pause()));
  const n = Math.round(+secs * fps);
  for (let i = 0; i < n; i++) {
    const t = i * 1000 / fps;
    await p.evaluate((t) => document.getAnimations().forEach(a => { a.currentTime = t; }), t);
    await p.screenshot({ path: `${outDir}/f${String(i).padStart(4, '0')}.png`, omitBackground: alpha });
  }
  await b.close();
  console.log('frames', n);
})();
