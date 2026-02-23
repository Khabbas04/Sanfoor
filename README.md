# 🎓 منصة سنفور الأكاديمية | Sanfoor Platform v2.1.4

> **النظام الذكي لإدارة الخطط الشجرية وتحليل مسارات الطلاب الأكاديمية.**

مشروع **Sanfoor** هو منصة متكاملة مخصصة لطلاب الجامعات (خاصة جامعة الزرقاء)، تهدف إلى تبسيط العملية الأكاديمية من خلال عرض مرئي تفاعلي للمواد (الشجرة) وتوفير أدوات اتخاذ قرار ذكية للإدارة بناءً على بيانات الطلاب الحقيقية.

---

## 🛠️ المتطلبات التقنية (Tech Stack)

النظام مبني بأحدث التقنيات لضمان السرعة والأمان:

* **Backend:** [Laravel 12](https://laravel.com/) (PHP 8.2+)
* **Frontend:** [React](https://reactjs.org/) مع [Inertia.js](https://inertiajs.com/)
* **Database:** [PostgreSQL](https://www.postgresql.org/) (لإدارة الاستعلامات الحسابية المتقدمة)
* **UI/UX:** [Tailwind CSS](https://tailwindcss.com/) مع أنظمة Glassmorphism

---

## 🚀 طريقة تشغيل المشروع (Installation)

نفذ الأوامر التالية بالترتيب لتشغيل البيئة المحلية:

1. **تحميل الكود:**
```bash
git clone https://github.com/Khabbas04/Sanfoor.git
cd Sanfoor

```


2. **تنصيب المكتبات:**
```bash
composer install
npm install

```


3. **إعداد البيئة:**
* انسخ ملف `.env.example` ليكون `.env`.
* قم بتعديل بيانات قاعدة البيانات لتطابق إعدادات **PostgreSQL** لديك.


4. **تجهيز قاعدة البيانات:**
```bash
php artisan key:generate
php artisan migrate --seed

```


5. **التشغيل:**
* افتح Terminal للـ Backend: `php artisan serve`
* افتح Terminal للـ Frontend: `npm run dev`



---

## 💾 إعدادات قاعدة البيانات (PostgreSQL)

يرجى التأكد من ضبط ملف الـ `.env` كالتالي لتجنب أخطاء الاستعلامات:

```env
DB_CONNECTION=pgsql
DB_HOST=127.0.0.1
DB_PORT=5432
DB_DATABASE=sanfoor_db
DB_USERNAME=postgres
DB_PASSWORD=كلمة_المرور_الخاصة_بك

```

---

## 📂 خريطة النظام (Project Structure)

### 👨‍🎓 بوابة الطالب (Student Portal)

* **الشجرة التفاعلية:** عرض المواد باستخدام `ReactFlow` مع تحديد الحالة (منجز، متاح، مغلق).
* **محاكي التسجيل:** إضافة المواد للمحاكي لمزامنتها مع الإدارة بصمت دون رسائل مزعجة.
* **المستشار الذكي:** نظام نصائح يعتمد على الذكاء الاصطناعي لتحسين المعدل.

### ⚙️ بوابة الإدارة (Admin Core)

* **الداشبورد:** مراقبة لحظية لأعداد الطلاب وحالة النظام.
* **إدارة الطلاب:** تعديل بيانات الطلاب، مراقبة معدلاتهم، والتحكم في الحسابات.
* **تحليل الطلب (Demand Heatmap):** تقرير ذكي يفرز المواد الأكثر طلباً حسب الكلية والتخصص.
* **إدارة الخطط:** استيراد المواد عبر CSV وبناء المتطلبات السابقة تلقائياً.

---

## 🔐 بيانات الدخول للتجربة (Test Credentials)
يمكنك استخدام الحساب التالي لتجربة لوحة تحكم الإدارة (Admin Panel):
* **البريد الإلكتروني:** `admin@sanfoor.com`
* **كلمة المرور:** `password` (أو كلمة المرور التي حددتها في الـ Seeder)

---

**فريق العمل:** [Asem Alkhabbas](https://www.google.com/search?q=https://github.com/Khabbas04) & Team Kollia 🚀

---

.*
