<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\AdminLog;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class AdminManagerController extends Controller
{
    private function logAction(string $action, string $details): void
    {
        AdminLog::create([
            'user_id' => auth()->id(),
            'action' => $action,
            'details' => $details,
            'ip_address' => request()->ip(),
        ]);
    }

    public function index(): Response
    {
        $admins = User::query()
            ->whereRaw('LOWER(role) IN (?, ?)', ['owner', 'admin'])
            ->orderByRaw("CASE WHEN LOWER(role) = 'owner' THEN 0 ELSE 1 END")
            ->orderBy('name')
            ->get(['id', 'name', 'avatar', 'email', 'role', 'created_at']);

        $students = User::query()
            ->whereIn('role', ['student', 'instructor'])
            ->orderBy('name')
            ->limit(300)
            ->get(['id', 'name', 'avatar', 'email', 'role']);

        $loginLogs = AdminLog::query()
            ->with('user:id,name,avatar,email,role')
            ->where('action', 'USER_LOGIN')
            ->latest()
            ->take(80)
            ->get(['id', 'user_id', 'action', 'details', 'created_at']);

        return Inertia::render('Admin/Admins/Index', [
            'admins' => $admins,
            'students' => $students,
            'loginLogs' => $loginLogs,
        ]);
    }

    public function promote(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'user_id' => ['required', Rule::exists('users', 'id')->where('role', 'student')],
        ]);

        $user = User::find($data['user_id']);

        if (strtolower((string) $user->role) === 'owner') {
            return back()->with('message', 'لا يمكن تعديل رتبة Owner.')->with('type', 'error');
        }

        $user->forceFill(['role' => 'admin'])->save();
        $this->logAction('PROMOTE_USER_TO_ADMIN', "تمت ترقية المستخدم {$user->email} إلى admin");

        return back()->with('message', 'تمت ترقية المستخدم إلى Admin بنجاح.')->with('type', 'success');
    }

    public function updateRole(Request $request, User $user): RedirectResponse
    {
        $data = $request->validate([
            'role' => ['required', 'in:admin,student,instructor'],
        ]);

        if (strtolower((string) $user->role) === 'owner') {
            return back()->with('message', 'لا يمكن تعديل رتبة Owner.')->with('type', 'error');
        }

        $user->forceFill(['role' => $data['role']])->save();
        $this->logAction('UPDATE_USER_ROLE', "تم تعديل رتبة المستخدم {$user->email} إلى {$data['role']}");

        return back()->with('message', 'تم تحديث رتبة المستخدم بنجاح.')->with('type', 'success');
    }

    public function destroy(User $user): RedirectResponse
    {
        if ($user->id === auth()->id()) {
            return back()->with('message', 'لا يمكنك حذف حسابك بنفسك.')->with('type', 'error');
        }

        if (strtolower((string) $user->role) === 'owner') {
            return back()->with('message', 'لا يمكن حذف حساب Owner.')->with('type', 'error');
        }

        $email = $user->email;
        $user->delete();
        $this->logAction('DELETE_USER_ACCOUNT', "تم حذف حساب المستخدم {$email}");

        return back()->with('message', 'تم حذف حساب المستخدم بنجاح.')->with('type', 'success');
    }
}
