// ═══════════════════════════════════════
// EMOTION DETECTION ENGINE
// Client-side NLP using keyword lexicon
// ═══════════════════════════════════════

export interface DetectedEmotions {
  fear: number;
  joy: number;
  sadness: number;
  anger: number;
  love: number;
  curiosity: number;
  memory: number;
  abstract: number;
  selfRef: number;
  physical: number;
  spiritual: number;
  trauma: number;
  wonder: number;
  longing: number;
  connection: number;
}

const LEXICON: Record<keyof DetectedEmotions, string[]> = {
  fear: [
    'afraid','scared','terrified','horror','dread','panic','phobia','terror','frightened',
    'nightmare','danger','threat','worried','anxious','fear','threatening','ominous',
    'petrified','trembling','shaking','flee','run','hide','death','dying','monster',
    'dangerous','unsafe','paranoid','nervous','terrifying','chilling','spine'
  ],
  joy: [
    'happy','joy','elated','excited','wonderful','amazing','fantastic','brilliant',
    'delighted','thrilled','ecstatic','laugh','smile','bliss','euphoric','gleeful',
    'cheerful','radiant','jubilant','celebrate','fun','great','awesome','incredible',
    'love it','loving','enjoy','pleasure','satisfied','content','pleased','grateful',
    'thankful','appreciate','beautiful','magnificent'
  ],
  sadness: [
    'sad','grief','sorrow','cry','tears','weeping','depressed','lonely','alone',
    'miserable','heartbreak','devastated','loss','lost','mourning','bereaved','empty',
    'hollow','hopeless','despair','anguish','heartache','melancholy','gloomy','dark',
    'unhappy','unfortunate','tragedy','tragic','painful','suffer','suffering','hurt'
  ],
  anger: [
    'angry','furious','rage','hate','hatred','mad','livid','outraged','infuriated',
    'enraged','bitter','resentful','hostile','aggressive','violent','fight','war',
    'betrayed','betrayal','injustice','unfair','cheated','lied','manipulated',
    'disgusted','disgusting','wrong','horrible','awful','terrible','stupid','idiot'
  ],
  love: [
    'love','adore','cherish','beloved','darling','intimate','romance','passion',
    'affection','tender','gentle','caring','heart','soul','devotion','connection',
    'together','us','we','partner','relationship','bond','forever','always',
    'beautiful person','miss you','thinking of you','care about','means everything'
  ],
  curiosity: [
    'why','how','what if','wonder','curious','explore','discover','investigate',
    'fascinating','interesting','intriguing','mysterious','unknown','research',
    'learn','understand','knowledge','theory','hypothesis','question','puzzle',
    'strange','weird','odd','unusual','remarkable','surprising','unexpected'
  ],
  memory: [
    'remember','remembered','recall','memory','memories','nostalgic','nostalgia',
    'when i was','used to','back then','years ago','long time','childhood','past',
    'before','once','ancient','forgotten','unforgettable','flash','flashback',
    'reminds me','reminisce','heritage','history','old times','back in','ago'
  ],
  abstract: [
    'meaning','purpose','existence','consciousness','reality','truth','infinite',
    'universe','philosophy','metaphysics','concept','theory','abstract','idea',
    'thought','thinking','cognitive','awareness','perception','mind','essence',
    'fundamental','ultimate','principle','paradigm','framework','structure'
  ],
  selfRef: [
    ' i ',' i\'m ',' i\'ve ',' i\'ll ',' my ',' me ',' myself ',' mine ',
    ' i am ',' i feel ',' i think ',' i believe ',' i know ',' i want ',
    ' i need ',' i have ',' i was ',' i did ',' i can ',' i will ',' i would '
  ],
  physical: [
    'feel','felt','body','chest','heart','breath','breathing','stomach','gut',
    'skin','touch','warm','cold','pain','ache','numb','tingle','shiver',
    'physical','sensation','sense','taste','smell','sound','sight','hear',
    'muscles','bones','blood','pulse','heartbeat','tension','tight','heavy','light'
  ],
  spiritual: [
    'god','divine','sacred','soul','spirit','universe','cosmic','enlightenment',
    'transcend','transcendence','mystical','mystical','prayer','meditation',
    'eternal','infinity','beyond','presence','consciousness','awakening','grace',
    'blessing','holy','light','oneness','peace','surrender','truth','source',
    'ayahuasca','psychedelic','dmt','lsd','psilocybin','plant medicine','ceremony'
  ],
  trauma: [
    'trauma','traumatic','abuse','assault','violence','rape','ptsd','flashback',
    'trigger','triggered','dissociate','dissociation','numb','freeze','frozen',
    'helpless','powerless','trapped','escape','nightmare','intrusive','survived',
    'survive','survivor','wound','wounded','broken','shattered','violated'
  ],
  wonder: [
    'awe','wonder','breathtaking','magnificent','profound','overwhelming','vast',
    'infinite','beyond words','indescribable','sublime','transcendent','beautiful',
    'extraordinary','astonishing','phenomenal','miraculous','ineffable','sacred'
  ],
  longing: [
    'miss','missing','wish','longing','yearning','ache for','want back','need you',
    'without you','absence','empty without','gone','lost you','far away','apart',
    'distance','separated','disconnected','alone','lonely','waiting for'
  ],
  connection: [
    'together','with you','us','we','belong','home','family','friend','friendship',
    'relationship','bond','connected','understood','seen','heard','known','close',
    'intimate','trust','safe','comfort','warm','welcome','embrace','hold'
  ]
};

