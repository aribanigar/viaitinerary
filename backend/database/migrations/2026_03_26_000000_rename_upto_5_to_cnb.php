<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::table('trips', function (Blueprint $table) {
            if (Schema::hasColumn('trips', 'kids_upto_5')) {
                $table->renameColumn('kids_upto_5', 'kids_cnb');
            }
        });

        Schema::table('trip_inquiries', function (Blueprint $table) {
            if (Schema::hasColumn('trip_inquiries', 'kids_upto_5')) {
                $table->renameColumn('kids_upto_5', 'kids_cnb');
            }
        });

        Schema::table('hotels', function (Blueprint $table) {
            if (Schema::hasColumn('hotels', 'deluxe_extra_bed_price_upto_5')) {
                $table->renameColumn('deluxe_extra_bed_price_upto_5', 'deluxe_extra_bed_price_cnb');
            }
            if (Schema::hasColumn('hotels', 'super_deluxe_extra_bed_price_upto_5')) {
                $table->renameColumn('super_deluxe_extra_bed_price_upto_5', 'super_deluxe_extra_bed_price_cnb');
            }
            if (Schema::hasColumn('hotels', 'suite_extra_bed_price_upto_5')) {
                $table->renameColumn('suite_extra_bed_price_upto_5', 'suite_extra_bed_price_cnb');
            }
        });
    }

    public function down()
    {
        Schema::table('trips', function (Blueprint $table) {
            if (Schema::hasColumn('trips', 'kids_cnb')) {
                $table->renameColumn('kids_cnb', 'kids_upto_5');
            }
        });

        Schema::table('trip_inquiries', function (Blueprint $table) {
            if (Schema::hasColumn('trip_inquiries', 'kids_cnb')) {
                $table->renameColumn('kids_cnb', 'kids_upto_5');
            }
        });

        Schema::table('hotels', function (Blueprint $table) {
            if (Schema::hasColumn('hotels', 'deluxe_extra_bed_price_cnb')) {
                $table->renameColumn('deluxe_extra_bed_price_cnb', 'deluxe_extra_bed_price_upto_5');
            }
            if (Schema::hasColumn('hotels', 'super_deluxe_extra_bed_price_cnb')) {
                $table->renameColumn('super_deluxe_extra_bed_price_cnb', 'super_deluxe_extra_bed_price_upto_5');
            }
            if (Schema::hasColumn('hotels', 'suite_extra_bed_price_cnb')) {
                $table->renameColumn('suite_extra_bed_price_cnb', 'suite_extra_bed_price_upto_5');
            }
        });
    }
};
