const fs = require("fs");
const path = require("path");
const https = require("https");

const SOURCE_URLS = [
  "https://fastly.jsdelivr.net/gh/caijf/lcn@master/data/pca.json",
  "https://cdn.jsdelivr.net/gh/caijf/lcn@master/data/pca.json",
];

const OUTPUT_PATH = path.join(__dirname, "..", "data", "china-districts.generated.js");

function fetchText(url) {
  return new Promise((resolve, reject) => {
    https
      .get(
        url,
        {
          headers: {
            "User-Agent": "Mozilla/5.0 (district-sync-script)",
            Accept: "application/json,text/plain,*/*",
          },
        },
        (response) => {
          if (
            response.statusCode &&
            response.statusCode >= 300 &&
            response.statusCode < 400 &&
            response.headers.location
          ) {
            response.resume();
            resolve(fetchText(response.headers.location));
            return;
          }

          if (!response.statusCode || response.statusCode >= 400) {
            response.resume();
            reject(new Error(`Request failed: ${response.statusCode || "unknown"} ${url}`));
            return;
          }

          response.setEncoding("utf8");
          let body = "";
          response.on("data", (chunk) => {
            body += chunk;
          });
          response.on("end", () => resolve(body));
        },
      )
      .on("error", reject);
  });
}

async function fetchFromAny(urls) {
  const errors = [];
  for (const url of urls) {
    try {
      const text = await fetchText(url);
      return { text, sourceUrl: url };
    } catch (error) {
      errors.push(`${url} -> ${error.message}`);
    }
  }
  throw new Error(`All district sources failed:\n${errors.join("\n")}`);
}

function inferDistrictType(name) {
  const value = String(name || "").trim();
  if (value.endsWith("自治旗")) return ["autonomous_banner", "自治旗"];
  if (value.endsWith("自治县")) return ["autonomous_county", "自治县"];
  if (value.endsWith("林区")) return ["forest_area", "林区"];
  if (value.endsWith("特区")) return ["special_area", "特区"];
  if (value.endsWith("矿区")) return ["mining_area", "矿区"];
  if (value.endsWith("旗")) return ["banner", "旗"];
  if (value.endsWith("区")) return ["district", "区"];
  if (value.endsWith("县")) return ["county", "县"];
  if (value.endsWith("市")) return ["county_level_city", "县级市"];
  return ["other", "其他"];
}

function buildDistrictRecords(tree) {
  const districts = [];
  const summary = {
    province_count: Array.isArray(tree) ? tree.length : 0,
    city_count: 0,
    district_count: 0,
  };

  let sortOrder = 1;
  for (const province of tree || []) {
    const cities = Array.isArray(province.children) ? province.children : [];
    summary.city_count += cities.length;

    for (const city of cities) {
      const children = Array.isArray(city.children) ? city.children : [];
      for (const district of children) {
        const [districtType, districtTypeLabel] = inferDistrictType(district.name);
        districts.push({
          code: String(district.code || ""),
          name: String(district.name || ""),
          city_code: String(city.code || ""),
          city_name: String(city.name || ""),
          province_code: String(province.code || ""),
          province_name: String(province.name || ""),
          district_type: districtType,
          district_type_label: districtTypeLabel,
          full_name: `${province.name || ""} ${city.name || ""} ${district.name || ""}`.trim(),
          is_active: true,
          sort_order: sortOrder,
        });
        sortOrder += 1;
      }
    }
  }

  summary.district_count = districts.length;
  return { districts, summary };
}

async function main() {
  const { text, sourceUrl } = await fetchFromAny(SOURCE_URLS);
  const tree = JSON.parse(text);
  const { districts, summary } = buildDistrictRecords(tree);

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  const payload = {
    metadata: {
      generated_at: new Date().toISOString(),
      source_url: sourceUrl,
      source_repo: "https://github.com/caijf/lcn",
      source_basis:
        "caijf/lcn v7.x province-city-area snapshot, documented as based on 2024 MCA county-level administrative division codes.",
      ...summary,
    },
    districts,
  };

  const output = `module.exports = ${JSON.stringify(payload, null, 2)};\n`;
  fs.writeFileSync(OUTPUT_PATH, output, "utf8");

  console.log(`District snapshot written: ${OUTPUT_PATH}`);
  console.log(
    `Provinces=${summary.province_count}, cities=${summary.city_count}, districts=${summary.district_count}`,
  );
}

main().catch((error) => {
  console.error("District crawl failed:", error);
  process.exit(1);
});
