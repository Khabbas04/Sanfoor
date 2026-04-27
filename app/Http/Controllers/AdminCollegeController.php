<?php

namespace App\Http\Controllers;

use App\Models\College;
use App\Models\Landmark;
use Illuminate\Http\Request;
use Inertia\Inertia;

class AdminCollegeController extends Controller
{
    // ==================== Colleges ====================

    public function indexColleges()
    {
        $colleges = College::query()
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

    // ==================== Majors ====================

    public function indexMajors()
    {
        $majors = \App\Models\Major::with('college')
            ->orderBy('name')
            ->get();

        return Inertia::render('Admin/Majors/Index', [
            'majors' => $majors,
        ]);
    }

    public function createMajor()
    {
        $colleges = College::orderBy('name')->get();

        return Inertia::render('Admin/Majors/Form', [
            'major' => null,
            'colleges' => $colleges,
        ]);
    }

    public function storeMajor(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'code' => 'required|string|max:50|unique:majors,code',
            'college_id' => 'required|exists:colleges,id',
        ]);

        \App\Models\Major::create($validated);

        return redirect()->route('admin.majors.index')
            ->with('success', 'تم إضافة التخصص بنجاح');
    }

    public function editMajor(\App\Models\Major $major)
    {
        $colleges = College::orderBy('name')->get();

        return Inertia::render('Admin/Majors/Form', [
            'major' => $major,
            'colleges' => $colleges,
        ]);
    }

    public function updateMajor(Request $request, \App\Models\Major $major)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'code' => 'required|string|max:50|unique:majors,code,' . $major->id,
            'college_id' => 'required|exists:colleges,id',
        ]);

        $major->update($validated);

        return redirect()->route('admin.majors.index')
            ->with('success', 'تم تحديث التخصص بنجاح');
    }

    public function destroyMajor(\App\Models\Major $major)
    {
        $major->delete();

        return redirect()->route('admin.majors.index')
            ->with('success', 'تم حذف التخصص بنجاح');
    }
}
