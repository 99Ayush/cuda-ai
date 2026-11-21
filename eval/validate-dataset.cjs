const fs = require("node:fs");
const path = require("node:path");

const dataDir = path.join(__dirname, "data");
const claimsPath = path.join(dataDir, "claims.json");
const provenancePath = path.join(dataDir, "provenance.json");
const allowedVerdicts = new Set(["TRUE", "FALSE", "MIXED", "UNVERIFIED"]);
const requiredCaseFields = ["id", "input", "expected", "category", "label_method", "license"];

function check(name, condition, detail) {
  return { name, ok: Boolean(condition), detail };
}

function readJson(file) {
  if (!fs.existsSync(file))
    throw new Error(
      `Missing ${path.relative(process.cwd(), file)}. Run eval/build-dataset.cjs first.`,
    );
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function validate() {
  const checks = [];
  let claims;
  let provenance;

  try {
    claims = readJson(claimsPath);
    provenance = readJson(provenancePath);
    checks.push(check("dataset files readable", true, "claims.json and provenance.json parsed"));
  } catch (error) {
    checks.push(check("dataset files readable", false, error.message));
    return { ok: false, checks };
  }

  checks.push(
    check(
      "claims is a non-empty array",
      Array.isArray(claims) && claims.length > 0,
      `${Array.isArray(claims) ? claims.length : typeof claims} cases`,
    ),
  );
  if (!Array.isArray(claims)) return { ok: false, checks };

  const ids = claims.map((item) => item && item.id);
  checks.push(
    check(
      "case ids are unique strings",
      new Set(ids).size === ids.length &&
        ids.every((id) => typeof id === "string" && id.length > 0),
      `${new Set(ids).size} unique ids`,
    ),
  );

  const incomplete = claims.filter(
    (item) =>
      !item || requiredCaseFields.some((field) => typeof item[field] !== "string" || !item[field]),
  );
  checks.push(
    check(
      "required case fields present",
      incomplete.length === 0,
      `${incomplete.length} incomplete cases`,
    ),
  );

  const invalidVerdicts = claims.filter((item) => item && !allowedVerdicts.has(item.expected));
  checks.push(
    check(
      "expected verdicts in contract",
      invalidVerdicts.length === 0,
      `${invalidVerdicts.length} invalid verdicts`,
    ),
  );

  const invalidInputs = claims.filter(
    (item) =>
      item && (typeof item.input !== "string" || item.input.length < 8 || item.input.length > 2000),
  );
  checks.push(
    check(
      "inputs respect API length bounds",
      invalidInputs.length === 0,
      `${invalidInputs.length} out-of-range inputs`,
    ),
  );

  const derived = claims.filter((item) => item && item.category !== "fever");
  const unprovenanced = derived.filter((item) => !item.label_method || !item.source);
  checks.push(
    check(
      "derived labels carry provenance",
      unprovenanced.length === 0,
      `${derived.length} derived cases, ${unprovenanced.length} missing label_method/source`,
    ),
  );

  const actualCategories = {};
  for (const item of claims)
    if (item && item.category)
      actualCategories[item.category] = (actualCategories[item.category] || 0) + 1;
  const categoryKeys = Object.keys(provenance.categories || {}).sort();
  const actualKeys = Object.keys(actualCategories).sort();
  const categoriesMatch =
    categoryKeys.length === actualKeys.length &&
    categoryKeys.every((key) => provenance.categories[key] === actualCategories[key]);
  checks.push(
    check("category counts match provenance", categoriesMatch, JSON.stringify(actualCategories)),
  );

  checks.push(
    check(
      "case count matches provenance",
      provenance.cases === claims.length,
      `${claims.length} cases vs ${provenance.cases} recorded`,
    ),
  );

  checks.push(
    check(
      "source revision and hash recorded",
      typeof provenance.source_revision === "string" &&
        /^[a-f0-9]{40}$/.test(provenance.source_revision) &&
        typeof provenance.source_sha256 === "string" &&
        /^[a-f0-9]{64}$/.test(provenance.source_sha256),
      `revision ${provenance.source_revision || "missing"}; sha256 ${provenance.source_sha256 ? "recorded" : "missing"}`,
    ),
  );

  checks.push(
    check(
      "limitations stated in provenance",
      Array.isArray(provenance.notes) && provenance.notes.length > 0,
      `${Array.isArray(provenance.notes) ? provenance.notes.length : 0} notes`,
    ),
  );

  return {
    ok: checks.every((item) => item.ok),
    cases: claims.length,
    categories: actualCategories,
    checks,
  };
}

const report = validate();
console.log(JSON.stringify(report, null, 2) + "\n");
if (!report.ok) process.exitCode = 1;
