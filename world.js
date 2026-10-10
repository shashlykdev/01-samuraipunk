export const BLOCK_WIDTH = 1672 * 1.18;
export const DISTRICTS = [
  { id: 'lantern', name: 'The Lantern District', image: 'cyberpunk-street-v1.png' },
  { id: 'market', name: 'Market Street', image: 'cyberpunk-market-street-v1.png' },
  { id: 'canal', name: 'Canal Promenade', image: 'cyberpunk-canal-street-v1.png' }
];
export const WORLD = { width: BLOCK_WIDTH * DISTRICTS.length, height: 941 * 1.18, ground: 941 * .90 * 1.18 };
export const START_X = BLOCK_WIDTH * .54;
export const NPC_ATLASES = ['npc-everyday-walk-v2', 'npc-workers-walk-v2', 'npc-locals-walk-v2', 'npc-nightlife-walk-v2'];
export const HERO_WALK = 'samurai-walk-v3-grounded';
export const STOPS = [
  { id: 'lanterns', x: BLOCK_WIDTH * .12, name: 'Paper Lanterns', label: '01 / A QUIET CORNER',
    copy: 'Under the red lanterns, the noise of the street falls away. A small shrine watches over the people still finding their way home.',
    detail: 'For a moment, all you hear is rain against the roof.' },
  { id: 'noodles', x: BLOCK_WIDTH * .30, name: 'Lantern Noodles', label: '02 / SOMETHING WARM',
    copy: 'Steam curls out into the night. The cook gives you a familiar nod and sets a bowl on the counter. There is always one more seat here.',
    detail: 'Hot broth, a quiet conversation, and the last train passing overhead.' },
  { id: 'market', x: BLOCK_WIDTH * .72, name: 'The Night Market', label: '03 / OPEN UNTIL MORNING',
    copy: 'A courier slips past the vending machines. Beyond the glass, rows of small necessities glow in neat colors. The city keeps its own hours.',
    detail: 'You pick a warm drink and watch the reflections move across the pavement.' },
  { id: 'repair', x: BLOCK_WIDTH * 1.62, name: 'The Repair Bench', label: '04 / A SECOND LIFE',
    copy: 'Beneath a blue canopy, a mechanic coaxes a little radio back to life. Screens and spare parts shine in the warm light of the market.',
    detail: 'A crackle, a few notes of music, and another small thing saved from the rain.' },
  { id: 'records', x: BLOCK_WIDTH * 1.84, name: 'After-hours Records', label: '05 / MUSIC AFTER MIDNIGHT',
    copy: 'Old records sit beside new electronics. The stallholder offers you one ear of a pair of headphones and lets the song speak for itself.',
    detail: 'The market keeps moving. For one song, you stand still.' },
  { id: 'shrine', x: BLOCK_WIDTH * 2.23, name: 'The Waterside Shrine', label: '06 / A LIGHT ON THE WATER',
    copy: 'A small flame burns under the torii. Petals collect on the steps, and the canal carries the lights of the city slowly past.',
    detail: 'You leave a quiet wish beneath the lantern.' },
  { id: 'canal', x: BLOCK_WIDTH * 2.68, name: 'Canal Lookout', label: '07 / THE LONG WAY HOME',
    copy: 'Across the water, the last windows are still lit. A boat rocks against its mooring while the train slips through the distant skyline.',
    detail: 'Three streets behind you. The sound of water ahead.' }
];
