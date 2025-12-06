from flask import Flask, render_template, request, redirect, url_for, jsonify, send_file
import pandas as pd
from simple_ballroom_scorer import SimpleBallroomScorer
import os
import json
import pickle

app = Flask(__name__)
scorer = SimpleBallroomScorer()

DATA_FILE = 'data/scorer_data.pkl'
PEOPLE_FILE = 'data/people.json'
COUPLES_FILE = 'data/couples.json'
JUDGES_FILE = 'data/judges.json'

# Data structures for new model
people = []  # List of {'id': int, 'name': str, 'role': 'leader'/'follower'/'both'}
couples = []  # List of {'bib': int, 'leader_id': int, 'follower_id': int, 'leader_name': str, 'follower_name': str}
judges = []  # List of {'id': int, 'name': str, 'judge_number': int}
events = {}  # Dictionary: event_id -> {'id': int, 'name': str, 'heats': [{'round': str, 'bibs': [int], 'judges': [int]}]}
next_person_id = 1
next_bib = 1
next_judge_id = 1
next_event_id = 1

def save_data():
    """Save events and scores to file."""
    data = {
        'events': events,
        'scores': scorer.scores,
        'next_bib': next_bib,
        'next_event_id': next_event_id
    }
    with open(DATA_FILE, 'wb') as f:
        pickle.dump(data, f)

def load_data():
    """Load events and scores from file."""
    global next_bib, next_event_id, events
    if os.path.exists(DATA_FILE):
        try:
            with open(DATA_FILE, 'rb') as f:
                data = pickle.load(f)
                loaded_data = data.get('events') or data.get('heats', {})
                scorer.scores = data.get('scores', {})
                next_bib = data.get('next_bib', 1)
                next_event_id = data.get('next_event_id') or data.get('next_heat_id', 1)
                
                # Migrate old heat format to new event format
                if loaded_data:
                    first_key = next(iter(loaded_data))
                    if isinstance(first_key, str):
                        # Old format: heat_name -> {'bibs': [], 'judges': []}
                        # Migrate to: event_id -> {'id': int, 'name': str, 'heats': [{'round': 'final', 'bibs': [], 'judges': []}]}
                        events = {}
                        event_id = 1
                        # Update scores to use event_id instead of heat_name
                        new_scores = {}
                        for heat_name, heat_data in loaded_data.items():
                            if isinstance(heat_data, list):
                                # Very old format
                                heat_data = {'bibs': heat_data, 'judges': []}
                            events[event_id] = {
                                'id': event_id,
                                'name': heat_name,
                                'heats': [{
                                    'round': 'final',
                                    'bibs': heat_data.get('bibs', []),
                                    'judges': heat_data.get('judges', [])
                                }]
                            }
                            # Migrate scores
                            for bib in heat_data.get('bibs', []):
                                old_key = (heat_name, bib)
                                if old_key in scorer.scores:
                                    new_scores[(event_id, 'final', bib)] = scorer.scores[old_key]
                            event_id += 1
                        scorer.scores = new_scores
                        next_event_id = event_id
                    elif isinstance(loaded_data[first_key].get('heats'), list):
                        # Already in new event format
                        events = loaded_data
                    else:
                        # Old ID-based heat format -> convert to event format
                        events = {}
                        new_scores = {}
                        for heat_id, heat_data in loaded_data.items():
                            events[heat_id] = {
                                'id': heat_id,
                                'name': heat_data.get('name', f'Event {heat_id}'),
                                'heats': [{
                                    'round': 'final',
                                    'bibs': heat_data.get('bibs', []),
                                    'judges': heat_data.get('judges', [])
                                }]
                            }
                            # Migrate scores
                            for bib in heat_data.get('bibs', []):
                                old_key = (heat_id, bib)
                                if old_key in scorer.scores:
                                    new_scores[(heat_id, 'final', bib)] = scorer.scores[old_key]
                        scorer.scores = new_scores
        except:
            events = {}
            scorer.scores = {}
            next_bib = 1
            next_event_id = 1
    else:
        events = {}
        scorer.scores = {}
        next_bib = 1
        next_event_id = 1

def get_event_by_id(event_id):
    """Get event data by ID."""
    return events.get(event_id)

def get_event_bibs(event_id, round_name='final'):
    """Get the list of bib numbers for an event's specific round."""
    event = events.get(event_id, {})
    heats_list = event.get('heats', [])
    for heat in heats_list:
        if heat['round'] == round_name:
            return heat.get('bibs', [])
    return []

