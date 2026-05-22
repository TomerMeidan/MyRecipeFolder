import { Ingredient, RecipeStep, RecipeCategory } from '../types';
import { createIngredient, createStep } from './recipe';

// ── Section header patterns (English + Hebrew) ────────────────────────────────

const H_INGREDIENT: RegExp[] = [
  // English
  /^ingredients?[\s:]*$/i,
  /^ingredient list[\s:]*$/i,
  /^what you(['']?ll| will)? need[\s:]*$/i,
  /^you(['']?ll| will)? need[\s:]*$/i,
  /^shopping list[\s:]*$/i,
  /^grocery list[\s:]*$/i,
  /^items? (needed|required)[\s:]*$/i,
  /^supplies[\s:]*$/i,
  // Hebrew — מצרכים, רכיבים, חומרים, מה שצריך, רשימת קניות…
  /^מצרכים[\s:]*$/,
  /^רכיבים[\s:]*$/,
  /^חומרים[\s:]*$/,
  /^רשימת מצרכים[\s:]*$/,
  /^רשימת קניות[\s:]*$/,
  /^מה ש?צריך[\s:]*$/,
  /^מה נצטרך[\s:]*$/,
  /^דרושים[\s:]*$/,
  /^נדרש[\s:]*$/,
];

const H_STEPS: RegExp[] = [
  // English
  /^instructions?[\s:]*$/i,
  /^instruction list[\s:]*$/i,
  /^directions?[\s:]*$/i,
  /^method[\s:]*$/i,
  /^steps?[\s:]*$/i,
  /^preparation|prep( work)?[\s:]*$/i,
  /^procedure[\s:]*$/i,
  /^how to (make|prepare|cook|bake|grill|fry|assemble)[\s:]*$/i,
  /^to (make|prepare|cook|bake|assemble)[\s:]*$/i,
  /^(cooking|baking|grilling) (instructions?|method|directions?)[\s:]*$/i,
  /^let['']?s (cook|make|bake|prepare)[\s:]*$/i,
  // Hebrew — אופן ההכנה, הוראות הכנה, הכנה, שלבים…
  /^אופן ה?הכנה[\s:]*$/,
  /^הוראות ה?הכנה[\s:]*$/,
  /^הוראות[\s:]*$/,
  /^הכנה[\s:]*$/,
  /^שלבי? ה?הכנה[\s:]*$/,
  /^שלבים[\s:]*$/,
  /^דרך ה?הכנה[\s:]*$/,
  /^שיטת הכנה[\s:]*$/,
  /^כיצד מכינים[\s:]*$/,
  /^הכנת המנה[\s:]*$/,
  /^בישול[\s:]*$/,
  /^אפייה[\s:]*$/,
  /^הכנת הבצק[\s:]*$/,
];

// Appended to steps as continuation sections
const H_STEPS_EXTRA: RegExp[] = [
  // English
  /^how to serve[\s:]*$/i,
  /^(serving suggestions?|serving notes?)[\s:]*$/i,
  /^(to serve|for serving)[\s:]*$/i,
  /^servings?[\s:]*$/i,
  /^presentation[\s:]*$/i,
  /^plating[\s:]*$/i,
  /^garnish[\s:]*$/i,
  /^(tips?( and tricks?)?|tricks?)[\s:]*$/i,
  /^(chef['']?s? (tips?|notes?))[\s:]*$/i,
  /^(notes?( and tips?)?)[\s:]*$/i,
  /^(cook['']?s? notes?)[\s:]*$/i,
  /^(storage( instructions?| tips?)?)[\s:]*$/i,
  /^(make.ahead( instructions?| tips?)?)[\s:]*$/i,
  /^(freezing instructions?)[\s:]*$/i,
  /^(reheating instructions?)[\s:]*$/i,
  /^(leftovers?( instructions?)?)[\s:]*$/i,
  // Hebrew — אופן הגשה, הגשה, טיפים, הערות, אחסון…
  /^אופן ה?הגשה[\s:]*$/,
  /^הגשה[\s:]*$/,
  /^הגשה ועיצוב[\s:]*$/,
  /^עיצוב והגשה[\s:]*$/,
  /^קישוט[\s:]*$/,
  /^גרניש[\s:]*$/,
  /^טיפים[\s:]*$/,
  /^טיפים ורעיונות[\s:]*$/,
  /^הערות[\s:]*$/,
  /^הערות וטיפים[\s:]*$/,
  /^הערת שף[\s:]*$/,
  /^אחסון[\s:]*$/,
  /^שמירה[\s:]*$/,
  /^הקפאה[\s:]*$/,
  /^חימום מחדש[\s:]*$/,
  /^הכנה מראש[\s:]*$/,
  /^שאריות[\s:]*$/,
];

