#!/bin/bash
# set_version.sh - Update Theoria engine version in misc.cpp
# Place this script in src/ directory

MISC_FILE="misc.cpp"

# Check if misc.cpp exists
if [ ! -f "$MISC_FILE" ]; then
    echo "Error: $MISC_FILE not found. Are you in the src/ directory?"
    exit 1
fi

# Get current version
CURRENT=$(grep -oP 'constexpr std::string_view version = "\K[^"]+' "$MISC_FILE")
echo "Current version: $CURRENT"

# Prompt for new version
read -p "Enter new version: " NEW_VERSION

# Validate input
if [ -z "$NEW_VERSION" ]; then
    echo "Error: Version cannot be empty."
    exit 1
fi

# Confirm change
read -p "Change version from '$CURRENT' to '$NEW_VERSION'? (y/n): " CONFIRM

if [ "$CONFIRM" != "y" ] && [ "$CONFIRM" != "Y" ]; then
    echo "Aborted."
    exit 0
fi

# Perform the replacement
sed -i "s/constexpr std::string_view version = \"[^\"]*\"/constexpr std::string_view version = \"$NEW_VERSION\"/" "$MISC_FILE"

# Verify the change
NEW_CHECK=$(grep -oP 'constexpr std::string_view version = "\K[^"]+' "$MISC_FILE")
echo "Version updated to: $NEW_CHECK"