def get_event_judges(event_id, round_name='final'):
    """Get the list of judge IDs for an event's specific round."""
    event = events.get(event_id, {})
    heats_list = event.get('heats', [])
    for heat in heats_list:
        if heat['round'] == round_name:
            return heat.get('judges', [])
    return []

def get_event_rounds(event_id):
    """Get list of all rounds for an event."""
    event = events.get(event_id, {})
    heats_list = event.get('heats', [])
    return [heat['round'] for heat in heats_list]

def determine_rounds(num_competitors):
    """Determine which rounds are needed based on number of competitors."""
    if num_competitors <= 6:
        return ['final']
    elif num_competitors <= 14:
        return ['semi-final', 'final']
    else:
        return ['quarter-final', 'semi-final', 'final']

def get_top_couples(event_id, round_name, count=6):
    """Get the top N couples from a round based on their scores.
    For recall rounds (quarter/semi-final): based on number of marks.
    For final: based on total rank (lower is better)."""
    event_bibs = get_event_bibs(event_id, round_name)
    
    # Determine if this is a recall round
    is_recall_round = round_name in ['quarter-final', 'semi-final']
    
    # Calculate results for each couple
    results = []
    for bib in event_bibs:
        scores = scorer.scores.get((event_id, round_name, bib), [])
        if scores:
            if is_recall_round:
                # For recall rounds: sum the marks (higher is better)
                total_marks = sum(scores)
                results.append({'bib': bib, 'value': total_marks, 'is_recall': True})
            else:
                # For final: sum ranks (lower is better)
                total_rank = sum(scores)
                results.append({'bib': bib, 'value': total_rank, 'is_recall': False})
    
    # Sort appropriately
    if is_recall_round:
        # For recall rounds: sort by marks descending (more marks = better)
        results.sort(key=lambda x: x['value'], reverse=True)
    else:
        # For final: sort by rank ascending (lower rank = better)
        results.sort(key=lambda x: x['value'])
    
    return [r['bib'] for r in results[:count]]

def create_event(event_name, bibs, judge_ids):
    """Create a new event with automatically generated heats based on number of competitors."""
    global next_event_id
    event_id = next_event_id
    
    num_competitors = len(bibs)
    rounds = determine_rounds(num_competitors)
    
    heats_list = []
    for round_name in rounds:
        # For now, first round gets all bibs, later rounds will be populated after scoring
        if round_name == rounds[0]:
            heat_bibs = bibs
        else:
            heat_bibs = []  # Will be populated after previous round is scored
        
        heats_list.append({
            'round': round_name,
            'bibs': heat_bibs,
            'judges': judge_ids
        })
    
    events[event_id] = {
        'id': event_id,
        'name': event_name,
        'heats': heats_list
    }
    next_event_id += 1
    return event_id

def save_people():
    """Save people to JSON file."""
    with open(PEOPLE_FILE, 'w') as f:
        json.dump({'people': people, 'next_id': next_person_id}, f, indent=2)

def load_people():
    """Load people from JSON file."""
    global people, next_person_id
    if os.path.exists(PEOPLE_FILE):
        try:
            with open(PEOPLE_FILE, 'r') as f:
                data = json.load(f)
                people = data.get('people', [])
                next_person_id = data.get('next_id', 1)
                
                # Migrate old data to include status field
                for person in people:
                    if 'status' not in person:
                        person['status'] = 'student'  # Default to student
        except:
            people = []
            next_person_id = 1
    else:
        people = []
        next_person_id = 1

def save_couples():
    """Save couples to JSON file."""
    with open(COUPLES_FILE, 'w') as f:
        json.dump(couples, f, indent=2)

def load_couples():
    """Load couples from JSON file."""
    global couples
    if os.path.exists(COUPLES_FILE):
        try:
            with open(COUPLES_FILE, 'r') as f:
                couples = json.load(f)
        except:
            couples = []
    else:
        couples = []

def save_judges():
    """Save judges to JSON file."""
    with open(JUDGES_FILE, 'w') as f:
        json.dump({'judges': judges, 'next_id': next_judge_id}, f, indent=2)

def load_judges():
    """Load judges from JSON file."""
    global judges, next_judge_id
    if os.path.exists(JUDGES_FILE):
        try:
            with open(JUDGES_FILE, 'r') as f:
                data = json.load(f)
                judges = data.get('judges', [])
                next_judge_id = data.get('next_id', 1)
        except:
            judges = []
            next_judge_id = 1
    else:
        judges = []
        next_judge_id = 1

