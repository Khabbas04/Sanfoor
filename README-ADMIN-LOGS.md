Admin logs enhancements

What I changed:

1) Database migration
- Added `owner_only` (boolean) and `meta` (json) columns to `admin_logs` via migration `2026_05_11_000000_add_owner_only_and_meta_to_admin_logs_table.php`.

2) Model
- `AdminLog` now allows `owner_only` and `meta` in `$fillable`.

3) Global DB change logging
- In `AppServiceProvider::boot()` I registered listeners for Eloquent Created/Updated/Deleted events. They create owner-only AdminLog entries with rich `meta` containing model, id, changes, request path, IP and user-agent. AdminLog creation is wrapped in try/catch to avoid breaking requests.

4) Admin dashboard
- `AdminController::dashboard()` now returns `logs` (non-owner logs) and `ownerLogs` (owner-only logs) but `ownerLogs` is provided only when the current user is an owner.

Notes & next steps:
- Run migrations: `php artisan migrate` to add the new columns.
- The global listeners exclude `AdminLog` and `AdminNote` to avoid recursion.
- If you want additional filtering (e.g. only log certain models), adjust the `Str::endsWith` checks or add a whitelist.
- Consider pruning owner logs or rotating them; they may grow large quickly.
- If you want to expose a UI to view `ownerLogs`, you can update the admin frontend to show the new `ownerLogs` prop.

If you want, I can:
- Add a UI tab for owner logs in the admin dashboard.
- Add more context to meta (e.g. SQL queries, auth user snapshot).
- Add a feature to mark existing logs as owner-only.
