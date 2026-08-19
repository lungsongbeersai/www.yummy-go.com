import fs from "node:fs";
import path from "node:path";

function walk(dir, files = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const filePath = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(filePath, files);
    else if (/\.tsx?$/.test(ent.name)) files.push(filePath);
  }
  return files;
}

const files = walk("src");
let changed = 0;

for (const file of files) {
  let src = fs.readFileSync(file, "utf8");
  const orig = src;

  src = src.replace(
    /onChange=\{\(event\) => ([^}]+)\.target\.checked\}/g,
    "onCheckedChange={(checked) => $1checked}",
  );
  src = src.replace(
    /onChange=\{\(event\) => ([^}]+)\.currentTarget\.checked\}/g,
    "onCheckedChange={(checked) => $1checked}",
  );
  src = src.replace(/size="md"/g, 'size="default"');
  src = src.replace(
    /size=\{isMobile \? "md" : "sm"\}/g,
    'size={isMobile ? "default" : "sm"}',
  );
  src = src.replace(/\s*portalled=\{false\}\n/g, "\n");
  src = src.replace(
    /valueFormatter=\{\(value, name\) =>/g,
    "formatter={(value, name) =>",
  );

  if (src !== orig) {
    fs.writeFileSync(file, src);
    changed += 1;
    console.log(file);
  }
}

console.log(`changed ${changed} files`);
