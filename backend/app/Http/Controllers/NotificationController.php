<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;

class NotificationController extends Controller
{
    /**
     * Return the authenticated user's latest notifications and unread count.
     *
     * Follow-up notification generation has been moved to the scheduled command
     * app:process-trip-follow-ups (runs hourly) so this endpoint is now a
     * pure read — no DB writes, no trip queries.
     */
    public function index(Request $request)
    {
        $user = $request->user();
        $perPage = (int) $request->input('per_page', 25);
        $perPage = max(1, min($perPage, 500));
        $search = trim((string) $request->input('search', ''));

        $query = $user->notifications()->latest();
        if ($search !== '') {
            $query->where('data', 'like', '%' . $search . '%');
        }

        $notifications = $query->paginate($perPage);

        return response()->json([
            'notifications' => $notifications->items(),
            'pagination'    => [
                'current_page' => $notifications->currentPage(),
                'last_page'    => $notifications->lastPage(),
                'per_page'     => $notifications->perPage(),
                'total'        => $notifications->total(),
                'from'         => $notifications->firstItem() ?? 0,
                'to'           => $notifications->lastItem() ?? 0,
            ],
            'unread_count'  => $user->unreadNotifications()->count(),
        ]);
    }

    /**
     * Return only the unread notification count — lightweight polling endpoint.
     * Does a single COUNT query; no notification data is loaded.
     */
    public function unreadCount(Request $request)
    {
        return response()->json([
            'unread_count' => $request->user()->unreadNotifications()->count(),
        ]);
    }

    public function markAsRead(Request $request, $id)
    {
        $notification = $request->user()->notifications()->findOrFail($id);
        $notification->markAsRead();

        return response()->json(['message' => 'Notification marked as read']);
    }

    public function markAllAsRead(Request $request)
    {
        $request->user()->unreadNotifications->markAsRead();

        return response()->json(['message' => 'All notifications marked as read']);
    }

    public function destroy(Request $request, $id)
    {
        $notification = $request->user()->notifications()->findOrFail($id);
        $notification->delete();

        return response()->json(['message' => 'Notification deleted']);
    }
}
