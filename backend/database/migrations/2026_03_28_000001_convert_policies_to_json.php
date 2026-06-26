<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        $fields = [
            'terms_conditions',
            'must_haves',
            'roles_responsibilities',
            'cancellation_policy',
            'additional_expenses',
            'default_inclusions',
            'default_exclusions'
        ];

        // Process in batches to avoid memory issues if table grows
        DB::table('policies')->orderBy('id')->chunk(100, function ($policies) use ($fields) {
            foreach ($policies as $policy) {
                $updateData = [];
                foreach ($fields as $field) {
                    $rawContent = $policy->$field;

                    if (empty($rawContent)) {
                        $updateData[$field] = json_encode([]);
                        continue;
                    }

                    // Only convert if it doesn't already look like JSON
                    $decoded = json_decode($rawContent, true);
                    if (json_last_error() === JSON_ERROR_NONE && is_array($decoded)) {
                        continue; // Already JSON array
                    }

                    // Explode by newline, trim, and filter empties
                    $arrayContent = array_values(array_filter(array_map('trim', explode("\n", $rawContent))));
                    $updateData[$field] = json_encode($arrayContent);
                }

                if (!empty($updateData)) {
                    DB::table('policies')->where('id', $policy->id)->update($updateData);
                }
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        $fields = [
            'terms_conditions',
            'must_haves',
            'roles_responsibilities',
            'cancellation_policy',
            'additional_expenses',
            'default_inclusions',
            'default_exclusions'
        ];

        DB::table('policies')->orderBy('id')->chunk(100, function ($policies) use ($fields) {
            foreach ($policies as $policy) {
                $updateData = [];
                foreach ($fields as $field) {
                    $rawContent = $policy->$field;

                    if (!empty($rawContent)) {
                        $decoded = json_decode($rawContent, true);
                        if (is_array($decoded)) {
                            // Implode array into newline string
                            $updateData[$field] = implode("\n", $decoded);
                        }
                    }
                }

                if (!empty($updateData)) {
                    DB::table('policies')->where('id', $policy->id)->update($updateData);
                }
            }
        });
    }
};
