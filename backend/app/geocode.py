"""geocode.py — Finds the map position of a street address (the staff panel's "Find from address" on a reseller).

One function, `locate`, asks the geocoder at GEOCODER_URL (default: OpenStreetMap's Nominatim, free and keyless) for
an address in Israel: first the street address with its city, then, when that finds nothing, the city alone (the
answer is then marked approximate: the pin sits at the city centre, as the Where to Buy map says). Nominatim's usage
policy asks for an identifying User-Agent and at most one request a second; the staff panel asks only when a staff
member presses the button. GEOCODER_URL empty switches the lookup off (`GeocoderUnavailable`).

Used by GET /api/staff/geocode (app/staff/routes.py). The tests replace `urlopen` (no network).
"""
import json
from typing import Any
from urllib.error import URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from flask import current_app

# Who asks (Nominatim's policy wants an application name, never a person's details).
USER_AGENT = "UltraPet-admin/1.0 (reseller map)"
TIMEOUT_SECONDS = 10
# Nominatim's `addresstype` values that name an area rather than a street or a building: such a match is approximate.
AREA_TYPES = {
    "country", "state", "region", "province", "county", "district", "municipality", "city", "town", "village",
    "hamlet", "city_district", "suburb", "quarter", "neighbourhood", "borough",
}


class GeocoderUnavailable(Exception):
    """The geocoder is switched off, cannot be reached, or answered something unreadable."""


def search(query: str) -> dict[str, Any] | None:
    """Asks the geocoder for the best match of a free-form query in Israel.

    Args:
        query: E.g. "הרצל 12, תל אביב".

    Returns:
        Nominatim's first result (lat, lon, display_name, addresstype, ...), or None when nothing matched.

    Raises:
        GeocoderUnavailable: Switched off, a network error, or an answer that is not a JSON list.
    """
    base = current_app.config.get("GEOCODER_URL", "")
    if not base:
        raise GeocoderUnavailable
    params = urlencode({"q": query, "format": "jsonv2", "countrycodes": "il", "limit": 1, "accept-language": "he"})
    request = Request(f"{base}?{params}", headers={"User-Agent": USER_AGENT, "Accept": "application/json"})
    try:
        with urlopen(request, timeout=TIMEOUT_SECONDS) as response:
            results = json.loads(response.read())
    except (URLError, TimeoutError, OSError, ValueError) as error:
        current_app.logger.warning("Geocoder failed: %s", error)
        raise GeocoderUnavailable from error
    if not isinstance(results, list):
        raise GeocoderUnavailable
    return results[0] if results else None


def locate(address: str, city: str) -> dict[str, Any] | None:
    """Finds a street address on the map, falling back to its city.

    Args:
        address: The street address, e.g. "הרצל 12" (may be empty: then only the city is looked up).
        city: The city, e.g. "תל אביב".

    Returns:
        {lat, lng, label, approximate} (label = the geocoder's name of the place found; approximate = only the city,
        or another area, was matched), or None when neither the address nor the city was found.

    Raises:
        GeocoderUnavailable: The geocoder is off or failed.
    """
    found = search(f"{address}, {city}") if address else None
    fallback = found is None
    if fallback:
        found = search(city)
    if found is None:
        return None
    try:
        lat, lng = float(found["lat"]), float(found["lon"])
    except (KeyError, TypeError, ValueError) as error:
        raise GeocoderUnavailable from error
    return {
        "lat": lat,
        "lng": lng,
        "label": str(found.get("display_name", "")),
        "approximate": fallback or found.get("addresstype") in AREA_TYPES,
    }
