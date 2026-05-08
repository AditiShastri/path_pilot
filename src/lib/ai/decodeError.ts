export function errorDecoder(raw: unknown): string {
  if (!raw) return "Unknown error";

  const text =
    typeof raw === "string"
      ? raw
      : raw instanceof Error
      ? raw.message
      : JSON.stringify(raw);

  // 1️⃣ If provider returned structured JSON in responseBody, prefer that
  const responseBodyMatch = text.match(/"message":"([^"]+)"/);
  if (responseBodyMatch) {
    return responseBodyMatch[1].trim();
  }

  // 2️⃣ Extract message after `Error [Type]:`
  const errorHeaderMatch = text.match(/Error\s*\[[^\]]+\]:\s*([\s\S]*?)\n/);
  if (errorHeaderMatch) {
    return errorHeaderMatch[1].trim();
  }

  // 3️⃣ Fallback: first non-empty line
  const firstLine = text
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l.length > 0);

  return firstLine || "Unknown error";
}
