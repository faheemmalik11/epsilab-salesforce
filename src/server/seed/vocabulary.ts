// Word lists for the synthetic data. The seed's leads are trade contractors (statuses such as
// "Unqualified - Not a Contractor" and "NQ_Nurture_Trade"), so generated accounts are contractors
// and the businesses around them. Domains use the reserved .example TLD so no address is real.

/** Industry picklist values with weights, skewed to construction as the seed is. */
export const INDUSTRIES: readonly [string, number][] = [
  ['Construction', 46],
  ['Engineering', 8],
  ['Manufacturing', 8],
  ['Retail', 6],
  ['Environmental', 5],
  ['Utilities', 4],
  ['Transportation', 4],
  ['Consulting', 4],
  ['Hospitality', 3],
  ['Healthcare', 3],
  ['Finance', 3],
  ['Insurance', 2],
  ['Technology', 2],
  ['Other', 2],
];

/** Business nouns per industry, used in generated company names. */
export const TRADES: Record<string, readonly string[]> = {
  Construction: [
    'Roofing', 'Builders', 'Construction', 'Remodeling', 'Plumbing', 'Electric', 'Mechanical', 'HVAC',
    'Concrete', 'Painting', 'Restoration', 'Siding & Windows', 'Flooring', 'Masonry', 'Framing',
    'Home Services', 'Contractors', 'Excavation', 'Solar', 'Fence & Deck',
  ],
  Engineering: ['Engineering', 'Design Group', 'Structural', 'Surveying', 'Civil Partners'],
  Manufacturing: ['Manufacturing', 'Fabrication', 'Millwork', 'Steel Works', 'Cabinetry', 'Truss Co'],
  Retail: ['Supply', 'Lumber', 'Building Supply', 'Hardware', 'Home Center'],
  Environmental: ['Environmental', 'Abatement', 'Water Management', 'Landscaping', 'Tree Service'],
  Utilities: ['Utility Services', 'Power Systems', 'Pipeline Services'],
  Transportation: ['Logistics', 'Equipment Rental', 'Hauling', 'Fleet Services'],
  Consulting: ['Advisors', 'Project Management', 'Consulting'],
  Hospitality: ['Hospitality Group', 'Property Management'],
  Healthcare: ['Facilities Services', 'Medical Properties'],
  Finance: ['Capital', 'Home Lending', 'Credit Union'],
  Insurance: ['Insurance Agency', 'Risk Partners'],
  Technology: ['Software', 'Systems', 'Data Services'],
  Other: ['Group', 'Holdings', 'Services'],
};

export const NAME_WORDS: readonly string[] = [
  'Summit', 'Keystone', 'Bayside', 'Cedar', 'Ironwood', 'Blue Ridge', 'Granite', 'Harbor', 'Pioneer',
  'Liberty', 'Redwood', 'Lakeshore', 'Northgate', 'Silver Creek', 'Oak Hollow', 'Riverbend', 'Eagle',
  'Patriot', 'Coastal', 'Heritage', 'Prairie', 'Sterling', 'Copper', 'Westfield', 'Brightline',
  'Cornerstone', 'Evergreen', 'Highland', 'Magnolia', 'Meridian', 'Northstar', 'Pinnacle', 'Quarry',
  'Sandstone', 'Timberline', 'Union', 'Valley', 'Whitestone', 'Anchor', 'Beacon', 'Benchmark',
  'Canyon', 'Crestview', 'Diamond', 'Elm Street', 'Foothill', 'Gulf Coast', 'Hillside', 'Juniper',
  'Kingsbridge', 'Lone Pine', 'Maple Leaf', 'Mission', 'Old Mill', 'Peak', 'Red Brick', 'Shoreline',
  'Stonebridge', 'Tri-County', 'Twin Oaks', 'Upstate', 'Vista', 'Willow', 'Arrowhead', 'Bluestone',
];

export const COMPANY_SUFFIXES: readonly string[] = ['', '', '', ' LLC', ' Inc.', ' Co.', ' Corp.', ' Group', ' & Sons', ' Partners'];

/** A few large cities per seed state (the seed's top states), for addresses and phone area codes. */
export const PLACES: readonly { state: string; cities: readonly string[]; areaCode: string; weight: number }[] = [
  { state: 'Florida', cities: ['Tampa', 'Orlando', 'Jacksonville', 'Fort Lauderdale', 'Sarasota'], areaCode: '813', weight: 10 },
  { state: 'New York', cities: ['Buffalo', 'Rochester', 'Albany', 'Syracuse', 'Yonkers'], areaCode: '716', weight: 8 },
  { state: 'California', cities: ['Sacramento', 'San Diego', 'Fresno', 'San Jose', 'Riverside'], areaCode: '916', weight: 6 },
  { state: 'New Jersey', cities: ['Newark', 'Edison', 'Trenton', 'Cherry Hill'], areaCode: '732', weight: 5 },
  { state: 'Pennsylvania', cities: ['Pittsburgh', 'Allentown', 'Harrisburg', 'Erie'], areaCode: '412', weight: 5 },
  { state: 'Massachusetts', cities: ['Worcester', 'Springfield', 'Lowell', 'Quincy'], areaCode: '508', weight: 5 },
  { state: 'Illinois', cities: ['Naperville', 'Rockford', 'Peoria', 'Joliet'], areaCode: '630', weight: 5 },
  { state: 'Ohio', cities: ['Columbus', 'Cleveland', 'Cincinnati', 'Dayton'], areaCode: '614', weight: 5 },
  { state: 'Texas', cities: ['Austin', 'Houston', 'San Antonio', 'Fort Worth'], areaCode: '512', weight: 4 },
  { state: 'Georgia', cities: ['Atlanta', 'Savannah', 'Augusta'], areaCode: '404', weight: 3 },
  { state: 'North Carolina', cities: ['Charlotte', 'Raleigh', 'Greensboro'], areaCode: '704', weight: 3 },
  { state: 'Michigan', cities: ['Grand Rapids', 'Lansing', 'Ann Arbor'], areaCode: '616', weight: 3 },
];

