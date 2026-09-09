import { useRef, useState, type PropsWithChildren } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Animated, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, darkColors } from '../../../shared/theme/colors';
import { motion } from '../../../shared/theme/motion';
import { useAppFlow } from '../../app/useAppFlow';
import type { AppTab, PairFlow, Partner, Sheet } from '../../app/types';
import { formatDuration, type TimerSnapshot } from '../../../domain/fasting/engine';
import { protocolDetail } from '../../../domain/fasting/protocol';
import { useFastingTimer } from '../../fasting/hooks/useFastingTimer';
import type { HistoryItem } from '../../../data/local/sqlite/fastingRepository';
import { plans } from '../model';

type Palette = typeof colors | typeof darkColors;

let palette: Palette = colors;
let styles: ReturnType<typeof createStyles>;

/** The first production flow: wireframe 3b, states T1 through T5. */
export function TodayScreen() {
  const flow = useAppFlow();
  const timer = useFastingTimer(flow.darkMode);
  const { state, setState, tab, setTab, sheet, setSheet, settingsOpen, setSettingsOpen, darkMode, setDarkMode,
    selectedPlan, returnToIdle, choosePlan, startBuilder } = flow;
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null);
  const [settingsView, setSettingsView] = useState<'settings' | 'safety'>('settings');
  palette = darkMode ? darkColors : colors;
  styles = createStyles();
  const isBuilder = state === 'rollingBuilder' || state === 'customBuilder';
  const activeState = timer.active?.phaseKind === 'fast' ? 'fasting' : timer.active?.phaseKind === 'refeed' ? 'refeeding' : state;
  const startSelectedPlan = async () => { await timer.startPreset(selectedPlan); setState('fasting'); };
  const endActive = async () => { await timer.endActivePhase(); setSheet(null); };
  const startPending = async () => { await timer.startPendingPhase(); setSheet(null); };
  const endAndStartRefeed = async () => {
    await timer.endActivePhase();
    await timer.startPendingPhase();
    setSheet(null);
  };

  return (
    <SafeAreaView edges={['top', 'bottom']} style={[styles.safeArea, state === 'refeeding' || state === 'transition' ? styles.refeedCanvas : undefined]}>
      <View style={styles.screen}>
        <StatusBar style={darkMode ? 'light' : 'dark'} />
        {settingsOpen ? <SettingsScreen darkMode={darkMode} onBackToSettings={() => setSettingsView('settings')} onClose={() => { setSettingsOpen(false); setSettingsView('settings'); }} onOpenSafety={() => setSettingsView('safety')} onToggleDarkMode={() => setDarkMode(!darkMode)} view={settingsView} /> : <>
          {!isBuilder && <AppHeader onOpenSettings={() => { setSettingsView('settings'); setSettingsOpen(true); }} />}
          {tab === 'today' && !timer.active && !timer.pending && state === 'idle' && <IdleState selectedPlan={selectedPlan} onPlanSelect={choosePlan} onStart={startSelectedPlan} />}
          {tab === 'today' && activeState === 'fasting' && timer.active && <FastingState timer={timer.active} onOpenEnd={() => setSheet('endFast')} onOpenPlan={() => setSheet('planDetails')} />}
          {tab === 'today' && activeState === 'refeeding' && timer.active && <RefeedingState timer={timer.active} onEndRefeed={endActive} onOpenPlan={() => setSheet('planDetails')} />}
          {tab === 'today' && timer.pending && <PendingState kind={timer.pending.kind} planDetail={protocolDetail(timer.pending.protocol)} onEndPlan={async () => { await timer.cancelPlan(); setState('complete'); }} onStart={startPending} />}
          {tab === 'today' && !timer.active && !timer.pending && state === 'transition' && <TransitionState onEndPlan={() => setState('complete')} onOpenPlan={() => setSheet('planDetails')} onStartNext={() => setState('fasting')} />}
          {tab === 'today' && state === 'complete' && <CompleteState onDone={() => returnToIdle()} onRepeat={() => returnToIdle('Rolling')} />}
          {state === 'rollingBuilder' && <PlanBuilder variant="rolling" onClose={() => setState('idle')} onStart={async (protocol) => { await timer.startProtocol(protocol); startBuilder('Rolling'); }} />}
          {state === 'customBuilder' && <PlanBuilder variant="custom" onClose={() => setState('idle')} onStart={async (protocol) => { await timer.startProtocol(protocol); startBuilder('Custom'); }} />}
          {tab === 'history' && <HistoryScreen entries={timer.history} selectedId={selectedHistoryId} onBack={() => setSelectedHistoryId(null)} onOpenEntry={setSelectedHistoryId} />}
          {!isBuilder && <BottomTabs activeTab={tab} onSelect={setTab} />}
          <AppSheet activeTimer={timer.active} kind={sheet} onClose={() => setSheet(null)} onEndStandalone={async () => { await endActive(); returnToIdle(); }} onFinishPlan={async () => { await timer.cancelPlan(); setSheet(null); setState('complete'); }} onStartRefeed={endAndStartRefeed} rolling={timer.active?.protocol.repeatCount !== 1} />
        </>}
        {timer.error && <Text style={styles.builderNote}>{timer.error}</Text>}
      </View>
    </SafeAreaView>
  );
}

function AppHeader({ onOpenSettings }: { onOpenSettings: () => void }) {
  return <View style={styles.header}><Text style={styles.time}>9:41</Text><PressableScale accessibilityLabel="Open settings" accessibilityRole="button" onPress={onOpenSettings} style={styles.settingsButton}><SettingsIcon /></PressableScale></View>;
}

function SettingsIcon() { return <View style={styles.settingsIcon}><View style={[styles.settingLine, styles.settingLineOne]} /><View style={[styles.settingDot, styles.settingDotOne]} /><View style={[styles.settingLine, styles.settingLineTwo]} /><View style={[styles.settingDot, styles.settingDotTwo]} /><View style={[styles.settingLine, styles.settingLineThree]} /><View style={[styles.settingDot, styles.settingDotThree]} /></View>; }

