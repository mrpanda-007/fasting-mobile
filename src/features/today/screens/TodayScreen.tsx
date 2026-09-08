import { useEffect, useRef, useState, type PropsWithChildren } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Animated, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors } from '../../../shared/theme/colors';
import { motion } from '../../../shared/theme/motion';

type TodayState = 'idle' | 'fasting' | 'refeeding' | 'transition' | 'complete' | 'rollingBuilder' | 'customBuilder';
type FastPlan = { detail: string; name: string };
type AppTab = 'today' | 'together' | 'history';
type PairFlow = 'none' | 'creatorSignIn' | 'creatorInvite' | 'recipientInvite' | 'recipientPlan' | 'paired';
type Partner = { name: string; role: 'creator' | 'recipient' };
type Sheet = 'reaction' | 'planDetails' | 'endFast' | null;
type HistoryView = 'list' | 'plan' | 'fast';

const partnerStorageKey = '@fasting/partner';

const plans: FastPlan[] = [
  { name: '16:8', detail: '16h Fast · 8h eating window' },
  { name: '18:6', detail: '18h Fast · 6h eating window' },
  { name: 'OMAD', detail: '23h Fast · 1h Refeed' },
  { name: '24h Fast', detail: 'one fast, no repeat' },
  { name: 'Rolling', detail: 'fast + refeed, repeated' },
  { name: 'Custom', detail: 'set your own durations' },
];

/** The first production flow: wireframe 3b, states T1 through T5. */
export function TodayScreen() {
  const [state, setState] = useState<TodayState>('idle');
  const [tab, setTab] = useState<AppTab>('today');
  const [pairFlow, setPairFlow] = useState<PairFlow>('none');
  const [partner, setPartner] = useState<Partner | null>(null);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [reactionToast, setReactionToast] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [historyView, setHistoryView] = useState<HistoryView>('list');
  const [darkMode, setDarkMode] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState('24h Fast');
  const returnToIdle = (plan = '24h Fast') => { setSelectedPlan(plan); setState('idle'); };
  const choosePlan = (plan: string) => {
    if (plan === 'Rolling') return setState('rollingBuilder');
    if (plan === 'Custom') return setState('customBuilder');
    setSelectedPlan(plan);
  };
  const isBuilder = state === 'rollingBuilder' || state === 'customBuilder';
  const savePartner = (next: Partner) => {
    setPartner(next);
    setPairFlow('paired');
    void AsyncStorage.setItem(partnerStorageKey, JSON.stringify(next));
  };

  useEffect(() => {
    void AsyncStorage.getItem(partnerStorageKey).then((saved) => {
      if (saved) { setPartner(JSON.parse(saved) as Partner); setPairFlow('paired'); }
    });
  }, []);

  return (
    <SafeAreaView edges={['top', 'bottom']} style={[styles.safeArea, state === 'refeeding' || state === 'transition' ? styles.refeedCanvas : undefined]}>
      <View style={styles.screen}>
        {!isBuilder && <AppHeader onOpenSettings={() => setSettingsOpen(true)} />}
        {tab === 'today' && state === 'idle' && <IdleState selectedPlan={selectedPlan} onPlanSelect={choosePlan} onStart={() => setState('fasting')} onTogether={() => setTab('together')} partner={partner?.name} />}
        {tab === 'today' && state === 'fasting' && <FastingState onOpenEnd={() => setSheet('endFast')} onOpenPlan={() => setSheet('planDetails')} onOpenReaction={() => setSheet('reaction')} partner={partner?.name} />}
        {tab === 'today' && state === 'refeeding' && <RefeedingState onEndPlan={() => setState('complete')} onOpenPlan={() => setSheet('planDetails')} onOpenReaction={() => setSheet('reaction')} onStartNext={() => setState('fasting')} onTimerComplete={() => setState('transition')} partner={partner?.name} />}
        {tab === 'today' && state === 'transition' && <TransitionState onEndPlan={() => setState('complete')} onOpenPlan={() => setSheet('planDetails')} onStartNext={() => setState('fasting')} partner={partner?.name} />}
        {tab === 'today' && state === 'complete' && <CompleteState onDone={() => returnToIdle()} onRepeat={() => returnToIdle('Rolling')} />}
        {state === 'rollingBuilder' && <PlanBuilder variant="rolling" onClose={() => setState('idle')} onStart={() => setState('fasting')} />}
        {state === 'customBuilder' && <PlanBuilder variant="custom" onClose={() => setState('idle')} onStart={() => setState('fasting')} />}
        {tab === 'together' && <TogetherScreen flow={pairFlow} onBackToToday={() => setTab('today')} onFlowChange={setPairFlow} onOpenReaction={() => setSheet('reaction')} onPair={savePartner} onStartOwnFast={() => { setState('fasting'); setTab('today'); }} partner={partner} />}
        {tab === 'history' && <HistoryScreen view={historyView} onBack={() => setHistoryView('list')} onOpenFast={() => setHistoryView('fast')} onOpenPlan={() => setHistoryView('plan')} />}
        {!isBuilder && <BottomTabs activeTab={tab} onSelect={setTab} />}
        <AppSheet kind={sheet} onClose={() => setSheet(null)} onEndStandalone={() => { setSheet(null); returnToIdle(); }} onFinishPlan={() => { setSheet(null); setState('complete'); }} onStartRefeed={() => { setSheet(null); setState('refeeding'); }} onSendReaction={() => { setSheet(null); setReactionToast(true); }} rolling={selectedPlan === 'Rolling'} />
        <ThemePicker darkMode={darkMode} onClose={() => setSettingsOpen(false)} onSelect={(value) => { setDarkMode(value); setSettingsOpen(false); }} visible={settingsOpen} />
        {reactionToast && <ReactionToast onDismiss={() => setReactionToast(false)} />}
      </View>
    </SafeAreaView>
  );
}

