"""Conservative, accent-insensitive search over the curated introductory directory.

Search is botanical discovery, NEVER regional suitability assessment. All
search results explicitly distinguish source evidence from inferred suitability.
"""
from difflib import get_close_matches
import unicodedata

ALIASES = {
    "maize": ("maiz", "maíz", "choclo", "corn", "elote"),
    "quinoa": ("quinua", "quinoa"),
    "common_bean": ("fréjol", "frejol", "frijol", "poroto", "judía"),
    "faba": ("haba", "habas", "broad bean"),
    "potato": ("papa", "patata", "potatoes"),
    "sweet_potato": ("camote", "batata", "boniato"),
    "cassava": ("yuca", "mandioca"),
    "banana": ("plátano", "platano", "banano"),
    "avocado": ("palta", "aguacate"),
    "groundnut": ("mani", "maní", "cacahuate"),
    "pea": ("arveja", "guisante"),
    "coriander": ("cilantro", "culantro"),
}


def normalize(value: str) -> str:
    return "".join(char for char in unicodedata.normalize("NFKD", value.casefold())
                   if not unicodedata.combining(char)).strip()


def search_directory(crops: dict, query: str = "", category: str | None = None,
                     limit: int = 30, offset: int = 0) -> dict:
    if not 1 <= limit <= 100 or not 0 <= offset <= 10000:
        raise ValueError("Invalid pagination settings")
    query = normalize(query)
    category_norm = normalize(category or "")

    def matches(item):
        crop_id, crop = item
        if category_norm and category_norm != normalize(crop["role"]):
            return False
        terms = [crop_id.replace("_", " "), crop["name"], crop["scientific_name"],
                 crop["family"], crop["role"], *ALIASES.get(crop_id, ()), *crop.get('common_names', ())]
        normalized = [normalize(t) for t in terms]
        return (not query or any(query in t for t in normalized))

    matched = [item for item in crops.items() if matches(item)]
    matched.sort(key=lambda item: (
        0 if query and normalize(item[1]["name"]) == query else
        1 if query and any(normalize(t) == query for t in ALIASES.get(item[0], ())) else
        2 if query and normalize(item[1]["name"]).startswith(query) else 3,
        normalize(item[1]["name"]),
    ))
    items = [
        {"id": crop_id, "name": crop["name"], "scientific_name": crop["scientific_name"],
         "family": crop["family"], "category": crop["role"],
         "evidence": crop.get("evidence_level", "literature_reference_only"),
         "locally_suitable": None,
         "description": "Su aptitud en tu región no está comprobada."}
        for crop_id, crop in matched[offset:offset + limit]
    ]
    suggestions = []
    if query and not matched:
        vocabulary = {normalize(c["name"]): c["name"] for c in crops.values()}
        vocabulary.update({normalize(a): a for terms in ALIASES.values() for a in terms})
        suggestions = [vocabulary[s] for s in get_close_matches(query, vocabulary.keys(),
                         n=5, cutoff=.58)]
    return {"items": items, "total": len(matched), "limit": limit, "offset": offset,
            "query": query, "suggestions": suggestions,
            "region_suitability_evaluated": False,
            "catalog_basis": "95 curated profiles + source-pinned FAO ECOCROP expert estimates. No regional GAEZ suitability imported."}
