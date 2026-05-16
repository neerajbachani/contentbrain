export const NICHE_SUBREDDITS: Record<string, string[]> = {
  fitness:      ["fitness", "running", "nutrition", "weightlifting", "bodyweightfitness"],
  tech:         ["technology", "programming", "webdev", "MachineLearning", "artificial"],
  finance:      ["personalfinance", "investing", "stocks", "financialindependence", "CryptoCurrency"],
  beauty:       ["SkincareAddiction", "MakeupAddiction", "Hair", "AsianBeauty"],
  food:         ["food", "recipes", "Cooking", "MealPrepSunday", "veganrecipes"],
  gaming:       ["gaming", "pcgaming", "PS5", "XboxSeriesX", "GameDeals"],
  travel:       ["travel", "backpacking", "solotravel", "digitalnomad", "TravelHacks"],
  fashion:      ["femalefashionadvice", "malefashionadvice", "streetwear", "frugalmalefashion"],
  mentalhealth: ["mentalhealth", "Anxiety", "depression", "selfimprovement", "Mindfulness"],
  education:    ["learnprogramming", "languagelearning", "GetStudying", "Teachers"],
  humor:        ["funny", "memes", "dankmemes", "me_irl", "Unexpected"],
  crypto:       ["CryptoCurrency", "Bitcoin", "ethereum", "NFT", "defi"],
  business:     ["Entrepreneur", "startups", "smallbusiness", "marketing", "SideProject"],
  lifestyle:    ["minimalism", "productivity", "PersonalFinance", "zerowaste"],
  sports:       ["sports", "nba", "soccer", "formula1", "cricket"],
};

export const NICHE_KEYWORDS: Record<string, string[]> = {
  fitness:      ["fitness", "workout", "gym", "nutrition", "health tips"],
  tech:         ["artificial intelligence", "software development", "startup tech", "machine learning"],
  finance:      ["personal finance", "stock market", "investing tips", "cryptocurrency"],
  beauty:       ["skincare", "makeup trends", "beauty tips", "haircare"],
  food:         ["recipes", "food trends", "meal prep", "restaurant"],
  gaming:       ["video games", "gaming news", "esports", "game release"],
  travel:       ["travel tips", "destinations", "budget travel", "digital nomad"],
  fashion:      ["fashion trends", "style tips", "streetwear", "outfit ideas"],
  mentalhealth: ["mental health", "mindfulness", "anxiety tips", "therapy"],
  education:    ["online learning", "study tips", "education technology"],
  humor:        ["viral memes", "comedy trends", "funny videos"],
  crypto:       ["bitcoin", "ethereum", "crypto news", "DeFi", "NFT"],
  business:     ["entrepreneurship", "startup news", "business growth", "marketing"],
  lifestyle:    ["minimalism", "productivity hacks", "self improvement", "morning routine"],
  sports:       ["sports news", "football", "NBA", "Formula 1", "cricket"],
};

export const ALL_NICHES = Object.keys(NICHE_SUBREDDITS);
