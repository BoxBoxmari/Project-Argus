// Unified review schema
export type Review = {
  place_id: string;
  place_url: string;
  review_id: string;
  author: string;
  rating: number;
  text: string;
  relative_time: string;
  time_unix: number;
  lang?: string;
  owner_response?: { text: string; time_unix: number };
  crawl_meta: { 
    run_id: string; 
    session: string; 
    ts: number; 
    source: 'userscript' | 'playwright'; 
    url?: string 
  }
};

export type PlaceMetadata = {
  place_id: string;
  place_url: string;
  name: string;
  address: string;
  rating: number;
  total_reviews: number;
  categories: string[];
  phone?: string;
  website?: string;
  hours?: Record<string, string>;
  crawl_meta: {
    run_id: string;
    session: string;
    ts: number;
    source: 'userscript' | 'playwright';
  };
};

export type ScrapingResult = {
  success: boolean;
  url: string;
  data?: Review[] | PlaceMetadata;
  error?: string;
  retries: number;
  duration: number;
  timestamp: string;
  artifacts?: {
    har?: string;
    screenshot?: string;
    html?: string;
  };
};

export type Checkpoint = {
  run_id: string;
  timestamp: string;
  urls_processed: number;
  urls_failed: number;
  reviews_collected: number;
  last_url?: string;
  session_stats: {
    total_sessions: number;
    active_sessions: number;
    failed_sessions: number;
  };
  pool_stats: {
    current_concurrency: number;
    min_concurrency: number;
    max_concurrency: number;
    avg_event_loop_delay: number;
    rss_mb: number;
  };
};

export function validateReview(review: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const required = ['place_id', 'place_url', 'review_id', 'author', 'rating', 'text', 'relative_time', 'time_unix'];
  
  for (const field of required) {
    if (!review[field]) {
      errors.push(`Missing required field: ${field}`);
    }
  }
  
  if (review.rating && (typeof review.rating !== 'number' || review.rating < 1 || review.rating > 5)) {
    errors.push('Rating must be a number between 1 and 5');
  }
  
  if (review.time_unix && (typeof review.time_unix !== 'number' || review.time_unix <= 0)) {
    errors.push('time_unix must be a positive number');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

// tiện ích chuẩn hoá nhẹ để plugin có thể import mà không lỗi build
export function normalizeReview(r: Partial<Review>): Review {
  return {
    place_id: r.place_id ?? "",
    place_url: r.place_url ?? "",
    review_id: r.review_id ?? "",
    author: r.author ?? "",
    rating: r.rating ?? 0,
    text: r.text ?? "",
    relative_time: r.relative_time ?? "",
    time_unix: r.time_unix ?? 0,
    lang: r.lang,
    owner_response: r.owner_response,
    crawl_meta: r.crawl_meta ?? { 
      run_id: "", 
      session: "", 
      ts: 0, 
      source: "playwright", 
      url: "" 
    }
  };
}
