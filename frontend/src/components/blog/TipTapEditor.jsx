import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { useState } from "react";

const TipTapEditor = ({ content, onChange }) => {
  const [uploading, setUploading] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3, 4],
        },
        bulletList: {
          keepMarks: true,
          keepAttributes: false,
        },
        orderedList: {
          keepMarks: true,
          keepAttributes: false,
        },
        dropcursor: false,
      }),
      Image.configure({
        inline: true,
        allowBase64: false,
      }),
      Link.configure({
        openOnClick: false,
        protocols: ["http", "https"],
      }),
      Placeholder.configure({
        placeholder: "Write your blog post content here...",
      }),
    ],
    content: content || "",
    editorProps: {
      attributes: {
        class:
          "prose prose-sm sm:prose-base lg:prose-lg xl:prose-xl max-w-none px-6 py-4 min-h-[400px] focus:outline-none dark:prose-invert",
      },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  const handleImageUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append("image", file);
    formData.append("type", "content");

    try {
      const token = localStorage.getItem("token");
      const response = await fetch(
        `${import.meta.env.VITE_API_URL || "http://localhost:8000/api"}/super-admin/blog/images`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        },
      );

      if (!response.ok) {
        throw new Error("Image upload failed");
      }

      const data = await response.json();

      // Ensure the editor has focus before inserting the image
      // If the cursor wasn't in the field, it will append at the end of the content
      if (!editor.isFocused) {
        editor.chain().focus().run();
      }

      editor.chain().focus().setImage({ src: data.url }).run();
    } catch (error) {
      console.error("Image upload error:", error);
      alert("Image upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  if (!editor) {
    return <div>Loading editor...</div>;
  }

  return (
    <div className="rounded-lg overflow-hidden border">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-2 p-3 border-b bg-gray-50">
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`px-3 py-1.5 rounded text-sm font-medium transition ${
            editor.isActive("bold")
              ? "bg-blue-500 text-white"
              : "bg-white text-gray-700 hover:bg-gray-100 border"
          }`}
        >
          <strong>B</strong>
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`px-3 py-1.5 rounded text-sm font-medium transition ${
            editor.isActive("italic")
              ? "bg-blue-500 text-white"
              : "bg-white text-gray-700 hover:bg-gray-100 border"
          }`}
        >
          <em>I</em>
        </button>

        <button
          type="button"
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 2 }).run()
          }
          className={`px-3 py-1.5 rounded text-sm font-medium transition ${
            editor.isActive("heading", { level: 2 })
              ? "bg-blue-500 text-white"
              : "bg-white text-gray-700 hover:bg-gray-100 border"
          }`}
        >
          H2
        </button>

        <button
          type="button"
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 3 }).run()
          }
          className={`px-3 py-1.5 rounded text-sm font-medium transition ${
            editor.isActive("heading", { level: 3 })
              ? "bg-blue-500 text-white"
              : "bg-white text-gray-700 hover:bg-gray-100 border"
          }`}
        >
          H3
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`px-3 py-1.5 rounded text-sm font-medium transition ${
            editor.isActive("bulletList")
              ? "bg-blue-500 text-white"
              : "bg-white text-gray-700 hover:bg-gray-100 border"
          }`}
        >
          • List
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={`px-3 py-1.5 rounded text-sm font-medium transition ${
            editor.isActive("orderedList")
              ? "bg-blue-500 text-white"
              : "bg-white text-gray-700 hover:bg-gray-100 border"
          }`}
        >
          1. List
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className={`px-3 py-1.5 rounded text-sm font-medium transition ${
            editor.isActive("blockquote")
              ? "bg-blue-500 text-white"
              : "bg-white text-gray-700 hover:bg-gray-100 border"
          }`}
        >
          Quote
        </button>

        <div className="border-l mx-2"></div>

        {/* Image Upload */}
        <label
          className={`px-3 py-1.5 rounded text-sm font-medium cursor-pointer transition ${
            uploading
              ? "bg-gray-300 text-gray-500 cursor-not-allowed"
              : "bg-green-500 text-white hover:bg-green-600"
          }`}
        >
          {uploading ? "Uploading..." : "📷 Image (JPG/JPEG/PNG/WebP)"}
          <input
            type="file"
            accept=".jpg,.jpeg,.png,.webp"
            onChange={handleImageUpload}
            className="hidden"
            disabled={uploading}
          />
        </label>

        <button
          type="button"
          onClick={() => {
            const url = window.prompt("Enter URL:");
            if (url) {
              editor.chain().focus().setLink({ href: url }).run();
            }
          }}
          className={`px-3 py-1.5 rounded text-sm font-medium transition ${
            editor.isActive("link")
              ? "bg-blue-500 text-white"
              : "bg-white text-gray-700 hover:bg-gray-100 border"
          }`}
        >
          🔗 Link
        </button>
      </div>

      {/* Editor Content */}
      <EditorContent editor={editor} />
    </div>
  );
};

export default TipTapEditor;
