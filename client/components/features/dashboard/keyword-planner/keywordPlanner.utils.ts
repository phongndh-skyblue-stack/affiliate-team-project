import type { KeywordIdeaItem, KeywordIntent, OpportunityTier } from "@/types/keywordPlanner.types";

export interface KeywordFilters {
  query: string;
  intents: KeywordIntent[];
  competition: string[];
  tiers: OpportunityTier[];
  minVolume: number | null;
  maxCpc: number | null;
}

export type KeywordSort =
  | "score-desc"
  | "volume-desc"
  | "competition-asc"
  | "cpc-desc"
  | "trend-desc"
  | "keyword-asc";

export function filterKeywordIdeas(
  ideas: KeywordIdeaItem[],
  filters: KeywordFilters
): KeywordIdeaItem[] {
  const query = filters.query.trim().toLocaleLowerCase("vi");
  return ideas.filter((item) => {
    if (query && !item.keyword.toLocaleLowerCase("vi").includes(query)) return false;
    if (filters.intents.length && !filters.intents.includes(item.intent ?? "unknown")) return false;
    if (filters.competition.length && !filters.competition.includes(item.competition)) return false;
    if (filters.tiers.length && !filters.tiers.includes(item.opportunityTier ?? "low")) return false;
    if (filters.minVolume != null && item.avgMonthlySearches < filters.minVolume) return false;
    if (filters.maxCpc != null && (item.highTopPageBid ?? 0) > filters.maxCpc) return false;
    return true;
  });
}

export function sortKeywordIdeas(
  ideas: KeywordIdeaItem[],
  sort: KeywordSort
): KeywordIdeaItem[] {
  return [...ideas].sort((a, b) => {
    switch (sort) {
      case "volume-desc":
        return b.avgMonthlySearches - a.avgMonthlySearches;
      case "competition-asc":
        return (a.competitionIndex ?? 50) - (b.competitionIndex ?? 50);
      case "cpc-desc":
        return (b.highTopPageBid ?? 0) - (a.highTopPageBid ?? 0);
      case "trend-desc":
        return (b.trendPercentage ?? 0) - (a.trendPercentage ?? 0);
      case "keyword-asc":
        return a.keyword.localeCompare(b.keyword, "vi");
      case "score-desc":
      default:
        return (b.opportunityScore ?? 0) - (a.opportunityScore ?? 0);
    }
  });
}

export function summarizeKeywordIdeas(ideas: KeywordIdeaItem[]) {
  if (!ideas.length) {
    return {
      count: 0,
      totalVolume: 0,
      medianVolume: 0,
      averageCompetitionIndex: 0,
      strongestKeyword: null,
    };
  }
  const volumes = ideas.map((item) => item.avgMonthlySearches).sort((a, b) => a - b);
  const middle = Math.floor(volumes.length / 2);
  const medianVolume = volumes.length % 2
    ? volumes[middle]
    : Math.round((volumes[middle - 1] + volumes[middle]) / 2);
  const competitionValues = ideas
    .map((item) => item.competitionIndex)
    .filter((value): value is number => value != null);
  return {
    count: ideas.length,
    totalVolume: ideas.reduce((sum, item) => sum + item.avgMonthlySearches, 0),
    medianVolume,
    averageCompetitionIndex: competitionValues.length
      ? Math.round(competitionValues.reduce((sum, value) => sum + value, 0) / competitionValues.length)
      : 0,
    strongestKeyword: sortKeywordIdeas(ideas, "score-desc")[0],
  };
}

export function candidateKeywordFromIdea(item: KeywordIdeaItem) {
  return {
    sourceResultId: item.id,
    keyword: item.keyword,
    avgMonthlySearches: item.avgMonthlySearches,
    competition: item.competition,
    competitionIndex: item.competitionIndex,
    lowTopPageBid: item.lowTopPageBid,
    highTopPageBid: item.highTopPageBid,
    monthlySearches: item.monthlySearches,
    inferredIntent: item.intent ?? ("unknown" as const),
    opportunityScore: item.opportunityScore ?? 0,
    opportunityTier: item.opportunityTier ?? ("low" as const),
    scoreExplanation: item.scoreExplanation ?? "",
    tags: [],
  };
}
