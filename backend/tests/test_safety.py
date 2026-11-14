"""
Phase 2 — Safety engine tests

Tests for compute_safe_window, remaining_minutes, and urgency functions.
All tests use deterministic inputs and verify the documented formulas.
"""
import pytest
from datetime import datetime, timedelta
from backend.services.safety import compute_safe_window, remaining_minutes, urgency
from backend.config import settings


class TestComputeSafeWindow:
    """Test the safe window calculation formula"""
    
    def test_at_or_below_25c_returns_base(self):
        """At or below 25°C, return the base window unchanged"""
        assert compute_safe_window("HIGH_MOISTURE", 25.0) == 240
        assert compute_safe_window("HIGH_MOISTURE", 20.0) == 240
        assert compute_safe_window("MEDIUM_MOISTURE", 25.0) == 360
        assert compute_safe_window("DRY", 25.0) == 480
    
    def test_high_moisture_at_32c_returns_135(self):
        """HIGH_MOISTURE at 32°C should return exactly 135 minutes (2h 15min)"""
        # Formula: 240 - max(0, (32 - 25) * 15) = 240 - 105 = 135
        assert compute_safe_window("HIGH_MOISTURE", 32.0) == 135
    
    def test_temp_reduction_formula(self):
        """Verify 15 minutes reduction per degree above 25°C"""
        # MEDIUM_MOISTURE base = 360
        # At 30°C: 360 - (5 * 15) = 360 - 75 = 285
        assert compute_safe_window("MEDIUM_MOISTURE", 30.0) == 285
        
        # At 35°C: 360 - (10 * 15) = 360 - 150 = 210
        assert compute_safe_window("MEDIUM_MOISTURE", 35.0) == 210
    
    def test_never_goes_below_min_window(self):
        """Very high temperatures floor at MIN_WINDOW (30 min)"""
        # HIGH_MOISTURE base = 240, would go negative at high temp
        # 240 - (20 * 15) = 240 - 300 = -60, floored to 30
        assert compute_safe_window("HIGH_MOISTURE", 45.0) == settings.MIN_WINDOW
        assert compute_safe_window("HIGH_MOISTURE", 100.0) == settings.MIN_WINDOW
    
    def test_different_tiers(self):
        """Verify all three tiers work correctly"""
        temp = 28.0  # 3 degrees above 25
        # reduction = 3 * 15 = 45
        assert compute_safe_window("HIGH_MOISTURE", temp) == 240 - 45  # 195
        assert compute_safe_window("MEDIUM_MOISTURE", temp) == 360 - 45  # 315
        assert compute_safe_window("DRY", temp) == 480 - 45  # 435


class TestRemainingMinutes:
    """Test remaining time calculation"""
    
    def test_future_expiry(self):
        """Calculate minutes remaining for future expiration"""
        now = datetime(2026, 11, 14, 12, 0, 0)
        expires = datetime(2026, 11, 14, 14, 15, 0)  # 2h 15min later
        assert remaining_minutes(expires, now) == 135
    
    def test_short_window(self):
        """Handle short remaining windows"""
        now = datetime(2026, 11, 14, 12, 0, 0)
        expires = datetime(2026, 11, 14, 12, 5, 30)  # 5.5 minutes
        assert remaining_minutes(expires, now) == 5  # Floors to int
    
    def test_never_negative(self):
        """Already expired batches return 0, not negative"""
        now = datetime(2026, 11, 14, 12, 0, 0)
        expires = datetime(2026, 11, 14, 10, 0, 0)  # 2 hours ago
        assert remaining_minutes(expires, now) == 0
    
    def test_exactly_expired(self):
        """Expiry exactly at 'now' returns 0"""
        now = datetime(2026, 11, 14, 12, 0, 0)
        expires = datetime(2026, 11, 14, 12, 0, 0)
        assert remaining_minutes(expires, now) == 0


class TestUrgency:
    """Test urgency scoring"""
    
    def test_basic_urgency_calculation(self):
        """Verify urgency = travel_time / remaining_time"""
        # AVG_SPEED_KMPH = 20.0 (default)
        # 10 km at 20 km/h = 0.5 hours = 30 minutes travel
        # 60 minutes remaining
        # urgency = 30 / 60 = 0.5
        assert urgency(10.0, 60) == 0.5
    
    def test_high_urgency(self):
        """Close expiry with long distance = high urgency"""
        # 20 km = 60 minutes travel (at 20 km/h)
        # 60 minutes remaining
        # urgency = 60 / 60 = 1.0 (critical)
        assert urgency(20.0, 60) == 1.0
        
        # urgency > 1 means travel time exceeds remaining window
        assert urgency(20.0, 30) == 2.0
    
    def test_low_urgency(self):
        """Long remaining window with short distance = low urgency"""
        # 5 km = 15 minutes travel
        # 120 minutes remaining
        # urgency = 15 / 120 = 0.125
        assert urgency(5.0, 120) == 0.125
    
    def test_expired_batch_returns_infinity(self):
        """Expired batches (remaining <= 0) return infinity"""
        assert urgency(10.0, 0) == float("inf")
        assert urgency(10.0, -10) == float("inf")
    
    def test_escalation_threshold(self):
        """Verify urgency crosses URGENCY_ESCALATE at expected values"""
        # URGENCY_ESCALATE = 0.6 (default)
        # 12 km = 36 min travel; 60 min remaining → urgency = 0.6
        assert urgency(12.0, 60) == 0.6
        
        # Just above threshold
        assert urgency(13.0, 60) > settings.URGENCY_ESCALATE
        
        # Just below threshold
        assert urgency(11.0, 60) < settings.URGENCY_ESCALATE
