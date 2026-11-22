const { ResultSchema } = require("@claimlens/shared");
function scoreResult(item, value, success) {
  const parsed = ResultSchema.safeParse(value);
  if (!parsed.success)
    return {
      passed: false,
      verdict_matches: false,
      specific: false,
      valid_quotes: false,
      quotes_checked: 0,
      quotes_valid: 0,
      citation_status: "invalid_result",
    };
  const result = parsed.data;
  const normalize = (text) => text.normalize("NFKC").replace(/\s+/g, " ").trim().toLowerCase();
  let checked = 0,
    valid = 0;
  for (const claim of result.claims)
    for (const evidence of claim.evidence) {
      checked++;
      const source = claim.sources.find((row) => row.id === evidence.source_id);
      const quote = normalize(evidence.quote);
      if (quote.length >= 15 && source && normalize(source.content).includes(quote)) valid++;
    }
  const verdictMatches = item.expected.includes(result.verdict);
  const specific = item.terms.some((term) =>
    result.summary.toLowerCase().includes(term.toLowerCase()),
  );
  const validQuotes = checked > 0 && checked === valid;
  const abstainedWithoutCitations = result.verdict === "UNVERIFIED" && checked === 0;
  return {
    verdict_matches: verdictMatches,
    specific,
    valid_quotes: validQuotes,
    quotes_checked: checked,
    quotes_valid: valid,
    citation_status: checked === 0 ? "none" : validQuotes ? "valid" : "invalid",
    passed: Boolean(
      success && verdictMatches && specific && (validQuotes || abstainedWithoutCitations),
    ),
  };
}
module.exports = { scoreResult };