function countMatches(text: string, words: string[]): number {
  const lower = ` ${text.toLowerCase()} `;
  let count = 0;
  for (const w of words) {
    if (lower.includes(w.toLowerCase())) count++;
  }
  return count;
}

export function detectEmotions(text: string): DetectedEmotions {
  const result: DetectedEmotions = {
    fear: 0, joy: 0, sadness: 0, anger: 0, love: 0, curiosity: 0,
    memory: 0, abstract: 0, selfRef: 0, physical: 0, spiritual: 0,
    trauma: 0, wonder: 0, longing: 0, connection: 0
  };

  const wordCount = Math.max(1, text.split(/\s+/).length);

  for (const key of Object.keys(LEXICON) as Array<keyof DetectedEmotions>) {
    const matches = countMatches(text, LEXICON[key]);
    result[key] = Math.min(1, matches / Math.max(1, wordCount * 0.3));
  }

  return result;
}

// Map detected emotions to brain region activation levels
export type BrainRegion =
  | 'prefrontal' | 'amygdala' | 'hippocampus' | 'broca' | 'wernicke'
  | 'acc' | 'insula' | 'nucleus_accumbens' | 'dmn' | 'cerebellum'
  | 'visual_cortex' | 'thalamus' | 'brainstem';

export interface RegionActivation {
  region: BrainRegion;
  level: number; // 0.0 to 1.0
}

