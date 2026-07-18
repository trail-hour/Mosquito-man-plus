# Topic Cluster Plan: "mosquito control durham region"

**Site:** mosquitomanplus.com &nbsp;|&nbsp; **Generated:** 2026-07-17 &nbsp;|&nbsp; **This run's scope:** pillar only

## Why a separate pillar page (not the homepage)

`index.html` already targets "Mosquito Control in Oshawa, Durham Region & GTA" commercially
(booking intent). This cluster's pillar is a broad **informational** hub in `/blog/` that ties
the existing posts together and earns links/shares on its own, then funnels authority and
readers back to the homepage and `services.html`. Different intent, different template
(ultimate-guide vs. commercial service page) — not a cannibalization risk.

## Pillar

| Field | Value |
|---|---|
| Title | Mosquito Control Durham Region: The Complete Guide |
| Keyword | mosquito control durham region |
| Template | ultimate-guide |
| Target length | 2,500-4,000 words |
| URL | `blog/2026-07-17-mosquito-control-durham-region-complete-guide.html` |
| Status | **Written this run** |

## Clusters (4)

### Cluster 0 — Identification & Prevention
| Post | Keyword | Status |
|---|---|---|
| Mosquito Identification & Prevention in Durham Region | mosquito identification durham region | Written (existing) |
| Standing Water Mosquito Breeding: A Durham Region Guide | standing water mosquito breeding durham region | Written (existing) |
| What Attracts Mosquitoes to Your Yard in Durham Region | what attracts mosquitoes to your yard | Planned (gap) |

### Cluster 1 — Treatment Methods & Safety
| Post | Keyword | Status |
|---|---|---|
| Mosquito Spray Guide for Durham Region Homeowners | mosquito spray durham region | Written (existing) |
| Is Mosquito Spraying Safe for Pets and Kids in Durham Region? | mosquito spraying safe for pets and kids | Planned (gap) |
| DIY vs Professional Mosquito Control in Durham Region | diy vs professional mosquito control | Planned (gap) |

### Cluster 2 — Local Service Guides
| Post | Keyword | Status |
|---|---|---|
| Mosquito Control Oshawa: A Homeowner's Guide | mosquito control oshawa | Written (existing) |
| Mosquito Exterminator Whitby Ajax Pickering Guide | mosquito exterminator whitby ajax pickering | Written (existing) |
| Mosquito Control Cost in Durham Region: 2026 Pricing Guide | mosquito control cost durham region | Planned (gap) |

### Cluster 3 — Related Pests & Timing
| Post | Keyword | Status |
|---|---|---|
| Tick Control Durham: A Homeowner's Guide | tick control durham region | Written (existing) |
| Mosquito & Tick Season in Durham Region: When to Start Treatment | mosquito tick season durham region | Planned (gap) |

**Coverage this run:** 1/1 pillar written. 6/6 existing spokes now link to the pillar. 4 gap
spokes identified but not written (out of "pillar only" scope).

## Internal Links Implemented This Run

- Pillar → all 6 existing spokes (hub section, "Explore the Complete Guide")
- Pillar → `services.html`, `contact.html` (site convention)
- All 6 existing spokes → pillar (new backward link added near the top of each post)

## Deferred to Full Cluster Execution

- Writing the 4 gap spoke posts
- Spoke-to-spoke links within each cluster (2-3 per post)
- Cross-cluster links (0-1 per post)
- Cluster scorecard (coverage/link-density/orphan checks) — meaningless until gaps are filled

## Automation Note (read before running `/seo cluster execute` again)

`scripts/generate-blog-post.js` runs daily via `.github/workflows/daily-blog.yml`. It:
- Picks topics from a **fixed `TOPICS[]` array** — the 4 gap keywords above are not in it, so
  they will not be auto-generated as-is.
- **Strips any internal link that isn't `../services.html` or `../contact.html`**
  (`ALLOWED_LINK_HREFS`), so even if a gap topic were added to `TOPICS[]`, the automation would
  silently delete any pillar/spoke link Claude tried to write into it.

To auto-generate the remaining spokes with working cluster links, both `TOPICS[]` and
`ALLOWED_LINK_HREFS` need updating first. That's a separate, deliberate change — flagging it
here rather than making it as a side effect of this cluster plan.
