const fs = require("fs");
const path = require("path");

const worksDir = path.join(__dirname, "content", "works");
const manifestPath = path.join(__dirname, "content", "works-manifest.json");

let files = [];

if (fs.existsSync(worksDir)) {
  files = fs.readdirSync(worksDir)
    .filter(f => f.endsWith(".json"))
    .sort();
}

fs.writeFileSync(manifestPath, JSON.stringify({ files }, null, 2));
console.log(`Manifest generated with ${files.length} works:`, files);
