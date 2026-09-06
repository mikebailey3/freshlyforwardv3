// One-off script for Sub-project 1 visual checkpoints. Not part of the app
// build -- run manually with `node scripts/visualReviewScreenshots.mjs`.
// Requires the dev server already running at BASE_URL and `playwright`
// installed as a devDependency (npm install -D playwright && npx playwright
// install chromium).
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const BASE_URL = process.env.SCREENSHOT_BASE_URL || 'http://localhost:5176'
const OUT_DIR = 'docs/superpowers/visual-review/2026-09-06-task29-public-marketing'

const targets = [
  { path: '/', name: 'landing' },
  { path: '/how-it-works', name: 'how-it-works' },
  { path: '/pricing', name: 'pricing' },
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
      // Trigger any one-shot IntersectionObserver scroll-reveal animations
      // (e.g. AlternatingRow, LandingPage's verdict section) before
      // capturing -- otherwise below-the-fold content still shows as
      // opacity-0 in a fullPage screenshot. scrollIntoView guarantees each
      // element crosses the visibility threshold, unlike blind scroll steps.
      await page.evaluate(async () => {
        const targets = document.querySelectorAll('[class*="duration-700"]')
        for (const el of targets) {
          el.scrollIntoView({ block: 'center' })
          await new Promise((r) => setTimeout(r, 150))
        }
        window.scrollTo(0, 0)
        await new Promise((r) => setTimeout(r, 300))
      })
      const outPath = `${OUT_DIR}/${target.name}-${viewport.name}.png`
      await page.screenshot({ path: outPath, fullPage: true })
      console.log(`Saved ${outPath}`)
      await page.close()
    }
  }
} finally {
  await browser.close()
}
