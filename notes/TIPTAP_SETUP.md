# TipTap Installation Instructions

## Install Required Packages

Run the following command in the `frontend` directory:

```bash
npm install @tiptap/react @tiptap/starter-kit @tiptap/extension-image @tiptap/extension-link @tiptap/extension-placeholder
```

## Package Details

- `@tiptap/react` - React integration for TipTap
- `@tiptap/starter-kit` - Essential extensions bundle (heading, bold, italic, lists, etc.)
- `@tiptap/extension-image` - Image support
- `@tiptap/extension-link` - Link support
- `@tiptap/extension-placeholder` - Placeholder text in empty editor

## Usage

The TipTap editor component is located at:

- `frontend/src/components/blog/TipTapEditor.jsx`

Example blog post form using the editor:

- `frontend/src/pages/dashboard/BlogPostForm.jsx`

## Features Implemented

✅ Rich text formatting (bold, italic, headings)
✅ Lists (bullet and numbered)
✅ Blockquotes and code blocks
✅ Image uploads via multipart API
✅ Link insertion
✅ Clean HTML output (sanitized on backend)
✅ URL-only images (no base64 in content)

## API Integration

The editor uploads images to:
`POST /api/blog/images`

With multipart form data:

- `image`: File
- `type`: 'content' | 'featured' | 'og'

Response:

```json
{
  "url": "http://localhost:8000/api/storage/blog/content/xyz.jpg",
  "path": "blog/content/xyz.jpg"
}
```

## Customization

To add more formatting options, install additional TipTap extensions:

- `@tiptap/extension-text-align` - Text alignment
- `@tiptap/extension-table` - Tables
- `@tiptap/extension-highlight` - Text highlighting
- `@tiptap/extension-underline` - Underline

See: https://tiptap.dev/docs/editor/extensions
