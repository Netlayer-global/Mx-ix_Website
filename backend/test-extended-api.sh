#!/bin/bash

BASE_URL="http://localhost:5000/api"
echo "========================================"
echo "MX-IX Backend Extended API Test"
echo "========================================"

# Login
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@mx-ix.com","password":"admin123"}')
TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "❌ Login failed"
  exit 1
fi

# Create Location with Extended Fields and Pricing
echo ""
echo "1. Create Location with Extended Fields..."
CREATE_PAYLOAD='{
  "id": "ext-loc-1",
  "name": "Extended Location",
  "coordinates": [10, 20],
  "code": "EXT_LOC",
  "region": "ASIA",
  "continentId": "asia",
  "status": "upcoming",
  "country": "Test Country",
  "latency": "5ms",
  "capacity": "1Tbps",
  "portSpeeds": ["10G", "100G", "400G"],
  "pricing": [
    {
      "portSpeed": "10G",
      "monthlyPrice": 500,
      "setupFee": 100,
      "currency": "USD"
    },
    {
      "portSpeed": "100G",
      "monthlyPrice": 2000,
      "setupFee": 500,
      "currency": "USD"
    }
  ]
}'

CREATE_RES=$(curl -s -X POST "$BASE_URL/locations" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "$CREATE_PAYLOAD")

echo "Response: $(echo $CREATE_RES | head -c 200)..."

# Verify Extended Fields
echo ""
echo "2. Verify Extended Fields..."
GET_RES=$(curl -s "$BASE_URL/locations/ext-loc-1")
echo "Response: $GET_RES"

if echo "$GET_RES" | grep -q '"monthlyPrice":2000'; then
  echo "✅ Pricing saved correctly"
else
  echo "❌ Pricing check failed"
fi

if echo "$GET_RES" | grep -q '"country":"Test Country"'; then
  echo "✅ Country saved correctly"
else
  echo "❌ Country check failed"
fi

# Update Location with Extended Fields
echo ""
echo "3. Update Extended Fields..."
UPDATE_PAYLOAD='{
  "capacity": "2Tbps",
  "pricing": [
    {
      "portSpeed": "10G",
      "monthlyPrice": 450,
      "setupFee": 0,
      "currency": "USD"
    }
  ]
}'

UPDATE_RES=$(curl -s -X PUT "$BASE_URL/locations/ext-loc-1" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "$UPDATE_PAYLOAD")

echo "Response: $(echo $UPDATE_RES | head -c 200)..."

# Verify Update
echo ""
echo "4. Verify Update..."
GET_UPDATED=$(curl -s "$BASE_URL/locations/ext-loc-1")

if echo "$GET_UPDATED" | grep -q '"capacity":"2Tbps"'; then
  echo "✅ Capacity updated correctly"
else
  echo "❌ Capacity update failed"
fi

if echo "$GET_UPDATED" | grep -q '"monthlyPrice":450'; then
  echo "✅ Pricing updated correctly"
else
  echo "❌ Pricing update failed"
fi

# Clean up
echo ""
echo "5. Clean up..."
curl -s -X DELETE "$BASE_URL/locations/ext-loc-1" \
  -H "Authorization: Bearer $TOKEN" > /dev/null
echo "✅ Cleaned up test data"

echo "========================================"
echo "Extended API Tests Completed"
echo "========================================"
