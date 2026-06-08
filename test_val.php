<?php
try {
    validator([], ['course_id' => 'required|exists:courses,id'])->validate();
} catch (\Illuminate\Validation\ValidationException $e) {
    echo "Message: " . $e->getMessage() . "\n";
    print_r($e->errors());
}
