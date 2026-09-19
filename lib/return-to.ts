export function safeReturnTo(value: string | undefined) {
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\")
  )
    return "/dashboard";
  try {
    const url = new URL(value, "https://panovision.invalid");
    return url.origin === "https://panovision.invalid" &&
      /^\/(dashboard(?:\/[a-zA-Z0-9-]+)?|start-campaign)$/.test(url.pathname)
      ? `${url.pathname}${url.search}`
      : "/dashboard";
  } catch {
    return "/dashboard";
  }
}
