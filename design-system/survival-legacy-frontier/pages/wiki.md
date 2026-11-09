# Wiki — Page Override

Read `../MASTER.md` first. This file documents the Wiki library and article-reading experience.

## Objective
Make rules and gameplay information easy to find, understand, and revisit, especially on a phone.

## Structure
1. Search visible near the top of the library.
2. Books/categories with meaningful names and article counts.
3. Article list with title and useful summary.
4. Reader view with breadcrumb, clear title, summary, structured headings, lists, callouts, related reading, and back navigation.

## Visual rules
- Maintain the SLF library theme. The cream/paper reader surface is an intentional editorial exception, not a global theme.
- Body copy should be comfortable for long reading, with a restrained line length and generous line-height.
- Keep article metadata secondary to the article title.
- Don't let icon decoration compete with titles.
- Preserve the same nav and back behavior across library, search, category, and reader states.

## Content and interaction
- Search title, summary, and content; clearly show no-results and API-error states.
- Draft content must never appear in the public library.
- Reader navigation must not break if an article is first/last or missing a legacy URL.
- Use headings/list semantics; do not render raw HTML supplied as article text.
- Links must be keyboard reachable and visibly identifiable.
- Preserve the current article when editing; do not require recreating an article to change its body.
- Test long Indonesian titles, long Minecraft usernames/URLs, empty categories, and narrow mobile widths.
