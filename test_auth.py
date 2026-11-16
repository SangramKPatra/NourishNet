import asyncio
from backend.db import AsyncSessionLocal
from backend.services.auth import register_user, login_user, get_current_user

async def main():
    async with AsyncSessionLocal() as s:
        print("Testing signup...")
        try:
            u = await register_user(s, 'test@example.com', 'password123', 'supplier', 37.7749, -122.4194, 15)
            print('SIGNUP OK', u.id, u.email, u.role, u.lat, u.lng, u.radius_km)
        except Exception as e:
            print('SIGNUP ERROR:', type(e).__name__, str(e))
        
        print("Testing login...")
        result = await login_user(s, 'test@example.com', 'password123')
        if result:
            user, token = result
            print('LOGIN OK', user.email, user.role, 'token length', len(token))
            result2 = await get_current_user(s, token)
            if result2:
                print('ME OK', result2.email, result2.role)
            else:
                print('ME FAILED')
        else:
            print('LOGIN FAILED')

asyncio.run(main())
"