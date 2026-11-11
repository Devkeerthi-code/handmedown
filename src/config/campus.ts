/**
 * Everything specific to one college lives here. Change these to your campus.
 * Name and short name can also come from env so a deploy can rebrand without a code change.
 */
export const CAMPUS = {
  name: process.env.NEXT_PUBLIC_COLLEGE_NAME || "Demo Institute of Technology",
  short: process.env.NEXT_PUBLIC_COLLEGE_SHORT || "DIT",
};

export const PICKUP_SPOTS = [
  "Central Library",
  "Main Canteen",
  "Main Gate",
  "Admin Block steps",
  "Boys Hostel Block A",
  "Boys Hostel Block B",
  "Boys Hostel Block C",
  "Girls Hostel lobby",
  "Mech Workshop",
  "Sports Complex",
] as const;
