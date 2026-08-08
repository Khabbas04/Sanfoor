<?php

namespace App\Http\Controllers;

use App\Models\SiteFeedback;
use Illuminate\Http\Request;
use Inertia\Inertia;

class SiteFeedbackController extends Controller
{
    /**
     * Store a newly created feedback in storage.
     */
    public function store(Request $request)
    {
        $data = $request->validate([
            'rating' => 'nullable|integer|min:0|max:5',
            'comments' => 'nullable|string|max:1000',
            'status' => 'required|in:submitted,skipped',
        ]);

        $rating = empty($data['rating']) ? null : (int) $data['rating'];

        // Only create if the user hasn't already submitted/skipped
        SiteFeedback::firstOrCreate(
            ['user_id' => $request->user()->id],
            [
                'rating' => $rating,
                'comments' => $request->comments,
                'status' => $request->status,
            ]
        );

        \Illuminate\Support\Facades\Cache::forget("user_{$request->user()->id}_feedback");

        return back()->with('success', 'شكراً لمشاركتك رأيك!');
    }

    /**
     * Display a listing of feedbacks for the admin.
     */
    public function index()
    {
        $feedbacks = SiteFeedback::with('user:id,name,email,major_id')
            ->latest()
            ->paginate(50);

        return Inertia::render('Admin/SiteFeedbacks/Index', [
            'feedbacks' => $feedbacks,
        ]);
    }
}