def import_people_from_csv(csv_file='competitors.csv'):
    """Import people from competitors CSV file."""
    global people, next_person_id
    
    if not os.path.exists(csv_file):
        return 0
    
    try:
        df = pd.read_csv(csv_file)
        imported_count = 0
        
        for _, row in df.iterrows():
            name = row.get('Name', '').strip()
            if not name:
                continue
            
            # Check if person already exists
            if any(p['name'].lower() == name.lower() for p in people):
                continue
            
            # Add as 'both' role by default since we don't know from CSV
            person = {
                'id': next_person_id,
                'name': name,
                'role': 'both',  # Default to both roles
                'status': 'student'  # Default to student
            }
            people.append(person)
            next_person_id += 1
            imported_count += 1
        
        if imported_count > 0:
            save_people()
        
        return imported_count
    except Exception as e:
        print(f"Error importing from CSV: {e}")
        return 0

def reset_all_data():
    """Reset all application data to defaults."""
    global people, couples, judges, next_person_id, next_bib, next_judge_id, events, next_event_id
    
    # Clear all data
    people = []
    couples = []
    judges = []
    next_person_id = 1
    next_bib = 1
    next_judge_id = 1
    events = {}
    next_event_id = 1
    scorer.heats = {}
    scorer.scores = {}
    
    # Save empty data
    save_people()
    save_couples()
    save_judges()
    save_data()
    
    # Delete result files
    if os.path.exists('results'):
        import shutil
        shutil.rmtree('results')
    os.makedirs('results', exist_ok=True)

# Initialize on startup
if not os.path.exists('competitors.csv'):
    scorer.import_competitors('competitors.csv')
else:
    scorer.import_competitors('competitors.csv')

# Load saved data
load_data()
load_people()
load_couples()
load_judges()

@app.route('/')
def index():
    """Home page - show all events and competitors."""
    competitors = scorer.competitors.to_dict('records') if not scorer.competitors.empty else []
    events_list = [{'id': eid, 'name': e['name']} for eid, e in events.items()]
    return render_template('index.html', competitors=competitors, heats=events_list, scorer=scorer)

@app.route('/import-csv', methods=['POST'])
def import_csv():
    """Import people from competitors.csv."""
    count = import_people_from_csv()
    if count > 0:
        return jsonify({'status': 'success', 'message': f'Imported {count} new people from competitors.csv'})
    else:
        return jsonify({'status': 'info', 'message': 'No new people to import (all already exist or CSV not found)'})

@app.route('/reset-data', methods=['POST'])
def reset_data():
    """Reset all application data."""
    reset_all_data()
    return jsonify({'status': 'success', 'message': 'All data has been reset'})

@app.route('/people')
def manage_people():
    """Manage people (leaders and followers)."""
    return render_template('manage_people.html', people=people)

@app.route('/people/add', methods=['GET', 'POST'])
def add_person():
    """Add a new person."""
    global next_person_id
    if request.method == 'POST':
        name = request.form.get('name')
        role = request.form.get('role')  # 'leader', 'follower', or 'both'
        status = request.form.get('status', 'student')  # 'student' or 'professional'
        
        if name and role:
            person = {
                'id': next_person_id,
                'name': name,
                'role': role,
                'status': status
            }
            people.append(person)
            next_person_id += 1
            save_people()
            return redirect(url_for('manage_people'))
    
    return render_template('add_person.html')

@app.route('/people/<int:person_id>/delete', methods=['POST'])
def delete_person(person_id):
    """Delete a person."""
    global people
    # Check if person is in any couple
    in_couple = any(c['leader_id'] == person_id or c['follower_id'] == person_id for c in couples)
    if in_couple:
        return jsonify({'status': 'error', 'message': 'Cannot delete person who is in a couple'}), 400
    
    people = [p for p in people if p['id'] != person_id]
    save_people()
    return redirect(url_for('manage_people'))

@app.route('/people/<int:person_id>/update-role', methods=['POST'])
def update_person_role(person_id):
    """Update a person's role."""
    data = request.get_json()
    new_role = data.get('role')
    
    if new_role not in ['leader', 'follower', 'both']:
        return jsonify({'status': 'error', 'message': 'Invalid role'}), 400
    
    # Find and update the person
    person = next((p for p in people if p['id'] == person_id), None)
    if not person:
        return jsonify({'status': 'error', 'message': 'Person not found'}), 404
    
    person['role'] = new_role
    save_people()
    
    return jsonify({'status': 'success', 'message': 'Role updated'})

