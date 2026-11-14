# Phase 3 — Weather service
import httpx
from datetime import datetime, timedelta
from typing import Optional


class WeatherData:
    """Weather data container"""
    def __init__(self, temp_c: float, humidity_pct: float, source: str):
        self.temp_c = temp_c
        self.humidity_pct = humidity_pct
        self.source = source


# In-memory cache: key = (lat_rounded, lng_rounded), value = (data, timestamp)
_cache: dict[tuple[float, float], tuple[WeatherData, datetime]] = {}
_CACHE_TTL_MINUTES = 10


def _round_coord(coord: float) -> float:
    """Round coordinate to 1 decimal place for cache key"""
    return round(coord, 1)


async def get_weather(lat: float, lng: float) -> WeatherData:
    """
    Fetch current weather from Open-Meteo API.
    
    - Uses in-memory TTL cache (10 min) keyed by lat/lng rounded to 1 decimal
    - Timeout: 4 seconds
    - On timeout/error: return cached value if available, else fallback to 30°C
    
    Args:
        lat: Latitude
        lng: Longitude
    
    Returns:
        WeatherData with temp_c, humidity_pct, and source ('live', 'cached', or 'fallback')
    """
    cache_key = (_round_coord(lat), _round_coord(lng))
    now = datetime.utcnow()
    
    # Check cache first
    if cache_key in _cache:
        cached_data, cached_at = _cache[cache_key]
        if (now - cached_at).total_seconds() < _CACHE_TTL_MINUTES * 60:
            # Fresh cache hit
            return WeatherData(
                temp_c=cached_data.temp_c,
                humidity_pct=cached_data.humidity_pct,
                source="cached"
            )
    
    # Try to fetch live data
    try:
        async with httpx.AsyncClient(timeout=4.0) as client:
            resp = await client.get(
                "https://api.open-meteo.com/v1/forecast",
                params={
                    "latitude": lat,
                    "longitude": lng,
                    "current": "temperature_2m,relative_humidity_2m",
                }
            )
            resp.raise_for_status()
            data = resp.json()
            
            temp_c = data["current"]["temperature_2m"]
            humidity_pct = data["current"]["relative_humidity_2m"]
            
            weather = WeatherData(temp_c=temp_c, humidity_pct=humidity_pct, source="live")
            
            # Update cache
            _cache[cache_key] = (weather, now)
            
            return weather
    
    except (httpx.TimeoutException, httpx.HTTPError, KeyError, ValueError) as e:
        # On failure, try to return stale cache
        if cache_key in _cache:
            cached_data, _ = _cache[cache_key]
            return WeatherData(
                temp_c=cached_data.temp_c,
                humidity_pct=cached_data.humidity_pct,
                source="cached"
            )
        
        # No cache available, fallback
        return WeatherData(temp_c=30.0, humidity_pct=50.0, source="fallback")
