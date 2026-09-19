import fs from "node:fs/promises";
import JSZip from "jszip";
import { geoArea, geoCentroid, geoMercator, geoPath } from "d3-geo";

await fs.mkdir("public/maps", { recursive: true });
await fs.mkdir("data", { recursive: true });
async function readRemote(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return response;
}
async function boundary(level) {
  const metadata = await (await readRemote(`https://www.geoboundaries.org/api/current/gbOpen/LBN/${level}/`)).json();
  let text = await (await readRemote(metadata.gjDownloadURL)).text();
  if (text.startsWith("version https://git-lfs")) {
    const raw = metadata.gjDownloadURL.replace("https://github.com/", "https://media.githubusercontent.com/media/").replace("/raw/", "/");
    text = await (await readRemote(raw)).text();
  }
  const geo = JSON.parse(text);
  await fs.writeFile(`public/maps/lebanon-${level.toLowerCase()}.geojson`, JSON.stringify(geo));
  await fs.writeFile(`public/maps/${level.toLowerCase()}-source.json`, JSON.stringify(metadata, null, 2));
  // d3-geo's spherical polygon convention is the reverse of RFC 7946 winding.
  for (const feature of geo.features) {
    if (geoArea(feature) > 2 * Math.PI) {
      const polygons = feature.geometry.type === "Polygon" ? [feature.geometry.coordinates] : feature.geometry.coordinates;
      polygons.forEach((polygon) => polygon.forEach((ring) => ring.reverse()));
    }
  }
  return geo;
}
const national = await boundary("ADM0");
const admin = await boundary("ADM1");
const projection = geoMercator().fitExtent([[90, 32], [495, 630]], national);
const path = geoPath(projection).digits(2);
const zip = await JSZip.loadAsync(await (await readRemote("https://download.geonames.org/export/dump/LB.zip")).arrayBuffer());
const rows = (await zip.file("LB.txt").async("string")).trim().split("\n").map((row) => row.split("\t"));
const candidates = rows.filter((row) => row[6] === "P");
console.log("City candidates:", candidates.filter((row) => /^(Beirut|Tripoli|Joun|Jbeil|Byblos|Zahl|Baal|Sidon|Saida|Tyre|Nabat)/i.test(row[2])).map((row) => ({id:row[0], name:row[2],lat:row[4],lon:row[5]})));
const names = [
  ["Beirut", ["Beirut"]], ["Tripoli", ["Tripoli", "Tripoli, Lebanon"]],
  ["Jounieh", ["Jounieh", "Jounie"]], ["Byblos", ["Byblos", "Jbeil"]],
  ["Zahle", ["Zahle", "Zahlah"]], ["Baalbek", ["Baalbek", "Baalbak"]],
  ["Saida", ["Sidon", "Saida"]], ["Tyre", ["Tyre", "Sour"]],
  ["Nabatieh", ["Nabatiye et Tahta", "Nabatiye", "Nabatieh"]],
];
const cities = names.map(([name, alternatives]) => {
  const matches = candidates.filter((row) => alternatives.some((alternative) => [row[1], row[2], ...row[3].split(",")].includes(alternative)));
  matches.sort((a,b) => Number(b[14]) - Number(a[14]));
  const row = matches[0];
  if (!row) throw new Error(`No sourced city found for ${name}`);
  const lon = Number(row[5]); const lat = Number(row[4]);
  const [x,y] = projection([lon,lat]);
  return { name, latitude:lat, longitude:lon, x:+x.toFixed(2), y:+y.toFixed(2), geonamesId:row[0] };
});
const normalized = { "Beyrouth": "Beirut", "Beqaa": "Bekaa", "Béqaa": "Bekaa", "Mont-Liban": "Mount Lebanon", "Nord": "North", "Liban-Nord": "North", "Sud": "South", "Liban-Sud": "South", "Nabatiye": "Nabatieh", "Nabatîyé": "Nabatieh", "Aakkâr": "Akkar" };
const regions = admin.features.map((feature) => {
  const sourceName = feature.properties.shapeName;
  const name = normalized[sourceName] || sourceName;
  const [x,y] = projection(geoCentroid(feature));
  return { name, sourceName, id:feature.properties.shapeID, path:path(feature), x:+x.toFixed(2), y:+y.toFixed(2) };
});
const map = { nationalPath:path(national), regions, cities, projection:{ scale:projection.scale(), translate:projection.translate() }, source:"geoBoundaries gbOpen ADM0 / ADM1; GeoNames LB", retrieved:new Date().toISOString().slice(0,10) };
await fs.writeFile("data/lebanon-map.json", JSON.stringify(map));
console.log("Map compiled:", regions.map((r)=>r.name), cities);
