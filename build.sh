#!/usr/bin/env bash
set -e
python --version
pip install --upgrade pip
pip install -r requirements.txt
echo "Build completed."
