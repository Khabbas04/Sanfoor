import sys

file_path = 'resources/js/Pages/Tree/Index.jsx'
with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Remove Compare Modal (lines 2874 to 3039)
del lines[2873:3039]

# Replace Legend Dropdown (lines 2486 to 2544)
legend_replacement = """                    {/* Legend Button */}
                    <div className=\"shrink-0 relative w-full md:w-auto md:mr-3\" dir=\"rtl\">
                        <button onClick={() => setLegendOpen(true)} className={`w-full md:w-auto justify-center flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-[12px] font-[800] transition-all shadow-sm border bg-white text-slate-600 border-slate-200 hover:bg-slate-50`}>
                            🌳 دليل الشجرة
                        </button>
                    </div>
                </div>
            )}\n"""
lines[2485:2544] = [legend_replacement]

with open(file_path, 'w', encoding='utf-8') as f:
    f.writelines(lines)
