import pandas as pd
import json

df = pd.read_excel('public/جدول_المواد_الصيفي_2026.xlsx')

schedule = {}

for index, row in df.iterrows():
    code = str(row.iloc[0]).strip()
    
    if any(char.isdigit() for char in code):
        section = str(row.iloc[2]).replace('مغلقة', '').strip()
        time_str = str(row.iloc[4]).strip()
        days = str(row.iloc[5]).strip()
        if days == 'nan': days = ''
        hall = str(row.iloc[7]).strip()
        instructor = str(row.iloc[8]).strip()
        if instructor == 'nan': instructor = 'غير محدد'
        
        if code not in schedule:
            schedule[code] = []
            
        schedule[code].append({
            'section': section,
            'time': time_str,
            'days': days,
            'hall': hall,
            'instructor': instructor
        })

with open('storage/app/summer_2026_schedule.json', 'w', encoding='utf-8') as f:
    json.dump(schedule, f, ensure_ascii=False, indent=2)

# Overwrite the courses.json so we still have the simple list if needed (including closed ones)
with open('storage/app/summer_2026_courses.json', 'w', encoding='utf-8') as f:
    json.dump(list(schedule.keys()), f, ensure_ascii=False, indent=2)
