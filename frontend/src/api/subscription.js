import { request } from "../utils/apiClient";

export async function assignIncludedMember(memberUserId, token) {
  return request(`/subscription/assign-member`, {
    method: "POST",
    token,
    body: JSON.stringify({ member_user_id: memberUserId }),
  });
}
