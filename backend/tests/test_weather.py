"""
Phase 3 — Weather service tests

Tests for Open-Meteo API integration with timeout, caching, and fallback handling.
"""
import pytest
from unittest.mock import AsyncMock, patch
from datetime import datetime, timedelta
import httpx

from backend.services.weather import get_weather, _cache, _round_coord


@pytest.fixture(autouse=True)
def clear_cache():
    """Clear weather cache before each test"""
    _cache.clear()
    yield
    _cache.clear()


class TestCoordinateRounding:
    """Test cache key generation"""
    
    def test_rounds_to_one_decimal(self):
        assert _round_coord(37.7749) == 37.8
        assert _round_coord(37.7449) == 37.7
        assert _round_coord(-122.4194) == -122.4


class TestWeatherFetch:
    """Test weather API fetching with various scenarios"""
    
    @pytest.mark.asyncio
    async def test_successful_fetch_returns_live_data(self):
        """Successful API call returns live weather data"""
        mock_response = {
            "current": {
                "temperature_2m": 25.5,
                "relative_humidity_2m": 65.0
            }
        }
        
        with patch("httpx.AsyncClient.get") as mock_get:
            mock_get.return_value = AsyncMock(
                status_code=200,
                json=lambda: mock_response
            )
            mock_get.return_value.raise_for_status = lambda: None
            
            result = await get_weather(37.7749, -122.4194)
            
            assert result.temp_c == 25.5
            assert result.humidity_pct == 65.0
            assert result.source == "live"
    
    @pytest.mark.asyncio
    async def test_cache_hit_returns_cached_data(self):
        """Second call within TTL returns cached data without API call"""
        mock_response = {
            "current": {
                "temperature_2m": 28.0,
                "relative_humidity_2m": 70.0
            }
        }
        
        with patch("httpx.AsyncClient.get") as mock_get:
            mock_get.return_value = AsyncMock(
                status_code=200,
                json=lambda: mock_response
            )
            mock_get.return_value.raise_for_status = lambda: None
            
            # First call - should hit API
            result1 = await get_weather(37.7749, -122.4194)
            assert result1.source == "live"
            assert mock_get.call_count == 1
            
            # Second call - should use cache
            result2 = await get_weather(37.775, -122.419)  # Rounds to same key
            assert result2.source == "cached"
            assert result2.temp_c == 28.0
            assert result2.humidity_pct == 70.0
            assert mock_get.call_count == 1  # No additional API call
    
    @pytest.mark.asyncio
    async def test_timeout_with_cache_returns_stale_cache(self):
        """Timeout returns cached value even if stale"""
        mock_response = {
            "current": {
                "temperature_2m": 22.0,
                "relative_humidity_2m": 55.0
            }
        }
        
        with patch("httpx.AsyncClient.get") as mock_get:
            # First call succeeds
            mock_get.return_value = AsyncMock(
                status_code=200,
                json=lambda: mock_response
            )
            mock_get.return_value.raise_for_status = lambda: None
            
            result1 = await get_weather(37.7, -122.4)
            assert result1.source == "live"
            
            # Simulate cache expiry by manipulating timestamp
            cache_key = (37.7, -122.4)
            old_data, _ = _cache[cache_key]
            _cache[cache_key] = (old_data, datetime.utcnow() - timedelta(minutes=15))
            
            # Second call times out
            mock_get.side_effect = httpx.TimeoutException("Timeout")
            
            result2 = await get_weather(37.7, -122.4)
            assert result2.source == "cached"
            assert result2.temp_c == 22.0
    
    @pytest.mark.asyncio
    async def test_timeout_without_cache_returns_fallback(self):
        """Timeout with no cache returns fallback 30°C"""
        with patch("httpx.AsyncClient.get") as mock_get:
            mock_get.side_effect = httpx.TimeoutException("Timeout")
            
            result = await get_weather(40.0, -74.0)
            
            assert result.temp_c == 30.0
            assert result.humidity_pct == 50.0
            assert result.source == "fallback"
    
    @pytest.mark.asyncio
    async def test_http_error_returns_fallback_or_cache(self):
        """HTTP errors return cached or fallback data"""
        with patch("httpx.AsyncClient.get") as mock_get:
            # Simulate 500 error
            mock_get.side_effect = httpx.HTTPStatusError(
                "Server error", 
                request=AsyncMock(), 
                response=AsyncMock(status_code=500)
            )
            
            result = await get_weather(51.5, -0.1)
            
            assert result.source == "fallback"
            assert result.temp_c == 30.0
    
    @pytest.mark.asyncio
    async def test_malformed_response_returns_fallback(self):
        """Malformed JSON returns fallback"""
        with patch("httpx.AsyncClient.get") as mock_get:
            # Missing expected keys
            mock_get.return_value = AsyncMock(
                status_code=200,
                json=lambda: {"current": {}}  # Missing temperature_2m
            )
            mock_get.return_value.raise_for_status = lambda: None
            
            result = await get_weather(37.7, -122.4)
            
            assert result.source == "fallback"
            assert result.temp_c == 30.0
    
    @pytest.mark.asyncio
    async def test_different_coords_different_cache(self):
        """Coordinates rounding to different keys use separate cache entries"""
        mock_response_1 = {
            "current": {
                "temperature_2m": 20.0,
                "relative_humidity_2m": 60.0
            }
        }
        mock_response_2 = {
            "current": {
                "temperature_2m": 25.0,
                "relative_humidity_2m": 70.0
            }
        }
        
        with patch("httpx.AsyncClient.get") as mock_get:
            mock_get.return_value = AsyncMock(
                status_code=200,
                json=lambda: mock_response_1
            )
            mock_get.return_value.raise_for_status = lambda: None
            
            result1 = await get_weather(37.7, -122.4)
            assert result1.temp_c == 20.0
            
            mock_get.return_value.json = lambda: mock_response_2
            
            # Different rounded coordinate - should make new API call
            result2 = await get_weather(38.0, -122.5)
            assert result2.temp_c == 25.0
            assert mock_get.call_count == 2
