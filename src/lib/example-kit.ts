import type { Kit } from "./kit";

/**
 * The example kit on /kits: a real run (25 Oct 2026) for the fictional Margaret, born 1950, grew up in Manchester,
 * likes Dusty Springfield. Only what the page shows; Qloo entity ids are removed. Read-only: no response log.
 */
export const EXAMPLE_KIT_ID = "example";

export const EXAMPLE_KIT: Kit = {
  "id": "example",
  "era": {
    "to": 1975,
    "from": 1965,
    "decades": [
      {
        "short": "70s",
        "start": 1970,
        "years": 6
      },
      {
        "short": "60s",
        "start": 1960,
        "years": 5
      }
    ]
  },
  "brief": {
    "name": "Margaret",
    "likes": [
      "Dusty Springfield"
    ],
    "place": "Manchester",
    "birthYear": 1950
  },
  "items": [
    {
      "by": {
        "ref": "A12",
        "title": "The Kinks"
      },
      "ref": "S1",
      "via": null,
      "why": "A gentle London song that was all over the radio in Margaret's late teens, a soft way to settle in.",
      "type": "song",
      "year": 1967,
      "check": "musicbrainz",
      "links": {
        "spotify": "https://open.spotify.com/search/The%20Kinks%20Waterloo%20Sunset",
        "youtube": "https://www.youtube.com/results?search_query=The%20Kinks%20Waterloo%20Sunset"
      },
      "phase": "calm",
      "title": "Waterloo Sunset",
      "source": "AI pick, confirmed on MusicBrainz: a recording by The Kinks (A12)",
      "minutes": 3,
      "entityId": null
    },
    {
      "by": {
        "ref": "A6",
        "title": "Barbra Streisand"
      },
      "ref": "S2",
      "via": null,
      "why": "A slow, warm ballad from the early 70s, when Margaret was in their twenties; let them listen without any questions.",
      "type": "song",
      "year": 1973,
      "check": "unchecked",
      "links": {
        "spotify": "https://open.spotify.com/search/Barbra%20Streisand%20The%20Way%20We%20Were",
        "youtube": "https://www.youtube.com/results?search_query=Barbra%20Streisand%20The%20Way%20We%20Were"
      },
      "phase": "calm",
      "title": "The Way We Were",
      "source": "AI pick: a recording by Barbra Streisand (A6)",
      "minutes": 3,
      "entityId": null
    },
    {
      "by": {
        "ref": "A16",
        "title": "Bee Gees"
      },
      "ref": "S3",
      "via": null,
      "why": "A smooth, easy Bee Gees ballad that fits Margaret's love of Dusty Springfield and keeps the pace unhurried.",
      "type": "song",
      "year": 1971,
      "check": "musicbrainz",
      "links": {
        "spotify": "https://open.spotify.com/search/Bee%20Gees%20How%20Can%20You%20Mend%20a%20Broken%20Heart",
        "youtube": "https://www.youtube.com/results?search_query=Bee%20Gees%20How%20Can%20You%20Mend%20a%20Broken%20Heart"
      },
      "phase": "calm",
      "title": "How Can You Mend a Broken Heart",
      "source": "AI pick, confirmed on MusicBrainz: a recording by Bee Gees (A16)",
      "minutes": 3,
      "entityId": null
    },
    {
      "by": {
        "ref": "A9",
        "title": "Dusty Springfield"
      },
      "ref": "S4",
      "via": null,
      "why": "The family named Dusty, and this was a big hit when Margaret was a teenager in Manchester.",
      "type": "song",
      "year": 1966,
      "check": "musicbrainz",
      "links": {
        "spotify": "https://open.spotify.com/search/Dusty%20Springfield%20You%20Don't%20Have%20to%20Say%20You%20Love%20Me",
        "youtube": "https://www.youtube.com/results?search_query=Dusty%20Springfield%20You%20Don't%20Have%20to%20Say%20You%20Love%20Me"
      },
      "phase": "familiar",
      "title": "You Don't Have to Say You Love Me",
      "source": "AI pick, confirmed on MusicBrainz: a recording by Dusty Springfield (A9)",
      "minutes": 3,
      "entityId": null
    },
    {
      "by": {
        "ref": "A5",
        "title": "Rod Stewart"
      },
      "ref": "S5",
      "via": null,
      "why": "A radio favourite of the early 70s that many people in Manchester would have known by heart.",
      "type": "song",
      "year": 1971,
      "check": "musicbrainz",
      "links": {
        "spotify": "https://open.spotify.com/search/Rod%20Stewart%20Maggie%20May",
        "youtube": "https://www.youtube.com/results?search_query=Rod%20Stewart%20Maggie%20May"
      },
      "phase": "familiar",
      "title": "Maggie May",
      "source": "AI pick, confirmed on MusicBrainz: a recording by Rod Stewart (A5)",
      "minutes": 3,
      "entityId": null
    },
    {
      "by": {
        "ref": "A10",
        "title": "The Beatles"
      },
      "ref": "S6",
      "via": null,
      "why": "The famous 'na na na' ending is easy to join in with, and Margaret may like being invited to sing along.",
      "type": "song",
      "year": 1968,
      "check": "musicbrainz",
      "links": {
        "spotify": "https://open.spotify.com/search/The%20Beatles%20Hey%20Jude",
        "youtube": "https://www.youtube.com/results?search_query=The%20Beatles%20Hey%20Jude"
      },
      "phase": "singalong",
      "title": "Hey Jude",
      "source": "AI pick, confirmed on MusicBrainz: a recording by The Beatles (A10)",
      "minutes": 3,
      "entityId": null
    },
    {
      "by": {
        "ref": "A17",
        "title": "Bill Withers"
      },
      "ref": "S7",
      "via": null,
      "why": "A simple, warm chorus that is easy to join, so everyone can hum or sing along.",
      "type": "song",
      "year": 1972,
      "check": "musicbrainz",
      "links": {
        "spotify": "https://open.spotify.com/search/Bill%20Withers%20Lean%20on%20Me",
        "youtube": "https://www.youtube.com/results?search_query=Bill%20Withers%20Lean%20on%20Me"
      },
      "phase": "singalong",
      "title": "Lean on Me",
      "source": "AI pick, confirmed on MusicBrainz: a recording by Bill Withers (A17)",
      "minutes": 3,
      "entityId": null
    },
    {
      "by": {
        "ref": "A2",
        "title": "ABBA"
      },
      "ref": "S8",
      "via": null,
      "why": "A bright, upbeat finish from the mid-70s that gets feet tapping and voices joining in.",
      "type": "song",
      "year": 1974,
      "check": "musicbrainz",
      "links": {
        "spotify": "https://open.spotify.com/search/ABBA%20Waterloo",
        "youtube": "https://www.youtube.com/results?search_query=ABBA%20Waterloo"
      },
      "phase": "singalong",
      "title": "Waterloo",
      "source": "AI pick, confirmed on MusicBrainz: a recording by ABBA (A2)",
      "minutes": 3,
      "entityId": null
    },
    {
      "ref": "A1",
      "via": "notonq",
      "why": null,
      "type": "artist",
      "year": null,
      "title": "Snoopy",
      "source": "Qloo: 70s music, popular around Manchester, United Kingdom",
      "entityId": null
    },
    {
      "ref": "A2",
      "via": "notonq",
      "why": null,
      "type": "artist",
      "year": null,
      "title": "ABBA",
      "source": "Qloo: 70s music, popular around Manchester, United Kingdom",
      "entityId": null
    },
    {
      "ref": "A3",
      "via": "notonq",
      "why": null,
      "type": "artist",
      "year": null,
      "title": "Ringo Starr",
      "source": "Qloo: 70s music, popular around Manchester, United Kingdom",
      "entityId": null
    },
    {
      "ref": "A4",
      "via": "notonq",
      "why": null,
      "type": "artist",
      "year": null,
      "title": "Steven Tyler",
      "source": "Qloo: 70s music, popular around Manchester, United Kingdom",
      "entityId": null
    },
    {
      "ref": "A5",
      "via": "notonq",
      "why": null,
      "type": "artist",
      "year": null,
      "title": "Rod Stewart",
      "source": "Qloo: 70s music, popular around Manchester, United Kingdom",
      "entityId": null
    },
    {
      "ref": "A6",
      "via": "notonq",
      "why": null,
      "type": "artist",
      "year": null,
      "title": "Barbra Streisand",
      "source": "Qloo: 70s music, popular around Manchester, United Kingdom",
      "entityId": null
    },
    {
      "ref": "A7",
      "via": "notonq",
      "why": null,
      "type": "artist",
      "year": null,
      "title": "Sister Sledge",
      "source": "Qloo: 70s music, popular around Manchester, United Kingdom",
      "entityId": null
    },
    {
      "ref": "A8",
      "via": "notonq",
      "why": null,
      "type": "artist",
      "year": null,
      "title": "Electric Light Orchestra",
      "source": "Qloo: 70s music, popular around Manchester, United Kingdom",
      "entityId": null
    },
    {
      "ref": "A9",
      "via": "notonq",
      "why": null,
      "type": "artist",
      "year": null,
      "title": "Dusty Springfield",
      "source": "Qloo: the artist the family named",
      "entityId": null
    },
    {
      "ref": "F1",
      "via": "notonq",
      "why": "Ask if Margaret ever went to the pictures to see it, and who they went with.",
      "type": "film",
      "year": 1965,
      "title": "The Sound of Music",
      "source": "Qloo: films from 1965–1975, popular around Manchester, United Kingdom",
      "entityId": null
    },
    {
      "ref": "F2",
      "via": "notonq",
      "why": null,
      "type": "film",
      "year": 1967,
      "title": "The Jungle Book",
      "source": "Qloo: films from 1965–1975, popular around Manchester, United Kingdom",
      "entityId": null
    },
    {
      "ref": "F3",
      "via": "notonq",
      "why": null,
      "type": "film",
      "year": 1973,
      "title": "Papillon",
      "source": "Qloo: films from 1965–1975, popular around Manchester, United Kingdom",
      "entityId": null
    },
    {
      "ref": "F4",
      "via": "notonq",
      "why": null,
      "type": "film",
      "year": 1972,
      "title": "The Godfather",
      "source": "Qloo: films from 1965–1975, popular around Manchester, United Kingdom",
      "entityId": null
    },
    {
      "ref": "F5",
      "via": "notonq",
      "why": null,
      "type": "film",
      "year": 1966,
      "title": "Who's Afraid of Virginia Woolf?",
      "source": "Qloo: films from 1965–1975, popular around Manchester, United Kingdom",
      "entityId": null
    },
    {
      "ref": "F6",
      "via": "notonq",
      "why": null,
      "type": "film",
      "year": 1973,
      "title": "American Graffiti",
      "source": "Qloo: films from 1965–1975, popular around Manchester, United Kingdom",
      "entityId": null
    },
    {
      "ref": "P1",
      "via": "notonq",
      "why": null,
      "type": "place",
      "year": null,
      "title": "The University of Manchester",
      "source": "Qloo: historic places in Manchester, United Kingdom, still there today",
      "entityId": null,
      "description": "Large civic research university centered on Oxford Road in Manchester city centre, with multiple campuses and a public museum showcasing art and natural history."
    },
    {
      "ref": "P2",
      "via": "notonq",
      "why": null,
      "type": "place",
      "year": null,
      "title": "Manchester Art Gallery",
      "source": "Qloo: historic places in Manchester, United Kingdom, still there today",
      "entityId": null,
      "description": "Historic collection of artworks spanning six centuries, with rotating historic and contemporary exhibitions, educational programming and family events in central Manchester."
    },
    {
      "ref": "P3",
      "via": "notonq",
      "why": null,
      "type": "place",
      "year": null,
      "title": "O2 Ritz Manchester",
      "source": "Qloo: historic places in Manchester, United Kingdom, still there today",
      "entityId": null,
      "description": "Intimate, longstanding Manchester live-music venue with excellent sound, welcoming staff and robust accessibility support, hosting a wide range of concerts and events."
    },
    {
      "ref": "P4",
      "via": "notonq",
      "why": null,
      "type": "place",
      "year": null,
      "title": "Albert Hall, Manchester",
      "source": "Qloo: historic places in Manchester, United Kingdom, still there today",
      "entityId": null,
      "description": "Grade II-listed former Wesleyan chapel converted to a balconied live-music venue with stained-glass windows and a city-centre events space hosting major acts."
    },
    {
      "ref": "P5",
      "via": "notonq",
      "why": null,
      "type": "place",
      "year": null,
      "title": "Old Trafford Cricket Ground",
      "source": "Qloo: historic places in Manchester, United Kingdom, still there today",
      "entityId": null,
      "description": "Historic international Test-match cricket venue and home of Lancashire County Cricket Club, hosting major events and offering on-site hotel and premium hospitality."
    },
    {
      "ref": "P6",
      "via": "notonq",
      "why": "Mention the grand hotel in the city centre and ask if they ever went for a special tea or occasion.",
      "type": "place",
      "year": null,
      "title": "The Midland",
      "source": "Qloo: historic places in Manchester, United Kingdom, still there today",
      "entityId": null,
      "description": "Grand Edwardian hotel with plush rooms, upscale dining, luxe spa, and unique lift system, located near Manchester Central and Opera House."
    },
    {
      "ref": "P7",
      "via": "notonq",
      "why": null,
      "type": "place",
      "year": null,
      "title": "John Rylands Research Institute and Library",
      "source": "Qloo: historic places in Manchester, United Kingdom, still there today",
      "entityId": null,
      "description": "Neo-Gothic research library, part of the University of Manchester, housing rare books, manuscripts, public reading rooms, a café and a shop."
    },
    {
      "ref": "P8",
      "via": "notonq",
      "why": "Ask whether Margaret ever went to a show at the Palace Theatre in Manchester, and what they wore.",
      "type": "place",
      "year": null,
      "title": "Palace Theatre Manchester",
      "source": "Qloo: historic places in Manchester, United Kingdom, still there today",
      "entityId": null,
      "description": "Grand Victorian auditorium in central Manchester hosting touring theatre, opera, ballet, musicals and concerts."
    },
    {
      "ref": "A10",
      "via": "notonq",
      "why": null,
      "type": "artist",
      "year": null,
      "title": "The Beatles",
      "source": "Qloo: 60s music, popular around Manchester, United Kingdom",
      "entityId": null
    },
    {
      "ref": "A11",
      "via": "notonq",
      "why": null,
      "type": "artist",
      "year": null,
      "title": "Twiggy",
      "source": "Qloo: 60s music, popular around Manchester, United Kingdom",
      "entityId": null
    },
    {
      "ref": "A12",
      "via": "notonq",
      "why": null,
      "type": "artist",
      "year": null,
      "title": "The Kinks",
      "source": "Qloo: 60s music, popular around Manchester, United Kingdom",
      "entityId": null
    },
    {
      "ref": "A13",
      "via": "notonq",
      "why": null,
      "type": "artist",
      "year": null,
      "title": "Dave Davies",
      "source": "Qloo: 60s music, popular around Manchester, United Kingdom",
      "entityId": null
    },
    {
      "ref": "A14",
      "via": "notonq",
      "why": null,
      "type": "artist",
      "year": null,
      "title": "Yolanda",
      "source": "Qloo: 60s music, popular around Manchester, United Kingdom",
      "entityId": null
    },
    {
      "ref": "A15",
      "via": "notonq",
      "why": null,
      "type": "artist",
      "year": null,
      "title": "Brian Wilson",
      "source": "Qloo: 60s music, popular around Manchester, United Kingdom",
      "entityId": null
    },
    {
      "ref": "A16",
      "via": "notonq",
      "why": null,
      "type": "artist",
      "year": null,
      "title": "Bee Gees",
      "source": "Qloo: 70s artists liked by Dusty Springfield's fans",
      "entityId": null
    },
    {
      "ref": "A17",
      "via": "notonq",
      "why": null,
      "type": "artist",
      "year": null,
      "title": "Bill Withers",
      "source": "Qloo: 70s artists liked by Dusty Springfield's fans",
      "entityId": null
    },
    {
      "ref": "A18",
      "via": "notonq",
      "why": null,
      "type": "artist",
      "year": null,
      "title": "Cass Elliot",
      "source": "Qloo: 70s artists liked by Dusty Springfield's fans",
      "entityId": null
    },
    {
      "ref": "T1",
      "via": "notonq",
      "why": null,
      "type": "tv",
      "year": 1971,
      "title": "Columbo",
      "source": "Qloo: TV from 1965–1975",
      "entityId": null
    },
    {
      "ref": "T2",
      "via": "notonq",
      "why": null,
      "type": "tv",
      "year": 1966,
      "title": "Star Trek",
      "source": "Qloo: TV from 1965–1975",
      "entityId": null
    },
    {
      "ref": "T3",
      "via": "notonq",
      "why": "Bring up the famous hotel and ask whether they ever laughed along with the family or friends.",
      "type": "tv",
      "year": 1975,
      "title": "Fawlty Towers",
      "source": "Qloo: TV from 1965–1975",
      "entityId": null
    },
    {
      "ref": "T4",
      "via": "notonq",
      "why": "Mention the silly sketches on the telly in the late 60s and ask if they had a favourite.",
      "type": "tv",
      "year": 1969,
      "title": "Monty Python's Flying Circus",
      "source": "Qloo: TV from 1965–1975",
      "entityId": null
    }
  ],
  "model": "anthropic/claude-sonnet-5.5",
  "place": "Manchester, United Kingdom",
  "prompts": [
    {
      "refs": [
        "A9"
      ],
      "text": "Dusty Springfield was a big name when you were a teenager in Manchester. What did you like about her voice?"
    },
    {
      "refs": [
        "A10"
      ],
      "text": "Hey Jude was on the radio everywhere in 1968. Who would you have listened to it with?"
    },
    {
      "refs": [
        "F1"
      ],
      "text": "The Sound of Music was on at picture houses across Manchester. Who would you have gone to see it with?"
    },
    {
      "refs": [
        "T4",
        "T3"
      ],
      "text": "Monty Python and Fawlty Towers had many people laughing at home. Did you have a favourite, or someone you liked to watch with?"
    },
    {
      "refs": [
        "P8"
      ],
      "text": "The Palace Theatre has been a Manchester night out for a very long time. What would a good evening out have looked like for you?"
    },
    {
      "refs": [
        "P6"
      ],
      "text": "The Midland Hotel is such a grand building in the city centre. Did you ever have a special day or treat near there?"
    }
  ],
  "sources": {
    "qloo": 0,
    "notonq": 0,
    "fellBack": 0
  },
  "summary": "A kit for Margaret that starts with gentle ballads, moves to Dusty Springfield and radio favourites, and ends with big singalongs, with films, TV and Manchester places to chat about.",
  "createdAt": "2026-10-25T08:13:37.704Z"
};
