import sys
sys.path.insert(0, r'.')
from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)

# Test signup
print("=== Testing Signup ===")
resp = client.post("/api/auth/signup", json={
    "email": "testlogin@example.com",
    "password": "password123",
    "role": "supplier",
    "lat": 37.7749,
    "lng": -122.4194,
    "radius_km": 15
})
print(f"Signup status: {resp.status_code}")
print(f"Signup body: {resp.text[:300]}")

# Test signin
print("\n=== Testing Signin ===")
resp = client.post("/api/auth/signin", json={
    "email": "testlogin@example.com",
    "password": "password123"
})
print(f"Signin status: {resp.status_code}")
print(f"Signin body: {resp.text[:300]}")

# Test me
print("\n=== Testing Me ===")
# First get a token by signing in
if resp.status_code == 200:
    token = resp.json().get("token")
    print(f"Token: {token[:20] if token else 'None'}...")
    if token:
        resp = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
        print(f"Me status: {resp.status_code}")
        print(f"Me body: {resp.text[:300]}")
else:
    print("Could not test me - signin failed")