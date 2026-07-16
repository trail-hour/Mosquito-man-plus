// Generates one SEO blog post per run, renders it from blog/template.html,
// writes it into blog/, rebuilds the blog/index.html card grid, and
// regenerates sitemap.xml. Run with --dry-run to test the whole pipeline
// (templating, TOC/FAQ building, sitemap) without calling the Anthropic API.
//
// Topic + angle are chosen deterministically from how many posts already
// exist (no separate state file to keep in sync) so re-running the workflow
// naturally advances to the next combination in the rotation.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const BLOG_DIR = path.join(ROOT, "blog");
const TEMPLATE_PATH = path.join(BLOG_DIR, "template.html");
const INDEX_PATH = path.join(BLOG_DIR, "index.html");
const SITEMAP_PATH = path.join(ROOT, "sitemap.xml");
const SITE_URL = "https://mosquitomanplus.com";

// Fixed lastmod for the pages this job never touches. Update by hand if you
// substantially edit one of these pages.
const STATIC_PAGE_LASTMOD = "2026-07-11";
const AREA_PAGE_LASTMOD = "2026-07-12";
const AREA_SLUGS = [
  "oshawa", "whitby", "ajax", "pickering", "clarington", "bowmanville",
  "courtice", "newcastle", "brooklin", "port-perry", "scugog", "uxbridge",
  "scarborough", "north-york", "mississauga", "vaughan",
];
const STATIC_PAGES = [
  { loc: `${SITE_URL}/`, lastmod: STATIC_PAGE_LASTMOD },
  { loc: `${SITE_URL}/about.html`, lastmod: STATIC_PAGE_LASTMOD },
  { loc: `${SITE_URL}/services.html`, lastmod: STATIC_PAGE_LASTMOD },
  { loc: `${SITE_URL}/areas.html`, lastmod: STATIC_PAGE_LASTMOD },
  ...AREA_SLUGS.map((slug) => ({ loc: `${SITE_URL}/areas/${slug}.html`, lastmod: AREA_PAGE_LASTMOD })),
  { loc: `${SITE_URL}/contact.html`, lastmod: STATIC_PAGE_LASTMOD },
];

const MODEL = "claude-sonnet-5";
const DRY_RUN = process.argv.includes("--dry-run");

const TOPICS = [
  "mosquito control Oshawa",
  "mosquito spray Durham Region",
  "backyard mosquito treatment",
  "tick control Durham",
  "mosquito exterminator Whitby Ajax Pickering",
  "standing water mosquito breeding",
  "GTA mosquito season",
  "event spraying Durham",
  "mosquito control Oshawa Ontario",
  "mosquito exterminator Whitby Ontario",
  "mosquito spray Ajax Ontario",
  "mosquito control Pickering Ontario",
  "mosquito treatment Clarington Ontario",
  "mosquito control Bowmanville Ontario",
  "tick control Durham Region Ontario",
  "mosquito control Courtice Ontario",
  "mosquito spray Brooklin Ontario",
  "mosquito control Port Perry Ontario",
  "backyard mosquito treatment GTA",
  "mosquito control Scarborough Ontario",
  "mosquito spray North York Ontario",
  "mosquito control Mississauga Ontario",
  "mosquito exterminator Vaughan Ontario",
];

// Paired with topics to keep 30 posts/month from reading as near-duplicates
// of each other — same keyword, different real angle each rotation.
const ANGLES = [
  "a complete homeowner's guide",
  "a practical checklist",
  "a myths vs. facts breakdown",
  "a seasonal advisory",
  "a homeowner FAQ",
  "a cost and pricing guide",
  "a before-and-after treatment guide",
  "an expert Q&A",
];

// The only two internal links a generated post is allowed to contain.
// Anything else Claude produces gets stripped in sanitizeInternalLinks().
const ALLOWED_LINK_HREFS = new Set(["../services.html", "../contact.html"]);

function slugify(text) {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60)
    .replace(/-$/, "");
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function truncate(str, max) {
  if (str.length <= max) return str;
  const cut = str.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd() + "…";
}

