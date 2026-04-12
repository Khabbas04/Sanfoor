<?php

namespace App\Http\Requests;

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
        $isStudent = strtolower((string) ($this->user()?->role ?? '')) === 'student';

        $hasMajorsTable = Schema::hasTable('majors');
        $hasCollegesTable = Schema::hasTable('colleges');
        $hasMajorColumn = Schema::hasColumn('users', 'major_id');
        $hasPlanColumn = Schema::hasColumn('users', 'study_plan_version');

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

        if ($hasCollegesTable) {
            $rules['college_id'] = ['nullable', 'exists:colleges,id'];
        }

        if ($hasMajorColumn) {
            $majorRules = [$isStudent ? 'required' : 'nullable'];
            $majorRules[] = $hasMajorsTable ? 'exists:majors,id' : 'integer';
            $rules['major_id'] = $majorRules;
        }

        if ($hasPlanColumn) {
            $rules['study_plan_version'] = [$isStudent ? 'required' : 'nullable', 'integer', 'in:11,12'];
        }

        return $rules;
    }
}
