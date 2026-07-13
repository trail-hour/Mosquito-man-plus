import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BLOG_DIR = path.join(__dirname, "..", "blog");
const SITE_URL = "https://www.mosquitomanplus.com";
const MAX_SUMMARY_LENGTH = 1500;

function truncate(str, max) {
  if (str.length <= max) return str;
  const cut = str.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd() + "…";
}

function findNewestPostFile() {
  const files = fs
    .readdirSync(BLOG_DIR)
    .filter((file) => /^\d{4}-\d{2}-\d{2}-.*\.html$/.test(file))
    .sort();
  if (!files.length) throw new Error(`No dated post files found in ${BLOG_DIR}`);
  return files[files.length - 1];
}

function readPostMeta(filename) {
  const contents = fs.readFileSync(path.join(BLOG_DIR, filename), "utf8");
  const match = contents.match(/<!-- POST_META (\{.*?\}) -->/);
  if (!match) throw new Error(`No POST_META comment found in ${filename}`);
  return JSON.parse(match[1].replace(/––/g, "--"));
}

async function main() {
  const { GBP_ACCESS_TOKEN, GBP_ACCOUNT_ID, GBP_LOCATION_ID } = process.env;
  if (!GBP_ACCESS_TOKEN) throw new Error("Missing GBP_ACCESS_TOKEN");
  if (!GBP_ACCOUNT_ID) throw new Error("Missing GBP_ACCOUNT_ID");
  if (!GBP_LOCATION_ID) throw new Error("Missing GBP_LOCATION_ID");

  const filename = findNewestPostFile();
  const meta = readPostMeta(filename);
  const postUrl = `${SITE_URL}/blog/${filename}`;

  const summary = truncate(`${meta.title}: ${meta.excerpt}`, MAX_SUMMARY_LENGTH);

  console.log(`Posting "${meta.title}" (${filename}) to Google Business Profile...`);

  const endpoint = `https://mybusiness.googleapis.com/v4/accounts/${GBP_ACCOUNT_ID}/locations/${GBP_LOCATION_ID}/localPosts`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${GBP_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      languageCode: "en-US",
      summary,
      topicType: "STANDARD",
      callToAction: {
        actionType: "LEARN_MORE",
        url: postUrl,
      },
    }),
  });

  const body = await response.text();

  if (!response.ok) {
    console.error(`GBP post failed: ${response.status} ${response.statusText}`);
    console.error(body);
    throw new Error(`GBP API returned ${response.status}`);
  }

  console.log(`GBP post succeeded for ${postUrl}`);
  console.log(body);
}

main().catch((err) => {
  console.error(`GBP post failed: ${err.message}`);
  process.exit(1);
});
