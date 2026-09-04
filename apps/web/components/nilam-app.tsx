'use client';

import {
  getRuleset,
  type MatcherInput,
  type RulesetVersion,
} from '@nilam/engine';
import dynamic from 'next/dynamic';
import Link from 'next/link';
/**
 * Port of the `NILAM App.dc.html` design prototype.
 *
 * Every style string below is copied verbatim from the design file and parsed by
 * `css()` at render time, so the rendered CSS is identical to the prototype
 * rather than a re-interpretation of it. Markup, tag names, class names, copy
 * and the rule engine are ported one-to-one for the same reason.
 */

import {
  type CSSProperties,
  type ReactNode,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  canonicalQueryForLegacyHash,
  createNilamMatcherInput,
  evaluateNilamTruth,
  nilamControlsFromMatcher,
  parseLegacyNilamHash,
  type NilamRefinementField,
  type NilamSector,
} from '../lib/nilam-truth';
import { serializeMatcherState } from '../lib/matcher-state';
import { prepareSavedStackSnapshot } from '../lib/matcher-surfaces';
import { schemeDisplay } from '../lib/scheme-display';

const LandExplorerView = dynamic(
  () =>
    import('./land-explorer-view').then((module) => module.LandExplorerView),
  { ssr: false },
);

// ponytail: verbatim design style strings beat hand-translated objects here —
// one tiny parser keeps the port literally pixel-identical to the prototype.
function css(decls: string): CSSProperties {
  const out: Record<string, string> = {};
  for (const part of decls.split(';')) {
    const at = part.indexOf(':');
    if (at < 0) continue;
    const key = part.slice(0, at).trim();
    const value = part.slice(at + 1).trim();
    if (key === '' || value === '') continue;
    out[
      key.startsWith('--')
        ? key
        : key.replaceAll(/-([a-z])/g, (_, c: string) => c.toUpperCase())
    ] = value;
  }
  return out as CSSProperties;
}

type Press = {
  readonly onClick: () => void;
  readonly onKeyDown: (event: {
    key: string;
    preventDefault: () => void;
  }) => void;
  readonly role: 'button';
  readonly tabIndex: 0;
};

function press(run: () => void): Press {
  return {
    onClick: run,
    onKeyDown: (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        run();
      }
    },
    role: 'button',
    tabIndex: 0,
  };
}

type Lang = 'en' | 'ta';

type RankedEstate = {
  id: number;
  slug: string;
  name: string;
  district: string;
  block: string | null;
  backward: boolean;
  vacant: number;
  fromPerAcre: number | null;
};

type PlaybookStep = {
  title: string;
  org: string;
  docs: string;
  time: string;
  warn?: string;
};

const fmt = (l: number | null): string => {
  if (l === null) return '—';
  if (l < 100) return `₹${Math.round(l * 10) / 10}L`;
  return `₹${Math.round(l / 10) / 10}Cr`;
};

const lakhsFromSlider = (v: number): number =>
  Math.round(10 * 500 ** (v / 100));

const sliderFromLakhs = (l: number): number =>
  Math.max(0, Math.min(100, (100 * Math.log(l / 10)) / Math.log(500)));

const daysSince = (d: string): number =>
  Math.round((Date.now() - new Date(d).getTime()) / 86_400_000);

const daysUntil = (d: string): number =>
  Math.round((new Date(d).getTime() - Date.now()) / 86_400_000);

const formatSunset = (deadline: string, days: number): string => {
  const [year, month, day] = deadline.split('-');
  const stamp = `${day}.${month}.${year}`;
  return days >= 0
    ? `SUNSETS ${stamp} · ${days} DAYS LEFT`
    : `SUNSET PASSED ${stamp}`;
};

/* Matcher and encyclopedia truth comes from @nilam/engine. */

const PLAYBOOKS = {
  flagship: {
    title: 'Flagship SME — NEEDS + AIF + plot',
    steps: [
      {
        title: 'Udyam registration',
        org: 'udyamregistration.gov.in',
        docs: 'Aadhaar, PAN',
        time: '1 day',
      },
      {
        title: 'NEEDS application + EDP training',
        org: 'DIC / msmeonline.tn.gov.in',
        docs: 'Project report, certificates',
        time: '4–6 weeks',
        warn: 'Apply BEFORE plot allotment — NEEDS unlocks preferential allotment.',
      },
      {
        title: 'Plot application',
        org: 'TANSIDCO / SIPCOT portal',
        docs: 'NEEDS provisional letter, EMD',
        time: '3–8 weeks',
      },
      {
        title: 'Term loan sanction',
        org: 'Bank / TIIC',
        docs: 'DPR, collateral or CGTMSE',
        time: '4–8 weeks',
        warn: 'Get NEEDS tagging in the sanction letter itself.',
      },
      {
        title: 'AIF tagging of the loan',
        org: 'agriinfra.dac.gov.in + bank',
        docs: 'Sanction letter, DPR',
        time: '2–3 weeks',
        warn: 'Banks won’t volunteer AIF tagging — ask explicitly.',
      },
      {
        title: 'Stamp duty concession at registration',
        org: 'Sub-registrar',
        docs: 'DIC certificate',
        time: '1 day',
        warn: 'TN stamp-duty concession is pending-review and is not in the Matcher cash total.',
      },
      {
        title: 'Subsidy claims after production',
        org: 'DIC',
        docs: 'Production proof, CA certificate',
        time: '8–12 weeks',
      },
    ],
  },
  microfood: {
    title: 'Micro food unit — PMFME + Mudra',
    steps: [
      {
        title: 'FSSAI registration',
        org: 'foscos.fssai.gov.in',
        docs: 'ID, premises proof',
        time: '1 week',
      },
      {
        title: 'PMFME application with DPR',
        org: 'pmfme.mofpi.gov.in',
        docs: 'DPR (template provided)',
        time: '3–5 weeks',
        warn: 'Scheme sunsets 30.09.2026 — file before the window closes.',
      },
      {
        title: 'Mudra loan (Tarun)',
        org: 'Any bank / udyamimitra.in',
        docs: 'Business plan, quotations',
        time: '2–4 weeks',
      },
      {
        title: 'Udyam registration',
        org: 'udyamregistration.gov.in',
        docs: 'Aadhaar, PAN',
        time: '1 day',
      },
      {
        title: 'Subsidy back-ending',
        org: 'Lending bank',
        docs: 'Automatic on sanction',
        time: '—',
      },
    ],
  },
  womenlaunch: {
    title: 'Women / SC-ST launch — NEEDS + TANSIDCO plot',
    steps: [
      {
        title: 'Confirm special-category documents',
        org: 'DIC / community certificate office',
        docs: 'Gender or community certificate, ID',
        time: '1–3 weeks',
        warn: 'The Matcher does not invent a special rate until you name the exact category.',
      },
      {
        title: 'NEEDS application + EDP training',
        org: 'DIC / msmeonline.tn.gov.in',
        docs: 'Project report, certificates',
        time: '4–6 weeks',
        warn: 'Published NEEDS cash is 25% of eligible capital, capped at ₹75 lakh. Special-category add-ons stay pending verification.',
      },
      {
        title: 'Plot application',
        org: 'TANSIDCO portal',
        docs: 'NEEDS provisional letter, EMD',
        time: '3–8 weeks',
        warn: 'SIDCO women parks are not in the current vacancy snapshot. Confirm availability in writing.',
      },
      {
        title: 'Loan sanction with CGTMSE cover',
        org: 'Bank / TIIC',
        docs: 'Ask for CGTMSE explicitly',
        time: '4–8 weeks',
      },
      {
        title: 'Subsidy claims after production',
        org: 'DIC',
        docs: 'Production proof',
        time: '8–12 weeks',
      },
    ],
  },
} satisfies Record<string, { title: string; steps: readonly PlaybookStep[] }>;

type PbId = keyof typeof PLAYBOOKS;

const DICT_EN = {
  navMatcher: 'Matcher',
  navLand: 'Land Explorer',
  navSchemes: 'Schemes',
  navPlaybooks: 'Playbooks',
  navSaved: 'Saved',
  navChangelog: 'Changelog',
  eyebrow: 'GOVERNMENT LAND + SCHEME INTELLIGENCE · TAMIL NADU',
  heroTitle: 'Cited schemes and TANSIDCO plots, one computed answer.',
  heroSub:
    'Nine published schemes calculate from this profile. Land ranking uses the TANSIDCO vacancy snapshot — not every SIPCOT or SIDCO estate. Citations are portal and guideline sources; confirm the G.O. at your DIC. No signup.',
  sector: 'Sector',
  projectSize: 'Project size',
  district: 'District',
  promoter: 'Promoter profile',
  liveNote:
    'Every change recomputes live — flip “first-generation” off and watch NEEDS leave the stack.',
  totalSupport: 'Total computed support',
  disclaimer: 'Directional pre-DPR estimate — never a sanction assurance',
  share: 'Share result',
  shareCopied: 'Link copied ✓',
  openPlaybook: 'Open playbook',
  yourStack: 'Your scheme stack',
  eligibilityTest: 'Eligibility — your inputs',
  components: 'Benefit components',
  conflicts: 'Conflicts resolved',
  nearMisses: 'Near misses',
  sequence: 'Application sequence',
  landOptions: 'Ranked land options',
  allEstates: 'All estates',
  fullPage: 'Full scheme page',
  landTitle: 'Government industrial land, plot by plot.',
  landSub:
    'TANSIDCO vacancy snapshot only — not a complete TANSIDCO, SIPCOT and SIDCO registry. Rates and vacancy are as published on the source date.',
  backwardBadge: 'Backward block (source flag)',
  sectorMapNote:
    'Textiles is scored as manufacturing. Engineering is scored as traditional industry.',
  runHere: 'Run matcher here',
  plotMap: 'Plot status (source GIS)',
  infra: 'Infrastructure',
  distances: 'Distance to',
  schemesTitle: 'Scheme encyclopedia',
  schemesSub:
    'Every scheme in the rule engine. Cash totals use published calculating rules only. Pending-review and retired records stay out of the total.',
  whatYouGet: 'What you get — computed',
  exampleNote:
    'Computed with your current promoter profile; edit in the Matcher.',
  howToApply: 'How to apply',
  goHistory: 'G.O. history',
  doYouQualify: 'Do you qualify?',
  checkerNote: 'Tested live against your Matcher inputs.',
  editInMatcher: 'Edit inputs in Matcher',
  conflictsWith: 'Conflicts',
  pbTitle: 'Playbooks',
  pbSub:
    'Ordered application sequences — which office, which documents, realistic timelines, and the failure modes nobody tells you about.',
  pbLocalNote: 'Progress saves on this device. Telegram sync is unavailable.',
  savedTitle: 'Saved stacks & alerts',
  savedSub:
    'When a Government Order moves, your numbers move — and you hear about it first.',
  alerts: 'Alerts',
  tgTitle: 'Get alerts on Telegram',
  tgText: 'Telegram delivery is not available in this release.',
  tgCta: 'Telegram unavailable',
  tgNote: 'Use Account for available saved work and alerts.',
  clTitle: 'Public changelog',
  clSub:
    'Every rule change, verification and estate sync — the audit trail behind every number we show.',
  moatEyebrow: 'WHY TRUST THESE NUMBERS',
  moatTitle:
    'Lists rot. NILAM pins cited rulesets, separates pending records, and shows evidence dates instead of inventing certainty.',
  footerDisclaimer:
    'All figures are directional pre-DPR estimates from cited portal and guideline sources — never a sanction assurance. Confirm the current G.O. at your DIC in writing.',
  simpleWords: 'In simple words',
  totalSimple:
    'Cash subsidy, cost-saving support and financing access are shown separately. The total includes only amounts the verified engine can calculate from this profile.',
  glossaryTitle: 'Words you’ll see here — explained simply',
  landExplain:
    'This explorer lists TANSIDCO estates that currently show vacancy. SIPCOT and SIDCO are not in this snapshot. Green on the plan means the GIS layer marked that parcel vacant on the fetch date — apply only after written confirmation.',
  schemesExplain:
    'A “scheme” is a government programme that gives your business money or help. Some give free money you never repay (a subsidy); some make loans cheaper or easier to get. Tap any card to see what you would get and exactly how to apply.',
  pbExplain:
    'A playbook is a simple to-do list for getting government money: which office to visit, what papers to carry, in what order, and how long each step really takes. Tick steps as you finish them — your progress is saved on this device.',
  savedExplain:
    'Saved work and any real notification history are available from your Account.',
  clExplain:
    'Every number we show comes from an official Government Order (G.O.) — the document where a rule is written. This page lists every change we make, when, and who checked it — so you can see nothing is made up.',
};