function IdleState({ onPlanSelect, onStart, selectedPlan }: { onPlanSelect: (name: string) => void; onStart: () => void; selectedPlan: string }) {
  const plan = plans.find((item) => item.name === selectedPlan) ?? plans[3];
  return <View style={styles.content}>
    <Text style={styles.question}>How long are you fasting?</Text>
    <View style={styles.planList}>{plans.map((item) => {
      const selected = item.name === selectedPlan;
      const opensBuilder = item.name === 'Rolling' || item.name === 'Custom';
      return <PressableScale accessibilityLabel={`Choose ${item.name}`} key={item.name} onPress={() => onPlanSelect(item.name)} style={[styles.planRow, selected && styles.selectedPlan]}>
        <View><Text style={styles.planName}>{item.name}</Text><Text style={styles.planDetail}>{item.detail}</Text></View>
        <Text style={[styles.rowAdornment, selected && styles.selectedAdornment]}>{selected ? '✓' : opensBuilder ? '›' : ''}</Text>
      </PressableScale>;
    })}</View>
    <Text style={styles.starting}>Starting: {plan.name} · {plan.detail}</Text>
    <PrimaryButton label="Start Fast" onPress={onStart} />
  </View>;
}

function FastingState({ onOpenEnd, onOpenPlan, timer }: { onOpenEnd: () => void; onOpenPlan: () => void; timer: TimerSnapshot }) {
  const display = formatDuration(timer.remainingMs);
  const summary = timer.targetReached ? `Target reached · continues until you end fast` : `${formatDuration(timer.elapsedMs).primary} elapsed · ${formatDuration(timer.remainingMs).primary} left`;
  return <View style={styles.content}>
    <StateLabel colour={palette.accent}>{timer.targetReached ? 'FASTING · TARGET REACHED' : 'FASTING'}</StateLabel><Timer primary={display.primary} secondary={display.seconds} />
    <Text style={styles.summary}>{summary}</Text><ProgressBar colour={palette.accent} value={`${Math.round(timer.progress * 100)}%` as `${number}%`} />
    <PlanDetail onPress={onOpenPlan} text={`${timer.planName} · Cycle ${timer.cycleNumber}`} />
    <DangerButton label="End fast" onPress={onOpenEnd} />
  </View>;
}

function RefeedingState({ onEndRefeed, onOpenPlan, timer }: { onEndRefeed: () => void; onOpenPlan: () => void; timer: TimerSnapshot }) {
  const display = formatDuration(timer.remainingMs);
  return <View style={styles.content}>
    <StateLabel colour={palette.success}>{timer.targetReached ? 'REFEED · TARGET REACHED' : 'REFEEDING'}</StateLabel>
    <Timer primary={display.primary} secondary={display.seconds} />
    <Text style={styles.summary}>{timer.targetReached ? 'Target reached · end refeed when you are ready' : `${formatDuration(timer.remainingMs).primary} left`}</Text><ProgressBar colour={palette.success} value={`${Math.round(timer.progress * 100)}%` as `${number}%`} />
    <PlanDetail onPress={onOpenPlan} text={`${timer.planName} · Cycle ${timer.cycleNumber}`} />
    <PrimaryButton label="End refeed" onPress={onEndRefeed} />
  </View>;
}

function PendingState({ kind, onEndPlan, onStart, planDetail }: { kind: 'fast' | 'refeed'; onEndPlan: () => void; onStart: () => void; planDetail: string }) {
  const isRefeed = kind === 'refeed';
  return <View style={styles.content}><StateLabel colour={isRefeed ? palette.success : palette.accent}>{isRefeed ? 'FAST COMPLETE' : 'REFEED COMPLETE'}</StateLabel><Text style={styles.question}>{isRefeed ? 'Ready to refeed' : 'Ready for your next fast'}</Text><Text style={styles.summary}>{planDetail}</Text><PrimaryButton label={isRefeed ? 'Start refeed' : 'Start next fast'} onPress={onStart} /><DangerButton label="End plan" onPress={onEndPlan} /><Text style={styles.starting}>Nothing starts until you tap Start.</Text></View>;
}

function TransitionState({ onEndPlan, onOpenPlan, onStartNext }: { onEndPlan: () => void; onOpenPlan: () => void; onStartNext: () => void }) {
  return <View style={styles.content}>
    <StateLabel colour={palette.success}>REFEED COMPLETE</StateLabel><Text style={styles.question}>Ready for your next fast</Text>
    <Text style={styles.summary}>4h Refeed finished 6:12 PM · Cycle 2 of 5 complete</Text><ProgressBar colour={palette.success} value="100%" />
    <PlanDetail onPress={onOpenPlan} text="Next: 48h Fast · Cycle 3 of 5" />
    <PrimaryButton label="Start next fast" onPress={onStartNext} /><DangerButton label="End plan" onPress={onEndPlan} />
    <Text style={styles.starting}>Auto-start is off, so nothing counts until you tap Start.</Text>
  </View>;
}

function CompleteState({ onDone, onRepeat }: { onDone: () => void; onRepeat: () => void }) {
  return <View style={styles.content}>
    <StateLabel colour={palette.ink}>PLAN COMPLETE</StateLabel><Text style={styles.question}>Rolling 48:4</Text><Text style={styles.summary}>5 of 5 cycles</Text>
    <View style={styles.stats}><Stat label="Fasting" value="240h 12m" /><Stat label="Refeeding" value="20h 05m" /><Stat label="Dates" value="Aug 23 – Sep 1" /></View>
    <PrimaryButton label="Done" onPress={onDone} /><SecondaryButton label="Do it again" onPress={onRepeat} />
    <Text style={styles.starting}>Do it again loads the protocol on Today. It does not start it.</Text>
  </View>;
}

