import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

// ONE-TIME, token-gated: fills in the "activities" list for the destinations
// created by /api/setup/seed-destinations (they were seeded with
// activities: []). Curated from TripAdvisor's "Things to Do" listings for
// each city, one entry per { name, cost } (cost in INR, 0 = free/typically
// no entry fee). Only touches a destination if its activities array is
// currently empty, so it never overwrites anything an agent has already
// customized. Delete this route once seeding is confirmed done.
const CITY_ACTIVITIES = {
  "Srinagar": [
    {
      "name": "Shikara Ride on Dal Lake",
      "cost": 800
    },
    {
      "name": "Mughal Gardens Visit (Nishat & Shalimar Bagh)",
      "cost": 50
    },
    {
      "name": "Shankaracharya Temple Visit",
      "cost": 0
    },
    {
      "name": "Indira Gandhi Memorial Tulip Garden",
      "cost": 100
    },
    {
      "name": "Old City Walk & Jama Masjid",
      "cost": 0
    },
    {
      "name": "Pari Mahal Visit",
      "cost": 30
    }
  ],
  "Gulmarg": [
    {
      "name": "Gulmarg Gondola Cable Car Ride (Phase 1 & 2)",
      "cost": 1800
    },
    {
      "name": "Skiing/Snowboarding Lesson",
      "cost": 2000
    },
    {
      "name": "Pony Ride to Khilanmarg",
      "cost": 800
    },
    {
      "name": "Apharwat Peak & Alpather Lake Viewpoint",
      "cost": 0
    },
    {
      "name": "Gulmarg Golf Course Visit",
      "cost": 0
    }
  ],
  "Pahalgam": [
    {
      "name": "Betaab Valley Visit",
      "cost": 100
    },
    {
      "name": "Aru Valley Excursion",
      "cost": 500
    },
    {
      "name": "Chandanwari Sightseeing",
      "cost": 400
    },
    {
      "name": "River Rafting on Lidder River",
      "cost": 600
    },
    {
      "name": "Pony Ride to Baisaran (Mini Switzerland)",
      "cost": 800
    }
  ],
  "Sonmarg": [
    {
      "name": "Thajiwas Glacier Trek/Pony Ride",
      "cost": 700
    },
    {
      "name": "Zojila Pass Excursion",
      "cost": 1500
    },
    {
      "name": "White Water Rafting on Sindh River",
      "cost": 700
    },
    {
      "name": "Sonmarg Meadow Walk",
      "cost": 0
    }
  ],
  "Leh": [
    {
      "name": "Shanti Stupa Visit",
      "cost": 0
    },
    {
      "name": "Leh Palace Visit",
      "cost": 30
    },
    {
      "name": "Khardung La Pass Excursion",
      "cost": 1000
    },
    {
      "name": "Hall of Fame Museum",
      "cost": 50
    },
    {
      "name": "Magnetic Hill Visit",
      "cost": 0
    },
    {
      "name": "Sangam Confluence (Indus-Zanskar) Viewpoint",
      "cost": 0
    }
  ],
  "Nubra Valley": [
    {
      "name": "Bactrian Camel Safari at Hunder Sand Dunes",
      "cost": 500
    },
    {
      "name": "Diskit Monastery Visit",
      "cost": 30
    },
    {
      "name": "Hunder Sand Dunes Visit",
      "cost": 0
    },
    {
      "name": "Turtuk Village Excursion",
      "cost": 1500
    }
  ],
  "Pangong Lake": [
    {
      "name": "Pangong Tso Lakeside Visit & Photography",
      "cost": 0
    },
    {
      "name": "Boat Ride on Pangong Lake",
      "cost": 300
    },
    {
      "name": "Camping by Pangong Lake",
      "cost": 2500
    },
    {
      "name": "Chang La Pass Viewpoint (en route)",
      "cost": 0
    }
  ],
  "Kargil": [
    {
      "name": "Kargil War Memorial Visit (Drass)",
      "cost": 20
    },
    {
      "name": "Mulbekh Monastery & Rock-Cut Buddha",
      "cost": 20
    },
    {
      "name": "Suru Valley Sightseeing",
      "cost": 1000
    },
    {
      "name": "Local Bazaar Walk",
      "cost": 0
    }
  ],
  "Manali": [
    {
      "name": "Paragliding at Solang Valley",
      "cost": 1500
    },
    {
      "name": "Rohtang Pass Excursion",
      "cost": 1500
    },
    {
      "name": "River Rafting on Beas River",
      "cost": 800
    },
    {
      "name": "Hadimba Temple Visit",
      "cost": 0
    },
    {
      "name": "Solang Valley Zorbing",
      "cost": 500
    },
    {
      "name": "Old Manali & Mall Road Walk",
      "cost": 0
    }
  ],
  "Shimla": [
    {
      "name": "Mall Road & The Ridge Walk",
      "cost": 0
    },
    {
      "name": "Jakhoo Temple Visit",
      "cost": 0
    },
    {
      "name": "Kufri Excursion & Horse Riding",
      "cost": 500
    },
    {
      "name": "Christ Church Visit",
      "cost": 0
    },
    {
      "name": "Kalka-Shimla Toy Train Ride",
      "cost": 500
    },
    {
      "name": "Chadwick Falls Visit",
      "cost": 0
    }
  ],
  "Dharamshala": [
    {
      "name": "Dalai Lama Temple (Tsuglagkhang) Visit",
      "cost": 0
    },
    {
      "name": "Trek to Triund",
      "cost": 100
    },
    {
      "name": "Bhagsunag Waterfall Visit",
      "cost": 0
    },
    {
      "name": "McLeodganj Market Walk",
      "cost": 0
    },
    {
      "name": "Namgyal Monastery Visit",
      "cost": 0
    },
    {
      "name": "Dharamkot & Naddi Viewpoint",
      "cost": 0
    }
  ],
  "Kasol": [
    {
      "name": "Kheerganga Trek",
      "cost": 0
    },
    {
      "name": "Kasol Market Walk",
      "cost": 0
    },
    {
      "name": "Chalal Village Trek",
      "cost": 0
    },
    {
      "name": "Manikaran Sahib Gurdwara & Hot Springs",
      "cost": 0
    },
    {
      "name": "Tosh Village Excursion",
      "cost": 500
    }
  ],
  "Spiti Valley": [
    {
      "name": "Key Monastery Visit",
      "cost": 0
    },
    {
      "name": "Chandratal Lake Excursion",
      "cost": 2000
    },
    {
      "name": "Kaza Village & Local Market",
      "cost": 0
    },
    {
      "name": "Kibber Village & Wildlife Sanctuary",
      "cost": 0
    },
    {
      "name": "Dhankar Monastery & Lake Trek",
      "cost": 0
    },
    {
      "name": "Langza, Hikkim & Komic Villages Excursion",
      "cost": 2500
    }
  ],
  "Dalhousie": [
    {
      "name": "Khajjiar Excursion (Mini Switzerland)",
      "cost": 800
    },
    {
      "name": "Dainkund Peak Trek",
      "cost": 0
    },
    {
      "name": "Kalatop Wildlife Sanctuary Visit",
      "cost": 100
    },
    {
      "name": "Panchpula & Satdhara Falls Visit",
      "cost": 0
    },
    {
      "name": "St. John's Church & Mall Road Walk",
      "cost": 0
    }
  ],
  "Rishikesh": [
    {
      "name": "River Rafting on the Ganges",
      "cost": 600
    },
    {
      "name": "Bungee Jumping at Jumping Heights",
      "cost": 3500
    },
    {
      "name": "Evening Ganga Aarti at Triveni Ghat",
      "cost": 0
    },
    {
      "name": "Laxman Jhula & Ram Jhula Walk",
      "cost": 0
    },
    {
      "name": "Beatles Ashram (Chaurasi Kutia) Visit",
      "cost": 300
    },
    {
      "name": "Kunjapuri Temple Sunrise Trek",
      "cost": 0
    }
  ],
  "Haridwar": [
    {
      "name": "Ganga Aarti at Har Ki Pauri",
      "cost": 0
    },
    {
      "name": "Mansa Devi Temple Cable Car Ride",
      "cost": 200
    },
    {
      "name": "Chandi Devi Temple Cable Car Ride",
      "cost": 200
    },
    {
      "name": "Rajaji National Park Jungle Safari",
      "cost": 2000
    },
    {
      "name": "Har Ki Pauri Ghat Holy Dip & Walk",
      "cost": 0
    }
  ],
  "Nainital": [
    {
      "name": "Boating on Naini Lake",
      "cost": 250
    },
    {
      "name": "Naina Devi Temple Darshan",
      "cost": 0
    },
    {
      "name": "Mall Road Evening Stroll",
      "cost": 0
    },
    {
      "name": "Snow View Point Ropeway Ride",
      "cost": 350
    },
    {
      "name": "Tiffin Top (Dorothy's Seat) Trek",
      "cost": 100
    }
  ],
  "Mussoorie": [
    {
      "name": "Gun Hill Ropeway Ride",
      "cost": 300
    },
    {
      "name": "Kempty Falls Visit",
      "cost": 30
    },
    {
      "name": "Camel's Back Road Walk",
      "cost": 0
    },
    {
      "name": "Company Garden Visit",
      "cost": 60
    },
    {
      "name": "Lal Tibba Sunset Viewpoint",
      "cost": 0
    }
  ],
  "Jim Corbett": [
    {
      "name": "Jeep Safari in Corbett National Park",
      "cost": 2500
    },
    {
      "name": "Elephant Safari in Corbett",
      "cost": 4500
    },
    {
      "name": "Canter Safari in Corbett",
      "cost": 3000
    },
    {
      "name": "Corbett Waterfall Trek",
      "cost": 0
    },
    {
      "name": "Garjia Devi Temple Visit",
      "cost": 0
    }
  ],
  "Auli": [
    {
      "name": "Auli Ropeway (Cable Car) Ride",
      "cost": 800
    },
    {
      "name": "Skiing at Auli",
      "cost": 3500
    },
    {
      "name": "Gorson Bugyal Meadow Trek",
      "cost": 500
    },
    {
      "name": "Auli Artificial Lake Visit",
      "cost": 0
    },
    {
      "name": "Kuari Pass Himalayan Viewpoint Trek",
      "cost": 0
    }
  ],
  "Delhi": [
    {
      "name": "Red Fort Visit",
      "cost": 35
    },
    {
      "name": "Qutub Minar Visit",
      "cost": 35
    },
    {
      "name": "India Gate Visit",
      "cost": 0
    },
    {
      "name": "Humayun's Tomb Visit",
      "cost": 35
    },
    {
      "name": "Akshardham Temple & Exhibition",
      "cost": 250
    },
    {
      "name": "Chandni Chowk Street Food Walk",
      "cost": 0
    }
  ],
  "Agra": [
    {
      "name": "Taj Mahal Sunrise Visit",
      "cost": 750
    },
    {
      "name": "Agra Fort Visit",
      "cost": 50
    },
    {
      "name": "Fatehpur Sikri Excursion",
      "cost": 50
    },
    {
      "name": "Itmad-ud-Daulah (Baby Taj) Visit",
      "cost": 30
    },
    {
      "name": "Mehtab Bagh Sunset View of Taj",
      "cost": 30
    }
  ],
  "Varanasi": [
    {
      "name": "Sunrise Boat Ride on the Ganges",
      "cost": 300
    },
    {
      "name": "Evening Ganga Aarti at Dashashwamedh Ghat",
      "cost": 0
    },
    {
      "name": "Kashi Vishwanath Temple Darshan",
      "cost": 0
    },
    {
      "name": "Sarnath Excursion",
      "cost": 30
    },
    {
      "name": "Old City Ghats Walking Tour",
      "cost": 0
    }
  ],
  "Lucknow": [
    {
      "name": "Bara Imambara & Bhool Bhulaiya Visit",
      "cost": 50
    },
    {
      "name": "Chota Imambara Visit",
      "cost": 25
    },
    {
      "name": "Rumi Darwaza Visit",
      "cost": 0
    },
    {
      "name": "British Residency Ruins Visit",
      "cost": 25
    },
    {
      "name": "Hazratganj Market & Tunday Kababi Food Trail",
      "cost": 300
    }
  ],
  "Jaipur": [
    {
      "name": "Amber Fort Elephant/Jeep Ride",
      "cost": 300
    },
    {
      "name": "Hawa Mahal Visit",
      "cost": 50
    },
    {
      "name": "City Palace Jaipur Visit",
      "cost": 300
    },
    {
      "name": "Jantar Mantar Visit",
      "cost": 50
    },
    {
      "name": "Nahargarh Fort Sunset Visit",
      "cost": 50
    },
    {
      "name": "Johari Bazaar Shopping Walk",
      "cost": 0
    }
  ],
  "Udaipur": [
    {
      "name": "Lake Pichola Boat Ride",
      "cost": 400
    },
    {
      "name": "City Palace Udaipur Visit",
      "cost": 400
    },
    {
      "name": "Jagdish Temple Visit",
      "cost": 0
    },
    {
      "name": "Saheliyon Ki Bari Garden Visit",
      "cost": 20
    },
    {
      "name": "Bagore Ki Haveli Cultural Dance Show",
      "cost": 150
    }
  ],
  "Jodhpur": [
    {
      "name": "Mehrangarh Fort Visit",
      "cost": 200
    },
    {
      "name": "Jaswant Thada Visit",
      "cost": 50
    },
    {
      "name": "Toorji Ka Jhalra Stepwell Visit",
      "cost": 0
    },
    {
      "name": "Sardar Market & Clock Tower Walk",
      "cost": 0
    },
    {
      "name": "Rao Jodha Desert Rock Park Walk",
      "cost": 100
    }
  ],
  "Jaisalmer": [
    {
      "name": "Jaisalmer Fort & Jain Temples Visit",
      "cost": 50
    },
    {
      "name": "Camel Safari at Sam Sand Dunes",
      "cost": 800
    },
    {
      "name": "Overnight Desert Camping at Sam Dunes",
      "cost": 3500
    },
    {
      "name": "Patwon Ki Haveli Visit",
      "cost": 50
    },
    {
      "name": "Gadisar Lake Boat Ride",
      "cost": 100
    }
  ],
  "Pushkar": [
    {
      "name": "Pushkar Lake Aarti & Ghat Visit",
      "cost": 0
    },
    {
      "name": "Brahma Temple Darshan",
      "cost": 0
    },
    {
      "name": "Camel Safari at Sunset",
      "cost": 600
    },
    {
      "name": "Savitri Mata Temple Ropeway",
      "cost": 150
    },
    {
      "name": "Sadar Bazaar Shopping Walk",
      "cost": 0
    }
  ],
  "Mount Abu": [
    {
      "name": "Dilwara Jain Temples Visit",
      "cost": 0
    },
    {
      "name": "Nakki Lake Boating",
      "cost": 200
    },
    {
      "name": "Guru Shikhar Viewpoint",
      "cost": 0
    },
    {
      "name": "Sunset Point Visit",
      "cost": 0
    },
    {
      "name": "Mount Abu Wildlife Sanctuary Walk",
      "cost": 100
    }
  ],
  "Mumbai": [
    {
      "name": "Gateway of India Sightseeing",
      "cost": 0
    },
    {
      "name": "Elephanta Caves Ferry & Tour",
      "cost": 400
    },
    {
      "name": "Marine Drive Evening Walk",
      "cost": 0
    },
    {
      "name": "Chhatrapati Shivaji Terminus Visit",
      "cost": 0
    },
    {
      "name": "Siddhivinayak Temple Darshan",
      "cost": 0
    }
  ],
  "Pune": [
    {
      "name": "Shaniwarwada Fort Visit",
      "cost": 25
    },
    {
      "name": "Aga Khan Palace Tour",
      "cost": 25
    },
    {
      "name": "Sinhagad Fort Trek",
      "cost": 0
    },
    {
      "name": "Dagdusheth Halwai Ganpati Temple",
      "cost": 0
    },
    {
      "name": "Osho International Meditation Resort Day Pass",
      "cost": 1500
    }
  ],
  "Lonavala": [
    {
      "name": "Karla Caves Visit",
      "cost": 25
    },
    {
      "name": "Della Adventure Park",
      "cost": 1800
    },
    {
      "name": "Tiger Point Viewpoint",
      "cost": 0
    },
    {
      "name": "Bhushi Dam Visit",
      "cost": 0
    },
    {
      "name": "Lonavala Chikki Market Shopping",
      "cost": 0
    }
  ],
  "Mahabaleshwar": [
    {
      "name": "Venna Lake Boating",
      "cost": 300
    },
    {
      "name": "Pratapgad Fort Visit",
      "cost": 75
    },
    {
      "name": "Wilson Point Sunrise View",
      "cost": 0
    },
    {
      "name": "Mapro Garden Strawberry Farm & Cafe",
      "cost": 0
    },
    {
      "name": "Lingmala Waterfall Visit",
      "cost": 20
    }
  ],
  "Nashik": [
    {
      "name": "Sula Vineyards Wine Tasting Tour",
      "cost": 900
    },
    {
      "name": "Trimbakeshwar Temple Visit",
      "cost": 0
    },
    {
      "name": "Pandavleni Caves",
      "cost": 25
    },
    {
      "name": "Panchavati & Sita Gufa Walk",
      "cost": 0
    },
    {
      "name": "Gangapur Dam Visit",
      "cost": 0
    }
  ],
  "Aurangabad": [
    {
      "name": "Ajanta Caves Tour",
      "cost": 600
    },
    {
      "name": "Ellora Caves (Kailasa Temple) Tour",
      "cost": 600
    },
    {
      "name": "Bibi Ka Maqbara Visit",
      "cost": 25
    },
    {
      "name": "Daulatabad Fort Visit",
      "cost": 25
    },
    {
      "name": "Grishneshwar Temple Darshan",
      "cost": 0
    }
  ],
  "Goa": [
    {
      "name": "Baga Beach Water Sports",
      "cost": 1500
    },
    {
      "name": "Fort Aguada Visit",
      "cost": 0
    },
    {
      "name": "Dudhsagar Falls Jeep Safari",
      "cost": 2000
    },
    {
      "name": "Old Goa Churches (Basilica of Bom Jesus)",
      "cost": 0
    },
    {
      "name": "Anjuna Flea Market",
      "cost": 0
    },
    {
      "name": "Mandovi River Sunset Cruise",
      "cost": 500
    }
  ],
  "Kochi": [
    {
      "name": "Fort Kochi Chinese Fishing Nets Walk",
      "cost": 0
    },
    {
      "name": "Kathakali Dance Show",
      "cost": 400
    },
    {
      "name": "Mattancherry Dutch Palace & Jew Town",
      "cost": 25
    },
    {
      "name": "Cherai Beach Visit",
      "cost": 0
    },
    {
      "name": "Kerala Backwater Day Cruise",
      "cost": 1200
    }
  ],
  "Munnar": [
    {
      "name": "Tea Museum Visit",
      "cost": 150
    },
    {
      "name": "Mattupetty Dam Boating",
      "cost": 100
    },
    {
      "name": "Eravikulam National Park (Nilgiri Tahr)",
      "cost": 125
    },
    {
      "name": "Echo Point Visit",
      "cost": 20
    },
    {
      "name": "Top Station Viewpoint",
      "cost": 0
    }
  ],
  "Alleppey": [
    {
      "name": "Alleppey Houseboat Cruise",
      "cost": 6000
    },
    {
      "name": "Alleppey Beach Visit",
      "cost": 0
    },
    {
      "name": "Pathiramanal Island Cruise",
      "cost": 500
    },
    {
      "name": "Kumarakom Bird Sanctuary",
      "cost": 100
    },
    {
      "name": "Marari Beach Visit",
      "cost": 0
    }
  ],
  "Wayanad": [
    {
      "name": "Edakkal Caves Trek",
      "cost": 50
    },
    {
      "name": "Chembra Peak Trekking",
      "cost": 500
    },
    {
      "name": "Banasura Sagar Dam Boating & Zipline",
      "cost": 300
    },
    {
      "name": "Soochipara Falls Visit",
      "cost": 30
    },
    {
      "name": "Pookode Lake Boating",
      "cost": 100
    }
  ],
  "Thekkady": [
    {
      "name": "Periyar Wildlife Sanctuary Boat Ride",
      "cost": 500
    },
    {
      "name": "Spice Plantation Tour",
      "cost": 400
    },
    {
      "name": "Kathakali Dance Show",
      "cost": 400
    },
    {
      "name": "Elephant Junction Elephant Ride",
      "cost": 1200
    },
    {
      "name": "Bamboo Rafting in Periyar",
      "cost": 1500
    }
  ],
  "Kovalam": [
    {
      "name": "Lighthouse Beach Visit",
      "cost": 0
    },
    {
      "name": "Kovalam Lighthouse Climb",
      "cost": 30
    },
    {
      "name": "Ayurvedic Massage & Spa",
      "cost": 1800
    },
    {
      "name": "Parasailing at Kovalam Beach",
      "cost": 1500
    },
    {
      "name": "Vizhinjam Fishing Village Walk",
      "cost": 0
    }
  ],
  "Bangalore": [
    {
      "name": "Lalbagh Botanical Garden Visit",
      "cost": 30
    },
    {
      "name": "Bangalore Palace Visit",
      "cost": 230
    },
    {
      "name": "Cubbon Park Walk",
      "cost": 0
    },
    {
      "name": "ISKCON Temple Bangalore Visit",
      "cost": 0
    },
    {
      "name": "Bannerghatta National Park Safari",
      "cost": 400
    },
    {
      "name": "Nandi Hills Sunrise Trip",
      "cost": 300
    }
  ],
  "Mysore": [
    {
      "name": "Mysore Palace Visit",
      "cost": 100
    },
    {
      "name": "Mysore Zoo Visit",
      "cost": 100
    },
    {
      "name": "Chamundi Hills Temple Visit",
      "cost": 0
    },
    {
      "name": "Brindavan Gardens Musical Fountain Show",
      "cost": 60
    },
    {
      "name": "Devaraja Market Walk",
      "cost": 0
    }
  ],
  "Coorg": [
    {
      "name": "Abbey Falls Visit",
      "cost": 30
    },
    {
      "name": "Dubare Elephant Camp",
      "cost": 600
    },
    {
      "name": "Raja's Seat Garden Visit",
      "cost": 20
    },
    {
      "name": "Talacauvery Temple Visit",
      "cost": 0
    },
    {
      "name": "Coffee Plantation Tour",
      "cost": 300
    }
  ],
  "Hampi": [
    {
      "name": "Virupaksha Temple Visit",
      "cost": 0
    },
    {
      "name": "Vittala Temple Stone Chariot Visit",
      "cost": 40
    },
    {
      "name": "Royal Enclosure & Hampi Ruins Tour",
      "cost": 40
    },
    {
      "name": "Matanga Hill Sunrise Trek",
      "cost": 0
    },
    {
      "name": "Coracle Ride on Tungabhadra River",
      "cost": 400
    }
  ],
  "Chikmagalur": [
    {
      "name": "Mullayanagiri Peak Trek",
      "cost": 0
    },
    {
      "name": "Baba Budangiri Hills Visit",
      "cost": 0
    },
    {
      "name": "Hebbe Falls Trek",
      "cost": 300
    },
    {
      "name": "Coffee Plantation Tour",
      "cost": 300
    },
    {
      "name": "Kudremukh National Park Trek",
      "cost": 500
    }
  ],
  "Chennai": [
    {
      "name": "Marina Beach Walk",
      "cost": 0
    },
    {
      "name": "Kapaleeshwarar Temple Visit",
      "cost": 0
    },
    {
      "name": "Fort St. George & Museum Visit",
      "cost": 20
    },
    {
      "name": "San Thome Basilica Visit",
      "cost": 0
    },
    {
      "name": "Government Museum Egmore Visit",
      "cost": 20
    }
  ],
  "Ooty": [
    {
      "name": "Nilgiri Mountain Railway Toy Train Ride",
      "cost": 500
    },
    {
      "name": "Doddabetta Peak Visit",
      "cost": 20
    },
    {
      "name": "Ooty Lake Boating",
      "cost": 300
    },
    {
      "name": "Government Botanical Garden Visit",
      "cost": 50
    },
    {
      "name": "Pykara Falls & Lake Visit",
      "cost": 100
    }
  ],
  "Kodaikanal": [
    {
      "name": "Kodaikanal Lake Boating",
      "cost": 250
    },
    {
      "name": "Pillar Rocks Visit",
      "cost": 20
    },
    {
      "name": "Coaker's Walk",
      "cost": 20
    },
    {
      "name": "Bryant Park Visit",
      "cost": 50
    },
    {
      "name": "Silver Cascade Falls Visit",
      "cost": 0
    }
  ],
  "Rameswaram": [
    {
      "name": "Ramanathaswamy Temple Darshan",
      "cost": 0
    },
    {
      "name": "Dhanushkodi Ghost Town Jeep Tour",
      "cost": 500
    },
    {
      "name": "Pamban Bridge Visit",
      "cost": 0
    },
    {
      "name": "Dr. APJ Abdul Kalam Memorial Visit",
      "cost": 0
    },
    {
      "name": "Adam's Bridge Viewpoint",
      "cost": 0
    }
  ],
  "Madurai": [
    {
      "name": "Meenakshi Amman Temple Visit",
      "cost": 0
    },
    {
      "name": "Thirumalai Nayakkar Palace Visit",
      "cost": 50
    },
    {
      "name": "Gandhi Memorial Museum Visit",
      "cost": 0
    },
    {
      "name": "Vandiyur Mariamman Teppakulam Visit",
      "cost": 0
    },
    {
      "name": "Local Flower & Fruit Market Walk",
      "cost": 0
    }
  ],
  "Hyderabad": [
    {
      "name": "Charminar Visit",
      "cost": 25
    },
    {
      "name": "Golconda Fort Visit",
      "cost": 25
    },
    {
      "name": "Ramoji Film City Tour",
      "cost": 1500
    },
    {
      "name": "Chowmahalla Palace Visit",
      "cost": 100
    },
    {
      "name": "Salar Jung Museum Visit",
      "cost": 50
    },
    {
      "name": "Hussain Sagar Lake Boat Ride",
      "cost": 100
    }
  ],
  "Visakhapatnam": [
    {
      "name": "RK Beach Walk",
      "cost": 0
    },
    {
      "name": "Kailasagiri Ropeway Ride",
      "cost": 150
    },
    {
      "name": "INS Kurusura Submarine Museum Visit",
      "cost": 40
    },
    {
      "name": "Borra Caves Visit",
      "cost": 100
    },
    {
      "name": "Araku Valley Day Trip",
      "cost": 600
    }
  ],
  "Tirupati": [
    {
      "name": "Tirumala Venkateswara Temple Darshan",
      "cost": 300
    },
    {
      "name": "Sri Padmavathi Temple, Tiruchanur",
      "cost": 0
    },
    {
      "name": "Akasa Ganga Waterfall Visit",
      "cost": 0
    },
    {
      "name": "Chandragiri Fort Sound and Light Show",
      "cost": 100
    },
    {
      "name": "Sri Venkateswara Zoological Park",
      "cost": 50
    }
  ],
  "Kolkata": [
    {
      "name": "Victoria Memorial Visit",
      "cost": 30
    },
    {
      "name": "Dakshineswar Kali Temple Darshan",
      "cost": 0
    },
    {
      "name": "Howrah Bridge & Mullik Ghat Flower Market Walk",
      "cost": 0
    },
    {
      "name": "Indian Museum Tour",
      "cost": 50
    },
    {
      "name": "Hooghly River Sunset Cruise",
      "cost": 300
    },
    {
      "name": "Park Street Heritage Walk",
      "cost": 0
    }
  ],
  "Darjeeling": [
    {
      "name": "Tiger Hill Sunrise View",
      "cost": 300
    },
    {
      "name": "Darjeeling Himalayan Railway Toy Train Joyride",
      "cost": 1000
    },
    {
      "name": "Padmaja Naidu Himalayan Zoological Park",
      "cost": 100
    },
    {
      "name": "Batasia Loop War Memorial",
      "cost": 20
    },
    {
      "name": "Happy Valley Tea Estate Tour",
      "cost": 100
    },
    {
      "name": "Japanese Peace Pagoda Visit",
      "cost": 0
    }
  ],
  "Kalimpong": [
    {
      "name": "Deolo Hill Park Visit",
      "cost": 30
    },
    {
      "name": "Durpin Dara Monastery & Viewpoint",
      "cost": 0
    },
    {
      "name": "Pine View Nursery (Cactus) Visit",
      "cost": 30
    },
    {
      "name": "Mangal Dham Temple Visit",
      "cost": 0
    },
    {
      "name": "Dr. Graham's Homes Heritage Visit",
      "cost": 0
    }
  ],
  "Sundarbans": [
    {
      "name": "Sundarbans Mangrove Boat Safari",
      "cost": 2500
    },
    {
      "name": "Sajnekhali Wildlife Sanctuary Visit",
      "cost": 150
    },
    {
      "name": "Dobanki Canopy Watch Tower Walk",
      "cost": 100
    },
    {
      "name": "Sudhanyakhali Watch Tower Birdwatching",
      "cost": 100
    },
    {
      "name": "Sundarbans Village & Mangrove Nature Walk",
      "cost": 0
    }
  ],
  "Gangtok": [
    {
      "name": "Tsomgo (Changu) Lake Excursion",
      "cost": 1500
    },
    {
      "name": "Nathula Pass Day Trip",
      "cost": 2500
    },
    {
      "name": "Gangtok Ropeway Cable Car Ride",
      "cost": 150
    },
    {
      "name": "Rumtek Monastery Visit",
      "cost": 0
    },
    {
      "name": "MG Marg Evening Stroll",
      "cost": 0
    },
    {
      "name": "Ban Jhakri Falls Energy Park",
      "cost": 60
    }
  ],
  "Pelling": [
    {
      "name": "Pelling Skywalk & Chenrezig Statue",
      "cost": 50
    },
    {
      "name": "Pemayangtse Monastery Visit",
      "cost": 20
    },
    {
      "name": "Rabdentse Ruins Walk",
      "cost": 25
    },
    {
      "name": "Khecheopalri Wishing Lake Visit",
      "cost": 0
    },
    {
      "name": "Kanchenjunga Falls Visit",
      "cost": 20
    },
    {
      "name": "Singshore Bridge Viewpoint",
      "cost": 0
    }
  ],
  "Lachung": [
    {
      "name": "Yumthang Valley (Valley of Flowers) Excursion",
      "cost": 2000
    },
    {
      "name": "Zero Point Snow Excursion",
      "cost": 1500
    },
    {
      "name": "Lachung Monastery Visit",
      "cost": 0
    },
    {
      "name": "Bhim Nala Waterfall Viewpoint",
      "cost": 0
    },
    {
      "name": "Yumthang Hot Spring Visit",
      "cost": 20
    }
  ],
  "Guwahati": [
    {
      "name": "Kamakhya Temple Darshan",
      "cost": 0
    },
    {
      "name": "Umananda Island Ferry & Temple Visit",
      "cost": 30
    },
    {
      "name": "Brahmaputra Sunset River Cruise",
      "cost": 500
    },
    {
      "name": "Assam State Zoo cum Botanical Garden",
      "cost": 50
    },
    {
      "name": "Srimanta Sankaradeva Kalakshetra Visit",
      "cost": 50
    },
    {
      "name": "Pobitora Wildlife Sanctuary Rhino Safari",
      "cost": 2000
    }
  ],
  "Kaziranga": [
    {
      "name": "Kaziranga Rhino Jeep Safari (Central Range)",
      "cost": 1500
    },
    {
      "name": "Kaziranga Elephant Safari",
      "cost": 1500
    },
    {
      "name": "Kaziranga Orchid & Biodiversity Park Visit",
      "cost": 100
    },
    {
      "name": "Kaziranga Eastern Range Safari & Bird Watching",
      "cost": 1500
    },
    {
      "name": "Kohora Village Nature Walk",
      "cost": 0
    }
  ],
  "Shillong": [
    {
      "name": "Umiam Lake (Barapani) Boating",
      "cost": 150
    },
    {
      "name": "Elephant Falls Visit",
      "cost": 30
    },
    {
      "name": "Shillong Peak Viewpoint",
      "cost": 20
    },
    {
      "name": "Ward's Lake Boating & Stroll",
      "cost": 20
    },
    {
      "name": "Don Bosco Museum Visit",
      "cost": 100
    },
    {
      "name": "Laitlum Canyons Viewpoint",
      "cost": 0
    }
  ],
  "Cherrapunji": [
    {
      "name": "Nohkalikai Falls Viewpoint",
      "cost": 30
    },
    {
      "name": "Mawsmai Cave Exploration",
      "cost": 50
    },
    {
      "name": "Double Decker Living Root Bridge Trek",
      "cost": 500
    },
    {
      "name": "Seven Sisters (Mawsmai) Falls Viewpoint",
      "cost": 20
    },
    {
      "name": "Arwah Limestone Caves Visit",
      "cost": 30
    }
  ],
  "Tawang": [
    {
      "name": "Tawang Monastery Visit",
      "cost": 0
    },
    {
      "name": "Sela Pass Visit",
      "cost": 0
    },
    {
      "name": "Madhuri Lake (Sangetsar Lake) Excursion",
      "cost": 1500
    },
    {
      "name": "Bumla Pass Excursion",
      "cost": 2000
    },
    {
      "name": "Tawang War Memorial Visit",
      "cost": 0
    },
    {
      "name": "Nuranang (Jang) Falls Visit",
      "cost": 0
    }
  ],
  "Port Blair": [
    {
      "name": "Cellular Jail Light and Sound Show",
      "cost": 300
    },
    {
      "name": "Ross Island Ferry Tour",
      "cost": 700
    },
    {
      "name": "Havelock Island Scuba Diving",
      "cost": 4500
    },
    {
      "name": "Radhanagar Beach Visit",
      "cost": 0
    },
    {
      "name": "North Bay Island Snorkeling & Coral Viewing",
      "cost": 1200
    },
    {
      "name": "Corbyn's Cove Beach Visit",
      "cost": 0
    }
  ],
  "Havelock Island": [
    {
      "name": "Radhanagar Beach Visit",
      "cost": 0
    },
    {
      "name": "Scuba Diving at Elephant Beach",
      "cost": 4500
    },
    {
      "name": "Snorkeling at Elephant Beach",
      "cost": 1500
    },
    {
      "name": "Mangrove Kayaking Tour",
      "cost": 1500
    },
    {
      "name": "Sunset Boat Cruise",
      "cost": 1200
    },
    {
      "name": "Glass Bottom Boat Ride",
      "cost": 800
    }
  ],
  "Rann of Kutch": [
    {
      "name": "Rann Utsav White Desert Safari",
      "cost": 1500
    },
    {
      "name": "Camel Cart Ride at White Rann",
      "cost": 400
    },
    {
      "name": "Kala Dungar Sunset Point Visit",
      "cost": 200
    },
    {
      "name": "Kutch Museum Tour",
      "cost": 50
    },
    {
      "name": "Hodka Village Handicraft Tour",
      "cost": 600
    },
    {
      "name": "Aina Mahal Palace Visit",
      "cost": 100
    }
  ],
  "Ahmedabad": [
    {
      "name": "Sabarmati Ashram Tour",
      "cost": 0
    },
    {
      "name": "Adalaj Stepwell Visit",
      "cost": 0
    },
    {
      "name": "Sidi Saiyyed Mosque Jali Viewing",
      "cost": 0
    },
    {
      "name": "Kankaria Lake Boating",
      "cost": 150
    },
    {
      "name": "Akshardham Temple Visit",
      "cost": 170
    },
    {
      "name": "Auto World Vintage Car Museum",
      "cost": 150
    }
  ],
  "Dwarka": [
    {
      "name": "Dwarkadhish Temple Darshan",
      "cost": 0
    },
    {
      "name": "Nageshwar Jyotirlinga Visit",
      "cost": 0
    },
    {
      "name": "Rukmini Devi Temple Visit",
      "cost": 0
    },
    {
      "name": "Beyt Dwarka Boat Trip",
      "cost": 150
    },
    {
      "name": "Shivrajpur Beach Visit",
      "cost": 0
    },
    {
      "name": "Gomti Ghat Walk",
      "cost": 0
    }
  ],
  "Diu": [
    {
      "name": "Diu Fort Exploration",
      "cost": 25
    },
    {
      "name": "Nagoa Beach Visit",
      "cost": 0
    },
    {
      "name": "INS Khukri War Memorial",
      "cost": 0
    },
    {
      "name": "Naida Caves Walk",
      "cost": 0
    },
    {
      "name": "St Paul's Church Visit",
      "cost": 0
    },
    {
      "name": "Water Sports at Ghogla Beach",
      "cost": 1000
    }
  ],
  "Khajuraho": [
    {
      "name": "Khajuraho Temples Tour (Western Group)",
      "cost": 40
    },
    {
      "name": "Light and Sound Show at Temples",
      "cost": 300
    },
    {
      "name": "Raneh Falls Excursion",
      "cost": 500
    },
    {
      "name": "Panna National Park Tiger Safari",
      "cost": 3000
    },
    {
      "name": "Ajaigarh Fort Day Trip",
      "cost": 1500
    },
    {
      "name": "Eastern Group Jain Temples Visit",
      "cost": 0
    }
  ],
  "Pachmarhi": [
    {
      "name": "Bee Falls Trek",
      "cost": 50
    },
    {
      "name": "Pandav Caves Visit",
      "cost": 50
    },
    {
      "name": "Dhupgarh Sunset Point",
      "cost": 50
    },
    {
      "name": "Satpura National Park Jungle Safari",
      "cost": 2500
    },
    {
      "name": "Duchess Falls Trek",
      "cost": 50
    },
    {
      "name": "Rajat Prapat Viewpoint",
      "cost": 50
    }
  ],
  "Bhopal": [
    {
      "name": "Upper Lake Boat Ride",
      "cost": 200
    },
    {
      "name": "Bhimbetka Rock Shelters Excursion",
      "cost": 40
    },
    {
      "name": "Taj-ul-Masjid Visit",
      "cost": 0
    },
    {
      "name": "Van Vihar National Park Safari",
      "cost": 200
    },
    {
      "name": "Sanchi Stupa Day Trip",
      "cost": 35
    },
    {
      "name": "State Museum Visit",
      "cost": 50
    }
  ],
  "Puri": [
    {
      "name": "Jagannath Temple Darshan",
      "cost": 0
    },
    {
      "name": "Puri Beach Walk",
      "cost": 0
    },
    {
      "name": "Konark Sun Temple Day Trip",
      "cost": 40
    },
    {
      "name": "Chilika Lake Dolphin Boat Safari",
      "cost": 700
    },
    {
      "name": "Raghurajpur Artist Village Tour",
      "cost": 0
    },
    {
      "name": "Puri Light House Visit",
      "cost": 20
    }
  ],
  "Bhubaneswar": [
    {
      "name": "Lingaraj Temple Visit",
      "cost": 0
    },
    {
      "name": "Udayagiri and Khandagiri Caves",
      "cost": 40
    },
    {
      "name": "Nandankanan Zoological Park Safari",
      "cost": 300
    },
    {
      "name": "Dhauli Peace Pagoda Visit",
      "cost": 0
    },
    {
      "name": "Mukteshwar Temple Visit",
      "cost": 0
    },
    {
      "name": "ISKCON Temple Visit",
      "cost": 0
    }
  ],
  "Chandigarh": [
    {
      "name": "Rock Garden Visit",
      "cost": 40
    },
    {
      "name": "Sukhna Lake Boating",
      "cost": 150
    },
    {
      "name": "Zakir Hussain Rose Garden Walk",
      "cost": 0
    },
    {
      "name": "Chandigarh Capitol Complex Tour",
      "cost": 0
    },
    {
      "name": "Elante Mall Shopping",
      "cost": 0
    },
    {
      "name": "Japanese Garden Visit",
      "cost": 0
    }
  ],
  "Amritsar": [
    {
      "name": "Golden Temple Visit",
      "cost": 0
    },
    {
      "name": "Wagah Border Retreat Ceremony",
      "cost": 0
    },
    {
      "name": "Jallianwala Bagh Visit",
      "cost": 0
    },
    {
      "name": "Partition Museum Tour",
      "cost": 50
    },
    {
      "name": "Maharaja Ranjit Singh Museum",
      "cost": 20
    },
    {
      "name": "City on Pedals Cycle Tour",
      "cost": 500
    }
  ]
};