function AppHeader({ onOpenSettings }: { onOpenSettings: () => void }) {
  return <View style={styles.header}><Text style={styles.time}>9:41</Text><PressableScale accessibilityLabel="Choose theme" accessibilityRole="button" onPress={onOpenSettings} style={styles.settingsButton}><SettingsIcon /></PressableScale></View>;
}

function SettingsIcon() { return <View style={styles.settingsIcon}><View style={[styles.settingLine, styles.settingLineOne]} /><View style={[styles.settingDot, styles.settingDotOne]} /><View style={[styles.settingLine, styles.settingLineTwo]} /><View style={[styles.settingDot, styles.settingDotTwo]} /><View style={[styles.settingLine, styles.settingLineThree]} /><View style={[styles.settingDot, styles.settingDotThree]} /></View>; }

function IdleState({ onPlanSelect, onStart, onTogether, partner, selectedPlan }: { onPlanSelect: (name: string) => void; onStart: () => void; onTogether: () => void; partner?: string; selectedPlan: string }) {
  const plan = plans.find((item) => item.name === selectedPlan) ?? plans[3];
  return <View style={styles.content}>
    <Text style={styles.question}>How long are you fasting?</Text>
    <View style={styles.planList}>{plans.map((item) => {
      const selected = item.name === selectedPlan;
      return <PressableScale accessibilityLabel={`Choose ${item.name}`} key={item.name} onPress={() => onPlanSelect(item.name)} style={[styles.planRow, selected && styles.selectedPlan]}>
        <View><Text style={styles.planName}>{item.name}</Text><Text style={styles.planDetail}>{item.detail}</Text></View>
        <Text style={[styles.rowAdornment, selected && styles.selectedAdornment]}>{selected ? '✓' : '›'}</Text>
      </PressableScale>;
    })}</View>
    <Text style={styles.starting}>Starting: {plan.name} · {plan.detail}</Text>
    <PrimaryButton label="Start Fast" onPress={onStart} />
    <PressableScale accessibilityRole="button" onPress={onTogether}><Text style={styles.quietAction}>{partner ? `Paired with ${partner}` : 'Fast with someone'}</Text></PressableScale>
  </View>;
}

function FastingState({ onOpenEnd, onOpenPlan, onOpenReaction, partner }: { onOpenEnd: () => void; onOpenPlan: () => void; onOpenReaction: () => void; partner?: string }) {
  return <View style={styles.content}>
    <StateLabel colour={colors.accent}>FASTING</StateLabel><Timer primary="18:42" secondary=":13" />
    <Text style={styles.summary}>18h 42m of 24h · 5h 17m left</Text><ProgressBar colour={colors.accent} value="78%" />
    <PlanDetail onPress={onOpenPlan} text="Rolling 48:4 · Cycle 2 of 5" />{partner && <PartnerCard name={partner} status="Fasting" detail="17h 58m of 24h" statusColour={colors.accent} />}
    <SecondaryButton label="🙂  Send reaction" onPress={onOpenReaction} /><DangerButton label="End fast" onPress={onOpenEnd} />
  </View>;
}

function RefeedingState({ onEndPlan, onOpenPlan, onOpenReaction, onStartNext, onTimerComplete, partner }: { onEndPlan: () => void; onOpenPlan: () => void; onOpenReaction: () => void; onStartNext: () => void; onTimerComplete: () => void; partner?: string }) {
  return <View style={styles.content}>
    <StateLabel colour={colors.success}>REFEEDING</StateLabel>
    <PressableScale accessibilityLabel="Preview refeed completed" onPress={onTimerComplete} style={styles.timerTapTarget}><Timer primary="01:14" secondary=":22" /></PressableScale>
    <Text style={styles.summary}>1h 14m of 4h · 2h 45m left</Text><ProgressBar colour={colors.success} value="30%" />
    <PlanDetail onPress={onOpenPlan} text="Rolling 48:4 · Cycle 2 of 5" />{partner && <PartnerCard name={partner} status="Fasting" detail="36m left" statusColour={colors.accent} />}
    <PrimaryButton label="Start next fast now" onPress={onStartNext} /><SecondaryButton label="🙂  Send reaction" onPress={onOpenReaction} /><DangerButton label="End plan" onPress={onEndPlan} />
  </View>;
}

function TransitionState({ onEndPlan, onOpenPlan, onStartNext, partner }: { onEndPlan: () => void; onOpenPlan: () => void; onStartNext: () => void; partner?: string }) {
  return <View style={styles.content}>
    <StateLabel colour={colors.success}>REFEED COMPLETE</StateLabel><Text style={styles.question}>Ready for your next fast</Text>
    <Text style={styles.summary}>4h Refeed finished 6:12 PM · Cycle 2 of 5 complete</Text><ProgressBar colour={colors.success} value="100%" />
    <PlanDetail onPress={onOpenPlan} text="Next: 48h Fast · Cycle 3 of 5" />{partner && <PartnerCard name={partner} status="Refeeding" detail="2h 10m of 4h" statusColour={colors.success} />}
    <PrimaryButton label="Start next fast" onPress={onStartNext} /><DangerButton label="End plan" onPress={onEndPlan} />
    <Text style={styles.starting}>Auto-start is off, so nothing counts until you tap Start.</Text>
  </View>;
}

