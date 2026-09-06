import { chromium } from 'playwright'

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' })
await page.getByRole('banner').screenshot({ path: 'docs/superpowers/visual-review/2026-09-06-subproject2-checkpoint-a-wallpaper/logo-crop.png' })
await browser.close()
console.log('done')
