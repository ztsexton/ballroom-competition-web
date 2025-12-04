# Judges Management Feature

## Overview
Added a complete judges management system to the Ballroom Competition Scorer application.

## What's New

### 1. Data Storage
- **judges.json**: Stores all judge information including:
  - Judge ID (internal unique identifier)
  - Judge Name
  - Judge Number (unique number used for scoring)

### 2. Web Interface

#### Navigation
- New "⚖️ Judges" link added to the main navigation bar

#### Pages Added
1. **Manage Judges** (`/judges`)
   - View all judges in a table format
   - Shows judge number and name
   - Delete individual judges
   - Empty state for when no judges are added

2. **Add Judge** (`/judges/add`)
   - Form to add new judges
   - Fields: Name and Judge Number
   - Validation to prevent duplicate judge numbers
   - Error handling for conflicts

### 3. Backend Features
- **Data Persistence**: Judges are saved to `judges.json`
- **Auto-loading**: Judges data loads automatically on application startup
- **Validation**: Prevents duplicate judge numbers
- **Sorted Display**: Judges are automatically sorted by judge number

### 4. API Endpoints
- `GET /judges` - View all judges
- `GET /judges/add` - Show add judge form
- `POST /judges/add` - Create a new judge
- `POST /judges/<id>/delete` - Delete a judge

## Current Functionality
- Add judges with unique names and numbers
- View all registered judges
- Delete judges when needed
- Judges are stored persistently across sessions

## Future Enhancements (Mentioned by User)
- Assign specific judges to specific heats
- Generate judge schedules based on heat requirements
- Track which judges are assigned to which heats
- Prevent scheduling conflicts

## Usage
1. Navigate to "⚖️ Judges" in the main menu
2. Click "➕ Add Judge" to add a new judge
3. Enter the judge's name and assign a unique judge number
4. Judges can be deleted if they haven't been assigned to any heats (future feature)

## Technical Details
- Judge numbers must be positive integers
- Each judge number must be unique across all judges
- Judges are sorted by judge number for easy viewing
- JSON storage format for easy backup and portability