function CompleteState({ onDone, onRepeat }: { onDone: () => void; onRepeat: () => void }) {
  return <View style={styles.content}>
    <StateLabel colour={colors.ink}>PLAN COMPLETE</StateLabel><Text style={styles.question}>Rolling 48:4</Text><Text style={styles.summary}>5 of 5 cycles</Text>
    <View style={styles.stats}><Stat label="Fasting" value="240h 12m" /><Stat label="Refeeding" value="20h 05m" /><Stat label="Dates" value="Aug 23 – Sep 1" /><Stat label="Partner" value="Sam · paired throughout" /></View>
    <PrimaryButton label="Done" onPress={onDone} /><SecondaryButton label="Do it again" onPress={onRepeat} />
    <Text style={styles.starting}>Do it again loads the protocol on Today. It does not start it.</Text>
  </View>;
}

function PlanBuilder({ onClose, onStart, variant }: { onClose: () => void; onStart: () => void; variant: 'rolling' | 'custom' }) {
  const rolling = variant === 'rolling';
  const [fast, setFast] = useState(rolling ? '48h' : '36h');
  const [refeed, setRefeed] = useState(rolling ? '4h' : 'None');
  const [repeat, setRepeat] = useState(rolling ? '5' : 'No');
  const summary = rolling
    ? `${fast} Fast → ${refeed} Refeed`
    : refeed === 'None' ? `${fast} Fast` : `${fast} Fast → ${refeed} Refeed`;
  const subcopy = rolling
    ? `Repeat ${repeat === 'Forever' ? 'forever' : `${repeat} times`} · ${repeat === '5' ? '10 days' : 'your pace'}`
    : repeat === 'No' ? `single fast${refeed === 'None' ? ', no refeed' : ` · ${refeed} refeed`}` : `Repeat ${repeat} times`;

  return <View style={styles.builder}>
    <View style={styles.builderHeader}>
      <PressableScale accessibilityRole="button" onPress={onClose}><Text style={styles.closeText}>✕  Close</Text></PressableScale>
      <Text style={styles.builderTitle}>{rolling ? 'Rolling plan' : 'Custom fast'}</Text>
    </View>
    <ChoiceGroup label={rolling ? 'Fast' : 'Fast for'} values={rolling ? ['24h', '36h', '48h', '···'] : ['20h', '24h', '36h', '···']} selected={fast} onSelect={setFast} />
    <ChoiceGroup label={rolling ? 'Refeed' : 'Then refeed'} values={rolling ? ['1h', '4h', '8h', '···'] : ['None', '1h', '4h', '···']} selected={refeed} onSelect={setRefeed} />
    <ChoiceGroup label="Repeat" values={rolling ? ['2', '3', '5', 'Forever'] : ['No', '2', '3', 'Forever']} selected={repeat} onSelect={setRepeat} />
    <View style={styles.protocolCard}><Text style={styles.protocol}>{summary}</Text><Text style={styles.protocolDetail}>{subcopy}</Text></View>
    <PrimaryButton label={rolling ? 'Start Plan' : 'Start Fast'} onPress={onStart} />
    {rolling && <SecondaryButton label="Connect a partner first" />}
    <Text style={styles.builderNote}>{rolling ? 'One cycle = one fast + its refeed. The plan completes after the final refeed.' : 'A single fast is one History entry. A rolling plan is one plan entry with cycles inside it.'}</Text>
  </View>;
}

function AppSheet({ kind, onClose, onEndStandalone, onFinishPlan, onSendReaction, onStartRefeed, rolling }: { kind: Sheet; onClose: () => void; onEndStandalone: () => void; onFinishPlan: () => void; onSendReaction: () => void; onStartRefeed: () => void; rolling: boolean }) {
  if (!kind) return null;
  return <Modal animationType="fade" onRequestClose={onClose} transparent visible>
    <View style={styles.modalOverlay}>
      <Pressable accessibilityLabel="Close sheet" onPress={onClose} style={styles.scrim} />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        {kind === 'reaction' && <ReactionSheet onSend={onSendReaction} />}
        {kind === 'planDetails' && <PlanDetailsSheet />}
        {kind === 'endFast' && <EndFastSheet onClose={onClose} onEndStandalone={onEndStandalone} onFinishPlan={onFinishPlan} onStartRefeed={onStartRefeed} rolling={rolling} />}
      </View>
    </View>
  </Modal>;
}

function ThemePicker({ darkMode, onClose, onSelect, visible }: { darkMode: boolean; onClose: () => void; onSelect: (dark: boolean) => void; visible: boolean }) {
  return <Modal animationType="fade" onRequestClose={onClose} transparent visible={visible}><View style={styles.themeOverlay}><Pressable accessibilityLabel="Close theme picker" onPress={onClose} style={styles.scrim} /><View style={styles.themePicker}><Text style={styles.themeTitle}>Appearance</Text><Text style={styles.themeCopy}>Choose a theme for the app.</Text><PressableScale accessibilityRole="button" onPress={() => onSelect(false)} style={[styles.themeOption, !darkMode && styles.themeOptionSelected]}><Text style={styles.planName}>Light</Text>{!darkMode && <Text style={styles.selectedAdornment}>✓</Text>}</PressableScale><PressableScale accessibilityRole="button" onPress={() => onSelect(true)} style={[styles.themeOption, darkMode && styles.themeOptionSelected]}><Text style={styles.planName}>Dark</Text>{darkMode && <Text style={styles.selectedAdornment}>✓</Text>}</PressableScale></View></View></Modal>;
}