// Sub-group headers: "For the sauce:" / "לרוטב:" / "לבצק:"
const H_INGREDIENT_GROUP =
  /^(for (the |this )?[a-z][a-z\s]{1,30}|[a-z][a-z\s]{1,20}:|ל[א-ת\s]{1,20}:)$/i;

// ── Line-level patterns ───────────────────────────────────────────────────────

const BULLET = /^[-–—•·*✓▪►>○●◦]\s*/;
const NUMBERED = /^\d+[.)]\s*/;
const STEP_NUM = /^(step\s*)?\d+[.):]?\s*/i;

// English + Hebrew measurement units
const UNITS = new RegExp(
  '\\b(' +
  // English
  'cups?|tbsps?|tablespoons?|tsps?|teaspoons?|oz|ounces?|lbs?|pounds?|' +
  'g|grams?|kg|kilograms?|ml|millilitres?|milliliters?|l|litres?|liters?|' +
  'fl\\.? ?oz|pints?|quarts?|gallons?|pinch(?:es)?|dash(?:es)?|cloves?|' +
  'slices?|pieces?|cans?|tins?|bunches?|handfuls?|packages?|pkgs?|' +
  'sticks?|sheets?|heads?|sprigs?|stalks?|ears?|ribs?|fillets?|' +
  'breasts?|thighs?|legs?|whole|large|medium|small|heaped?|' +
  // Hebrew
  'כוסות?|כוס|כפות?|כף|כפיות?|כפית|גרם|גר\'|ק"ג|קילוגרם|' +
  'מ"ל|מיליליטר|ליטר|יחידות?|שיניים|שן|פרוסות?|פרוסה|' +
  'קורט|חבילות?|חבילה|פחיות?|פחית|צרורות?|צרור|עלים|עלה|' +
  'ענפים|ענף|כפות גדולות?|כפית קטנה|מעט|קצת' +
  ')\\b',
  'i',
);

