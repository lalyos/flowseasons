export function filterByCategory(results, category) {
  if (!category) return results;

  let previousRank;
  let rank = 0;
  return results.filter((result) => result.category === category).map((result, index) => {
    if (index === 0 || result.rank == null || result.rank !== previousRank) rank = index + 1;
    previousRank = result.rank;
    return { ...result, rank };
  });
}