function ReactionSheet({ onSend }: { onSend: () => void }) {
  const [reaction, setReaction] = useState('🔥');
  return <View style={styles.sheetContent}><Text style={styles.sheetTitle}>Send Sam a reaction</Text><Text style={styles.summary}>A small nudge. It never changes their timer.</Text><View style={styles.reactions}>{['🔥', '👏', '💪', '❤️'].map((item) => <PressableScale key={item} onPress={() => setReaction(item)} style={[styles.reaction, reaction === item && styles.selectedReaction]}><Text style={styles.reactionText}>{item}</Text></PressableScale>)}</View><PrimaryButton label={`Send ${reaction}`} onPress={onSend} /></View>;
}

function PlanDetailsSheet() {
  return <View style={styles.sheetContent}><Text style={styles.sheetTitle}>Plan details</Text><View style={styles.stats}><Stat label="Protocol" value="48h Fast → 4h Refeed" /><Stat label="Cycle" value="2 of 5" /><Stat label="Auto-start" value="Off" /><Stat label="Next" value="Refeed at 48h" /></View><Text style={styles.builderNote}>One cycle includes one fast and its refeed. Your plan completes after the final refeed.</Text></View>;
}

function EndFastSheet({ onClose, onEndStandalone, onFinishPlan, onStartRefeed, rolling }: { onClose: () => void; onEndStandalone: () => void; onFinishPlan: () => void; onStartRefeed: () => void; rolling: boolean }) {
  return <View style={styles.sheetContent}><Text style={styles.sheetTitle}>End your fast?</Text><Text style={styles.summary}>You fasted for 18h 42m.</Text>{rolling ? <><View style={styles.rolloverNotice}><Text style={styles.protocol}>Part of a rolling plan</Text><Text style={styles.protocolDetail}>Start your 4h refeed now, or finish this plan early.</Text></View><PrimaryButton label="Start Refeed" onPress={onStartRefeed} /><SecondaryButton label="Finish Plan" onPress={onFinishPlan} /></> : <><Text style={styles.builderNote}>This saves the fast as a standalone History entry.</Text><PrimaryButton label="Finish Fast" onPress={onEndStandalone} /></>}<PressableScale accessibilityRole="button" onPress={onClose}><Text style={styles.quietAction}>Continue fasting</Text></PressableScale></View>;
}

function ReactionToast({ onDismiss }: { onDismiss: () => void }) { return <PressableScale accessibilityRole="button" onPress={onDismiss} style={styles.toast}><Text style={styles.toastText}>Reaction sent to Sam 🔥</Text></PressableScale>; }

function ChoiceGroup({ label, onSelect, selected, values }: { label: string; onSelect: (value: string) => void; selected: string; values: string[] }) {
  return <View style={styles.choiceGroup}>
    <Text style={styles.choiceLabel}>{label}</Text>
    <View style={styles.choices}>{values.map((value) => <PressableScale accessibilityLabel={`Choose ${value}`} key={value} onPress={() => onSelect(value)} style={[styles.choice, value === selected && styles.selectedChoice]}><Text style={[styles.choiceText, value === selected && styles.selectedChoiceText]}>{value}</Text></PressableScale>)}</View>
  </View>;
}