const STARTS_WITH_QUANTITY = /^[(]?[\d½⅓⅔¼¾⅛⅜⅝⅞][\d\s./\-–½⅓⅔¼¾⅛⅜⅝⅞]*/;

// Hebrew "to taste" equivalents
const TO_TASTE_HE = /לפי ה?טעם|לפי הצורך|לפי הצורך|לפי הרצון|לפי הטעם האישי/;
const TO_TASTE = /to taste|as needed|as required/i;

// English action verbs (imperative/base form)
const ACTION_VERBS_EN = /^(add|mix|stir|pour|heat|cook|bake|fry|boil|simmer|chop|dice|mince|slice|peel|wash|drain|combine|place|put|remove|take|let|allow|cover|transfer|season|garnish|serve|whisk|fold|beat|cream|knead|roll|cut|grill|roast|sauté|saute|blend|process|strain|cool|refrigerate|freeze|preheat|prepare|make|bring|reduce|increase|lower|raise|check|test|taste|adjust|sprinkle|top|finish|assemble|layer|spread|coat|brush|drizzle|squeeze|grate|shred|tear|set|leave|rest|dust|grease|line|chill|warm|thaw|soak|marinate|infuse|steep|whip|melt|soften|caramelise|caramelize|deglaze|render|sear)\b/i;

// Hebrew action verbs — conjugated third-person plural present (recipe imperative)
const ACTION_VERBS_HE = /^(מחממים|מוסיפים|מערבבים|מטגנים|אופים|מבשלים|חותכים|קולפים|שוטפים|שמים|מניחים|מכינים|יוצקים|מסננים|משמנים|מפזרים|מגלגלים|מחלקים|בוחשים|מגישים|מקשטים|מוציאים|פורשים|מקפלים|טוחנים|מגררים|קוצצים|מביאים|מנמיכים|מגבירים|מכסים|מעבירים|מתבלים|מצננים|מקררים|מקפיאים|מחלצים|מרוקנים|מרפדים|מושחים|ממיסים|מרככים|שופכים|מרתיחים|מוחצים|לשים|מרדדים|מהפכים|מערים|מדיחים|מנקים|חורצים|מחוררים|מחברים|מפרידים|טורפים|מקציפים|מבלנדרים|מעבדים)\b/;

// ── Section types ─────────────────────────────────────────────────────────────

type SectionKind = 'preamble' | 'ingredients' | 'ingredient-group' | 'steps' | 'steps-extra';

interface Section {
  kind: SectionKind;
  header: string;
  lines: string[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function matchesAny(line: string, patterns: RegExp[]): boolean {
  return patterns.some((p) => p.test(line));
}

function stripHeaderQualifier(line: string): string {
  // Remove trailing parenthetical qualifiers and annotations so that
  // "Ingredients (for 4 servings)" and "רכיבים (עבור 4 קציצות גדולות)"
  // both reduce to their bare keyword before pattern matching.
  return line
    .replace(/\s*\([^)]*\)\s*$/, '')   // trailing (...) — most common
    .replace(/\s*[–\-]\s*.*$/, '')      // trailing "– subtitle"
    .trim();
}

function classifyHeader(line: string): SectionKind | null {
  const bare = stripHeaderQualifier(line);
  if (matchesAny(bare, H_INGREDIENT)) return 'ingredients';
  if (matchesAny(bare, H_STEPS)) return 'steps';
  if (matchesAny(bare, H_STEPS_EXTRA)) return 'steps-extra';
  // Use original line for sub-group so "לרוטב:" stays intact
  if (H_INGREDIENT_GROUP.test(line) && line.length < 50) return 'ingredient-group';
  return null;
}

function looksLikeIngredient(line: string): boolean {
  const clean = line.replace(BULLET, '').trim();
  return STARTS_WITH_QUANTITY.test(clean) || UNITS.test(clean);
}

function looksLikeStep(line: string): boolean {
  const clean = line.replace(BULLET, '').replace(NUMBERED, '').trim();
  return (
    NUMBERED.test(line) ||
    STEP_NUM.test(line) ||
    ACTION_VERBS_EN.test(clean) ||
    ACTION_VERBS_HE.test(clean)
  );
}

// ── Main parser ───────────────────────────────────────────────────────────────

export interface ParsedRecipe {
  title: string;
  ingredients: Ingredient[];
  steps: RecipeStep[];
  category: RecipeCategory;
}

export function parseRecipeText(rawText: string): ParsedRecipe {
  const lines = rawText.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);

  // Pass 1: segment into sections
  const sections: Section[] = [];
  let current: Section = { kind: 'preamble', header: '', lines: [] };

  for (const line of lines) {
    const kind = classifyHeader(line);
    if (kind) {
      sections.push(current);
      current = { kind, header: line, lines: [] };
    } else {
      current.lines.push(line);
    }
  }
  sections.push(current);

  // Pass 2: fall back to heuristics if no headers found
  const hasHeaders = sections.some(
    (s) => s.kind === 'ingredients' || s.kind === 'steps' || s.kind === 'steps-extra',
  );
  if (!hasHeaders) return fallbackParse(lines);

  // Pass 3: extract content
  const preamble = sections.find((s) => s.kind === 'preamble');
  const title = preamble?.lines[0] ?? lines[0] ?? 'Untitled Recipe';

  const allIngredientLines: string[] = [];
  for (const s of sections) {
    if (s.kind === 'ingredients' || s.kind === 'ingredient-group') {
      allIngredientLines.push(...s.lines);
    }
  }

  const allStepLines: string[] = [];
  for (const s of sections) {
    if (s.kind === 'steps') allStepLines.push(...s.lines);
  }
  for (const s of sections) {
    if (s.kind === 'steps-extra' && s.lines.length > 0) {
      allStepLines.push(`[${s.header}]`);
      allStepLines.push(...s.lines);
    }
  }

  return {
    title,
    ingredients: allIngredientLines.filter((l) => l.length > 1).map(parseIngredientLine),
    steps: buildSteps(allStepLines),
    category: guessCategory(rawText),
  };
}

// ── Fallback: no headers detected ────────────────────────────────────────────

function fallbackParse(lines: string[]): ParsedRecipe {
  const title = lines[0] ?? 'Untitled Recipe';
  const body = lines.slice(1);

  const ingredientLines: string[] = [];
  const stepLines: string[] = [];

  const firstNumberedIdx = body.findIndex((l) => NUMBERED.test(l) || STEP_NUM.test(l));

  if (firstNumberedIdx > 0) {
    ingredientLines.push(...body.slice(0, firstNumberedIdx));
    stepLines.push(...body.slice(firstNumberedIdx));
  } else {
    for (const line of body) {
      const clean = line.replace(BULLET, '').trim();
      if (looksLikeIngredient(clean)) {
        ingredientLines.push(line);
      } else if (looksLikeStep(clean)) {
        stepLines.push(line);
      } else if (stepLines.length > 0) {
        stepLines.push(line);
      } else if (ingredientLines.length > 0) {
        ingredientLines.push(line);
      }
    }
  }

  return {
    title,
    ingredients: ingredientLines.filter((l) => l.length > 1).map(parseIngredientLine),
    steps: buildSteps(stepLines),
    category: guessCategory(lines.join(' ')),
  };
}

// ── Step builder ──────────────────────────────────────────────────────────────

function buildSteps(lines: string[]): RecipeStep[] {
  const steps: RecipeStep[] = [];
  let order = 1;

  for (const line of lines) {
    const labelMatch = line.match(/^\[(.+)\]$/);
    if (labelMatch) {
      steps.push(createStep(order++, `— ${labelMatch[1]} —`));
      continue;
    }
    const clean = line.replace(BULLET, '').replace(STEP_NUM, '').trim();
    if (clean.length > 2) steps.push(createStep(order++, clean));
  }

  return steps;
}

// ── Ingredient line parser ────────────────────────────────────────────────────

function parseIngredientLine(raw: string): Ingredient {
  const line = raw.replace(BULLET, '').trim();

  // "to taste" / לפי הטעם
  if (TO_TASTE.test(line) || TO_TASTE_HE.test(line)) {
    const name = line
      .replace(/,?\s*(to taste|as needed|as required)/i, '')
      .replace(TO_TASTE_HE, '')
      .trim();
    return createIngredient({ name, quantity: '', unit: 'לפי הטעם / to taste' });
  }

  // Normalise unicode fractions
  const norm = line
    .replace(/½/g, '1/2').replace(/⅓/g, '1/3').replace(/⅔/g, '2/3')
    .replace(/¼/g, '1/4').replace(/¾/g, '3/4').replace(/⅛/g, '1/8')
    .replace(/⅜/g, '3/8').replace(/⅝/g, '5/8').replace(/⅞/g, '7/8');

  // Strip leading "(optional)" / "(אופציונלי)" prefix
  const stripped = norm.replace(/^\([^)]+\)\s*/i, '');

  // "200g beef" — English glued quantity+unit
  const glued = stripped.match(/^(\d[\d./]*)([a-zA-Z]+)\s+(.+)$/);
  if (glued && UNITS.test(glued[2])) {
    return createIngredient({ quantity: glued[1], unit: glued[2], name: glued[3].trim() });
  }

  // Matches: "2 כוסות קמח" / "1/2 cup flour" / "1-2 tbsp oil"
  // Unit word can be Latin or Hebrew letters
  const full = stripped.match(
    /^([\d./]+(?:\s*[-–]\s*[\d./]+)?(?:\s+[\d./]+)?)\s+([\wְ-ת"']+\.?)\s+(.+)$/u,
  );
  if (full && (UNITS.test(full[2]) || isDescriptor(full[2]))) {
    return createIngredient({ quantity: full[1].trim(), unit: full[2], name: full[3].trim() });
  }

  // "3 ביצים" / "1 egg" — quantity + name, no explicit unit
  const simple = stripped.match(/^([\d./]+(?:\s*[-–]\s*[\d./]+)?)\s+(.+)$/);
  if (simple) {
    return createIngredient({ quantity: simple[1].trim(), unit: '', name: simple[2].trim() });
  }

  return createIngredient({ name: line, quantity: '', unit: '' });
}

function isDescriptor(s: string): boolean {
  return /^(large|medium|small|whole|fresh|dried|ground|grated|sliced|diced|chopped|גדול|גדולה|קטן|קטנה|בינוני|בינונית|טרי|טרייה|יבש|יבשה|טחון|טחונה|מגורד|מגוררת|פרוס|פרוסה|קצוץ|קצוצה)$/i.test(s);
}

// ── Category guesser (English + Hebrew) ──────────────────────────────────────

function guessCategory(text: string): RecipeCategory {
  const t = text.toLowerCase();

  if (/\bpasta\b|spaghetti|penne|fettuccine|linguine|lasagna|rigatoni|tagliatelle|gnocchi|פסטה|ספגטי|לזניה/.test(t))
    return 'Pasta';

  if (/\bchicken\b|poultry|עוף|חזה עוף|שוק עוף|כנפיים/.test(t))
    return 'Chicken';

  if (/\bbeef\b|\bsteak\b|\bmince(d)?\b|\bground beef\b|\bbrisket\b|\bribs?\b|בקר|בשר טחון|סטייק|אנטריקוט|שניצל/.test(t))
    return 'Beef';

  if (/\bfish\b|\bsalmon\b|\btuna\b|\bcod\b|\bshrimp\b|\bprawn\b|\bseafood\b|\bcrab\b|\blobster\b|\bscallop\b|דג|סלמון|טונה|שרימפס|קלמרי|פירות ים/.test(t))
    return 'Fish';

  if (/\bsoup\b|\bchowder\b|\bbroth\b|\bbisque\b|\bstew\b|מרק|ציר|תבשיל/.test(t))
    return 'Soup';

  if (/\bsalad\b|סלט/.test(t))
    return 'Salad';

  if (/\bcake\b|\bcookie\b|\bbrownie\b|\bdessert\b|\bchocolate\b|\bsweet\b|\btart\b|\bpie\b|\bcustard\b|\bpudding\b|\bice cream\b|\bsorbet\b|עוגה|עוגיות|קינוח|שוקולד|גלידה|פודינג|קרם|טארט|מוס/.test(t))
    return 'Dessert';

  if (/\bvegetable\b|\bvegan\b|\bvegetarian\b|\btofu\b|\blentil\b|\bchickpea\b|\blegume\b|ירקות|טבעוני|צמחוני|טופו|עדשים|חומוס/.test(t))
    return 'Vegetarian';

  return 'Other';
}
