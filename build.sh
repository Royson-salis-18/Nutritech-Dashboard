#!/usr/bin/env bash
# exit on error
set -o errexit

# Install Python dependencies
pip install -r requirements.txt

# Build the React dashboard
cd frontend/nutritech-dashboard
npm install
npm run build
cd ../..
