import { fetchCarparkAvailability, processCarparks } from "@/lib/parking";

let cache = { data: null, timestamp: 0 };
const CACHE_TTL = 60 * 1000;

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
    const now = Date.now();
    if (!cache.data || now - cache.timestamp > CACHE_TTL) {
      cache.data = await fetchCarparkAvailability(apiKey);
      cache.timestamp = now;
    }

    const carparks = processCarparks(cache.data, lat, lng, duration, priority, radius);
    return Response.json({ carparks, total: carparks.length });
  } catch (err) {
    console.error("Carpark API error:", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
