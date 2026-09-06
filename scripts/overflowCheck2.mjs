import { chromium } from 'playwright'

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 375, height: 812 } })
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' })
const overflow = await page.evaluate(() => ({
  scrollWidth: document.documentElement.scrollWidth,
  clientWidth: document.documentElement.clientWidth,
}))
console.log(JSON.stringify(overflow))
await browser.close()