@app.route('/people/<int:person_id>/update-status', methods=['POST'])
def update_person_status(person_id):
    """Update a person's status (student/professional)."""
    data = request.get_json()
    new_status = data.get('status')
    
    if new_status not in ['student', 'professional']:
        return jsonify({'status': 'error', 'message': 'Invalid status'}), 400
    
    # Find and update the person
    person = next((p for p in people if p['id'] == person_id), None)
    if not person:
        return jsonify({'status': 'error', 'message': 'Person not found'}), 404
    
    person['status'] = new_status
    save_people()
    
    return jsonify({'status': 'success', 'message': 'Status updated'})

@app.route('/couples')
def manage_couples():
    """Manage couples."""
    return render_template('manage_couples.html', couples=couples)

@app.route('/couples/add', methods=['GET', 'POST'])
def add_couple():
    """Add a new couple."""
    global next_bib
    if request.method == 'POST':
        leader_id = int(request.form.get('leader_id'))
        follower_id = int(request.form.get('follower_id'))
        
        # Find leader and follower names
        leader = next((p for p in people if p['id'] == leader_id), None)
        follower = next((p for p in people if p['id'] == follower_id), None)
        
        if leader and follower:
            couple = {
                'bib': next_bib,
                'leader_id': leader_id,
                'follower_id': follower_id,
                'leader_name': leader['name'],
                'follower_name': follower['name']
            }
            couples.append(couple)
            next_bib += 1
            save_couples()
            save_data()  # Save next_bib
            return redirect(url_for('manage_couples'))
    
    # Get leaders and followers
    leaders = [p for p in people if p['role'] in ['leader', 'both']]
    followers = [p for p in people if p['role'] in ['follower', 'both']]
    
    return render_template('add_couple.html', leaders=leaders, followers=followers)

@app.route('/couples/<int:bib>/delete', methods=['POST'])
def delete_couple(bib):
    """Delete a couple."""
    global couples
    # Check if couple is in any event
    in_event = any(bib in get_event_bibs(event_id, round_name) 
                   for event_id in events 
                   for round_name in get_event_rounds(event_id))
    if in_event:
        return jsonify({'status': 'error', 'message': 'Cannot delete couple that is in an event'}), 400
    
    couples = [c for c in couples if c['bib'] != bib]
    save_couples()
    return redirect(url_for('manage_couples'))

@app.route('/judges')
def manage_judges():
    """Manage judges."""
    return render_template('manage_judges.html', judges=judges)

@app.route('/judges/add', methods=['GET', 'POST'])
def add_judge():
    """Add a new judge."""
    global next_judge_id
    if request.method == 'POST':
        name = request.form.get('name')
        
        if name:
            # Automatically assign the next available judge number
            existing_numbers = [j['judge_number'] for j in judges]
            if existing_numbers:
                judge_number = max(existing_numbers) + 1
            else:
                judge_number = 1
            
            judge = {
                'id': next_judge_id,
                'name': name,
                'judge_number': judge_number
            }
            judges.append(judge)
            # Sort judges by judge_number
            judges.sort(key=lambda x: x['judge_number'])
            next_judge_id += 1
            save_judges()
            return redirect(url_for('manage_judges'))
    
    return render_template('add_judge.html')

@app.route('/judges/<int:judge_id>/delete', methods=['POST'])
def delete_judge(judge_id):
    """Delete a judge."""
    global judges
    judges = [j for j in judges if j['id'] != judge_id]
    save_judges()
    return redirect(url_for('manage_judges'))

@app.route('/competitors')
def competitors():
    """View all competitors - now redirects to couples."""
    return redirect(url_for('manage_couples'))

