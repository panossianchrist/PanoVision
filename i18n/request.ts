import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";

export default getRequestConfig(async () => {
  const requested = (await cookies()).get("pano_language")?.value;
  const locale = requested === "fr" || requested === "ar" ? requested : "en";
  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
    timeZone: "Asia/Beirut",
  };
});
