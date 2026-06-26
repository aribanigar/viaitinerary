import { request } from "../utils/apiClient";

export const getTeams = async (token) => {
  return request("/teams", { token });
};

export const createTeam = async (teamData, token) => {
  return request("/teams", {
    method: "POST",
    token,
    body: JSON.stringify(teamData),
  });
};

export const updateTeam = async (id, teamData, token) => {
  return request(`/teams/${id}`, {
    method: "PUT",
    token,
    body: JSON.stringify(teamData),
  });
};

export const deleteTeam = async (id, token) => {
  return request(`/teams/${id}`, {
    method: "DELETE",
    token,
  });
};

export const toggleTeamStatus = async (id, token) => {
  return request(`/teams/${id}/toggle-status`, {
    method: "PATCH",
    token,
  });
};