const DICT_TA: typeof DICT_EN = {
  ...DICT_EN,
  navMatcher: 'பொருத்தி',
  navLand: 'நில வரைபடம்',
  navSchemes: 'திட்டங்கள்',
  navPlaybooks: 'வழிகாட்டிகள்',
  navSaved: 'சேமிப்பு',
  navChangelog: 'மாற்றப் பதிவு',
  eyebrow: 'அரசு நிலம் + திட்ட நுண்ணறிவு · தமிழ்நாடு',
  heroTitle:
    'மேற்கோள் திட்டங்களும் TANSIDCO மனைகளும் — ஒரே கணக்கிடப்பட்ட பதில்.',
  heroSub:
    'ஒன்பது வெளியிடப்பட்ட திட்டங்கள் இந்த விவரத்திலிருந்து கணக்கிடப்படும். நிலத் தரவரிசை TANSIDCO காலியிடப் பதிவேட்டை மட்டுமே பயன்படுத்துகிறது — எல்லா SIPCOT/SIDCO தோட்டங்களும் அல்ல. அரசாணையை DIC-இல் உறுதிப்படுத்தவும். பதிவு தேவையில்லை.',
  sector: 'துறை',
  projectSize: 'திட்ட மதிப்பு',
  district: 'மாவட்டம்',
  promoter: 'தொழில்முனைவோர் விவரம்',
  liveNote:
    'ஒவ்வொரு மாற்றமும் உடனே கணக்கிடப்படும் — “முதல் தலைமுறை” அணைத்தால் NEEDS விலகுவதைப் பாருங்கள்.',
  totalSupport: 'மொத்த கணக்கிடப்பட்ட ஆதரவு',
  disclaimer: 'திசைகாட்டும் மதிப்பீடு — ஒப்புதல் உறுதி அல்ல',
  share: 'முடிவைப் பகிர்',
  shareCopied: 'இணைப்பு நகலெடுக்கப்பட்டது ✓',
  openPlaybook: 'வழிகாட்டி திற',
  yourStack: 'உங்கள் திட்ட அடுக்கு',
  eligibilityTest: 'தகுதி — உங்கள் உள்ளீடுகள்',
  components: 'பயன் கூறுகள்',
  conflicts: 'முரண்கள் தீர்க்கப்பட்டன',
  nearMisses: 'சற்றே தவறியவை',
  sequence: 'விண்ணப்ப வரிசை',
  landOptions: 'தரவரிசை நில விருப்பங்கள்',
  allEstates: 'அனைத்து தோட்டங்கள்',
  fullPage: 'முழு திட்டப் பக்கம்',
  landTitle: 'அரசு தொழில் நிலம், மனை வாரியாக.',
  landSub:
    'TANSIDCO காலியிடப் பதிவேடு மட்டும் — முழு TANSIDCO, SIPCOT, SIDCO பட்டியல் அல்ல. விலையும் காலியிடமும் மூலத் தேதியில் உள்ளபடி.',
  backwardBadge: 'பின்தங்கிய வட்டம் (மூலக் குறி)',
  sectorMapNote:
    'ஜவுளி உற்பத்தியாகவும், பொறியியல் பாரம்பரியத் தொழிலாகவும் மதிப்பிடப்படும்.',
  runHere: 'இங்கு பொருத்து',
  plotMap: 'மனை நிலை (மூல GIS)',
  infra: 'உள்கட்டமைப்பு',
  distances: 'தூரம்',
  schemesTitle: 'திட்ட களஞ்சியம்',
  schemesSub:
    'விதி இயந்திரத்தில் உள்ள ஒவ்வொரு திட்டமும். பண மொத்தம் வெளியிடப்பட்ட கணக்கிடும் விதிகளுக்கு மட்டும். நிலுவை மற்றும் ஓய்வுபெற்றவை மொத்தத்தில் இல்லை.',
  whatYouGet: 'என்ன கிடைக்கும் — கணக்கிடப்பட்டது',
  exampleNote: 'உங்கள் தற்போதைய விவரத்துடன் கணக்கிடப்பட்டது.',
  howToApply: 'விண்ணப்பிக்கும் முறை',
  goHistory: 'அரசாணை வரலாறு',
  doYouQualify: 'நீங்கள் தகுதியா?',
  checkerNote: 'உங்கள் பொருத்தி உள்ளீடுகளுடன் நேரலையில் சோதிக்கப்பட்டது.',
  editInMatcher: 'பொருத்தியில் திருத்து',
  conflictsWith: 'முரண்கள்',
  pbTitle: 'வழிகாட்டிகள்',
  pbSub:
    'வரிசைப்படுத்தப்பட்ட விண்ணப்ப வழிமுறைகள் — எந்த அலுவலகம், என்ன ஆவணங்கள், நடைமுறை காலவரம்பு.',
  pbLocalNote:
    'முன்னேற்றம் இந்த சாதனத்தில் சேமிக்கப்படும். Telegram ஒத்திசைவு இப்போது கிடைக்காது.',
  savedTitle: 'சேமித்த அடுக்குகள் & எச்சரிக்கைகள்',
  savedSub:
    'அரசாணை மாறினால், உங்கள் எண்களும் மாறும் — முதலில் உங்களுக்குத் தெரியும்.',
  alerts: 'எச்சரிக்கைகள்',
  tgTitle: 'Telegram-இல் எச்சரிக்கை',
  tgText: 'இந்த வெளியீட்டில் Telegram வழங்கல் கிடைக்காது.',
  tgCta: 'Telegram கிடைக்காது',
  tgNote:
    'கிடைக்கும் சேமிப்பு மற்றும் எச்சரிக்கைகளுக்கு Account பகுதியைப் பயன்படுத்தவும்.',
  clTitle: 'பொது மாற்றப் பதிவு',
  clSub:
    'ஒவ்வொரு விதி மாற்றமும், சரிபார்ப்பும் — நாங்கள் காட்டும் ஒவ்வொரு எண்ணுக்கும் பின்னுள்ள தணிக்கைத் தடம்.',
  moatEyebrow: 'இந்த எண்களை ஏன் நம்பலாம்',
  moatTitle:
    'பட்டியல்கள் பழசாகும். இது ஒரு சரிபார்ப்புச் சுழற்சி: ஒவ்வொரு போர்ட்டலையும் கண்காணிப்பு, ஒவ்வொரு விதி மாற்றத்திற்கும் மனித ஒப்புதல், பழமை மறைக்கப்படாமல் காட்டப்படும்.',
  footerDisclaimer:
    'அனைத்து எண்களும் மேற்கோள் போர்ட்டல் மற்றும் வழிகாட்டிகளிலிருந்து கணக்கிடப்பட்ட திசைகாட்டும் மதிப்பீடுகள் — ஒப்புதல் உறுதி அல்ல. நடப்பு அரசாணையை DIC-இல் எழுத்துப்பூர்வமாக உறுதிப்படுத்தவும்.',
  simpleWords: 'எளிய வார்த்தைகளில்',
  totalSimple:
    'மானியம் = அரசு தரும் இலவசப் பணம்; திருப்பிச் செலுத்த வேண்டாம். கடன் சலுகைகள் கடனை மலிவாக்கும். இடதுபுறம் தேர்ந்த விவரங்களுக்கு இரண்டும் சேர்த்த மொத்தம் இது.',
  glossaryTitle: 'இங்கு காணும் வார்த்தைகள் — எளிய விளக்கம்',
  landExplain:
    'இங்கு காலியிடம் காட்டும் TANSIDCO தோட்டங்கள் மட்டுமே உள்ளன. SIPCOT மற்றும் SIDCO இந்தப் பதிவேட்டில் இல்லை. வரைபடத்தில் பச்சை = GIS அடுக்கில் அன்று காலி என்று குறிக்கப்பட்டது — எழுத்துப்பூர்வ உறுதிக்குப் பிறகே விண்ணப்பிக்கவும்.',
  schemesExplain:
    '“திட்டம்” என்பது உங்கள் தொழிலுக்கு பணமோ உதவியோ தரும் அரசு நிகழ்ச்சி. சில இலவசப் பணம் (மானியம்) தரும்; சில கடனை மலிவாக்கும். எந்த அட்டையையும் தட்டினால் — என்ன கிடைக்கும், எப்படி விண்ணப்பிப்பது என்று தெரியும்.',
  pbExplain:
    'வழிகாட்டி என்பது எளிய செய்-பட்டியல்: எந்த அலுவலகம், என்ன ஆவணங்கள், எந்த வரிசையில், எவ்வளவு நேரம். முடித்த படிகளை டிக் செய்யுங்கள் — முன்னேற்றம் இந்த சாதனத்தில் சேமிக்கப்படும்.',
  savedExplain:
    '“அடுக்கு” = பொருத்தியில் நீங்கள் சேமித்த முடிவு — உங்கள் தொழில் விவரம் + தகுதியான அரசு பணம். அரசு விதிகள் அடிக்கடி மாறும்; உங்கள் அடுக்கை பாதித்தால் இங்கு (Telegram இணைத்தால் அங்கும்) சொல்வோம்.',
  clExplain:
    'நாங்கள் காட்டும் ஒவ்வொரு எண்ணும் அதிகாரப்பூர்வ அரசாணையில் (G.O.) இருந்து வருகிறது. எந்த மாற்றம், எப்போது, யார் சரிபார்த்தார் — எல்லாம் இங்கே. எதுவும் கற்பனை இல்லை.',
};

const CHIP_OFF =
  'padding:9px 18px;border-radius:9999px;border:1px solid var(--color-lightgray);background:#fff;color:var(--color-gray);cursor:pointer;user-select:none';
const CHIP_ON =
  'padding:9px 18px;border-radius:9999px;border:1px solid var(--action);background:var(--action);color:var(--on-action);cursor:pointer;user-select:none';

