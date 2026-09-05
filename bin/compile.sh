#!/usr/bin/env bash
set -euo pipefail

../node_modules/.bin/babel ../src/index.js --out-file ../dist/index.js
