import prisma from "@/lib/prisma";

// Port of the blog domain: BlogPost / BlogCategory / BlogTag models plus the
// Admin\Blog* controllers and the public Api\BlogController. Blog content is
// scoped by team_id; the super admin owns the "agency" blog team.

const STOP_WORDS = new Set([
  "a", "an", "the", "in", "on", "at", "by", "of", "for", "with", "about",
  "to", "from", "is", "are", "was", "were", "and", "but", "or", "nor",
]);

/** Laravel Str::slug equivalent: lowercase, ASCII-ish, hyphen-separated. */
export function strSlug(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/** Post slug: Str::slug + stop-word stripping (kept if title is very short). */
function postBaseSlug(title) {
  const slug = strSlug(title);
  const words = slug.split("-").filter(Boolean);
  const filtered = words.filter((w) => !STOP_WORDS.has(w) || words.length <= 3);
  return filtered.length ? filtered.join("-") : slug;
}

async function uniqueSlug(model, base, teamId, excludeId) {
  let finalSlug = base || "post";
  let counter = 1;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const clash = await prisma[model].findFirst({
      where: { teamId, slug: finalSlug, ...(excludeId ? { id: { not: excludeId } } : {}) },
      select: { id: true },
    });
    if (!clash) return finalSlug;
    finalSlug = `${base}-${counter}`;
    counter += 1;
  }
}

export const generatePostSlug = (title, teamId, excludeId) =>
  uniqueSlug("blogPost", postBaseSlug(title), teamId, excludeId);
export const generateCategorySlug = (name, teamId, excludeId) =>
  uniqueSlug("blogCategory", strSlug(name), teamId, excludeId);
export const generateTagSlug = (name, teamId, excludeId) =>
  uniqueSlug("blogTag", strSlug(name), teamId, excludeId);

export function calculateReadingTime(html) {
  const text = String(html || "").replace(/<[^>]*>/g, " ");
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 200));
}

/** Find-or-create a Team to own this user's blog content (lazy, like Laravel). */
export async function resolveBlogTeamId(user) {
  if (user.role === "super_admin") {
    const agency = await prisma.team.findFirst({ where: { slug: "agency" } });
    if (agency) return agency.id;
    const owned = await prisma.team.findFirst({ where: { ownerId: user.id } });
    if (owned) return owned.id;
    const created = await prisma.team.create({
      data: { name: `${user.name} Blog`, slug: "agency", ownerId: user.id },
    });
    return created.id;
  }

  const team = await prisma.team.findFirst({ where: { ownerId: user.id } });
  if (team) return team.id;
  const created = await prisma.team.create({
    data: { name: user.name, slug: await uniqueTeamSlug(user.name), ownerId: user.id },
  });
  return created.id;
}

async function uniqueTeamSlug(name) {
  const base = strSlug(name) || "team";
  let slug = base;
  let counter = 1;
  // eslint-disable-next-line no-constant-condition
  while (await prisma.team.findFirst({ where: { slug }, select: { id: true } })) {
    slug = `${base}-${counter}`;
    counter += 1;
  }
  return slug;
}

/** Team ids that hold public blog content (super admin's teams + "agency"). */
export async function getBlogTeamIds() {
  const ids = new Set();
  const superAdmin = await prisma.user.findFirst({ where: { role: "super_admin" } });
  if (superAdmin) {
    const teams = await prisma.team.findMany({ where: { ownerId: superAdmin.id }, select: { id: true } });
    teams.forEach((t) => ids.add(t.id));
  }
  const agency = await prisma.team.findFirst({ where: { slug: "agency" }, select: { id: true } });
  if (agency) ids.add(agency.id);
  return ids.size ? [...ids] : [1];
}

export async function findOrCreateTags(tagNames, teamId) {
  const ids = [];
  for (const name of tagNames) {
    const slug = strSlug(name);
    const existing = await prisma.blogTag.findFirst({ where: { teamId, slug } });
    const tag = existing || (await prisma.blogTag.create({ data: { teamId, name, slug } }));
    ids.push(tag.id);
  }
  return ids;
}

function imageUrl(value) {
  if (!value) return null;
  return String(value); // stored as a full URL / data URL in this port
}

export function serializePost(post) {
  const featuredUrl = imageUrl(post.featuredImage);
  const ogUrl = imageUrl(post.ogImage) || featuredUrl;
  return {
    id: post.id,
    team_id: post.teamId,
    author_id: post.authorId,
    blog_category_id: post.blogCategoryId,
    title: post.title,
    slug: post.slug,
    excerpt: post.excerpt,
    content: post.content,
    featured_image: post.featuredImage,
    featured_image_url: featuredUrl,
    og_image: post.ogImage,
    og_image_url: ogUrl,
    status: post.status,
    published_at: post.publishedAt ? post.publishedAt.toISOString() : null,
    author_name: post.authorName,
    meta_title: post.metaTitle,
    meta_description: post.metaDescription,
    views_count: post.viewsCount,
    read_time_minutes: post.readTimeMinutes,
    reading_time: post.readTimeMinutes || calculateReadingTime(post.content),
    created_at: post.createdAt ? post.createdAt.toISOString() : null,
    updated_at: post.updatedAt ? post.updatedAt.toISOString() : null,
    category: post.category ? serializeCategory(post.category) : null,
    tags: (post.tags || []).map((pt) => serializeTag(pt.tag || pt)),
    author: post.author ? { id: post.author.id, name: post.author.name, email: post.author.email } : null,
  };
}

export function serializeCategory(category) {
  return {
    id: category.id,
    team_id: category.teamId,
    name: category.name,
    slug: category.slug,
    description: category.description,
    display_order: category.displayOrder,
    is_active: category.isActive,
    posts_count: category._count?.posts,
    created_at: category.createdAt ? category.createdAt.toISOString() : null,
    updated_at: category.updatedAt ? category.updatedAt.toISOString() : null,
  };
}

export function serializeTag(tag) {
  return {
    id: tag.id,
    team_id: tag.teamId,
    name: tag.name,
    slug: tag.slug,
    posts_count: tag._count?.posts,
  };
}

export const POST_INCLUDE = {
  category: true,
  tags: { include: { tag: true } },
  author: { select: { id: true, name: true, email: true } },
};