function PlanBuilder({ onClose, onStart, variant }: { onClose: () => void; onStart: (protocol: import('../../../domain/fasting/protocol').ProtocolSnapshot) => void; variant: 'rolling' | 'custom' }) {
  const rolling = variant === 'rolling';
  const [fast, setFast] = useState(rolling ? '48h' : '36h');
  const [refeed, setRefeed] = useState(rolling ? '4h' : 'None');
  const [repeat, setRepeat] = useState(rolling ? '5' : 'No');
  const [customFast, setCustomFast] = useState('');
  const [customRefeed, setCustomRefeed] = useState('');
  const [customRepeat, setCustomRepeat] = useState('');
  const fastHours = hoursForChoice(fast, customFast);
  const refeedHours = refeed === 'None' ? null : hoursForChoice(refeed, customRefeed);
  const repeatCount = repeat === 'Forever' ? null : repeat === 'No' ? 1 : repeat === 'Custom' ? wholeNumber(customRepeat) : wholeNumber(repeat);
  const canStart = fastHours !== null && (refeed === 'None' || refeedHours !== null) && (repeat === 'Forever' || repeatCount !== null);
  const summary = fastHours === null ? 'Choose a fast duration' : `${fastHours}h Fast${refeed === 'None' ? '' : refeedHours === null ? ' → choose refeed' : ` → ${refeedHours}h Refeed`}`;
  const subcopy = repeat === 'Forever' ? 'Repeat forever' : repeatCount === null ? 'Choose a repeat count' : repeatCount === 1 ? 'One cycle' : `Repeat ${repeatCount} times`;
  const startPlan = () => {
    if (!canStart || fastHours === null || (refeed !== 'None' && refeedHours === null)) return;
    const protocol = {
      version: 1 as const,
      name: rolling ? `Rolling ${fastHours}h:${refeedHours}h` : `Custom ${fastHours}h${refeedHours ? `:${refeedHours}h` : ''}`,
      fastDurationMs: fastHours * 60 * 60 * 1000,
      refeedDurationMs: refeedHours === null ? null : refeedHours * 60 * 60 * 1000,
      repeatCount,
    };
    onStart(protocol);
  };

  return <View style={styles.builder}>
    <View style={styles.builderHeader}>
      <PressableScale accessibilityRole="button" onPress={onClose}><Text style={styles.closeText}>✕  Close</Text></PressableScale>
      <Text style={styles.builderTitle}>{rolling ? 'Rolling plan' : 'Custom fast'}</Text>
    </View>
    <ChoiceGroup label={rolling ? 'Fast' : 'Fast for'} values={rolling ? ['24h', '36h', '48h'] : ['20h', '24h', '36h', 'Custom']} selected={fast} onSelect={setFast} />
    {!rolling && fast === 'Custom' && <WholeNumberInput label="Custom fast length" onChange={setCustomFast} unit="hours" value={customFast} />}
    <ChoiceGroup label={rolling ? 'Refeed' : 'Then refeed'} values={rolling ? ['1h', '4h', '8h'] : ['None', '1h', '4h', 'Custom']} selected={refeed} onSelect={setRefeed} />
    {!rolling && refeed === 'Custom' && <WholeNumberInput label="Custom refeed length" onChange={setCustomRefeed} unit="hours" value={customRefeed} />}
    <ChoiceGroup label="Repeat" values={rolling ? ['2', '3', '5', 'Forever'] : ['No', '2', '3', 'Forever', 'Custom']} selected={repeat} onSelect={setRepeat} />
    {!rolling && repeat === 'Custom' && <WholeNumberInput label="Custom repeat count" onChange={setCustomRepeat} unit="cycles" value={customRepeat} />}
    <View style={styles.protocolCard}><Text style={styles.protocol}>{summary}</Text><Text style={styles.protocolDetail}>{subcopy}</Text></View>
    <PrimaryButton disabled={!canStart} label={rolling ? 'Start Plan' : 'Start Fast'} onPress={startPlan} />
    <Text style={styles.builderNote}>{rolling ? 'One cycle = one fast + its refeed. The plan completes after the final refeed.' : 'A single fast is one History entry. A rolling plan is one plan entry with cycles inside it.'}</Text>
  </View>;
}

function AppSheet({ activeTimer, kind, onClose, onEndStandalone, onFinishPlan, onStartRefeed, rolling }: { activeTimer: TimerSnapshot | null; kind: Sheet; onClose: () => void; onEndStandalone: () => void; onFinishPlan: () => void; onStartRefeed: () => void; rolling: boolean }) {
  if (!kind) return null;
  return <Modal animationType="fade" onRequestClose={onClose} transparent visible>
    <View style={styles.modalOverlay}>
      <Pressable accessibilityLabel="Close sheet" onPress={onClose} style={styles.scrim} />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        {kind === 'planDetails' && activeTimer && <PlanDetailsSheet timer={activeTimer} />}
        {kind === 'endFast' && activeTimer && <EndFastSheet timer={activeTimer} onClose={onClose} onEndStandalone={onEndStandalone} onFinishPlan={onFinishPlan} onStartRefeed={onStartRefeed} rolling={rolling} />}
      </View>
    </View>
  </Modal>;
}

// Paused paired-reaction UI retained for the later Together release.
function ReactionSheet({ onSend }: { onSend: () => void }) {
  const [reaction, setReaction] = useState('🔥');
  return <View style={styles.sheetContent}><Text style={styles.sheetTitle}>Send Sam a reaction</Text><Text style={styles.summary}>A small nudge. It never changes their timer.</Text><View style={styles.reactions}>{['🔥', '👏', '💪', '❤️'].map((item) => <PressableScale key={item} onPress={() => setReaction(item)} style={[styles.reaction, reaction === item && styles.selectedReaction]}><Text style={styles.reactionText}>{item}</Text></PressableScale>)}</View><PrimaryButton label={`Send ${reaction}`} onPress={onSend} /></View>;
}

function PlanDetailsSheet({ timer }: { timer: TimerSnapshot }) {
  const next = timer.phaseKind === 'fast' && timer.protocol.refeedDurationMs ? 'Refeed when you end this fast' : timer.phaseKind === 'refeed' ? 'Next fast when you tap Start' : 'Plan ends when this fast ends';
  return <View style={styles.sheetContent}><Text style={styles.sheetTitle}>Plan details</Text><View style={styles.stats}><Stat label="Protocol" value={protocolDetail(timer.protocol)} /><Stat label="Current phase" value={timer.phaseKind === 'fast' ? 'Fasting' : 'Refeeding'} /><Stat label="Cycle" value={timer.protocol.repeatCount ? `${timer.cycleNumber} of ${timer.protocol.repeatCount}` : `${timer.cycleNumber} · ongoing`} /><Stat label="Started" value={timeOfDay(timer.startedAt)} /><Stat label="Target" value={timer.targetReached ? `${readableDuration(timer.elapsedMs)} elapsed` : timeOfDay(timer.targetAt)} /><Stat label="Next" value={next} /></View><Text style={styles.builderNote}>Your timer is based on the saved start and target time, so it stays correct when the app is closed.</Text></View>;
}

