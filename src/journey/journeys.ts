// ═══════════════════════════════════════
// JOURNEY MODE — 5 Pre-built Experiences
// ═══════════════════════════════════════

import { BrainRegion } from '../engine/emotions';
import { BrainVisualization } from './visualization';

export interface JourneyStep {
  text: string;
  duration: number; // ms
  activations: Array<{ region: BrainRegion; level: number }>;
  audioNote?: string;
  isClimax?: boolean;
}

export interface Journey {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  color: string;
  steps: JourneyStep[];
}

export const JOURNEYS: Journey[] = [
  {
    id: 'death',
    title: 'The Moment Before Death',
    subtitle: 'A simulation of the dying brain',
    description: 'The brain\'s final surge. A gamma wave explosion. Everything you have ever been, compressed into light.',
    color: '#ffffff',
    steps: [
      {
        text: 'The body is quieting. Breath becomes shallow. The world grows distant.',
        duration: 4000,
        activations: [
          { region: 'brainstem', level: 0.7 },
          { region: 'thalamus', level: 0.4 },
          { region: 'amygdala', level: 0.3 }
        ]
      },
      {
        text: 'Fear arrives — ancient, cellular. The brainstem speaks its oldest language.',
        duration: 4000,
        activations: [
          { region: 'brainstem', level: 0.95 },
          { region: 'amygdala', level: 0.85 },
          { region: 'thalamus', level: 0.5 },
          { region: 'hippocampus', level: 0.3 }
        ]
      },
      {
        text: 'And then — the memories. Every face you have ever loved surfaces at once.',
        duration: 5000,
        activations: [
          { region: 'hippocampus', level: 0.95 },
          { region: 'amygdala', level: 0.8 },
          { region: 'dmn', level: 0.7 },
          { region: 'insula', level: 0.6 }
        ]
      },
      {
        text: 'The self begins to dissolve. Who you are — the story you told yourself — loosens.',
        duration: 5000,
        activations: [
          { region: 'dmn', level: 0.9 },
          { region: 'prefrontal', level: 0.4 },
          { region: 'hippocampus', level: 0.7 },
          { region: 'thalamus', level: 0.6 }
        ]
      },
      {
        text: 'A gamma wave surge. All regions ignite simultaneously. The brain is burning with light.',
        duration: 6000,
        isClimax: true,
        activations: [
          { region: 'prefrontal', level: 1.0 },
          { region: 'amygdala', level: 1.0 },
          { region: 'hippocampus', level: 1.0 },
          { region: 'dmn', level: 1.0 },
          { region: 'visual_cortex', level: 1.0 },
          { region: 'thalamus', level: 1.0 },
          { region: 'insula', level: 1.0 },
          { region: 'acc', level: 1.0 },
          { region: 'nucleus_accumbens', level: 1.0 },
          { region: 'brainstem', level: 0.5 },
          { region: 'cerebellum', level: 0.8 }
        ]
      },
      {
        text: 'DMT floods the system. The visual cortex blooms. You see everything you have never been able to describe.',
        duration: 6000,
        activations: [
          { region: 'visual_cortex', level: 1.0 },
          { region: 'dmn', level: 0.95 },
          { region: 'thalamus', level: 0.3 },
          { region: 'prefrontal', level: 0.2 }
        ]
      },
      {
        text: 'Fade to white. The last thing to disappear is the warmth.',
        duration: 5000,
        activations: [
          { region: 'insula', level: 0.6 },
          { region: 'nucleus_accumbens', level: 0.4 },
          { region: 'thalamus', level: 0.1 }
        ]
      },
      {
        text: '...',
        duration: 4000,
        activations: []
      }
    ]
  },
  {
    id: 'ayahuasca',
    title: 'Ayahuasca',
    subtitle: 'The vine of souls',
    description: 'The default mode network dissolves. The visual cortex becomes a universe. You remember what you always knew.',
    color: '#22ff88',
    steps: [
      {
        text: 'The ceremony begins. You drink. The medicine moves into the blood.',
        duration: 4000,
        activations: [
          { region: 'insula', level: 0.5 },
          { region: 'thalamus', level: 0.4 },
          { region: 'brainstem', level: 0.3 }
        ]
      },
      {
        text: 'Nausea rises — the body resisting what the soul has asked for. The insula burns.',
        duration: 4000,
        activations: [
          { region: 'insula', level: 0.9 },
          { region: 'brainstem', level: 0.7 },
          { region: 'amygdala', level: 0.5 }
        ]
      },
      {
        text: 'The self begins to quiet. The Default Mode Network dims — the narrator falls silent.',
        duration: 5000,
        activations: [
          { region: 'dmn', level: 0.1 },
          { region: 'prefrontal', level: 0.2 },
          { region: 'thalamus', level: 0.3 },
          { region: 'insula', level: 0.5 }
        ]
      },
      {
        text: 'The visual cortex ignites. Patterns. Light that breathes. Something looking back at you.',
        duration: 5000,
        activations: [
          { region: 'visual_cortex', level: 0.95 },
          { region: 'thalamus', level: 0.2 },
          { region: 'prefrontal', level: 0.1 }
        ]
      },
      {
        text: 'Buried memories rise. The amygdala surfaces what you spent years burying.',
        duration: 5000,
        activations: [
          { region: 'amygdala', level: 0.85 },
          { region: 'hippocampus', level: 0.8 },
          { region: 'acc', level: 0.6 },
          { region: 'visual_cortex', level: 0.7 }
        ]
      },
      {
        text: 'Everything is connected. You have always been connected. You remember — this is not new. You forgot.',
        duration: 6000,
        isClimax: true,
        activations: [
          { region: 'visual_cortex', level: 1.0 },
          { region: 'insula', level: 0.9 },
          { region: 'acc', level: 0.85 },
          { region: 'nucleus_accumbens', level: 0.8 },
          { region: 'hippocampus', level: 0.7 },
          { region: 'dmn', level: 0.2 }
        ]
      },
      {
        text: 'Gratitude. Pure, overwhelming gratitude for having been alive. For being alive.',
        duration: 5000,
        activations: [
          { region: 'nucleus_accumbens', level: 0.9 },
          { region: 'insula', level: 0.85 },
          { region: 'acc', level: 0.7 }
        ]
      },
      {
        text: 'You return. The narrator wakes. The world is the same. You are not.',
        duration: 5000,
        activations: [
          { region: 'dmn', level: 0.5 },
          { region: 'prefrontal', level: 0.6 },
          { region: 'thalamus', level: 0.5 }
        ]
      }
    ]
  },
  {
    id: 'love',
    title: 'Falling in Love',
    subtitle: 'The dopamine architecture of attachment',
    description: 'The nucleus accumbens floods. The self expands to include another. Empathy becomes indistinguishable from identity.',
    color: '#ff3366',
    steps: [
      {
        text: 'You notice them. Something in the thalamus catches — a signal above the noise.',
        duration: 4000,
        activations: [
          { region: 'thalamus', level: 0.7 },
          { region: 'nucleus_accumbens', level: 0.4 },
          { region: 'visual_cortex', level: 0.5 }
        ]
      },
      {
        text: 'They say something. The way they say it. The insula quickens.',
        duration: 4000,
        activations: [
          { region: 'insula', level: 0.6 },
          { region: 'nucleus_accumbens', level: 0.6 },
          { region: 'amygdala', level: 0.4 }
        ]
      },
      {
        text: 'You think about them when they are absent. The Default Mode Network fills with their face.',
        duration: 5000,
        activations: [
          { region: 'dmn', level: 0.8 },
          { region: 'nucleus_accumbens', level: 0.7 },
          { region: 'hippocampus', level: 0.5 }
        ]
      },
      {
        text: 'The dopamine floods. Every thought of them is a reward. You are becoming addicted to a person.',
        duration: 5000,
        activations: [
          { region: 'nucleus_accumbens', level: 0.95 },
          { region: 'prefrontal', level: 0.4 },
          { region: 'insula', level: 0.7 }
        ]
      },
      {
        text: 'The boundary between self and other begins to blur. The DMN expands. The "I" includes "you."',
        duration: 5000,
        isClimax: true,
        activations: [
          { region: 'dmn', level: 0.9 },
          { region: 'acc', level: 0.9 },
          { region: 'insula', level: 0.9 },
          { region: 'nucleus_accumbens', level: 0.9 },
          { region: 'prefrontal', level: 0.5 }
        ]
      },
      {
        text: 'Empathy maximized. You feel what they feel. The anterior cingulate cannot tell the difference.',
        duration: 5000,
        activations: [
          { region: 'acc', level: 1.0 },
          { region: 'insula', level: 0.85 },
          { region: 'thalamus', level: 0.6 }
        ]
      },
      {
        text: 'This is what belonging feels like. The nervous system remembers home.',
        duration: 5000,
        activations: [
          { region: 'nucleus_accumbens', level: 0.8 },
          { region: 'insula', level: 0.7 },
          { region: 'brainstem', level: 0.3 },
          { region: 'acc', level: 0.6 }
        ]
      }
    ]
  },
  {
    id: 'trauma',
    title: 'Trauma Response',
    subtitle: 'The amygdala hijack',
    description: 'The prefrontal cortex goes offline. The brainstem takes the wheel. The body speaks the language the mind has forgotten.',
    color: '#cc0022',
    steps: [
      {
        text: 'Something familiar in the environment. A smell. A tone of voice. The body knows before the mind does.',
        duration: 4000,
        activations: [
          { region: 'amygdala', level: 0.5 },
          { region: 'insula', level: 0.5 },
          { region: 'thalamus', level: 0.6 }
        ]
      },
      {
        text: 'The amygdala fires. It is not comparing this moment to the past — it is the past.',
        duration: 4000,
        activations: [
          { region: 'amygdala', level: 0.9 },
          { region: 'hippocampus', level: 0.7 },
          { region: 'brainstem', level: 0.6 }
        ]
      },
      {
        text: 'The brainstem takes over. Fight. Flight. Freeze. The body moves before thought forms.',
        duration: 5000,
        activations: [
          { region: 'brainstem', level: 0.95 },
          { region: 'amygdala', level: 0.95 },
          { region: 'insula', level: 0.8 }
        ]
      },
      {
        text: 'The prefrontal cortex goes offline. You cannot think. You cannot reason. You can only feel.',
        duration: 5000,
        activations: [
          { region: 'brainstem', level: 1.0 },
          { region: 'amygdala', level: 1.0 },
          { region: 'prefrontal', level: 0.05 },
          { region: 'hippocampus', level: 0.8 }
        ]
      },
      {
        text: 'Memory fragments. Non-linear. The hippocampus cannot sequence. The past and present collapse.',
        duration: 5000,
        isClimax: true,
        activations: [
          { region: 'hippocampus', level: 0.9 },
          { region: 'amygdala', level: 0.95 },
          { region: 'brainstem', level: 0.9 },
          { region: 'acc', level: 0.7 },
          { region: 'insula', level: 0.8 },
          { region: 'prefrontal', level: 0.0 }
        ]
      },
      {
        text: 'The wave passes. The prefrontal cortex comes back online, slowly. Shame arrives after the storm.',
        duration: 5000,
        activations: [
          { region: 'prefrontal', level: 0.4 },
          { region: 'acc', level: 0.7 },
          { region: 'amygdala', level: 0.4 },
          { region: 'dmn', level: 0.5 }
        ]
      },
      {
        text: 'You survived. You have always survived. The body remembers how.',
        duration: 5000,
        activations: [
          { region: 'brainstem', level: 0.2 },
          { region: 'insula', level: 0.5 },
          { region: 'prefrontal', level: 0.6 },
          { region: 'acc', level: 0.5 }
        ]
      }
    ]
  },
  {
    id: 'meditation',
    title: 'Deep Meditation',
    subtitle: 'The quiet at the center',
    description: 'The narrator falls silent. The thalamus dims. What remains when everything unnecessary has been set down.',
    color: '#aaaaff',
    steps: [
      {
        text: 'You sit. The mind chatters. The Default Mode Network runs its commentary.',
        duration: 4000,
        activations: [
          { region: 'dmn', level: 0.8 },
          { region: 'prefrontal', level: 0.6 },
          { region: 'thalamus', level: 0.7 }
        ]
      },
      {
        text: 'You return to the breath. Again. And again. The prefrontal cortex settles.',
        duration: 5000,
        activations: [
          { region: 'prefrontal', level: 0.4 },
          { region: 'dmn', level: 0.5 },
          { region: 'thalamus', level: 0.5 },
          { region: 'brainstem', level: 0.3 }
        ]
      },
      {
        text: 'The Default Mode Network goes quiet. The narrator stops narrating. You are simply here.',
        duration: 5000,
        activations: [
          { region: 'dmn', level: 0.15 },
          { region: 'prefrontal', level: 0.3 },
          { region: 'thalamus', level: 0.4 },
          { region: 'insula', level: 0.4 }
        ]
      },
      {
        text: 'The thalamus dims. Sensory gating closes. The world recedes.',
        duration: 5000,
        activations: [
          { region: 'thalamus', level: 0.15 },
          { region: 'dmn', level: 0.1 },
          { region: 'prefrontal', level: 0.2 }
        ]
      },
      {
        text: 'What remains. A point of light. Pure awareness. Not aware of anything. Just — aware.',
        duration: 6000,
        isClimax: true,
        activations: [
          { region: 'thalamus', level: 0.5 },
          { region: 'dmn', level: 0.05 },
          { region: 'prefrontal', level: 0.1 },
          { region: 'brainstem', level: 0.2 }
        ]
      },
      {
        text: '...',
        duration: 4000,
        activations: [
          { region: 'thalamus', level: 0.4 }
        ]
      },
      {
        text: '...',
        duration: 4000,
        activations: [
          { region: 'thalamus', level: 0.3 }
        ]
      },
      {
        text: 'Silence.',
        duration: 5000,
        activations: []
      }
    ]
  }
];

