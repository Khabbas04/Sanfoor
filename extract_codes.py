import pandas as pd
import json

df = pd.read_excel('public/جدول_المواد_الصيفي_2026.xlsx')

open_courses = set()
closed_courses_all_sections = set() # Optional for logging

# Iterate through the rows
for index, row in df.iterrows():
    code = str(row.iloc[0]).strip()
    section = str(row.iloc[2]).strip()
    
    # Check if it's a valid course code
    if any(char.isdigit() for char in code):
        if "مغلقة" not in section:
            open_courses.add(code)

with open('storage/app/summer_2026_courses.json', 'w', encoding='utf-8') as f:
    json.dump(list(open_courses), f, ensure_ascii=False, indent=2)
