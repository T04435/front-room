/**
 * Ready-made "This is me" stories for judges and first-time visitors who have no real person to hand. Fictional people.
 * Picking one only starts a person and puts the story in the chat box: sending it runs the real chat and look-up.
 */
export type Example = { id: string; name: string; label: string; text: string };

export const EXAMPLES: Example[] = [
  {
    id: "joan",
    name: "Joan",
    label: "Joan · Liverpool, then Leeds",
    text: "Joan was born in 1946 and grew up in Liverpool. She danced at the Cavern every Saturday and loved Cilla Black. She married Ken in 1968 and they moved to Leeds, where she worked in a dress shop on Briggate for twenty years. Her brother Tom died young and she never talks about him. Coronation Street is her programme, and a cup of tea with milk, no sugar. Loud bangs upset her; holding hands and soft music calm her. She hears better on her left.",
  },
  {
    id: "rosa",
    name: "Rosa",
    label: "Rosa · Sevilla, then Madrid (en español)",
    text: "Rosa nació en 1948 y creció en Sevilla. Le encantaba Rocío Jurado y bailaba sevillanas en la Feria de Abril cada año. Se casó en 1970 y se mudó a Madrid, donde trabajó como costurera. Su hermano Manuel murió joven y no habla de él. Le calma escuchar la radio por la mañana y que le cojan la mano.",
  },
  {
    id: "amrit",
    name: "Amrit",
    label: "Amrit · Lahore, then Bradford",
    text: "Amrit was born in 1944 and grew up in Lahore, speaking Punjabi. He loved Mohammed Rafi and the films of Raj Kapoor. He married in 1965 and moved to Bradford, where he worked in a textile mill for thirty years. He follows the cricket. Talking about Partition upsets him. Sweet tea and Rafi songs in the evening calm him.",
  },
];

export const exampleById = (id: string | undefined) => EXAMPLES.find((e) => e.id === id) ?? null;
