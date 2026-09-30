from pathlib import Path

if __name__ == '__main__':
    print(f'Evaluation dataset: {Path(__file__).with_name("dataset.jsonl")}')
