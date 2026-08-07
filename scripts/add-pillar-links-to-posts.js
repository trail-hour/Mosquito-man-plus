// One-off migration: adds a "Related Service" block to every existing blog
// post, linking up to whichever Tier-2 use-case pillar (residential/events/
// commercial) actually matches the post's topic - not a random reciprocal
// link. Idempotent: skips any post that already has the block, so it's safe
// to re-run. Run once, then scripts/generate-blog-post.js handles new posts
// going forward (see the prompt/BASE_ALLOWED_HREFS changes there).
//
// Usage: node scripts/add-pillar-links-to-posts.js [--dry-run]

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const BLOG_DIR = path.join(ROOT, "blog");
const DRY_RUN = process.argv.includes("--dry-run");

const PILLARS = {
  events: {
    href: "../services/events.html",
    text: "our event mosquito spraying service",
    keywords: ["event spraying", "wedding", "backyard party", "one-time event", " bbq", "graduation party"],
  },
  commercial: {
    href: "../services/commercial.html",
    text: "our commercial mosquito control service",
    keywords: ["commercial", "restaurant", "patio business", "brewery", "campground", "property management"],
  },
  residential: {
    href: "../services/residential.html",
    text: "our residential mosquito control program",
    keywords: [],
  },
};

// Title-only, deliberately. A single incidental mention inside the article
// body ("waiting until a backyard party is already booked is a common
// mistake") doesn't mean the post's editorial topic is events - the title is
// the curated, reliable signal of what the post is actually about.
function pickPillar(title) {
  const haystack = title.toLowerCase();
  for (const key of ["events", "commercial"]) {
    if (PILLARS[key].keywords.some((kw) => haystack.includes(kw))) return key;
  }
  return "residential";
}

function main() {
  const files = fs.readdirSync(BLOG_DIR).filter((f) => f.endsWith(".html") && f !== "index.html" && f !== "template.html");
  let updated = 0;
  let skipped = 0;

  for (const file of files) {
    const filePath = path.join(BLOG_DIR, file);
    const content = fs.readFileSync(filePath, "utf8");

    if (content.includes("blog-related-service")) {
      skipped++;
      continue;
    }

    const metaMatch = content.match(/<!-- POST_META (\{.*?\}) -->/);
    const title = metaMatch ? (JSON.parse(metaMatch[1]).title || "") : "";
    const pillarKey = pickPillar(title);
    const pillar = PILLARS[pillarKey];

    const block = `      <section class="blog-related-service">
        <h3>Related Service</h3>
        <p>See <a href="${pillar.href}">${pillar.text}</a> for pricing factors, safety details, and FAQs.</p>
      </section>

`;

    // Insert right after blog-cta (or before blog-areas if present), matching
    // where the existing "Mosquito Control Near You" block sits.
    let updatedContent;
    if (content.includes('<section class="blog-areas">')) {
      updatedContent = content.replace('      <section class="blog-areas">', block + '      <section class="blog-areas">');
    } else if (content.includes("</article>")) {
      updatedContent = content.replace("    </article>", "  " + block + "    </article>");
    } else {
      console.log("SKIP (no insertion point found):", file);
      continue;
    }

    if (DRY_RUN) {
      console.log(`[dry run] Would add "${pillarKey}" pillar link to ${file} (title: "${title}")`);
    } else {
      fs.writeFileSync(filePath, updatedContent);
      console.log(`Added "${pillarKey}" pillar link to ${file}`);
    }
    updated++;
  }

  console.log("");
  console.log(`${DRY_RUN ? "[dry run] " : ""}Updated: ${updated}, already had block: ${skipped}, total: ${files.length}`);
}

main();
