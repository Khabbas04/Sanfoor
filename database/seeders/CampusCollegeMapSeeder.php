<?php

namespace Database\Seeders;

use App\Models\College;
use Illuminate\Database\Seeder;

class CampusCollegeMapSeeder extends Seeder
{
    public function run(): void
    {
        $rows = [
            [
                'symbol' => 'أ.ب',
                'location' => 'مبنى الفاروقي',
                'summary' => 'يضم هذا الرمز: الشريعة، الآداب، تكنولوجيا المعلومات، العلوم التربوية.',
                'colleges' => [
                    'كلية الشريعة',
                    'كلية الآداب',
                    'كلية تكنولوجيا المعلومات',
                    'كلية العلوم التربوية',
                ],
            ],
            [
                'symbol' => 'ت',
                'location' => 'مبنى رمز ت',
                'summary' => 'يضم هذا الرمز: العلوم الطبية المساندة، الكلية الزراعية التقنية.',
                'colleges' => [
                    'كلية العلوم الطبية المساندة',
                    'الكلية الزراعية التقنية',
                ],
            ],
            [
                'symbol' => 'د.هـ',
                'location' => 'مبنى الخوارزمي',
                'summary' => 'يضم هذا الرمز: التمريض، الصيدلة، العلوم.',
                'colleges' => [
                    'كلية التمريض',
                    'كلية الصيدلة',
                    'كلية العلوم',
                ],
            ],
            [
                'symbol' => 'ل',
                'location' => 'مبنى رمز ل',
                'summary' => 'يضم هذا الرمز: الهندسة التكنولوجية، الفنون والتصميم.',
                'colleges' => [
                    'كلية الهندسة التكنولوجية',
                    'كلية الفنون والتصميم',
                ],
            ],
            [
                'symbol' => 'ص',
                'location' => 'مبنى رمز ص',
                'summary' => 'يضم هذا الرمز: الصحافة والإعلام، الحقوق.',
                'colleges' => [
                    'كلية الصحافة والإعلام',
                    'كلية الحقوق',
                ],
            ],
            [
                'symbol' => 'ق',
                'location' => 'مبنى الشهيد معاذ الكساسبة',
                'summary' => 'يضم هذا الرمز: الاقتصاد والعلوم الإدارية، الدراسات العليا.',
                'colleges' => [
                    'كلية الاقتصاد والعلوم الإدارية',
                    'كلية الدراسات العليا',
                ],
            ],
            [
                'symbol' => 'ط',
                'location' => 'مبنى كلية طب الأسنان',
                'summary' => 'يضم هذا الرمز: كلية طب الأسنان.',
                'colleges' => [
                    'كلية طب الأسنان',
                ],
            ],
        ];

        foreach ($rows as $row) {
            foreach ($row['colleges'] as $collegeName) {
                College::query()->updateOrCreate(
                    ['name' => $collegeName],
                    [
                        'building_symbol' => $row['symbol'],
                        'building_location' => $row['location'],
                        'description' => $row['summary'],
                        'services' => [
                            'قاعات محاضرات',
                            'إرشاد أكاديمي',
                            'مكاتب أعضاء هيئة التدريس',
                        ],
                    ]
                );
            }
        }
    }
}
