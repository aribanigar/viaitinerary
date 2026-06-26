<?php

namespace App\Http\Controllers;

use App\Models\Policy;
use Illuminate\Http\Request;

class PolicyController extends Controller
{
    public function show(Request $request)
    {
        $policies = Policy::where('user_id', $request->user()->getAdminId())->first();

        if (!$policies) {
            $policies = Policy::create([
                'user_id' => $request->user()->getAdminId(),
                'terms_conditions' => [
                    "The balance amount must be paid one week before arrival for a smooth hotel check-in.",
                    "Rates are net and non-commissionable.",
                    "The vehicle provided to the client is not at the guest's disposal.",
                    "Extra bed means extra bed as per the hotel's discretion; some hotels provide roll-out beds if no extra bed is available.",
                    "No refund will be made against any unutilized services.",
                    "Any additional services taken by the guest and not included in the package will be charged as per prevailing rates.",
                    "The travel agency will not be responsible for any additional services taken without informing the agent."
                ],
                'must_haves' => [
                    "Carry postpaid SIM cards to Kashmir.",
                    "Prepaid SIMs from outside J&K do not work in Kashmir.",
                    "Prepaid SIMs can be purchased at Srinagar Airport.",
                    "Carry light woollens up to October end and heavy woollens from November to March.",
                    "No AC vehicle will be available on drives to hill areas due to steep slopes.",
                    "Ask your travel agent for government-fixed rates for services not included in the package to avoid being charged extra."
                ],
                'roles_responsibilities' => [
                    "Timely payment of tour balance",
                    "Carrying valid SIM, ID proofs, and clothing suitable for weather",
                    "Paying directly for optional activities and union services",
                    "Following government regulations and local rules",
                    "Bearing costs for services not included in the package"
                ],
                'cancellation_policy' => [
                    "Within 60 days prior to arrival: 25% retention of the total tour cost.",
                    "Within 25 days prior to arrival: 50% retention of the total tour cost.",
                    "Within 15 days prior to arrival: 100% retention of the total tour cost."
                ],
                'additional_expenses' => [
                    "Garden entry tickets: ₹20 – ₹100 per person per garden",
                    "Pony rides (Gulmarg / Pahalgam / Sonamarg): approx. ₹1500 per person",
                    "Guide services: approx. ₹900 per day in Gulmarg",
                    "Snow cab (Tangmarg ↔ Gulmarg): approx. ₹2500 per cab (mandatory during snowfall)",
                    "ATV rides to Frozen Drung Waterfall: approx. ₹1500 per person",
                    "Union taxi in Sonamarg to Zero Point: approx. ₹4500 – ₹5000 per cab",
                    "Union cab in Pahalgam (Aru / Betaab / Chandanwari): approx. ₹2500 – ₹3000 per cab"
                ],
                'default_inclusions' => [
                    "Private vehicle for inter-city transfers",
                    "Accommodation as mentioned in the itinerary",
                    "Meal plan as mentioned",
                    "1-hour Shikara ride",
                    "Driver expenses, including toll tax, parking, fuel, driver night stays, and meals",
                    "Sightseeing as per the itinerary"
                ],
                'default_exclusions' => [
                    "Air tickets and train tickets (to be arranged by guests)",
                    "Union cabs as and when required",
                    "Pony rides anywhere",
                    "Gondola Rides Gulmarg",
                    "Anti-skid snow cabs (mandatory during or after snowfall)",
                    "Sightseeing by ATVs",
                    "Garden entry tickets",
                    "Lunches during the tour",
                    "Travel insurance",
                    "Guide charges, entry fees, and cameraman charges",
                    "Personal expenses such as laundry, tips, telephone calls, etc.",
                    "Anything not specifically mentioned in inclusions"
                ],
            ]);
        }

        return response()->json([
            'termsConditions' => $policies->terms_conditions,
            'mustHaves' => $policies->must_haves,
            'rolesResponsibilities' => $policies->roles_responsibilities,
            'cancellationPolicy' => $policies->cancellation_policy,
            'additionalExpenses' => $policies->additional_expenses,
            'defaultInclusions' => $policies->default_inclusions,
            'defaultExclusions' => $policies->default_exclusions,
        ]);
    }

    public function update(Request $request)
    {
        $user = $request->user();

        $validated = $request->validate([
            'termsConditions' => 'nullable|array',
            'termsConditions.*' => 'nullable|string',
            'mustHaves' => 'nullable|array',
            'mustHaves.*' => 'nullable|string',
            'rolesResponsibilities' => 'nullable|array',
            'rolesResponsibilities.*' => 'nullable|string',
            'cancellationPolicy' => 'nullable|array',
            'cancellationPolicy.*' => 'nullable|string',
            'additionalExpenses' => 'nullable|array',
            'additionalExpenses.*' => 'nullable|string',
            'defaultInclusions' => 'nullable|array',
            'defaultInclusions.*' => 'nullable|string',
            'defaultExclusions' => 'nullable|array',
            'defaultExclusions.*' => 'nullable|string',
        ]);

        $policies = Policy::firstOrNew(['user_id' => $user->getAdminId()]);

        $policies->fill([
            'terms_conditions' => $validated['termsConditions'],
            'must_haves' => $validated['mustHaves'],
            'roles_responsibilities' => $validated['rolesResponsibilities'],
            'cancellation_policy' => $validated['cancellationPolicy'],
            'additional_expenses' => $validated['additionalExpenses'],
            'default_inclusions' => $validated['defaultInclusions'],
            'default_exclusions' => $validated['defaultExclusions'],
        ]);

        $policies->save();

        return response()->json([
            'termsConditions' => $policies->terms_conditions,
            'mustHaves' => $policies->must_haves,
            'rolesResponsibilities' => $policies->roles_responsibilities,
            'cancellationPolicy' => $policies->cancellation_policy,
            'additionalExpenses' => $policies->additional_expenses,
            'defaultInclusions' => $policies->default_inclusions,
            'defaultExclusions' => $policies->default_exclusions,
        ]);
    }
}
