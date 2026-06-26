import React, { useState, useRef, useEffect } from "react";
import DashboardLayout from "./DashboardLayout";
import { Copy, Check, ExternalLink, Code, Eye } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { toast } from "react-toastify";

const EmbedSettings = () => {
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const copyTimeoutRef = useRef(null);

  // Cleanup pending timeout on unmount to avoid state-update on unmounted component
  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    };
  }, []);

  const frontendUrl =
    import.meta.env.VITE_FRONTEND_URL || window.location.origin;
  // Prefer the opaque UUID embed_token so the raw DB id is never exposed in embeds.
  // Falls back to id for sessions that pre-date the embed_token migration.
  const embedUrl = `${frontendUrl}/lead-inquiry?agency=${user?.embed_token || user?.id}`;

  const iframeCode = `<iframe
  src="${embedUrl}"
  width="100%"
  height="950px"
  frameborder="0"
  style="border: none; border-radius: 8px;"
  sandbox="allow-forms allow-scripts allow-same-origin allow-popups"
  title="Trip Inquiry Form"
></iframe>`;

  const handleCopy = () => {
    navigator.clipboard.writeText(iframeCode);
    setCopied(true);
    toast.success("Embed code copied to clipboard!");
    if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    copyTimeoutRef.current = setTimeout(() => setCopied(false), 3000);
  };

  const handleOpenPreview = () => {
    window.open(embedUrl, "_blank");
  };

  return (
    <DashboardLayout>
      <div className="p-6 max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            Embed Lead Form
          </h1>
          <p className="text-gray-600">
            Add this form to your website to capture trip inquiries from
            potential customers
          </p>
        </div>

        {/* Form URL Display */}
        <div className="bg-white rounded-xl shadow-md p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <ExternalLink className="w-5 h-5 text-blue-500" />
            <h2 className="text-xl font-bold text-gray-800">
              Your Inquiry Form URL
            </h2>
          </div>
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <div className="flex items-center gap-3">
              <code className="flex-1 text-sm text-gray-700 break-all font-mono">
                {embedUrl}
              </code>
              <button
                onClick={handleOpenPreview}
                className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-all font-semibold text-sm flex items-center gap-2 whitespace-nowrap"
              >
                <Eye className="w-4 h-4" />
                Preview
              </button>
            </div>
          </div>
        </div>

        {/* Embed Code */}
        <div className="bg-white rounded-xl shadow-md p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Code className="w-5 h-5 text-green-500" />
              <h2 className="text-xl font-bold text-gray-800">
                Embed Code (iframe)
              </h2>
            </div>
            <button
              onClick={handleCopy}
              className={`${
                copied ? "bg-green-500" : "bg-blue-500"
              } text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-all font-semibold text-sm flex items-center gap-2`}
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  Copy Code
                </>
              )}
            </button>
          </div>

          <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto">
            <pre className="text-sm text-green-400 font-mono">
              <code>{iframeCode}</code>
            </pre>
          </div>
        </div>

        {/* Instructions */}
        <div className="bg-white rounded-xl shadow-md p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4">How to Embed</h2>
          <div className="space-y-4">
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center font-bold">
                1
              </div>
              <div>
                <h3 className="font-semibold text-gray-800 mb-1">
                  Copy the Embed Code
                </h3>
                <p className="text-gray-600 text-sm">
                  Click the "Copy Code" button above to copy the iframe embed
                  code to your clipboard.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center font-bold">
                2
              </div>
              <div>
                <h3 className="font-semibold text-gray-800 mb-1">
                  Paste into Your Website
                </h3>
                <p className="text-gray-600 text-sm">
                  Paste the code into your website's HTML where you want the
                  form to appear. This works with WordPress, Wix, Squarespace,
                  or any custom website.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center font-bold">
                3
              </div>
              <div>
                <h3 className="font-semibold text-gray-800 mb-1">
                  Start Receiving Inquiries
                </h3>
                <p className="text-gray-600 text-sm">
                  When visitors submit the form, you'll receive an email
                  notification and the inquiry will appear in your{" "}
                  <a
                    href="/lead-inquiries"
                    className="text-blue-600 hover:underline font-semibold"
                  >
                    Lead Inquiries
                  </a>{" "}
                  dashboard.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Platform-Specific Guides */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4">
            Platform-Specific Instructions
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* WordPress */}
            <div className="border border-gray-200 rounded-lg p-4">
              <h3 className="font-bold text-gray-800 mb-2 flex items-center gap-2">
                <span className="text-blue-600">📝</span> WordPress
              </h3>
              <ol className="text-sm text-gray-600 space-y-1 list-decimal list-inside">
                <li>Edit your page or create a new one</li>
                <li>Switch to "HTML" or "Code" view</li>
                <li>Paste the embed code</li>
                <li>Save and publish</li>
              </ol>
            </div>

            {/* Wix */}
            <div className="border border-gray-200 rounded-lg p-4">
              <h3 className="font-bold text-gray-800 mb-2 flex items-center gap-2">
                <span className="text-purple-600">🎨</span> Wix
              </h3>
              <ol className="text-sm text-gray-600 space-y-1 list-decimal list-inside">
                <li>Click "Add" → "Embed" → "Custom Code"</li>
                <li>Select "Iframe"</li>
                <li>Paste the embed code</li>
                <li>Adjust size and position</li>
              </ol>
            </div>

            {/* Squarespace */}
            <div className="border border-gray-200 rounded-lg p-4">
              <h3 className="font-bold text-gray-800 mb-2 flex items-center gap-2">
                <span className="text-orange-600">⬛</span> Squarespace
              </h3>
              <ol className="text-sm text-gray-600 space-y-1 list-decimal list-inside">
                <li>Edit your page</li>
                <li>Add a "Code" block</li>
                <li>Paste the embed code</li>
                <li>Click "Apply"</li>
              </ol>
            </div>

            {/* Custom HTML */}
            <div className="border border-gray-200 rounded-lg p-4">
              <h3 className="font-bold text-gray-800 mb-2 flex items-center gap-2">
                <span className="text-green-600">💻</span> Custom HTML
              </h3>
              <ol className="text-sm text-gray-600 space-y-1 list-decimal list-inside">
                <li>Open your HTML file</li>
                <li>Find where you want the form</li>
                <li>Paste the embed code</li>
                <li>Save and upload</li>
              </ol>
            </div>
          </div>
        </div>

        {/* Preview Section */}
        {showPreview && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
              <div className="flex items-center justify-between p-4 border-b border-gray-200">
                <h3 className="text-lg font-bold text-gray-800">
                  Form Preview
                </h3>
                <button
                  onClick={() => setShowPreview(false)}
                  className="text-gray-500 hover:text-gray-700 text-2xl"
                >
                  ×
                </button>
              </div>
              <div className="flex-1 overflow-auto">
                <iframe
                  src={embedUrl}
                  className="w-full h-full"
                  style={{ minHeight: "600px" }}
                  frameBorder="0"
                  title="Form Preview"
                />
              </div>
            </div>
          </div>
        )}

        {/* Tips */}
        <div className="mt-6 bg-blue-50 border-l-4 border-blue-500 rounded-lg p-6">
          <h3 className="font-bold text-blue-900 mb-2 flex items-center gap-2">
            💡 Pro Tips
          </h3>
          <ul className="text-sm text-blue-800 space-y-2 list-disc list-inside">
            <li>
              Place the form on a dedicated "Request a Quote" or "Plan Your
              Trip" page
            </li>
            <li>
              Adjust the iframe height if needed (change "950px" to your
              preferred height)
            </li>
            <li>
              Make sure to respond to inquiries within 24 hours for best
              conversion rates
            </li>
            <li>
              The form is mobile-responsive and will adapt to any screen size
            </li>
            <li>
              All submissions are rate-limited to prevent spam (5 per hour per
              IP)
            </li>
          </ul>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default EmbedSettings;
