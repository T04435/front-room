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
    text: `This is me: Joan

I like to be called: Joan. Old friends call me Jo.

Where I grew up: I was born in 1946 and grew up in Liverpool, on a terraced street near Anfield. Joan danced at the Cavern every Saturday and loved Cilla Black.

My family: I married Ken in 1968 and we moved to Leeds. We have two daughters, Karen and Lisa, and three grandchildren. Her brother Tom died young and she never talks about him.

My working life: I worked in a dress shop on Briggate for twenty years. I can still tell good cloth by touch.

What is important to me: Coronation Street, a cup of tea with milk and no sugar, and my wedding photo on the windowsill.

Things that may worry or upset me: Loud bangs, and being rushed.

What makes me feel better: Holding hands, soft music, and talking about Liverpool.

How I communicate: I hear better on my left side. I wear glasses for reading.

My routines: I like to be up early and have breakfast by eight. An afternoon nap after lunch.

Faith: Church of England. I like to hear the hymns at Christmas.`,
  },
  {
    id: "rosa",
    name: "Rosa",
    label: "Rosa · Sevilla, then Madrid (en español)",
    text: `Esto soy yo: Rosa

Me gusta que me llamen: Rosa, o Rosita en casa.

Dónde crecí: Rosa nació en 1948 y creció en Sevilla, en el barrio de Triana. Le encantaba Rocío Jurado y bailaba sevillanas en la Feria de Abril cada año.

Mi familia: Se casó en 1970 y se mudó a Madrid. Tiene dos hijos, Javier y Carmen, y cuatro nietos. Su hermano Manuel murió joven y no habla de él.

Mi trabajo: Trabajó como costurera en un taller de Lavapiés durante treinta años.

Lo que es importante para mí: La misa del domingo, el café con leche por la mañana y las fotos de sus nietos.

Lo que me preocupa o me molesta: Los ruidos fuertes y quedarse sola por la noche.

Lo que me ayuda a sentirme mejor: Le calma escuchar la radio por la mañana y que le cojan la mano.

Cómo me comunico: Hablaba español; entiende poco inglés. Habla mejor si se le habla despacio.

Fe: Católica. Le gusta rezar el rosario por la tarde.`,
  },
  {
    id: "amrit",
    name: "Amrit",
    label: "Amrit · Lahore, then Bradford",
    text: `This is me: Amrit

I like to be called: Amrit. The grandchildren call me Bauji.

Where I grew up: Amrit was born in 1944 and grew up in Lahore, speaking Punjabi. His family crossed the new border in 1947.

Music and films: He loved Mohammed Rafi and the films of Raj Kapoor. Awaara was his favourite.

My family: He married Gurmeet in 1965 and moved to Bradford. They have three sons, and Sunday dinner is together.

My working life: He worked in a textile mill for thirty years, on the night shift.

What is important to me: The cricket, his turban tied neatly, and the gurdwara on Sundays.

Things that may worry or upset me: Talking about Partition upsets him. Crowds and shouting.

What makes me feel better: Sweet tea, and Rafi songs in the evening.

How I communicate: He speaks Punjabi and some English. Slower speech helps.

Food: Vegetarian, no beef.`,
  },
];

export const exampleById = (id: string | undefined) => EXAMPLES.find((e) => e.id === id) ?? null;