function TogetherScreen({ flow, onBackToToday, onFlowChange, onOpenReaction, onPair, onStartOwnFast, partner }: { flow: PairFlow; onBackToToday: () => void; onFlowChange: (flow: PairFlow) => void; onOpenReaction: () => void; onPair: (partner: Partner) => void; onStartOwnFast: () => void; partner: Partner | null }) {
  if (flow === 'creatorSignIn') return <PairPage back={() => onFlowChange('none')} title="Sign in to pair" detail="An account lets one partner find you. Solo fasting never needs one." icon><SecondaryButton label="Continue with Google" onPress={() => onFlowChange('creatorInvite')} /><SecondaryButton label="Continue with Apple" onPress={() => onFlowChange('creatorInvite')} /><Text style={styles.builderNote}>We store your name and photo so your partner knows who joined. No health data leaves the phone.</Text><Text style={styles.quietAction}>Fast alone instead</Text></PairPage>;
  if (flow === 'creatorInvite') return <PairPage back={() => onFlowChange('none')} title="Invite your partner"><View style={styles.inviteCode}><Text style={styles.choiceLabel}>Invite code</Text><Text style={styles.code}>K7F9Q</Text></View><PrimaryButton label="Share invite" onPress={() => onFlowChange('recipientInvite')} /><Text style={styles.builderNote}>Expires in 24h. One person only.</Text><Text style={styles.dividerNote}>Your fast does not wait for them — start whenever you like and they can join the pair later.</Text><SecondaryButton label="Start my fast now" onPress={onStartOwnFast} /></PairPage>;
  if (flow === 'recipientInvite') return <PairPage eyebrow="Invite from Alex" title="Alex wants to fast with you" detail=""><View style={styles.protocolCard}><Text style={styles.protocol}>Suggested protocol</Text><Text style={styles.protocolDetail}>48h Fast → 4h Refeed · Repeat 5 times</Text></View><PrimaryButton label="Join pair" onPress={() => onFlowChange('recipientPlan')} /><Text style={styles.builderNote}>Joining pairs you two. It does not start any timer.</Text><Text style={styles.quietAction}>Not now</Text></PairPage>;
  if (flow === 'recipientPlan') return <View style={styles.content}><Text style={styles.question}>Your plan</Text><Text style={styles.summary}>Alex's protocol is only a suggestion. Pick what you'll actually do.</Text><PressableScale onPress={() => {}} style={styles.selectedProtocol}><Text style={styles.protocol}>Use this plan</Text><Text style={styles.protocolDetail}>48h Fast → 4h Refeed · Repeat 5</Text></PressableScale><PressableScale onPress={onBackToToday} style={styles.ownProtocol}><Text style={styles.protocol}>Choose my own</Text><Text style={styles.protocolDetail}>presets, rolling or custom</Text></PressableScale><PrimaryButton label="Start Fast" onPress={() => { onPair({ name: 'Alex', role: 'recipient' }); onStartOwnFast(); }} /><Text style={styles.builderNote}>Nothing runs until you tap Start.</Text></View>;
  if (flow === 'paired' && partner) return <View style={styles.content}><PartnerCard name={partner.name} status="Inactive" detail="no fast running" statusColour={colors.subtle} /><View style={styles.pairedNotice}><Text style={styles.protocol}>{partner.name} joined your pair</Text><Text style={styles.protocolDetail}>You each start your own timer.</Text></View><View style={styles.stats}><Stat label="Your plan" value="48h Fast → 4h Refeed" /><Stat label={`${partner.name}'s plan`} value="not started yet" /><Stat label="Pair since" value="Sep 2026" /></View><SecondaryButton label="🙂  Send reaction" onPress={onOpenReaction} /><Text style={styles.builderNote}>Your timers are independent. A partner can encourage you, but never starts or stops your fast.</Text></View>;
  return <View style={styles.content}><Text style={styles.question}>Fast with someone</Text><Text style={styles.summary}>One accountability partner. You each keep your own timer — nothing they do starts or stops your fast.</Text><PrimaryButton label="Connect a partner" onPress={() => onFlowChange('creatorSignIn')} /><SecondaryButton label="Enter an invite code" onPress={() => onFlowChange('recipientInvite')} /><Text style={styles.builderNote}>Sign-in happens before an invite exists.</Text></View>;
}

function PairPage({ back, children, detail, eyebrow, icon, title }: PropsWithChildren<{ back?: () => void; detail?: string; eyebrow?: string; icon?: boolean; title: string }>) {
  return <View style={styles.content}>{back && <PressableScale accessibilityRole="button" onPress={back}><Text style={styles.closeText}>‹ Back</Text></PressableScale>}{eyebrow && <Text style={styles.time}>{eyebrow}</Text>}{icon && <View style={styles.largeAvatar} />}<Text style={styles.question}>{title}</Text>{detail !== undefined && <Text style={styles.summary}>{detail}</Text>}{children}</View>;
}

function HistoryScreen({ onBack, onOpenFast, onOpenPlan, view }: { onBack: () => void; onOpenFast: () => void; onOpenPlan: () => void; view: HistoryView }) {
  if (view === 'plan') return <View style={styles.content}><PressableScale accessibilityRole="button" onPress={onBack}><Text style={styles.closeText}>‹ History</Text></PressableScale><Text style={styles.question}>Rolling 48:4</Text><Text style={styles.summary}>Completed · Aug 23 – Sep 1</Text><View style={styles.stats}><Stat label="Cycle 1" value="48h fast · 4h refeed" /><Stat label="Cycle 2" value="48h fast · 4h refeed" /><Stat label="Cycle 3" value="Ended early at 31h" /><Stat label="Cycle 4" value="48h fast · 4h refeed" /><Stat label="Cycle 5" value="48h fast · 4h refeed" /></View><Text style={styles.builderNote}>Five cycles. Each cycle includes a fast and its refeed.</Text><SecondaryButton label="Do it again" /></View>;
  if (view === 'fast') return <View style={styles.content}><PressableScale accessibilityRole="button" onPress={onBack}><Text style={styles.closeText}>‹ History</Text></PressableScale><Text style={styles.question}>36h Fast</Text><Text style={styles.summary}>Aug 20 · Ended early</Text><View style={styles.stats}><Stat label="Actual" value="31h 24m" /><Stat label="Target" value="36h" /><Stat label="Started" value="Mon 8:14 PM" /><Stat label="Ended" value="Tue 3:38 AM" /></View><Text style={styles.builderNote}>Ended early is still recorded clearly—without framing it as a failure.</Text><SecondaryButton label="Do it again" /></View>;
  return <View style={styles.content}><Text style={styles.question}>History</Text><Text style={styles.summary}>A simple record of your plans and fasts.</Text><Text style={styles.sectionLabel}>RECENT</Text><View style={styles.historyList}><HistoryRow date="Sep 2" detail="24h Fast" status="Completed" /><HistoryRow date="Aug 23 – Sep 1" detail="Rolling 48:4" onPress={onOpenPlan} status="5 cycles complete" /><HistoryRow date="Aug 20" detail="36h Fast" onPress={onOpenFast} status="Ended early · 31h" /><HistoryRow date="Aug 14" detail="Rolling 24:2" onPress={onOpenPlan} status="Cancelled · 2 cycles" /><HistoryRow date="Aug 9" detail="18:6" status="Completed" /></View><Text style={styles.builderNote}>Open an entry for the full detail. Nothing is scored against anyone else.</Text></View>;
}

