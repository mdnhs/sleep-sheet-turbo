import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { api } from "../api-client.js";
import { text } from "../util.js";

export function registerBlogTools(server: McpServer) {
  server.registerTool(
    "list_blog_posts",
    {
      title: "List blog posts",
      description: "List blog posts on the store, newest first. Optionally filter by search text.",
      inputSchema: {
        search: z.string().optional().describe("Search title/summary"),
        page: z.number().int().min(1).optional(),
      },
    },
    async ({ search, page }) => {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (page) params.set("page", String(page));
      const data = await api.get(`/blog?${params.toString()}`);
      return text(data);
    }
  );

  server.registerTool(
    "get_blog_post",
    {
      title: "Get a blog post",
      description: "Fetch one blog post by its slug (or id).",
      inputSchema: { slug: z.string() },
    },
    async ({ slug }) => {
      const data = await api.get(`/blog/${encodeURIComponent(slug)}`);
      return text(data);
    }
  );

  server.registerTool(
    "create_blog_post",
    {
      title: "Create a blog post",
      description:
        "Create a new blog post. `slug` must be unique and URL-safe (lowercase, hyphens). Set isPublished:true to publish immediately, or false to save as a draft.",
      inputSchema: {
        title: z.string().min(1),
        slug: z.string().min(1),
        summary: z.string().optional(),
        content: z.string().min(1).describe("Full post body. Markdown/HTML as the site's editor expects."),
        coverImage: z.string().url().optional(),
        isPublished: z.boolean().default(false),
      },
    },
    async (input) => {
      const data = await api.post("/blog", input);
      return text(data);
    }
  );

  server.registerTool(
    "update_blog_post",
    {
      title: "Update a blog post",
      description: "Replace an existing blog post's content by id. All fields are required (this mirrors the site's edit form) — fetch the post first with get_blog_post if you only want to change one field.",
      inputSchema: {
        id: z.string(),
        title: z.string().min(1),
        slug: z.string().min(1),
        summary: z.string().optional(),
        content: z.string().min(1),
        coverImage: z.string().url().optional(),
        isPublished: z.boolean(),
      },
    },
    async ({ id, ...body }) => {
      const data = await api.put(`/blog/${id}`, body);
      return text(data);
    }
  );

  server.registerTool(
    "set_blog_post_published",
    {
      title: "Publish or unpublish a blog post",
      description: "Toggle a blog post's published status without touching its content.",
      inputSchema: { id: z.string(), isPublished: z.boolean() },
    },
    async ({ id, isPublished }) => {
      const data = await api.patch(`/blog/${id}/publish`, { isPublished });
      return text(data);
    }
  );

  const IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif"] as const;

  server.registerTool(
    "upload_blog_image",
    {
      title: "Upload a blog image",
      description:
        "Upload an image to the store's Cloudinary (blog folder) and get back its hosted URL — use it as a blog post's coverImage or inside post content. Pass the file as base64 (a data: URL is fine). JPEG/PNG/WebP/AVIF/GIF, max 5MB. Requires blog write permission.",
      inputSchema: {
        imageBase64: z.string().min(1).describe("Base64 file contents, or a data:image/...;base64, URL"),
        mimeType: z.enum(IMAGE_MIME_TYPES).optional().describe("Defaults to the data: URL's type, else image/jpeg"),
        filename: z.string().optional(),
      },
    },
    async ({ imageBase64, mimeType, filename }) => {
      const match = /^data:([^;]+);base64,([\s\S]*)$/.exec(imageBase64.trim());
      const type = mimeType ?? match?.[1] ?? "image/jpeg";
      const bytes = Buffer.from(match ? match[2] : imageBase64.trim(), "base64");
      if (bytes.length === 0) throw new Error("Image data is empty or not valid base64");
      const ext = type.split("/")[1] === "jpeg" ? "jpg" : type.split("/")[1];
      const form = new FormData();
      form.append("image", new Blob([bytes], { type }), filename ?? `image.${ext}`);
      const data = await api.upload("/blog/upload-image", form);
      return text(data);
    }
  );
}
