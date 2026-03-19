#!/bin/bash
# Smoke test for Eulard REST API
# Usage: EULARD_API_KEY=eul_xxx ./scripts/test-api.sh

set -e

BASE="https://eulard.kelihi.com"
AUTH="Authorization: Bearer $EULARD_API_KEY"

if [ -z "$EULARD_API_KEY" ]; then
  echo "ERROR: Set EULARD_API_KEY first"
  echo "  Generate one from: $BASE/admin -> API Keys"
  exit 1
fi

echo "=== Testing Eulard API ==="

echo -n "1. GET /api/me ... "
ME=$(curl -sf -H "$AUTH" "$BASE/api/me")
echo "$ME" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['email'], '(' + d['role'] + ')')"

echo -n "2. POST /api/diagrams (create) ... "
CREATED=$(curl -sf -X POST -H "$AUTH" -H "Content-Type: application/json" \
  -d '{"title":"API Test Diagram","code":"flowchart TB\n    A[Test] --> B[Success]"}' \
  "$BASE/api/diagrams")
ID=$(echo "$CREATED" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
echo "created $ID"

echo -n "3. GET /api/diagrams/$ID ... "
GOT=$(curl -sf -H "$AUTH" "$BASE/api/diagrams/$ID")
TITLE=$(echo "$GOT" | python3 -c "import sys,json; print(json.load(sys.stdin)['title'])")
echo "$TITLE"

echo -n "4. GET /api/diagrams (list) ... "
LIST=$(curl -sf -H "$AUTH" "$BASE/api/diagrams")
COUNT=$(echo "$LIST" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))")
echo "$COUNT diagrams"

echo -n "5. GET /api/diagrams/search?q=Test ... "
SEARCH=$(curl -sf -H "$AUTH" "$BASE/api/diagrams/search?q=Test")
SCOUNT=$(echo "$SEARCH" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))")
echo "$SCOUNT results"

echo -n "6. PUT /api/diagrams/$ID (update) ... "
curl -sf -X PUT -H "$AUTH" -H "Content-Type: application/json" \
  -d '{"title":"API Test Updated"}' \
  "$BASE/api/diagrams/$ID" > /dev/null
echo "ok"

echo -n "7. DELETE /api/diagrams/$ID ... "
curl -sf -X DELETE -H "$AUTH" "$BASE/api/diagrams/$ID" > /dev/null
echo "ok"

echo ""
echo "All tests passed!"