function HistoryRow({ date, detail, onPress, status }: { date: string; detail: string; onPress?: () => void; status: string }) {
  return <PressableScale accessibilityRole={onPress ? 'button' : undefined} onPress={onPress} style={styles.historyRow}><View><Text style={styles.planName}>{detail}</Text><Text style={styles.planDetail}>{date}</Text></View><View style={styles.historyStatus}><Text style={styles.planDetail}>{status}</Text>{onPress && <Text style={styles.rowAdornment}>›</Text>}</View></PressableScale>;
}

function SettingsScreen({ darkMode, onClose, onRemovePartner, onToggleDarkMode, partner }: { darkMode: boolean; onClose: () => void; onRemovePartner: () => void; onToggleDarkMode: () => void; partner?: string }) {
  return <View style={styles.content}><PressableScale accessibilityRole="button" onPress={onClose}><Text style={styles.closeText}>✕ Close</Text></PressableScale><Text style={styles.question}>Settings</Text><View style={styles.stats}><Stat label="Account" value="Signed in" /><Stat label="Notifications" value="After your first fast" /><Stat label="Auto-start next fast" value="Off" /><Stat label="Default plan" value="24h Fast" /><Stat label="Time format" value="24h" /><PressableScale accessibilityRole="button" onPress={onToggleDarkMode} style={styles.stat}><Text style={styles.planName}>Dark mode</Text><View style={[styles.toggle, darkMode && styles.toggleOn]}><View style={[styles.toggleKnob, darkMode && styles.toggleKnobOn]} /></View></PressableScale>{partner && <PressableScale accessibilityRole="button" onPress={onRemovePartner} style={styles.stat}><Text style={styles.planName}>Partner</Text><Text style={styles.dangerText}>Remove {partner}</Text></PressableScale>}<Stat label="About & safety" value="›" /></View><Text style={styles.builderNote}>Auto-start stays off by default so eating time is never logged as fasting.</Text></View>;
}

function StateLabel({ children, colour }: PropsWithChildren<{ colour: string }>) { return <Text style={[styles.stateLabel, { color: colour }]}>{children}</Text>; }
function Timer({ primary, secondary }: { primary: string; secondary: string }) { return <Text style={styles.timer}>{primary}<Text style={styles.timerSeconds}>{secondary}</Text></Text>; }
function ProgressBar({ colour, value }: { colour: string; value: `${number}%` }) { return <View style={styles.progressTrack}><View style={[styles.progressValue, { backgroundColor: colour, width: value }]} /></View>; }
function PlanDetail({ onPress, text }: { onPress: () => void; text: string }) { return <PressableScale accessibilityRole="button" onPress={onPress} style={styles.planDetailCard}><Text style={styles.cardText}>{text}</Text><Text style={styles.planDetail}>Plan details ›</Text></PressableScale>; }
function PartnerCard({ detail, name, status, statusColour }: { detail: string; name: string; status: string; statusColour: string }) { return <View style={styles.partnerCard}><View style={styles.partnerAvatar} /><View><Text style={styles.planName}>{name}</Text><Text style={styles.partnerDetail}><Text style={{ color: statusColour }}>{status}</Text> · {detail}</Text></View></View>; }
function Stat({ label, value }: { label: string; value: string }) { return <View style={styles.stat}><Text style={styles.planName}>{label}</Text><Text style={styles.planDetail}>{value}</Text></View>; }
function PrimaryButton({ label, onPress }: { label: string; onPress?: () => void }) { return <PressableScale accessibilityRole="button" onPress={onPress} style={styles.primaryButton}><Text style={styles.primaryText}>{label}</Text></PressableScale>; }
function SecondaryButton({ label, onPress }: { label: string; onPress?: () => void }) { return <PressableScale accessibilityRole="button" onPress={onPress} style={styles.secondaryButton}><Text style={styles.secondaryText}>{label}</Text></PressableScale>; }
function DangerButton({ label, onPress }: { label: string; onPress?: () => void }) { return <PressableScale accessibilityRole="button" onPress={onPress} style={styles.dangerButton}><Text style={styles.dangerText}>{label}</Text></PressableScale>; }

function PressableScale({ children, onPress, style, ...props }: PropsWithChildren<{ accessibilityLabel?: string; accessibilityRole?: 'button'; onPress?: () => void; style?: object }>) {
  const scale = useRef(new Animated.Value(1)).current;
  const animate = (toValue: number, duration: number) => Animated.timing(scale, { toValue, duration, useNativeDriver: true }).start();
  return <Pressable {...props} onPress={onPress} onPressIn={() => animate(motion.pressedScale, motion.pressIn)} onPressOut={() => animate(1, motion.pressOut)}><Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View></Pressable>;
}

