import pandas as pd
import json

df = pd.read_excel('public/جدول_المواد_الصيفي_2026.xlsx')
data = {
    'columns': df.columns.tolist(),
    'head': df.head(50).to_dict('records')
}
with open('excel_out.json', 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)
