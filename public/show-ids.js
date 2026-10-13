export function resolveShowIds(location, cookie, setCookie, replaceUrl) {
  const url = new URL(location.href);
  const requested = url.searchParams.get("showid");
  if (requested === "true" || requested === "false") {
    const secure = location.protocol === "https:" ? "; Secure" : "";
    setCookie(`showid=${requested}; Max-Age=2592000; Path=/; SameSite=Lax${secure}`);
    url.searchParams.delete("showid");
    replaceUrl(`${url.pathname}${url.search}${url.hash}`);
    return requested === "true";
  }
  return cookie.split(";").some((value) => value.trim() === "showid=true");
}
