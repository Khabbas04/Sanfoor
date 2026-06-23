<?php

namespace App\Http\Requests;

use App\Models\Major;
use App\Models\User;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\Rule;

class ProfileUpdateRequest extends FormRequest
{
    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, \Illuminate\Contracts\Validation\ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        $user = $this->user();
        $isStudent = strtolower((string) ($user?->role ?? '')) === 'student';

        // Once a student sets a major, academic identity fields become immutable.
        $lockedMajorId = $isStudent && filled($user?->major_id)
            ? (int) $user->major_id
            : null;

        $lockedCollegeId = null;
        if ($lockedMajorId) {
            $collegeId = Major::query()->whereKey($lockedMajorId)->value('college_id');
            $lockedCollegeId = filled($collegeId) ? (int) $collegeId : null;
        }

        $lockedStudyPlan = $isStudent && filled($user?->study_plan_version)
            ? (int) $user->study_plan_version
            : null;

        $rules = [
            'name' => ['required', 'string', 'max:255'],
            'email' => [
                'required',
                'string',
                'lowercase',
                'email',
                'max:255',
                Rule::unique(User::class)->ignore($this->user()->id),
            ],
        ];

        if ($lockedCollegeId) {
            $rules['college_id'] = ['required', 'in:'.$lockedCollegeId];
        } else {
            $rules['college_id'] = [$isStudent ? 'required' : 'nullable', 'exists:colleges,id'];
        }

        if ($lockedMajorId) {
            $rules['major_id'] = ['required', 'in:'.$lockedMajorId];
        } else {
            $rules['major_id'] = [$isStudent ? 'required' : 'nullable', 'exists:majors,id'];
        }

        if ($lockedMajorId && $lockedStudyPlan) {
            $rules['study_plan_version'] = ['required', 'integer', 'in:'.$lockedStudyPlan];
        } else {
            $rules['study_plan_version'] = [$isStudent ? 'required' : 'nullable', 'integer', 'in:11,12'];
        }

        return $rules;
    }

    public function messages(): array
    {
        return [
            'college_id.in' => 'لا يمكن تغيير الكلية بعد حفظ بياناتك الأكاديمية.',
            'major_id.in' => 'لا يمكن تغيير التخصص بعد حفظ بياناتك الأكاديمية.',
            'study_plan_version.in' => 'لا يمكن تغيير الخطة الدراسية بعد حفظ بياناتك الأكاديمية.',
        ];
    }
}
