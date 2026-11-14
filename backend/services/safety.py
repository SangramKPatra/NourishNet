# Phase 2 — Safety engine (pure functions)
from datetime import datetime
from ..config import settings, Tier


def compute_safe_window(tier: Tier, temp_c: float) -> int:
    """
    Compute the safe collection window in minutes for a given perishability tier and temperature.
    
    Formula: base[tier] - max(0, (temp_c - 25.0) * 15), floored at MIN_WINDOW.
    - At or below 25°C: returns the base window.
    - Above 25°C: reduces the window by 15 minutes per degree.
    - Never goes below MIN_WINDOW (30 minutes).
    
    Args:
        tier: Perishability tier (HIGH_MOISTURE, MEDIUM_MOISTURE, DRY)
        temp_c: Ambient temperature in Celsius
    
    Returns:
        Safe window in minutes
    """
    base = settings.BASE_WINDOWS[tier]
    adjusted = base - max(0, (temp_c - 25.0) * 15)
    return max(settings.MIN_WINDOW, int(adjusted))


def remaining_minutes(expires_at: datetime, now: datetime) -> int:
    """
    Calculate remaining minutes until expiration. Never negative.
    
    Args:
        expires_at: Expiration datetime
        now: Current datetime
    
    Returns:
        Minutes remaining (0 if already expired)
    """
    delta_seconds = (expires_at - now).total_seconds()
    return max(0, int(delta_seconds // 60))


def urgency(distance_km: float, remaining_min: int) -> float:
    """
    Calculate dispatch urgency: ratio of travel time to remaining window.
    
    Higher values mean more urgent. Returns infinity if already expired.
    
    Formula: (distance_km / AVG_SPEED_KMPH * 60) / remaining_min
    
    Args:
        distance_km: Distance from donor to shelter
        remaining_min: Minutes remaining in safe window
    
    Returns:
        Urgency score (higher = more urgent, inf if expired)
    """
    if remaining_min <= 0:
        return float("inf")
    travel_min = distance_km / settings.AVG_SPEED_KMPH * 60
    return travel_min / max(remaining_min, 1)
