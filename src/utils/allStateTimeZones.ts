export const areaCodeToTimeZone: Record<string, string> = {
  // Alaska (AK)
  "907": "America/Anchorage", // Alaska Time

  // Alabama (AL)
  "205": "America/Chicago", // Central Time
  "251": "America/Chicago",
  "256": "America/Chicago",
  "334": "America/Chicago",
  "938": "America/Chicago",

  // Arizona (AZ)
  "480": "America/Phoenix", // Mountain Time (no DST)
  "520": "America/Phoenix",
  "602": "America/Phoenix",
  "623": "America/Phoenix",
  "928": "America/Phoenix",

  // Arkansas (AR)
  "479": "America/Chicago",
  "501": "America/Chicago",
  "870": "America/Chicago",

  // California (CA)
  "209": "America/Los_Angeles", // Pacific Time
  "213": "America/Los_Angeles",
  "310": "America/Los_Angeles",
  "323": "America/Los_Angeles",
  "408": "America/Los_Angeles",
  "415": "America/Los_Angeles",
  "424": "America/Los_Angeles",
  "510": "America/Los_Angeles",
  "530": "America/Los_Angeles",
  "559": "America/Los_Angeles",
  "562": "America/Los_Angeles",
  "619": "America/Los_Angeles",
  "626": "America/Los_Angeles",
  "650": "America/Los_Angeles",
  "661": "America/Los_Angeles",
  "707": "America/Los_Angeles",
  "714": "America/Los_Angeles",
  "747": "America/Los_Angeles",
  "760": "America/Los_Angeles",
  "805": "America/Los_Angeles",
  "818": "America/Los_Angeles",
  "831": "America/Los_Angeles",
  "858": "America/Los_Angeles",
  "909": "America/Los_Angeles",
  "916": "America/Los_Angeles",
  "925": "America/Los_Angeles",
  "949": "America/Los_Angeles",
  "951": "America/Los_Angeles",

  // Colorado (CO)
  "303": "America/Denver", // Mountain Time
  "719": "America/Denver",
  "720": "America/Denver",
  "970": "America/Denver",

  // Connecticut (CT)
  "203": "America/New_York", // Eastern Time
  "475": "America/New_York",
  "860": "America/New_York",
  "959": "America/New_York",

  // Delaware (DE)
  "302": "America/New_York",

  // District of Columbia (DC)
  "202": "America/New_York",

  // Florida (FL)
  // Most of Florida is Eastern Time, but some western areas (e.g., Pensacola) are Central Time.
  // Assigning Eastern Time to most area codes, Central Time to "850" (Panhandle).
  "239": "America/New_York",
  "305": "America/New_York",
  "321": "America/New_York",
  "352": "America/New_York",
  "386": "America/New_York",
  "407": "America/New_York",
  "561": "America/New_York",
  "727": "America/New_York",
  "754": "America/New_York",
  "772": "America/New_York",
  "786": "America/New_York",
  "813": "America/New_York",
  "850": "America/Chicago", // Central Time (Florida Panhandle)
  "863": "America/New_York",
  "904": "America/New_York",
  "941": "America/New_York",
  "954": "America/New_York",

  // Georgia (GA)
  "229": "America/New_York",
  "404": "America/New_York",
  "470": "America/New_York",
  "478": "America/New_York",
  "678": "America/New_York",
  "706": "America/New_York",
  "762": "America/New_York",
  "770": "America/New_York",
  "912": "America/New_York",

  // Hawaii (HI)
  "808": "Pacific/Honolulu", // Hawaii Time (no DST)

  // Idaho (ID)
  // Most of Idaho is Mountain Time, but northern areas (e.g., Coeur d'Alene) are Pacific Time.
  // "208" covers both, but Mountain Time is more common.
  "208": "America/Boise", // Mountain Time

  // Illinois (IL)
  "217": "America/Chicago",
  "224": "America/Chicago",
  "309": "America/Chicago",
  "312": "America/Chicago",
  "618": "America/Chicago",
  "630": "America/Chicago",
  "708": "America/Chicago",
  "773": "America/Chicago",
  "815": "America/Chicago",
  "847": "America/Chicago",
  "872": "America/Chicago",

  // Indiana (IN)
  // Most of Indiana is Eastern Time, but some northwest/southwest areas are Central Time.
  // Assigning Eastern Time to most area codes, Central Time to "812" (southern Indiana).
  "317": "America/Indiana/Indianapolis", // Eastern Time (no DST in some areas)
  "463": "America/Indiana/Indianapolis",
  "574": "America/Indiana/Indianapolis",
  "765": "America/Indiana/Indianapolis",
  "812": "America/Chicago", // Central Time (e.g., Evansville)
  "930": "America/Chicago",

  // Iowa (IA)
  "319": "America/Chicago",
  "515": "America/Chicago",
  "563": "America/Chicago",
  "641": "America/Chicago",
  "712": "America/Chicago",

  // Kansas (KS)
  "316": "America/Chicago",
  "620": "America/Chicago",
  "785": "America/Chicago",
  "913": "America/Chicago",

  // Kentucky (KY)
  // Eastern Kentucky is Eastern Time, western Kentucky is Central Time.
  // Assigning Eastern Time to most area codes, Central Time to "270", "364".
  "270": "America/Chicago",
  "364": "America/Chicago",
  "502": "America/New_York",
  "606": "America/New_York",
  "859": "America/New_York",

  // Louisiana (LA)
  "225": "America/Chicago",
  "318": "America/Chicago",
  "337": "America/Chicago",
  "504": "America/Chicago",
  "985": "America/Chicago",

  // Maine (ME)
  "207": "America/New_York",

  // Maryland (MD)
  "227": "America/New_York",
  "240": "America/New_York",
  "301": "America/New_York",
  "410": "America/New_York",
  "443": "America/New_York",
  "667": "America/New_York",

  // Massachusetts (MA)
  "339": "America/New_York",
  "351": "America/New_York",
  "413": "America/New_York",
  "508": "America/New_York",
  "617": "America/New_York",
  "774": "America/New_York",
  "781": "America/New_York",
  "857": "America/New_York",
  "978": "America/New_York",

  // Michigan (MI)
  // Most of Michigan is Eastern Time, but some Upper Peninsula areas are Central Time.
  // Assigning Eastern Time to all area codes (dominant).
  "231": "America/New_York",
  "248": "America/New_York",
  "269": "America/New_York",
  "313": "America/New_York",
  "517": "America/New_York",
  "586": "America/New_York",
  "616": "America/New_York",
  "679": "America/New_York",
  "734": "America/New_York",
  "810": "America/New_York",
  "906": "America/New_York",
  "947": "America/New_York",
  "989": "America/New_York",

  // Minnesota (MN)
  "218": "America/Chicago",
  "320": "America/Chicago",
  "507": "America/Chicago",
  "612": "America/Chicago",
  "651": "America/Chicago",
  "763": "America/Chicago",
  "952": "America/Chicago",

  // Mississippi (MS)
  "228": "America/Chicago",
  "601": "America/Chicago",
  "662": "America/Chicago",
  "769": "America/Chicago",

  // Missouri (MO)
  "314": "America/Chicago",
  "417": "America/Chicago",
  "557": "America/Chicago",
  "573": "America/Chicago",
  "636": "America/Chicago",
  "660": "America/Chicago",
  "816": "America/Chicago",

  // Montana (MT)
  "406": "America/Denver",

  // Nebraska (NE)
  // Most of Nebraska is Central Time, but western areas are Mountain Time.
  // Assigning Central Time to all area codes (dominant).
  "308": "America/Chicago",
  "402": "America/Chicago",
  "531": "America/Chicago",

  // Nevada (NV)
  "702": "America/Los_Angeles",
  "725": "America/Los_Angeles",
  "775": "America/Los_Angeles",

  // New Hampshire (NH)
  "603": "America/New_York",

  // New Jersey (NJ)
  "201": "America/New_York",
  "551": "America/New_York",
  "609": "America/New_York",
  "640": "America/New_York",
  "732": "America/New_York",
  "848": "America/New_York",
  "856": "America/New_York",
  "862": "America/New_York",
  "908": "America/New_York",
  "973": "America/New_York",

  // New Mexico (NM)
  "505": "America/Denver",
  "575": "America/Denver",

  // New York (NY)
  "212": "America/New_York",
  "315": "America/New_York",
  "332": "America/New_York",
  "347": "America/New_York",
  "516": "America/New_York",
  "518": "America/New_York",
  "585": "America/New_York",
  "607": "America/New_York",
  "631": "America/New_York",
  "646": "America/New_York",
  "716": "America/New_York",
  "718": "America/New_York",
  "845": "America/New_York",
  "914": "America/New_York",
  "917": "America/New_York",
  "929": "America/New_York",

  // North Carolina (NC)
  "252": "America/New_York",
  "336": "America/New_York",
  "704": "America/New_York",
  "743": "America/New_York",
  "828": "America/New_York",
  "910": "America/New_York",
  "919": "America/New_York",
  "980": "America/New_York",

  // North Dakota (ND)
  "701": "America/Chicago",

  // Ohio (OH)
  "216": "America/New_York",
  "220": "America/New_York",
  "234": "America/New_York",
  "283": "America/New_York",
  "330": "America/New_York",
  "419": "America/New_York",
  "440": "America/New_York",
  "513": "America/New_York",
  "614": "America/New_York",
  "740": "America/New_York",
  "937": "America/New_York",

  // Oklahoma (OK)
  "405": "America/Chicago",
  "539": "America/Chicago",
  "580": "America/Chicago",
  "918": "America/Chicago",

  // Oregon (OR)
  "458": "America/Los_Angeles",
  "503": "America/Los_Angeles",
  "541": "America/Los_Angeles",
  "971": "America/Los_Angeles",

  // Pennsylvania (PA)
  "215": "America/New_York",
  "223": "America/New_York",
  "267": "America/New_York",
  "272": "America/New_York",
  "412": "America/New_York",
  "445": "America/New_York",
  "484": "America/New_York",
  "570": "America/New_York",
  "610": "America/New_York",
  "717": "America/New_York",
  "724": "America/New_York",
  "814": "America/New_York",
  "878": "America/New_York",

  // Rhode Island (RI)
  "401": "America/New_York",

  // South Carolina (SC)
  "803": "America/New_York",
  "839": "America/New_York",
  "843": "America/New_York",
  "854": "America/New_York",
  "864": "America/New_York",

  // South Dakota (SD)
  "605": "America/Chicago",

  // Tennessee (TN)
  // Eastern Tennessee is Eastern Time, western Tennessee is Central Time.
  // Assigning Eastern Time to most area codes, Central Time to "731", "901".
  "423": "America/New_York",
  "615": "America/Chicago",
  "629": "America/Chicago",
  "731": "America/Chicago",
  "865": "America/New_York",
  "901": "America/Chicago",
  "931": "America/Chicago",

  // Texas (TX)
  // Most of Texas is Central Time, but far west (El Paso) is Mountain Time.
  // Assigning Central Time to most area codes, Mountain Time to "432", "915".
  "210": "America/Chicago",
  "214": "America/Chicago",
  "254": "America/Chicago",
  "281": "America/Chicago",
  "325": "America/Chicago",
  "346": "America/Chicago",
  "361": "America/Chicago",
  "409": "America/Chicago",
  "430": "America/Chicago",
  "432": "America/Denver", // Mountain Time (El Paso)
  "469": "America/Chicago",
  "512": "America/Chicago",
  "682": "America/Chicago",
  "713": "America/Chicago",
  "726": "America/Chicago",
  "737": "America/Chicago",
  "806": "America/Chicago",
  "817": "America/Chicago",
  "830": "America/Chicago",
  "832": "America/Chicago",
  "903": "America/Chicago",
  "915": "America/Denver", // Mountain Time (El Paso)
  "936": "America/Chicago",
  "940": "America/Chicago",
  "956": "America/Chicago",
  "972": "America/Chicago",
  "979": "America/Chicago",

  // Utah (UT)
  "385": "America/Denver",
  "435": "America/Denver",
  "801": "America/Denver",

  // Vermont (VT)
  "802": "America/New_York",

  // Virginia (VA)
  "276": "America/New_York",
  "434": "America/New_York",
  "540": "America/New_York",
  "571": "America/New_York",
  "703": "America/New_York",
  "757": "America/New_York",
  "804": "America/New_York",

  // Washington (WA)
  "206": "America/Los_Angeles",
  "253": "America/Los_Angeles",
  "360": "America/Los_Angeles",
  "425": "America/Los_Angeles",
  "509": "America/Los_Angeles",

  // West Virginia (WV)
  "304": "America/New_York",
  "681": "America/New_York",

  // Wisconsin (WI)
  "262": "America/Chicago",
  "414": "America/Chicago",
  "534": "America/Chicago",
  "608": "America/Chicago",
  "715": "America/Chicago",
  "920": "America/Chicago",

  // Wyoming (WY)
  "307": "America/Denver",
};

export const regionToTimeZone: Record<string, string> = {
  Pacific: "America/Los_Angeles",
  Mountain: "America/Denver",
  Central: "America/Chicago",
  Eastern: "America/New_York",
};
