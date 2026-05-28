# MyRecipeFolder 🍳

A cross-platform recipe management app built with **React Native + Expo**. Save, search, and scan recipes — including handwritten ones in Hebrew or any language — powered by Gemini AI.

---

## Features

- **Recipe Library** — Store recipes with ingredients, steps, servings, prep/cook time, and category
- **Search** — Live search across title, category, and ingredient names
- **AI Recipe Scanning** — Photograph a handwritten or printed recipe; Gemini 2.5 Flash extracts the ingredients and steps directly from the image
- **Multi-language** — Scan recipes in Hebrew, English, Arabic, French, and more; optionally translate the output
- **Favorites** — Mark recipes as favorites for quick access
- **Dark / Light theme** — Follows system preference
- **Offline-first** — All data stored locally on-device with SQLite

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React Native + Expo SDK 54 |
| Navigation | React Navigation 7 (stack + bottom tabs) |
| Local database | expo-sqlite (SQLite) |
| AI scanning | Google Gemini 2.5 Flash (multimodal) |
| Image handling | expo-image-picker + expo-image-manipulator |
| Web deployment | Vercel |
| Language | TypeScript |

---

## Getting Started

### Prerequisites

- Node.js 18+
- Expo Go app on your phone (iOS or Android) **or** a web browser

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
| `EXPO_PUBLIC_GEMINI_API_KEY` | [aistudio.google.com](https://aistudio.google.com) |
| `EXPO_PUBLIC_GOOGLE_API_KEY` | [console.cloud.google.com](https://console.cloud.google.com) — enable Cloud Vision API + Cloud Translation API |

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
├── components/        # Reusable UI components (RecipeCard)
├── db/                # SQLite schema, migrations, repository, DatabaseProvider
├── navigation/        # React Navigation stack + tab configuration
├── screens/           # HomeScreen, SearchScreen, RecipeDetailScreen,
│                      # AddEditRecipeScreen, ScanRecipeScreen
├── theme/             # ThemeContext (light / dark)
├── types/             # TypeScript interfaces (Recipe, Ingredient, etc.)
└── utils/             # aiParser, recipeParser, ocr, translate, recipe helpers
scripts/
└── test-ai-parser.mjs # Integration test for AI scanning
```

---

## Recipe Scanning

The Scan tab uses **Gemini 2.5 Flash** to read recipe images directly:

1. Take a photo or upload an image
2. Select the source language (optional hint for better handwriting recognition)
3. Choose an output language (optional translation)
4. Gemini extracts title, ingredients with quantities/units, and numbered steps
5. Review and edit before saving

Images are automatically resized to 1024px and compressed before sending to keep API costs minimal.

---

## Deployment

The web version is deployed on **Vercel**. Every push to `main` triggers an automatic redeploy.

To deploy your own instance:

1. Fork this repo
2. Import it at [vercel.com/new](https://vercel.com/new)
3. Add `EXPO_PUBLIC_GEMINI_API_KEY` and `EXPO_PUBLIC_GOOGLE_API_KEY` as environment variables in the Vercel dashboard
4. Deploy

---

## License

MIT
