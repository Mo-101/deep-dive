#!/bin/bash
# AFRO Storm Intelligence Pipeline Setup Script

set -e

echo "🔥 AFRO STORM INTELLIGENCE PIPELINE - SETUP"
echo "=========================================="

# Check Python version
python_version=$(python3 --version 2>&1 | awk '{print $2}')
required_version="3.10"

if [ "$(printf '%s\n' "$required_version" "$python_version" | sort -V | head -n1)" != "$required_version" ]; then 
    echo "❌ Python 3.10+ required. Found: $python_version"
    exit 1
fi

echo "✓ Python version: $python_version"

# Create virtual environment
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
    echo "✓ Virtual environment created"
fi

# Activate virtual environment
echo "Activating virtual environment..."
source venv/bin/activate

# Upgrade pip
echo "Upgrading pip..."
pip install --upgrade pip > /dev/null 2>&1

# Install dependencies
echo "Installing dependencies (this may take a few minutes)..."
pip install -r requirements.txt > setup.log 2>&1

if [ $? -eq 0 ]; then
    echo "✓ Dependencies installed"
else
    echo "❌ Failed to install dependencies. Check setup.log"
    exit 1
fi

# Create directory structure
echo "Creating directory structure..."
mkdir -p data/{raw,processed,geojson/{fnv3,graphcast,who},latest}
mkdir -p logs
mkdir -p reports
mkdir -p models

echo "✓ Directories created"

# Setup environment file
if [ ! -f ".env" ]; then
    echo "Creating .env file from template..."
    cp .env.example .env
    echo "⚠️  Please edit .env with your API keys"
else
    echo "✓ .env file already exists"
fi

# Test imports
echo "Testing core imports..."
python3 -c "
import sys
sys.path.insert(0, '.')
from config.settings import config, get_config_summary
print(get_config_summary())
" 2>&1

if [ $? -eq 0 ]; then
    echo "✓ Core imports successful"
else
    echo "⚠️  Some imports failed (this is OK if optional dependencies are missing)"
fi

echo ""
echo "=========================================="
echo "🎉 SETUP COMPLETE"
echo "=========================================="
echo ""
echo "Next steps:"
echo ""
echo "1. Edit .env file with your API keys:"
echo "   nano .env"
echo ""
echo "2. Test individual components:"
echo "   python src/data_sources/fnv3_fetcher.py"
echo "   python src/data_sources/who_fetcher.py"
echo "   python src/ai_agents/claude_analyst.py"
echo ""
echo "3. Run full pipeline:"
echo "   python src/pipeline_orchestrator.py --mode full"
echo ""
echo "4. Check outputs:"
echo "   ls -lh data/geojson/fnv3/"
echo "   ls -lh reports/"
echo ""
echo "🔥 The watchtower awaits your command."
echo ""
