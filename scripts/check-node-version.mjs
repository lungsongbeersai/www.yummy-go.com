const minimum = [22, 0, 0];
const explicitVersion = process.argv[2] === "--version" ? process.argv[3] : undefined;
const currentVersion = explicitVersion ?? process.versions.node;
const match = /^v?(\d+)\.(\d+)\.(\d+)/.exec(currentVersion ?? "");

if (!match) {
  console.error(`Unable to parse Node.js version: ${currentVersion ?? "missing"}`);
  process.exit(1);
}

const actual = match.slice(1).map(Number);
let comparison = 0;

for (let index = 0; index < minimum.length; index += 1) {
  if (actual[index] === minimum[index]) continue;
  comparison = actual[index] > minimum[index] ? 1 : -1;
  break;
}

if (comparison < 0) {
  console.error(`Yummy Go requires Node.js >=22.0.0; received ${currentVersion}.`);
  process.exit(1);
}

console.log(`Node.js ${currentVersion} satisfies the Yummy Go runtime contract.`);
