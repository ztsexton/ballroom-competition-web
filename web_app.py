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
next_person_id = 1
next_bib = 1
next_judge_id = 1

def save_data():
    """Save heats and scores to file."""
    data = {
        'heats': scorer.heats,
        'scores': scorer.scores,
        'next_bib': next_bib
    }
    with open(DATA_FILE, 'wb') as f:
        pickle.dump(data, f)

def load_data():
    """Load heats and scores from file."""
    global next_bib
    if os.path.exists(DATA_FILE):
        try:
            with open(DATA_FILE, 'rb') as f:
                data = pickle.load(f)
                scorer.heats = data.get('heats', {})
                scorer.scores = data.get('scores', {})
                next_bib = data.get('next_bib', 1)
                
                # Migrate old heat format to new format
                for heat_name, heat_data in scorer.heats.items():
                    if isinstance(heat_data, list):
                        # Old format: just a list of bibs
                        scorer.heats[heat_name] = {
                            'bibs': heat_data,
                            'judges': []
                        }
        except:
            scorer.heats = {}
            scorer.scores = {}
            next_bib = 1

def get_heat_bibs(heat_name):
    """Get the list of bib numbers for a heat."""
    heat_data = scorer.heats.get(heat_name, {})
    if isinstance(heat_data, dict):
        return heat_data.get('bibs', [])
    return heat_data if isinstance(heat_data, list) else []

def get_heat_judges(heat_name):
    """Get the list of judge IDs for a heat."""
    heat_data = scorer.heats.get(heat_name, {})
    if isinstance(heat_data, dict):
        return heat_data.get('judges', [])
    return []

def set_heat_data(heat_name, bibs, judge_ids):
    """Set heat data with bibs and judges."""
    scorer.heats[heat_name] = {
        'bibs': bibs,
        'judges': judge_ids
    }

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
    global people, couples, judges, next_person_id, next_bib, next_judge_id
    
    # Clear all data
    people = []
    couples = []
    judges = []
    next_person_id = 1
    next_bib = 1
    next_judge_id = 1
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
    """Home page - show all heats and competitors."""
    competitors = scorer.competitors.to_dict('records') if not scorer.competitors.empty else []
    heats = list(scorer.heats.keys())
    return render_template('index.html', competitors=competitors, heats=heats, scorer=scorer)

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
    # Check if couple is in any heat
    in_heat = any(bib in get_heat_bibs(heat_name) for heat_name in scorer.heats)
    if in_heat:
        return jsonify({'status': 'error', 'message': 'Cannot delete couple that is in a heat'}), 400
    
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

@app.route('/heat/new', methods=['GET', 'POST'])
def new_heat():
    """Create a new heat."""
    if request.method == 'POST':
        heat_name = request.form.get('heat_name')
        selected_bibs = request.form.getlist('bibs')
        selected_bibs = [int(b) for b in selected_bibs if b.isdigit()]
        selected_judges = request.form.getlist('judges')
        selected_judges = [int(j) for j in selected_judges if j.isdigit()]
        
        print(f"DEBUG: heat_name={heat_name}, selected_bibs={selected_bibs}, selected_judges={selected_judges}")  # Debug
        
        if heat_name and selected_bibs:
            set_heat_data(heat_name, selected_bibs, selected_judges)
            save_data()  # Save after creating heat
            print(f"DEBUG: Heat created! scorer.heats={scorer.heats}")  # Debug
            return redirect(url_for('view_heat', heat_name=heat_name))
        else:
            print(f"DEBUG: Validation failed - heat_name or selected_bibs empty")  # Debug
    
    # Default to all judges if 3 or fewer
    default_judges = [j['id'] for j in judges] if len(judges) <= 3 else []
    
    return render_template('new_heat.html', couples=couples, judges=judges, default_judges=default_judges)

@app.route('/heat/<heat_name>')
def view_heat(heat_name):
    """View details of a specific heat."""
    if heat_name not in scorer.heats:
        return redirect(url_for('index'))
    
    heat_bibs = get_heat_bibs(heat_name)
    heat_judge_ids = get_heat_judges(heat_name)
    couples_in_heat = [c for c in couples if c['bib'] in heat_bibs]
    
    # Get judge details
    judges_in_heat = [j for j in judges if j['id'] in heat_judge_ids]
    judges_in_heat.sort(key=lambda x: x['judge_number'])
    
    # Check if scores exist
    has_scores = any((heat_name, bib) in scorer.scores for bib in heat_bibs)
    
    return render_template('view_heat.html', 
                         heat_name=heat_name, 
                         couples=couples_in_heat,
                         judges=judges_in_heat,
                         has_scores=has_scores)

@app.route('/heat/<heat_name>/score', methods=['GET', 'POST'])
def score_heat(heat_name):
    """Input scores for a heat."""
    if heat_name not in scorer.heats:
        return redirect(url_for('index'))
    
    heat_bibs = get_heat_bibs(heat_name)
    num_competitors = len(heat_bibs)
    
    if request.method == 'POST':
        num_judges = int(request.form.get('num_judges', 3))
        
        # Clear existing scores for this heat
        for bib in heat_bibs:
            if (heat_name, bib) in scorer.scores:
                scorer.scores[(heat_name, bib)] = []
        
        # Collect scores from form
        for judge in range(1, num_judges + 1):
            for bib in heat_bibs:
                rank_key = f'judge_{judge}_bib_{bib}'
                rank = request.form.get(rank_key)
                
                if rank and rank.isdigit():
                    rank_value = int(rank)
                    if 1 <= rank_value <= num_competitors:
                        if (heat_name, bib) not in scorer.scores:
                            scorer.scores[(heat_name, bib)] = []
                        scorer.scores[(heat_name, bib)].append(rank_value)
        
        save_data()  # Save after entering scores
        return redirect(url_for('results', heat_name=heat_name))
    
    couples_in_heat = [c for c in couples if c['bib'] in heat_bibs]
    return render_template('score_heat.html', 
                         heat_name=heat_name, 
                         couples=couples_in_heat,
                         num_competitors=num_competitors)

