import React, { useState, useRef } from "react";
import { useAuth } from "../../context/AuthContext";
import { useSearchParams } from "react-router-dom";
import { toast } from "react-toastify";
import DashboardLayout from "./DashboardLayout";
import { updateProfile } from "../../api/auth";

const Profile = () => {
  const { user, setUser, token, passwordUpdateRequired, markPasswordUpdated } =
    useAuth();
  const [searchParams] = useSearchParams();
  const isPasswordUpdateRouteHint = searchParams.get("password-update") === "1";
  const showPasswordUpdateNotice =
    passwordUpdateRequired || isPasswordUpdateRouteHint;
  const [formData, setFormData] = useState({
    name: user?.name || "",
    password: "",
    password_confirmation: "",
    profile_picture: null,
  });
  const [preview, setPreview] = useState(
    user?.profile_picture
      ? `${import.meta.env.VITE_API_URL || "http://localhost:8000"}/storage/${user.profile_picture}`
      : null,
  );
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef(null);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setFormData((prev) => ({
        ...prev,
        profile_picture: file,
      }));

      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => setPreview(e.target.result);
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const submitData = {
        name: formData.name,
      };

      if (formData.password) {
        submitData.password = formData.password;
        submitData.password_confirmation = formData.password_confirmation;
      }

      if (formData.profile_picture instanceof File) {
        // Convert file to base64
        const base64 = await fileToBase64(formData.profile_picture);
        submitData.profile_picture = base64;
      }

      const response = await updateProfile(submitData, token);

      setUser(response.user);

      if (submitData.password) {
        markPasswordUpdated();
      }

      toast.success("Profile updated successfully!");
    } catch (error) {
      console.error("Update profile error:", error);
      if (error.response?.data?.errors) {
        Object.values(error.response.data.errors).forEach((errors) => {
          errors.forEach((error) => toast.error(error));
        });
      } else {
        toast.error("Failed to update profile");
      }
    } finally {
      setLoading(false);
    }
  };

  const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = (error) => reject(error);
    });
  };

  const getInitials = (name) => {
    if (!name) return "US";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200">
          <div className="px-6 py-4 border-b border-slate-200">
            <h1 className="text-2xl font-bold text-slate-900">
              Profile Settings
            </h1>
            <p className="text-slate-600 mt-1">
              Update your personal information and preferences
            </p>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {showPasswordUpdateNotice && (
              <div className="p-4 rounded-lg border border-amber-200 bg-amber-50 text-amber-900">
                <p className="font-semibold">Password update required</p>
                <p className="text-sm mt-1">
                  Your current password does not meet the latest security
                  policy. Please set a new strong password now.
                </p>
              </div>
            )}

            {/* Profile Picture */}
            <div className="flex items-center gap-6">
              <div className="relative">
                <div className="w-24 h-24 rounded-full bg-[#c7f135] flex items-center justify-center text-white font-bold text-2xl ring-4 ring-white shadow-lg">
                  {preview ? (
                    <img
                      src={preview}
                      alt="Profile"
                      className="w-full h-full rounded-full object-cover"
                    />
                  ) : (
                    getInitials(user?.name)
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute -bottom-2 -right-2 w-8 h-8 bg-[#c7f135] hover:bg-[#c7f135] text-[#10182a] rounded-full flex items-center justify-center transition-colors"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                    />
                  </svg>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900">
                  Profile Picture
                </h3>
                <p className="text-slate-600 text-sm">
                  Upload a new profile picture. Accepted formats: JPG, JPEG,
                  PNG, WebP. Max size: 2MB
                </p>
              </div>
            </div>

            {/* Name */}
            <div>
              <label
                htmlFor="name"
                className="block text-sm font-medium text-slate-700 mb-2"
              >
                Full Name
              </label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#c7f135] focus:border-[#c7f135]"
                placeholder="Enter your full name"
              />
            </div>

            {/* Password */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-slate-900">
                Change Password
              </h3>
              <div>
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-slate-700 mb-2"
                >
                  New Password
                </label>
                <input
                  type="password"
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#c7f135] focus:border-[#c7f135]"
                  placeholder="Enter new password (leave blank to keep current)"
                />
              </div>
              <div>
                <label
                  htmlFor="password_confirmation"
                  className="block text-sm font-medium text-slate-700 mb-2"
                >
                  Confirm New Password
                </label>
                <input
                  type="password"
                  id="password_confirmation"
                  name="password_confirmation"
                  value={formData.password_confirmation}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#c7f135] focus:border-[#c7f135]"
                  placeholder="Confirm new password"
                />
              </div>
              <p className="text-xs text-slate-500">
                Password must be at least 8 characters and include uppercase,
                lowercase, number, and special character.
              </p>
            </div>

            {/* Submit Button */}
            <div className="flex justify-end pt-4">
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2 bg-[#c7f135] hover:bg-[#c7f135] text-[#10182a] rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Updating..." : "Update Profile"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Profile;
