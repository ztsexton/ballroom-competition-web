from flask import Flask, render_template, request, redirect, url_for, jsonify, send_file
import pandas as pd
from simple_ballroom_scorer import SimpleBallroomScorer
import os
import json
import pickle

app = Flask(__name__)
scorer = SimpleBallroomScorer()

DATA_FILE = 'scorer_data.pkl'

def save_data():
    """Save heats and scores to file."""
    data = {
        'heats': scorer.heats,
        'scores': scorer.scores
    }
    with open(DATA_FILE, 'wb') as f:
        pickle.dump(data, f)

def load_data():
    """Load heats and scores from file."""
    if os.path.exists(DATA_FILE):
        try:
            with open(DATA_FILE, 'rb') as f:
                data = pickle.load(f)
                scorer.heats = data.get('heats', {})
                scorer.scores = data.get('scores', {})
        except:
            scorer.heats = {}
            scorer.scores = {}

# Initialize on startup
if not os.path.exists('competitors.csv'):
    scorer.import_competitors('competitors.csv')
else:
    scorer.import_competitors('competitors.csv')

# Load saved data
load_data()

@app.route('/')
def index():
    """Home page - show all heats and competitors."""
    competitors = scorer.competitors.to_dict('records') if not scorer.competitors.empty else []
    heats = list(scorer.heats.keys())
    return render_template('index.html', competitors=competitors, heats=heats, scorer=scorer)

@app.route('/competitors')
def competitors():
    """View all competitors."""
    competitors_list = scorer.competitors.to_dict('records') if not scorer.competitors.empty else []
    return render_template('competitors.html', competitors=competitors_list)

@app.route('/heat/new', methods=['GET', 'POST'])
def new_heat():
    """Create a new heat."""
    if request.method == 'POST':
        heat_name = request.form.get('heat_name')
        selected_bibs = request.form.getlist('bibs')
        selected_bibs = [int(b) for b in selected_bibs if b.isdigit()]
        
        print(f"DEBUG: heat_name={heat_name}, selected_bibs={selected_bibs}")  # Debug
        
        if heat_name and selected_bibs:
            scorer.heats[heat_name] = selected_bibs
            save_data()  # Save after creating heat
            print(f"DEBUG: Heat created! scorer.heats={scorer.heats}")  # Debug
            return redirect(url_for('view_heat', heat_name=heat_name))
        else:
            print(f"DEBUG: Validation failed - heat_name or selected_bibs empty")  # Debug
    
    competitors_list = scorer.competitors.to_dict('records') if not scorer.competitors.empty else []
    return render_template('new_heat.html', competitors=competitors_list)

@app.route('/heat/<heat_name>')
def view_heat(heat_name):
    """View details of a specific heat."""
    if heat_name not in scorer.heats:
        return redirect(url_for('index'))
    
    heat_bibs = scorer.heats[heat_name]
    competitors_in_heat = scorer.competitors[scorer.competitors['Bib'].isin(heat_bibs)].to_dict('records')
    
    # Check if scores exist
    has_scores = any((heat_name, bib) in scorer.scores for bib in heat_bibs)
    
    return render_template('view_heat.html', 
                         heat_name=heat_name, 
                         competitors=competitors_in_heat,
                         has_scores=has_scores)

@app.route('/heat/<heat_name>/score', methods=['GET', 'POST'])
def score_heat(heat_name):
    """Input scores for a heat."""
    if heat_name not in scorer.heats:
        return redirect(url_for('index'))
    
    heat_bibs = scorer.heats[heat_name]
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
    
    competitors_in_heat = scorer.competitors[scorer.competitors['Bib'].isin(heat_bibs)].to_dict('records')
    return render_template('score_heat.html', 
                         heat_name=heat_name, 
                         competitors=competitors_in_heat,
                         num_competitors=num_competitors)

@app.route('/heat/<heat_name>/results')
def results(heat_name):
    """View results for a heat."""
    if heat_name not in scorer.heats:
        return redirect(url_for('index'))
    
    results_df = scorer.tally_results(heat_name)
    
    if results_df is None or results_df.empty:
        return redirect(url_for('view_heat', heat_name=heat_name))
    
    results_list = results_df.to_dict('records')
    
    # Add detailed scores
    for result in results_list:
        bib = result['Bib']
        if (heat_name, bib) in scorer.scores:
            result['scores'] = scorer.scores[(heat_name, bib)]
        else:
            result['scores'] = []
    
    return render_template('results.html', 
                         heat_name=heat_name, 
                         results=results_list)

@app.route('/heat/<heat_name>/export')
def export_results(heat_name):
    """Export results to CSV and PDF."""
    if heat_name not in scorer.heats:
        return redirect(url_for('index'))
    
    results_df = scorer.tally_results(heat_name)
    
    if results_df is not None:
        scorer.export_results(heat_name, results_df)
        return jsonify({'status': 'success', 'message': f'Results exported for {heat_name}'})
    
    return jsonify({'status': 'error', 'message': 'No results to export'})

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

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
