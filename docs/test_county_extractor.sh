#!/bin/bash
# Test script for the county_extractor endpoint

# Default values
HTML_FILE=$1
STATE=${2:-VA}
COUNTY=${3:-"Fairfax County"}
SITE_NAME=${4:-LDIP}

if [ -z "$HTML_FILE" ]; then
  echo "Usage: ./test_county_extractor.sh <html_file_path> [state] [county] [site_name]"
  exit 1
fi

if [ ! -f "$HTML_FILE" ]; then
  echo "Error: File not found: $HTML_FILE"
  exit 1
fi

# Create a temporary JSON file
TMP_JSON=$(mktemp)

# Read the HTML content and escape it properly for JSON
HTML_CONTENT=$(cat "$HTML_FILE" | python3 -c "import sys, json; print(json.dumps(sys.stdin.read()))")

# Create the JSON payload
cat > "$TMP_JSON" << EOF
{
  "state": "$STATE",
  "county": "$COUNTY",
  "site_name": "$SITE_NAME",
  "html_text": $HTML_CONTENT
}
EOF

echo "Sending request to county_extractor:"
echo "  State: $STATE"
echo "  County: $COUNTY"
echo "  Site Name: $SITE_NAME"
echo "  HTML Size: $(stat -c%s "$HTML_FILE") bytes"

# Send the request
curl -X POST "http://localhost:8070/county_extractor/" \
  -H "Content-Type: application/json" \
  -d @"$TMP_JSON"

# Clean up
rm "$TMP_JSON"
