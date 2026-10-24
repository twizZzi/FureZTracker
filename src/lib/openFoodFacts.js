// Open Food Facts public search (no key, CORS enabled). Values are per 100 g.
const ENDPOINT = "https://world.openfoodfacts.org/cgi/search.pl";

const round1 = (value) => Math.round((Number(value) || 0) * 10) / 10;

function toProduct(item) {
  const n = item.nutriments || {};
  const kcal = n["energy-kcal_100g"] ?? (n.energy_100g ? n.energy_100g / 4.184 : null);
  const name = (item.product_name_ru || item.product_name || "").trim();
  if (!name || !kcal) return null;

  return {
    id: `off-${item.code}`,
    name,
    brand: (item.brands || "").split(",")[0].trim(),
    kcal: Math.round(kcal),
    p: round1(n.proteins_100g),
    f: round1(n.fat_100g),
    c: round1(n.carbohydrates_100g),
    source: "off",
  };
}

// The public server often answers 503 under load; one quiet retry fixes most misses.
async function fetchWithRetry(url, signal, attempts = 2) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      const response = await fetch(url, { signal });
      if (response.ok) return response;
      if (attempt >= attempts) throw new Error(`Open Food Facts: ${response.status}`);
    } catch (error) {
      if (error.name === "AbortError" || attempt >= attempts) throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, 800));
  }
}

export async function searchOpenFoodFacts(query, signal) {
  const params = new URLSearchParams({
    search_terms: query,
    search_simple: "1",
    action: "process",
    json: "1",
    page_size: "25",
    lc: "ru",
    fields: "code,product_name,product_name_ru,brands,nutriments",
  });
  const response = await fetchWithRetry(`${ENDPOINT}?${params}`, signal);
  const json = await response.json();
  const seen = new Set();
  return (json.products || [])
    .map(toProduct)
    .filter(Boolean)
    .filter((product) => {
      const key = `${product.name}|${product.brand}`.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}
