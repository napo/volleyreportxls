/**
 * Scouting vocabulary.
 *
 * A scout code is a skill letter followed by an evaluation symbol, e.g. `A#`.
 * Letters are those of the VolleyReportXLS paper sheet; the evaluations and
 * their meaning are the DataVolley 4 standard (manual §4.1, "Valutazione").
 * See docs/volleyreportxls-analysis.md §4.
 */

export const SKILLS = ['B', 'R', 'A', 'M', 'P', 'F'] as const;
export type Skill = (typeof SKILLS)[number];

/** From best to worst, as in the DataVolley and VolleyReportXLS tables. */
export const EVALUATIONS = ['#', '+', '!', '-', '/', '='] as const;
export type Evaluation = (typeof EVALUATIONS)[number];

export type ScoutCodeString = `${Skill}${Evaluation}`;

export interface ScoutCode {
  readonly skill: Skill;
  readonly evaluation: Evaluation;
}

export interface SkillDefinition {
  readonly skill: Skill;
  /** Name used in the user interface. */
  readonly label: string;
  /** Name of the same skill in DataVolley (whose letter may differ). */
  readonly dataVolley: { readonly letter: string; readonly name: string };
  /** Evaluations that may be written for this skill, with their meaning. */
  readonly evaluations: Readonly<Partial<Record<Evaluation, string>>>;
}

export const SKILL_DEFINITIONS: Readonly<Record<Skill, SkillDefinition>> = {
  B: {
    skill: 'B',
    label: 'Battuta',
    dataVolley: { letter: 'S', name: 'Battuta' },
    evaluations: {
      '#': "ace (punto diretto: la squadra avversaria non riceve o perde la palla al secondo tocco)",
      '+': "positiva (ricezione avversaria insufficiente: palla prevedibile, attacco a quattro scontato o palla alta)",
      '!': "forzante (ricezione avversaria negativa: solo alzate staccate o primo tempo forzato)",
      '-': "facile (ricezione avversaria perfetta o positiva: la squadra avversaria può giocare buone combinazioni d'attacco)",
      '/': "mezzo punto (la ricezione avversaria finisce direttamente nel nostro campo)",
      '=': 'errore (rete, fuori, fallo di piede)',
    },
  },
  R: {
    skill: 'R',
    label: 'Ricezione',
    dataVolley: { letter: 'R', name: 'Ricezione' },
    evaluations: {
      '#': "perfetta (palla in zona d'attacco ideale, tutte le opzioni aperte, compresa la veloce)",
      '+': "positiva (ottimo controllo, si può giocare una buona combinazione d'attacco)",
      '!': 'negativa / forzata (palleggiatore limitato: solo alzate staccate o primo tempo forzato)',
      '-': 'insufficiente (palla prevedibile, attacco a quattro scontato o palla alta)',
      '/': "errore / free-ball (palla spedita direttamente nel campo avversario senza poter attaccare)",
      '=': 'ace subito (punto diretto per chi batte)',
    },
  },
  A: {
    skill: 'A',
    label: 'Attacco',
    dataVolley: { letter: 'A', name: 'Attacco' },
    evaluations: {
      '#': 'vincente (punto diretto)',
      '+': "positivo (difeso con difficoltà, rigioca la nostra squadra)",
      '!': 'murato ma ripreso in copertura dalla nostra squadra',
      '-': "scadente (difeso facilmente dalla squadra avversaria)",
      '/': "murato (punto della squadra avversaria)",
      '=': 'errato (fuori, in rete, invasione)',
    },
  },
  M: {
    skill: 'M',
    label: 'Muro',
    dataVolley: { letter: 'B', name: 'Muro' },
    evaluations: {
      '#': 'vincente (punto diretto)',
      '+': 'positivo (la palla toccata può essere rigiocata dalla nostra squadra)',
      '!': "murato ma ripreso in copertura dalla squadra avversaria",
      '-': "scadente (la palla può essere rigiocata dalla squadra avversaria)",
      '/': "invasione (punto della squadra avversaria)",
      '=': 'errato (mani fuori, in rete, palla a terra nel proprio campo o fuori)',
    },
  },
  P: {
    skill: 'P',
    label: 'Alzata',
    dataVolley: { letter: 'E', name: 'Alzata' },
    // Only the faults: the set is not evaluated (project decision).
    evaluations: {
      '=': "fallo fischiato sul secondo tocco (doppia, trattenuta): punto alla squadra avversaria",
    },
  },
  F: {
    skill: 'F',
    label: 'Free ball',
    dataVolley: { letter: 'F', name: 'Free ball' },
    evaluations: {
      '#': 'offre al palleggiatore tutte le combinazioni di attacco',
      '+': 'il palleggiatore può servire tutti gli attaccanti, ma non agevolmente',
      '-': 'il palleggio può dare solo palla alta',
      '/': "free ball di là o impossibile costruire un'azione di attacco",
      '=': 'errore',
    },
  },
};

export function isSkill(value: string): value is Skill {
  return (SKILLS as readonly string[]).includes(value);
}

export function isEvaluation(value: string): value is Evaluation {
  return (EVALUATIONS as readonly string[]).includes(value);
}

export function isAllowed(code: ScoutCode): boolean {
  return SKILL_DEFINITIONS[code.skill].evaluations[code.evaluation] !== undefined;
}

export function scoutCode(skill: Skill, evaluation: Evaluation): ScoutCode {
  return { skill, evaluation };
}

export function formatScoutCode(code: ScoutCode): ScoutCodeString {
  return `${code.skill}${code.evaluation}`;
}

/** Every code that may appear on a scouting sheet, in skill/evaluation order. */
export function allScoutCodes(): ScoutCode[] {
  return SKILLS.flatMap((skill) => EVALUATIONS.map((evaluation) => scoutCode(skill, evaluation)).filter(isAllowed));
}
