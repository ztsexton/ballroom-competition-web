# Migration Guide: Python/Flask → React/Node.js

## Overview

This guide helps you transition from the Python/Flask application to the new React/Node.js TypeScript version.

## Data Migration

### Automatic Migration

The Python application stores data in:
- `data/people.json`
- `data/couples.json`
- `data/judges.json`
- `data/scorer_data.pkl` (pickled Python data)

The new application uses the same JSON files! Simply:

1. **Copy your data directory:**
   ```bash
   cp -r data backend/data
   ```

2. **The backend will automatically migrate** old data formats on startup

### Manual Data Export (if needed)

If you want to export from Python first:

```python
# In your Python environment
from web_app import people, couples, judges, events, scorer
import json

# Export to standardized format
with open('export.json', 'w') as f:
    json.dump({
        'people': people,
        'couples': couples,
        'judges': judges,
        'events': events,
        'scores': {f"{k[0]}:{k[1]}:{k[2]}": v for k, v in scorer.scores.items()}
    }, f, indent=2)
```

## Feature Comparison

| Feature | Python/Flask | React/Node.js | Status |
|---------|--------------|---------------|---------|
| People Management | ✅ | ✅ | **Same** |
| Couples Management | ✅ | ✅ | **Same** |
| Judges Management | ✅ | ✅ | **Same** |
| Event Creation | ✅ | ✅ | **Same** |
| Scoring (Final) | ✅ | ✅ | **Same** |
| Scoring (Recall) | ✅ | ✅ | **Same** |
| Results Display | ✅ | ✅ | **Same** |
| CSV Export | ✅ | 🚧 | **Planned** |
| PDF Export | ✅ | 🚧 | **Planned** |
| Multi-round Events | ✅ | ✅ | **Enhanced** |

## API Endpoints Mapping

### Python Flask Routes → Node.js Express Routes

| Flask Route | Express Route | Method |
|-------------|---------------|---------|
| `/people` | `/api/people` | GET |
| `/people/add` (POST) | `/api/people` | POST |
| `/people/<id>/delete` | `/api/people/:id` | DELETE |
| `/couples` | `/api/couples` | GET |
| `/couples/add` (POST) | `/api/couples` | POST |
| `/judges` | `/api/judges` | GET |
| `/event/new` (POST) | `/api/events` | POST |
| `/event/<id>` | `/api/events/:id` | GET |
| `/event/<id>/<round>/score` | `/api/events/:id/scores/:round` | POST |
| `/event/<id>/<round>/results` | `/api/events/:id/results/:round` | GET |

## Code Structure Comparison

### Python Structure
```
web_app.py                    # All logic in one file
simple_ballroom_scorer.py     # Scoring logic
templates/                    # HTML templates
data/                        # JSON storage
```

### Node.js/React Structure
```
backend/
  src/
    routes/                  # API endpoints
    services/                # Business logic
    types/                   # Type definitions
frontend/
  src/
    pages/                   # Page components
    components/              # Reusable UI
    api/                     # API client
```

## Configuration Changes

### Environment Variables

**Python (.env or config):**
```python
PORT = 5000
DEBUG = True
```

**Node.js Backend (.env):**
```bash
PORT=3001
NODE_ENV=development
```

**React Frontend (.env):**
```bash
VITE_API_URL=http://localhost:3001/api
```

## Development Workflow Changes

### Running the App

**Before (Python):**
```bash
python web_app.py
# or
flask run
```

**After (Node.js):**
```bash
# Terminal 1 - Backend
cd backend && npm run dev

# Terminal 2 - Frontend
cd frontend && npm run dev
```

### Installing Dependencies

**Before (Python):**
```bash
pip install -r requirements.txt
```

**After (Node.js):**
```bash
cd backend && npm install
cd frontend && npm install
```

### Running Tests

**Before (Python):**
```bash
pytest  # if you had tests
```

**After (Node.js):**
```bash
cd backend && npm test
cd frontend && npm test
```

## Deployment Changes

### Docker

**Python Dockerfile:**
```dockerfile
FROM python:3.9
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
CMD ["python", "web_app.py"]
```

**Node.js Dockerfile (Backend):**
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY dist ./dist
CMD ["node", "dist/server.js"]
```

### Process Management

**Before (Python):**
- Gunicorn for production
- Flask dev server for development

**After (Node.js):**
- PM2 or Docker for production
- `tsx watch` for development

## Benefits of Migration

### Type Safety
- **Before:** Runtime errors, no autocomplete
- **After:** Compile-time checks, full IntelliSense

### Performance
- **Before:** Server-side rendering, full page reloads
- **After:** Client-side rendering, instant navigation

### Development Experience
- **Before:** Manual server restarts
- **After:** Hot module reload, instant updates

### Testing
- **Before:** Minimal test coverage
- **After:** Comprehensive unit and integration tests

### Scalability
- **Before:** Single-process Python
- **After:** Can scale frontend and backend independently

## Common Gotchas

### 1. Port Conflicts
- Python used port 5000
- Node.js backend uses 3001, frontend uses 3000
- Update any bookmarks or integrations

### 2. CORS
- Same-origin in Python (templates + Flask)
- Cross-origin in React (frontend:3000 → backend:3001)
- CORS already configured in backend

### 3. JSON vs Pickle
- Python used pickle for complex data
- Node.js uses JSON exclusively
- Data automatically converted on first load

### 4. Route Structure
- Python: `/event/<id>`
- Node.js: `/api/events/:id`
- Note the `/api` prefix!

## Troubleshooting

### "Cannot connect to backend"
1. Ensure backend is running on port 3001
2. Check `frontend/vite.config.ts` proxy settings
3. Open browser console for CORS errors

### "Data not loading"
1. Check backend/data/ directory exists
2. Verify JSON files are valid
3. Check backend console for migration logs

### "Tests failing"
1. Run `npm install` in both directories
2. Ensure no processes on ports 3000/3001
3. Check Node.js version (18+ required)

## Getting Help

If you encounter issues during migration:

1. Check the main [README.md](README.md) for setup instructions
2. Review [doc/setup/QUICKSTART.md](../doc/setup/QUICKSTART.md) for common issues
3. Open a GitHub issue with:
   - Python version you're migrating from
   - Node.js version you're using
   - Error messages
   - Data structure (anonymized)

## Rollback Plan

If you need to go back to Python temporarily:

1. Your original Python code is unchanged
2. Data files are compatible both ways
3. Simply run the Python app as before

The new system doesn't delete or modify your original setup!
