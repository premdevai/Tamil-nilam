import { chromium } from '@playwright/test';
const out =
  '/private/tmp/claude-501/-Users-premkumar-prem-Obsidian-nilam/e737eb2e-2426-4715-9bf7-37ccb4bc5059/scratchpad';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 1250 } });
const errs = [];
p.on('pageerror', (e) => errs.push(e.message.slice(0, 160)));
p.on('console', (m) => {
  if (m.type() === 'error') errs.push(m.text().slice(0, 160));
});
await p.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
await p
  .getByRole('button', { name: 'Land Explorer', exact: true })
  .first()
  .click();
await p.getByLabel('Search estates').fill('kattuvananjur');
await p.locator('button.qh-row-paper').first().click();
await p.waitForTimeout(6500);
console.log(
  'caption:',
  await p.getByText('allottable plots', { exact: false }).innerText(),
);
const box = await p.locator('canvas.maplibregl-canvas').boundingBox();
const seen = new Set();
let popups = 0;
for (let i = 0; i <= 24; i++) {
  await p.mouse.move(
    box.x + box.width * (0.2 + (0.6 * i) / 24),
    box.y + box.height * (0.55 + (0.25 * (i % 3)) / 3),
  );
  await p.waitForTimeout(160);
  const t = await p
    .locator('.maplibregl-popup')
    .innerText()
    .catch(() => null);
  if (t) {
    popups++;
    seen.add(t.split('\n')[0]);
  }
}
console.log('popups seen:', popups, 'distinct headers:', [...seen].slice(0, 8));
await p.screenshot({ path: `${out}/70-popup.png` });
await p.mouse.move(40, 40);
await p.waitForTimeout(600);
console.log(
  'popup after leaving map:',
  await p.locator('.maplibregl-popup').count(),
);
console.log(errs.length ? 'ERRORS: ' + errs.join(' | ') : 'no client errors');
await b.close();
