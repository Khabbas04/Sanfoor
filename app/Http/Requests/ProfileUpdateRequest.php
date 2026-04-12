<?php

namespace App\Http\Requests;

use App\Models\User;
use Illuminate\Foundation\Http\FormRequest;
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

        return [
            'name' => ['required', 'string', 'max:255'],
            'email' => [
                'required',
                'string',
                'lowercase',
                'email',
                'max:255',
                Rule::unique(User::class)->ignore($this->user()->id),
            ],
            'college_id' => ['nullable', 'exists:colleges,id'],
            'major_id' => [$isStudent ? 'required' : 'nullable', 'exists:majors,id'],
            'study_plan_version' => [$isStudent ? 'required' : 'nullable', 'integer', 'in:11,12'],
        ];
    }
}
