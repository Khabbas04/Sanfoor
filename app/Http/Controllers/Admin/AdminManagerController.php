<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class AdminManagerController extends Controller
{
    public function index(): Response
    {
        $admins = User::query()
            ->whereIn('role', ['owner', 'admin'])
            ->orderByRaw("CASE WHEN role = 'owner' THEN 0 ELSE 1 END")
            ->orderBy('name')
            ->get(['id', 'name', 'email', 'role', 'created_at']);

        $students = User::query()
            ->where('role', 'student')
            ->orderBy('name')
            ->limit(300)
            ->get(['id', 'name', 'email']);

        return Inertia::render('Admin/Admins/Index', [
            'admins' => $admins,
            'students' => $students,
        ]);
    }

    public function promote(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'user_id' => ['required', 'exists:users,id'],
        ]);

        $user = User::findOrFail($data['user_id']);

        if ($user->role === 'owner') {
            return back()->with('message', 'لا يمكن تعديل رتبة Owner.')->with('type', 'error');
        }

        $user->update(['role' => 'admin']);

        return back()->with('message', 'تمت ترقية المستخدم إلى Admin بنجاح.')->with('type', 'success');
    }

    public function updateRole(Request $request, User $user): RedirectResponse
    {
        $data = $request->validate([
            'role' => ['required', 'in:admin,student'],
        ]);

        if ($user->role === 'owner') {
            return back()->with('message', 'لا يمكن تعديل رتبة Owner.')->with('type', 'error');
        }

        $user->update(['role' => $data['role']]);

        return back()->with('message', 'تم تحديث رتبة المستخدم بنجاح.')->with('type', 'success');
    }

    public function destroy(User $user): RedirectResponse
    {
        if ($user->role === 'owner') {
            return back()->with('message', 'لا يمكن حذف حساب Owner.')->with('type', 'error');
        }

        $user->delete();

        return back()->with('message', 'تم حذف حساب المستخدم بنجاح.')->with('type', 'success');
    }
}
