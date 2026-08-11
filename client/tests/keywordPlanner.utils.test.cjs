const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");

function loadUtilities() {
  const filename = path.join(
    __dirname,
    "..",
    "components",
    "features",
    "dashboard",
    "keyword-planner",
    "keywordPlanner.utils.ts"
  );
  const source = fs.readFileSync(filename, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const module = { exports: {} };
  new Function("module", "exports", output)(module, module.exports);
  return module.exports;
}

const ideas = [
  {
    id: "1", keyword: "best vpn", avgMonthlySearches: 1000,
    competition: "Trung bình", competitionIndex: 45,
    lowTopPageBid: 1, highTopPageBid: 3, monthlySearches: [],
    intent: "commercial", opportunityScore: 80, opportunityTier: "high", trendPercentage: 20,
  },
  {
    id: "2", keyword: "vpn guide", avgMonthlySearches: 200,
    competition: "Thấp", competitionIndex: 15,
    lowTopPageBid: 0.2, highTopPageBid: 0.5, monthlySearches: [],
    intent: "informational", opportunityScore: 55, opportunityTier: "medium", trendPercentage: -5,
  },
  {
    id: "3", keyword: "buy proxy", avgMonthlySearches: 50,
    competition: "Cao", competitionIndex: 90,
    lowTopPageBid: 4, highTopPageBid: 8, monthlySearches: [],
    intent: "transactional", opportunityScore: 30, opportunityTier: "low", trendPercentage: 2,
  },
];

test("filterKeywordIdeas combines opportunity and metric filters", () => {
  const { filterKeywordIdeas } = loadUtilities();
  const result = filterKeywordIdeas(ideas, {
    query: "vpn",
    intents: ["commercial"],
    competition: ["Trung bình"],
    tiers: ["high"],
    minVolume: 500,
    maxCpc: 5,
  });
  assert.deepEqual(result.map((item) => item.id), ["1"]);
});

test("sortKeywordIdeas orders score descending without mutating input", () => {
  const { sortKeywordIdeas } = loadUtilities();
  const source = [...ideas].reverse();
  const result = sortKeywordIdeas(source, "score-desc");
  assert.deepEqual(result.map((item) => item.id), ["1", "2", "3"]);
  assert.deepEqual(source.map((item) => item.id), ["3", "2", "1"]);
});

test("summarizeKeywordIdeas returns hand-checked aggregates", () => {
  const { summarizeKeywordIdeas } = loadUtilities();
  const summary = summarizeKeywordIdeas(ideas);
  assert.deepEqual(summary, {
    count: 3,
    totalVolume: 1250,
    medianVolume: 200,
    averageCompetitionIndex: 50,
    strongestKeyword: ideas[0],
  });
});
