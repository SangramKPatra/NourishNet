"""
Phase 4 — Vision extraction tests

Tests for Gemini Vision API integration with validation and error handling.
"""
import pytest
import io
from unittest.mock import AsyncMock, patch, MagicMock
from PIL import Image

from backend.services.vision import run_vision
from backend.schemas import VisionResult


@pytest.fixture
def mock_image_file():
    """Create a mock uploaded image file"""
    # Create a small test image
    img = Image.new('RGB', (100, 100), color='red')
    buffer = io.BytesIO()
    img.save(buffer, format='JPEG')
    buffer.seek(0)
    
    mock_file = AsyncMock()
    mock_file.read = AsyncMock(return_value=buffer.getvalue())
    return mock_file


class TestVisionExtraction:
    """Test vision API integration"""
    
    @pytest.mark.asyncio
    async def test_successful_extraction(self, mock_image_file):
        """Successful Gemini call returns parsed VisionResult"""
        mock_response = MagicMock()
        mock_response.text = """{
            "items": [
                {"name": "cooked rice", "approx_kg": 2.5},
                {"name": "dal curry", "approx_kg": 1.5}
            ],
            "estimated_portions": 20,
            "perishability_tier": "HIGH_MOISTURE",
            "confidence": 0.92,
            "notes": "Two large serving trays visible"
        }"""
        
        with patch('backend.services.vision.settings.GEMINI_API_KEY', 'fake-key'), \
             patch('backend.services.vision.genai.Client') as mock_client:
            mock_instance = mock_client.return_value
            mock_instance.models.generate_content.return_value = mock_response
            
            result = await run_vision(mock_image_file)
            
            assert result is not None
            assert len(result.items) == 2
            assert result.items[0].name == "cooked rice"
            assert result.items[0].approx_kg == 2.5
            assert result.estimated_portions == 20
            assert result.perishability_tier == "HIGH_MOISTURE"
            assert result.confidence == 0.92
    
    @pytest.mark.asyncio
    async def test_empty_items_list(self, mock_image_file):
        """Empty items list is valid (no food visible)"""
        mock_response = MagicMock()
        mock_response.text = """{
            "items": [],
            "estimated_portions": 0,
            "perishability_tier": "MEDIUM_MOISTURE",
            "confidence": 0.95,
            "notes": "No food visible in image"
        }"""
        
        with patch('backend.services.vision.settings.GEMINI_API_KEY', 'fake-key'), \
             patch('backend.services.vision.genai.Client') as mock_client:
            mock_instance = mock_client.return_value
            mock_instance.models.generate_content.return_value = mock_response
            
            result = await run_vision(mock_image_file)
            
            assert result is not None
            assert len(result.items) == 0
    
    @pytest.mark.asyncio
    async def test_rejects_negative_weight(self, mock_image_file):
        """Negative weight returns None (triggers manual entry)"""
        mock_response = MagicMock()
        mock_response.text = """{
            "items": [{"name": "rice", "approx_kg": -1.0}],
            "estimated_portions": 10,
            "perishability_tier": "HIGH_MOISTURE",
            "confidence": 0.8
        }"""
        
        with patch('backend.services.vision.settings.GEMINI_API_KEY', 'fake-key'), \
             patch('backend.services.vision.genai.Client') as mock_client:
            mock_instance = mock_client.return_value
            mock_instance.models.generate_content.return_value = mock_response
            
            result = await run_vision(mock_image_file)
            
            assert result is None
    
    @pytest.mark.asyncio
    async def test_rejects_absurd_weight(self, mock_image_file):
        """Weight >100 kg returns None"""
        mock_response = MagicMock()
        mock_response.text = """{
            "items": [{"name": "rice", "approx_kg": 150.0}],
            "estimated_portions": 500,
            "perishability_tier": "HIGH_MOISTURE",
            "confidence": 0.8
        }"""
        
        with patch('backend.services.vision.settings.GEMINI_API_KEY', 'fake-key'), \
             patch('backend.services.vision.genai.Client') as mock_client:
            mock_instance = mock_client.return_value
            mock_instance.models.generate_content.return_value = mock_response
            
            result = await run_vision(mock_image_file)
            
            assert result is None
    
    @pytest.mark.asyncio
    async def test_malformed_json_returns_none(self, mock_image_file):
        """Malformed JSON returns None"""
        mock_response = MagicMock()
        mock_response.text = "{ invalid json"
        
        with patch('backend.services.vision.settings.GEMINI_API_KEY', 'fake-key'), \
             patch('backend.services.vision.genai.Client') as mock_client:
            mock_instance = mock_client.return_value
            mock_instance.models.generate_content.return_value = mock_response
            
            result = await run_vision(mock_image_file)
            
            assert result is None
    
    @pytest.mark.asyncio
    async def test_missing_required_field_returns_none(self, mock_image_file):
        """Missing required field returns None"""
        mock_response = MagicMock()
        mock_response.text = """{
            "items": [{"name": "rice", "approx_kg": 2.0}],
            "perishability_tier": "HIGH_MOISTURE",
            "confidence": 0.8
        }"""
        # Missing estimated_portions
        
        with patch('backend.services.vision.settings.GEMINI_API_KEY', 'fake-key'), \
             patch('backend.services.vision.genai.Client') as mock_client:
            mock_instance = mock_client.return_value
            mock_instance.models.generate_content.return_value = mock_response
            
            result = await run_vision(mock_image_file)
            
            assert result is None
    
    @pytest.mark.asyncio
    async def test_api_exception_returns_none(self, mock_image_file):
        """API exceptions return None to trigger manual entry"""
        with patch('backend.services.vision.settings.GEMINI_API_KEY', 'fake-key'), \
             patch('backend.services.vision.genai.Client') as mock_client:
            mock_instance = mock_client.return_value
            mock_instance.models.generate_content.side_effect = Exception("API Error")
            
            result = await run_vision(mock_image_file)
            
            assert result is None
    
    @pytest.mark.asyncio
    async def test_no_api_key_returns_none(self, mock_image_file):
        """No API key configured returns None"""
        with patch('backend.services.vision.settings') as mock_settings:
            mock_settings.GEMINI_API_KEY = ""
            
            result = await run_vision(mock_image_file)
            
            assert result is None
    
    @pytest.mark.asyncio
    async def test_all_tier_types_valid(self, mock_image_file):
        """All three tier types are valid"""
        for tier in ["HIGH_MOISTURE", "MEDIUM_MOISTURE", "DRY"]:
            mock_response = MagicMock()
            mock_response.text = f"""{{
                "items": [{{"name": "food", "approx_kg": 1.0}}],
                "estimated_portions": 5,
                "perishability_tier": "{tier}",
                "confidence": 0.9
            }}"""
            
            with patch('backend.services.vision.settings.GEMINI_API_KEY', 'fake-key'), \
                 patch('backend.services.vision.genai.Client') as mock_client:
                mock_instance = mock_client.return_value
                mock_instance.models.generate_content.return_value = mock_response
                
                result = await run_vision(mock_image_file)
                
                assert result is not None
                assert result.perishability_tier == tier
