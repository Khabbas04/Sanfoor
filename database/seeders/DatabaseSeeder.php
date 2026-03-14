<?php

namespace Database\Seeders;

use App\Models\User;
use App\Models\College;
use App\Models\Major;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        // 1. إنشاء كلية الـ IT
        $itCollege = College::create(['name' => 'كلية تكنولوجيا المعلومات (IT)']);

        // 2. إنشاء التخصصات الأربعة
        $majors = [
            ['name' => 'علم الحاسوب', 'code' => 'CS'],
            ['name' => 'الأمن السيبراني', 'code' => 'CYS'],
            ['name' => 'الذكاء الاصطناعي', 'code' => 'AI'],
            ['name' => 'هندسة البرمجيات', 'code' => 'SE'],
        ];

        foreach ($majors as $major) {
            Major::create([
                'college_id' => $itCollege->id,
                'name' => $major['name'],
                'code' => $major['code'],
            ]);
        }

        // إنشاء مستخدم تجريبي (اختياري)
        User::factory()->create([
            'name' => 'Owner User',
            'email' => 'owner@sanfoor.com',
            'password' => bcrypt('password'),
            'role' => 'owner',
        ]);

        User::factory()->create([
            'name' => 'Admin User',
            'email' => 'admin@sanfoor.com',
            'password' => bcrypt('password'),
            'role' => 'admin',
        ]);
    }
}