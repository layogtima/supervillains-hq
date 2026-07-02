// JSON Schema for the editorial board's structured output.
// Structured-output rules: every object needs additionalProperties: false and
// a full `required` list; no recursion, no min/max constraints.

const str = { type: 'string' } as const;
const int = { type: 'integer' } as const;
const strArray = { type: 'array', items: str } as const;

function obj(properties: Record<string, unknown>) {
  return {
    type: 'object',
    properties,
    required: Object.keys(properties),
    additionalProperties: false,
  } as const;
}

const ARTICLE = obj({
  slug: str,
  kicker: str, // "EXCLUSIVE", "BREAKING", "SPECIAL INVESTIGATION"…
  headlines: strArray, // 2-3 variants; regen re-rolls between them
  subhead: str,
  byline: obj({ name: str, title: str }),
  body: strArray, // paragraphs
  pullQuote: str, // "" if none
  imagePath: str, // an imagePath from the scrape data, or "" for no image
  imageCaption: str,
  imageCredit: str,
  sources: strArray, // instagram permalinks this article traces to
  weight: int, // 1-10; highest becomes the lead
});

const LORE = obj({
  paper: obj({ name: str, motto: str, city: str, foundedDate: str }),
  staff: { type: 'array', items: obj({ name: str, title: str, quirks: strArray }) },
  characters: { type: 'array', items: obj({ name: str, role: str, canon: strArray }) },
  runningGags: {
    type: 'array',
    items: obj({ premise: str, timesUsed: int, lastUsed: str }),
  },
  canonEvents: { type: 'array', items: obj({ date: str, summary: str }) },
  styleNotes: strArray,
  counters: obj({ volume: int, issueNumber: int }),
});

export const EDITORIAL_SCHEMA = obj({
  edition: obj({
    meta: obj({
      date: str,
      volume: int,
      issue: int,
      edition: str, // "Morning Edition", "Monsoon Special"…
      price: str,
      motto: str,
      laughterIndexVariants: strArray, // 2-3 weather-box variants
      breakingTicker: strArray, // 5+ one-line ticker items
      scrapeFreshness: str, // "fresh" | "stale-Nd" | "archive"
    }),
    articles: { type: 'array', items: ARTICLE },
    classifieds: { type: 'array', items: obj({ heading: str, text: str }) },
    horoscopes: { type: 'array', items: obj({ prop: str, sign: str, text: str }) },
    letters: { type: 'array', items: obj({ from: str, text: str, editorReply: str }) },
    ads: { type: 'array', items: obj({ title: str, copy: str }) },
  }),
  updatedLore: LORE,
});

export type Lore = {
  paper: { name: string; motto: string; city: string; foundedDate: string };
  staff: { name: string; title: string; quirks: string[] }[];
  characters: { name: string; role: string; canon: string[] }[];
  runningGags: { premise: string; timesUsed: number; lastUsed: string }[];
  canonEvents: { date: string; summary: string }[];
  styleNotes: string[];
  counters: { volume: number; issueNumber: number };
};

export type Edition = {
  meta: {
    date: string;
    volume: number;
    issue: number;
    edition: string;
    price: string;
    motto: string;
    laughterIndexVariants: string[];
    breakingTicker: string[];
    scrapeFreshness: string;
  };
  articles: {
    slug: string;
    kicker: string;
    headlines: string[];
    subhead: string;
    byline: { name: string; title: string };
    body: string[];
    pullQuote: string;
    imagePath: string;
    imageCaption: string;
    imageCredit: string;
    sources: string[];
    weight: number;
  }[];
  classifieds: { heading: string; text: string }[];
  horoscopes: { prop: string; sign: string; text: string }[];
  letters: { from: string; text: string; editorReply: string }[];
  ads: { title: string; copy: string }[];
};