function EndFastSheet({ onClose, onEndStandalone, onFinishPlan, onStartRefeed, rolling, timer }: { onClose: () => void; onEndStandalone: () => void; onFinishPlan: () => void; onStartRefeed: () => void; rolling: boolean; timer: TimerSnapshot }) {
  const isFast = timer.phaseKind === 'fast';
  const elapsed = readableDuration(timer.elapsedMs);
  const timing = timer.targetReached ? `${elapsed} elapsed · target reached` : `${elapsed} elapsed · ${readableDuration(timer.remainingMs)} left`;
  return <View style={styles.sheetContent}><Text style={styles.sheetTitle}>{isFast ? 'End your fast?' : 'End your refeed?'}</Text><Text style={styles.summary}>{timing}</Text>{rolling ? <><View style={styles.rolloverNotice}><Text style={styles.protocol}>Part of {timer.planName}</Text><Text style={styles.protocolDetail}>{isFast && timer.protocol.refeedDurationMs ? `Start your ${readableDuration(timer.protocol.refeedDurationMs)} refeed now, or finish this plan early.` : 'End this phase, then choose when to start the next one.'}</Text></View>{isFast && timer.protocol.refeedDurationMs ? <PrimaryButton label="Start Refeed" onPress={onStartRefeed} /> : <PrimaryButton label="End phase" onPress={onEndStandalone} />}<SecondaryButton label="Finish Plan" onPress={onFinishPlan} /></> : <><Text style={styles.builderNote}>This saves the fast as a standalone History entry.</Text><PrimaryButton label={isFast ? 'Finish Fast' : 'Finish Refeed'} onPress={onEndStandalone} /></>}<PressableScale accessibilityRole="button" onPress={onClose}><Text style={styles.quietAction}>Continue {isFast ? 'fasting' : 'refeeding'}</Text></PressableScale></View>;
}

function ReactionToast({ onDismiss }: { onDismiss: () => void }) { return <PressableScale accessibilityRole="button" onPress={onDismiss} style={styles.toast}><Text style={styles.toastText}>Reaction sent to Sam 🔥</Text></PressableScale>; }

function ChoiceGroup({ label, onSelect, selected, values }: { label: string; onSelect: (value: string) => void; selected: string; values: string[] }) {
  return <View style={styles.choiceGroup}>
    <Text style={styles.choiceLabel}>{label}</Text>
    <View style={styles.choices}>{values.map((value) => <PressableScale accessibilityLabel={`Choose ${value}`} key={value} onPress={() => onSelect(value)} style={[styles.choice, value === selected && styles.selectedChoice]}><Text style={[styles.choiceText, value === selected && styles.selectedChoiceText]}>{value}</Text></PressableScale>)}</View>
  </View>;
}

function WholeNumberInput({ label, onChange, unit, value }: { label: string; onChange: (value: string) => void; unit: string; value: string }) {
  const invalid = value.length > 0 && wholeNumber(value) === null;
  return <View style={styles.customInputGroup}>
    <Text style={styles.inputLabel}>{label}</Text>
    <View style={[styles.numberInput, invalid && styles.numberInputInvalid]}>
      <TextInput accessibilityLabel={label} keyboardType="number-pad" onChangeText={(next) => onChange(next.replace(/[^0-9]/g, ''))} placeholder="Enter a number" placeholderTextColor={palette.subtle} style={styles.numberInputText} value={value} />
      <Text style={styles.inputUnit}>{unit}</Text>
    </View>
    <Text style={[styles.inputHint, invalid && styles.inputHintInvalid]}>{invalid ? 'Use a whole number greater than 0.' : `Whole numbers greater than 0 · ${unit}`}</Text>
  </View>;
}

function wholeNumber(value: string) {
  if (!/^[1-9]\d*$/.test(value)) return null;
  const number = Number(value);
  return Number.isSafeInteger(number) ? number : null;
}

function hoursForChoice(choice: string, customValue: string) {
  return choice === 'Custom' ? wholeNumber(customValue) : wholeNumber(choice.replace('h', ''));
}