function BottomTabs({ activeTab, onSelect }: { activeTab: AppTab; onSelect: (tab: AppTab) => void }) { return <View style={styles.tabs}>{(['today', 'together', 'history'] as AppTab[]).map((tab) => <PressableScale accessibilityLabel={`Open ${tab}`} key={tab} onPress={() => onSelect(tab)}><Text style={activeTab === tab ? styles.activeTab : styles.tab}>{tab === 'today' ? 'Today' : tab === 'together' ? 'Together' : 'History'}</Text></PressableScale>)}</View>; }

const styles = StyleSheet.create({
  safeArea: { backgroundColor: colors.surface, flex: 1 }, refeedCanvas: { backgroundColor: '#FAF6EE' }, screen: { flex: 1, paddingHorizontal: 20 },
  header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', paddingBottom: 20, paddingTop: 8 }, time: { color: colors.subtle, fontSize: 12 }, settingsLink: { alignItems: 'center', flexDirection: 'row', gap: 8 }, avatar: { borderColor: colors.subtle, borderRadius: 99, borderStyle: 'dashed', borderWidth: 1.5, height: 36, width: 36 }, settingsButton: { alignItems: 'center', borderColor: colors.ink, borderRadius: 99, borderWidth: 1.5, height: 40, justifyContent: 'center', width: 40 }, settingsIcon: { height: 18, position: 'relative', width: 18 }, settingLine: { backgroundColor: colors.ink, height: 1.5, left: 0, position: 'absolute', right: 0 }, settingLineOne: { top: 2 }, settingLineTwo: { top: 8 }, settingLineThree: { top: 14 }, settingDot: { backgroundColor: colors.surface, borderColor: colors.ink, borderRadius: 4, borderWidth: 1.5, height: 7, position: 'absolute', width: 7 }, settingDotOne: { right: 2, top: -1 }, settingDotTwo: { left: 3, top: 5 }, settingDotThree: { right: 5, top: 11 },
  content: { flex: 1, gap: 14 }, question: { color: colors.ink, fontSize: 28, fontWeight: '600', letterSpacing: -0.5, lineHeight: 33 }, stateLabel: { fontSize: 13, fontWeight: '600', letterSpacing: 2.1, marginTop: 2 },
  planList: { borderTopColor: colors.divider, borderTopWidth: 1 }, planRow: { alignItems: 'center', borderBottomColor: colors.divider, borderBottomWidth: 1, flexDirection: 'row', justifyContent: 'space-between', minHeight: 66, paddingHorizontal: 2, paddingVertical: 10 }, selectedPlan: { backgroundColor: '#F9F4EC', paddingHorizontal: 10 }, planName: { color: colors.ink, fontSize: 16 }, planDetail: { color: colors.subtle, fontSize: 13, marginTop: 3 }, rowAdornment: { color: '#A09A90', fontSize: 21 }, selectedAdornment: { color: colors.accent }, starting: { color: colors.subtle, fontSize: 14, lineHeight: 20 }, quietAction: { color: colors.muted, fontSize: 15, paddingVertical: 8, textAlign: 'center' },
  primaryButton: { alignItems: 'center', backgroundColor: colors.ink, borderRadius: 999, justifyContent: 'center', minHeight: 54, paddingHorizontal: 20 }, primaryText: { color: colors.surface, fontSize: 17, fontWeight: '600' }, secondaryButton: { alignItems: 'center', borderColor: colors.ink, borderRadius: 999, borderWidth: 1.5, justifyContent: 'center', minHeight: 52, paddingHorizontal: 20 }, secondaryText: { color: colors.ink, fontSize: 16, fontWeight: '500' }, dangerButton: { alignItems: 'center', borderColor: colors.danger, borderRadius: 999, borderStyle: 'dashed', borderWidth: 1.5, justifyContent: 'center', minHeight: 48, paddingHorizontal: 20 }, dangerText: { color: colors.danger, fontSize: 15, fontWeight: '500' },
  timerTapTarget: { alignSelf: 'flex-start' }, timer: { color: colors.ink, fontSize: 52, fontVariant: ['tabular-nums'], letterSpacing: -1.6, lineHeight: 56 }, timerSeconds: { color: colors.subtle, fontSize: 26, letterSpacing: -0.5 }, summary: { color: colors.muted, fontSize: 16, lineHeight: 22, marginTop: -6 }, progressTrack: { backgroundColor: '#E3DFD6', borderRadius: 99, height: 10, overflow: 'hidden' }, progressValue: { borderRadius: 99, height: '100%' },
  planDetailCard: { alignItems: 'center', borderColor: colors.divider, borderRadius: 16, borderStyle: 'dashed', borderWidth: 1.5, flexDirection: 'row', justifyContent: 'space-between', minHeight: 58, paddingHorizontal: 14 }, cardText: { color: colors.ink, fontSize: 15 }, partnerCard: { alignItems: 'center', borderColor: colors.divider, borderRadius: 16, borderWidth: 1, flexDirection: 'row', gap: 10, padding: 12 }, partnerAvatar: { backgroundColor: '#F2EFE8', borderRadius: 99, height: 36, width: 36 }, partnerDetail: { color: colors.muted, fontSize: 14, marginTop: 3 },
  stats: { borderTopColor: colors.divider, borderTopWidth: 1 }, stat: { alignItems: 'center', borderBottomColor: colors.divider, borderBottomWidth: 1, flexDirection: 'row', justifyContent: 'space-between', minHeight: 53 }, tabs: { borderTopColor: colors.ink, borderTopWidth: 1, flexDirection: 'row', justifyContent: 'space-around', marginTop: 12, paddingBottom: 12, paddingTop: 12 }, tab: { color: colors.subtle, fontSize: 14 }, activeTab: { color: colors.ink, fontSize: 14, fontWeight: '600' },
  builder: { flex: 1, gap: 24, paddingTop: 12 }, builderHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' }, closeText: { color: colors.subtle, fontSize: 13 }, builderTitle: { color: colors.subtle, fontSize: 13 }, choiceGroup: { gap: 8 }, choiceLabel: { color: colors.subtle, fontSize: 14 }, choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, choice: { borderColor: colors.ink, borderRadius: 999, borderWidth: 1.5, paddingHorizontal: 14, paddingVertical: 10 }, selectedChoice: { backgroundColor: colors.accent, borderColor: colors.accent }, choiceText: { color: colors.ink, fontSize: 15 }, selectedChoiceText: { color: colors.surface, fontWeight: '600' }, protocolCard: { alignItems: 'center', borderColor: colors.ink, borderRadius: 16, borderStyle: 'dashed', borderWidth: 1.5, gap: 5, padding: 14 }, protocol: { color: colors.ink, fontSize: 16 }, protocolDetail: { color: colors.muted, fontSize: 14 }, builderNote: { color: colors.subtle, fontSize: 14, lineHeight: 20 },
  largeAvatar: { backgroundColor: '#F2EFE8', borderRadius: 99, height: 64, marginTop: 6, width: 64 }, inviteCode: { alignItems: 'center', borderColor: colors.ink, borderRadius: 16, borderStyle: 'dashed', borderWidth: 2, gap: 6, padding: 18 }, code: { color: colors.ink, fontSize: 34, letterSpacing: 4 }, dividerNote: { borderTopColor: colors.divider, borderTopWidth: 1, color: colors.subtle, fontSize: 14, lineHeight: 20, paddingTop: 12 }, selectedProtocol: { borderColor: colors.accent, backgroundColor: '#F9F4EC', borderRadius: 16, borderWidth: 1.5, gap: 5, padding: 14 }, ownProtocol: { borderColor: colors.ink, borderRadius: 16, borderWidth: 1.5, gap: 5, padding: 14 }, pairedNotice: { backgroundColor: '#F1F3EA', borderColor: colors.success, borderRadius: 16, borderWidth: 1.5, gap: 5, padding: 14 },
  modalOverlay: { flex: 1, justifyContent: 'flex-end' }, scrim: { backgroundColor: 'rgba(26,26,26,0.36)', bottom: 0, left: 0, position: 'absolute', right: 0, top: 0 }, sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, gap: 14, paddingBottom: 28, paddingHorizontal: 20, paddingTop: 10 }, handle: { alignSelf: 'center', backgroundColor: '#D8D2C8', borderRadius: 99, height: 4, width: 40 }, sheetContent: { gap: 14 }, sheetTitle: { color: colors.ink, fontSize: 24, fontWeight: '600', letterSpacing: -0.3 }, reactions: { flexDirection: 'row', gap: 10, justifyContent: 'space-between' }, reaction: { alignItems: 'center', borderColor: '#E3DFD6', borderRadius: 99, borderWidth: 1.5, height: 52, justifyContent: 'center', width: 52 }, selectedReaction: { backgroundColor: '#F9F4EC', borderColor: colors.accent }, reactionText: { fontSize: 22 }, rolloverNotice: { backgroundColor: '#F6F8F0', borderColor: colors.success, borderRadius: 16, borderStyle: 'dashed', borderWidth: 1.5, gap: 4, padding: 12 }, toast: { alignSelf: 'center', backgroundColor: colors.ink, borderRadius: 99, bottom: 82, paddingHorizontal: 18, paddingVertical: 12, position: 'absolute' }, toastText: { color: colors.surface, fontSize: 14, fontWeight: '500' },
  sectionLabel: { color: colors.subtle, fontSize: 12, fontWeight: '600', letterSpacing: 1.8, marginTop: 6 }, historyList: { borderTopColor: colors.divider, borderTopWidth: 1 }, historyRow: { alignItems: 'center', borderBottomColor: colors.divider, borderBottomWidth: 1, flexDirection: 'row', justifyContent: 'space-between', minHeight: 64, paddingVertical: 9 }, historyStatus: { alignItems: 'center', flexDirection: 'row', gap: 5, maxWidth: '48%' }, toggle: { backgroundColor: '#E3DFD6', borderRadius: 99, height: 24, justifyContent: 'center', padding: 3, width: 42 }, toggleOn: { backgroundColor: colors.ink }, toggleKnob: { backgroundColor: colors.surface, borderRadius: 99, height: 18, width: 18 }, toggleKnobOn: { alignSelf: 'flex-end' },
  themeOverlay: { alignItems: 'flex-end', flex: 1, paddingRight: 20, paddingTop: 72 }, themePicker: { backgroundColor: colors.surface, borderColor: colors.ink, borderRadius: 18, borderWidth: 1.5, elevation: 8, gap: 5, padding: 14, width: 210, zIndex: 1 }, themeTitle: { color: colors.ink, fontSize: 17, fontWeight: '600' }, themeCopy: { color: colors.muted, fontSize: 13, lineHeight: 18, marginBottom: 5 }, themeOption: { alignItems: 'center', borderRadius: 10, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 10, paddingVertical: 11 }, themeOptionSelected: { backgroundColor: '#F9F4EC' },
});