export function NilamApp({
  initialInput,
  initialRuleset,
  defaultLang = 'en',
  staleDays = 90,
  showMarketing = true,
  projectMemoryEnabled = true,
}: {
  readonly initialInput: MatcherInput;
  readonly initialRuleset: RulesetVersion;
  readonly defaultLang?: Lang;
  readonly staleDays?: number;
  readonly showMarketing?: boolean;
  readonly projectMemoryEnabled?: boolean;
}) {
  const initialControls = nilamControlsFromMatcher(initialInput);
  const [view, setView] = useState('matcher');
  const [lang, setLang] = useState<Lang | null>(null);
  const [sector, setSector] = useState<NilamSector>(initialControls.sector);
  const [sliderVal, setSliderVal] = useState(
    sliderFromLakhs(initialControls.projectCostLakhs),
  );
  const [district, setDistrict] = useState(initialControls.district);
  const [firstGen, setFirstGen] = useState(initialControls.firstGeneration);
  const [special, setSpecial] = useState(initialControls.specialCategory);
  const [backward, setBackward] = useState(initialControls.backwardBlock);
  const [fpo, setFpo] = useState(initialControls.fpoWilling);
  const [refinements, setRefinements] = useState(initialInput);
  const [confirmedFields, setConfirmedFields] = useState<
    ReadonlySet<keyof MatcherInput>
  >(new Set());
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    needs: true,
  });
  const [rankedLand, setRankedLand] = useState<RankedEstate[]>([]);
  const [liveDistricts, setLiveDistricts] = useState<string[] | null>(null);
  const [landSnapshotAt, setLandSnapshotAt] = useState<string | null>(null);
  const [schemeSel, setSchemeSel] = useState<string | null>(null);
  const [pbSelId, setPbSelId] = useState<PbId>('flagship');
  const [pbDone, setPbDone] = useState<Record<string, Record<number, boolean>>>(
    {},
  );
  const [howOpen, setHowOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [savingProject, setSavingProject] = useState(false);
  const [saveNotice, setSaveNotice] = useState<string>();

  // Read the prototype hash for one release, then immediately canonicalise it.
  useEffect(() => {
    const legacyHash = location.hash;
    const storedPlaybookProgress = localStorage.getItem('nilam_pb_done');
    const frame = requestAnimationFrame(() => {
      try {
        const legacy = parseLegacyNilamHash(legacyHash);
        const canonical = canonicalQueryForLegacyHash(legacyHash);
        if (legacy !== null && canonical !== null) {
          const controls = nilamControlsFromMatcher(legacy.input);
          setSector(controls.sector);
          setSliderVal(sliderFromLakhs(controls.projectCostLakhs));
          setDistrict(controls.district);
          setFirstGen(controls.firstGeneration);
          setSpecial(controls.specialCategory);
          setBackward(controls.backwardBlock);
          setFpo(controls.fpoWilling);
          setRefinements(legacy.input);
          history.replaceState(null, '', `${location.pathname}?${canonical}`);
        }
        const pb = JSON.parse(storedPlaybookProgress || 'null');
        if (pb) setPbDone(pb);
      } catch {
        /* no stored state */
      }
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  const L: Lang = lang || defaultLang;
  const t = L === 'ta' ? DICT_TA : DICT_EN;
  const P = lakhsFromSlider(sliderVal);

  const canonicalInput = useMemo(
    () =>
      createNilamMatcherInput(
        {
          sector,
          projectCostLakhs: P,
          district,
          firstGeneration: firstGen,
          specialCategory: special,
          backwardBlock: backward,
          fpoWilling: fpo,
        },
        refinements,
      ),
    [backward, district, firstGen, fpo, P, refinements, sector, special],
  );
  const canonicalQuery = useMemo(
    () =>
      serializeMatcherState({
        input: canonicalInput,
        ruleset: initialRuleset,
      }),
    [canonicalInput, initialRuleset],
  );

  useEffect(() => {
    if (view === 'matcher') {
      history.replaceState(null, '', `${location.pathname}?${canonicalQuery}`);
    }
  }, [canonicalQuery, view]);

  const refine = <Key extends NilamRefinementField>(
    field: Key,
    value: MatcherInput[Key],
  ) => {
    setRefinements((current) => ({ ...current, [field]: value }));
    setConfirmedFields((current) => new Set([...current, field]));
  };

  const freshBadge = (verified: string) => {
    const d = daysSince(verified);
    const stale = d > staleDays;
    return {
      fresh: stale ? `VERIFIED ${d}D AGO` : 'VERIFIED ✓',
      freshStyle: stale
        ? 'padding:3px 10px;border-radius:9999px;background:var(--color-stone);color:var(--color-umber)'
        : 'padding:3px 10px;border-radius:9999px;background:var(--color-green-10);color:var(--color-green-100)',
    };
  };

  // ── Canonical engine boundary ──
  const truth = useMemo(
    () => evaluateNilamTruth(canonicalInput, initialRuleset, confirmedFields),
    [canonicalInput, confirmedFields, initialRuleset],
  );
  const selectedRuleset = getRuleset(initialRuleset);
  const publishedById = new Map(
    selectedRuleset.records
      .filter((record) => record.status === 'published')
      .map((record) => [record.id, record]),
  );
  const all = selectedRuleset.records.map((record) => {
    const display = schemeDisplay(record.id);
    const citation = record.citations[0];
    return {
      id: record.id,
      name: display?.shortName ?? record.name,
      nameTa: record.nameTa,
      level: record.level,
      dept: record.department,
      status: record.status,
      verified: citation?.verifiedOn ?? truth.result.asOf,
      deadline: record.deadline,
      line:
        display?.line ??
        (record.status === 'published'
          ? (record.caveats[0] ?? record.name)
          : record.reviewReason),
      summary:
        display?.summary ??
        (record.status === 'published'
          ? record.caveats.join(' ')
          : record.reviewReason),
      eligibility:
        record.status === 'published' ? record.eligibility : undefined,
      steps:
        record.status === 'published'
          ? record.steps.map((step) => step.title)
          : [],
      conflictLine:
        selectedRuleset.conflictPairs
          .filter(
            (pair) => pair.schemeA === record.id || pair.schemeB === record.id,
          )
          .map((pair) => pair.rationale)
          .join(' ') || 'No published conflict is recorded.',
      history: record.citations.map((source) => ({
        go: source.title,
        date: source.documentDate ?? source.verifiedOn,
        note: `Verified ${source.verifiedOn} · ${source.issuingAuthority}`,
      })),
      citation: citation?.title ?? 'Official source pending',
    };
  });
  const winners = truth.schemes.map((scheme) => {
    const record = publishedById.get(scheme.schemeId);
    if (record === undefined) {
      throw new Error(`Missing published display record ${scheme.schemeId}`);
    }
    const display = schemeDisplay(scheme.schemeId);
    const primaryGroup = scheme.benefitGroups[0]?.kind;
    return {
      s: {
        id: scheme.schemeId,
        name: display?.shortName ?? scheme.name,
        nameTa: scheme.nameTa,
        level: record.level,
        dept: record.department,
        group:
          primaryGroup === 'financing-access'
            ? 'access'
            : primaryGroup === 'cost-saving'
              ? 'incentive'
              : 'capital',
        citation: scheme.citations[0]?.title ?? 'Official source',
        verified: scheme.citations[0]?.verifiedOn ?? truth.result.asOf,
        deadline: scheme.deadline,
        line: display?.line ?? scheme.caveats[0] ?? scheme.name,
      },
      checks: scheme.predicates.map((predicate) => ({
        label: predicate.label,
        pass: predicate.passed,
      })),
      bens: scheme.benefits.map((benefit) => ({
        lakhs: benefit.amountLakhs,
        note: benefit.label,
        kind: benefit.kind,
      })),
      benefitGroups: scheme.benefitGroups,
      total: scheme.totalLakhs,
    };
  });
  const near = truth.result.nearMisses.map((nearMiss) => ({
    s: { id: nearMiss.schemeId, name: nearMiss.name },
    fail: nearMiss.failedPredicates.map(({ label }) => label).join('; '),
  }));
  const evConflicts = truth.result.conflicts.map((conflict) => ({
    win: conflict.keptSchemeId,
    lose: conflict.droppedSchemeId,
    rationale: conflict.rationale,
    confirmedAt: conflict.confirmedAt,
  }));
  const evTotal = truth.totalLakhs;

  const mkChecks = (checks: readonly { label: string; pass: boolean }[]) =>
    checks.map((c) => ({
      label: c.label,
      mark: c.pass ? '✓' : '✕',
      markStyle: `color:${c.pass ? 'var(--color-green-100)' : 'var(--color-red-100)'}`,
      textStyle: c.pass ? '' : 'color:var(--color-silvergray)',
    }));

  // ── Nav ──
  const navDefs: readonly [string, string][] = [
    ['matcher', t.navMatcher],
    ['land', t.navLand],
    ['schemes', t.navSchemes],
    ['playbooks', t.navPlaybooks],
    ['saved', t.navSaved],
    ['changelog', t.navChangelog],
  ];

  const goto = (v: string) => {
    if (v === 'saved') {
      location.assign('/account');
      return;
    }
    if (v === 'changelog') {
      location.assign('/changelog');
      return;
    }
    setView(v);
    setSchemeSel(null);
  };

  // ── Matcher inputs ──
  const sectorDefs: readonly [NilamSector, string, string][] = [
    ['food', 'Food processing', 'உணவு'],
    ['agri', 'Agri value-add', 'வேளாண்'],
    ['textiles', 'Textiles', 'ஜவுளி'],
    ['engineering', 'Engineering', 'பொறியியல்'],
    ['services', 'Services', 'சேவைகள்'],
  ];
  const fallbackDistricts = [
    'Thanjavur',
    'Madurai',
    'Coimbatore',
    'Erode',
    'Ranipet',
    'Chennai',
    'Krishnagiri',
    'Tirunelveli',
    'Salem',
    'Villupuram',
  ];
  // Until the snapshot answers, keep the current value selectable.
  const districts = [
    ...new Set([...(liveDistricts ?? fallbackDistricts), district]),
  ].sort();
  const updateBackward = (value: boolean) => {
    setBackward(value);
  };
  const togDefs: readonly [boolean, (v: boolean) => void, string, string][] = [
    [
      firstGen,
      setFirstGen,
      L === 'ta'
        ? 'முதல் தலைமுறை தொழில்முனைவோர்'
        : 'First-generation entrepreneur',
      L === 'ta'
        ? 'குடும்பத்தின் முதல் தொழில் · NEEDS திறக்கும்'
        : 'First business in your family · unlocks NEEDS',
    ],
    [
      special,
      setSpecial,
      L === 'ta' ? 'பெண் / SC / ST' : 'Woman / SC / ST promoter',
      L === 'ta'
        ? 'வெளியிடப்பட்ட திட்டங்களில் சரியான வகை முக்கியம்'
        : 'Exact category affects published eligibility and rates',
    ],
    [
      backward,
      updateBackward,
      L === 'ta'
        ? 'பின்தங்கிய வட்டம் / கிராமப்புறம்'
        : 'Rural / backward block',
      L === 'ta'
        ? 'ஊரக விகிதங்கள் பொருந்தலாம்; நிலுவை விதிகள் மொத்தத்தில் இல்லை'
        : 'Rural rates may apply; pending concessions stay excluded',
    ],
    [
      fpo,
      setFpo,
      L === 'ta' ? 'FPO / SPV வழி செல்ல தயார்' : 'Willing to route via FPO',
      L === 'ta'
        ? 'சரிபார்ப்பில் உள்ள குழுத் திட்டங்களுக்கான விவரம்'
        : 'Profile fact for group programmes still under verification',
    ],
  ];

  // ── Sequence ──
  const sequence = truth.result.sequence.map((step) => ({
    n: String(step.order),
    title: step.title,
    meta: step.organisation,
  }));

  // ── Ranked land options (server-ranked over the TANSIDCO snapshot) ──
  useEffect(() => {
    let live = true;
    const q = new URLSearchParams({
      district,
      backward: backward ? '1' : '0',
    });
    fetch(`/api/estates/ranked?${q.toString()}`)
      .then((r) =>
        r.ok ? r.json() : Promise.reject(new Error(String(r.status))),
      )
      .then(
        (d: {
          ranked: RankedEstate[];
          districts: string[];
          fetchedAt: string | null;
        }) => {
          if (!live) return;
          setRankedLand(d.ranked);
          setLiveDistricts(d.districts);
          setLandSnapshotAt(d.fetchedAt?.slice(0, 10) ?? null);
        },
      )
      .catch(() => {
        if (live) setRankedLand([]);
      });
    return () => {
      live = false;
    };
  }, [district, backward]);

  // ── Scheme detail ──
  const detail = schemeSel ? all.find((x) => x.id === schemeSel) : null;

  // ── Playbooks ──
  const pb = PLAYBOOKS[pbSelId];
  const doneMap = pbDone[pbSelId] || {};
  const doneCount = pb.steps.filter((_, index) => doneMap[index]).length;
  const flipStep = (index: number) => {
    setPbDone((prev) => {
      const cur = { ...(prev[pbSelId] || {}) };
      cur[index] = !cur[index];
      const next = { ...prev, [pbSelId]: cur };
      try {
        localStorage.setItem('nilam_pb_done', JSON.stringify(next));
      } catch {
        /* storage unavailable */
      }
      return next;
    });
  };

  // The rich shell no longer carries example account data or fabricated events.
  const savedStacks: readonly {
    title: string;
    inputs: string;
    total: string;
    version: string;
    deltaBadge: string;
    delta: string | null;
  }[] = [];
  const alerts: readonly {
    badge: string;
    badgeStyle: string;
    text: string;
    date: string;
  }[] = [];
  const clEntries: readonly {
    date: string;
    kind: string;
    entity: string;
    note: string;
    actor: string;
  }[] = [];
  const kindStyles: Readonly<Record<string, string>> = {};
  const clStats = [
    {
      val: `${truth.inventory.published} / ${truth.inventory.total}`,
      label: L === 'ta' ? 'கணக்கிடும் விதிகள்' : 'Calculating records',
    },
    {
      val: truth.result.rulesetVersion,
      label: L === 'ta' ? 'தற்போதைய விதித்தொகுப்பு' : 'Current ruleset',
    },
    {
      val: String(truth.inventory.pendingReview),
      label: L === 'ta' ? 'சரிபார்ப்பு நிலுவை' : 'Pending (excluded)',
    },
  ];

  // ── Marketing band ──
  const trust = [
    {
      title:
        L === 'ta'
          ? 'ஒவ்வொரு எண்ணுக்கும் அரசாணை'
          : 'Every number carries its G.O.',
      text:
        L === 'ta'
          ? 'மேற்கோள் இல்லாத எண் வெளியிடப்படாது — CI-ஆல் கட்டாயப்படுத்தப்படுகிறது.'
          : 'No orphan facts, ever. A number without a Government Order citation and verified-on date cannot ship — our build fails.',
    },
    {
      title:
        L === 'ta' ? 'பழமை மறைக்கப்படாது' : 'Staleness is shown, not hidden',
      text:
        L === 'ta'
          ? '90 நாளுக்கு மேல் சரிபார்க்கப்படாத விதி அம்பர் பேட்ஜ் அணியும். நேர்மையே எங்கள் அடையாளம்.'
          : 'A rule unverified for over 90 days wears an amber badge. Honesty is the brand — you always know how fresh an answer is.',
    },
    {
      title:
        L === 'ta'
          ? 'அரசாணை மாறினால் தெரியும்'
          : 'When a G.O. moves, you hear first',
      text:
        L === 'ta'
          ? 'சரிபார்க்கப்பட்ட மாற்றங்கள் பொது மாற்றப் பதிவில் காணப்படும்.'
          : 'Verified changes are published in the real public changelog; account surfaces show only persisted records.',
    },
  ];
  const loopSteps = [
    {
      n: '01',
      title: L === 'ta' ? 'மூல ஆதாரம்' : 'Source evidence',
      text:
        L === 'ta'
          ? 'அதிகாரப்பூர்வ மூலமும் சரிபார்ப்பு தேதியும்'
          : 'Each calculating rule carries an official source and verification date.',
    },
    {
      n: '02',
      title: L === 'ta' ? 'மாற்ற வேறுபாடு' : 'Change diff',
      text:
        L === 'ta'
          ? 'புலம்-அளவில் வேறுபாடுகள்'
          : 'Field-level diffs against production; G.O. PDFs hashed and summarized.',
    },
    {
      n: '03',
      title: L === 'ta' ? 'நிலை பிரிப்பு' : 'Status separation',
      text:
        L === 'ta'
          ? 'நிலுவை மற்றும் ஓய்வு பதிவுகள் மொத்தத்தில் சேராது'
          : 'Pending and retired records are visible but excluded from calculations.',
    },
    {
      n: '04',
      title: L === 'ta' ? 'பதிப்பு வெளியீடு' : 'Versioned publish',
      text:
        L === 'ta'
          ? 'விதித்தொகுப்பு பதிப்பு + பொது மாற்றப் பதிவு'
          : 'Ruleset versions and the public changelog expose released changes.',
    },
  ];
  const howSteps = (
    L === 'ta'
      ? [
          [
            '01',
            'உங்கள் யோசனையைச் சொல்லுங்கள்',
            'என்ன தயாரிப்பு, தோராயச் செலவு, மாவட்டம் — இரண்டே நிமிடம். பதிவு இல்லை, ஆவணம் இல்லை.',
          ],
          [
            '02',
            'உங்கள் பணத்தை உடனே பாருங்கள்',
            'தகுதியான ஒவ்வொரு மானியமும் (இலவசப் பணம்) கடன் சலுகையும் — ஒவ்வொரு எண்ணுக்கும் பின்னுள்ள அரசு விதியுடன்.',
          ],
          [
            '03',
            'படி படியாக விண்ணப்பியுங்கள்',
            'வழிகாட்டியைத் திறங்கள்: எந்த அலுவலகம், என்ன ஆவணங்கள், எந்த வரிசையில் — முதல் முறையினருக்காக எழுதப்பட்டது.',
          ],
        ]
      : [
          [
            '01',
            'Tell us about your idea',
            'Pick what you make, roughly what it costs, and your district. Two minutes. No signup, no documents.',
          ],
          [
            '02',
            'See your money instantly',
            'We show every subsidy (free money) and loan benefit you qualify for — with the government rule behind each number.',
          ],
          [
            '03',
            'Apply step by step',
            'Open the playbook: which office, which papers, in what order — written for first-timers.',
          ],
        ]
  ).map(([n, title, text]) => ({ n, title, text }));
  const glossary = (
    L === 'ta'
      ? [
          [
            'மானியம் (Subsidy)',
            'அரசு தரும் இலவசப் பணம். திருப்பிச் செலுத்தத் தேவையில்லை.',
          ],
          ['கடன் (Loan)', 'வட்டியுடன் திருப்பிச் செலுத்த வேண்டிய பணம்.'],
          [
            'வட்டி மானியம்',
            'உங்கள் கடன் வட்டியில் ஒரு பகுதியை அரசே செலுத்தும்.',
          ],
          [
            'அரசாணை (G.O.)',
            'ஒரு விதி எழுதப்பட்டுள்ள அதிகாரப்பூர்வ அரசு ஆவணம்.',
          ],
          [
            'DIC',
            'மாவட்டத் தொழில் மையம் — தொழில் திட்டங்களுக்கான உங்கள் மாவட்ட அரசு அலுவலகம்.',
          ],
          [
            'திட்ட அறிக்கை (DPR)',
            'உங்கள் தொழிலின் எழுத்துப்பூர்வ திட்டம்: என்ன, எவ்வளவு செலவு, எப்படி வருமானம்.',
          ],
          [
            'Udyam பதிவு',
            'தொழிலை அதிகாரப்பூர்வமாக்கும் இலவச ஆன்லைன் பதிவு. பெரும்பாலான திட்டங்களுக்குத் தேவை.',
          ],
          [
            'பின்தங்கிய வட்டம்',
            'அரசு விரைவாக வளர்க்க விரும்பும் பகுதி — அங்கு தொழிலுக்குக் கூடுதல் சலுகை.',
          ],
          [
            'சொந்தப் பங்கு (Margin)',
            'மொத்தச் செலவில் நீங்களே போட வேண்டிய பகுதி.',
          ],
          [
            'முத்திரைத் தீர்வை',
            'நிலத்தை உங்கள் பெயரில் பதியும்போது கட்டும் வரி.',
          ],
        ]
      : [
          ['Subsidy', 'Free money from the government. You never pay it back.'],
          ['Loan', 'Money you borrow and pay back with interest.'],
          [
            'Interest subvention',
            'The government pays part of your loan interest for you.',
          ],
          [
            'G.O. (Government Order)',
            'The official document where a government rule is written.',
          ],
          [
            'DIC',
            'District Industries Centre — the government office in your district that handles business schemes.',
          ],
          [
            'Project report (DPR)',
            'A written plan of your business: what you’ll make, what it costs, how you’ll earn.',
          ],
          [
            'Udyam',
            'A free online registration that makes your business official. Needed for most schemes.',
          ],
          [
            'Backward block',
            'An area the government wants to develop faster — businesses there get extra benefits.',
          ],
          [
            'Margin money',
            'The share of the cost you must put in from your own pocket.',
          ],
          ['Stamp duty', 'The tax you pay when registering land in your name.'],
        ]
  ).map(([term, def]) => ({ term, def }));

  const langPillOn =
    'padding:7px 14px;background:var(--color-darkgray);color:#fff;cursor:pointer';
  const langPillOff =
    'padding:7px 14px;background:transparent;color:var(--color-mediumgray);cursor:pointer';

  const onShare = () => {
    history.replaceState(null, '', `${location.pathname}?${canonicalQuery}`);
    try {
      void navigator.clipboard.writeText(location.href);
    } catch {
      /* clipboard blocked */
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  const saveProject = async () => {
    setSavingProject(true);
    setSaveNotice(undefined);
    const encoded = new TextEncoder().encode(
      JSON.stringify({ input: canonicalInput, ruleset: initialRuleset }),
    );
    const resultHash = [
      ...new Uint8Array(await crypto.subtle.digest('SHA-256', encoded)),
    ]
      .map((value) => value.toString(16).padStart(2, '0'))
      .join('');
    const response = await fetch('/api/account/saved-stacks', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: `${canonicalInput.sector} · ${canonicalInput.district}`,
        inputs: canonicalInput,
        resultSnapshot: prepareSavedStackSnapshot(truth.result),
        resultHash,
        rulesetVersion: truth.result.rulesetVersion,
      }),
    });
    const body = (await response.json().catch(() => ({}))) as {
      projectUrl?: string;
    };
    setSavingProject(false);
    if (response.ok && body.projectUrl !== undefined) {
      location.assign(body.projectUrl);
      return;
    }
    setSaveNotice(
      response.status === 401
        ? 'Sign in from Account to save this project.'
        : 'Could not save this project.',
    );
  };

  const simpleWordsBox = (text: string, extra: string): ReactNode => (
    <div style={css(`background:var(--color-paperwhite);${extra}`)}>
      <div
        className="q-body-sm-caps"
        style={css('color:var(--color-umber);margin-bottom:6px')}
      >
        {t.simpleWords}
      </div>
      <div
        className="q-body-base-default"
        style={css('color:var(--color-darkgray);text-wrap:pretty')}
      >
        {text}
      </div>
    </div>
  );

  return (
    <div
      style={css(
        `${
          view === 'land' ? 'height:100dvh' : 'min-height:100vh'
        };display:flex;flex-direction:column;font-family:var(--font-sans)`,
      )}
    >
      {/* ══ Header ══ */}
      <header
        style={css(
          'position:sticky;top:0;z-index:50;background:#FFFFFF;border-bottom:1px solid var(--color-lightgray)',
        )}
      >
        <div
          className="nilam-appbar"
          style={css(
            'max-width:1440px;margin:0 auto;padding:0 32px;height:64px;display:flex;align-items:center;gap:40px',
          )}
        >
          <div
            {...press(() => setView('matcher'))}
            style={css(
              'display:flex;align-items:baseline;gap:10px;cursor:pointer',
            )}
          >
            <span
              className="q-title-xl-dec"
              style={css('letter-spacing:0.02em')}
            >
              NILAM
            </span>
            <span
              className="q-body-sm-default"
              style={css('color:var(--color-silvergray)')}
            >
              நிலம்
            </span>
          </div>
          {/* The design assumed a wide viewport; on a phone the six items
              overflow. Scroll them sideways rather than wrap the 64px bar. */}
          <nav
            className="nilam-appnav"
            style={css(
              'display:flex;gap:28px;flex:1;min-width:0;overflow-x:auto;overscroll-behavior-x:contain;scrollbar-width:none',
            )}
          >
            {navDefs.map(([v, label]) => (
              <span
                key={v}
                className="q-body-sm-caps qh-nav"
                {...press(() => goto(v))}
                style={css(
                  `cursor:pointer;padding:22px 0;white-space:nowrap;flex:none;border-bottom:2px solid ${
                    view === v ? 'var(--color-darkgray)' : 'transparent'
                  };color:${view === v ? 'var(--color-darkgray)' : 'var(--color-mediumgray)'}`,
                )}
              >
                {label}
              </span>
            ))}
          </nav>
          <div style={css('display:flex;align-items:center;gap:16px')}>
            <span
              className="q-body-sm-default nilam-wide-only"
              style={css('color:var(--color-silvergray);white-space:nowrap')}
            >
              {truth.inventory.published}/{truth.inventory.total} calculating ·{' '}
              {truth.inventory.pendingReview} pending
            </span>
            <div
              style={css(
                'display:flex;border:1px solid var(--color-lightgray);border-radius:9999px;overflow:hidden',
              )}
            >
              <span
                className="q-body-sm-caps"
                {...press(() => setLang('en'))}
                style={css(L === 'en' ? langPillOn : langPillOff)}
              >
                EN
              </span>
              <span
                className="q-body-sm-caps"
                {...press(() => setLang('ta'))}
                style={css(L === 'ta' ? langPillOn : langPillOff)}
              >
                தமிழ்
              </span>
            </div>
          </div>
        </div>
      </header>

      <main
        style={css('flex:1;min-height:0;display:flex;flex-direction:column')}
      >
        {/* ══════════ MATCHER ══════════ */}
        {view === 'matcher' && (
          <div>
            {/* The tool, sized to the viewport. The design opened with a
                landing hero: eyebrow, 56px headline, lede and three how-steps,
                roughly 480px before a single control. That is a page for
                someone deciding whether to try this; the person actually here
                wants the inputs. Identity and the pitch collapse to one line
                with disclosures, and the story keeps its place below the fold. */}
            <div>
              <div
                className="nl-pad-row"
                style={css(
                  'flex:none;max-width:1440px;margin:0 auto;padding:14px 32px 0',
                )}
              >
                <div
                  style={css(
                    'display:flex;align-items:baseline;justify-content:space-between;gap:16px;flex-wrap:wrap',
                  )}
                >
                  <div
                    style={css(
                      'display:flex;align-items:baseline;gap:12px;flex-wrap:wrap',
                    )}
                  >
                    <h1 className="q-title-md-dec" style={css('margin:0')}>
                      {t.heroTitle}
                    </h1>
                    <button
                      type="button"
                      className="q-body-sm-caps"
                      onClick={() => setHowOpen((v) => !v)}
                      aria-expanded={howOpen}
                      style={css(
                        'border:none;background:transparent;color:var(--action);cursor:pointer;padding:0',
                      )}
                    >
                      {howOpen ? 'Hide' : 'How it works'}
                    </button>
                  </div>
                  {/* Truncates rather than clipping mid-word when the
                      headline takes the room it needs. */}
                  <span
                    className="q-body-sm-default nilam-wide-only"
                    style={css(
                      'color:var(--color-silvergray);min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap',
                    )}
                    title={t.eyebrow}
                  >
                    {t.eyebrow}
                  </span>
                </div>
                {howOpen && (
                  <div
                    style={css(
                      'background:var(--color-paperwhite);padding:14px 18px;margin-top:10px',
                    )}
                  >
                    <p
                      className="q-body-sm-default"
                      style={css(
                        'color:var(--color-gray);margin:0 0 12px;max-width:720px;text-wrap:pretty',
                      )}
                    >
                      {t.heroSub}
                    </p>
                    <div
                      className="nl-stack"
                      style={css(
                        'display:grid;grid-template-columns:repeat(3,1fr);gap:24px',
                      )}
                    >
                      {howSteps.map((hs) => (
                        <div
                          key={hs.n}
                          style={css(
                            'border-top:2px solid var(--accent);padding-top:10px',
                          )}
                        >
                          <div
                            className="q-body-sm-caps"
                            style={css('color:var(--color-mediumgray)')}
                          >
                            {hs.n}
                          </div>
                          <div
                            className="q-body-base-bold"
                            style={css('margin-top:6px')}
                          >
                            {hs.title}
                          </div>
                          <div
                            className="q-body-sm-default"
                            style={css(
                              'color:var(--color-gray);margin-top:3px;text-wrap:pretty',
                            )}
                          >
                            {hs.text}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Inputs + results */}
              <section
                className="nl-split nl-pad-page"
                style={css(
                  'max-width:1440px;margin:0 auto;padding:16px 32px 64px;display:grid;grid-template-columns:minmax(320px,420px) 1fr;gap:48px;align-items:start',
                )}
              >
                {/* Inputs */}
                <div
                  className="nl-tool-aside"
                  style={css('display:flex;flex-direction:column;gap:26px')}
                >
                  <div
                    style={css('display:flex;flex-direction:column;gap:12px')}
                  >
                    <div
                      className="q-body-sm-caps"
                      style={css('color:var(--color-mediumgray)')}
                    >
                      {t.sector}
                    </div>
                    <div style={css('display:flex;flex-wrap:wrap;gap:8px')}>
                      {sectorDefs.map(([id, en, ta]) => (
                        <span
                          key={id}
                          className="q-body-sm-caps qh-chip"
                          {...press(() => setSector(id))}
                          style={css(sector === id ? CHIP_ON : CHIP_OFF)}
                        >
                          {L === 'ta' ? ta : en}
                        </span>
                      ))}
                    </div>
                    {sector === 'textiles' || sector === 'engineering' ? (
                      <div
                        className="q-body-sm-default"
                        style={css('color:var(--color-silvergray)')}
                      >
                        {t.sectorMapNote}
                      </div>
                    ) : null}
                  </div>
                  <div
                    style={css('display:flex;flex-direction:column;gap:12px')}
                  >
                    <div
                      style={css(
                        'display:flex;justify-content:space-between;align-items:baseline',
                      )}
                    >
                      <span
                        className="q-body-sm-caps"
                        style={css('color:var(--color-mediumgray)')}
                      >
                        {t.projectSize}
                      </span>
                      <span className="q-title-lg-dec">{fmt(P)}</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="any"
                      value={sliderVal}
                      onChange={(e) => setSliderVal(Number(e.target.value))}
                      aria-label={t.projectSize}
                      style={css('width:100%')}
                    />
                    <div
                      style={css('display:flex;justify-content:space-between')}
                    >
                      <span
                        className="q-body-sm-default"
                        style={css('color:var(--color-silvergray)')}
                      >
                        ₹10L
                      </span>
                      <span
                        className="q-body-sm-default"
                        style={css('color:var(--color-silvergray)')}
                      >
                        ₹50Cr
                      </span>
                    </div>
                  </div>
                  <div
                    style={css('display:flex;flex-direction:column;gap:12px')}
                  >
                    <div
                      className="q-body-sm-caps"
                      style={css('color:var(--color-mediumgray)')}
                    >
                      {t.district}
                    </div>
                    <select
                      value={district}
                      onChange={(e) => setDistrict(e.target.value)}
                      aria-label={t.district}
                      className="q-body-base-default"
                      style={css(
                        'height:44px;border:1px solid var(--color-lightgray);border-radius:4px;padding:0 12px;background:#fff;color:var(--color-darkgray)',
                      )}
                    >
                      {districts.map((name) => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div
                    style={css('display:flex;flex-direction:column;gap:4px')}
                  >
                    <div
                      className="q-body-sm-caps"
                      style={css(
                        'color:var(--color-mediumgray);margin-bottom:8px',
                      )}
                    >
                      {t.promoter}
                    </div>
                    {togDefs.map(([on, set, label, sub]) => (
                      <div
                        key={label}
                        {...press(() => set(!on))}
                        aria-pressed={on}
                        style={css(
                          'display:flex;align-items:center;justify-content:space-between;gap:16px;padding:12px 0;border-bottom:1px solid var(--color-lightgray);cursor:pointer',
                        )}
                      >
                        <div>
                          <div className="q-body-base-default">{label}</div>
                          <div
                            className="q-body-sm-default"
                            style={css('color:var(--color-silvergray)')}
                          >
                            {sub}
                          </div>
                        </div>
                        <div
                          style={css(
                            `width:40px;height:22px;border-radius:9999px;flex:none;padding:2px;box-sizing:border-box;transition:background 150ms ease-out;background:${
                              on ? 'var(--action)' : 'var(--color-lightgray)'
                            }`,
                          )}
                        >
                          <div
                            style={css(
                              `width:18px;height:18px;border-radius:50%;background:#fff;transition:transform 150ms ease-out;transform:translateX(${
                                on ? '18px' : '0'
                              })`,
                            )}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                  <div
                    className="q-body-sm-default"
                    style={css('color:var(--color-silvergray)')}
                  >
                    {t.liveNote}
                  </div>
                  <details
                    style={css(
                      'border-top:1px solid var(--color-lightgray);padding-top:14px',
                    )}
                  >
                    <summary
                      className="q-body-sm-caps"
                      style={css('cursor:pointer;color:var(--action)')}
                    >
                      Refine accuracy
                    </summary>
                    <div
                      style={css(
                        'display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:14px',
                      )}
                    >
                      <label className="q-body-sm-default">
                        Eligible capital cost (₹L)
                        <input
                          type="number"
                          min="0"
                          max={P}
                          step="0.1"
                          value={canonicalInput.eligibleCapitalCostLakhs}
                          onChange={(event) =>
                            refine(
                              'eligibleCapitalCostLakhs',
                              Math.min(P, Number(event.currentTarget.value)),
                            )
                          }
                          style={css('width:100%;height:38px;margin-top:4px')}
                        />
                      </label>
                      <label className="q-body-sm-default">
                        Requested loan (₹L)
                        <input
                          type="number"
                          min="0"
                          max={P}
                          step="0.1"
                          value={canonicalInput.requestedLoanLakhs}
                          onChange={(event) =>
                            refine(
                              'requestedLoanLakhs',
                              Math.min(P, Number(event.currentTarget.value)),
                            )
                          }
                          style={css('width:100%;height:38px;margin-top:4px')}
                        />
                      </label>
                      <label className="q-body-sm-default">
                        Age
                        <input
                          type="number"
                          min="18"
                          max="100"
                          value={canonicalInput.age}
                          onChange={(event) =>
                            refine(
                              'age',
                              Math.max(
                                18,
                                Math.min(
                                  100,
                                  Number(event.currentTarget.value),
                                ),
                              ),
                            )
                          }
                          style={css('width:100%;height:38px;margin-top:4px')}
                        />
                      </label>
                      <label className="q-body-sm-default">
                        Enterprise stage
                        <select
                          value={canonicalInput.enterpriseStage}
                          onChange={(event) =>
                            refine(
                              'enterpriseStage',
                              event.currentTarget
                                .value as MatcherInput['enterpriseStage'],
                            )
                          }
                          style={css('width:100%;height:38px;margin-top:4px')}
                        >
                          <option value="new">New</option>
                          <option value="existing">Existing</option>
                        </select>
                      </label>
                      <label className="q-body-sm-default">
                        Enterprise size
                        <select
                          value={canonicalInput.enterpriseSize}
                          onChange={(event) =>
                            refine(
                              'enterpriseSize',
                              event.currentTarget
                                .value as MatcherInput['enterpriseSize'],
                            )
                          }
                          style={css('width:100%;height:38px;margin-top:4px')}
                        >
                          <option value="micro">Micro</option>
                          <option value="small">Small</option>
                          <option value="medium">Medium</option>
                          <option value="not-msme">Not an MSME</option>
                        </select>
                      </label>
                      <label className="q-body-sm-default">
                        Exact special category
                        <select
                          value={canonicalInput.specialCategory}
                          onChange={(event) => {
                            const category = event.currentTarget
                              .value as MatcherInput['specialCategory'];
                            setSpecial(category !== 'none');
                            refine('specialCategory', category);
                          }}
                          style={css('width:100%;height:38px;margin-top:4px')}
                        >
                          <option value="none">None</option>
                          <option value="woman">Woman</option>
                          <option value="sc">SC</option>
                          <option value="st">ST</option>
                          <option value="bc">BC</option>
                          <option value="mbc">MBC</option>
                          <option value="minority">Minority</option>
                          <option value="ex-serviceman">Ex-serviceman</option>
                          <option value="transgender">Transgender</option>
                          <option value="differently-abled">
                            Differently-abled
                          </option>
                        </select>
                      </label>
                    </div>
                  </details>
                </div>

                {/* Results */}
                <div
                  className="nl-pad-card"
                  style={css(
                    'background:var(--color-paperwhite);padding:40px;display:flex;flex-direction:column;gap:32px',
                  )}
                >
                  <div
                    style={css(
                      'display:flex;justify-content:space-between;align-items:flex-start;gap:24px;flex-wrap:wrap',
                    )}
                  >
                    <div>
                      <div
                        className="q-body-sm-caps"
                        style={css('color:var(--color-mediumgray)')}
                      >
                        {t.totalSupport}
                      </div>
                      <div
                        className="q-rich-2xl-dec"
                        style={css(
                          'font-size:64px;line-height:1.05;margin-top:8px',
                        )}
                      >
                        {fmt(evTotal)}
                      </div>
                      <div
                        className="q-body-sm-default"
                        style={css(
                          'color:var(--color-silvergray);margin-top:8px',
                        )}
                      >
                        {t.disclaimer} ·{' '}
                        <Link href="/changelog">
                          ruleset {truth.result.rulesetVersion}
                        </Link>
                      </div>
                      <div
                        className="q-body-sm-default"
                        style={css(
                          'color:var(--color-gray);margin-top:10px;max-width:460px;text-wrap:pretty',
                        )}
                      >
                        {t.totalSimple}
                      </div>
                      <div
                        className="q-body-sm-default"
                        style={css(
                          'color:var(--color-gray);margin-top:10px;display:flex;gap:16px;flex-wrap:wrap',
                        )}
                      >
                        <span>Cash subsidy {fmt(truth.cashSubsidyLakhs)}</span>
                        <span>
                          Reimbursement / cost saving{' '}
                          {truth.costSavingLakhs > 0
                            ? fmt(truth.costSavingLakhs)
                            : 'not quantified'}
                        </span>
                        <span>
                          Financing / access{' '}
                          {winners.some((winner) =>
                            winner.benefitGroups.some(
                              (group) => group.kind === 'financing-access',
                            ),
                          )
                            ? 'available'
                            : 'none matched'}
                        </span>
                      </div>
                      {truth.assumptions.length > 0 && (
                        <details
                          style={css(
                            'margin-top:14px;max-width:560px;border-top:1px solid var(--color-lightgray);padding-top:10px',
                          )}
                        >
                          <summary
                            className="q-body-sm-caps"
                            style={css(
                              'cursor:pointer;color:var(--color-umber)',
                            )}
                          >
                            Directional preview · {truth.assumptions.length}{' '}
                            assumptions
                          </summary>
                          <div
                            className="q-body-sm-default"
                            style={css(
                              'color:var(--color-gray);margin-top:8px',
                            )}
                          >
                            {truth.assumptions.map((assumption) => (
                              <div key={assumption.field}>
                                {assumption.highImpact ? 'High impact · ' : ''}
                                {assumption.label}: {assumption.value}
                              </div>
                            ))}
                            <button
                              type="button"
                              className="q-body-sm-caps"
                              onClick={() =>
                                setConfirmedFields(
                                  (current) =>
                                    new Set([
                                      ...current,
                                      ...truth.assumptions.map(
                                        (assumption) => assumption.field,
                                      ),
                                    ]),
                                )
                              }
                              style={css(
                                'border:1px solid var(--color-darkgray);background:transparent;margin-top:10px;padding:6px 12px;cursor:pointer',
                              )}
                            >
                              Confirm these assumptions
                            </button>
                          </div>
                        </details>
                      )}
                    </div>
                    <div
                      style={css(
                        'display:flex;gap:12px;align-items:center;flex-wrap:wrap',
                      )}
                    >
                      {projectMemoryEnabled && (
                        <button
                          type="button"
                          disabled={savingProject}
                          onClick={() => void saveProject()}
                          className="q-body-sm-caps qh-primary"
                          style={css(
                            'height:44px;padding:0 28px;border-radius:9999px;border:none;background:var(--action);color:var(--on-action);cursor:pointer',
                          )}
                        >
                          {savingProject ? 'Saving…' : 'Save as project'}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={onShare}
                        className="q-body-sm-caps qh-primary"
                        style={css(
                          'height:44px;padding:0 28px;border-radius:9999px;border:none;background:var(--action);color:var(--on-action);cursor:pointer',
                        )}
                      >
                        {copied ? t.shareCopied : t.share}
                      </button>
                      <button
                        type="button"
                        onClick={() => setView('playbooks')}
                        className="q-body-sm-caps qh-secondary"
                        style={css(
                          'height:44px;padding:0 24px;border-radius:9999px;border:1px solid var(--color-darkgray);background:transparent;color:var(--color-darkgray);cursor:pointer',
                        )}
                      >
                        {t.openPlaybook}
                      </button>
                      {saveNotice === undefined ? null : (
                        <span className="q-body-sm-default" role="status">
                          {saveNotice}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Eligible schemes */}
                  <div>
                    <div
                      className="q-body-sm-caps"
                      style={css(
                        'color:var(--color-mediumgray);padding-bottom:12px;border-bottom:1px solid var(--color-darkgray)',
                      )}
                    >
                      {t.yourStack} · {winners.length}
                      {L === 'ta' ? ' திட்டங்கள்' : ' schemes'}
                    </div>
                    {winners.map((w) => {
                      const fb = freshBadge(w.s.verified);
                      void fb;
                      const dl = w.s.deadline ? daysUntil(w.s.deadline) : null;
                      const isOpen = Boolean(expanded[w.s.id]);
                      return (
                        <div
                          key={w.s.id}
                          style={css(
                            'border-bottom:1px solid var(--color-lightgray)',
                          )}
                        >
                          <div
                            {...press(() =>
                              setExpanded((prev) => ({
                                ...prev,
                                [w.s.id]: !prev[w.s.id],
                              })),
                            )}
                            aria-expanded={isOpen}
                            style={css(
                              'display:grid;grid-template-columns:1fr auto auto;gap:16px;align-items:center;padding:16px 0;cursor:pointer',
                            )}
                          >
                            <div>
                              <div
                                style={css(
                                  'display:flex;align-items:center;gap:10px;flex-wrap:wrap',
                                )}
                              >
                                <span className="q-body-base-bold">
                                  {w.s.name}
                                </span>
                                <span
                                  className="q-body-sm-default"
                                  style={css('color:var(--color-silvergray)')}
                                >
                                  {w.s.nameTa}
                                </span>
                                <span
                                  className="q-body-sm-caps"
                                  style={css(
                                    'padding:2px 10px;border-radius:9999px;border:1px solid var(--color-lightgray);color:var(--color-mediumgray)',
                                  )}
                                >
                                  {w.s.level.toUpperCase() +
                                    (w.s.group === 'access'
                                      ? ' · ACCESS'
                                      : w.s.group === 'incentive'
                                        ? ' · INCENTIVE'
                                        : ' · CAPITAL')}
                                </span>
                                {dl !== null && (
                                  <span
                                    className="q-body-sm-caps"
                                    style={css('color:var(--color-red-100)')}
                                  >
                                    {dl >= 0
                                      ? `SUNSETS IN ${dl} DAYS`
                                      : 'SUNSET PASSED'}
                                  </span>
                                )}
                              </div>
                              <div
                                className="q-body-sm-default"
                                style={css(
                                  'color:var(--color-gray);margin-top:4px',
                                )}
                              >
                                {w.s.line}
                              </div>
                            </div>
                            <span className="q-title-md-dec">
                              {w.total > 0
                                ? fmt(w.total)
                                : L === 'ta'
                                  ? 'அணுகல்'
                                  : 'Access'}
                            </span>
                            <span
                              className="q-body-sm-default"
                              style={css(
                                'color:var(--color-silvergray);width:16px;text-align:center',
                              )}
                            >
                              {isOpen ? '−' : '+'}
                            </span>
                          </div>
                          {isOpen && (
                            <div
                              className="nl-stack"
                              style={css(
                                'padding:0 0 20px;display:grid;grid-template-columns:1fr 1fr;gap:24px',
                              )}
                            >
                              <div>
                                <div
                                  className="q-body-sm-caps"
                                  style={css(
                                    'color:var(--color-mediumgray);margin-bottom:8px',
                                  )}
                                >
                                  {t.eligibilityTest}
                                </div>
                                {mkChecks(w.checks).map((c) => (
                                  <div
                                    key={c.label}
                                    style={css(
                                      'display:flex;gap:10px;align-items:center;padding:4px 0',
                                    )}
                                  >
                                    <span
                                      className="q-body-sm-bold"
                                      style={css(c.markStyle)}
                                    >
                                      {c.mark}
                                    </span>
                                    <span
                                      className="q-body-sm-default"
                                      style={css(c.textStyle)}
                                    >
                                      {c.label}
                                    </span>
                                  </div>
                                ))}
                              </div>
                              <div
                                style={css(
                                  'display:flex;flex-direction:column;gap:10px',
                                )}
                              >
                                <div>
                                  <div
                                    className="q-body-sm-caps"
                                    style={css(
                                      'color:var(--color-mediumgray);margin-bottom:8px',
                                    )}
                                  >
                                    {t.components}
                                  </div>
                                  {w.bens.map((b) => (
                                    <div
                                      key={b.note}
                                      className="q-body-sm-default"
                                      style={css('padding:3px 0')}
                                    >
                                      <span className="q-body-sm-bold">
                                        {b.lakhs === null ? '—' : fmt(b.lakhs)}
                                      </span>{' '}
                                      — {b.note}
                                    </div>
                                  ))}
                                </div>
                                <div
                                  className="q-body-sm-default"
                                  style={css('color:var(--color-silvergray)')}
                                >
                                  {w.s.citation} · verified {w.s.verified}
                                </div>
                                <a
                                  className="q-body-sm-caps"
                                  {...press(() => {
                                    setView('schemes');
                                    setSchemeSel(w.s.id);
                                  })}
                                  style={css(
                                    'cursor:pointer;text-decoration:none;color:var(--color-darkgray)',
                                  )}
                                >
                                  {t.fullPage} →
                                </a>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Conflicts */}
                  {evConflicts.length > 0 && (
                    <div>
                      <div
                        className="q-body-sm-caps"
                        style={css(
                          'color:var(--color-mediumgray);margin-bottom:12px',
                        )}
                      >
                        {t.conflicts}
                      </div>
                      {evConflicts.map((c) => (
                        <div
                          key={c.lose}
                          style={css(
                            'background:#FFFFFF;border:1px solid var(--color-lightgray);padding:16px 20px;margin-bottom:8px',
                          )}
                        >
                          <div className="q-body-base-default">
                            Kept {c.win} over {c.lose}. {c.rationale}
                          </div>
                          <div
                            className="q-body-sm-default"
                            style={css(
                              'color:var(--color-silvergray);margin-top:6px',
                            )}
                          >
                            Confirmation level:{' '}
                            {c.confirmedAt.replaceAll('-', ' ')}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Near misses */}
                  {near.length > 0 && (
                    <div>
                      <div
                        className="q-body-sm-caps"
                        style={css(
                          'color:var(--color-mediumgray);margin-bottom:12px',
                        )}
                      >
                        {t.nearMisses}
                      </div>
                      {near.map((nm) => (
                        <div
                          key={nm.s.id}
                          className="q-body-sm-default"
                          style={css(
                            'padding:8px 0;border-bottom:1px solid var(--color-lightgray)',
                          )}
                        >
                          <span className="q-body-sm-bold">{nm.s.name}</span> —{' '}
                          {(L === 'ta'
                            ? 'இதில் மட்டும் தவறுகிறது: '
                            : 'misses only on: ') + nm.fail}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Sequence + Land side by side */}
                  <div
                    className="nl-stack"
                    style={css(
                      'display:grid;grid-template-columns:1fr 1fr;gap:40px',
                    )}
                  >
                    <div>
                      <div
                        className="q-body-sm-caps"
                        style={css(
                          'color:var(--color-mediumgray);margin-bottom:12px',
                        )}
                      >
                        {t.sequence}
                      </div>
                      {sequence.map((st) => (
                        <div
                          key={st.n}
                          style={css(
                            'display:flex;gap:14px;padding:10px 0;border-bottom:1px solid var(--color-lightgray)',
                          )}
                        >
                          <span
                            className="q-title-sm-dec"
                            style={css(
                              'color:var(--color-silvergray);min-width:24px',
                            )}
                          >
                            {st.n}
                          </span>
                          <div>
                            <div className="q-body-sm-bold">{st.title}</div>
                            <div
                              className="q-body-sm-default"
                              style={css('color:var(--color-gray)')}
                            >
                              {st.meta}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div>
                      <div
                        className="q-body-sm-caps"
                        style={css(
                          'color:var(--color-mediumgray);margin-bottom:12px',
                        )}
                      >
                        {t.landOptions}
                      </div>
                      {rankedLand.map((e) => (
                        <div
                          key={e.id}
                          className="qh-row-offwhite"
                          {...press(() => setView('land'))}
                          style={css(
                            'padding:12px 0;border-bottom:1px solid var(--color-lightgray);cursor:pointer',
                          )}
                        >
                          <div
                            style={css(
                              'display:flex;justify-content:space-between;gap:12px',
                            )}
                          >
                            <Link
                              className="q-body-sm-bold"
                              href={`/estates/${e.slug}`}
                              onClick={(event) => event.stopPropagation()}
                            >
                              {e.name}
                            </Link>
                            <span
                              className="q-body-sm-default"
                              style={css('color:var(--color-gray)')}
                            >
                              {e.fromPerAcre === null
                                ? '—'
                                : `from ${fmt(e.fromPerAcre / 100_000)}/ac`}
                            </span>
                          </div>
                          <div
                            className="q-body-sm-default"
                            style={css(
                              'color:var(--color-silvergray);margin-top:2px',
                            )}
                          >
                            {[
                              e.district,
                              e.block,
                              `${e.vacant} vacant`,
                              e.backward ? 'backward block ✓' : null,
                              landSnapshotAt === null
                                ? 'TANSIDCO vacancy snapshot'
                                : `TANSIDCO snapshot ${landSnapshotAt}`,
                            ]
                              .filter(Boolean)
                              .join(' · ')}
                          </div>
                        </div>
                      ))}
                      <a
                        className="q-body-sm-caps"
                        {...press(() => setView('land'))}
                        style={css(
                          'display:inline-block;margin-top:12px;cursor:pointer;text-decoration:none',
                        )}
                      >
                        {t.allEstates} →
                      </a>
                    </div>
                  </div>
                </div>

                {/* On a phone the total is a screen away from the inputs that
                  drive it, so pin it. Desktop hides this (see base.css). */}
                <div className="nl-sticky-total">
                  <span
                    className="q-body-sm-caps"
                    style={css('color:var(--color-mediumgray)')}
                  >
                    {t.totalSupport}
                  </span>
                  <span className="q-title-lg-dec">{fmt(evTotal)}</span>
                  <span
                    className="q-body-sm-default"
                    style={css('color:var(--color-gray)')}
                  >
                    {winners.length}
                    {L === 'ta' ? ' திட்டங்கள்' : ' schemes'}
                  </span>
                </div>
              </section>
            </div>

            {/* Glossary */}
            <section style={css('border-top:1px solid var(--color-lightgray)')}>
              <div
                className="nl-pad-page"
                style={css('max-width:1440px;margin:0 auto;padding:48px 32px')}
              >
                <div
                  className="q-body-sm-caps"
                  style={css(
                    'color:var(--color-mediumgray);margin-bottom:24px',
                  )}
                >
                  {t.glossaryTitle}
                </div>
                <div
                  style={css(
                    'display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px 48px',
                  )}
                >
                  {glossary.map((g) => (
                    <div
                      key={g.term}
                      className="q-body-sm-default"
                      style={css('color:var(--color-gray);text-wrap:pretty')}
                    >
                      <span
                        className="q-body-sm-bold"
                        style={css('color:var(--color-darkgray)')}
                      >
                        {g.term}
                      </span>{' '}
                      — {g.def}
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* Marketing band */}
            {showMarketing && (
              <>
                <section
                  style={css(
                    'border-top:1px solid var(--color-lightgray);background:#FFFFFF',
                  )}
                >
                  <div
                    className="nl-stack nl-pad-band"
                    style={css(
                      'max-width:1440px;margin:0 auto;padding:56px 32px;display:grid;grid-template-columns:repeat(3,1fr);gap:48px',
                    )}
                  >
                    {trust.map((tr) => (
                      <div key={tr.title}>
                        <div
                          className="q-body-sm-caps"
                          style={css('margin-bottom:10px')}
                        >
                          {tr.title}
                        </div>
                        <div
                          className="q-body-base-default"
                          style={css(
                            'color:var(--color-gray);text-wrap:pretty',
                          )}
                        >
                          {tr.text}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
                <section
                  style={css('background:var(--color-darkgray);color:#FFFFFF')}
                >
                  <div
                    className="nl-pad-band"
                    style={css(
                      'max-width:1440px;margin:0 auto;padding:72px 32px',
                    )}
                  >
                    <div
                      className="q-body-sm-caps"
                      style={css(
                        'color:var(--accent-on-dark);margin-bottom:16px',
                      )}
                    >
                      {t.moatEyebrow}
                    </div>
                    <div
                      className="q-title-2xl-dec"
                      style={css(
                        'max-width:720px;font-size:34px;line-height:1.25;text-wrap:pretty',
                      )}
                    >
                      {t.moatTitle}
                    </div>
                    <div
                      className="nl-stack"
                      style={css(
                        'display:grid;grid-template-columns:repeat(4,1fr);gap:32px;margin-top:48px',
                      )}
                    >
                      {loopSteps.map((ls) => (
                        <div
                          key={ls.n}
                          style={css(
                            'border-top:1px solid rgba(255,255,255,0.3);padding-top:16px',
                          )}
                        >
                          <div
                            className="q-body-sm-caps"
                            style={css('color:rgba(255,255,255,0.6)')}
                          >
                            {ls.n}
                          </div>
                          <div
                            className="q-body-base-bold"
                            style={css('margin:8px 0 6px')}
                          >
                            {ls.title}
                          </div>
                          <div
                            className="q-body-sm-default"
                            style={css('color:rgba(255,255,255,0.65)')}
                          >
                            {ls.text}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>
              </>
            )}
          </div>
        )}

        {/* ══════════ LAND EXPLORER ══════════ */}
        {view === 'land' && (
          <LandExplorerView
            eyebrow={t.navLand}
            title={t.landTitle}
            simpleWords={t.simpleWords}
            explain={t.landExplain}
            runHereLabel={t.runHere}
            backwardBadge={t.backwardBadge}
            onRunMatcher={(d, bb) => {
              setView('matcher');
              setDistrict(d);
              updateBackward(bb);
            }}
          />
        )}

        {/* ══════════ SCHEME ENCYCLOPEDIA ══════════ */}
        {view === 'schemes' && (
          <div
            className="nl-pad-page"
            style={css('max-width:1440px;margin:0 auto;padding:48px 32px 80px')}
          >
            {!schemeSel && (
              <>
                <div
                  className="q-body-sm-caps"
                  style={css(
                    'color:var(--color-mediumgray);margin-bottom:12px',
                  )}
                >
                  {t.navSchemes}
                </div>
                <h2 className="q-rich-xl-dec" style={css('margin:0 0 8px')}>
                  {t.schemesTitle}
                </h2>
                <p
                  className="q-body-base-default"
                  style={css(
                    'color:var(--color-gray);margin:0 0 24px;max-width:560px',
                  )}
                >
                  {t.schemesSub}
                </p>
                {simpleWordsBox(
                  t.schemesExplain,
                  'padding:18px 22px;margin:0 0 32px;max-width:860px',
                )}
                <div
                  style={css(
                    'display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:1px;background:var(--color-lightgray);border:1px solid var(--color-lightgray)',
                  )}
                >
                  {all.map((s) => {
                    const fb = freshBadge(s.verified);
                    return (
                      <div
                        key={s.id}
                        className="qh-card-paper"
                        {...press(() => setSchemeSel(s.id))}
                        style={css(
                          'background:#FFFFFF;padding:24px;cursor:pointer',
                        )}
                      >
                        <div
                          style={css(
                            'display:flex;justify-content:space-between;gap:12px;align-items:flex-start',
                          )}
                        >
                          <span
                            className="q-body-sm-caps"
                            style={css('color:var(--color-mediumgray)')}
                          >
                            {`${s.level.toUpperCase()} · ${s.dept.toUpperCase()}`}
                          </span>
                          <span
                            className="q-body-sm-caps"
                            style={css(
                              s.status === 'published'
                                ? fb.freshStyle
                                : s.status === 'retired'
                                  ? 'padding:3px 10px;border-radius:9999px;background:var(--color-lightgray);color:var(--color-mediumgray)'
                                  : 'padding:3px 10px;border-radius:9999px;background:var(--color-stone);color:var(--color-umber)',
                            )}
                          >
                            {s.status === 'published'
                              ? fb.fresh
                              : s.status.replaceAll('-', ' ').toUpperCase()}
                          </span>
                        </div>
                        <div
                          className="q-title-md-dec"
                          style={css('margin:14px 0 4px')}
                        >
                          {s.name}
                        </div>
                        <div
                          className="q-body-sm-default"
                          style={css('color:var(--color-silvergray)')}
                        >
                          {s.nameTa}
                        </div>
                        <div
                          className="q-body-sm-default"
                          style={css('color:var(--color-gray);margin-top:10px')}
                        >
                          {s.line}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
            {detail &&
              (() => {
                const fb = freshBadge(detail.verified);
                const dl = detail.deadline ? daysUntil(detail.deadline) : null;
                const examples = [25, 100, 500].map((size) => {
                  if (detail.status !== 'published') {
                    return {
                      size: (L === 'ta' ? 'திட்டம் ' : 'Project ') + fmt(size),
                      amount:
                        detail.status === 'retired'
                          ? 'Retired'
                          : 'Pending verification',
                    };
                  }
                  const scopedInput = createNilamMatcherInput(
                    {
                      ...nilamControlsFromMatcher(canonicalInput),
                      projectCostLakhs: size,
                    },
                    canonicalInput,
                  );
                  const scheme = evaluateNilamTruth(
                    scopedInput,
                    initialRuleset,
                  ).schemes.find(({ schemeId }) => schemeId === detail.id);
                  return {
                    size: (L === 'ta' ? 'திட்டம் ' : 'Project ') + fmt(size),
                    amount:
                      scheme !== undefined
                        ? scheme.totalLakhs > 0
                          ? fmt(scheme.totalLakhs)
                          : 'Access'
                        : L === 'ta'
                          ? 'தகுதியில்லை'
                          : 'Not eligible',
                  };
                });
                const checks = mkChecks(
                  (detail.eligibility ?? []).map((predicate) => ({
                    label: predicate.label,
                    pass: predicate.evaluate(canonicalInput).passed,
                  })),
                );
                return (
                  <>
                    <a
                      className="q-body-sm-caps"
                      {...press(() => setSchemeSel(null))}
                      style={css('cursor:pointer;text-decoration:none')}
                    >
                      ← {t.schemesTitle}
                    </a>
                    <div
                      className="nl-split"
                      style={css(
                        'display:grid;grid-template-columns:1fr minmax(280px,360px);gap:56px;margin-top:24px;align-items:start',
                      )}
                    >
                      <div>
                        <div
                          style={css(
                            'display:flex;gap:10px;align-items:center;flex-wrap:wrap',
                          )}
                        >
                          <span
                            className="q-body-sm-caps"
                            style={css('color:var(--color-mediumgray)')}
                          >
                            {detail.level.toUpperCase()}
                          </span>
                          <span
                            className="q-body-sm-caps"
                            style={css(fb.freshStyle)}
                          >
                            {detail.status === 'published'
                              ? fb.fresh
                              : `${detail.status.replaceAll('-', ' ')} · excluded from totals`}
                          </span>
                          {dl !== null && detail.deadline !== null && (
                            <span
                              className="q-body-sm-caps"
                              style={css('color:var(--color-red-100)')}
                            >
                              {formatSunset(detail.deadline, dl)}
                            </span>
                          )}
                        </div>
                        <h2
                          className="q-rich-xl-dec"
                          style={css('margin:14px 0 2px')}
                        >
                          {detail.name}
                        </h2>
                        <div
                          className="q-body-base-default"
                          style={css('color:var(--color-silvergray)')}
                        >
                          {detail.nameTa} · {detail.dept}
                        </div>
                        {simpleWordsBox(
                          detail.line,
                          'padding:16px 20px;margin:16px 0 0;max-width:600px',
                        )}
                        <p
                          className="q-body-lg-default"
                          style={css(
                            'color:var(--color-gray);max-width:600px;text-wrap:pretty',
                          )}
                        >
                          {detail.summary}
                        </p>
                        <div
                          className="q-body-sm-caps"
                          style={css(
                            'color:var(--color-mediumgray);margin:32px 0 12px',
                          )}
                        >
                          {t.whatYouGet}
                        </div>
                        <div
                          className="nl-stack-hairline"
                          style={css(
                            'display:grid;grid-template-columns:repeat(3,1fr);gap:1px;background:var(--color-lightgray);border:1px solid var(--color-lightgray)',
                          )}
                        >
                          {examples.map((ex) => (
                            <div
                              key={ex.size}
                              style={css(
                                'background:var(--color-paperwhite);padding:20px',
                              )}
                            >
                              <div
                                className="q-body-sm-caps"
                                style={css('color:var(--color-mediumgray)')}
                              >
                                {ex.size}
                              </div>
                              <div
                                className="q-title-lg-dec"
                                style={css('margin-top:8px')}
                              >
                                {ex.amount}
                              </div>
                            </div>
                          ))}
                        </div>
                        <div
                          className="q-body-sm-default"
                          style={css(
                            'color:var(--color-silvergray);margin-top:8px',
                          )}
                        >
                          {t.exampleNote}
                        </div>
                        <div
                          className="q-body-sm-caps"
                          style={css(
                            'color:var(--color-mediumgray);margin:32px 0 12px',
                          )}
                        >
                          {t.howToApply}
                        </div>
                        {detail.steps.map((text, index) => (
                          <div
                            key={text}
                            style={css(
                              'display:flex;gap:14px;padding:12px 0;border-bottom:1px solid var(--color-lightgray)',
                            )}
                          >
                            <span
                              className="q-title-sm-dec"
                              style={css(
                                'color:var(--color-silvergray);min-width:24px',
                              )}
                            >
                              {index + 1}
                            </span>
                            <span className="q-body-base-default">{text}</span>
                          </div>
                        ))}
                        <div
                          className="q-body-sm-caps"
                          style={css(
                            'color:var(--color-mediumgray);margin:32px 0 12px',
                          )}
                        >
                          {t.goHistory}
                        </div>
                        {detail.history.map((h) => (
                          <div
                            key={`${h.go}-${h.date}`}
                            style={css(
                              'display:flex;gap:20px;padding:10px 0;border-bottom:1px solid var(--color-lightgray)',
                            )}
                          >
                            <span
                              className="q-body-sm-default"
                              style={css(
                                'color:var(--color-silvergray);min-width:90px',
                              )}
                            >
                              {h.date}
                            </span>
                            <div>
                              <div className="q-body-sm-bold">{h.go}</div>
                              <div
                                className="q-body-sm-default"
                                style={css('color:var(--color-gray)')}
                              >
                                {h.note}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div
                        className="nl-first"
                        style={css(
                          'background:var(--color-paperwhite);padding:28px;display:flex;flex-direction:column;gap:20px',
                        )}
                      >
                        <div
                          className="q-body-sm-caps"
                          style={css('color:var(--color-mediumgray)')}
                        >
                          {t.doYouQualify}
                        </div>
                        {checks.map((c) => (
                          <div
                            key={c.label}
                            style={css(
                              'display:flex;gap:10px;align-items:center',
                            )}
                          >
                            <span
                              className="q-body-sm-bold"
                              style={css(c.markStyle)}
                            >
                              {c.mark}
                            </span>
                            <span
                              className="q-body-sm-default"
                              style={css(c.textStyle)}
                            >
                              {c.label}
                            </span>
                          </div>
                        ))}
                        <div
                          className="q-body-sm-default"
                          style={css('color:var(--color-silvergray)')}
                        >
                          {t.checkerNote}
                        </div>
                        <button
                          type="button"
                          onClick={() => setView('matcher')}
                          className="q-body-sm-caps qh-primary"
                          style={css(
                            'height:44px;border-radius:9999px;border:none;background:var(--action);color:var(--on-action);cursor:pointer',
                          )}
                        >
                          {t.editInMatcher}
                        </button>
                        <div
                          style={css(
                            'border-top:1px solid var(--color-lightgray);padding-top:16px',
                          )}
                        >
                          <div
                            className="q-body-sm-caps"
                            style={css(
                              'color:var(--color-mediumgray);margin-bottom:8px',
                            )}
                          >
                            {t.conflictsWith}
                          </div>
                          <div
                            className="q-body-sm-default"
                            style={css('color:var(--color-gray)')}
                          >
                            {detail.conflictLine}
                          </div>
                        </div>
                        <div
                          className="q-body-sm-default"
                          style={css('color:var(--color-silvergray)')}
                        >
                          {detail.citation} · verified {detail.verified}
                        </div>
                      </div>
                    </div>
                  </>
                );
              })()}
          </div>
        )}

        {/* ══════════ PLAYBOOKS ══════════ */}
        {view === 'playbooks' && (
          <div
            className="nl-pad-page"
            style={css('max-width:1440px;margin:0 auto;padding:48px 32px 80px')}
          >
            <div
              className="q-body-sm-caps"
              style={css('color:var(--color-mediumgray);margin-bottom:12px')}
            >
              {t.navPlaybooks}
            </div>
            <h2 className="q-rich-xl-dec" style={css('margin:0 0 8px')}>
              {t.pbTitle}
            </h2>
            <p
              className="q-body-base-default"
              style={css(
                'color:var(--color-gray);margin:0 0 24px;max-width:560px',
              )}
            >
              {t.pbSub}
            </p>
            {simpleWordsBox(
              t.pbExplain,
              'padding:18px 22px;margin:0 0 32px;max-width:860px',
            )}
            <div
              style={css(
                'display:flex;gap:8px;flex-wrap:wrap;margin-bottom:36px',
              )}
            >
              {(Object.keys(PLAYBOOKS) as PbId[]).map((id) => (
                <span
                  key={id}
                  className="q-body-sm-caps qh-chip"
                  {...press(() => setPbSelId(id))}
                  style={css(pbSelId === id ? CHIP_ON : CHIP_OFF)}
                >
                  {PLAYBOOKS[id].title.split(' — ')[0]}
                </span>
              ))}
            </div>
            <div style={css('max-width:860px')}>
              <div
                style={css(
                  'display:flex;justify-content:space-between;align-items:baseline;border-bottom:1px solid var(--color-darkgray);padding-bottom:12px',
                )}
              >
                <span className="q-title-lg-dec">{pb.title}</span>
                <span
                  className="q-body-sm-caps"
                  style={css('color:var(--color-mediumgray)')}
                >
                  {`${doneCount} / ${pb.steps.length}${L === 'ta' ? ' முடிந்தது' : ' done'}`}
                </span>
              </div>
              {pb.steps.map((ps, index) => {
                const done = Boolean(doneMap[index]);
                return (
                  <div
                    key={ps.title}
                    style={css(
                      'display:flex;gap:18px;padding:20px 0;border-bottom:1px solid var(--color-lightgray)',
                    )}
                  >
                    <div
                      {...press(() => flipStep(index))}
                      aria-pressed={done}
                      aria-label={ps.title}
                      style={css(
                        `width:26px;height:26px;flex:none;border-radius:4px;display:flex;align-items:center;justify-content:center;cursor:pointer;border:1px solid ${
                          done
                            ? 'var(--color-green-100)'
                            : 'var(--color-lightgray)'
                        };background:${done ? 'var(--color-green-100)' : '#fff'}`,
                      )}
                    >
                      <span
                        className="q-body-sm-bold"
                        style={css('color:#fff')}
                      >
                        {done ? '✓' : ''}
                      </span>
                    </div>
                    <div style={css('flex:1')}>
                      <div
                        style={css(
                          'display:flex;justify-content:space-between;gap:16px',
                        )}
                      >
                        <span
                          className="q-body-base-bold"
                          style={css(
                            done
                              ? 'color:var(--color-silvergray);text-decoration:line-through'
                              : '',
                          )}
                        >
                          {ps.title}
                        </span>
                        <span
                          className="q-body-sm-caps"
                          style={css(
                            'color:var(--color-mediumgray);white-space:nowrap',
                          )}
                        >
                          {ps.time}
                        </span>
                      </div>
                      <div
                        className="q-body-sm-default"
                        style={css('color:var(--color-gray);margin-top:4px')}
                      >
                        {ps.org} · {ps.docs}
                      </div>
                      {ps.warn && (
                        <div
                          className="q-body-sm-default"
                          style={css('color:var(--color-umber);margin-top:6px')}
                        >
                          ⚠ {ps.warn}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              <div
                className="q-body-sm-default"
                style={css('color:var(--color-silvergray);margin-top:16px')}
              >
                {t.pbLocalNote}
              </div>
            </div>
          </div>
        )}

        {/* ══════════ SAVED / ALERTS ══════════ */}
        {view === 'saved' && (
          <div
            className="nl-pad-page"
            style={css('max-width:1440px;margin:0 auto;padding:48px 32px 80px')}
          >
            <div
              className="q-body-sm-caps"
              style={css('color:var(--color-mediumgray);margin-bottom:12px')}
            >
              {t.navSaved}
            </div>
            <h2 className="q-rich-xl-dec" style={css('margin:0 0 8px')}>
              {t.savedTitle}
            </h2>
            <p
              className="q-body-base-default"
              style={css(
                'color:var(--color-gray);margin:0 0 24px;max-width:560px',
              )}
            >
              {t.savedSub}
            </p>
            {simpleWordsBox(
              t.savedExplain,
              'padding:18px 22px;margin:0 0 32px;max-width:860px',
            )}
            <div
              className="nl-split"
              style={css(
                'display:grid;grid-template-columns:1fr minmax(300px,400px);gap:56px;align-items:start',
              )}
            >
              <div style={css('display:flex;flex-direction:column;gap:16px')}>
                {savedStacks.map((sv) => (
                  <div
                    key={sv.title}
                    style={css(
                      'border:1px solid var(--color-lightgray);padding:24px',
                    )}
                  >
                    <div
                      style={css(
                        'display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap',
                      )}
                    >
                      <div>
                        <div className="q-body-base-bold">{sv.title}</div>
                        <div
                          className="q-body-sm-default"
                          style={css('color:var(--color-gray);margin-top:4px')}
                        >
                          {sv.inputs}
                        </div>
                      </div>
                      <div style={css('text-align:right')}>
                        <div className="q-title-lg-dec">{sv.total}</div>
                        <div
                          className="q-body-sm-default"
                          style={css('color:var(--color-silvergray)')}
                        >
                          {sv.version}
                        </div>
                      </div>
                    </div>
                    {sv.delta && (
                      <div
                        style={css(
                          'margin-top:14px;background:var(--color-green-10);padding:10px 14px',
                        )}
                        className="q-body-sm-default"
                      >
                        <span
                          className="q-body-sm-bold"
                          style={css('color:var(--color-green-100)')}
                        >
                          {sv.deltaBadge}
                        </span>{' '}
                        {sv.delta}
                      </div>
                    )}
                  </div>
                ))}
                <div
                  className="q-body-sm-caps"
                  style={css(
                    'color:var(--color-mediumgray);margin-top:24px;border-bottom:1px solid var(--color-darkgray);padding-bottom:10px',
                  )}
                >
                  {t.alerts}
                </div>
                {alerts.map((al) => (
                  <div
                    key={al.badge}
                    style={css(
                      'display:flex;gap:16px;padding:14px 0;border-bottom:1px solid var(--color-lightgray)',
                    )}
                  >
                    <span className="q-body-sm-caps" style={css(al.badgeStyle)}>
                      {al.badge}
                    </span>
                    <div style={css('flex:1')}>
                      <div className="q-body-sm-default">{al.text}</div>
                      <div
                        className="q-body-sm-default"
                        style={css(
                          'color:var(--color-silvergray);margin-top:2px',
                        )}
                      >
                        {al.date}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div
                style={css('background:var(--color-paperwhite);padding:28px')}
              >
                <div
                  className="q-body-sm-caps"
                  style={css('color:var(--color-mediumgray)')}
                >
                  {t.tgTitle}
                </div>
                <div
                  className="q-title-md-dec"
                  style={css('margin:12px 0 8px')}
                >
                  Telegram delivery
                </div>
                <div
                  className="q-body-sm-default"
                  style={css('color:var(--color-gray);text-wrap:pretty')}
                >
                  {t.tgText}
                </div>
                <button
                  type="button"
                  disabled
                  aria-disabled="true"
                  className="q-body-sm-caps qh-primary"
                  style={css(
                    'margin-top:20px;height:44px;padding:0 28px;border-radius:9999px;border:none;background:var(--color-lightgray);color:var(--color-mediumgray);cursor:not-allowed',
                  )}
                >
                  {t.tgCta}
                </button>
                <div
                  className="q-body-sm-default"
                  style={css('color:var(--color-silvergray);margin-top:16px')}
                >
                  {t.tgNote}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ══════════ CHANGELOG ══════════ */}
        {view === 'changelog' && (
          <div
            className="nl-pad-page"
            style={css('max-width:1440px;margin:0 auto;padding:48px 32px 80px')}
          >
            <div
              className="q-body-sm-caps"
              style={css('color:var(--color-mediumgray);margin-bottom:12px')}
            >
              {t.navChangelog}
            </div>
            <h2 className="q-rich-xl-dec" style={css('margin:0 0 8px')}>
              {t.clTitle}
            </h2>
            <p
              className="q-body-base-default"
              style={css(
                'color:var(--color-gray);margin:0 0 24px;max-width:560px',
              )}
            >
              {t.clSub}
            </p>
            {simpleWordsBox(
              t.clExplain,
              'padding:18px 22px;margin:0 0 32px;max-width:860px',
            )}
            <div
              className="nl-stack-hairline"
              style={css(
                'display:grid;grid-template-columns:repeat(3,1fr);gap:1px;background:var(--color-lightgray);border:1px solid var(--color-lightgray);max-width:860px;margin-bottom:48px',
              )}
            >
              {clStats.map((cs) => (
                <div
                  key={cs.label}
                  style={css('background:var(--color-paperwhite);padding:24px')}
                >
                  <div className="q-title-xl-dec">{cs.val}</div>
                  <div
                    className="q-body-sm-caps"
                    style={css('color:var(--color-mediumgray);margin-top:6px')}
                  >
                    {cs.label}
                  </div>
                </div>
              ))}
            </div>
            <div
              style={css(
                'max-width:860px;border-top:1px solid var(--color-darkgray)',
              )}
            >
              {clEntries.map((ce) => (
                <div
                  className="nl-log-row"
                  key={ce.entity}
                  style={css(
                    'display:grid;grid-template-columns:110px 110px 1fr;gap:24px;padding:18px 0;border-bottom:1px solid var(--color-lightgray)',
                  )}
                >
                  <span
                    className="q-body-sm-default"
                    style={css('color:var(--color-silvergray)')}
                  >
                    {ce.date}
                  </span>
                  <span
                    className="q-body-sm-caps"
                    style={css(kindStyles[ce.kind] ?? '')}
                  >
                    {ce.kind}
                  </span>
                  <div>
                    <div className="q-body-sm-bold">{ce.entity}</div>
                    <div
                      className="q-body-sm-default"
                      style={css('color:var(--color-gray);margin-top:2px')}
                    >
                      {ce.note}
                    </div>
                    <div
                      className="q-body-sm-default"
                      style={css(
                        'color:var(--color-silvergray);margin-top:2px',
                      )}
                    >
                      {ce.actor}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* ══ Footer ══ */}
      {/* The Land Explorer is a fixed-viewport dashboard: a footer below it
          would reintroduce page scroll, which is the thing it is avoiding. */}
      {view !== 'land' && (
        <footer
          style={css(
            'border-top:1px solid var(--color-lightgray);background:var(--color-paperwhite)',
          )}
        >
          <div
            style={css(
              'max-width:1440px;margin:0 auto;padding:40px 32px;display:flex;justify-content:space-between;gap:32px;flex-wrap:wrap',
            )}
          >
            <div>
              <span className="q-title-md-dec">NILAM</span>
              <span
                className="q-body-sm-default"
                style={css('color:var(--color-silvergray);margin-left:8px')}
              >
                நிலம்
              </span>
              <div
                className="q-body-sm-default"
                style={css(
                  'color:var(--color-gray);margin-top:8px;max-width:480px;text-wrap:pretty',
                )}
              >
                {t.footerDisclaimer}
              </div>
            </div>
            <div
              className="q-body-sm-caps"
              style={css(
                'color:var(--color-mediumgray);display:flex;gap:24px;align-items:flex-start',
              )}
            >
              <span
                {...press(() => location.assign('/changelog'))}
                style={css('cursor:pointer')}
              >
                {t.navChangelog}
              </span>
              <span
                {...press(() => goto('schemes'))}
                style={css('cursor:pointer')}
              >
                {t.navSchemes}
              </span>
              <span>TAMIL NADU · {truth.result.rulesetVersion}</span>
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}
