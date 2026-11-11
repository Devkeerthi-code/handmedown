/**
 * DEMO DATA ONLY. Invented example sellers and listings so a fresh install doesn't
 * look empty. Every listing is flagged is_demo and shows a "Demo" badge in the UI.
 * Remove it all with `npm run db:unseed`.
 */
import type { Category, Condition, PriceType, ListingStatus } from "../src/generated/prisma/enums";

export const DEMO_SELLERS = [
  { key: "ananya", name: "Ananya R. (demo)" },
  { key: "karthik", name: "Karthik S. (demo)" },
  { key: "meera", name: "Meera J. (demo)" },
  { key: "rahul", name: "Rahul V. (demo)" },
  { key: "sana", name: "Sana F. (demo)" },
] as const;

type SellerKey = (typeof DEMO_SELLERS)[number]["key"];

export type DemoListing = {
  seller: SellerKey;
  title: string;
  category: Category;
  condition: Condition;
  priceType: PriceType;
  price?: number;
  originalPrice?: number;
  exchangeFor?: string;
  pickupSpot: string;
  status?: ListingStatus;
  hoursAgo: number;
  description: string;
  isbn?: string;
  bookSemester?: number;
  bookSubject?: string;
  bookAuthor?: string;
};

export const DEMO_LISTINGS: DemoListing[] = [
  { seller: "ananya", title: "Engineering Mathematics (44th ed.)", category: "books", condition: "good", priceType: "fixed", price: 350, originalPrice: 1150, pickupSpot: "Central Library", hoursAgo: 2, description: "Pencil notes in chapters 3 and 7, otherwise clean. Cover has a small crease. Used for both semesters.", isbn: "9788174091956", bookSemester: 1, bookSubject: "Engineering Mathematics", bookAuthor: "B.S. Grewal" },
  { seller: "karthik", title: "Casio fx-991ES Plus scientific calculator", category: "electronics", condition: "like_new", priceType: "fixed", price: 600, originalPrice: 1295, pickupSpot: "Boys Hostel Block C", hoursAgo: 0.6, description: "Allowed in university exams. Battery replaced in March. Comes with the slide cover." },
  { seller: "rahul", title: "Hercules Roadeo cycle, 26 inch", category: "cycles", condition: "fair", priceType: "fixed", price: 1800, originalPrice: 7500, pickupSpot: "Boys Hostel Block A", status: "reserved", hoursAgo: 5, description: "Gears work, rear brake pads need replacing soon. Lock and key included. Selling because I graduate in May." },
  { seller: "karthik", title: "Room air cooler, 20 L", category: "hostel", condition: "good", priceType: "fixed", price: 1500, originalPrice: 5200, pickupSpot: "Boys Hostel Block C", hoursAgo: 26, description: "Works on all three speeds. Pads changed last summer. Pick up only, it is heavy." },
  { seller: "sana", title: "Lab coat, size M (worn one semester)", category: "lab", condition: "good", priceType: "free", originalPrice: 450, pickupSpot: "Mech Workshop", hoursAgo: 3, description: "Washed and ironed. Name tag removed. Free to any first year who needs it." },
  { seller: "rahul", title: "Single bed mattress, 4 inch foam", category: "hostel", condition: "good", priceType: "fixed", price: 900, originalPrice: 3400, pickupSpot: "Boys Hostel Block A", hoursAgo: 6, description: "Fits hostel cots. Has a removable cover that was washed last week. No stains." },
  { seller: "meera", title: "Engineering drawing kit: mini drafter + set squares", category: "lab", condition: "like_new", priceType: "exchange", exchangeFor: "Surveying textbook (Punmia)", originalPrice: 900, pickupSpot: "Admin Block steps", hoursAgo: 8, description: "Used for one semester. Will swap for a Surveying textbook, or tell me what you have." },
  { seller: "ananya", title: "Electric kettle, 1.2 L", category: "hostel", condition: "good", priceType: "fixed", price: 400, originalPrice: 1100, pickupSpot: "Girls Hostel lobby", hoursAgo: 28, description: "Auto shut-off works. Descaled before listing." },
  { seller: "rahul", title: "Data Structures Using C", category: "books", condition: "like_new", priceType: "fixed", price: 250, originalPrice: 695, pickupSpot: "Central Library", status: "sold", hoursAgo: 30, description: "No markings. Bought it, then the library copy turned up.", isbn: "9780198099307", bookSemester: 3, bookSubject: "Data Structures", bookAuthor: "Reema Thareja" },
  { seller: "meera", title: "College hoodie, size L", category: "clothing", condition: "good", priceType: "fixed", price: 300, originalPrice: 799, pickupSpot: "Main Canteen", hoursAgo: 50, description: "From the fest batch. Slight fading on the print." },
  { seller: "karthik", title: "Study lamp with USB charging", category: "other", condition: "fair", priceType: "free", originalPrice: 650, pickupSpot: "Boys Hostel Block C", hoursAgo: 52, description: "The USB port is loose, the lamp works fine. Take it before I leave." },
  { seller: "sana", title: "Over-ear headphones (wired)", category: "electronics", condition: "good", priceType: "fixed", price: 700, originalPrice: 2499, pickupSpot: "Main Gate", hoursAgo: 75, description: "Both sides work. Ear cushions slightly worn." },
  { seller: "rahul", title: "Bucket and mug set", category: "hostel", condition: "good", priceType: "free", originalPrice: 250, pickupSpot: "Boys Hostel Block A", hoursAgo: 78, description: "Every first year needs one. Free." },
  { seller: "meera", title: "Fluid Mechanics textbook", category: "books", condition: "fair", priceType: "exchange", exchangeFor: "Strength of Materials (Rajput)", originalPrice: 895, pickupSpot: "Central Library", hoursAgo: 96, description: "Highlighted in places. Swap for Strength of Materials, or make an offer.", isbn: "9788131808153", bookSemester: 4, bookSubject: "Fluid Mechanics", bookAuthor: "R.K. Bansal" },
];

export const DEMO_NOTE = "\n\nDemo listing: an example added to show how HandMeDown works. It isn't a real item.";