// HTML comments can't contain "--", which JSON.stringify could emit inside a
// string value (e.g. a title with an em dash pair) — swap it out so the
// comment stays well-formed.
function jsonForHtmlComment(obj) {
  return JSON.stringify(obj).replace(/--/g, "––");
}

function listExistingPostFiles() {
  if (!fs.existsSync(BLOG_DIR)) return [];
  return fs
    .readdirSync(BLOG_DIR)
    .filter((file) => file.endsWith(".html") && file !== "index.html" && file !== "template.html");
}

function readPostMeta(filename) {
  const contents = fs.readFileSync(path.join(BLOG_DIR, filename), "utf8");
  const match = contents.match(/<!-- POST_META (\{.*?\}) -->/);
  if (!match) return null;
  try {
    return { ...JSON.parse(match[1]), file: filename };
  } catch {
    return null;
  }
}

function getTorontoDateParts(date = new Date()) {
  const iso = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date); // 2026-07-15
  const display = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Toronto",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date); // July 15, 2026
  return { iso, display };
}

async function callClaude(topic, angle) {
  const prompt = `You are writing an SEO blog post for Mosquito Man Plus, a mosquito control company based in Oshawa, Ontario, serving Durham Region and the GTA (Whitby, Ajax, Pickering, Clarington, Bowmanville, Courtice, Newcastle, Brooklin, Port Perry, Scugog, Uxbridge, Brock, Scarborough, North York, Mississauga, Vaughan). Phone: 905-924-2847.

Write the post as ${angle}, targeting this topic/keyword: "${topic}".

Requirements:
- Body (excluding FAQ) must be 900-1100 words.
- Written for homeowners in Durham Region / GTA: plain, helpful, not sales-heavy.
- Title must include the primary keyword AND a location (e.g. Oshawa, Durham Region, or GTA), and must be under 60 characters.
- Use H2 subheadings that include related keywords/phrases (not generic labels like "Introduction").
- Naturally mention "Mosquito Man Plus" and at least two specific service areas (e.g. Oshawa, Whitby, Ajax, Pickering, Durham Region, GTA) throughout the body — not just once at the start.
- If the topic above names a specific city or region (e.g. Oshawa, Whitby, Ajax, Pickering, Clarington, Bowmanville, Courtice, Brooklin, Port Perry, Scarborough, North York, Mississauga, Vaughan, Durham Region, GTA), mention that exact place name naturally 4-5 times spread across the article, not clustered in one paragraph — it should read as a resident would write it, not as keyword stuffing.
- Include exactly ONE internal link with href="../services.html" (anchor text naturally referencing our mosquito control services) and exactly ONE internal link with href="../contact.html" (anchor text naturally inviting the reader to request a quote). Place both naturally inside body paragraphs. Do not include any other links.
- Use semantic HTML only in bodyHtml: <p>, <h2>, <h3>, <ul>, <ol>, <li>, and the two <a href="..."> links described above. No <h1> (rendered separately). No inline styles, no <script>, no <img>, no markdown formatting.
- Do NOT invent statistics, scientific studies, awards, certifications, or customer testimonials/reviews. Only mention these verified facts if relevant: Mosquito Man Plus is Oshawa-based, uses EPA/PMRA-registered products, and offers a return-visit guarantee on seasonal programs.
- Do NOT include a closing sales pitch, "About the Author" text, or contact details in bodyHtml — those are appended separately by the site template.
- Do NOT repeat the title verbatim as a heading inside the body.
- faq must contain 4-5 realistic homeowner questions related to "${topic}", each with a plain-text (no HTML) answer of 1-3 sentences.
- keyTakeaways must contain 3-5 short plain-text bullet points summarizing the article's most useful points.
- tldr must be 2-3 plain-text sentences summarizing the whole article.

Respond with ONLY a single JSON object (no markdown code fences, no commentary) with exactly these keys:
{
  "title": "SEO title, <=60 characters, includes keyword + location, no quotation marks",
  "metaDescription": "<=155 characters",
  "excerpt": "one sentence teaser for a blog listing card, under 160 characters",
  "tldr": "2-3 plain-text sentences",
  "keyTakeaways": ["plain-text bullet", "plain-text bullet", "plain-text bullet"],
  "bodyHtml": "the article body as a single HTML string using only the tags listed above",
  "faq": [{"question": "...", "answer": "plain-text answer"}]
}`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 5000,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  const rawBody = await response.text();
  console.log(`Anthropic API response (status ${response.status}):`, rawBody);

  if (!response.ok) {
    throw new Error(`Anthropic API error ${response.status}: ${rawBody}`);
  }

  let data;
  try {
    data = JSON.parse(rawBody);
  } catch (error) {
    throw new Error(`Anthropic API returned non-JSON response:\n${rawBody}`);
  }

  // Normally the text is the first content block, but fall back to scanning
  // for a "text" block in case Claude ever returns other block types first.
  const textBlock =
    (Array.isArray(data.content) && data.content.find((block) => block?.type === "text")) || data.content?.[0];
  const text = textBlock?.text;
  if (!text) throw new Error(`Anthropic API response had no text content:\n${JSON.stringify(data, null, 2)}`);

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error(`Could not find JSON in Claude response:\n${text}`);

  const parsed = JSON.parse(jsonMatch[0]);
  for (const key of ["title", "metaDescription", "excerpt", "tldr", "keyTakeaways", "bodyHtml", "faq"]) {
    if (!parsed[key]) throw new Error(`Claude response missing "${key}"`);
  }
  return parsed;
}