// Paused pairing flow retained for the later Together release.
function TogetherScreen({ flow, onBackToToday, onFlowChange, onOpenReaction, onPair, onStartOwnFast, partner }: { flow: PairFlow; onBackToToday: () => void; onFlowChange: (flow: PairFlow) => void; onOpenReaction: () => void; onPair: (partner: Partner) => void; onStartOwnFast: () => void; partner: Partner | null }) {
  if (flow === 'creatorSignIn') return <PairPage back={() => onFlowChange('none')} title="Sign in to pair" detail="An account lets one partner find you. Solo fasting never needs one." icon><SecondaryButton label="Continue with Google" onPress={() => onFlowChange('creatorInvite')} /><SecondaryButton label="Continue with Apple" onPress={() => onFlowChange('creatorInvite')} /><Text style={styles.builderNote}>We store your name and photo so your partner knows who joined. No health data leaves the phone.</Text><Text style={styles.quietAction}>Fast alone instead</Text></PairPage>;
  if (flow === 'creatorInvite') return <PairPage back={() => onFlowChange('none')} title="Invite your partner"><View style={styles.inviteCode}><Text style={styles.choiceLabel}>Invite code</Text><Text style={styles.code}>K7F9Q</Text></View><PrimaryButton label="Share invite" onPress={() => onFlowChange('recipientInvite')} /><Text style={styles.builderNote}>Expires in 24h. One person only.</Text><Text style={styles.dividerNote}>Your fast does not wait for them — start whenever you like and they can join the pair later.</Text><SecondaryButton label="Start my fast now" onPress={onStartOwnFast} /></PairPage>;
  if (flow === 'recipientInvite') return <PairPage eyebrow="Invite from Alex" title="Alex wants to fast with you" detail=""><View style={styles.protocolCard}><Text style={styles.protocol}>Suggested protocol</Text><Text style={styles.protocolDetail}>48h Fast → 4h Refeed · Repeat 5 times</Text></View><PrimaryButton label="Join pair" onPress={() => onFlowChange('recipientPlan')} /><Text style={styles.builderNote}>Joining pairs you two. It does not start any timer.</Text><Text style={styles.quietAction}>Not now</Text></PairPage>;
  if (flow === 'recipientPlan') return <View style={styles.content}><Text style={styles.question}>Your plan</Text><Text style={styles.summary}>Alex's protocol is only a suggestion. Pick what you'll actually do.</Text><PressableScale onPress={() => {}} style={styles.selectedProtocol}><Text style={styles.protocol}>Use this plan</Text><Text style={styles.protocolDetail}>48h Fast → 4h Refeed · Repeat 5</Text></PressableScale><PressableScale onPress={onBackToToday} style={styles.ownProtocol}><Text style={styles.protocol}>Choose my own</Text><Text style={styles.protocolDetail}>presets, rolling or custom</Text></PressableScale><PrimaryButton label="Start Fast" onPress={() => { onPair({ name: 'Alex', role: 'recipient' }); onStartOwnFast(); }} /><Text style={styles.builderNote}>Nothing runs until you tap Start.</Text></View>;
  if (flow === 'paired' && partner) return <View style={styles.content}><PartnerCard name={partner.name} status="Inactive" detail="no fast running" statusColour={palette.subtle} /><View style={styles.pairedNotice}><Text style={styles.protocol}>{partner.name} joined your pair</Text><Text style={styles.protocolDetail}>You each start your own timer.</Text></View><View style={styles.stats}><Stat label="Your plan" value="48h Fast → 4h Refeed" /><Stat label={`${partner.name}'s plan`} value="not started yet" /><Stat label="Pair since" value="Sep 2026" /></View><SecondaryButton label="🙂  Send reaction" onPress={onOpenReaction} /><Text style={styles.builderNote}>Your timers are independent. A partner can encourage you, but never starts or stops your fast.</Text></View>;
  return <View style={styles.content}><Text style={styles.question}>Fast with someone</Text><Text style={styles.summary}>One accountability partner. You each keep your own timer — nothing they do starts or stops your fast.</Text><PrimaryButton label="Connect a partner" onPress={() => onFlowChange('creatorSignIn')} /><SecondaryButton label="Enter an invite code" onPress={() => onFlowChange('recipientInvite')} /><Text style={styles.builderNote}>Sign-in happens before an invite exists.</Text></View>;
}

function PairPage({ back, children, detail, eyebrow, icon, title }: PropsWithChildren<{ back?: () => void; detail?: string; eyebrow?: string; icon?: boolean; title: string }>) {
  return <View style={styles.content}>{back && <PressableScale accessibilityRole="button" onPress={back}><Text style={styles.closeText}>‹ Back</Text></PressableScale>}{eyebrow && <Text style={styles.time}>{eyebrow}</Text>}{icon && <View style={styles.largeAvatar} />}<Text style={styles.question}>{title}</Text>{detail !== undefined && <Text style={styles.summary}>{detail}</Text>}{children}</View>;
}

function HistoryScreen({ entries, onBack, onOpenEntry, selectedId }: { entries: HistoryItem[]; onBack: () => void; onOpenEntry: (id: string) => void; selectedId: string | null }) {
  const selected = selectedId ? entries.find((entry) => entry.id === selectedId) : null;
  if (selected) return <HistoryDetail entry={selected} onBack={onBack} />;
  return <View style={styles.content}><Text style={styles.question}>History</Text><Text style={styles.summary}>Every finished fast stays on this device.</Text><Text style={styles.sectionLabel}>RECENT</Text><View style={styles.historyList}>{entries.length === 0 ? <Text style={styles.builderNote}>Your completed fasts will appear here.</Text> : entries.map((entry) => <HistoryRow key={entry.id} date={historyDate(entry.startedAt)} detail={entry.name} onPress={() => onOpenEntry(entry.id)} status={historyStatus(entry)} />)}</View><Text style={styles.builderNote}>History is saved locally, even when the app is closed.</Text></View>;
}

function HistoryDetail({ entry, onBack }: { entry: HistoryItem; onBack: () => void }) {
  const rolling = entry.protocol.repeatCount !== null && entry.protocol.repeatCount > 1;
  return <View style={styles.content}>
    <PressableScale accessibilityRole="button" onPress={onBack}><Text style={styles.closeText}>‹ History</Text></PressableScale>
    <Text style={styles.question}>{entry.name}</Text>
    <Text style={styles.summary}>{historyStatus(entry)} · {historyDateRange(entry.startedAt, entry.endedAt)}</Text>
    <View style={styles.stats}>
      <Stat label="Actual" value={readableDuration(entry.durationMs)} />
      <Stat label="Protocol" value={protocolDetail(entry.protocol)} />
      <Stat label="Started" value={historyDateTime(entry.startedAt)} />
      <Stat label="Ended" value={entry.endedAt ? historyDateTime(entry.endedAt) : '—'} />
      {rolling && <Stat label="Completed cycles" value={`${entry.completedCycles} of ${entry.protocol.repeatCount}`} />}
    </View>
    <Text style={styles.builderNote}>{entry.status === 'completed' ? 'Recorded from the saved start and end time.' : 'Ended early is recorded clearly—without framing it as a failure.'}</Text>
  </View>;
}

function historyStatus(entry: HistoryItem) {
  if (entry.status === 'completed') return 'Completed';
  if (entry.status === 'cancelled') return 'Ended early';
  return 'Ended';
}

function historyDate(timestamp: number) { return new Date(timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); }
function historyDateTime(timestamp: number) { return new Date(timestamp).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }); }
function historyDateRange(startedAt: number, endedAt: number | null) { return endedAt && historyDate(endedAt) !== historyDate(startedAt) ? `${historyDate(startedAt)} – ${historyDate(endedAt)}` : historyDate(startedAt); }

function HistoryRow({ date, detail, onPress, status }: { date: string; detail: string; onPress?: () => void; status: string }) {
  return <PressableScale accessibilityRole={onPress ? 'button' : undefined} onPress={onPress} style={styles.historyRow}><View><Text style={styles.planName}>{detail}</Text><Text style={styles.planDetail}>{date}</Text></View><View style={styles.historyStatus}><Text style={styles.planDetail}>{status}</Text>{onPress && <Text style={styles.rowAdornment}>›</Text>}</View></PressableScale>;
}

