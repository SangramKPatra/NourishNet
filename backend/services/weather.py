# Simplified weather stub

class WeatherData:
    def __init__(self, temp_c):
        self.temp_c = temp_c
        self.humidity_pct = 50
        self.source = "fallback"

async def get_weather(lat, lng):
    return WeatherData(30)