// Looks up one photo for the post's topic via the Pexels API. Never throws —
// a failed/missing lookup just means the post publishes without a featured
// image rather than failing the whole daily run.
async function fetchPexelsImage(topic) {
  const apiKey = process.env.PEXELS_API_KEY;
  if (!apiKey) {
    console.warn("PEXELS_API_KEY not set — skipping featured image");
    return null;
  }

  try {
    const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(topic)}&per_page=1`;
    const response = await fetch(url, { headers: { Authorization: apiKey } });

    if (!response.ok) {
      console.warn(`Pexels API error ${response.status}: ${await response.text()}`);
      return null;
    }

    const data = await response.json();
    const photo = data.photos?.[0];
    if (!photo) {
      console.warn(`No Pexels photo found for query "${topic}"`);
      return null;
    }

    return { url: photo.src.large, photographer: photo.photographer };
  } catch (error) {
    console.warn(`Pexels fetch failed: ${error.message}`);
    return null;
  }
}

function buildFeaturedImageHtml(image, topic) {
  if (!image) return "";
  return `<figure class="blog-featured-image"><img src="${escapeHtml(image.url)}" alt="${escapeHtml(topic)}" loading="lazy"><figcaption>Photo by ${escapeHtml(image.photographer)} on Pexels</figcaption></figure>`;
}

function uniqueSlugAndFilename(baseSlug, dateIso) {
  let slug = baseSlug;
  let attempt = 1;
  while (fs.existsSync(path.join(BLOG_DIR, `${dateIso}-${slug}.html`))) {
    attempt += 1;
    slug = `${baseSlug}-${attempt}`;
  }
  return { slug, filename: `${dateIso}-${slug}.html` };
}

// Strips any <a> tag whose href isn't one of the two whitelisted relative
// links, keeping the visible text. Guards against a hallucinated/broken URL
// making it into a fully unsupervised daily publish.
function sanitizeInternalLinks(bodyHtml) {
  const found = new Set();
  const cleaned = bodyHtml.replace(/<a\s+href="([^"]*)"[^>]*>(.*?)<\/a>/gi, (match, href, inner) => {
    if (ALLOWED_LINK_HREFS.has(href)) {
      found.add(href);
      return match;
    }
    return inner;
  });
  for (const href of ALLOWED_LINK_HREFS) {
    if (!found.has(href)) console.warn(`Warning: expected internal link to "${href}" was missing or stripped`);
  }
  return cleaned;
}

// Adds an id to every <h2> in bodyHtml and returns both the updated HTML and
// the ordered list of {id, text} entries used to build the table of contents.
function injectHeadingIdsAndBuildToc(bodyHtml) {
  const usedIds = new Set();
  const toc = [];
  let counter = 0;

  const updated = bodyHtml.replace(/<h2>(.*?)<\/h2>/gi, (match, inner) => {
    counter += 1;
    const plainText = inner.replace(/<[^>]+>/g, "");
    let id = slugify(plainText) || `section-${counter}`;
    let uniqueId = id;
    let n = 2;
    while (usedIds.has(uniqueId)) {
      uniqueId = `${id}-${n}`;
      n += 1;
    }
    usedIds.add(uniqueId);
    toc.push({ id: uniqueId, text: plainText });
    return `<h2 id="${uniqueId}">${inner}</h2>`;
  });

  return { bodyHtml: updated, toc };
}

function buildTldrHtml(tldr) {
  return `<div class="blog-tldr"><p class="blog-tldr-label">TL;DR</p><p>${escapeHtml(tldr)}</p></div>`;
}

function buildKeyTakeawaysHtml(keyTakeaways) {
  const items = keyTakeaways.map((point) => `<li>${escapeHtml(point)}</li>`).join("");
  return `<div class="blog-takeaways"><p class="blog-takeaways-label">Key Takeaways</p><ul>${items}</ul></div>`;
}

function buildTocHtml(toc) {
  if (!toc.length) return "";
  const items = toc.map((entry) => `<li><a href="#${entry.id}">${escapeHtml(entry.text)}</a></li>`).join("");
  return `<nav class="blog-toc" aria-label="Table of contents"><p class="blog-toc-title">In This Article</p><ol>${items}</ol></nav>`;
}

function buildFaqSectionHtml(faq) {
  if (!faq.length) return "";
  const items = faq
    .map((item) => `<h3>${escapeHtml(item.question)}</h3><p>${escapeHtml(item.answer)}</p>`)
    .join("");
  return `<div class="blog-faq"><h2 id="faq">Frequently Asked Questions</h2>${items}</div>`;
}

function buildArticleSchema({ title, metaDescription, dateIso, slug }) {
  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Article",
    headline: title,
    description: metaDescription,
    datePublished: dateIso,
    dateModified: dateIso,
    author: { "@type": "Organization", name: "Mosquito Man Plus" },
    publisher: {
      "@type": "Organization",
      name: "Mosquito Man Plus",
      logo: { "@type": "ImageObject", url: `${SITE_URL}/assets/img/logo.png` },
    },
    mainEntityOfPage: `${SITE_URL}/blog/${slug}.html`,
  });
}

function buildFaqSchemaScript(faq) {
  if (!faq.length) return "";
  const schema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };
  return `<script type="application/ld+json">${JSON.stringify(schema)}</script>`;
}

function renderCard(post) {
  return `      <article class="blog-card reveal">
        <a href="${post.file}" aria-label="Read ${escapeHtml(post.title)}">
          <div class="blog-card-content">
            <span class="blog-card-date">${escapeHtml(post.dateDisplay || post.date)}</span>
            <h3>${escapeHtml(post.title)}</h3>
            <p>${escapeHtml(post.excerpt)}</p>
            <span class="text-link">Read Article &rarr;</span>
          </div>
        </a>
      </article>`;
}

function getAllPostMeta() {
  return listExistingPostFiles()
    .map(readPostMeta)
    .filter(Boolean)
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.file < b.file ? 1 : -1));
}

function rebuildIndex(posts) {
  const gridHtml = posts.length
    ? posts.map(renderCard).join("\n")
    : `      <p class="blog-empty">New posts are on their way — check back soon.</p>`;

  const indexHtml = fs.readFileSync(INDEX_PATH, "utf8");
  const updated = indexHtml.replace(
    /<!-- BLOG_POSTS_START -->[\s\S]*?<!-- BLOG_POSTS_END -->/,
    `<!-- BLOG_POSTS_START -->\n${gridHtml}\n      <!-- BLOG_POSTS_END -->`
  );
  fs.writeFileSync(INDEX_PATH, updated);
}

function buildSitemap(posts, blogIndexLastmod) {
  const urls = [
    ...STATIC_PAGES,
    { loc: `${SITE_URL}/blog/`, lastmod: blogIndexLastmod },
    ...posts.map((post) => ({ loc: `${SITE_URL}/blog/${post.file}`, lastmod: post.date })),
  ];

  const urlEntries = urls
    .map((url) => `  <url>\n    <loc>${url.loc}</loc>\n    <lastmod>${url.lastmod}</lastmod>\n  </url>`)
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urlEntries}\n</urlset>\n`;
  fs.writeFileSync(SITEMAP_PATH, xml);
}

