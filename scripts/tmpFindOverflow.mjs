import { chromium } from 'playwright'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1024, height: 1366 } })
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' })
const offenders = await page.evaluate(() => {
  const all = document.querySelectorAll('body *')
  const results = []
  all.forEach((el) => {
    const rect = el.getBoundingClientRect()
    if (rect.right > document.documentElement.clientWidth + 1) {
      results.push({
        tag: el.tagName,
        cls: el.className?.toString().slice(0, 140),
        right: Math.round(rect.right),
        width: Math.round(rect.width),
        left: Math.round(rect.left),
      })
    }
  })
  return results.slice(0, 15)
})
console.log(JSON.stringify(offenders, null, 2))
await browser.close()
