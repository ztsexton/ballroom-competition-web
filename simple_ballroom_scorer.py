import pandas as pd
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
import os

class SimpleBallroomScorer:
    def __init__(self):
        self.competitors = pd.DataFrame()
        self.heats = {}  # Dict: heat_name -> list of Bibs
        self.scores = {}  # Dict: (heat_name, bib) -> list of judge scores

    def import_competitors(self, csv_file):
        """Import competitors from CSV."""
        if os.path.exists(csv_file):
            self.competitors = pd.read_csv(csv_file)
            print(f"Imported {len(self.competitors)} competitors.")
        else:
            print("CSV file not found. Creating sample...")
            # Create sample if missing
            sample_data = {
                'Bib': [1, 2, 3, 4, 5],
                'Name': ['John Doe', 'Jane Smith', 'Bob Johnson', 'Alice Brown', 'Charlie Wilson'],
                'Level': ['Newcomer', 'Novice', 'Newcomer', 'Novice', 'Newcomer'],
                'Style': ['Waltz', 'Waltz', 'Waltz', 'Waltz', 'Waltz']
            }
            self.competitors = pd.DataFrame(sample_data)
            self.competitors.to_csv(csv_file, index=False)

    def define_heat(self, heat_name):
        """Define a heat: select competitors by Bib."""
        print(f"\nDefining heat: {heat_name}")
        print("Available Bibs:", self.competitors['Bib'].tolist())
        bibs = input("Enter Bibs (comma-separated): ").split(',')
        bibs = [int(b.strip()) for b in bibs if b.strip().isdigit()]
        valid_bibs = [b for b in bibs if b in self.competitors['Bib'].values]
        self.heats[heat_name] = valid_bibs
        print(f"Heat {heat_name} has {len(valid_bibs)} competitors.")

    def input_scores(self, heat_name, num_judges=3):
        """Input scores for a heat (ranking: lower number = better)."""
        if heat_name not in self.heats:
            print("Heat not found!")
            return
        print(f"\nScoring heat: {heat_name}")
        heat_bibs = self.heats[heat_name]
        for judge in range(1, num_judges + 1):
            print(f"\n--- Judge {judge} ---")
            judge_scores = {}
            for bib in heat_bibs:
                rank = input(f"Rank for Bib {bib} (1-{len(heat_bibs)}, lower=better): ")
                if rank.isdigit() and 1 <= int(rank) <= len(heat_bibs):
                    judge_scores[bib] = int(rank)
                else:
                    judge_scores[bib] = len(heat_bibs)  # Default to last
            for bib in heat_bibs:
                if (heat_name, bib) not in self.scores:
                    self.scores[(heat_name, bib)] = []
                self.scores[(heat_name, bib)].append(judge_scores[bib])

    def tally_results(self, heat_name):
        """Tally using skating system: sum ranks, lower total = better."""
        if heat_name not in self.heats:
            print("Heat not found!")
            return
        heat_bibs = self.heats[heat_name]
        results = []
        for bib in heat_bibs:
            total_rank = sum(self.scores.get((heat_name, bib), [len(heat_bibs)] * 3))  # Default if missing
            name = self.competitors[self.competitors['Bib'] == bib]['Name'].iloc[0]
            results.append({'Bib': bib, 'Name': name, 'Total Rank': total_rank})
        results_df = pd.DataFrame(results).sort_values('Total Rank')
        print(f"\nResults for {heat_name}:")
        print(results_df)
        return results_df

    def export_results(self, heat_name, results_df, output_dir='results'):
        """Export to CSV and PDF."""
        os.makedirs(output_dir, exist_ok=True)
        csv_file = os.path.join(output_dir, f'{heat_name}_results.csv')
        pdf_file = os.path.join(output_dir, f'{heat_name}_results.pdf')
        results_df.to_csv(csv_file, index=False)
        
        # PDF generation
        c = canvas.Canvas(pdf_file, pagesize=letter)
        c.drawString(100, 750, f"Results: {heat_name}")
        y = 700
        for _, row in results_df.iterrows():
            c.drawString(100, y, f"{row['Bib']}: {row['Name']} - Total: {row['Total Rank']}")
            y -= 20
        c.save()
        
        print(f"Exported: {csv_file}, {pdf_file}")

def main():
    scorer = SimpleBallroomScorer()
    scorer.import_competitors('competitors.csv')
    
    while True:
        print("\n--- SimpleBallroomScorer ---")
        print("1. Define Heat")
        print("2. Input Scores (3 judges)")
        print("3. Tally & View Results")
        print("4. Export Results")
        print("5. Exit")
        choice = input("Choose: ")
        
        if choice == '1':
            heat_name = input("Heat name (e.g., Waltz Final): ")
            scorer.define_heat(heat_name)
        elif choice == '2':
            heat_name = input("Heat name: ")
            scorer.input_scores(heat_name)
        elif choice == '3':
            heat_name = input("Heat name: ")
            results = scorer.tally_results(heat_name)
            if results is not None and input("Export? (y/n): ").lower() == 'y':
                scorer.export_results(heat_name, results)
        elif choice == '5':
            break

if __name__ == "__main__":
    main()