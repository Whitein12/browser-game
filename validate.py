import json
import sys

try:
    with open('data/classes.json', 'r', encoding='utf-8') as f:
        data = json.load(f)
    with open('val_result.txt', 'w', encoding='utf-8') as f:
        f.write('Valid JSON. Keys: ' + ', '.join(data.keys()))
except Exception as e:
    with open('val_result.txt', 'w', encoding='utf-8') as f:
        f.write('Error: ' + str(e))
