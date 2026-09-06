import { chromium } from 'playwright'
const browser = await chromium.launch()
for (const path of ['/pricing', '/about']) {
  const page = await browser.newPage({ viewport: { width: 1024, height: 1366 } })
  await page.goto(`http://localhost:5173${path}`, { waitUntil: 'networkidle' })
  const result = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }))
  console.log(path, JSON.stringify(result))
  await page.close()
}
await browser.close()
