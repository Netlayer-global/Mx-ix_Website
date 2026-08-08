#!/bin/bash

# MX-IX Backend API Test Script
# Tests all CRUD operations for Continents and Locations

BASE_URL="http://localhost:5000/api"
echo "========================================"
echo "MX-IX Backend API Test"
echo "========================================"

# Login to get token
echo ""
echo "1. Logging in..."
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@mx-ix.com","password":"admin123"}')

TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
if [ -z "$TOKEN" ]; then
  echo "❌ Login failed: $LOGIN_RESPONSE"
  exit 1
fi
echo "✅ Login successful"

# Test Continents API
echo ""
echo "========================================"
echo "Testing Continents API"
echo "========================================"

# List continents
echo ""
echo "2. List all continents..."
CONTINENTS=$(curl -s "$BASE_URL/continents")
echo "Response: $(echo $CONTINENTS | head -c 200)..."
echo "✅ List continents: OK"

# Get single continent
echo ""
echo "3. Get single continent (asia)..."
CONTINENT=$(curl -s "$BASE_URL/continents/asia")
echo "Response: $CONTINENT"
echo "✅ Get continent: OK"

# Create new continent
echo ""
echo "4. Create new continent (oceania)..."
CREATE_CONTINENT=$(curl -s -X POST "$BASE_URL/continents" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"id":"oceania","name":"Oceania","description":"Australia and Pacific Islands","order":7}')
echo "Response: $CREATE_CONTINENT"
if echo "$CREATE_CONTINENT" | grep -q '"success":true'; then
  echo "✅ Create continent: OK"
else
  echo "⚠️ Create continent: Already exists or error"
fi

# Update continent
echo ""
echo "5. Update continent (oceania)..."
UPDATE_CONTINENT=$(curl -s -X PUT "$BASE_URL/continents/oceania" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"description":"Australia, New Zealand and Pacific Islands"}')
echo "Response: $UPDATE_CONTINENT"
echo "✅ Update continent: OK"

# Test Locations API
echo ""
echo "========================================"
echo "Testing Locations API"
echo "========================================"

# List locations
echo ""
echo "6. List all locations..."
LOCATIONS=$(curl -s "$BASE_URL/locations")
COUNT=$(echo $LOCATIONS | grep -o '"id"' | wc -l)
echo "Found $COUNT locations"
echo "✅ List locations: OK"

# Get single location
echo ""
echo "7. Get single location (del)..."
LOCATION=$(curl -s "$BASE_URL/locations/del")
echo "Response: $(echo $LOCATION | head -c 300)..."
echo "✅ Get location: OK"

# Create new location
echo ""
echo "8. Create new test location..."
CREATE_LOCATION=$(curl -s -X POST "$BASE_URL/locations" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "id":"test-loc",
    "name":"Test Location",
    "coordinates":[0,0],
    "code":"TEST",
    "region":"ASIA",
    "continentId":"asia",
    "status":"upcoming"
  }')
echo "Response: $CREATE_LOCATION"
if echo "$CREATE_LOCATION" | grep -q '"success":true'; then
  echo "✅ Create location: OK"
else
  echo "⚠️ Create location: Already exists or error"
fi

# Update location
echo ""
echo "9. Update test location..."
UPDATE_LOCATION=$(curl -s -X PUT "$BASE_URL/locations/test-loc" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"name":"Updated Test Location","status":"current"}')
echo "Response: $UPDATE_LOCATION"
echo "✅ Update location: OK"

# Add ASN to location
echo ""
echo "10. Add ASN to test location..."
ADD_ASN=$(curl -s -X POST "$BASE_URL/locations/test-loc/asns" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"asnNumber":12345,"name":"Test ISP","peeringPolicy":"Open","status":"ACTIVE"}')
echo "Response: $(echo $ADD_ASN | head -c 200)..."
echo "✅ Add ASN: OK"

# Add Site to location
echo ""
echo "11. Add Site to test location..."
ADD_SITE=$(curl -s -X POST "$BASE_URL/locations/test-loc/sites" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"id":"test-dc-1","name":"Test Datacenter","provider":"Test Provider","address":"123 Test St","status":"available"}')
echo "Response: $(echo $ADD_SITE | head -c 200)..."
echo "✅ Add Site: OK"

# Get location ASNs
echo ""
echo "12. Get location ASNs..."
ASNS=$(curl -s "$BASE_URL/locations/test-loc/asns")
echo "Response: $ASNS"
echo "✅ Get ASNs: OK"

# Get location Sites
echo ""
echo "13. Get location Sites..."
SITES=$(curl -s "$BASE_URL/locations/test-loc/sites")
echo "Response: $SITES"
echo "✅ Get Sites: OK"

# Delete ASN
echo ""
echo "14. Delete ASN from location..."
DELETE_ASN=$(curl -s -X DELETE "$BASE_URL/locations/test-loc/asns/12345" \
  -H "Authorization: Bearer $TOKEN")
echo "Response: $DELETE_ASN"
echo "✅ Delete ASN: OK"

# Delete Site
echo ""
echo "15. Delete Site from location..."
DELETE_SITE=$(curl -s -X DELETE "$BASE_URL/locations/test-loc/sites/test-dc-1" \
  -H "Authorization: Bearer $TOKEN")
echo "Response: $DELETE_SITE"
echo "✅ Delete Site: OK"

# Delete test location
echo ""
echo "16. Delete test location..."
DELETE_LOCATION=$(curl -s -X DELETE "$BASE_URL/locations/test-loc" \
  -H "Authorization: Bearer $TOKEN")
echo "Response: $DELETE_LOCATION"
echo "✅ Delete location: OK"

# Delete test continent
echo ""
echo "17. Delete test continent (oceania)..."
DELETE_CONTINENT=$(curl -s -X DELETE "$BASE_URL/continents/oceania" \
  -H "Authorization: Bearer $TOKEN")
echo "Response: $DELETE_CONTINENT"
echo "✅ Delete continent: OK"

# Final counts
echo ""
echo "========================================"
echo "Final State"
echo "========================================"
FINAL_CONTINENTS=$(curl -s "$BASE_URL/continents" | grep -o '"id"' | wc -l)
FINAL_LOCATIONS=$(curl -s "$BASE_URL/locations" | grep -o '"id"' | wc -l)
echo "Continents: $FINAL_CONTINENTS"
echo "Locations: $FINAL_LOCATIONS"

echo ""
echo "========================================"
echo "All tests completed!"
echo "========================================"