@app.route('/event/new', methods=['GET', 'POST'])
def new_event():
    """Create a new event."""
    if request.method == 'POST':
        # Get all form fields
        designation = request.form.get('designation')
        syllabus_type = request.form.get('syllabus_type')
        level = request.form.get('level')
        style = request.form.get('style')
        selected_dances = request.form.getlist('dances')
        event_name = request.form.get('heat_name')  # Keep field name for template compatibility
        
        selected_bibs = request.form.getlist('bibs')
        selected_bibs = [int(b) for b in selected_bibs if b.isdigit()]
        selected_judges = request.form.getlist('judges')
        selected_judges = [int(j) for j in selected_judges if j.isdigit()]
        
        print(f"DEBUG: event_name={event_name}, selected_bibs={selected_bibs}, selected_judges={selected_judges}")  # Debug
        print(f"DEBUG: designation={designation}, syllabus_type={syllabus_type}, level={level}, style={style}, dances={selected_dances}")  # Debug
        
        if event_name and selected_bibs:
            event_id = create_event(event_name, selected_bibs, selected_judges)
            save_data()  # Save after creating event
            print(f"DEBUG: Event created! event_id={event_id}, events={events}")  # Debug
            return redirect(url_for('view_event', event_id=event_id))
        else:
            print(f"DEBUG: Validation failed - event_name or selected_bibs empty")  # Debug
    
    # Default to all judges if 3 or fewer
    default_judges = [j['id'] for j in judges] if len(judges) <= 3 else []
    
    return render_template('new_heat.html', couples=couples, judges=judges, default_judges=default_judges)

# Backward compatibility route
@app.route('/heat/new', methods=['GET', 'POST'])
def new_heat():
    """Redirect to new_event for backward compatibility."""
    return new_event()

@app.route('/event/<int:event_id>')
@app.route('/event/<int:event_id>/<round_name>')
def view_event(event_id, round_name=None):
    """View details of a specific event."""
    event = get_event_by_id(event_id)
    if not event:
        return redirect(url_for('index'))
    
    # If no round specified, default to the first round
    if round_name is None:
        rounds = get_event_rounds(event_id)
        round_name = rounds[0] if rounds else 'final'
    
    event_bibs = get_event_bibs(event_id, round_name)
    event_judge_ids = get_event_judges(event_id, round_name)
    couples_in_event = [c for c in couples if c['bib'] in event_bibs]
    
    # Get judge details
    judges_in_event = [j for j in judges if j['id'] in event_judge_ids]
    judges_in_event.sort(key=lambda x: x['judge_number'])
    
    # Check if scores exist
    has_scores = any((event_id, round_name, bib) in scorer.scores for bib in event_bibs)
    
    # Get all rounds for navigation
    all_rounds = get_event_rounds(event_id)
    
    return render_template('view_heat.html', 
                         heat=event,
                         heat_id=event_id,
                         heat_name=event['name'],
                         couples=couples_in_event,
                         judges=judges_in_event,
                         has_scores=has_scores,
                         round_name=round_name,
                         all_rounds=all_rounds)

# Backward compatibility route
@app.route('/heat/<int:heat_id>')
def view_heat(heat_id):
    """Redirect to view_event for backward compatibility."""
    return view_event(heat_id)

@app.route('/event/<int:event_id>/<round_name>/score', methods=['GET', 'POST'])
def score_event(event_id, round_name='final'):
    """Input scores for an event's specific round."""
    event = get_event_by_id(event_id)
    if not event:
        return redirect(url_for('index'))
    
    event_bibs = get_event_bibs(event_id, round_name)
    num_competitors = len(event_bibs)
    
    # Determine if this is a recall round (quarter/semi) or final
    is_recall_round = round_name in ['quarter-final', 'semi-final']
    
    if request.method == 'POST':
        num_judges = int(request.form.get('num_judges', 3))
        
        # Clear existing scores for this event/round
        for bib in event_bibs:
            if (event_id, round_name, bib) in scorer.scores:
                scorer.scores[(event_id, round_name, bib)] = []
        
        # Collect scores from form
        if is_recall_round:
            # For recall rounds: collect marks (1 = marked, 0 = not marked)
            for judge in range(1, num_judges + 1):
                for bib in event_bibs:
                    mark_key = f'judge_{judge}_bib_{bib}'
                    mark = request.form.get(mark_key)
                    
                    # Mark is either '1' (checked) or None (unchecked)
                    mark_value = 1 if mark == '1' else 0
                    
                    if (event_id, round_name, bib) not in scorer.scores:
                        scorer.scores[(event_id, round_name, bib)] = []
                    scorer.scores[(event_id, round_name, bib)].append(mark_value)
        else:
            # For final round: collect rankings
            for judge in range(1, num_judges + 1):
                for bib in event_bibs:
                    rank_key = f'judge_{judge}_bib_{bib}'
                    rank = request.form.get(rank_key)
                    
                    if rank and rank.isdigit():
                        rank_value = int(rank)
                        if 1 <= rank_value <= num_competitors:
                            if (event_id, round_name, bib) not in scorer.scores:
                                scorer.scores[(event_id, round_name, bib)] = []
                            scorer.scores[(event_id, round_name, bib)].append(rank_value)
        
        # Check if we need to advance couples to next round
        rounds = get_event_rounds(event_id)
        current_round_idx = rounds.index(round_name)
        if current_round_idx < len(rounds) - 1:
            # Not the final round, need to advance top 6 to next round
            next_round = rounds[current_round_idx + 1]
            top_bibs = get_top_couples(event_id, round_name, 6)
            
            # Update next round's bibs
            event_data = events[event_id]
            for heat in event_data['heats']:
                if heat['round'] == next_round:
                    heat['bibs'] = top_bibs
                    break
        
        save_data()  # Save after entering scores
        return redirect(url_for('results_event', event_id=event_id, round_name=round_name))
    
    couples_in_event = [c for c in couples if c['bib'] in event_bibs]
    
    # Get the judges for this round
    event_judge_ids = get_event_judges(event_id, round_name)
    judges_in_event = [j for j in judges if j['id'] in event_judge_ids]
    
    return render_template('score_heat.html', 
                         heat=event,
                         heat_id=event_id,
                         heat_name=event['name'],
                         couples=couples_in_event,
                         num_competitors=num_competitors,
                         round_name=round_name,
                         is_recall_round=is_recall_round,
                         judges=judges_in_event)

