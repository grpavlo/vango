import { useEffect, useMemo } from "react";

interface SeoHeadProps {
  title: string;
  description: string;
  canonicalPath: string;
  robots?: string;
  keywords?: readonly string[];
  ogType?: "website" | "article";
}

const SITE_URL = "https://vango.com.ua";
const DEFAULT_OG_IMAGE = `${SITE_URL}/favicon.ico`;
const BRAND_KEYWORDS = ["van go", "vango", "ванго", "ван го"];

const upsertMetaTag = (
  attribute: "name" | "property",
  key: string,
  content: string,
) => {
  const selector = `meta[${attribute}="${key}"]`;
  let tag = document.head.querySelector<HTMLMetaElement>(selector);

  if (!tag) {
    tag = document.createElement("meta");
    tag.setAttribute(attribute, key);
    document.head.appendChild(tag);
  }

  tag.setAttribute("content", content);
};

const upsertCanonicalTag = (href: string) => {
  let tag = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');

  if (!tag) {
    tag = document.createElement("link");
    tag.rel = "canonical";
    document.head.appendChild(tag);
  }

  tag.href = href;
};

const getCanonicalUrl = (canonicalPath: string): string => {
  const normalized = canonicalPath.startsWith("/") ? canonicalPath : `/${canonicalPath}`;

  if (normalized === "/") {
    return `${SITE_URL}/`;
  }

  return `${SITE_URL}${normalized}`;
};

const normalizeKeywords = (keywords: readonly string[]) => {
  const seen = new Set<string>();

  return keywords.filter((keyword) => {
    const normalized = keyword.trim().toLowerCase();
    if (!normalized || seen.has(normalized)) {
      return false;
    }

    seen.add(normalized);
    return true;
  });
};

const SeoHead = ({
  title,
  description,
  canonicalPath,
  robots = "index, follow",
  keywords = [],
  ogType = "website",
}: SeoHeadProps) => {
  const canonicalUrl = useMemo(() => getCanonicalUrl(canonicalPath), [canonicalPath]);
  const keywordsContent = useMemo(
    () => normalizeKeywords([...keywords, ...BRAND_KEYWORDS]).join(", "),
    [keywords],
  );

  useEffect(() => {
    document.title = title;
    document.documentElement.lang = "uk";

    upsertMetaTag("name", "description", description);
    upsertMetaTag("name", "keywords", keywordsContent);
    upsertMetaTag("name", "robots", robots);

    upsertCanonicalTag(canonicalUrl);

    upsertMetaTag("property", "og:type", ogType);
    upsertMetaTag("property", "og:url", canonicalUrl);
    upsertMetaTag("property", "og:title", title);
    upsertMetaTag("property", "og:description", description);
    upsertMetaTag("property", "og:image", DEFAULT_OG_IMAGE);
    upsertMetaTag("property", "og:site_name", "VanGo");
    upsertMetaTag("property", "og:locale", "uk_UA");

    upsertMetaTag("name", "twitter:card", "summary_large_image");
    upsertMetaTag("name", "twitter:url", canonicalUrl);
    upsertMetaTag("name", "twitter:title", title);
    upsertMetaTag("name", "twitter:description", description);
    upsertMetaTag("name", "twitter:image", DEFAULT_OG_IMAGE);
  }, [canonicalUrl, description, keywordsContent, ogType, robots, title]);

  return null;
};

export default SeoHead;
