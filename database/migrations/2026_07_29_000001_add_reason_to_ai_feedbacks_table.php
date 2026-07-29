<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * A thumbs-down alone says an answer was wrong but not how, which is not enough to
 * act on. `reason` is an optional single choice the student may add, so real
 * failures can be grouped instead of read one by one.
 *
 * Nullable, and the endpoint keeps accepting requests without it: every feedback
 * row already stored stays valid and the old frontend keeps working.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('ai_feedbacks') || Schema::hasColumn('ai_feedbacks', 'reason')) {
            return;
        }

        Schema::table('ai_feedbacks', function (Blueprint $table) {
            $table->string('reason', 40)->nullable()->after('rating');
        });
    }

    public function down(): void
    {
        if (Schema::hasTable('ai_feedbacks') && Schema::hasColumn('ai_feedbacks', 'reason')) {
            Schema::table('ai_feedbacks', function (Blueprint $table) {
                $table->dropColumn('reason');
            });
        }
    }
};