function SettingsScreen({ darkMode, onBackToSettings, onClose, onOpenSafety, onToggleDarkMode, view }: { darkMode: boolean; onBackToSettings: () => void; onClose: () => void; onOpenSafety: () => void; onToggleDarkMode: () => void; view: 'settings' | 'safety' }) {
  if (view === 'safety') return <SafetyScreen onBack={onBackToSettings} onClose={onClose} />;
  return <View style={styles.settingsContent}>
    <PressableScale accessibilityRole="button" onPress={onClose}><Text style={styles.closeText}>✕ Close</Text></PressableScale>
    <Text style={styles.question}>Settings</Text>
    <Text style={styles.sectionLabel}>APPEARANCE</Text>
    <View style={styles.stats}><PressableScale accessibilityLabel="Toggle dark mode" accessibilityRole="button" onPress={onToggleDarkMode} style={styles.stat}><Text style={styles.planName}>Dark mode</Text><View style={[styles.toggle, darkMode && styles.toggleOn]}><View style={[styles.toggleKnob, darkMode && styles.toggleKnobOn]} /></View></PressableScale></View>
    <Text style={styles.sectionLabel}>ABOUT</Text>
    <View style={styles.stats}><PressableScale accessibilityLabel="Open about and safety" accessibilityRole="button" onPress={onOpenSafety} style={styles.stat}><Text style={styles.planName}>About & safety</Text><Text style={styles.rowAdornment}>›</Text></PressableScale><Stat label="Version" value="1.0.0" /></View>
    <Text style={styles.builderNote}>Your theme choice is saved on this device.</Text>
  </View>;
}

function SafetyScreen({ onBack, onClose }: { onBack: () => void; onClose: () => void }) {
  return <ScrollView contentContainerStyle={styles.safetyContent} showsVerticalScrollIndicator={false}>
    <PressableScale accessibilityRole="button" onPress={onBack}><Text style={styles.closeText}>‹ Settings</Text></PressableScale>
    <Text style={styles.question}>About & safety</Text>
    <Text style={styles.safetyLead}>Fasting is a personal wellness practice. This app tracks time; it does not provide medical advice.</Text>
    <SafetySection title="Before you fast">Talk with a qualified healthcare professional first if you are pregnant or breastfeeding, under 18, have a history of disordered eating, diabetes, or take medicine that affects blood sugar, blood pressure, or hydration.</SafetySection>
    <SafetySection title="Listen to your body">End your fast and seek medical help if you feel faint, confused, unwell, or have concerning symptoms.</SafetySection>
    <SafetySection title="How this timer works">A target time is not a recommendation. Your timer keeps going until you choose to end the phase.</SafetySection>
    <SafetySection title="Your data">Fasting history and preferences stay on this device. Notifications are optional.</SafetySection>
    <Text style={styles.builderNote}>Designed for adults who choose to fast. Not medical advice.</Text>
    <SecondaryButton label="Close" onPress={onClose} />
  </ScrollView>;
}

function SafetySection({ children, title }: PropsWithChildren<{ title: string }>) { return <View style={styles.safetySection}><Text style={styles.sectionLabel}>{title.toUpperCase()}</Text><Text style={styles.safetyBody}>{children}</Text></View>; }

function StateLabel({ children, colour }: PropsWithChildren<{ colour: string }>) { return <Text style={[styles.stateLabel, { color: colour }]}>{children}</Text>; }
function readableDuration(milliseconds: number) { const minutes = Math.floor(Math.abs(milliseconds) / 60000); const hours = Math.floor(minutes / 60); return hours > 0 ? `${hours}h ${minutes % 60}m` : `${minutes}m`; }
function timeOfDay(timestamp: number) { return new Date(timestamp).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }); }
function Timer({ primary, secondary }: { primary: string; secondary: string }) { return <Text style={styles.timer}>{primary}<Text style={styles.timerSeconds}>{secondary}</Text></Text>; }
function ProgressBar({ colour, value }: { colour: string; value: `${number}%` }) { return <View style={styles.progressTrack}><View style={[styles.progressValue, { backgroundColor: colour, width: value }]} /></View>; }
function PlanDetail({ onPress, text }: { onPress: () => void; text: string }) { return <PressableScale accessibilityRole="button" onPress={onPress} style={styles.planDetailCard}><Text style={styles.cardText}>{text}</Text><Text style={styles.planDetail}>Plan details ›</Text></PressableScale>; }
function PartnerCard({ detail, name, status, statusColour }: { detail: string; name: string; status: string; statusColour: string }) { return <View style={styles.partnerCard}><View style={styles.partnerAvatar} /><View><Text style={styles.planName}>{name}</Text><Text style={styles.partnerDetail}><Text style={{ color: statusColour }}>{status}</Text> · {detail}</Text></View></View>; }
function Stat({ label, value }: { label: string; value: string }) { return <View style={styles.stat}><Text style={styles.planName}>{label}</Text><Text style={styles.planDetail}>{value}</Text></View>; }
function PrimaryButton({ disabled = false, label, onPress }: { disabled?: boolean; label: string; onPress?: () => void }) { return <PressableScale accessibilityRole="button" disabled={disabled} onPress={onPress} style={[styles.primaryButton, disabled && styles.primaryButtonDisabled]}><Text style={[styles.primaryText, disabled && styles.primaryTextDisabled]}>{label}</Text></PressableScale>; }
function SecondaryButton({ label, onPress }: { label: string; onPress?: () => void }) { return <PressableScale accessibilityRole="button" onPress={onPress} style={styles.secondaryButton}><Text style={styles.secondaryText}>{label}</Text></PressableScale>; }
function DangerButton({ label, onPress }: { label: string; onPress?: () => void }) { return <PressableScale accessibilityRole="button" onPress={onPress} style={styles.dangerButton}><Text style={styles.dangerText}>{label}</Text></PressableScale>; }

function PressableScale({ children, disabled = false, onPress, style, ...props }: PropsWithChildren<{ accessibilityLabel?: string; accessibilityRole?: 'button'; disabled?: boolean; onPress?: () => void; style?: object }>) {
  const scale = useRef(new Animated.Value(1)).current;
  const animate = (toValue: number, duration: number) => Animated.timing(scale, { toValue, duration, useNativeDriver: true }).start();
  return <Pressable {...props} disabled={disabled} onPress={onPress} onPressIn={() => { if (!disabled) animate(motion.pressedScale, motion.pressIn); }} onPressOut={() => { if (!disabled) animate(1, motion.pressOut); }}><Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View></Pressable>;
}

