# Category photos

Bundled photos for the category cards. The home page cards show the catalog categories from the database; a card
uses, in this order:

1. the photo staff set on the category (`image_url`, the "Image URL" field in /admin/categories);
2. a file in this folder named after the category's slug (e.g. `cat-litter.jpg`, `dry-dog-food.webp`); the slugs are
   in /admin/categories (`dry-cat-food`, `dry-dog-food`, `cat-wet-food`, `dog-wet-food`, `cat-treats`, `dog-treats`,
   `cat-litter`, `beds`, `grooming`, `cat-scratchers`, `rodents`, `birds`, `plastics`, `collars-leashes`, `equipment`);
3. a dark card with an icon.

The article pages' related categories (the marketing slugs `dog-food`, `cat-food`, `wet-food`, `litter`,
`small-animals`, `birds`) read this folder too.

- Formats: `.jpg`, `.jpeg`, `.png`, `.webp`. Landscape (4:3) photos at least 800px wide work best.
- The photos are decorative, so they have no alt text. Don't put text inside them.
