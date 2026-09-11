#!/bin/bash
# Stamp the build id (MMDD-HHMM, local time) into index.html before committing.
cd "$(dirname "$0")" && sed -i '' "s/const BUILD = \"[0-9]*-[0-9]*\";/const BUILD = \"$(date +%m%d-%H%M)\";/" index.html && grep -o 'const BUILD = "[^"]*"' index.html
