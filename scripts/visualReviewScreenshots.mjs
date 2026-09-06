// One-off script for Sub-project 1 visual checkpoints. Not part of the app
// build -- run manually with `node scripts/visualReviewScreenshots.mjs`.
// Requires the dev server already running at BASE_URL and `playwright`
// installed as a devDependency (npm install -D playwright && npx playwright
// install chromium).
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const BASE_URL = process.env.SCREENSHOT_BASE_URL || 'http://localhost:5176'
const OUT_DIR = 'docs/superpowers/visual-review/2026-09-06-subproject1-checkpoint'

const targets = [
  { path: '/about', name: 'about' },
  { path: '/internal/design-system', name: 'design-system' },
  { path: '/how-it-works', name: 'how-it-works' },
]

const viewports = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 375, height: 812 },
]

mkdirSync(OUT_DIR, { recursive: true })

const browser = await chromium.launch()
try {
  for (const target of targets) {
    for (const viewport of viewports) {
      const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height } })
      const url = `${BASE_URL}${target.path}`
      await page.goto(url, { waitUntil: 'networkidle' })
      const outPath = `${OUT_DIR}/${target.name}-${viewport.name}.png`
      await page.screenshot({ path: outPath, fullPage: true })
      console.log(`Saved ${outPath}`)
      await page.close()
    }
  }
} finally {
  await browser.close()
}
