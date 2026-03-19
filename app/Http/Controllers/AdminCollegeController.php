<?php

namespace App\Http\Controllers;

use App\Models\College;
use App\Models\Landmark;
use App\Models\University;
use Illuminate\Http\Request;
use Inertia\Inertia;

class AdminCollegeController extends Controller
{
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
        return Inertia::render('Admin/Colleges/Form', [
            'college' => null,
        ]);
    }

    public function storeCollege(Request $request)
    {
        $defaultUniversityId = University::query()->value('id');
        if (!$defaultUniversityId) {
            return back()
                ->withInput()
                ->withErrors(['name' => 'لا يمكن إضافة كلية قبل إنشاء الجامعة الأساسية أولاً.']);
        }

        $validated = $request->validate([
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

        $validated['university_id'] = $defaultUniversityId;

        College::create($validated);

        return redirect()->route('admin.colleges.index')
            ->with('success', 'تم إضافة الكلية بنجاح');
    }

    public function editCollege(College $college)
    {
        return Inertia::render('Admin/Colleges/Form', [
            'college' => $college,
        ]);
    }

    public function updateCollege(Request $request, College $college)
    {
        $defaultUniversityId = University::query()->value('id');
        if (!$defaultUniversityId) {
            return back()
                ->withInput()
                ->withErrors(['name' => 'لا يمكن تحديث الكلية قبل إنشاء الجامعة الأساسية أولاً.']);
        }

        $validated = $request->validate([
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

        $validated['university_id'] = $defaultUniversityId;

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