@app.route('/heat/<heat_name>/results')
def results(heat_name):
    """View results for a heat."""
    if heat_name not in scorer.heats:
        return redirect(url_for('index'))
    
    heat_bibs = get_heat_bibs(heat_name)
    
    # Check if we have scores
    if not any((heat_name, bib) in scorer.scores for bib in heat_bibs):
        return redirect(url_for('view_heat', heat_name=heat_name))
    
    # Calculate results using our couples data
    results_list = []
    for bib in heat_bibs:
        # Get couple info
        couple = next((c for c in couples if c['bib'] == bib), None)
        if not couple:
            continue
        
        # Get scores for this couple
        scores = scorer.scores.get((heat_name, bib), [])
        if not scores:
            continue
        
        # Calculate total rank (sum of all judge rankings)
        total_rank = sum(scores)
        
        results_list.append({
            'Bib': bib,
            'leader_name': couple['leader_name'],
            'follower_name': couple['follower_name'],
            'Total Rank': total_rank,
            'scores': scores
        })
    
    # Sort by total rank (lower is better)
    results_list.sort(key=lambda x: x['Total Rank'])
    
    return render_template('results.html', 
                         heat_name=heat_name, 
                         results=results_list)

@app.route('/heat/<heat_name>/export')
def export_results(heat_name):
    """Export results to CSV and PDF."""
    if heat_name not in scorer.heats:
        return redirect(url_for('index'))
    
    heat_bibs = get_heat_bibs(heat_name)
    
    # Check if we have scores
    if not any((heat_name, bib) in scorer.scores for bib in heat_bibs):
        return jsonify({'status': 'error', 'message': 'No results to export'})
    
    # Calculate results using our couples data
    results_list = []
    for bib in heat_bibs:
        couple = next((c for c in couples if c['bib'] == bib), None)
        if not couple:
            continue
        
        scores = scorer.scores.get((heat_name, bib), [])
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
    scorer.export_results(heat_name, results_df)
    return jsonify({'status': 'success', 'message': f'Results exported for {heat_name}'})

@app.route('/heat/<heat_name>/download/csv')
def download_csv(heat_name):
    """Download CSV results."""
    csv_file = os.path.join('results', f'{heat_name}_results.csv')
    if os.path.exists(csv_file):
        return send_file(csv_file, as_attachment=True)
    return redirect(url_for('results', heat_name=heat_name))

@app.route('/heat/<heat_name>/download/pdf')
def download_pdf(heat_name):
    """Download PDF results."""
    pdf_file = os.path.join('results', f'{heat_name}_results.pdf')
    if os.path.exists(pdf_file):
        return send_file(pdf_file, as_attachment=True)
    return redirect(url_for('results', heat_name=heat_name))

@app.route('/manage-heats')
def manage_heats():
    """Manage all heats - view, edit, delete."""
    heats_data = []
    for heat_name in scorer.heats.keys():
        bibs = get_heat_bibs(heat_name)
        couples_in_heat = [c for c in couples if c['bib'] in bibs]
        has_scores = any((heat_name, bib) in scorer.scores for bib in bibs)
        heats_data.append({
            'name': heat_name,
            'couples': couples_in_heat,
            'num_competitors': len(bibs),
            'has_scores': has_scores
        })
    return render_template('manage_heats.html', heats=heats_data)

@app.route('/heat/<heat_name>/delete', methods=['POST'])
def delete_heat(heat_name):
    """Delete a heat and its scores."""
    if heat_name in scorer.heats:
        # Delete scores associated with this heat
        bibs = get_heat_bibs(heat_name)
        for bib in bibs:
            if (heat_name, bib) in scorer.scores:
                del scorer.scores[(heat_name, bib)]
        
        # Delete the heat
        del scorer.heats[heat_name]
        save_data()
    
    return redirect(url_for('manage_heats'))

@app.route('/heat/<heat_name>/edit', methods=['GET', 'POST'])
def edit_heat(heat_name):
    """Edit a heat - change name or competitors."""
    if heat_name not in scorer.heats:
        return redirect(url_for('manage_heats'))
    
    if request.method == 'POST':
        new_heat_name = request.form.get('heat_name')
        selected_bibs = request.form.getlist('bibs')
        selected_bibs = [int(b) for b in selected_bibs if b.isdigit()]
        selected_judges = request.form.getlist('judges')
        selected_judges = [int(j) for j in selected_judges if j.isdigit()]
        
        if new_heat_name and selected_bibs:
            # If name changed, update the heat and scores
            if new_heat_name != heat_name:
                # Move heat
                set_heat_data(new_heat_name, selected_bibs, selected_judges)
                del scorer.heats[heat_name]
                
                # Move scores
                old_bibs = get_heat_bibs(heat_name)
                for bib in old_bibs:
                    if (heat_name, bib) in scorer.scores:
                        scorer.scores[(new_heat_name, bib)] = scorer.scores[(heat_name, bib)]
                        del scorer.scores[(heat_name, bib)]
            else:
                # Just update competitors and judges
                set_heat_data(heat_name, selected_bibs, selected_judges)
            
            save_data()
            return redirect(url_for('manage_heats'))
    
    current_bibs = get_heat_bibs(heat_name)
    current_judge_ids = get_heat_judges(heat_name)
    
    return render_template('edit_heat.html', 
                         heat_name=heat_name, 
                         current_bibs=current_bibs,
                         current_judge_ids=current_judge_ids,
                         couples=couples,
                         judges=judges)

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
