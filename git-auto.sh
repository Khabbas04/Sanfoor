#!/bin/bash
while true; do
  # إضافة كل التعديلات
  git add .
  # الالتزام برسالة وقت التعديل
  git commit -m "Auto-update: $(date)"
  # الرفع
  git push origin main
  # الانتظار لمدة دقيقة قبل الفحص مرة أخرى
  sleep 60
done