export const STREETS: readonly string[] = [
  'Main St', 'Industrial Pkwy', 'Commerce Dr', 'Oak Ave', 'Route 9', 'Market St', 'Lakeview Rd',
  'Enterprise Blvd', 'Mill Rd', 'Park Ave', 'Washington St', 'Airport Rd', 'Quarry Ln', 'Depot St',
];

/** Contact titles by seniority, with the department each belongs to. */
export const TITLES: readonly { title: string; department: string; senior: boolean; weight: number }[] = [
  { title: 'Owner', department: 'Executive', senior: true, weight: 14 },
  { title: 'President', department: 'Executive', senior: true, weight: 8 },
  { title: 'General Manager', department: 'Operations', senior: true, weight: 6 },
  { title: 'VP of Operations', department: 'Operations', senior: true, weight: 4 },
  { title: 'CFO', department: 'Finance', senior: true, weight: 3 },
  { title: 'Controller', department: 'Finance', senior: false, weight: 4 },
  { title: 'Operations Manager', department: 'Operations', senior: false, weight: 8 },
  { title: 'Project Manager', department: 'Operations', senior: false, weight: 9 },
  { title: 'Estimator', department: 'Sales', senior: false, weight: 7 },
  { title: 'Office Manager', department: 'Administration', senior: false, weight: 8 },
  { title: 'Purchasing Manager', department: 'Purchasing', senior: false, weight: 5 },
  { title: 'Service Manager', department: 'Service', senior: false, weight: 5 },
  { title: 'Superintendent', department: 'Field Operations', senior: false, weight: 5 },
  { title: 'IT Manager', department: 'IT', senior: false, weight: 2 },
  { title: 'Sales Manager', department: 'Sales', senior: false, weight: 4 },
];

/** What the org sells to these accounts: field-service software, priced per deal size. */
export const DEALS: readonly { name: string; min: number; max: number; type: 'New Business' | 'Existing Business' | 'Any' }[] = [
  { name: 'Annual Subscription', min: 8, max: 60, type: 'New Business' },
  { name: 'Crew Scheduling Pilot', min: 3, max: 12, type: 'New Business' },
  { name: 'Estimating Suite', min: 12, max: 80, type: 'New Business' },
  { name: 'Fleet Tracking Rollout', min: 15, max: 120, type: 'Any' },
  { name: 'Field Service Platform', min: 25, max: 250, type: 'New Business' },
  { name: 'Additional Seats', min: 2, max: 30, type: 'Existing Business' },
  { name: 'Renewal', min: 6, max: 90, type: 'Existing Business' },
  { name: 'Payments Add-on', min: 4, max: 25, type: 'Existing Business' },
  { name: 'Implementation Services', min: 5, max: 40, type: 'Any' },
  { name: 'Enterprise Upgrade', min: 40, max: 400, type: 'Existing Business' },
];

/** Open-stage next steps, roughly in sales-cycle order. */
export const NEXT_STEPS: readonly string[] = [
  'Schedule discovery call', 'Confirm budget and timeline', 'Book product demo', 'Send pricing',
  'Run technical review', 'Send proposal', 'Review redlines', 'Get signature',
];

/** Completed activity on a deal, early to late. Each entry is [subject, subtype]. */
export const DEAL_ACTIVITY: readonly [string, 'Call' | 'Email' | 'Task'][] = [
  ['Intro call', 'Call'],
  ['Discovery call', 'Call'],
  ['Sent overview deck', 'Email'],
  ['Product demo', 'Task'],
  ['Follow-up call', 'Call'],
  ['Sent pricing', 'Email'],
  ['Technical review', 'Task'],
  ['Sent proposal', 'Email'],
  ['Negotiation call', 'Call'],
];

export const LEAD_ACTIVITY: readonly [string, 'Call' | 'Email' | 'Task'][] = [
  ['Call', 'Call'],
  ['Left voicemail', 'Call'],
  ['Intro call', 'Call'],
  ['Sent follow-up email', 'Email'],
  ['Qualification call', 'Call'],
];

export const LEAD_FOLLOW_UPS: readonly string[] = ['Follow up', 'Call back', 'Send case study', 'Check in after demo', 'Confirm interest'];

export const CALL_NOTES: readonly string[] = [
  'Interested, wants pricing for their crew size.',
  'Busy season, asked to reconnect next month.',
  'Uses spreadsheets today; open to a demo.',
  'Spoke with the office manager; owner decides.',
  'No answer, left a voicemail.',
  'Evaluating two other vendors.',
  'Budget approved for next quarter.',
  'Concerned about setup time for field staff.',
];

export const LOSS_REASONS: readonly string[] = [
  'Lost to a competitor on price.',
  'No budget this year.',
  'Went silent after the demo.',
  'Chose to stay on their current system.',
  'Project put on hold.',
];
