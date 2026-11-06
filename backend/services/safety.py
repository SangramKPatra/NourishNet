# Placeholder safety functions

def compute_safe_window(tier, temp_c):
    from .config import settings
    base = settings.BASE_WINDOWS[tier]
    adjusted = base - max(0, (temp_c - 25.0) * 15)
    return max(settings.MIN_WINDOW, int(adjusted))

def remaining_minutes(expires_at, now):
    return max(0, int((expires_at - now).total_seconds() // 60))

def urgency(distance_km, remaining_min):
    if remaining_min <= 0:
        return float("inf")
    from .config import settings
    travel_min = distance_km / settings.AVG_SPEED_KMPH * 60
    return travel_min / remaining_min
