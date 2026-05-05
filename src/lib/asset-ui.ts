export function assetLines(requiredAssets: string): string[] {
  return requiredAssets
    .split("\n")
    .map((line) => line.trim().replace(/^[-*]\s*/, ""))
    .filter(Boolean);
}

export function assetCountLabel(count: number): string {
  return count === 1 ? "1 asset needed" : `${count} assets needed`;
}
