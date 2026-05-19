"use server";

export async function fetchUrlMetadata(url: string) {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)'
      },
      // 10 second timeout
      signal: AbortSignal.timeout(10000)
    });
    
    if (!res.ok) throw new Error("Failed to fetch");
    
    const html = await res.text();
    
    const getMeta = (property: string) => {
      const regex = new RegExp(`<meta[^>]*property=["']${property}["'][^>]*content=["']([^"']+)["']`, 'i');
      const match = html.match(regex);
      if (!match) {
        const regexName = new RegExp(`<meta[^>]*name=["']${property}["'][^>]*content=["']([^"']+)["']`, 'i');
        const matchName = html.match(regexName);
        return matchName ? matchName[1] : null;
      }
      return match ? match[1] : null;
    };

    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    
    let title = getMeta('og:title') || (titleMatch ? titleMatch[1] : null);
    let description = getMeta('og:description') || getMeta('description');
    let image = getMeta('og:image') || getMeta('twitter:image');

    // Resolve relative image URLs
    if (image && image.startsWith('/')) {
      const urlObj = new URL(url);
      image = `${urlObj.protocol}//${urlObj.host}${image}`;
    }

    // Decode HTML entities roughly
    if (title) title = title.replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"');
    if (description) description = description.replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"');

    return { 
      title: title?.trim(), 
      description: description?.trim(), 
      image: image?.trim(), 
      success: true 
    };
  } catch (error) {
    console.error("Error fetching metadata:", error);
    return { success: false };
  }
}
