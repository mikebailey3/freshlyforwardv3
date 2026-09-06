// Checkpoint A screenshot capture (Sub-Project 2, Task 8 hero-only pass).
// Run manually: node scripts/checkpointAScreenshots.mjs
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const BASE_URL = process.env.SCREENSHOT_BASE_URL || 'http://localhost:5173'
const OUT_DIR = 'docs/superpowers/visual-review/2026-09-06-subproject2-checkpoint-a-wallpaper'

const viewports = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 375, height: 812 },
  { name: 'desktop-hires', width: 2560, height: 1440 },
]

mkdirSync(OUT_DIR, { recursive: true })

const browser = await chromium.launch()
try {
  for (const viewport of viewports) {
    const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height } })
    await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(300)
    const outPath = `${OUT_DIR}/landing-hero-${viewport.name}.png`
    await page.screenshot({ path: outPath, fullPage: true })
    console.log(`Saved ${outPath}`)
    await page.close()
  }
} finally {
  await browser.close()
}
