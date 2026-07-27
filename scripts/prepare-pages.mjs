import { copyFile, mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const outputDirectory = fileURLToPath(
  new URL("../dist-pages/", import.meta.url),
);
const rootDocument = `${outputDirectory}/index.html`;
const demoDirectory = `${outputDirectory}/demo`;

await mkdir(demoDirectory, { recursive: true });
await copyFile(rootDocument, `${demoDirectory}/index.html`);
await copyFile(rootDocument, `${outputDirectory}/404.html`);
await writeFile(`${outputDirectory}/.nojekyll`, "");