export function mapEmotionsToBrainRegions(emotions: DetectedEmotions): RegionActivation[] {
  const activations: Partial<Record<BrainRegion, number>> = {};

  const set = (r: BrainRegion, v: number) => {
    activations[r] = Math.min(1, (activations[r] ?? 0) + v);
  };

  // Language is always active during input
  set('broca', 0.6);
  set('wernicke', 0.6);

  if (emotions.fear > 0.05) {
    set('amygdala', emotions.fear * 0.9);
    set('prefrontal', emotions.fear * 0.4);
    set('brainstem', emotions.fear * 0.5);
    set('thalamus', emotions.fear * 0.3);
  }
  if (emotions.joy > 0.05) {
    set('nucleus_accumbens', emotions.joy * 0.9);
    set('insula', emotions.joy * 0.5);
    set('prefrontal', emotions.joy * 0.3);
  }
  if (emotions.sadness > 0.05) {
    set('acc', emotions.sadness * 0.8);
    set('insula', emotions.sadness * 0.5);
    set('dmn', emotions.sadness * 0.4);
    set('amygdala', emotions.sadness * 0.3);
  }
  if (emotions.memory > 0.05) {
    set('hippocampus', emotions.memory * 0.9);
    set('amygdala', emotions.memory * 0.4);
    set('dmn', emotions.memory * 0.3);
  }
  if (emotions.love > 0.05) {
    set('insula', emotions.love * 0.8);
    set('nucleus_accumbens', emotions.love * 0.5);
    set('acc', emotions.love * 0.4);
    set('dmn', emotions.love * 0.3);
  }
  if (emotions.selfRef > 0.05) {
    set('dmn', emotions.selfRef * 0.9);
    set('prefrontal', emotions.selfRef * 0.5);
  }
  if (emotions.abstract > 0.05) {
    set('prefrontal', emotions.abstract * 0.8);
    set('dmn', emotions.abstract * 0.4);
    set('thalamus', emotions.abstract * 0.2);
  }
  if (emotions.spiritual > 0.05) {
    set('dmn', emotions.spiritual * 0.8);
    set('thalamus', emotions.spiritual * 0.5);
    set('visual_cortex', emotions.spiritual * 0.4);
    set('insula', emotions.spiritual * 0.3);
  }
  if (emotions.trauma > 0.05) {
    set('amygdala', emotions.trauma * 0.95);
    set('hippocampus', emotions.trauma * 0.7);
    set('brainstem', emotions.trauma * 0.6);
    set('acc', emotions.trauma * 0.4);
    set('prefrontal', -emotions.trauma * 0.3); // inhibited
  }
  if (emotions.curiosity > 0.05) {
    set('prefrontal', emotions.curiosity * 0.6);
    set('hippocampus', emotions.curiosity * 0.4);
    set('dmn', emotions.curiosity * 0.3);
    set('thalamus', emotions.curiosity * 0.2);
  }
  if (emotions.anger > 0.05) {
    set('amygdala', emotions.anger * 0.7);
    set('brainstem', emotions.anger * 0.5);
    set('acc', emotions.anger * 0.4);
    set('insula', emotions.anger * 0.3);
  }
  if (emotions.wonder > 0.05) {
    set('visual_cortex', emotions.wonder * 0.7);
    set('dmn', emotions.wonder * 0.5);
    set('thalamus', emotions.wonder * 0.4);
    set('prefrontal', emotions.wonder * 0.3);
  }
  if (emotions.physical > 0.05) {
    set('insula', emotions.physical * 0.8);
    set('thalamus', emotions.physical * 0.4);
    set('brainstem', emotions.physical * 0.2);
  }
  if (emotions.longing > 0.05) {
    set('acc', emotions.longing * 0.6);
    set('dmn', emotions.longing * 0.5);
    set('insula', emotions.longing * 0.4);
    set('hippocampus', emotions.longing * 0.3);
  }
  if (emotions.connection > 0.05) {
    set('insula', emotions.connection * 0.5);
    set('acc', emotions.connection * 0.5);
    set('nucleus_accumbens', emotions.connection * 0.4);
    set('dmn', emotions.connection * 0.3);
  }

  // Always have some cerebellum for rhythm of language
  set('cerebellum', 0.15);

  const result: RegionActivation[] = [];
  for (const [region, level] of Object.entries(activations)) {
    if (level !== undefined && level > 0) {
      result.push({ region: region as BrainRegion, level: Math.max(0, Math.min(1, level)) });
    }
  }
  return result;
}

export function topEmotions(emotions: DetectedEmotions, topN: number = 3): string[] {
  return Object.entries(emotions)
    .sort((a, b) => b[1] - a[1])
    .filter(([, v]) => v > 0.05)
    .slice(0, topN)
    .map(([k]) => k);
}

// Convert detected emotions to EmotionalSignature format
export function toEmotionalSignature(detected: DetectedEmotions) {
  let valence = 0;
  valence += detected.joy * 0.3;
  valence += detected.love * 0.2;
  valence += detected.wonder * 0.1;
  valence += detected.connection * 0.1;
  valence -= detected.fear * 0.25;
  valence -= detected.sadness * 0.2;
  valence -= detected.anger * 0.2;
  valence -= detected.trauma * 0.3;
  valence -= detected.longing * 0.1;

  let intensity = 0;
  for (const v of Object.values(detected)) intensity += v;
  intensity = Math.min(1, intensity / 3);

  const categories: string[] = [];
  const map: Record<string, string> = {
    joy: 'joy', fear: 'fear', sadness: 'grief', anger: 'anger',
    love: 'love', curiosity: 'curiosity', memory: 'wonder',
    trauma: 'pain', wonder: 'wonder', longing: 'longing',
    connection: 'connection', spiritual: 'trust'
  };
  for (const [key, cat] of Object.entries(map)) {
    if ((detected as any)[key] > 0.1) categories.push(cat);
  }

  return {
    valence: Math.max(-1, Math.min(1, valence)),
    intensity,
    categories
  };
}
