import { chromium } from 'playwright'
const browser = await chromium.launch()
for (const vp of [{ w: 768, h: 1024 }, { w: 820, h: 1180 }, { w: 1024, h: 1366 }]) {
  const page = await browser.newPage({ viewport: { width: vp.w, height: vp.h } })
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' })
  const result = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }))
  console.log(vp.w, JSON.stringify(result))
  await page.close()
}
await browser.close()
