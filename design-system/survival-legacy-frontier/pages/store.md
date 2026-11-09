# Store — Page Override

Read `../MASTER.md` first. This file only documents Store-specific rules.

## Objective
Help a player understand what a package includes, how much it costs, what details are required, and how the manual payment and delivery flow works.

## Structure
1. Store hero with clear purpose and no false urgency.
2. Product catalogue grouped by useful categories.
3. Product details: name, IDR price, permanent/subscription distinction, benefits, and limitations.
4. Checkout form with visible labels and clear platform-specific Minecraft name rules.
5. Explicit payment steps: checkout → WhatsApp contact / payment instructions → admin verifies actual incoming DANA transaction → manual delivery → completion.
6. Help/ticket and review information.

## Visual and interaction rules
- Continue the SLF dark theme and cyan primary action; do not restyle the Store as a generic light e-commerce template.
- Product price must be easy to scan. Use tabular figures.
- Distinguish permanent rank from subscription benefit clearly; do not hide expiry conditions.
- Keep one primary checkout action per step. Show a stable order summary before submitting.
- Invalid, loading, success, and error states must be visible and associated with the relevant control.
- Never tell a buyer their payment is verified based only on a screenshot; verification is an Admin action after checking the actual transaction.
- Don't invent stock, timers, discounts, user counts, testimonials, or urgency.
- Don't clear user-entered checkout data on a recoverable API/network error.
- Test narrow mobile widths first; avoid horizontal overflow in product cards, order summaries, and tables.
