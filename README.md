# MyRecipeFolder 🍳

A cross-platform recipe management app built with **React Native + Expo**. Save, search, and scan recipes — including handwritten ones in Hebrew or any language — powered by Gemini AI, with cloud sync via Supabase.

**Live:** [myrecipefolder.vercel.app](https://myrecipefolder.vercel.app)

---

## Features

- **Authentication** — Secure login with Supabase Auth; session persisted on device
- **Recipe Library** — Store recipes with title, category, ingredients (quantity + unit + name), steps, servings, prep/cook time, and favorite flag
- **Cloud Sync** — All data stored in Supabase (PostgreSQL) with Row Level Security; recipes are private per user and sync across all devices automatically
- **Search** — Live search across title, category, and ingredient names with category filter chips
- **AI Recipe Scanning** — Photograph a handwritten or printed recipe (up to 3 photos per recipe, e.g. multiple pages); Gemini 2.5 Flash reads the images directly and extracts structured ingredients and steps
- **Multi-language Scanning** — Scan recipes in Hebrew, English, Arabic, French, and more; optionally translate the output to any language
- **Crop Tool** — Crop the photo before sending to AI for better recognition accuracy
- **Favorites** — Mark recipes as favorites for quick access
- **Dark / Light theme** — Follows system preference

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React Native + Expo SDK 54 |
| Navigation | React Navigation 7 (stack + bottom tabs) |
| Database | Supabase (PostgreSQL + Row Level Security) |
| Authentication | Supabase Auth (email + password) |
| AI scanning | Google Gemini 2.5 Flash (multimodal vision) |
| Image handling | expo-image-picker + expo-image-manipulator |
| Session storage | expo-secure-store (native) / localStorage (web) |
| Web deployment | Vercel (auto-deploy on push to `main`) |
| Language | TypeScript |

---

## Getting Started

### Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) project (free tier)
- A [Google AI Studio](https://aistudio.google.com) API key
- Expo Go app on your phone **or** a web browser

### Installation

```bash
git clone https://github.com/TomerMeidan/MyRecipeFolder.git
cd MyRecipeFolder
npm install
```

### Environment Variables

Copy `.env.example` to `.env` and fill in your keys:

```bash
cp .env.example .env
```

| Variable | Where to get it |
|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | Supabase project → Settings → API → Project URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Supabase project → Settings → API → Publishable key |
| `EXPO_PUBLIC_GEMINI_API_KEY` | [aistudio.google.com](https://aistudio.google.com) |
| `EXPO_PUBLIC_GOOGLE_API_KEY` | [console.cloud.google.com](https://console.cloud.google.com) — enable Cloud Vision API + Cloud Translation API |

### Supabase Setup

1. Create a project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor → New query**, paste the contents of `scripts/supabase-schema.sql`, and click **Run**
3. Go to **Authentication → Users → Add user** and create your account
4. Copy the Project URL and publishable key into `.env`

### Running the App

```bash
# Web browser
npm run web

# Android / iOS via Expo Go
npx expo start
# Scan the QR code with Expo Go
```

---

## Project Structure

```
src/
├── auth/              # AuthContext — Supabase Auth session management
├── components/        # Reusable UI (RecipeCard)
├── db/                # recipeRepository (Supabase CRUD operations)
├── lib/               # supabase.ts — Supabase client singleton
├── navigation/        # React Navigation stack + tab config + auth gate
├── screens/           # HomeScreen, SearchScreen, RecipeDetailScreen,
│                      # AddEditRecipeScreen, ScanRecipeScreen, LoginScreen
├── theme/             # ThemeContext (light / dark)
├── types/             # TypeScript interfaces (Recipe, Ingredient, etc.)
└── utils/             # aiParser (Gemini), recipeParser, recipe helpers
scripts/
├── supabase-schema.sql  # Database schema + RLS policies
└── test-ai-parser.mjs   # Integration test for AI scanning models
```

---

## Recipe Scanning

The Scan tab uses **Gemini 2.5 Flash** to read recipe images directly from the camera or photo library:

1. Take a photo or upload an image (native crop UI available during selection)
2. Optionally add up to 2 more photos (e.g. additional pages) using the thumbnail strip — all images are sent together and merged into one recipe
3. Optionally crop any photo using the **✂️ Crop Photo** overlay (tap a thumbnail to select it first)
4. Select the source language (optional hint for better handwriting recognition)
5. Choose an output language (optional translation)
6. Tap **Analyze Recipe** — Gemini reads all selected images together and returns structured JSON
7. Review and edit the extracted recipe before saving

Images are automatically resized to max 1024px and compressed to 70% quality before sending to the API.

---

## Database Schema

Three tables with Row Level Security — each user sees only their own data:

| Table | Key columns |
|---|---|
| `recipes` | id, user_id, title, category, servings, prep_time, cook_time, is_favorite, photo_uri, created_at, updated_at |
| `ingredients` | id, recipe_id → recipes(id), name, quantity, unit |
| `steps` | recipe_id → recipes(id), order_num, instruction |

---

## Deployment

The web version deploys automatically to **Vercel** on every push to `main`.

To deploy your own instance:

1. Fork this repo
2. Import it at [vercel.com/new](https://vercel.com/new)
3. Add all four environment variables in the Vercel dashboard → Settings → Environment Variables
4. Deploy

The `vercel.json` config is already included — no additional build configuration needed.

---

## License

MIT
