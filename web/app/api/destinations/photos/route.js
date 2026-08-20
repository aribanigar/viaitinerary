import { NextResponse } from "next/server";
import { userFromRequest } from "@/lib/auth";

export const dynamic = "force-dynamic";

const unauth = () => NextResponse.json({ message: "Unauthenticated." }, { status: 401 });

// GET /api/destinations/photos?q=paris — proxies a Pixabay image search so
// the API key stays server-side and never ships to the browser. Used by the
// destination form's photo picker (search-and-select, no manual uploads).
export async function GET(request) {
  const user = await userFromRequest(request);
  if (!user) return unauth();

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") || "").trim();
  if (!q) return NextResponse.json({ data: [] });

  const key = process.env.PIXABAY_API_KEY;
  if (!key) {
    return NextResponse.json({ message: "Photo search is not configured." }, { status: 501 });
  }

  const url =
    `https://pixabay.com/api/?key=${encodeURIComponent(key)}` +
    `&q=${encodeURIComponent(q)}&image_type=photo&safesearch=true` +
    `&orientation=horizontal&per_page=24`;

  let resp;
  try {
    resp = await fetch(url);
  } catch {
    return NextResponse.json({ message: "Pixabay search failed." }, { status: 502 });
  }
  if (!resp.ok) {
    return NextResponse.json({ message: "Pixabay search failed." }, { status: 502 });
  }

  const json = await resp.json();
  const data = (json.hits || []).map((h) => ({
    id: h.id,
    thumb: h.webformatURL,
    full: h.largeImageURL,
    width: h.imageWidth,
    height: h.imageHeight,
    tags: h.tags,
    user: h.user,
  }));
  return NextResponse.json({ data });
}