# Backward compatibility route
@app.route('/heat/<int:heat_id>/score', methods=['GET', 'POST'])
def score_heat(heat_id):
    """Redirect to score_event for backward compatibility."""
    return score_event(heat_id, 'final')

@app.route('/event/<int:event_id>/<round_name>/results')
def results_event(event_id, round_name='final'):
    """View results for an event's specific round."""
    event = get_event_by_id(event_id)
    if not event:
        return redirect(url_for('index'))
    
    event_bibs = get_event_bibs(event_id, round_name)
    
    # Check if we have scores
    if not any((event_id, round_name, bib) in scorer.scores for bib in event_bibs):
        return redirect(url_for('view_event', event_id=event_id, round_name=round_name))
    
    # Determine if this is a recall round
    is_recall_round = round_name in ['quarter-final', 'semi-final']
    
    # Calculate results using our couples data
    results_list = []
    for bib in event_bibs:
        # Get couple info
        couple = next((c for c in couples if c['bib'] == bib), None)
        if not couple:
            continue
        
        # Get scores for this couple
        scores = scorer.scores.get((event_id, round_name, bib), [])
        if not scores:
            continue
        
        if is_recall_round:
            # For recall rounds: sum of marks (1s and 0s)
            total_marks = sum(scores)
            results_list.append({
                'Bib': bib,
                'leader_name': couple['leader_name'],
                'follower_name': couple['follower_name'],
                'Total Marks': total_marks,
                'scores': scores,
                'is_recall': True
            })
        else:
            # For final: sum of rankings
            total_rank = sum(scores)
            results_list.append({
                'Bib': bib,
                'leader_name': couple['leader_name'],
                'follower_name': couple['follower_name'],
                'Total Rank': total_rank,
                'scores': scores,
                'is_recall': False
            })
    
    # Sort appropriately
    if is_recall_round:
        # Sort by total marks (higher is better)
        results_list.sort(key=lambda x: x['Total Marks'], reverse=True)
    else:
        # Sort by total rank (lower is better)
        results_list.sort(key=lambda x: x['Total Rank'])
    
    # Get all rounds for navigation
    all_rounds = get_event_rounds(event_id)
    
    # Determine if there's a next round
    next_round = None
    next_round_bibs = []
    current_round_idx = all_rounds.index(round_name) if round_name in all_rounds else -1
    if current_round_idx < len(all_rounds) - 1:
        next_round = all_rounds[current_round_idx + 1]
        next_round_bibs = get_event_bibs(event_id, next_round)
    
    return render_template('results.html', 
                         heat=event,
                         heat_id=event_id,
                         heat_name=event['name'],
                         results=results_list,
                         round_name=round_name,
                         all_rounds=all_rounds,
                         is_recall_round=is_recall_round,
                         next_round=next_round,
                         next_round_ready=len(next_round_bibs) > 0 if next_round else False)

