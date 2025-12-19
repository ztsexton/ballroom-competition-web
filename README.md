# Ballroom Competition Scorer - React + Node.js/TypeScript

A modern web application for managing ballroom dance competitions, scoring, and results. This is a complete rewrite of the original Python/Flask application using React, Node.js, and TypeScript with best practices.

## Architecture

### Backend (Node.js + TypeScript + Express)
- **REST API** with clear endpoint structure
- **TypeScript** for type safety
- **JSON file storage** for data persistence
- **Service layer** separation for business logic
- **Comprehensive tests** using Jest and Supertest

### Frontend (React + TypeScript + Vite)
- **React 18** with TypeScript
- **React Router** for navigation
- **Axios** for API communication
- **Vite** for fast development and builds
- **Vitest** for testing

## Project Structure

```
backend/
├── src/
│   ├── __tests__/         # Test files
│   ├── routes/            # API route handlers
│   ├── services/          # Business logic
│   ├── types/             # TypeScript type definitions
│   └── server.ts          # Main server file
├── data/                  # JSON data storage
├── package.json
└── tsconfig.json

frontend/
├── src/
│   ├── __tests__/         # Component tests
│   ├── api/               # API client
│   ├── components/        # Reusable components
│   ├── pages/             # Page components
│   ├── types/             # TypeScript types
│   ├── App.tsx            # Main app component
│   └── main.tsx           # Entry point
├── index.html
├── package.json
└── vite.config.ts
```

## Features

### Core Functionality
- **People Management**: Add dancers as leaders, followers, or both
- **Couples Management**: Create couples from registered people
- **Judge Management**: Register and manage competition judges
- **Event Management**: Create events with automatic round generation
- **Scoring System**: 
  - Recall rounds (quarter-final, semi-final) with marks
  - Final rounds with ranking
  - Automatic advancement to next round
- **Results Display**: Real-time results with sorting

### Automatic Round Generation
- 1-6 couples: Final only
- 7-14 couples: Semi-final + Final
- 15+ couples: Quarter-final + Semi-final + Final

## Setup and Installation

### Prerequisites
- Node.js 18+ and npm
- Git

### Backend Setup

```bash
cd backend
npm install
```

### Frontend Setup

```bash
cd frontend
npm install
```

## Running the Application

### Development Mode

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```
The backend will run on `http://localhost:3001`

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```
The frontend will run on `http://localhost:3000`

### Production Build

**Backend:**
```bash
cd backend
npm run build
npm start
```

**Frontend:**
```bash
cd frontend
npm run build
npm run preview
```

## Testing

### Backend Tests
```bash
cd backend
npm test                 # Run tests once
npm run test:watch      # Run tests in watch mode
npm run test:coverage   # Run with coverage report
```

Backend tests focus on:
- API endpoint behavior
- Scoring calculation logic
- Data persistence
- Error handling

### Frontend Tests
```bash
cd frontend
npm test                 # Run tests in watch mode
npm run test:coverage   # Run with coverage
```

Frontend tests focus on:
- User interactions and workflows
- Component rendering behavior
- Navigation
- API integration

## API Endpoints

### People
- `GET /api/people` - Get all people
- `GET /api/people/:id` - Get person by ID
- `POST /api/people` - Create new person
- `PATCH /api/people/:id` - Update person
- `DELETE /api/people/:id` - Delete person

### Couples
- `GET /api/couples` - Get all couples
- `GET /api/couples/:bib` - Get couple by bib number
- `POST /api/couples` - Create new couple
- `DELETE /api/couples/:bib` - Delete couple

### Judges
- `GET /api/judges` - Get all judges
- `GET /api/judges/:id` - Get judge by ID
- `POST /api/judges` - Create new judge
- `DELETE /api/judges/:id` - Delete judge

### Events
- `GET /api/events` - Get all events
- `GET /api/events/:id` - Get event by ID
- `POST /api/events` - Create new event
- `PATCH /api/events/:id` - Update event
- `DELETE /api/events/:id` - Delete event
- `GET /api/events/:id/results/:round` - Get results for a round
- `POST /api/events/:id/scores/:round` - Submit scores for a round
- `DELETE /api/events/:id/scores/:round` - Clear scores for a round

## Development Best Practices

### TypeScript
- Strict type checking enabled
- Shared types between frontend and backend
- No `any` types in production code

### Code Organization
- **Separation of concerns**: Routes, services, and data layers
- **Single Responsibility**: Each module has one clear purpose
- **DRY Principle**: Reusable components and utilities

### Testing Strategy
- **Behavior-focused tests**: Test what the app does, not how it does it
- **Integration over unit**: Test API endpoints end-to-end
- **User-centric**: Frontend tests simulate real user interactions
- **No implementation details**: Tests remain stable when refactoring

### Error Handling
- Graceful error messages to users
- Proper HTTP status codes
- Validation at API boundaries

## Data Storage

Data is stored in JSON files in the `backend/data/` directory:
- `people.json` - Registered dancers
- `couples.json` - Couple pairings
- `judges.json` - Competition judges
- `events.json` - Events, heats, and scores

## Differences from Python Version

### Improvements
✅ **Type Safety**: Full TypeScript coverage  
✅ **Modern Stack**: React + Node.js ecosystem  
✅ **Better Testing**: Comprehensive test coverage  
✅ **Component Reusability**: React component architecture  
✅ **API-First Design**: Clear REST API for potential mobile apps  
✅ **Development Experience**: Hot reload, better tooling  

### Maintained Features
✅ All core functionality preserved  
✅ Same scoring algorithm (skating system)  
✅ Same round progression logic  
✅ JSON file storage (no database required)  

## Contributing

When adding features:
1. Define TypeScript types first
2. Write tests before implementation
3. Update API documentation
4. Maintain backward compatibility in data formats

## License

MIT

## Support

For issues or questions, please open a GitHub issue.
