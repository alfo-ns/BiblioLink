import { NextResponse } from "next/server";

function getMetaContent(html: string, key: string) {
  const metaTags = html.match(/<meta[^>]+>/gi) || [];

  for (const tag of metaTags) {
    const hasKey = new RegExp(`(?:property|name)=["']${key}["']`, "i").test(tag);
    if (!hasKey) continue;

    const contentMatch = tag.match(/content=["']([^"']*)["']/i);
    if (contentMatch) return contentMatch[1];
  }

  return null;
}

function decodeHtml(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

export async function POST(req: Request) {
  try {
    const { url } = await req.json();

	function getYouTubeId(input: string) {
  try {
    const u = new URL(input);

    if (u.hostname.includes("youtu.be")) {
      return u.pathname.replace("/", "").split("?")[0];
    }

    if (u.hostname.includes("youtube.com")) {
      return u.searchParams.get("v");
    }

    return null;
  } catch {
    return null;
  }
}

const youtubeId = getYouTubeId(url);

if (youtubeId) {
  try {
    const oembedRes = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`,
      {
        headers: {
          "User-Agent": "Mozilla/5.0",
        },
        signal: AbortSignal.timeout(10000),
      }
    );

    if (oembedRes.ok) {
      const data = await oembedRes.json();

      return NextResponse.json({
        success: true,
        title: data.title || "YouTube Video",
        description: data.author_name ? `By ${data.author_name}` : "",
        image: data.thumbnail_url || `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`,
      });
    }
  } catch (error) {
    console.error("YouTube oEmbed error:", error);
  }

  return NextResponse.json({
    success: true,
    title: "YouTube Video",
    description: "",
    image: `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`,
  });
}
    if (!url || typeof url !== "string") {
      return NextResponse.json({ success: false, error: "Missing url" }, { status: 400 });
    }

    const res = await fetch(url, {
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9,it;q=0.8",
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      return NextResponse.json({ success: false, error: `Fetch failed: ${res.status}` }, { status: 200 });
    }

    const html = await res.text();
    const baseUrl = new URL(res.url || url);

    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);

    let title =
      getMetaContent(html, "og:title") ||
      getMetaContent(html, "twitter:title") ||
      (titleMatch ? titleMatch[1] : "");

    let description =
      getMetaContent(html, "og:description") ||
      getMetaContent(html, "twitter:description") ||
      getMetaContent(html, "description") ||
      "";

    let image =
      getMetaContent(html, "og:image") ||
      getMetaContent(html, "twitter:image") ||
      getMetaContent(html, "twitter:image:src") ||
      "";

    if (image) {
      image = new URL(image, baseUrl).toString();
    }

    return NextResponse.json({
      success: true,
      title: title ? decodeHtml(title).trim() : "",
      description: description ? decodeHtml(description).trim() : "",
      image: image ? image.trim() : "",
    });
  } catch (error) {
    console.error("Metadata API error:", error);
    return NextResponse.json({ success: false, error: "Metadata fetch failed" }, { status: 200 });
  }
}
