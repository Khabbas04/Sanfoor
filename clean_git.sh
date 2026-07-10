#!/bin/bash
cd /var/www/sanfoor
git reset --soft HEAD~1
git rm --cached -f "= ["
git rm --cached -f "Chapter::firstOrCreate(['course_id' => \$course->id, 'title' => 'CHAPTER 1 INTRODUCTION'], ['order' => 1, 'is_active' => true]);"
git rm --cached -f "as \$q) { AppModelsQuestion::create(\$q); }"
git rm --cached -f "s in Java is specifically designed to handle sequences of characters (text).',"
rm -f "= [" "Chapter::firstOrCreate"* "as \$q"* "s in Java"*
git commit -m "Add demo videos and fix project path"
git push -f origin main
