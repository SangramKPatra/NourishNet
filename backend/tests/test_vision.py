"""
Phase 4 — Vision extraction tests

Tests for the NVIDIA NIM (google/gemma-4-31b-it) integration with validation and error handling.
"""
import io
from contextlib import contextmanager
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from PIL import Image

from backend.services.vision import run_vision


@pytest.fixture
def mock_image_file():
    """Create a mock uploaded image file"""
    img = Image.new('RGB', (100, 100), color='red')
    buffer = io.BytesIO()
    img.save(buffer, format='JPEG')
    buffer.seek(0)

    mock_file = AsyncMock()
    mock_file.read = AsyncMock(return_value=buffer.getvalue())
    return mock_file


@contextmanager
def mock_nim(content="", error=None, api_key="fake-key"):
    """Mock the NVIDIA NIM chat-completions HTTP call"""
    response = MagicMock()
    response.json.return_value = {"choices": [{"message": {"content": content}}]}
    response.raise_for_status.return_value = None

    client = MagicMock()
    client.__aenter__ = AsyncMock(return_value=client)
    client.__aexit__ = AsyncMock(return_value=None)
    client.post = AsyncMock(side_effect=error) if error else AsyncMock(return_value=response)

    with patch('backend.services.vision.settings.NVIDIA_API_KEY', api_key), \
         patch('backend.services.vision.httpx.AsyncClient', return_value=client):
        yield client


class TestVisionExtraction:
    """Test vision API integration"""

    @pytest.mark.asyncio
    async def test_successful_extraction(self, mock_image_file):
        """Successful NVIDIA call returns parsed VisionResult"""
        content = """{
            "items": [
                {"name": "cooked rice", "approx_kg": 2.5},
                {"name": "dal curry", "approx_kg": 1.5}
            ],
            "estimated_portions": 20,
            "perishability_tier": "HIGH_MOISTURE",
            "confidence": 0.92,
            "notes": "Two large serving trays visible"
        }"""

        with mock_nim(content):
            result = await run_vision(mock_image_file)

        assert result is not None
        assert len(result.items) == 2
        assert result.items[0].name == "cooked rice"
        assert result.items[0].approx_kg == 2.5
        assert result.estimated_portions == 20
        assert result.perishability_tier == "HIGH_MOISTURE"
        assert result.confidence == 0.92

    @pytest.mark.asyncio
    async def test_uses_nvidia_endpoint_and_gemma_model(self, mock_image_file):
        """Requests go to NVIDIA NIM using the gemma-4-31b-it model"""
        content = """{
            "items": [{"name": "rice", "approx_kg": 1.0}],
            "estimated_portions": 5,
            "perishability_tier": "HIGH_MOISTURE",
            "confidence": 0.9
        }"""

        with mock_nim(content) as client:
            await run_vision(mock_image_file)

        args, kwargs = client.post.call_args
        assert args[0] == "https://integrate.api.nvidia.com/v1/chat/completions"
        assert kwargs["headers"]["Authorization"] == "Bearer fake-key"
        assert kwargs["json"]["model"] == "google/gemma-4-31b-it"
        assert kwargs["json"]["messages"][0]["role"] == "system"
        assert kwargs["json"]["messages"][1]["role"] == "user"

    @pytest.mark.asyncio
    async def test_markdown_fenced_json_is_parsed(self, mock_image_file):
        """A fenced JSON response is still parsed"""
        content = """```json
        {"items": [], "estimated_portions": 0, "perishability_tier": "DRY", "confidence": 0.9}
        ```"""

        with mock_nim(content):
            result = await run_vision(mock_image_file)

        assert result is not None
        assert len(result.items) == 0

    @pytest.mark.asyncio
    async def test_empty_items_list(self, mock_image_file):
        """Empty items list is valid (no food visible)"""
        content = """{
            "items": [],
            "estimated_portions": 0,
            "perishability_tier": "MEDIUM_MOISTURE",
            "confidence": 0.95,
            "notes": "No food visible in image"
        }"""

        with mock_nim(content):
            result = await run_vision(mock_image_file)

        assert result is not None
        assert len(result.items) == 0

    @pytest.mark.asyncio
    async def test_rejects_negative_weight(self, mock_image_file):
        """Negative weight returns None (triggers manual entry)"""
        content = """{
            "items": [{"name": "rice", "approx_kg": -1.0}],
            "estimated_portions": 10,
            "perishability_tier": "HIGH_MOISTURE",
            "confidence": 0.8
        }"""

        with mock_nim(content):
            result = await run_vision(mock_image_file)

        assert result is None

    @pytest.mark.asyncio
    async def test_rejects_absurd_weight(self, mock_image_file):
        """Weight >100 kg returns None"""
        content = """{
            "items": [{"name": "rice", "approx_kg": 150.0}],
            "estimated_portions": 500,
            "perishability_tier": "HIGH_MOISTURE",
            "confidence": 0.8
        }"""

        with mock_nim(content):
            result = await run_vision(mock_image_file)

        assert result is None

    @pytest.mark.asyncio
    async def test_malformed_json_returns_none(self, mock_image_file):
        """Malformed JSON returns None"""
        with mock_nim("{ invalid json"):
            result = await run_vision(mock_image_file)

        assert result is None

    @pytest.mark.asyncio
    async def test_missing_required_field_returns_none(self, mock_image_file):
        """Missing required field returns None"""
        content = """{
            "items": [{"name": "rice", "approx_kg": 2.0}],
            "perishability_tier": "HIGH_MOISTURE",
            "confidence": 0.8
        }"""

        with mock_nim(content):
            result = await run_vision(mock_image_file)

        assert result is None

    @pytest.mark.asyncio
    async def test_api_exception_returns_none(self, mock_image_file):
        """API exceptions return None to trigger manual entry"""
        with mock_nim(error=Exception("API Error")):
            result = await run_vision(mock_image_file)

        assert result is None

    @pytest.mark.asyncio
    async def test_no_api_key_returns_none(self, mock_image_file):
        """No API key configured returns None"""
        with mock_nim(api_key=""):
            result = await run_vision(mock_image_file)

        assert result is None

    @pytest.mark.asyncio
    async def test_all_tier_types_valid(self, mock_image_file):
        """All three tier types are valid"""
        for tier in ["HIGH_MOISTURE", "MEDIUM_MOISTURE", "DRY"]:
            content = f"""{{
                "items": [{{"name": "food", "approx_kg": 1.0}}],
                "estimated_portions": 5,
                "perishability_tier": "{tier}",
                "confidence": 0.9
            }}"""

            with mock_nim(content):
                result = await run_vision(mock_image_file)

            assert result is not None
            assert result.perishability_tier == tier