async function handle(request) {
  const requiredToken = process.env.SETUP_TOKEN;
  if (!requiredToken) {
    return NextResponse.json({ message: "Setup is disabled (SETUP_TOKEN not configured)." }, { status: 403 });
  }
  const { searchParams } = new URL(request.url);
  const suppliedToken = searchParams.get("token") || request.headers.get("x-setup-token");
  if (suppliedToken !== requiredToken) {
    return NextResponse.json({ message: "Invalid or missing setup token." }, { status: 401 });
  }

  const destinations = await prisma.destination.findMany({
    where: {
      name: { in: Object.keys(CITY_ACTIVITIES) },
    },
  });

  const toFill = destinations.filter(
    (dest) => !(Array.isArray(dest.activities) && dest.activities.length > 0) && CITY_ACTIVITIES[dest.name],
  );
  const skipped = destinations.length - toFill.length;

  // Parallelize — sequential awaits over hundreds of rows (every admin's own
  // copy of each seeded destination) is what timed out the function before.
  const BATCH_SIZE = 20;
  let filled = 0;
  for (let i = 0; i < toFill.length; i += BATCH_SIZE) {
    const batch = toFill.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map((dest) =>
        prisma.destination.update({
          where: { id: dest.id },
          data: { activities: CITY_ACTIVITIES[dest.name] },
        }),
      ),
    );
    filled += batch.length;
  }

  return NextResponse.json({
    message: `Filled activities for ${filled} destinations (${skipped} already had some, skipped).`,
    filled,
    skipped,
    total_matched: destinations.length,
  });
}

export const GET = handle;
export const POST = handle;