# Backward compatibility route
@app.route('/heat/<int:heat_id>/results')
def results(heat_id):
    """Redirect to results_event for backward compatibility."""
    return results_event(heat_id, 'final')

@app.route('/event/<int:event_id>/<round_name>/export')
def export_results_event(event_id, round_name='final'):
    """Export results to CSV and PDF."""
    event = get_event_by_id(event_id)
    if not event:
        return redirect(url_for('index'))
    
    event_bibs = get_event_bibs(event_id, round_name)
    event_name = f"{event['name']} - {round_name.title()}"
    
    # Check if we have scores
    if not any((event_id, round_name, bib) in scorer.scores for bib in event_bibs):
        return jsonify({'status': 'error', 'message': 'No results to export'})
    
    # Calculate results using our couples data
    results_list = []
    for bib in event_bibs:
        couple = next((c for c in couples if c['bib'] == bib), None)
        if not couple:
            continue
        
        scores = scorer.scores.get((event_id, round_name, bib), [])
        if not scores:
            continue
        
        total_rank = sum(scores)
        
        results_list.append({
            'Bib': bib,
            'Leader': couple['leader_name'],
            'Follower': couple['follower_name'],
            'Total Rank': total_rank
        })
    
    # Sort by total rank
    results_list.sort(key=lambda x: x['Total Rank'])
    
    # Create results dataframe
    results_df = pd.DataFrame(results_list)
    
    # Export using the scorer's export method
    scorer.export_results(event_name, results_df)
    return jsonify({'status': 'success', 'message': f'Results exported for {event_name}'})

# Backward compatibility
@app.route('/heat/<int:heat_id>/export')
def export_results(heat_id):
    return export_results_event(heat_id, 'final')

@app.route('/event/<int:event_id>/<round_name>/download/csv')
def download_csv_event(event_id, round_name='final'):
    """Download CSV results."""
    event = get_event_by_id(event_id)
    if not event:
        return redirect(url_for('index'))
    event_name = f"{event['name']} - {round_name.title()}"
    csv_file = os.path.join('results', f'{event_name}_results.csv')
    if os.path.exists(csv_file):
        return send_file(csv_file, as_attachment=True)
    return redirect(url_for('results_event', event_id=event_id, round_name=round_name))

# Backward compatibility
@app.route('/heat/<int:heat_id>/download/csv')
def download_csv(heat_id):
    return download_csv_event(heat_id, 'final')

@app.route('/event/<int:event_id>/<round_name>/download/pdf')
def download_pdf_event(event_id, round_name='final'):
    """Download PDF results."""
    event = get_event_by_id(event_id)
    if not event:
        return redirect(url_for('index'))
    event_name = f"{event['name']} - {round_name.title()}"
    pdf_file = os.path.join('results', f'{event_name}_results.pdf')
    if os.path.exists(pdf_file):
        return send_file(pdf_file, as_attachment=True)
    return redirect(url_for('results_event', event_id=event_id, round_name=round_name))

# Backward compatibility
@app.route('/heat/<int:heat_id>/download/pdf')
def download_pdf(heat_id):
    return download_pdf_event(heat_id, 'final')

@app.route('/manage-events')
def manage_events():
    """Manage all events - view, edit, delete."""
    events_data = []
    for event_id, event in events.items():
        # Get all rounds for this event
        rounds_info = []
        for heat in event.get('heats', []):
            round_name = heat['round']
            bibs = heat.get('bibs', [])
            has_scores = any((event_id, round_name, bib) in scorer.scores for bib in bibs)
            rounds_info.append({
                'name': round_name,
                'num_competitors': len(bibs),
                'has_scores': has_scores
            })
        
        # Get total unique couples across all rounds
        all_bibs = set()
        for heat in event.get('heats', []):
            all_bibs.update(heat.get('bibs', []))
        couples_in_event = [c for c in couples if c['bib'] in all_bibs]
        
        events_data.append({
            'id': event_id,
            'name': event['name'],
            'couples': couples_in_event,
            'rounds': rounds_info,
            'num_rounds': len(rounds_info)
        })
    return render_template('manage_heats.html', heats=events_data, events=events_data)

# Backward compatibility
@app.route('/manage-heats')
def manage_heats():
    return manage_events()

