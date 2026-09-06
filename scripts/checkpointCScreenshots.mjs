// Checkpoint C screenshot capture (Sub-Project 2 -- final homepage polish
// and completion). Run manually: node scripts/checkpointCScreenshots.mjs
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const BASE_URL = process.env.SCREENSHOT_BASE_URL || 'http://localhost:5173'
const OUT_DIR = 'docs/superpowers/visual-review/2026-09-06-subproject2-checkpoint-c-final'

mkdirSync(OUT_DIR, { recursive: true })

const browser = await chromium.launch()
try {
  // 1. Full-page desktop
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
    await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(300)
    await page.screenshot({ path: `${OUT_DIR}/01-desktop-full.png`, fullPage: true })
    console.log('Saved 01-desktop-full.png')

    // 2. Hero + first transition (top of page down through the start of
    //    the Positioning section, to inspect the hero -> section seam).
    await page.screenshot({ path: `${OUT_DIR}/02-hero-transition.png`, clip: { x: 0, y: 0, width: 1440, height: 1400 } })
    console.log('Saved 02-hero-transition.png')

    // 3. Middle/product sections (Current Focus through Progress) --
    //    scroll so Current Focus starts near the top, then capture the
    //    viewport (simpler and more robust than clip-region math).
    const currentFocusHeading = page.getByRole('heading', { name: /your next move should be obvious/i })
    await currentFocusHeading.scrollIntoViewIfNeeded()
    await page.evaluate(() => window.scrollBy(0, -80))
    await page.waitForTimeout(150)
    await page.screenshot({ path: `${OUT_DIR}/03-middle-sections.png` })
    console.log('Saved 03-middle-sections.png')

    // 4. Final CTA + footer transition.
    const finalHeading = page.getByRole('heading', { name: /your next opportunity is closer than you think/i })
    await finalHeading.scrollIntoViewIfNeeded()
    await page.evaluate(() => window.scrollBy(0, 250))
    await page.waitForTimeout(150)
    await page.screenshot({ path: `${OUT_DIR}/04-final-cta-footer.png` })
    console.log('Saved 04-final-cta-footer.png')
    await page.close()
  }

  // 5. Full-page mobile
  {
    const page = await browser.newPage({ viewport: { width: 375, height: 812 } })
    await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(300)
    await page.screenshot({ path: `${OUT_DIR}/05-mobile-full.png`, fullPage: true })
    console.log('Saved 05-mobile-full.png')
    await page.close()
  }

  // 6. Representative tablet view (iPad Air portrait, 820x1180 -- lands
  //    squarely between the sm: and lg: breakpoints used throughout).
  {
    const page = await browser.newPage({ viewport: { width: 820, height: 1180 } })
    await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(300)
    await page.screenshot({ path: `${OUT_DIR}/06-tablet-full.png`, fullPage: true })
    console.log('Saved 06-tablet-full.png')
    await page.close()
  }
} finally {
  await browser.close()
}