function BottomTabs({ activeTab, onSelect }: { activeTab: AppTab; onSelect: (tab: AppTab) => void }) { return <View style={styles.tabs}>{(['today', 'history'] as AppTab[]).map((tab) => <PressableScale accessibilityLabel={`Open ${tab}`} key={tab} onPress={() => onSelect(tab)}><Text style={activeTab === tab ? styles.activeTab : styles.tab}>{tab === 'today' ? 'Today' : 'History'}</Text></PressableScale>)}</View>; }

function createStyles() { return StyleSheet.create({
  safeArea: { backgroundColor: palette.surface, flex: 1 }, refeedCanvas: { backgroundColor: palette.canvas }, screen: { flex: 1, paddingHorizontal: 20 },
  header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', paddingBottom: 20, paddingTop: 8 }, time: { color: palette.subtle, fontSize: 12 }, settingsLink: { alignItems: 'center', flexDirection: 'row', gap: 8 }, avatar: { borderColor: palette.subtle, borderRadius: 99, borderStyle: 'dashed', borderWidth: 1.5, height: 36, width: 36 }, settingsButton: { alignItems: 'center', borderColor: palette.ink, borderRadius: 99, borderWidth: 1.5, height: 40, justifyContent: 'center', width: 40 }, settingsIcon: { height: 18, position: 'relative', width: 18 }, settingLine: { backgroundColor: palette.ink, height: 1.5, left: 0, position: 'absolute', right: 0 }, settingLineOne: { top: 2 }, settingLineTwo: { top: 8 }, settingLineThree: { top: 14 }, settingDot: { backgroundColor: palette.surface, borderColor: palette.ink, borderRadius: 4, borderWidth: 1.5, height: 7, position: 'absolute', width: 7 }, settingDotOne: { right: 2, top: -1 }, settingDotTwo: { left: 3, top: 5 }, settingDotThree: { right: 5, top: 11 },
  content: { flex: 1, gap: 14 }, settingsContent: { flex: 1, gap: 16 }, safetyContent: { gap: 20, paddingBottom: 28 }, safetyLead: { color: palette.muted, fontSize: 16, lineHeight: 23 }, safetySection: { borderTopColor: palette.divider, borderTopWidth: 1, gap: 7, paddingTop: 14 }, safetyBody: { color: palette.ink, fontSize: 16, lineHeight: 23 }, question: { color: palette.ink, fontSize: 28, fontWeight: '600', letterSpacing: -0.5, lineHeight: 33 }, stateLabel: { fontSize: 13, fontWeight: '600', letterSpacing: 2.1, marginTop: 2 },
  planList: { borderTopColor: palette.divider, borderTopWidth: 1 }, planRow: { alignItems: 'center', borderBottomColor: palette.divider, borderBottomWidth: 1, flexDirection: 'row', justifyContent: 'space-between', minHeight: 66, paddingHorizontal: 2, paddingVertical: 10 }, selectedPlan: { backgroundColor: palette.canvas, paddingHorizontal: 10 }, planName: { color: palette.ink, fontSize: 16 }, planDetail: { color: palette.subtle, fontSize: 13, marginTop: 3 }, rowAdornment: { color: palette.subtle, fontSize: 21 }, selectedAdornment: { color: palette.accent }, starting: { color: palette.subtle, fontSize: 14, lineHeight: 20 }, quietAction: { color: palette.muted, fontSize: 15, paddingVertical: 8, textAlign: 'center' },
  primaryButton: { alignItems: 'center', backgroundColor: palette.ink, borderRadius: 999, justifyContent: 'center', minHeight: 54, paddingHorizontal: 20 }, primaryButtonDisabled: { backgroundColor: palette.divider }, primaryText: { color: palette.surface, fontSize: 17, fontWeight: '600' }, primaryTextDisabled: { color: palette.muted }, secondaryButton: { alignItems: 'center', borderColor: palette.ink, borderRadius: 999, borderWidth: 1.5, justifyContent: 'center', minHeight: 52, paddingHorizontal: 20 }, secondaryText: { color: palette.ink, fontSize: 16, fontWeight: '500' }, dangerButton: { alignItems: 'center', borderColor: palette.danger, borderRadius: 999, borderStyle: 'dashed', borderWidth: 1.5, justifyContent: 'center', minHeight: 48, paddingHorizontal: 20 }, dangerText: { color: palette.danger, fontSize: 15, fontWeight: '500' },
  timerTapTarget: { alignSelf: 'flex-start' }, timer: { color: palette.ink, fontSize: 52, fontVariant: ['tabular-nums'], letterSpacing: -1.6, lineHeight: 56 }, timerSeconds: { color: palette.subtle, fontSize: 26, letterSpacing: -0.5 }, summary: { color: palette.muted, fontSize: 16, lineHeight: 22, marginTop: -6 }, progressTrack: { backgroundColor: palette.divider, borderRadius: 99, height: 10, overflow: 'hidden' }, progressValue: { borderRadius: 99, height: '100%' },
  planDetailCard: { alignItems: 'center', borderColor: palette.divider, borderRadius: 16, borderStyle: 'dashed', borderWidth: 1.5, flexDirection: 'row', justifyContent: 'space-between', minHeight: 58, paddingHorizontal: 14 }, cardText: { color: palette.ink, fontSize: 15 }, partnerCard: { alignItems: 'center', borderColor: palette.divider, borderRadius: 16, borderWidth: 1, flexDirection: 'row', gap: 10, padding: 12 }, partnerAvatar: { backgroundColor: palette.canvas, borderRadius: 99, height: 36, width: 36 }, partnerDetail: { color: palette.muted, fontSize: 14, marginTop: 3 },
  stats: { borderTopColor: palette.divider, borderTopWidth: 1 }, stat: { alignItems: 'center', borderBottomColor: palette.divider, borderBottomWidth: 1, flexDirection: 'row', justifyContent: 'space-between', minHeight: 53 }, tabs: { borderTopColor: palette.ink, borderTopWidth: 1, flexDirection: 'row', justifyContent: 'space-around', marginTop: 12, paddingBottom: 12, paddingTop: 12 }, tab: { color: palette.subtle, fontSize: 14 }, activeTab: { color: palette.ink, fontSize: 14, fontWeight: '600' },
  builder: { flex: 1, gap: 24, paddingTop: 12 }, builderHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' }, closeText: { color: palette.subtle, fontSize: 13 }, builderTitle: { color: palette.subtle, fontSize: 13 }, choiceGroup: { gap: 8 }, choiceLabel: { color: palette.subtle, fontSize: 14 }, choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, choice: { borderColor: palette.ink, borderRadius: 999, borderWidth: 1.5, paddingHorizontal: 14, paddingVertical: 10 }, selectedChoice: { backgroundColor: palette.accent, borderColor: palette.accent }, choiceText: { color: palette.ink, fontSize: 15 }, selectedChoiceText: { color: palette.surface, fontWeight: '600' }, customInputGroup: { gap: 6, marginTop: -12 }, inputLabel: { color: palette.ink, fontSize: 14, fontWeight: '500' }, numberInput: { alignItems: 'center', borderColor: palette.divider, borderRadius: 14, borderStyle: 'dashed', borderWidth: 1.5, flexDirection: 'row', minHeight: 52, paddingHorizontal: 14 }, numberInputInvalid: { borderColor: palette.danger }, numberInputText: { color: palette.ink, flex: 1, fontSize: 16, paddingVertical: 9 }, inputUnit: { color: palette.muted, fontSize: 15, marginLeft: 12 }, inputHint: { color: palette.subtle, fontSize: 13, lineHeight: 18 }, inputHintInvalid: { color: palette.danger }, protocolCard: { alignItems: 'center', borderColor: palette.ink, borderRadius: 16, borderStyle: 'dashed', borderWidth: 1.5, gap: 5, padding: 14 }, protocol: { color: palette.ink, fontSize: 16 }, protocolDetail: { color: palette.muted, fontSize: 14 }, builderNote: { color: palette.subtle, fontSize: 14, lineHeight: 20 },
  largeAvatar: { backgroundColor: palette.canvas, borderRadius: 99, height: 64, marginTop: 6, width: 64 }, inviteCode: { alignItems: 'center', borderColor: palette.ink, borderRadius: 16, borderStyle: 'dashed', borderWidth: 2, gap: 6, padding: 18 }, code: { color: palette.ink, fontSize: 34, letterSpacing: 4 }, dividerNote: { borderTopColor: palette.divider, borderTopWidth: 1, color: palette.subtle, fontSize: 14, lineHeight: 20, paddingTop: 12 }, selectedProtocol: { borderColor: palette.accent, backgroundColor: palette.canvas, borderRadius: 16, borderWidth: 1.5, gap: 5, padding: 14 }, ownProtocol: { borderColor: palette.ink, borderRadius: 16, borderWidth: 1.5, gap: 5, padding: 14 }, pairedNotice: { backgroundColor: palette.surface, borderColor: palette.success, borderRadius: 16, borderWidth: 1.5, gap: 5, padding: 14 },
  modalOverlay: { flex: 1, justifyContent: 'flex-end' }, scrim: { backgroundColor: 'rgba(26,26,26,0.36)', bottom: 0, left: 0, position: 'absolute', right: 0, top: 0 }, sheet: { backgroundColor: palette.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, gap: 14, paddingBottom: 28, paddingHorizontal: 20, paddingTop: 10 }, handle: { alignSelf: 'center', backgroundColor: palette.divider, borderRadius: 99, height: 4, width: 40 }, sheetContent: { gap: 14 }, sheetTitle: { color: palette.ink, fontSize: 24, fontWeight: '600', letterSpacing: -0.3 }, reactions: { flexDirection: 'row', gap: 10, justifyContent: 'space-between' }, reaction: { alignItems: 'center', borderColor: palette.divider, borderRadius: 99, borderWidth: 1.5, height: 52, justifyContent: 'center', width: 52 }, selectedReaction: { backgroundColor: palette.canvas, borderColor: palette.accent }, reactionText: { fontSize: 22 }, rolloverNotice: { backgroundColor: palette.surface, borderColor: palette.success, borderRadius: 16, borderStyle: 'dashed', borderWidth: 1.5, gap: 4, padding: 12 }, toast: { alignSelf: 'center', backgroundColor: palette.ink, borderRadius: 99, bottom: 82, paddingHorizontal: 18, paddingVertical: 12, position: 'absolute' }, toastText: { color: palette.surface, fontSize: 14, fontWeight: '500' },
  sectionLabel: { color: palette.subtle, fontSize: 12, fontWeight: '600', letterSpacing: 1.8, marginTop: 6 }, historyList: { borderTopColor: palette.divider, borderTopWidth: 1 }, historyRow: { alignItems: 'center', borderBottomColor: palette.divider, borderBottomWidth: 1, flexDirection: 'row', justifyContent: 'space-between', minHeight: 64, paddingVertical: 9 }, historyStatus: { alignItems: 'center', flexDirection: 'row', gap: 5, maxWidth: '48%' }, toggle: { backgroundColor: palette.divider, borderRadius: 99, height: 24, justifyContent: 'center', padding: 3, width: 42 }, toggleOn: { backgroundColor: palette.ink }, toggleKnob: { backgroundColor: palette.surface, borderRadius: 99, height: 18, width: 18 }, toggleKnobOn: { alignSelf: 'flex-end' },
  themeOverlay: { alignItems: 'flex-end', flex: 1, paddingRight: 20, paddingTop: 72 }, themePicker: { backgroundColor: palette.surface, borderColor: palette.ink, borderRadius: 18, borderWidth: 1.5, elevation: 8, gap: 5, padding: 14, width: 210, zIndex: 1 }, themeTitle: { color: palette.ink, fontSize: 17, fontWeight: '600' }, themeCopy: { color: palette.muted, fontSize: 13, lineHeight: 18, marginBottom: 5 }, themeOption: { alignItems: 'center', borderRadius: 10, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 10, paddingVertical: 11 }, themeOptionSelected: { backgroundColor: palette.canvas },
});
}

styles = createStyles();