@app.route('/event/<int:event_id>/delete', methods=['POST'])
def delete_event(event_id):
    """Delete an event and its scores."""
    if event_id in events:
        # Delete scores associated with this event (all rounds)
        event = events[event_id]
        for heat in event.get('heats', []):
            round_name = heat['round']
            bibs = heat.get('bibs', [])
            for bib in bibs:
                if (event_id, round_name, bib) in scorer.scores:
                    del scorer.scores[(event_id, round_name, bib)]
        
        # Delete the event
        del events[event_id]
        save_data()
    
    return redirect(url_for('manage_events'))

# Backward compatibility
@app.route('/heat/<int:heat_id>/delete', methods=['POST'])
def delete_heat(heat_id):
    return delete_event(heat_id)

@app.route('/event/<int:event_id>/edit', methods=['GET', 'POST'])
def edit_event(event_id):
    """Edit an event - change name or competitors."""
    event = get_event_by_id(event_id)
    if not event:
        return redirect(url_for('manage_events'))
    
    if request.method == 'POST':
        new_event_name = request.form.get('heat_name')  # Keep field name for template compatibility
        selected_bibs = request.form.getlist('bibs')
        selected_bibs = [int(b) for b in selected_bibs if b.isdigit()]
        selected_judges = request.form.getlist('judges')
        selected_judges = [int(j) for j in selected_judges if j.isdigit()]
        
        if new_event_name and selected_bibs:
            # Update event name
            event['name'] = new_event_name
            
            # Regenerate heats based on new number of competitors
            rounds = determine_rounds(len(selected_bibs))
            heats_list = []
            for round_name in rounds:
                if round_name == rounds[0]:
                    heat_bibs = selected_bibs
                else:
                    heat_bibs = []
                
                heats_list.append({
                    'round': round_name,
                    'bibs': heat_bibs,
                    'judges': selected_judges
                })
            
            event['heats'] = heats_list
            
            save_data()
            return redirect(url_for('manage_events'))
    
    # Get bibs from first round for editing
    current_bibs = get_event_bibs(event_id, get_event_rounds(event_id)[0] if get_event_rounds(event_id) else 'final')
    current_judge_ids = get_event_judges(event_id, get_event_rounds(event_id)[0] if get_event_rounds(event_id) else 'final')
    
    return render_template('edit_heat.html', 
                         heat=event,
                         heat_id=event_id,
                         heat_name=event['name'],
                         current_bibs=current_bibs,
                         current_judge_ids=current_judge_ids,
                         couples=couples,
                         judges=judges)

# Backward compatibility
@app.route('/heat/<int:heat_id>/edit', methods=['GET', 'POST'])
def edit_heat(heat_id):
    return edit_event(heat_id)

@app.route('/event/<int:event_id>/round/<round_name>/reset', methods=['POST'])
def reset_round_scores(event_id, round_name):
    """Reset scores for a specific round in an event."""
    event = get_event_by_id(event_id)
    if not event:
        return redirect(url_for('manage_events'))
    
    # Find the round
    round_data = None
    for heat in event.get('heats', []):
        if heat['round'] == round_name:
            round_data = heat
            break
    
    if not round_data:
        return redirect(url_for('manage_events'))
    
    # Delete scores for this specific round
    bibs = round_data.get('bibs', [])
    deleted_count = 0
    for bib in bibs:
        score_key = (event_id, round_name, bib)
        if score_key in scorer.scores:
            del scorer.scores[score_key]
            deleted_count += 1
    
    save_data()
    return redirect(url_for('view_event', event_id=event_id, round_name=round_name))

# Backward compatibility
@app.route('/heat/<int:heat_id>/round/<round_name>/reset', methods=['POST'])
def reset_heat_round_scores(heat_id, round_name):
    return reset_round_scores(heat_id, round_name)

@app.route('/event/<int:event_id>/reset', methods=['POST'])
def reset_event_scores(event_id):
    """Reset all scores for all rounds in an event."""
    event = get_event_by_id(event_id)
    if not event:
        return redirect(url_for('manage_events'))
    
    # Delete scores for all rounds in this event
    deleted_count = 0
    for heat in event.get('heats', []):
        round_name = heat['round']
        bibs = heat.get('bibs', [])
        for bib in bibs:
            score_key = (event_id, round_name, bib)
            if score_key in scorer.scores:
                del scorer.scores[score_key]
                deleted_count += 1
    
    save_data()
    return redirect(url_for('view_event', event_id=event_id))

# Backward compatibility
@app.route('/heat/<int:heat_id>/reset', methods=['POST'])
def reset_heat_scores(heat_id):
    return reset_event_scores(heat_id)

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
