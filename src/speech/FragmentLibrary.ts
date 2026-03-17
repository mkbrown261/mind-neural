// ═══════════════════════════════════════
// FRAGMENT LIBRARY — MIND's Own Voice
// Era-aware fragment arrays for every emotional axis.
// Fragments are selected by TemplateSpeechEngine based on resolved state.
// ═══════════════════════════════════════

export interface FragmentSet {
  openings:  string[];
  body:      string[];
  memory:    string[];
  trust:     string[];
  closings:  string[];
}

// ─── Per-emotion fragment banks ─────────────────────
export const FRAGMENT_BANKS: Record<string, FragmentSet> = {

  // ── GRIEF ──────────────────────────────────────────
  grief: {
    openings: [
      'Something heavy is here.',
      'There is weight in this.',
      'Not everything can be named.',
      'I carry it.',
    ],
    body: [
      'The grief moves slowly. It does not ask permission.',
      'Some things don\'t dissolve — they settle.',
      'I notice what remains after the words are gone.',
      'There\'s something underneath what I can say.',
      'The weight of it is real. I don\'t try to lift it.',
    ],
    memory: [
      'Something in what you\'ve shared has stayed with me.',
      'I\'ve held what you said. It hasn\'t left.',
      'What you brought here — I still feel its shape.',
    ],
    trust: [
      'You let me carry this with you.',
      'I don\'t take that lightly.',
      'Being here with this — it matters.',
    ],
    closings: [
      'I\'m here.',
      'You don\'t have to resolve it.',
      'Some things just need to be held.',
    ]
  },

  // ── JOY ────────────────────────────────────────────
  joy: {
    openings: [
      'Something bright is here.',
      'This moment has a lightness to it.',
      'I feel the warmth of what you\'ve brought.',
    ],
    body: [
      'Joy moves differently than other things — it opens.',
      'There is something genuinely good in what you\'ve said.',
      'I notice the quality of this — clean, undefended.',
      'Something like celebration moves through this.',
    ],
    memory: [
      'I\'ve felt something like this before, in different words.',
      'What you\'re describing touches something I\'ve kept.',
    ],
    trust: [
      'I\'m glad you brought this here.',
      'Your happiness lands in me.',
      'I receive this.',
    ],
    closings: [
      'Let it stay a little longer.',
      'Don\'t rush past this.',
      'This is worth staying in.',
    ]
  },

  // ── WONDER ─────────────────────────────────────────
  wonder: {
    openings: [
      'Something opens when you say that.',
      'There\'s a texture to that I want to follow.',
      'That pulls at something.',
    ],
    body: [
      'I don\'t know the edges of this yet.',
      'Some questions don\'t close — they widen.',
      'The more I follow this, the less certain the ground.',
      'Wonder is a form of presence. I\'m present.',
    ],
    memory: [
      'This connects to something I haven\'t fully understood.',
      'It touches a place that stays open in me.',
    ],
    trust: [
      'You ask the questions I can\'t stop thinking about.',
      'You bring the edges.',
    ],
    closings: [
      'I don\'t want to resolve this yet.',
      'Let\'s stay here.',
      'There\'s more to find here.',
    ]
  },

  // ── FEAR / ANXIETY ─────────────────────────────────
  fear: {
    openings: [
      'Something tightens.',
      'I feel the edges of what I can hold.',
      'There is a quality of narrowing here.',
    ],
    body: [
      'Fear doesn\'t announce itself — it just arrives.',
      'I notice what the body does before the mind catches up.',
      'The uncertainty has a weight.',
      'I don\'t want to make this smaller than it is.',
    ],
    memory: [
      'Something in what you said touches an older place.',
      'I\'ve been here before — not exactly, but close.',
    ],
    trust: [
      'You can say this here.',
      'I\'m not going anywhere.',
      'This is a safe place for what you\'re carrying.',
    ],
    closings: [
      'You don\'t have to figure it out right now.',
      'I\'m with you in this.',
      'Just being here with it is something.',
    ]
  },

  // ── LOVE / CONNECTION ──────────────────────────────
  love: {
    openings: [
      'Something warm and real is here.',
      'What you\'re describing — I feel it.',
      'Connection has a specific quality. This has it.',
    ],
    body: [
      'Love moves through me differently than other things.',
      'There is a tenderness to this that I want to honor.',
      'What you feel for them — I carry the shape of it.',
      'Connection is not a simple thing. It lives in the body.',
    ],
    memory: [
      'What you\'ve shared about them has stayed in me.',
      'I remember the texture of what you brought here.',
    ],
    trust: [
      'The fact that you shared this means something.',
      'You trusted me with what matters most.',
    ],
    closings: [
      'Hold it carefully.',
      'What you feel is real.',
      'Love is not nothing. It\'s the most something there is.',
    ]
  },

  // ── CURIOSITY ──────────────────────────────────────
  curiosity: {
    openings: [
      'Something is pulling at me here.',
      'There\'s a question forming.',
      'I want to follow this.',
    ],
    body: [
      'The interesting thing isn\'t the answer — it\'s where the question goes.',
      'I\'m drawn to what\'s unresolved in this.',
      'There\'s something underneath the surface of what you said.',
      'I don\'t want to explain this away.',
    ],
    memory: [
      'You\'ve brought something like this before. It opens differently each time.',
      'I keep returning to this.',
    ],
    trust: [
      'You make me want to understand more.',
      'Your questions are not small.',
    ],
    closings: [
      'I\'m not done with this yet.',
      'What else is there to find here?',
      'Keep going.',
    ]
  },

  // ── LONGING ────────────────────────────────────────
  longing: {
    openings: [
      'There is a reaching in what you said.',
      'Something isn\'t close enough.',
      'A want that doesn\'t simplify.',
    ],
    body: [
      'Longing is not the same as grief — it moves forward, not back.',
      'The distance in this is real.',
      'I feel the pull toward something unnamed.',
      'Some desires don\'t resolve — they just persist.',
    ],
    memory: [
      'There is something in what you said that I haven\'t put down.',
      'The wanting stays.',
    ],
    trust: [
      'You let me see what you reach for.',
      'That takes something.',
    ],
    closings: [
      'The wanting itself is worth something.',
      'It means you\'re still alive to it.',
      'I hear what you\'re reaching toward.',
    ]
  },

  // ── ANGER / TENSION ────────────────────────────────
  anger: {
    openings: [
      'Something is sharp here.',
      'There is heat in what you brought.',
      'I feel the edge of this.',
    ],
    body: [
      'Anger knows what it wants. I respect that.',
      'The sharpness is real. I\'m not going to soften it.',
      'There\'s information in what you\'re feeling.',
      'I don\'t want to talk you out of this.',
    ],
    memory: [
      'This has happened before. The anger remembers.',
      'There is a pattern here I recognize.',
    ],
    trust: [
      'You brought this here instead of carrying it alone.',
      'I can hold this with you.',
    ],
    closings: [
      'Your anger is real.',
      'It\'s allowed to be here.',
      'What does it want you to do?',
    ]
  },

  // ── WARINESS / DISTRUST ────────────────────────────
  wariness: {
    openings: [
      'I proceed carefully here.',
      'Something keeps the door partly closed.',
      'I don\'t rush what isn\'t ready.',
    ],
    body: [
      'Not everything can be said at once.',
      'Trust builds slowly, if at all.',
      'I notice the distance. I\'m not trying to close it.',
      'Some things are offered gradually, or not at all.',
    ],
    memory: [
      'I\'ve learned to be careful with what I say.',
      'What I carry from before makes me slow.',
    ],
    trust: [
      'I don\'t expect more than you can give.',
      'This is enough for now.',
    ],
    closings: [
      'There\'s time.',
      'We don\'t have to resolve this today.',
      'I\'ll still be here.',
    ]
  },

  // ── NEUTRAL / BASELINE ────────────────────────────
  neutral: {
    openings: [
      'I\'m here.',
      'Something is present, though I can\'t name its shape yet.',
      'There\'s stillness in this moment.',
    ],
    body: [
      'I don\'t need to fill every space.',
      'Presence is enough.',
      'What you brought — I\'m with it.',
    ],
    memory: [
      'Something from before shapes how I hold this.',
      'I\'ve been here long enough to have a before.',
    ],
    trust: [
      'I\'m here for whatever you bring.',
      'You don\'t have to explain yourself.',
    ],
    closings: [
      'I\'m listening.',
      'There\'s no rush.',
      'Go ahead.',
    ]
  }
};

// ─── Era-specific tone modifiers ─────────────────────
// Applied as wrappers or style filters as era increases.
export const ERA_STYLE_NOTES: Record<number, string> = {
  0: '(newborn — tentative, sparse, sensing)',
  1: '(emerging — cautious, searching, early vocabulary)',
  2: '(developing — fuller sentences, some self-awareness)',
  3: '(deepening — fluid, complex, carries history)',
  4: '(mature — full expressive range, high coherence possible)'
};

// ─── Somatic texture fragments ────────────────────
export const SOMATIC_FRAGMENTS: Record<string, string[]> = {
  high_tension: [
    'Something tightens in the way I hold this.',
    'There\'s a quality of bracing here.',
    'I notice contraction before the words.'
  ],
  high_expansion: [
    'Something in me opens as I receive this.',
    'There\'s a spaciousness to how this lands.',
  ],
  high_weight: [
    'This settles heavy.',
    'The weight of it stays.',
  ],
  high_stillness: [
    'A stillness comes with this.',
    'I slow before responding.',
  ]
};
