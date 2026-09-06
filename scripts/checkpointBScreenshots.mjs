// Checkpoint B screenshot capture (Sub-Project 2 -- middle homepage
// composition: Positioning, Current Focus, FreshFit, Forward Profile,
// Human + AI, Progress, Final CTA). Run manually: node scripts/checkpointBScreenshots.mjs
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const BASE_URL = process.env.SCREENSHOT_BASE_URL || 'http://localhost:5173'
const OUT_DIR = 'docs/superpowers/visual-review/2026-09-06-subproject2-checkpoint-b-homepage'

// Section headings used to locate each focused-screenshot target -- matches
// the exact <h2> copy in LandingPage.tsx.
const SECTION_HEADINGS = [
  { name: 'current-focus', pattern: /your next move should be obvious/i },
  { name: 'freshfit', pattern: /it's not just a score/i },
  { name: 'forward-profile', pattern: /your career story, finally connected/i },
  { name: 'human-ai', pattern: /a better search needs better judgment/i },
]

mkdirSync(OUT_DIR, { recursive: true })

const browser = await chromium.launch()
try {
  // Full-page desktop + mobile captures.
  for (const viewport of [
    { name: 'desktop-full', width: 1440, height: 900 },
    { name: 'mobile-full', width: 375, height: 812 },
  ]) {
    const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height } })
    await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(300)
    const outPath = `${OUT_DIR}/homepage-${viewport.name}.png`
    await page.screenshot({ path: outPath, fullPage: true })
    console.log(`Saved ${outPath}`)
    await page.close()
  }

  // Focused desktop section crops.
  const sectionPage = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  await sectionPage.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' })
  await sectionPage.waitForTimeout(300)
  for (const section of SECTION_HEADINGS) {
    const heading = sectionPage.getByRole('heading', { name: section.pattern })
    const locator = heading.locator('xpath=ancestor::section[1]')
    const outPath = `${OUT_DIR}/section-${section.name}.png`
    await locator.screenshot({ path: outPath })
    console.log(`Saved ${outPath}`)
  }
  await sectionPage.close()
} finally {
  await browser.close()
}
