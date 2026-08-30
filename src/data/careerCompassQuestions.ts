// src/data/careerCompassQuestions.ts
import type { ArchetypeQuestion } from '@/types/careerCompass'

export const archetypeQuestions: ArchetypeQuestion[] = [
  // People Focus
  { id: 'cc_people_01', text: "I get energy from working closely with other people.", dimension: 'peopleFocus', reverseScored: false, weight: 1 },
  { id: 'cc_people_02', text: "I'd rather spend most of my workday focused on my own tasks than in meetings with others.", dimension: 'peopleFocus', reverseScored: true, weight: 1 },
  { id: 'cc_people_03', text: "Building relationships with clients or teammates matters more to me than working alone.", dimension: 'peopleFocus', reverseScored: false, weight: 1 },
  { id: 'cc_people_04', text: "Being around people all day tends to drain me more than it excites me.", dimension: 'peopleFocus', reverseScored: true, weight: 1 },

  // Leadership Drive
  { id: 'cc_lead_01', text: "I like being the person who's accountable for how something turns out.", dimension: 'leadershipDrive', reverseScored: false, weight: 1 },
  { id: 'cc_lead_02', text: "I'm comfortable directing other people's work, not just my own.", dimension: 'leadershipDrive', reverseScored: false, weight: 1 },
  { id: 'cc_lead_03', text: "I'd rather contribute great individual work than manage a team.", dimension: 'leadershipDrive', reverseScored: true, weight: 1 },
  { id: 'cc_lead_04', text: "When a group can't decide, I naturally step up and make the call.", dimension: 'leadershipDrive', reverseScored: false, weight: 1 },

  // Structure Preference
  { id: 'cc_struct_01', text: "I do my best work when expectations and processes are clearly defined.", dimension: 'structurePreference', reverseScored: false, weight: 1 },
  { id: 'cc_struct_02', text: "I like knowing exactly what my day will look like before it starts.", dimension: 'structurePreference', reverseScored: false, weight: 1 },
  { id: 'cc_struct_03', text: "I get bored in jobs that follow the same routine every day.", dimension: 'structurePreference', reverseScored: true, weight: 1 },
  { id: 'cc_struct_04', text: "Clear rules and steps help me feel confident, not restricted.", dimension: 'structurePreference', reverseScored: false, weight: 1 },

  // Ambiguity / Risk Tolerance
  { id: 'cc_ambig_01', text: "I'm comfortable making decisions even when I don't have all the information.", dimension: 'ambiguityTolerance', reverseScored: false, weight: 1 },
  { id: 'cc_ambig_02', text: "I enjoy work where the path forward isn't fully mapped out yet.", dimension: 'ambiguityTolerance', reverseScored: false, weight: 1 },
  { id: 'cc_ambig_03', text: "Sudden changes at work stress me out more than they excite me.", dimension: 'ambiguityTolerance', reverseScored: true, weight: 1 },
  { id: 'cc_ambig_04', text: "I'd rather take a calculated risk than wait for a sure thing.", dimension: 'ambiguityTolerance', reverseScored: false, weight: 1 },

  // Analytical <-> Creative Orientation
  { id: 'cc_analyt_01', text: "I trust a well-reasoned analysis more than a hunch, even a good one.", dimension: 'analyticalOrientation', reverseScored: false, weight: 1 },
  { id: 'cc_analyt_02', text: "I'd rather invent a new approach than follow a proven process.", dimension: 'analyticalOrientation', reverseScored: true, weight: 1 },
  { id: 'cc_analyt_03', text: "Numbers and data make a case more convincing to me than a compelling story.", dimension: 'analyticalOrientation', reverseScored: false, weight: 1 },
  { id: 'cc_analyt_04', text: "I enjoy brainstorming original ideas more than optimizing something that already works.", dimension: 'analyticalOrientation', reverseScored: true, weight: 1 },

  // Work Pace / Energy
  { id: 'cc_pace_01', text: "I thrive when I'm juggling multiple priorities at once.", dimension: 'workPace', reverseScored: false, weight: 1 },
  { id: 'cc_pace_02', text: "I like environments where progress and results are visible right away.", dimension: 'workPace', reverseScored: false, weight: 1 },
  { id: 'cc_pace_03', text: "I prefer a slower, more deliberate pace where I can focus deeply on one thing.", dimension: 'workPace', reverseScored: true, weight: 1 },
  { id: 'cc_pace_04', text: "A little healthy competition motivates me to perform better.", dimension: 'workPace', reverseScored: false, weight: 1 },
]
