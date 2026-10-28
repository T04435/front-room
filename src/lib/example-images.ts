/**
 * Pictures for the example Margaret's tiles: Qloo image URLs (artist photos for songs, posters, places), looked up once
 * on 27 Oct 2026. Only the URLs are kept, as for any person's cards.
 */
export const EXAMPLE_IMAGES: Record<string, string> = {
  "artist:ABBA": "https://images.qloo.com/i/6EFDAE6B-574F-4EAA-930A-09C61C80E453-420x-auto.jpg",
  "artist:Carpenters": "https://images.qloo.com/i/4565D816-B995-4D2F-87F3-F6203A341851-420x-auto.jpg",
  "artist:Dionne Warwick": "https://images.qloo.com/i/0B6E7294-059F-4683-AD83-1635D4C63AF6-420x-auto.jpg",
  "artist:Dusty Springfield": "https://images.qloo.com/i/958E3686-DD90-4056-ADC7-9229E7AAEADD-420x-auto.jpg",
  "artist:Elton John": "https://images.qloo.com/i/4395AE84-43E1-45BC-9606-344226C6ADEC-420x-auto.jpg",
  "artist:Mud": "https://images.qloo.com/i/6CA00D09-60D5-4911-B1FB-33F5FE107062-420x-auto.jpg",
  "artist:Otis Redding": "https://images.qloo.com/i/D7520C8C-54FB-4C75-8654-F5186898DAF4-420x-auto.jpg",
  "artist:Rod Stewart": "https://images.qloo.com/i/02BC6028-DB30-4232-9CAB-0D0EF1814780-420x-auto.jpg",
  "artist:The Beatles": "https://images.qloo.com/i/996272B0-CB79-48D3-8B83-8ED34F2DE9AF-420x-auto.jpg",
  "artist:The Kinks": "https://images.qloo.com/i/286449D4-5320-4CF0-BA14-5293C448F906-420x-auto.jpg",
  "artist:The Rubettes": "https://images.qloo.com/i/E4AE4886-CFC7-4BFD-BC2D-6E8F260CC6B0-420x-auto.jpg",
  "book:The Mallen Streak": "https://images.qloo.com/i/D11892A3-1F80-4598-AD89-02922F3EED8F-420x-auto.jpg",
  "film:American Graffiti": "https://images.qloo.com/i/5864FF33-8038-46AC-B3CE-4E778BF01E60-420x-auto.jpg",
  "film:Grease": "https://images.qloo.com/i/BDE029BB-B479-45EB-A6E2-C86352B46A63-420x-auto.jpg",
  "film:Papillon": "https://images.qloo.com/i/68CB25F2-B2F0-4ECE-AFEA-E570FA10B934-420x-auto.jpg",
  "film:The Godfather": "https://images.qloo.com/i/F99FB2EB-7253-4E9B-B982-D21D29BFB238-420x-auto.jpg",
  "film:The Jungle Book": "https://images.qloo.com/i/80E7D898-C19B-4CB7-BA99-ECBEF17CD407-420x-auto.jpg",
  "film:The Sound of Music": "https://images.qloo.com/i/5D54CE58-DC3E-4294-A359-581A9C072952-420x-auto.jpg",
  "film:Who's Afraid of Virginia Woolf?": "https://images.qloo.com/i/0D5EDC61-00EF-45A2-AFDA-C35F8AC66CEE-420x-auto.jpg",
  "place:Albert Hall, Manchester": "https://images.qloo.com/i/77E6C4E7-49EC-48DB-A7EE-E36AA98A7E95-420x-auto.jpg",
  "place:Blackpool Pleasure Beach": "https://images.qloo.com/i/F30E114C-FEB2-4D51-A16B-F59BBE855E0B-420x-auto.jpg",
  "place:John Rylands Research Institute and Library": "https://images.qloo.com/i/461A4756-AE0D-4343-8DA1-93DD4CB96656-420x-auto.jpg",
  "place:Manchester Art Gallery": "https://images.qloo.com/i/069C2257-E652-4AF4-A441-4A5749D10E7B-420x-auto.jpg",
  "place:Old Trafford Cricket Ground": "https://images.qloo.com/i/B629E4B4-8199-44CB-9B6F-97FE5E711C60-420x-auto.jpg",
  "place:Palace Theatre Manchester": "https://images.qloo.com/i/78D921E6-34E2-4822-9C43-56C7D1A17DE6-420x-auto.jpg",
  "place:The University of Manchester": "https://images.qloo.com/i/1C86D18E-A6C2-41C7-A642-D3922BDD5623-420x-auto.jpg",
  "place:Tower Ballroom": "https://images.qloo.com/i/FA42F1F4-F75B-43D4-B286-3C7A8C1708F2-420x-auto.jpg",
  "tv:Columbo": "https://images.qloo.com/i/66969B47-66E0-42DD-8712-99EEA147F7F1-420x-auto.jpg",
  "tv:Fawlty Towers": "https://images.qloo.com/i/112A272A-21AF-420F-9EC6-A85C39B65B50-420x-auto.jpg",
  "tv:Monty Python's Flying Circus": "https://images.qloo.com/i/33CAE770-17D7-431B-9D9F-730B5978C3E8-420x-auto.jpg",
  "tv:Star Trek": "https://images.qloo.com/i/42B37885-D0E0-4ACC-8D53-CF2679DBC3E4-420x-auto.jpg",
  "tv:The Generation Game": "https://images.qloo.com/i/4BF9B786-DB35-474E-A854-7E97211E06B5-420x-auto.jpg",
};

/** "artist:ABBA" for a song (its artist's photo), "film:Grease" for the rest. */
export const exampleImage = (type: string, title: string, by?: string): string | undefined => EXAMPLE_IMAGES[type === "song" && by ? `artist:${by}` : `${type}:${title}`];
