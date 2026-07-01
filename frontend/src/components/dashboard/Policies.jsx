import React, { useState, useEffect, useRef } from "react";
import DashboardLayout from "./DashboardLayout";
import {
  FileText,
  CheckCircle,
  Users,
  Clock,
  IndianRupee,
  Plus,
  Minus,
  Trash2,
  Pencil,
  X,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { fetchPolicies, updatePolicies } from "../../api/policies";
import Loader from "../common/Loader";
import { toast } from "react-toastify";

// Helper component to render a list item with explicit edit state
const PolicyListItem = ({ value, onChange, placeholder, onRemove }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [tempValue, setTempValue] = useState(value);
  const textareaRef = useRef(null);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height =
        textareaRef.current.scrollHeight + "px";
    }
  }, [tempValue, isEditing]);

  const handleSave = () => {
    onChange(tempValue);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setTempValue(value);
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className="group flex items-start justify-between bg-blue-50/50 border border-blue-200 p-3 rounded-xl transition-all shadow-sm">
        <textarea
          ref={textareaRef}
          value={tempValue}
          onChange={(e) => setTempValue(e.target.value)}
          placeholder={placeholder}
          className="text-[13px] font-bold text-slate-700 w-full bg-transparent border-none focus:ring-0 resize-none overflow-hidden"
          rows={1}
          autoFocus
        />
        <div className="flex gap-1 ml-2 mt-[-2px]">
          <button
            onClick={handleSave}
            title="Save Edit"
            className="text-white bg-blue-600 hover:bg-blue-700 p-1.5 rounded-lg transition-colors shrink-0 shadow-sm"
          >
            <CheckCircle className="w-4 h-4" />
          </button>
          <button
            onClick={handleCancel}
            title="Cancel"
            className="text-slate-400 hover:text-slate-600 hover:bg-slate-200 p-1.5 rounded-lg transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="group flex items-start justify-between bg-slate-50 border border-slate-100 p-3 rounded-xl transition-all hover:border-slate-300 hover:shadow-sm">
      <p className="text-[13px] font-bold text-slate-700 w-full whitespace-pre-wrap leading-relaxed">
        {value}
      </p>
      <div className="flex gap-1 ml-2 shrink-0 mt-[-2px]">
        <button
          onClick={() => setIsEditing(true)}
          title="Edit Item"
          className="text-slate-400 hover:text-blue-600 hover:bg-blue-50 p-1.5 rounded-lg transition-colors"
        >
          <Pencil className="w-4 h-4" />
        </button>
        <button
          onClick={onRemove}
          title="Delete Item"
          className="text-slate-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded-lg transition-colors"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

// Reusable component for lists
const DynamicPolicyList = ({
  title,
  icon: Icon,
  color,
  fieldName,
  values,
  onChange,
  placeholder,
  subtitle,
}) => {
  const [newValue, setNewValue] = useState("");

  const handleAdd = () => {
    if (newValue.trim()) {
      onChange(fieldName, [...(values || []), newValue.trim()]);
      setNewValue("");
    }
  };

  const handleRemove = (index) => {
    const newValues = [...(values || [])];
    newValues.splice(index, 1);
    onChange(fieldName, newValues);
  };

  const handleItemChange = (index, val) => {
    const newValues = [...(values || [])];
    newValues[index] = val;
    onChange(fieldName, newValues);
  };

  return (
    <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm transition-all hover:shadow-md">
      <div className={`flex items-center gap-2 mb-6 ${color}`}>
        <Icon className="w-5 h-5" />
        <h2 className="text-lg font-bold text-slate-900">{title}</h2>
      </div>

      <div className="space-y-6">
        <div>
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block ml-1 mb-2">
            Add New Item
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder={placeholder}
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleAdd()}
              className="flex-1 bg-white border border-slate-200 rounded-xl py-2.5 px-4 text-[13px] font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-400 placeholder:font-medium shadow-sm"
            />
            <button
              onClick={handleAdd}
              className="bg-slate-900 text-white px-4 rounded-xl hover:bg-slate-800 transition-all shadow-sm font-bold text-sm flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              Add
            </button>
          </div>
          <p className="text-[10px] text-slate-400 font-medium ml-1 mt-2">
            {subtitle}
          </p>
        </div>

        <div>
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block ml-1 mb-2">
            {title} Content List
          </label>
          <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
            {!values || values.length === 0 ? (
              <p className="text-xs text-center text-slate-400 font-medium py-4 px-4 border border-dashed border-slate-200 rounded-xl bg-slate-50">
                No items added yet. Add one above!
              </p>
            ) : (
              (values || []).map((item, index) => (
                <PolicyListItem
                  key={index}
                  value={item}
                  onChange={(val) => handleItemChange(index, val)}
                  placeholder="Item content..."
                  onRemove={() => handleRemove(index)}
                />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const Policies = () => {
  const { token } = useAuth();
  const [formData, setFormData] = useState({
    termsConditions: [],
    mustHaves: [],
    rolesResponsibilities: [],
    cancellationPolicy: [],
    additionalExpenses: [],
    defaultInclusions: [],
    defaultExclusions: [],
  });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("termsConditions");

  const tabs = [
    { id: "termsConditions", label: "Terms & Conditions", icon: FileText },
    { id: "defaultInclusions", label: "Inclusions", icon: Plus },
    { id: "defaultExclusions", label: "Exclusions", icon: Minus },
    { id: "mustHaves", label: "Must Haves", icon: CheckCircle },
    { id: "rolesResponsibilities", label: "Roles", icon: Users },
    { id: "cancellationPolicy", label: "Cancellation", icon: Clock },
    { id: "additionalExpenses", label: "Expenses", icon: IndianRupee },
  ];

  useEffect(() => {
    async function loadPolicies() {
      try {
        const data = await fetchPolicies(token);
        // Ensure arrays
        const cleanData = {
          termsConditions: Array.isArray(data?.termsConditions)
            ? data.termsConditions
            : [],
          mustHaves: Array.isArray(data?.mustHaves) ? data.mustHaves : [],
          rolesResponsibilities: Array.isArray(data?.rolesResponsibilities)
            ? data.rolesResponsibilities
            : [],
          cancellationPolicy: Array.isArray(data?.cancellationPolicy)
            ? data.cancellationPolicy
            : [],
          additionalExpenses: Array.isArray(data?.additionalExpenses)
            ? data.additionalExpenses
            : [],
          defaultInclusions: Array.isArray(data?.defaultInclusions)
            ? data.defaultInclusions
            : [],
          defaultExclusions: Array.isArray(data?.defaultExclusions)
            ? data.defaultExclusions
            : [],
        };
        if (data) setFormData(cleanData);
      } catch (err) {
        console.error("Failed to load policies:", err);
      } finally {
        setLoading(false);
      }
    }
    if (token) loadPolicies();
  }, [token]);

  const handleListChange = async (fieldName, newArray) => {
    const updated = { ...formData, [fieldName]: newArray };
    setFormData(updated);
    try {
      await updatePolicies(token, updated);
    } catch (err) {
      console.error("Auto-save failed:", err);
      toast.error("Failed to save changes.");
    }
  };

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center min-h-[50vh]">
          <Loader text="Loading your policies..." />
        </div>
      );
    }

    return (
      <div>
        <div className="max-w-5xl">
          {/* Tabs Navigation */}
          <div className="flex overflow-x-auto pb-4 mb-6 gap-2 hide-scrollbar">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm whitespace-nowrap transition-all ${
                  activeTab === tab.id
                    ? "bg-slate-900 text-white shadow-md shadow-slate-200"
                    : "bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-900 border border-slate-200"
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-1 gap-8 pb-12">
            {activeTab === "termsConditions" && (
              <DynamicPolicyList
                title="Terms and Conditions"
                icon={FileText}
                color="text-[#1b1b1b]"
                fieldName="termsConditions"
                values={formData.termsConditions}
                onChange={handleListChange}
                placeholder="Enter a new term or condition..."
                subtitle="Each item will be displayed as a separate bullet point"
              />
            )}

            {activeTab === "defaultInclusions" && (
              <DynamicPolicyList
                title="Default Inclusions"
                icon={Plus}
                color="text-[#10B981]"
                fieldName="defaultInclusions"
                values={formData.defaultInclusions}
                onChange={handleListChange}
                placeholder="Enter a default itinerary inclusion..."
                subtitle="Automatically added to new trips in the Trip Builder"
              />
            )}

            {activeTab === "defaultExclusions" && (
              <DynamicPolicyList
                title="Default Exclusions"
                icon={Minus}
                color="text-[#EF4444]"
                fieldName="defaultExclusions"
                values={formData.defaultExclusions}
                onChange={handleListChange}
                placeholder="Enter a default itinerary exclusion..."
                subtitle="Automatically added to new trips in the Trip Builder"
              />
            )}

            {activeTab === "mustHaves" && (
              <DynamicPolicyList
                title="Must Haves"
                icon={CheckCircle}
                color="text-[#1b1b1b]"
                fieldName="mustHaves"
                values={formData.mustHaves}
                onChange={handleListChange}
                placeholder="Enter a must have item..."
                subtitle="Each item will be displayed as a separate bullet point"
              />
            )}

            {activeTab === "rolesResponsibilities" && (
              <DynamicPolicyList
                title="Your Roles and Responsibilities"
                icon={Users}
                color="text-[#1b1b1b]"
                fieldName="rolesResponsibilities"
                values={formData.rolesResponsibilities}
                onChange={handleListChange}
                placeholder="Enter a role or responsibility..."
                subtitle="Each item will be displayed as a separate bullet point"
              />
            )}

            {activeTab === "cancellationPolicy" && (
              <DynamicPolicyList
                title="Cancellation Policy"
                icon={Clock}
                color="text-[#1b1b1b]"
                fieldName="cancellationPolicy"
                values={formData.cancellationPolicy}
                onChange={handleListChange}
                placeholder="Enter a cancellation policy rule..."
                subtitle="Each item will be displayed as a separate bullet point"
              />
            )}

            {activeTab === "additionalExpenses" && (
              <DynamicPolicyList
                title="Additional Expenses (Indicative)"
                icon={IndianRupee}
                color="text-[#1b1b1b]"
                fieldName="additionalExpenses"
                values={formData.additionalExpenses}
                onChange={handleListChange}
                placeholder="Enter an indicative additional expense..."
                subtitle="Each item will be displayed as a separate bullet point"
              />
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <DashboardLayout>
      <div className="mb-10">
        <h1 className="text-3xl font-black text-slate-900 leading-tight">
          Policies
        </h1>
        <p className="text-slate-400 font-medium mt-1">
          Manage your default terms and conditions, must haves, and customer
          responsibilities for all itineraries.
        </p>
      </div>

      {renderContent()}
    </DashboardLayout>
  );
};

export default Policies;
