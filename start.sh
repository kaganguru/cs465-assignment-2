#!/bin/bash

# CS465 Robot Animation - Startup Script
echo "Starting CS465 Robot Animation application..."
echo ""
echo "Starting local web server on port 8080..."
echo "Open your browser and navigate to: http://localhost:8080"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

# Start Python HTTP server
python3 -m http.server 8080

