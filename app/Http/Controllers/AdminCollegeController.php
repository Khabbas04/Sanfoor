<?php

namespace App\Http\Controllers;

use App\Models\College;
use App\Models\Landmark;
use Illuminate\Http\Request;
use Inertia\Inertia;

class AdminCollegeController extends Controller
{
    public function __construct()
    {
        $this->middleware('auth');
        $this->middleware('admin');
    }

    // ==================== Colleges ====================

    public function indexColleges()
    {
        $colleges = College::with('university')
            ->orderBy('name')
            ->get();

        return Inertia::render('Admin/Colleges/Index', [
            'colleges' => $colleges,
        ]);
    }

    public function createCollege()
    {
        $universities = \App\Models\University::orderBy('name')->get();

        return Inertia::render('Admin/Colleges/Form', [
            'college' => null,
            'universities' => $universities,
        ]);
    }

    public function storeCollege(Request $request)
    {
        $validated = $request->validate([
            'university_id' => 'required|exists:universities,id',
            'name' => 'required|string|max:255|unique:colleges,name',
            'description' => 'nullable|string',
            'building_symbol' => 'nullable|string|max:50',
            'building_location' => 'nullable|string|max:255',
            'services' => 'nullable|array',
            'image_url' => 'nullable|url',
            'location_latitude' => 'nullable|numeric',
            'location_longitude' => 'nullable|numeric',
            'maps_url' => 'nullable|url',
        ]);

        College::create($validated);

        return redirect()->route('admin.colleges.index')
            ->with('success', 'تم إضافة الكلية بنجاح');
    }

    public function editCollege(College $college)
    {
        $universities = \App\Models\University::orderBy('name')->get();

        return Inertia::render('Admin/Colleges/Form', [
            'college' => $college,
            'universities' => $universities,
        ]);
    }

    public function updateCollege(Request $request, College $college)
    {
        $validated = $request->validate([
            'university_id' => 'required|exists:universities,id',
            'name' => 'required|string|max:255|unique:colleges,name,' . $college->id,
            'description' => 'nullable|string',
            'building_symbol' => 'nullable|string|max:50',
            'building_location' => 'nullable|string|max:255',
            'services' => 'nullable|array',
            'image_url' => 'nullable|url',
            'location_latitude' => 'nullable|numeric',
            'location_longitude' => 'nullable|numeric',
            'maps_url' => 'nullable|url',
        ]);

        $college->update($validated);

        return redirect()->route('admin.colleges.index')
            ->with('success', 'تم تحديث الكلية بنجاح');
    }

    public function destroyCollege(College $college)
    {
        $college->delete();

        return redirect()->route('admin.colleges.index')
            ->with('success', 'تم حذف الكلية بنجاح');
    }

    // ==================== Landmarks ====================

    public function indexLandmarks()
    {
        $landmarks = Landmark::orderBy('type')
            ->orderBy('name')
            ->get();

        return Inertia::render('Admin/Landmarks/Index', [
            'landmarks' => $landmarks,
        ]);
    }

    public function createLandmark()
    {
        return Inertia::render('Admin/Landmarks/Form', [
            'landmark' => null,
        ]);
    }

    public function storeLandmark(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'type' => 'required|string|in:restaurant,prayer_room,library,clinic,parking,sports,shop,other',
            'building_location' => 'nullable|string|max:255',
            'location_latitude' => 'nullable|numeric|between:-90,90',
            'location_longitude' => 'nullable|numeric|between:-180,180',
            'maps_url' => 'nullable|url',
            'image_url' => 'nullable|url',
            'is_active' => 'boolean',
        ]);

        $validated['is_active'] = $request->boolean('is_active');
        Landmark::create($validated);

        return redirect()->route('admin.landmarks.index')
            ->with('success', 'تم إضافة المعلم بنجاح');
    }

    public function editLandmark(Landmark $landmark)
    {
        return Inertia::render('Admin/Landmarks/Form', [
            'landmark' => $landmark,
        ]);
    }

    public function updateLandmark(Request $request, Landmark $landmark)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'type' => 'required|string|in:restaurant,prayer_room,library,clinic,parking,sports,shop,other',
            'building_location' => 'nullable|string|max:255',
            'location_latitude' => 'nullable|numeric|between:-90,90',
            'location_longitude' => 'nullable|numeric|between:-180,180',
            'maps_url' => 'nullable|url',
            'image_url' => 'nullable|url',
            'is_active' => 'boolean',
        ]);

        $validated['is_active'] = $request->boolean('is_active');
        $landmark->update($validated);

        return redirect()->route('admin.landmarks.index')
            ->with('success', 'تم تحديث المعلم بنجاح');
    }

    public function destroyLandmark(Landmark $landmark)
    {
        $landmark->delete();

        return redirect()->route('admin.landmarks.index')
            ->with('success', 'تم حذف المعلم بنجاح');
    }
}
