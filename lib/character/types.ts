export type CharacteristicId =
  | "melee"
  | "agility"
  | "fellowship"
  | "shooting"
  | "endurance"
  | "intelligence"
  | "strength"
  | "perception"
  | "willpower";

export type HitZone = "head" | "rightArm" | "leftArm" | "body" | "rightLeg" | "leftLeg";

export type Characteristic = {
  id: CharacteristicId;
  label: string;
  short: string;
  value: number;
  advances: number;
};

export type Skill = {
  id: string;
  label: string;
  characteristic: CharacteristicId;
  level: number;
  custom?: boolean;
  parentId?: string;
};

export type Talent = {
  id: string;
  name: string;
  properties: string;
  requirements: string;
  source: "talent" | "race";
};

export type Armor = {
  id: string;
  name: string;
  type: string;
  armor: number;
  properties: string;
  zones: HitZone[];
};

export type Weapon = {
  id: string;
  name: string;
  weaponClass: string;
  range: string;
  rate: string;
  damage: string;
  penetration: string;
  magazine: string;
  reload: string;
  properties: string;
  collapsed: boolean;
};

export type InventoryItem = {
  id: string;
  name: string;
  cost: string;
  properties: string;
};

export type Breakthrough = { id: string; number: number; description: string };

export type Character = {
  formatVersion: 1;
  dataRevision?: number;
  characterId: string;
  savedAt: string;
  name: string;
  player: string;
  raceId: string;
  raceChoices: Record<string, string>;
  gender: "female" | "male";
  age: string;
  skin: string;
  eyes: string;
  hair: string;
  build: string;
  background: string;
  role: string;
  notes: string;
  allies: string;
  enemies: string;
  avatar: string;
  avatarCrop: { x: number; y: number; zoom: number };
  characteristics: Record<CharacteristicId, Characteristic>;
  aptitudes: Record<CharacteristicId, number>;
  racialAptitudes: Record<CharacteristicId, number>;
  appliedAptitudes: Record<CharacteristicId, number>;
  freeAptitudes: boolean;
  skills: Skill[];
  talents: Talent[];
  disorders: string[];
  mutations: string[];
  insanity: number;
  corruption: number | null;
  fateCurrent: number;
  fateMax: number;
  abyss: number;
  breakthroughs: Breakthrough[];
  naturalArmor: number;
  armor: Armor[];
  weapons: Weapon[];
  inventory: InventoryItem[];
  woundsCurrent: number;
  woundsTotal: number;
  fatigueCurrent: number;
  experienceEarned: number;
};

export type RaceChoice = { id: string; label: string; options: string[] };

export type RaceEffect = {
  characteristicBonuses?: Partial<Record<CharacteristicId, number>>;
  aptitudes?: Partial<Record<CharacteristicId, number>>;
  corruption?: number | null;
  naturalArmor?: number;
  traits?: Omit<Talent, "id" | "source">[];
};

export type Race = {
  id: string;
  family: string;
  name: string;
  subtitle?: string;
  summary: string;
  description: string;
  advantages: string[];
  disadvantages: string[];
  special?: boolean;
  aptitudeBudget: number;
  freeAptitudePoints?: number;
  aptitudes: Partial<Record<CharacteristicId, number>>;
  characteristicScale?: [number, number, number];
  /** @deprecated Imported only for compatibility with early project data. */
  characteristics?: Partial<Record<CharacteristicId, number>>;
  corruption?: number | null;
  wounds?: number;
  woundFactors?: Partial<Record<CharacteristicId, number>>;
  woundFlat?: number;
  woundCap?: number;
  naturalArmor?: number;
  naturalArmorFormula?: { base: number; enduranceMultiplier: number; round: "ceil" | "floor" };
  choices?: RaceChoice[];
  choiceEffects?: Record<string, Record<string, RaceEffect>>;
  traits?: Omit<Talent, "id" | "source">[];
};
