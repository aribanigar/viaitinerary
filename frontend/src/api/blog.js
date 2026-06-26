import { request } from "../utils/apiClient";

export async function fetchBlogPosts(params = {}) {
  const query = new URLSearchParams(params).toString();
  return request(`/blog/posts${query ? `?${query}` : ""}`);
}

export async function fetchBlogPost(slug) {
  const token = localStorage.getItem("token");
  const options = token ? { token } : {};
  return request(`/blog/posts/${slug}`, options);
}

export async function fetchBlogCategories() {
  return request("/blog/categories");
}
