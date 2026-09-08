/**
 * Descarga las fuentes Google Fonts (OFL) y las autoaloja en public/fonts/.
 * Genera public/css/fonts.css con @font-face apuntando a rutas locales.
 * Uso: node src/scripts/fetch-fonts.mjs
 */
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const fontsDir = path.join(root, "public", "fonts");
const cssOut = path.join(root, "public", "css", "fonts.css");

const FAMILIES = [
  "family=Raleway:wght@400;600;700",
  "family=Tajawal:wght@400",
  "family=Inter:wght@400;500;600;700",
  "family=Poppins:wght@500;700",
];

const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";
const cssUrl = `https://fonts.googleapis.com/css2?${FAMILIES.join("&")}&display=swap`;

const res = await fetch(cssUrl, { headers: { "User-Agent": UA } });
if (!res.ok) {
  console.error(`Error descargando el CSS de Google Fonts: HTTP ${res.status}`);
  process.exit(1);
}
let css = await res.text();

fs.mkdirSync(fontsDir, { recursive: true });

const urls = [...new Set(
  [...css.matchAll(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/g)].map((m) => m[1])
)];
console.log(`${urls.length} fuentes woff2 a descargar`);

let downloaded = 0;
for (const url of urls) {
  const name = url.split("/").pop().split("?")[0];
  const dest = path.join(fontsDir, name);
  if (fs.existsSync(dest)) {
    css = css.replaceAll(url, `../fonts/${name}`);
    continue;
  }
  const r = await fetch(url, { headers: { "User-Agent": UA } });
  if (!r.ok) {
    console.error(`Error descargando ${url}: HTTP ${r.status}`);
    process.exit(1);
  }
  fs.writeFileSync(dest, Buffer.from(await r.arrayBuffer()));
  css = css.replaceAll(url, `../fonts/${name}`);
  downloaded += 1;
}

fs.writeFileSync(
  cssOut,
  "/* Fuentes autoalojadas (SIL Open Font License 1.1). Generado por src/scripts/fetch-fonts.mjs */\n" + css
);

console.log(`public/css/fonts.css escrito (${downloaded} nuevas, ${fs.readdirSync(fontsDir).length} totales).`);
