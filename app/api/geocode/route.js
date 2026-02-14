export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q");

  if (!query) {
    return Response.json({ error: "Missing query parameter" }, { status: 400 });
  }

  try {
    const res = await fetch(
      `https://www.onemap.gov.sg/api/common/elastic/search?searchVal=${encodeURIComponent(query)}&returnGeom=Y&getAddrDetails=Y&pageNum=1`,
      { headers: { accept: "application/json" } }
    );

    if (!res.ok) throw new Error(`OneMap API error: ${res.status}`);

    const data = await res.json();
    const results = (data.results || []).slice(0, 5).map((r) => ({
      name: r.SEARCHVAL,
      address: r.ADDRESS,
      lat: parseFloat(r.LATITUDE),
      lng: parseFloat(r.LONGITUDE),
      postalCode: r.POSTAL,
      building: r.BUILDING,
    }));

    return Response.json({ results });
  } catch (err) {
    console.error("Geocode error:", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
