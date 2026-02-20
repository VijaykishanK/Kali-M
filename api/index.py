import os
import sys

# Add root directory to sys.path so 'backend' can be imported
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.main import app
