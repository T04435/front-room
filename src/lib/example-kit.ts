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
        "ref": "A9",
        "title": "Dusty Springfield"
      },
      "ref": "S1",
      "via": null,
      "why": "The family named Dusty Springfield, so this gentle, much-loved ballad from Margaret's teens is a warm place to start.",
      "type": "song",
      "year": 1966,
      "check": "musicbrainz",
      "links": {
        "spotify": "https://open.spotify.com/search/Dusty%20Springfield%20You%20Don't%20Have%20to%20Say%20You%20Love%20Me",
        "youtube": "https://www.youtube.com/results?search_query=Dusty%20Springfield%20You%20Don't%20Have%20to%20Say%20You%20Love%20Me"
      },
      "parts": [
        "artist",
        "Qloo",
        "MusicBrainz"
      ],
      "phase": "calm",
      "title": "You Don't Have to Say You Love Me",
      "source": "A recording by Dusty Springfield, checked on MusicBrainz",
      "addedBy": "family",
      "minutes": 3,
      "entityId": null
    },
    {
      "by": {
        "ref": "A10",
        "title": "The Beatles"
      },
      "ref": "S2",
      "via": null,
      "why": "A slow, quiet Beatles song that was all over the radio when Margaret was 15.",
      "type": "song",
      "year": 1965,
      "check": "musicbrainz",
      "links": {
        "spotify": "https://open.spotify.com/search/The%20Beatles%20Yesterday",
        "youtube": "https://www.youtube.com/results?search_query=The%20Beatles%20Yesterday"
      },
      "parts": [
        "60s",
        "Manchester",
        "Qloo",
        "MusicBrainz"
      ],
      "phase": "calm",
      "title": "Yesterday",
      "source": "A recording by The Beatles, checked on MusicBrainz",
      "minutes": 3,
      "entityId": null
    },
    {
      "by": {
        "ref": "A5",
        "title": "Rod Stewart"
      },
      "ref": "S3",
      "via": null,
      "why": "A huge radio hit of the early seventies, and it shares a name with them, which may bring a smile.",
      "type": "song",
      "year": 1971,
      "check": "musicbrainz",
      "links": {
        "spotify": "https://open.spotify.com/search/Rod%20Stewart%20Maggie%20May",
        "youtube": "https://www.youtube.com/results?search_query=Rod%20Stewart%20Maggie%20May"
      },
      "parts": [
        "70s",
        "Manchester",
        "Qloo",
        "MusicBrainz"
      ],
      "phase": "familiar",
      "title": "Maggie May",
      "source": "A recording by Rod Stewart, checked on MusicBrainz",
      "minutes": 3,
      "entityId": null
    },
    {
      "by": {
        "ref": "A12",
        "title": "The Kinks"
      },
      "ref": "S4",
      "via": null,
      "why": "A cheeky, bouncy chorus that was a favourite at parties and on the jukebox.",
      "type": "song",
      "year": 1970,
      "check": "musicbrainz",
      "links": {
        "spotify": "https://open.spotify.com/search/The%20Kinks%20Lola",
        "youtube": "https://www.youtube.com/results?search_query=The%20Kinks%20Lola"
      },
      "parts": [
        "60s",
        "Manchester",
        "Qloo",
        "MusicBrainz"
      ],
      "phase": "singalong",
      "title": "Lola",
      "source": "A recording by The Kinks, checked on MusicBrainz",
      "minutes": 3,
      "entityId": null
    },
    {
      "by": {
        "ref": "A2",
        "title": "ABBA"
      },
      "ref": "S5",
      "via": null,
      "why": "A big, bright chorus that had the whole country singing along in 1974, a good finish.",
      "type": "song",
      "year": 1974,
      "check": "musicbrainz",
      "links": {
        "spotify": "https://open.spotify.com/search/ABBA%20Waterloo",
        "youtube": "https://www.youtube.com/results?search_query=ABBA%20Waterloo"
      },
      "parts": [
        "70s",
        "Manchester",
        "Qloo",
        "MusicBrainz"
      ],
      "phase": "singalong",
      "title": "Waterloo",
      "source": "A recording by ABBA, checked on MusicBrainz",
      "minutes": 3,
      "entityId": null
    },
    {
      "ref": "A1",
      "via": "notonq",
      "why": null,
      "type": "artist",
      "year": null,
      "parts": [
        "70s",
        "Manchester",
        "Qloo"
      ],
      "title": "Snoopy",
      "source": "Qloo taste data: artists popular with people from Manchester in the 70s.",
      "entityId": null
    },
    {
      "ref": "A2",
      "via": "notonq",
      "why": null,
      "type": "artist",
      "year": null,
      "parts": [
        "70s",
        "Manchester",
        "Qloo"
      ],
      "title": "ABBA",
      "source": "Qloo taste data: artists popular with people from Manchester in the 70s.",
      "entityId": null
    },
    {
      "ref": "A3",
      "via": "notonq",
      "why": null,
      "type": "artist",
      "year": null,
      "parts": [
        "70s",
        "Manchester",
        "Qloo"
      ],
      "title": "Ringo Starr",
      "source": "Qloo taste data: artists popular with people from Manchester in the 70s.",
      "entityId": null
    },
    {
      "ref": "A4",
      "via": "notonq",
      "why": null,
      "type": "artist",
      "year": null,
      "parts": [
        "70s",
        "Manchester",
        "Qloo"
      ],
      "title": "Steven Tyler",
      "source": "Qloo taste data: artists popular with people from Manchester in the 70s.",
      "entityId": null
    },
    {
      "ref": "A5",
      "via": "notonq",
      "why": null,
      "type": "artist",
      "year": null,
      "parts": [
        "70s",
        "Manchester",
        "Qloo"
      ],
      "title": "Rod Stewart",
      "source": "Qloo taste data: artists popular with people from Manchester in the 70s.",
      "entityId": null
    },
    {
      "ref": "A6",
      "via": "notonq",
      "why": null,
      "type": "artist",
      "year": null,
      "parts": [
        "70s",
        "Manchester",
        "Qloo"
      ],
      "title": "Barbra Streisand",
      "source": "Qloo taste data: artists popular with people from Manchester in the 70s.",
      "entityId": null
    },
    {
      "ref": "A7",
      "via": "notonq",
      "why": null,
      "type": "artist",
      "year": null,
      "parts": [
        "70s",
        "Manchester",
        "Qloo"
      ],
      "title": "Sister Sledge",
      "source": "Qloo taste data: artists popular with people from Manchester in the 70s.",
      "entityId": null
    },
    {
      "ref": "A8",
      "via": "notonq",
      "why": null,
      "type": "artist",
      "year": null,
      "parts": [
        "70s",
        "Manchester",
        "Qloo"
      ],
      "title": "Electric Light Orchestra",
      "source": "Qloo taste data: artists popular with people from Manchester in the 70s.",
      "entityId": null
    },
    {
      "ref": "A9",
      "via": "notonq",
      "why": null,
      "type": "artist",
      "year": null,
      "parts": [
        "artist",
        "Qloo"
      ],
      "title": "Dusty Springfield",
      "source": "The family named Dusty Springfield; Qloo knows them.",
      "addedBy": "family",
      "entityId": null
    },
    {
      "ref": "F1",
      "via": "notonq",
      "why": "Ask if Margaret went to see it at the pictures, and who with, then let them tell the story.",
      "type": "film",
      "year": 1965,
      "parts": [
        "film",
        "1965",
        "Qloo"
      ],
      "title": "The Sound of Music",
      "source": "Qloo taste data: films from 1965–75, popular with people from Manchester.",
      "entityId": null
    },
    {
      "ref": "F2",
      "via": "notonq",
      "why": null,
      "type": "film",
      "year": 1967,
      "parts": [
        "film",
        "1967",
        "Qloo"
      ],
      "title": "The Jungle Book",
      "source": "Qloo taste data: films from 1965–75, popular with people from Manchester.",
      "entityId": null
    },
    {
      "ref": "F3",
      "via": "notonq",
      "why": null,
      "type": "film",
      "year": 1973,
      "parts": [
        "film",
        "1973",
        "Qloo"
      ],
      "title": "Papillon",
      "source": "Qloo taste data: films from 1965–75, popular with people from Manchester.",
      "entityId": null
    },
    {
      "ref": "F4",
      "via": "notonq",
      "why": null,
      "type": "film",
      "year": 1972,
      "parts": [
        "film",
        "1972",
        "Qloo"
      ],
      "title": "The Godfather",
      "source": "Qloo taste data: films from 1965–75, popular with people from Manchester.",
      "entityId": null
    },
    {
      "ref": "F5",
      "via": "notonq",
      "why": null,
      "type": "film",
      "year": 1966,
      "parts": [
        "film",
        "1966",
        "Qloo"
      ],
      "title": "Who's Afraid of Virginia Woolf?",
      "source": "Qloo taste data: films from 1965–75, popular with people from Manchester.",
      "entityId": null
    },
    {
      "ref": "F6",
      "via": "notonq",
      "why": null,
      "type": "film",
      "year": 1973,
      "parts": [
        "film",
        "1973",
        "Qloo"
      ],
      "title": "American Graffiti",
      "source": "Qloo taste data: films from 1965–75, popular with people from Manchester.",
      "entityId": null
    },
    {
      "ref": "P1",
      "via": "notonq",
      "why": null,
      "type": "place",
      "year": null,
      "parts": [
        "place",
        "Manchester",
        "Qloo"
      ],
      "title": "The University of Manchester",
      "source": "Qloo: a long-standing place in Manchester, still there today.",
      "entityId": null,
      "description": "Large civic research university centered on Oxford Road in Manchester city centre, with multiple campuses and a public museum showcasing art and natural history."
    },
    {
      "ref": "P2",
      "via": "notonq",
      "why": null,
      "type": "place",
      "year": null,
      "parts": [
        "place",
        "Manchester",
        "Qloo"
      ],
      "title": "Manchester Art Gallery",
      "source": "Qloo: a long-standing place in Manchester, still there today.",
      "entityId": null,
      "description": "Historic collection of artworks spanning six centuries, with rotating historic and contemporary exhibitions, educational programming and family events in central Manchester."
    },
    {
      "ref": "P3",
      "via": "notonq",
      "why": "Ask whether Margaret ever went to the Ritz in Manchester for a dance, and what they wore.",
      "type": "place",
      "year": null,
      "parts": [
        "place",
        "Manchester",
        "Qloo"
      ],
      "title": "The Ritz, Manchester",
      "source": "Qloo: a long-standing place in Manchester, still there today.",
      "entityId": null,
      "description": "Intimate, longstanding Manchester live-music venue with excellent sound, welcoming staff and robust accessibility support, hosting a wide range of concerts and events."
    },
    {
      "ref": "P4",
      "via": "notonq",
      "why": null,
      "type": "place",
      "year": null,
      "parts": [
        "place",
        "Manchester",
        "Qloo"
      ],
      "title": "Albert Hall, Manchester",
      "source": "Qloo: a long-standing place in Manchester, still there today.",
      "entityId": null,
      "description": "Grade II-listed former Wesleyan chapel converted to a balconied live-music venue with stained-glass windows and a city-centre events space hosting major acts."
    },
    {
      "ref": "P5",
      "via": "notonq",
      "why": null,
      "type": "place",
      "year": null,
      "parts": [
        "place",
        "Manchester",
        "Qloo"
      ],
      "title": "Old Trafford Cricket Ground",
      "source": "Qloo: a long-standing place in Manchester, still there today.",
      "entityId": null,
      "description": "Historic international Test-match cricket venue and home of Lancashire County Cricket Club, hosting major events and offering on-site hotel and premium hospitality."
    },
    {
      "ref": "P6",
      "via": "notonq",
      "why": null,
      "type": "place",
      "year": null,
      "parts": [
        "place",
        "Manchester",
        "Qloo"
      ],
      "title": "The Midland",
      "source": "Qloo: a long-standing place in Manchester, still there today.",
      "entityId": null,
      "description": "Grand Edwardian hotel with plush rooms, upscale dining, luxe spa, and unique lift system, located near Manchester Central and Opera House."
    },
    {
      "ref": "P7",
      "via": "notonq",
      "why": null,
      "type": "place",
      "year": null,
      "parts": [
        "place",
        "Manchester",
        "Qloo"
      ],
      "title": "John Rylands Research Institute and Library",
      "source": "Qloo: a long-standing place in Manchester, still there today.",
      "entityId": null,
      "description": "Neo-Gothic research library, part of the University of Manchester, housing rare books, manuscripts, public reading rooms, a café and a shop."
    },
    {
      "ref": "P8",
      "via": "notonq",
      "why": "Ask if they ever went to a show at the Palace Theatre, and what the evening out was like.",
      "type": "place",
      "year": null,
      "parts": [
        "place",
        "Manchester",
        "Qloo"
      ],
      "title": "Palace Theatre Manchester",
      "source": "Qloo: a long-standing place in Manchester, still there today.",
      "entityId": null,
      "description": "Grand Victorian auditorium in central Manchester hosting touring theatre, opera, ballet, musicals and concerts."
    },
    {
      "ref": "A10",
      "via": "notonq",
      "why": null,
      "type": "artist",
      "year": null,
      "parts": [
        "60s",
        "Manchester",
        "Qloo"
      ],
      "title": "The Beatles",
      "source": "Qloo taste data: artists popular with people from Manchester in the 60s.",
      "entityId": null
    },
    {
      "ref": "A11",
      "via": "notonq",
      "why": null,
      "type": "artist",
      "year": null,
      "parts": [
        "60s",
        "Manchester",
        "Qloo"
      ],
      "title": "Twiggy",
      "source": "Qloo taste data: artists popular with people from Manchester in the 60s.",
      "entityId": null
    },
    {
      "ref": "A12",
      "via": "notonq",
      "why": null,
      "type": "artist",
      "year": null,
      "parts": [
        "60s",
        "Manchester",
        "Qloo"
      ],
      "title": "The Kinks",
      "source": "Qloo taste data: artists popular with people from Manchester in the 60s.",
      "entityId": null
    },
    {
      "ref": "A13",
      "via": "notonq",
      "why": null,
      "type": "artist",
      "year": null,
      "parts": [
        "60s",
        "Manchester",
        "Qloo"
      ],
      "title": "Dave Davies",
      "source": "Qloo taste data: artists popular with people from Manchester in the 60s.",
      "entityId": null
    },
    {
      "ref": "A14",
      "via": "notonq",
      "why": null,
      "type": "artist",
      "year": null,
      "parts": [
        "60s",
        "Manchester",
        "Qloo"
      ],
      "title": "Yolanda",
      "source": "Qloo taste data: artists popular with people from Manchester in the 60s.",
      "entityId": null
    },
    {
      "ref": "A15",
      "via": "notonq",
      "why": null,
      "type": "artist",
      "year": null,
      "parts": [
        "60s",
        "Manchester",
        "Qloo"
      ],
      "title": "Brian Wilson",
      "source": "Qloo taste data: artists popular with people from Manchester in the 60s.",
      "entityId": null
    },
    {
      "ref": "A16",
      "via": "notonq",
      "why": null,
      "type": "artist",
      "year": null,
      "parts": [
        "70s",
        "like Dusty Springfield",
        "Qloo"
      ],
      "title": "Bee Gees",
      "source": "Qloo taste data: 70s artists liked by people who like Dusty Springfield.",
      "entityId": null
    },
    {
      "ref": "A17",
      "via": "notonq",
      "why": null,
      "type": "artist",
      "year": null,
      "parts": [
        "70s",
        "like Dusty Springfield",
        "Qloo"
      ],
      "title": "Bill Withers",
      "source": "Qloo taste data: 70s artists liked by people who like Dusty Springfield.",
      "entityId": null
    },
    {
      "ref": "A18",
      "via": "notonq",
      "why": null,
      "type": "artist",
      "year": null,
      "parts": [
        "70s",
        "like Dusty Springfield",
        "Qloo"
      ],
      "title": "Cass Elliot",
      "source": "Qloo taste data: 70s artists liked by people who like Dusty Springfield.",
      "entityId": null
    },
    {
      "ref": "T1",
      "via": "notonq",
      "why": null,
      "type": "tv",
      "year": 1971,
      "parts": [
        "TV",
        "1971",
        "Qloo"
      ],
      "title": "Columbo",
      "source": "Qloo taste data: TV from 1965–75.",
      "entityId": null
    },
    {
      "ref": "T2",
      "via": "notonq",
      "why": null,
      "type": "tv",
      "year": 1966,
      "parts": [
        "TV",
        "1966",
        "Qloo"
      ],
      "title": "Star Trek",
      "source": "Qloo taste data: TV from 1965–75.",
      "entityId": null
    },
    {
      "ref": "T3",
      "via": "notonq",
      "why": null,
      "type": "tv",
      "year": 1975,
      "parts": [
        "TV",
        "1975",
        "Qloo"
      ],
      "title": "Fawlty Towers",
      "source": "Qloo taste data: TV from 1965–75.",
      "entityId": null
    },
    {
      "ref": "T4",
      "via": "notonq",
      "why": "Mention the silly sketches on the telly and see whether they have a favourite or a line to share.",
      "type": "tv",
      "year": 1969,
      "parts": [
        "TV",
        "1969",
        "Qloo"
      ],
      "title": "Monty Python's Flying Circus",
      "source": "Qloo taste data: TV from 1965–75.",
      "entityId": null
    }
  ],
  "model": "",
  "place": "Manchester, United Kingdom",
  "prompts": [
    {
      "refs": [
        "A9"
      ],
      "text": "The family mentioned how much you like Dusty Springfield. What is it about her voice that you love?",
      "reply": "They might name a favourite song, hum a line, or talk about her style and hair."
    },
    {
      "refs": [
        "F1"
      ],
      "text": "Did you see The Sound of Music at the pictures? Who did you go with?",
      "reply": "They might name a friend or family member, a cinema, or sing a line from a song."
    },
    {
      "refs": [
        "P3"
      ],
      "text": "Did you ever go dancing at the Ritz in Manchester? What was a night out like?",
      "reply": "They might talk about friends, favourite dresses, the band, or getting home afterwards."
    },
    {
      "refs": [
        "A10"
      ],
      "text": "When the Beatles were on the radio, where would you be listening? Was it at home or with friends?",
      "reply": "They might describe a front room, a wireless or record player, or a favourite Beatle."
    },
    {
      "refs": [
        "T4"
      ],
      "text": "Did you watch Monty Python on the telly? Did anything in it make you laugh?",
      "reply": "They might laugh, quote a silly sketch, or say what the family thought of it."
    }
  ],
  "sources": {
    "qloo": 0,
    "notonq": 11,
    "fellBack": 0
  },
  "summary": "A gentle start with Dusty Springfield and the Beatles, then Rod Stewart, then big singalongs, followed by The Sound of Music, Monty Python and Manchester's Ritz and Palace Theatre.",
  "createdAt": "2026-10-25T08:54:35.205Z"
};
