interface ComparisonType {
  newFollows: string[];
  unfollowed: string[];
}

export const compareFollowers = (
  oldFollowers: string[],
  newFollowers: string[]
): ComparisonType => {
  const newFollows = newFollowers.filter((x) => !oldFollowers.includes(x));
  const unfollowed = oldFollowers.filter((x) => !newFollowers.includes(x));

  return { newFollows, unfollowed };
};
