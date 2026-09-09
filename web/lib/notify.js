import prisma from "@/lib/prisma";

/** Create a personal notification for a specific user. Never throws — a
 * notification failing to send must never break the action that triggered
 * it (creating a lead, assigning one, etc.). */
export async function notify(userId, type, data) {
  if (!userId) return null;
  try {
    return await prisma.notification.create({ data: { userId, type, data } });
  } catch (err) {
    console.error(`notify(${userId}, ${type}) failed:`, err.message);
    return null;
  }
}