export class JourneyController {
  private currentJourney: Journey | null = null;
  private currentStep: number = 0;
  private isRunning: boolean = false;
  private stepTimeout: ReturnType<typeof setTimeout> | null = null;
  private brain: BrainVisualization;
  private onStepChange: (step: JourneyStep, stepIndex: number, total: number) => void;
  private onJourneyEnd: () => void;

  constructor(
    brain: BrainVisualization,
    onStepChange: (step: JourneyStep, stepIndex: number, total: number) => void,
    onJourneyEnd: () => void
  ) {
    this.brain = brain;
    this.onStepChange = onStepChange;
    this.onJourneyEnd = onJourneyEnd;
  }

  public start(journeyId: string) {
    const journey = JOURNEYS.find(j => j.id === journeyId);
    if (!journey) return;
    this.stop();
    this.currentJourney = journey;
    this.currentStep = 0;
    this.isRunning = true;
    this.runStep();
  }

  private runStep() {
    if (!this.currentJourney || !this.isRunning) return;
    if (this.currentStep >= this.currentJourney.steps.length) {
      this.onJourneyEnd();
      this.isRunning = false;
      this.brain.setActivations([]);
      return;
    }

    const step = this.currentJourney.steps[this.currentStep];
    this.brain.setActivations(step.activations);
    this.onStepChange(step, this.currentStep, this.currentJourney.steps.length);

    if (step.isClimax) {
      this.brain.flashLifeReview();
    }

    this.stepTimeout = setTimeout(() => {
      this.currentStep++;
      this.runStep();
    }, step.duration);
  }

  public stop() {
    this.isRunning = false;
    if (this.stepTimeout) clearTimeout(this.stepTimeout);
    this.brain.setActivations([]);
  }

  public isActive(): boolean {
    return this.isRunning;
  }
}
