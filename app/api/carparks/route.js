import { unstable_cache } from "next/cache";
import { fetchCarparkAvailability, processCarparks } from "@/lib/parking";

// Cache all LTA carpark data for 60 seconds using Next.js Data Cache.
// Unlike a module-level variable, unstable_cache persists across serverless
// function invocations on Vercel and other edge/serverless platforms.
const getCachedCarparks = unstable_cache(
  async () => {
    const apiKey = process.env.LTA_API_KEY;
    return fetchCarparkAvailability(apiKey);
  },
  ["lta-carparks"],
  { revalidate: 60, tags: ["lta-carparks"] }
);

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const lat = parseFloat(searchParams.get("lat"));
  const lng = parseFloat(searchParams.get("lng"));
  const duration = parseFloat(searchParams.get("duration")) || 2;
  const priority = searchParams.get("priority") || "balanced";
  const radius = parseFloat(searchParams.get("radius")) || 2;

  if (isNaN(lat) || isNaN(lng)) {
    return Response.json({ error: "Invalid lat/lng" }, { status: 400 });
  }

  const apiKey = process.env.LTA_API_KEY;
  if (!apiKey || apiKey === "your_lta_datamall_api_key_here") {
    return Response.json({ error: "LTA_API_KEY not configured" }, { status: 500 });
  }

  try {
    const rawData = await getCachedCarparks();
    const carparks = processCarparks(rawData, lat, lng, duration, priority, radius);
    return Response.json({ carparks, total: carparks.length });
  } catch (err) {
    console.error("Carpark API error:", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