async function main() {
  const existingCount = listExistingPostFiles().length;
  const topic = TOPICS[existingCount % TOPICS.length];
  const angle = ANGLES[Math.floor(existingCount / TOPICS.length) % ANGLES.length];

  console.log(`Generating post #${existingCount + 1}: topic="${topic}", angle="${angle}"${DRY_RUN ? " [dry run]" : ""}`);

  const raw = DRY_RUN
    ? {
        title: `[Dry Run] ${topic} Guide — Oshawa`,
        metaDescription: `Dry-run test post about ${topic}.`,
        excerpt: `A dry-run test excerpt about ${topic}.`,
        tldr: "This is a dry-run TL;DR used to test the templating pipeline without calling the Anthropic API.",
        keyTakeaways: ["Dry-run takeaway one.", "Dry-run takeaway two.", "Dry-run takeaway three."],
        bodyHtml:
          '<h2>First Section</h2><p>Dry-run placeholder paragraph. Read more about our <a href="../services.html">mosquito control services</a>.</p><h2>Second Section</h2><p>Another placeholder paragraph. <a href="../contact.html">Request a quote</a> to test the link.</p>',
        faq: [{ question: "Is this a real post?", answer: "No, this is dry-run test content." }],
      }
    : await callClaude(topic, angle);

  const image = DRY_RUN
    ? { url: "https://images.pexels.com/photos/0000000/dry-run-placeholder.jpg", photographer: "Dry Run Photographer" }
    : await fetchPexelsImage(topic);

  const title = truncate(raw.title, 60);
  const metaDescription = truncate(raw.metaDescription, 155);

  const { iso: dateIso, display: dateDisplay } = getTorontoDateParts();
  const baseSlug = slugify(title) || `post-${dateIso}`;
  const { slug, filename } = uniqueSlugAndFilename(baseSlug, dateIso);

  const sanitizedBody = sanitizeInternalLinks(raw.bodyHtml);
  const { bodyHtml, toc } = injectHeadingIdsAndBuildToc(sanitizedBody);
  if (raw.faq.length) toc.push({ id: "faq", text: "Frequently Asked Questions" });

  const meta = { title, date: dateIso, dateDisplay, slug, excerpt: raw.excerpt };

  const template = fs.readFileSync(TEMPLATE_PATH, "utf8");
  const rendered = template
    .replaceAll("{{POST_META_JSON}}", jsonForHtmlComment(meta))
    .replaceAll("{{TITLE}}", escapeHtml(title))
    .replaceAll("{{META_DESCRIPTION}}", escapeHtml(metaDescription))
    .replaceAll("{{DATE_ISO}}", dateIso)
    .replaceAll("{{DATE_DISPLAY}}", dateDisplay)
    .replaceAll("{{SLUG}}", slug)
    .replaceAll("{{ARTICLE_SCHEMA_JSON}}", buildArticleSchema({ title, metaDescription, dateIso, slug }))
    .replaceAll("{{FAQ_SCHEMA_SCRIPT}}", buildFaqSchemaScript(raw.faq))
    .replaceAll("{{TLDR_HTML}}", buildTldrHtml(raw.tldr))
    .replaceAll("{{FEATURED_IMAGE_HTML}}", buildFeaturedImageHtml(image, topic))
    .replaceAll("{{KEY_TAKEAWAYS_HTML}}", buildKeyTakeawaysHtml(raw.keyTakeaways))
    .replaceAll("{{TOC_HTML}}", buildTocHtml(toc))
    .replaceAll("{{BODY_HTML}}", bodyHtml)
    .replaceAll("{{FAQ_SECTION_HTML}}", buildFaqSectionHtml(raw.faq));

  fs.writeFileSync(path.join(BLOG_DIR, filename), rendered);
  console.log(`Wrote blog/${filename}`);

  const allPosts = getAllPostMeta();
  rebuildIndex(allPosts);
  console.log("Rebuilt blog/index.html");

  buildSitemap(allPosts, dateIso);
  console.log("Rebuilt sitemap.xml");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
