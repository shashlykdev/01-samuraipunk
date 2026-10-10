export const BLOCK_WIDTH = 1672 * 1.18;
export const DISTRICTS = [
  { id: 'lantern', name: 'The Lantern District', image: 'cyberpunk-street-v1.png' },
  { id: 'market', name: 'Market Street', image: 'cyberpunk-market-street-v1.png' },
  { id: 'canal', name: 'Canal Promenade', image: 'cyberpunk-canal-street-v1.png' },
  { id: 'station', name: 'Rainline Station', image: 'cyberpunk-station-v1.png' },
  { id: 'arcade', name: 'Capsule Arcade', image: 'cyberpunk-arcade-v1.png' },
  { id: 'clinic', name: 'Botanical Clinic', image: 'cyberpunk-clinic-v1.png' },
  { id: 'workshops', name: 'Machine Row', image: 'cyberpunk-workshops-v1.png' },
  { id: 'overpass', name: 'Under the Overpass', image: 'cyberpunk-overpass-v1.png' },
  { id: 'torii', name: 'Red Torii Street', image: 'cyberpunk-torii-v1.png' },
  { id: 'docks', name: 'Crane Harbor', image: 'cyberpunk-docks-v1.png' },
  { id: 'freight', name: 'Freight Yard', image: 'cyberpunk-freight-v1.png' },
  { id: 'power', name: 'The Power Quarter', image: 'cyberpunk-power-v1.png' },
  { id: 'floodgate', name: 'Floodgate Avenue', image: 'cyberpunk-floodgate-v1.png' },
  { id: 'plaza', name: 'Hologram Plaza', image: 'cyberpunk-plaza-v1.png' },
  { id: 'rooftop', name: 'Garden Towers', image: 'cyberpunk-rooftop-v1.png' },
  { id: 'citadel', name: 'Citadel Approach', image: 'cyberpunk-citadel-v1.png' },
  { id: 'courtyard', name: 'Corporate Courtyard', image: 'cyberpunk-courtyard-v1.png' },
  { id: 'dawn-gate', name: 'Dawn Gate', image: 'cyberpunk-dawn-gate-v1.png' }
];
export const WORLD = { width: BLOCK_WIDTH * DISTRICTS.length, height: 941 * 1.18, ground: 941 * .90 * 1.18 };
export const START_X = BLOCK_WIDTH * .54;
export const NPC_ATLASES = ['npc-everyday-walk-v2', 'npc-workers-walk-v2', 'npc-locals-walk-v2', 'npc-nightlife-walk-v2'];
export const HERO_WALK = 'samurai-walk-v3-grounded';
export const HERO_ACTIONS = 'samurai-actions-v1';
export const ENEMY_ATLAS = 'cyber-raiders-v1';
export const ENEMY_SPAWNS = DISTRICTS.flatMap((district, index) => [
  { id: `${district.id}-raider`, x: index === 0 ? START_X + 440 : BLOCK_WIDTH * (index + .48), type: 'raider' },
  { id: `${district.id}-enforcer`, x: BLOCK_WIDTH * (index + .82), type: 'enforcer', boss: index === DISTRICTS.length - 1 }
]);
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
    detail: 'The lights keep going beyond the canal. So do you.' },
  ...[
    [4, 'arcade-rest', 'The Last Arcade', 'A repair robot offers you a seat between glowing cabinets. The old games still remember every high score.'],
    [5, 'clinic-rest', 'The Night Clinic', 'Warm glass shelters a little garden. A night-shift medic checks your bandages before sending you back into the rain.'],
    [8, 'torii-rest', 'The Red Torii', 'Beneath the vermilion gate, a bell rings once. You catch your breath beside a small offering of tea.'],
    [11, 'power-rest', 'The Generator Canteen', 'Workers keep the city alive through the night. A cook pushes a warm cup across the counter.'],
    [14, 'garden-rest', 'The Hanging Garden', 'Above the street, leaves collect the rain. Down here, a gardener offers you a dry bench and a quiet moment.'],
    [17, 'gate-rest', 'The Gate Lantern', 'The first pale light reaches the gate. You tighten your sash and listen for footsteps beyond the wall.']
  ].map(([index, id, name, copy], offset) => ({ id, name, copy, x: BLOCK_WIDTH * (index + .22), label: `${String(offset + 8).padStart(2, '0')} / A MOMENT TO RECOVER`, detail: 'First rest here restores 25 health. A new district also unlocks a recovery checkpoint.' }))
];
