# Quick Start Guide

## Installation

### Step 1: Install Backend Dependencies
```bash
cd backend
npm install
```

### Step 2: Install Frontend Dependencies
```bash
cd frontend
npm install
```

## Running the App

### Option 1: Two Terminal Windows

**Terminal 1 - Start Backend:**
```bash
cd backend
npm run dev
```
✅ Backend running at http://localhost:3001

**Terminal 2 - Start Frontend:**
```bash
cd frontend
npm run dev
```
✅ Frontend running at http://localhost:3000

### Option 2: One Command (if you have tmux or similar)
```bash
# From project root
cd backend && npm run dev & cd ../frontend && npm run dev
```

## First Steps

1. Open http://localhost:3000 in your browser
2. Go to **People** → Add dancers (leaders and followers)
3. Go to **Couples** → Pair dancers into couples
4. Go to **Judges** → Add competition judges
5. Go to **Events** → Create a new event
6. **Score** the event
7. View **Results**

## Testing

```bash
# Backend tests
cd backend && npm test

# Frontend tests
cd frontend && npm test
```

## Common Issues

**Port already in use?**
```bash
# Change ports in:
# backend/src/server.ts (line 10): const PORT = 3001
# frontend/vite.config.ts (line 7): port: 3000
```

**API not connecting?**
- Ensure backend is running first
- Check console for CORS errors
- Verify backend URL in `frontend/vite.config.ts`

## Production Build

```bash
# Backend
cd backend
npm run build
npm start

# Frontend
cd frontend
npm run build
npm run preview
```

Enjoy! 🎉
