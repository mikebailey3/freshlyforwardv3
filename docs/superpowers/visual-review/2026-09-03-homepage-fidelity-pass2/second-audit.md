# Second Visual-Difference Audit — Homepage North Star Fidelity Pass 2

Date: 2026-09-04
Reference: `public/images/A63B5E0B-0AE1-4D9A-B05D-9C52403721C7.png` (864x1821)
Implementation: `final-desktop.png` (1440x6260), captured against the actual running dev server.
Objective diff tool: `scripts/visual_diff.py` (PIL-based per-pixel diff, no new dependency).

## Headline number and why it's not the real story

Raw pixel-diff: **75.83%** of pixels differ beyond tolerance. This number is dominated by a
resize-registration artifact, not real design defects: the reference is 2.11x taller than wide;
our page is currently 4.35x taller than wide (6260/1440). Forcing our screenshot into the
reference's exact pixel dimensions vertically squashes/misaligns everything below the fold, which
inflates the diff percentage without reflecting an actual visual mismatch. Confirmed via the
heatmap (`diff-heatmap.png`): the hero region — which both images occupy at roughly the same
relative position — shows near-perfect ghosted overlap of the "Your Career / Operating System /
for What's Next." headline, while drift increases monotonically further down the page purely as a
function of the accumulated height difference.

## Why the overall page is still taller than the reference

This pass's approved scope (see `docs/superpowers/specs/2026-09-03-homepage-north-star-fidelity-design.md`
section 1a) explicitly excluded general vertical-density reduction. Only Task 7 (FAQ padding) did
any density work, and it was intentionally modest (22px -> 14px row padding). The following
reference-implied density reductions were explicitly deferred, not missed:
- How It Works spacing tightening (spec 3.3) — deferred to a later pass.
- Final CTA multi-milestone rebuild (spec 3.9) — deferred to a later pass.
- Pricing/Kickstarter section (spec 3.7) — explicitly out of scope, not investigated at all.

None of these are regressions introduced by this pass; they're pre-existing and were never
approved for this round of work.

## Section-by-section verdict (only the 7 in-scope tasks)

| Section | Verdict | Notes |
|---|---|---|
| Header (Task 1) | Match | Dark/transparent navy header, white logo (real fix, verified in real browser), white/mint nav, seamless hero transition. |
| Hero (Tasks 2+3) | Match | Bold sans headline, unboxed glowing FreshFit ring, path-to-arrow motif, tight card cluster — closely tracks reference's composition and, per the heatmap, is pixel-aligned at the top of the page. |
| Powerful Tools (Task 4) | Match | Light/cream outer section, solid dark cards, legible white titles — matches reference's light-outer/dark-card model. Career Vault card content untouched (confirmed by earlier task review + this diff). |
| Human Support (Task 5) | Match | Text-left/image-right, truthful overlay card in place of reference's fabricated testimonial. Anchor/mobile-overflow bugs found and fixed in review before this audit. |
| Why FreshlyForward (Task 6) | Match | Inset rounded navy panel on light background, same structure as reference. |
| FAQ (Task 7) | Match | Tighter row density on the existing light two-column layout; `FaqPage.tsx` confirmed unaffected. |
| Typography | Match | Homepage-only sans-serif hero headline confirmed via real-browser screenshot; global Fraunces h1/h2/h3 rule elsewhere untouched (15+ other pages unaffected). |

## Untouched-by-design sections (confirmed still untouched)

- **Career Vault**: `FlagshipVaultPreview.tsx` and its "Coming Soon" badge — not modified by any
  commit in this pass (verified via `git log --follow` showing no touches since before this pass
  started).
- **Pricing**: `PricingTeaser` / `PricingPage` / membership_plans data flow — not investigated or
  modified, per explicit scope exclusion.

## Conclusion

No material mismatches found within this pass's actual approved scope. The high raw pixel-diff
number is an artifact of comparing a taller page to a shorter reference via forced resize, not a
sign of missed work — confirmed by direct visual side-by-side inspection
(`side-by-side.png`, height-normalized rather than aspect-distorted) and by the heatmap's own
alignment pattern. Recommending this pass be marked complete; general density reduction (How It
Works, Final CTA, Pricing/Kickstarter) remains correctly queued as separate, later, explicitly-
scoped work per the spec.
