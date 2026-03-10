/**
 * =====================================================================
 *  OKY — Period Tracker  (Expo Go)
 *  Splash → Login / SignUp → Welcome → Main
 * =====================================================================
 *  📸  ./assets/village.png   background
 *  🧒  ./assets/aria.jpg      avatar
 * =====================================================================
 */
import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View, Text, StyleSheet, Dimensions, TouchableOpacity,
  ScrollView, Animated, Modal, Platform, StatusBar,
  Easing, ImageBackground, PanResponder, TextInput,
  KeyboardAvoidingView, Image,
} from 'react-native';

const { width: W, height: H } = Dimensions.get('window');

// ── Palette ────────────────────────────────────────────────────────────────
const C = {
  sky:        '#D6EEFF',
  period:     '#E91E8C',
  fertile:    '#26C6DA',
  ovulation:  '#FF7043',
  text:       '#2C3E50',
  sub:        '#7F8C8D',
};

const MONTH_S = ['1-р','2-р','3-р','4-р','5-р','6-р','7-р','8-р','9-р','10-р','11-р','12-р'];
const MONTH_F = ['1-р сар','2-р сар','3-р сар','4-р сар','5-р сар','6-р сар',
                 '7-р сар','8-р сар','9-р сар','10-р сар','11-р сар','12-р сар'];

const PASTEL = [
  '#FFD6E8','#FFE4D6','#FFF5CC','#D6F5E0',
  '#CCF0F8','#E8D6FF','#FFE8CC','#CCF0E8',
  '#F5E0CC','#CCE8F5','#F5CCE0','#E0CCF5',
];

function daysInMonth(y,m){ return new Date(y,m+1,0).getDate(); }

function dayInCycle(date,pS,cL){
  const d=Math.floor((date-pS)/86400000);
  return ((d%cL)+cL)%cL;
}

function phaseOf(dic,cLen){
  if(dic<5)               return {icon:'🩸',label:'Сарын тэмдэг',        color:'#E91E8C',bg:'#FFD6E8'};
  if(dic>=13&&dic<=14)    return {icon:'⭐',label:'Ovulation', color:'#FF7043',bg:'#FFE5CC'};
  if(dic>=11&&dic<=16)    return {icon:'🌿',label:'Үр тогтох магадлалтай үе',color:'#26C6DA',bg:'#CCF5F8'};
  if(dic>=cLen-7)         return {icon:'🌙',label:'Лютейн үе',           color:'#9B59B6',bg:'#EDE0FF'};
  return                         {icon:'✨',label:'Энгийн өдөр',         color:'#607D8B',bg:'#EEF3F7'};
}

function gondolaBg(dic,idx){
  if(dic<5)              return '#FFD6E0';
  if(dic>=13&&dic<=14)   return '#FFE5CC';
  if(dic>=11&&dic<=16)   return '#CCF4F9';
  if(dic>=21)            return '#EDE0FF';
  return PASTEL[idx%PASTEL.length];
}

function dateKey(date){ return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`; }

const MOODS=[
  {key:'happy',     emoji:'😊',label:'Баяртай',        color:'#66BB6A'},
  {key:'loving',    emoji:'🩷',label:'Хайртай',        color:'#EC407A'},
  {key:'calm',      emoji:'🧘',label:'Тайван',         color:'#26C6DA'},
  {key:'tired',     emoji:'😴',label:'Ядарсан',        color:'#90A4AE'},
  {key:'anxious',   emoji:'😰',label:'Түгшсэн',        color:'#FFA726'},
  {key:'sad',       emoji:'😢',label:'Гунигтай',       color:'#7E57C2'},
  {key:'angry',     emoji:'😠',label:'Ууртай',         color:'#EF5350'},
  {key:'energetic', emoji:'⚡',label:'Эрч хүчтэй',     color:'#29B6F6'},
];

// ═══════════════════════════════════════════════════════════════════════════
//  RIGHT-SIDE ARC WHEEL
//
//  Hub center is OFF the RIGHT edge of the screen.
//  Only the LEFT ~1/3 arc is visible — a smooth curve on the right side of screen.
//  Items travel up/down along this arc.
//  Drag UP/DOWN to spin. Focus item = closest to 180° (leftmost point).
//
//  Geometry: hub at (W*1.20, H*0.50)
//    RX = W*1.05 (wider to make oval more horizontal)
//    RY = H*0.32 (smaller vertical radius for tighter spacing)
// ═══════════════════════════════════════════════════════════════════════════
const OV_CX = W * 1.35;   // hub X — further right
const OV_CY = H * 0.50;   // hub Y — mid screen
const OV_RX = W * 1.15;   // horizontal radius — wider for more right-side visibility
const OV_RY = H * 0.32;   // vertical radius — controls vertical spacing
const GW    = 56;         // gondola width — smaller
const GH    = 48;         // gondola height — smaller

function EllipseWheel({ year, month, pStart, cLen, daysLeft, dayData, onDayTap, onMonthPress, cardOpen }) {
  const totalDays = daysInMonth(year, month);
  const GDEG      = 360 / totalDays;
  const today     = new Date();
  const todayDay  = (year===today.getFullYear()&&month===today.getMonth()) ? today.getDate() : -1;

  const angleRef  = useRef(0);
  const velRef    = useRef(0);
  const lastYRef  = useRef(0);
  const rafRef    = useRef(null);
  const [angle, setAngle] = useState(0);

  // Init: today lands at 180° (leftmost visible point)
  useEffect(()=>{
    const init = 180 - (todayDay > 0 ? (todayDay-1) : 0) * GDEG;
    angleRef.current = init;
    setAngle(init);
    velRef.current = 0;
  },[year, month, totalDays]);

  function stop(){ if(rafRef.current){ cancelAnimationFrame(rafRef.current); rafRef.current=null; } }

  function snapNearest(){
    stop();
    const snapped = Math.round(angleRef.current / GDEG) * GDEG;
    const diff    = snapped - angleRef.current;
    if(Math.abs(diff) < 0.04){ angleRef.current = snapped; setAngle(snapped); return; }
    const frames = Math.max(10, Math.abs(diff) * 0.5 | 0);
    let t = 0; const from = angleRef.current;
    const go = () => {
      t++;
      angleRef.current = from + diff * (1 - Math.pow(1 - t/frames, 3));
      setAngle(angleRef.current);
      if(t < frames) rafRef.current = requestAnimationFrame(go);
      else { angleRef.current = snapped; setAngle(snapped); }
    };
    rafRef.current = requestAnimationFrame(go);
  }

  function momentum(){
    stop();
    const go = () => {
      if(Math.abs(velRef.current) < 0.12){ velRef.current = 0; snapNearest(); return; }
      angleRef.current += velRef.current;
      velRef.current   *= 0.91;
      setAngle(angleRef.current);
      rafRef.current = requestAnimationFrame(go);
    };
    rafRef.current = requestAnimationFrame(go);
  }

  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder:  () => true,
    onPanResponderGrant: () => { stop(); velRef.current = 0; lastYRef.current = 0; },
    onPanResponderMove: (_, gs) => {
      const dy = gs.dy - lastYRef.current;
      lastYRef.current = gs.dy;
      const delta = dy * 0.5;
      velRef.current    = delta;
      angleRef.current += delta;
      setAngle(angleRef.current);
    },
    onPanResponderRelease: () => { lastYRef.current = 0; momentum(); },
  })).current;

  const items = useMemo(() => {
    return Array.from({length: totalDays}, (_, i) => {
      const deg = angle + i * GDEG;
      const rad = deg * Math.PI / 180;
      const gx  = OV_CX + OV_RX * Math.cos(rad);
      const gy  = OV_CY + OV_RY * Math.sin(rad);
      const day  = i + 1;
      const date = new Date(year, month, day);
      const dic  = dayInCycle(date, pStart, cLen);
      const bg   = gondolaBg(dic, i);
      const isToday = day === todayDay;

      // Focus = item closest to 180° (leftmost point of arc)
      const normDeg = ((deg % 360) + 360) % 360;
      const distFrom180 = Math.min(Math.abs(normDeg - 180), 360 - Math.abs(normDeg - 180));
      const isFocus = distFrom180 < GDEG * 0.55;

      const moodEmoji = dayData[dateKey(date)]?.mood
        ? MOODS.find(m => m.key === dayData[dateKey(date)].mood)?.emoji : null;

      // Only render items on left arc (visible on screen)
      const visible = gx < W + GW && gx > -GW;
      return { i, deg, gx, gy, day, date, bg, isToday, isFocus, moodEmoji, visible, dic };
    });
  }, [angle, year, month, pStart, cLen, totalDays, todayDay, dayData]);

  // Month button: at the leftmost point of the oval (180°)
  const monthBtnX = OV_CX - OV_RX;  // = W*1.15 - W*0.95 = W*0.20
  const monthBtnY = OV_CY;           // = H*0.44

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* Drag zone — zIndex 2, BEHIND gondolas so gondola taps still fire */}
      <View {...pan.panHandlers} style={{
        position:'absolute', left:0, top:0, width:W, height:H*0.85, zIndex:2,
      }} pointerEvents="box-only"/>

      {/* Gondolas — zIndex 12+ so they sit ABOVE drag zone */}
      {items.filter(it => it.visible).map(({i,gx,gy,day,date,bg,isToday,isFocus,moodEmoji,dic}) => {
        const sz  = isFocus ? GW + 14 : GW;
        const szH = isFocus ? GH + 14 : GH;
        const ph  = phaseOf(dic, cLen);
        return (
          <TouchableOpacity key={`g${i}`} onPress={() => onDayTap(date, day, gx, gy)}
            style={{
              position:'absolute',
              left: gx - sz/2,
              top:  gy - szH/2,
              width: sz, height: szH,
              zIndex: isFocus ? 20 : 12,
            }} activeOpacity={0.75}>
            <View style={{
              flex:1, borderRadius:18,
              backgroundColor: isFocus ? ph.bg : bg,
              borderWidth: isFocus ? 3 : isToday ? 2 : 0,
              borderColor:  isFocus ? 'rgba(255,255,255,0.95)' : isToday ? '#FFEE58' : 'transparent',
              shadowColor:'#000', shadowOpacity: isFocus ? 0.22 : 0.07,
              shadowRadius: isFocus ? 12 : 3, elevation: isFocus ? 14 : 4,
              alignItems:'center', justifyContent:'center',
            }}>
              <Text style={{
                color: isFocus ? ph.color : '#3D4A54',
                fontWeight:'900',
                fontSize: isFocus ? 28 : 17,
              }}>{day}</Text>
              {moodEmoji && (
                <Text style={{fontSize: isFocus ? 14:10, lineHeight: isFocus ? 17:13, marginTop:1}}>
                  {moodEmoji}
                </Text>
              )}
              {isToday && (
                <View style={{position:'absolute',top:-7,right:-5,backgroundColor:'#FFEE58',
                  borderRadius:4,paddingHorizontal:3,paddingVertical:1}}>
                  <Text style={{fontSize:5.5,fontWeight:'900',color:'#333'}}>NOW</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        );
      })}

      {/* Connector lines from month circle to all visible days */}
      {!cardOpen && items.filter(it => it.visible).map(day => {
        const monthCircleCenterX = W - 60;
        const monthCircleCenterY = H / 2;
        const dayX = day.gx;
        const dayY = day.gy;
        const dx = dayX - monthCircleCenterX;
        const dy = dayY - monthCircleCenterY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx) * 180 / Math.PI;
        return (
          <View key={`line${day.i}`} style={{
            position:'absolute',
            left: monthCircleCenterX,
            top: monthCircleCenterY,
            width: distance,
            height: 1.5,
            backgroundColor: C.period,
            opacity: day.isFocus ? 0.6 : 0.15,
            transform: [{rotate: `${angle}deg`}],
            transformOrigin: '0 50%',
            zIndex: day.isFocus ? 18 : 11,
          }}/>
        );
      })}

      {/* Month button — right side middle, hidden when card open */}
      {!cardOpen && (
        <TouchableOpacity onPress={onMonthPress} style={{
          position:'absolute',
          right: 14, top: H/2 - 46,
          width:92, height:92, borderRadius:46,
          backgroundColor:'rgba(255,255,255,0.98)',
          borderWidth:2.5, borderColor:C.period,
          alignItems:'center', justifyContent:'center',
          shadowColor:C.period, shadowOpacity:0.35, shadowRadius:18, elevation:20,
          zIndex:25,
        }}>
          <Text style={{fontSize:18,fontWeight:'900',color:C.period}}>{MONTH_S[month]}</Text>
          <Text style={{fontSize:11,color:C.sub,fontWeight:'600',marginTop:2}}>{year}</Text>
          <Text style={{fontSize:8,color:'rgba(233,30,140,0.5)',fontWeight:'700',marginTop:1}}>tap ▾</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  MONTH PICKER MODAL
// ═══════════════════════════════════════════════════════════════════════════
function MonthPicker({ visible, onClose, viewMonth, viewYear, onChange }) {
  const [selY, setSelY] = useState(viewYear);
  if(!visible) return null;
  const years = [viewYear-1, viewYear, viewYear+1];
  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={{flex:1,backgroundColor:'rgba(0,0,0,0.38)',justifyContent:'center',alignItems:'center'}}
        activeOpacity={1} onPress={onClose}>
        <View style={{backgroundColor:'#fff',borderRadius:24,padding:22,width:W*0.84,
          shadowColor:'#000',shadowOpacity:0.2,shadowRadius:18,elevation:12}}
          onStartShouldSetResponder={()=>true}>
          <Text style={{fontSize:17,fontWeight:'900',color:C.period,textAlign:'center',marginBottom:14}}>📅 Select Month</Text>
          <View style={{flexDirection:'row',justifyContent:'center',gap:8,marginBottom:16}}>
            {years.map(y=>(
              <TouchableOpacity key={y} onPress={()=>setSelY(y)}
                style={{paddingHorizontal:18,paddingVertical:8,borderRadius:20,
                  backgroundColor:selY===y?C.period:'rgba(0,0,0,0.07)'}}>
                <Text style={{color:selY===y?'#fff':C.text,fontWeight:'700',fontSize:14}}>{y}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={{flexDirection:'row',flexWrap:'wrap',gap:7,justifyContent:'center'}}>
            {MONTH_S.map((m,i)=>{
              const sel=i===viewMonth&&selY===viewYear;
              return (
                <TouchableOpacity key={m} onPress={()=>{onChange(i,selY);onClose();}}
                  style={{width:'22%',paddingVertical:10,borderRadius:12,alignItems:'center',
                    backgroundColor:sel?C.period:'#F5F5F5'}}>
                  <Text style={{fontSize:13,fontWeight:'700',color:sel?'#fff':C.text}}>{m}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  DAY CARD — full screen view with all sections
// ═══════════════════════════════════════════════════════════════════════════
function DayCard({ date, day, fromX, fromY, pStart, cLen, dayData, onSave, onClose }) {
  const scaleA  = useRef(new Animated.Value(0.05)).current;
  const opacA   = useRef(new Animated.Value(0)).current;
  const txA     = useRef(new Animated.Value((fromX||W/2)-W/2)).current;
  const tyA     = useRef(new Animated.Value((fromY||H/2)-H/2)).current;

  const [noteText, setNote] = useState('');
  const [todos,    setTodos]= useState([]);
  const [todoInput,setTIn]  = useState('');
  const [selMood,  setMood] = useState(null);

  const dk = date ? dateKey(date) : '';

  useEffect(()=>{
    if(!date) return;
    const s=dayData[dk]||{};
    setNote(s.text||''); setTodos(s.todos||[]); setMood(s.mood||null);
    scaleA.setValue(0.05); opacA.setValue(0);
    txA.setValue((fromX||W/2)-W/2); tyA.setValue((fromY||H/2)-H/2);
    Animated.parallel([
      Animated.spring(scaleA,{toValue:1,friction:7,tension:85,useNativeDriver:true}),
      Animated.timing(opacA, {toValue:1,duration:120,useNativeDriver:true}),
      Animated.spring(txA,   {toValue:0,friction:7,tension:85,useNativeDriver:true}),
      Animated.spring(tyA,   {toValue:0,friction:7,tension:85,useNativeDriver:true}),
    ]).start();
  },[dk]);

  function closeAnim(cb){
    Animated.parallel([
      Animated.timing(scaleA,{toValue:0.05,duration:160,useNativeDriver:true}),
      Animated.timing(opacA, {toValue:0,   duration:140,useNativeDriver:true}),
    ]).start(cb);
  }

  function persist(text,tds,mood){
    onSave(dk,{text,todos:tds,mood:mood!==undefined?mood:selMood});
  }
  function pickMood(key){ setMood(key); persist(noteText,todos,key); }
  function addTodo(){
    if(!todoInput.trim()) return;
    const u=[...todos,{id:Date.now(),text:todoInput.trim(),done:false}];
    setTodos(u); setTIn(''); persist(noteText,u,selMood);
  }
  function toggleTodo(id){
    const u=todos.map(t=>t.id===id?{...t,done:!t.done}:t);
    setTodos(u); persist(noteText,u,selMood);
  }
  function delTodo(id){
    const u=todos.filter(t=>t.id!==id);
    setTodos(u); persist(noteText,u,selMood);
  }

  if(!date) return null;
  const dic   = dayInCycle(date,pStart,cLen);
  const phase = phaseOf(dic,cLen);
  const curMood = selMood ? MOODS.find(m=>m.key===selMood) : null;

  const TIPS={
  'Period': [
    '💧 Ус сайн уугаарай — гэдэс дүүрэхийг багасгана.',
    '🛁 Бүлээн ванн эсвэл халуун жин базлалт намдаана.',
    '🍫 Хар шоколад дуршлыг багасгахад тусалдаг.',
    '😴 Амрах нь чухал — өнөөдөр биеэ хайрлаарай.'
  ],

  'Fertile Window': [
    '🌸 Эрч хүч өндөр байдаг — дасгал хийхэд тохиромжтой.',
    '🥗 Төмрөөр баялаг хоол идээрэй.',
    '🌿 Эстроген ихсэхэд сэтгэл санаа илүү сайжирдаг.',
    '💬 Энэ үед хүмүүстэй харилцах илүү амар санагддаг.'
  ],

  'Ovulation': [
    '⭐ Үр тогтох хамгийн өндөр магадлалтай өдөр.',
    '🏃 Илүү идэвхтэй дасгал хийхэд тохиромжтой үе.',
    '🧠 Ой тогтоолт, төвлөрөл сайн байдаг.',
    '💛 Шинэ санаа, бүтээлч ажил эхлэхэд тохиромжтой.'
  ],

  'Luteal Phase': [
    '🌙 Прогестерон нэмэгдэж ядаргаа мэдрэгдэж болно.',
    '🍵 Ургамлын цай (ромашка, цагаан гаа) PMS-д тусална.',
    '📓 Тэмдэглэл бичих нь сэтгэл санааг тайвшруулдаг.',
    '🧘 Хөнгөн йог илүү тохиромжтой.'
  ],

  'Regular Day': [
    '✨ Тайван үе — шинэ дадал хэвшил эхлүүлэхэд тохиромжтой.',
    '💪 Тогтмол унтах нь дааврын тэнцвэрт тусалдаг.',
    '🥦 Тэнцвэртэй хооллолт бүх мөчлөгт хэрэгтэй.',
    '🌟 Өнөөдрийн биеийн өөрчлөлтөө тэмдэглэж аваарай.'
  ],
};

const tips = TIPS[phase.label] || TIPS['Regular Day'];
  return (
    <Modal
      transparent
      visible={true}
      animationType="none"
      onRequestClose={() => closeAnim(onClose)}
      statusBarTranslucent
    >
      <View style={dc.overlay}>
        {/* Backdrop — tap outside to close */}
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={() => closeAnim(onClose)}
        />
        {/* Full screen card */}
        <Animated.View style={[dc.cardFull, {
          opacity: opacA,
          transform: [{translateX:txA},{translateY:tyA},{scale:scaleA}],
        }]}>

        {/* Close button */}
        <TouchableOpacity onPress={()=>closeAnim(onClose)} style={dc.closeTopBtn}>
          <Text style={dc.closeBtnIcon}>✕</Text>
        </TouchableOpacity>

        {/* Header */}
        <View style={[dc.headerFull,{backgroundColor:phase.bg,borderBottomColor:phase.color}]}>
          <Text style={[dc.titleFull,{color:phase.color}]}>{MONTH_F[date.getMonth()]} {day}</Text>
          <Text style={dc.phaseLabel}>{phase.icon} {phase.label} · Day {dic+1}/{cLen}</Text>
        </View>

        {/* Scrollable content - full height */}
        <ScrollView style={{flex:1,paddingHorizontal:20,paddingTop:16}} showsVerticalScrollIndicator={true}>
          
          {/* INFO SECTION */}
          <View style={{marginBottom:24}}>
            <Text style={{fontSize:15,fontWeight:'900',color:phase.color,marginBottom:12}}>📋 Phase Info</Text>
            <View style={{flexDirection:'row',alignItems:'center',backgroundColor:phase.bg,borderRadius:14,padding:14,borderLeftWidth:4,borderLeftColor:phase.color,marginBottom:12}}>
              <Text style={{fontSize:36}}>{phase.icon}</Text>
              <View style={{flex:1,marginLeft:12}}>
                <Text style={{fontSize:15,fontWeight:'900',color:phase.color}}>{phase.label}</Text>
                <Text style={{fontSize:12,color:'#888',marginTop:1}}>Day {dic+1} of {cLen}</Text>
              </View>
            </View>
            <Text style={{fontSize:12,fontWeight:'800',color:'#999',marginBottom:8}}>💡 TODAY'S TIPS</Text>
            {tips.map((tip,ti)=>
              <View key={ti} style={{backgroundColor:'#f5f5f5',borderRadius:10,padding:11,borderLeftWidth:3,borderLeftColor:phase.color,marginBottom:8}}>
                <Text style={{fontSize:12,color:'#333',lineHeight:18}}>{tip}</Text>
              </View>
            )}
          </View>

          {/* MOOD SECTION */}
          <View style={{marginBottom:24}}>
            <Text style={{fontSize:15,fontWeight:'900',color:phase.color,marginBottom:12}}>😊 Ямархуу байна вэ?</Text>
            <View style={{flexDirection:'row',flexWrap:'wrap',gap:12,justifyContent:'center',marginBottom:10}}>
              {MOODS.map(m=>{
                const on=selMood===m.key;
                return (
                  <TouchableOpacity key={m.key} onPress={()=>pickMood(m.key)} style={{alignItems:'center'}}>
                    <View style={{width:on?66:56,height:on?66:56,borderRadius:on?33:28,backgroundColor:on?m.color:'#f0f0f0',alignItems:'center',justifyContent:'center',marginBottom:4,borderWidth:3,borderColor:on?m.color:'transparent'}}>
                      <Text style={{fontSize:on?28:22}}>{m.emoji}</Text>
                    </View>
                    <Text style={{fontSize:10,color:on?m.color:'#888',fontWeight:on?'700':'500'}}>{m.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {selMood&&<Text style={{textAlign:'center',fontSize:12,color:'#aaa',fontStyle:'italic'}}>✓ Хадгалагдлаа!</Text>}
          </View>

          {/* NOTES SECTION */}
          <View style={{marginBottom:24}}>
            <Text style={{fontSize:15,fontWeight:'900',color:phase.color,marginBottom:12}}>📝 Тэмдэглэл</Text>
            
            {/* Daily Note */}
            <Text style={{fontSize:11,fontWeight:'800',color:'#999',marginBottom:8}}>📓 Өдрийн тэмдэглэл</Text>
            <View style={{backgroundColor:'#f5f5f5',borderRadius:12,borderWidth:1,borderColor:'#ddd',padding:12,marginBottom:16}}>
              <TextInput
                style={{fontSize:13,color:'#333',lineHeight:20,minHeight:80}}
                placeholder="Write something…"
                placeholderTextColor="#bbb"
                multiline
                textAlignVertical="top"
                value={noteText}
                onChangeText={t=>{setNote(t);persist(t,todos,selMood);}}
              />
            </View>

            {/* Todo List */}
            <Text style={{fontSize:11,fontWeight:'800',color:'#999',marginBottom:8}}>✅ TO-DO LIST</Text>
            <View style={{flexDirection:'row',gap:8,marginBottom:12}}>
              <TextInput
                style={{flex:1,backgroundColor:'#f5f5f5',borderRadius:10,borderWidth:1,borderColor:'#ddd',paddingHorizontal:12,paddingVertical:10,fontSize:13}}
                placeholder="Add a task…"
                placeholderTextColor="#bbb"
                value={todoInput}
                onChangeText={setTIn}
                onSubmitEditing={addTodo}
              />
              <TouchableOpacity onPress={addTodo} style={{width:44,height:44,borderRadius:10,backgroundColor:phase.color,alignItems:'center',justifyContent:'center'}}>
                <Text style={{color:'#fff',fontSize:24,fontWeight:'700'}}>+</Text>
              </TouchableOpacity>
            </View>

            {todos.length===0 ? 
              <Text style={{textAlign:'center',color:'#bbb',fontSize:12,marginVertical:10}}>Одоогоор хийх зүйл алга</Text>
            : 
              todos.map(t=>(
                <View key={t.id} style={{flexDirection:'row',alignItems:'center',paddingVertical:9,paddingHorizontal:8,borderBottomWidth:1,borderBottomColor:'#eee',gap:10}}>
                  <TouchableOpacity onPress={()=>toggleTodo(t.id)} style={{padding:4}}>
                    <View style={{width:20,height:20,borderRadius:5,borderWidth:2,borderColor:'#ddd',backgroundColor:t.done?phase.color:'transparent',borderColor:t.done?phase.color:'#ddd',alignItems:'center',justifyContent:'center'}}>
                      {t.done&&<Text style={{color:'#fff',fontSize:11,fontWeight:'900'}}>✓</Text>}
                    </View>
                  </TouchableOpacity>
                  <Text style={{flex:1,fontSize:13,color:t.done?'#ccc':'#333',fontWeight:'500',textDecorationLine:t.done?'line-through':'none'}}>{t.text}</Text>
                  <TouchableOpacity onPress={()=>delTodo(t.id)} style={{padding:6}}>
                    <Text style={{color:'#f08',fontSize:14}}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))
            }
          </View>

          <View style={{height:40}}/>
        </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const dc=StyleSheet.create({
  overlay:     {flex:1, backgroundColor:'rgba(0,0,0,0.55)',
                alignItems:'center', justifyContent:'flex-start',paddingTop:Platform.OS==='ios'?40:25},
  cardFull:    {width:'98%', height:H*0.92, backgroundColor:'#fff', borderRadius:24,
                overflow:'hidden',
                shadowColor:'#000', shadowOpacity:0.45, shadowRadius:45, elevation:45},
  closeTopBtn: {position:'absolute',top:12,right:14,width:40,height:40,borderRadius:20,
                backgroundColor:'rgba(0,0,0,0.08)',alignItems:'center',justifyContent:'center',zIndex:30},
  closeBtnIcon:{fontSize:24,color:'#2C3E50',fontWeight:'700'},
  headerFull:  {paddingHorizontal:22,paddingTop:18,paddingBottom:16,borderBottomWidth:2,
                alignItems:'center'},
  titleFull:   {fontSize:26,fontWeight:'900',marginBottom:4},
  phaseLabel:  {fontSize:13,color:'#7F8C8D',fontWeight:'600'},
  bodyFull:    {flex:1,paddingHorizontal:20,paddingTop:16},
  section:     {marginBottom:26,paddingBottom:18,borderBottomWidth:1,borderBottomColor:'#F0F0F0'},
  sectionTitle:{fontSize:15,fontWeight:'900',marginBottom:12},
  phaseBadgeFull:{flexDirection:'row',alignItems:'center',borderRadius:16,
                  padding:16,borderLeftWidth:4,marginBottom:14},
  tipsTitle:   {fontSize:13,fontWeight:'800',color:'#7F8C8D',marginTop:14,marginBottom:10},
  tipCardFull: {backgroundColor:'#F9FAFB',borderRadius:12,padding:13,borderLeftWidth:3,marginBottom:8},
  moodBubbleFull:{width:58,height:58,borderRadius:29,alignItems:'center',justifyContent:'center',
                  borderWidth:2.5,borderColor:'rgba(0,0,0,0.06)',shadowColor:'#000',
                  shadowOpacity:0.05,shadowRadius:4,elevation:2},
  moodBubbleOnFull:{width:70,height:70,borderRadius:35,borderColor:'rgba(0,0,0,0.12)',
                    shadowOpacity:0.18,shadowRadius:10,elevation:8},
  moodLblFull: {marginTop:6,fontSize:11,fontWeight:'600',color:'#7F8C8D',textAlign:'center'},
  subLabel:    {fontSize:12,fontWeight:'800',color:'#7F8C8D',marginBottom:10,textTransform:'uppercase',letterSpacing:0.3},
  noteWrapFull:{backgroundColor:'#F9FAFB',borderRadius:14,borderWidth:1.5,borderColor:'#E8EAED',
                paddingHorizontal:14,paddingVertical:12,minHeight:90},
  noteInputFull:{fontSize:14,color:C.text,lineHeight:22,minHeight:78},
  todoRowFull: {flexDirection:'row',gap:10,marginBottom:12},
  todoInpFull: {flex:1,backgroundColor:'#F9FAFB',borderRadius:12,borderWidth:1.5,borderColor:'#E8EAED',
                paddingHorizontal:14,paddingVertical:11,fontSize:14,color:C.text},
  addBtnFull:  {width:48,height:48,borderRadius:12,alignItems:'center',justifyContent:'center',shadowColor:'#000',
                shadowOpacity:0.15,shadowRadius:6,elevation:4},
  emptyFull:   {textAlign:'center',color:'#B0BEC5',fontSize:13,marginTop:10,fontStyle:'italic'},
  todoItemFull:{flexDirection:'row',alignItems:'center',paddingVertical:10,
                borderBottomWidth:1,borderBottomColor:'#F0F0F0',gap:12},
  checkBoxFull:{width:24,height:24,borderRadius:6,borderWidth:2,borderColor:'#D0D0D0',
                alignItems:'center',justifyContent:'center',backgroundColor:'transparent'},
  todoTxtFull: {flex:1,fontSize:14,color:C.text,fontWeight:'500'},
  todoDoneFull:{textDecorationLine:'line-through',color:'#BFBFBF'},
});

// ═══════════════════════════════════════════════════════════════════════════
//  FLOATING CLOUDS — 2 bigger clouds on home screen
// ═══════════════════════════════════════════════════════════════════════════
function FloatingClouds({ userName, daysLeft, phase }) {
  const f1=useRef(new Animated.Value(0)).current;
  const f2=useRef(new Animated.Value(0)).current;
  useEffect(()=>{
    const loop=(v,d,dur)=>Animated.loop(Animated.sequence([
      Animated.timing(v,{toValue:-6,duration:dur,delay:d,useNativeDriver:true,easing:Easing.inOut(Easing.sin)}),
      Animated.timing(v,{toValue:6, duration:dur,         useNativeDriver:true,easing:Easing.inOut(Easing.sin)}),
    ])).start();
    loop(f1,0,2700); loop(f2,900,3100);
  },[]);
  const TOP=Platform.OS==='ios'?54:38;
  return (
    <>
      <Animated.View style={{
        position:'absolute',zIndex:20,top:TOP,left:4,
        flexDirection:'row',alignItems:'center',transform:[{translateY:f1}],
      }}>
        <Text style={{fontSize:52,opacity:0.83,marginRight:-32}}>☁️</Text>
        <View style={cl.inner}>
          <Text style={{fontSize:12,fontWeight:'900',color:C.text}}>Hi {userName}! 🌸</Text>
          <Text style={{fontSize:10,fontWeight:'700',color:phase.color,marginTop:2}}>{phase.icon} {phase.label}</Text>
        </View>
      </Animated.View>
      <Animated.View style={{
        position:'absolute',zIndex:20,top:TOP+66,left:10,
        flexDirection:'row',alignItems:'center',transform:[{translateY:f2}],
      }}>
        <Text style={{fontSize:48,opacity:0.78,marginRight:-30}}>☁️</Text>
        <View style={cl.inner}>
          <Text style={{fontSize:10,fontWeight:'700',color:C.sub}}>Дараагийн сарын тэмдэг</Text>
          <Text style={{fontSize:18,fontWeight:'900',color:C.period,lineHeight:22,marginTop:1}}>
            {daysLeft}<Text style={{fontSize:10,color:C.sub,fontWeight:'600'}}> days</Text>
          </Text>
        </View>
      </Animated.View>
    </>
  );
}
const cl=StyleSheet.create({
  inner:{backgroundColor:'rgba(255,255,255,0.94)',borderRadius:14,paddingHorizontal:10,paddingVertical:6,
         marginLeft:6,shadowColor:'#000',shadowOpacity:0.07,shadowRadius:4,elevation:4,minWidth:0},
});

// ═══════════════════════════════════════════════════════════════════════════
//  MOOD BAR — bigger
// ═══════════════════════════════════════════════════════════════════════════
function MoodBar({ todayKey, dayData, onSave }) {
  const saved=dayData[todayKey]?.mood||null;
  const [sel,setSel]=useState(saved);
  const scales=useRef(MOODS.map(()=>new Animated.Value(1))).current;
  useEffect(()=>{ setSel(dayData[todayKey]?.mood||null); },[todayKey,dayData]);
  function pick(key,i){
    setSel(key);
    onSave(todayKey,{...(dayData[todayKey]||{}),mood:key});
    Animated.sequence([
      Animated.spring(scales[i],{toValue:1.35,useNativeDriver:true,speed:40}),
      Animated.spring(scales[i],{toValue:1,   useNativeDriver:true,speed:25}),
    ]).start();
  }
  return (
    <View style={mb.box}>
      <Text style={mb.title}>Өнөөдөр ямархуу байна вэ?</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={mb.row}>
        {MOODS.map((m,i)=>{
          const on=sel===m.key;
          return (
            <TouchableOpacity key={m.key} onPress={()=>pick(m.key,i)} style={{alignItems:'center',marginHorizontal:6}}>
              <Animated.View style={[mb.bubble,{backgroundColor:on?m.color:'rgba(255,255,255,0.85)'},
                on&&mb.bubbleOn,{transform:[{scale:scales[i]}]}]}>
                <Text style={{fontSize:on?27:21}}>{m.emoji}</Text>
              </Animated.View>
              <Text style={[mb.lbl,{color:on?m.color:C.sub,fontWeight:on?'900':'500'}]}>{m.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}
const mb=StyleSheet.create({
  box:      {backgroundColor:'rgba(255,255,255,0.94)',borderRadius:22,paddingVertical:13,paddingHorizontal:8,
             shadowColor:'#000',shadowOpacity:0.08,shadowRadius:12,elevation:6},
  title:    {textAlign:'center',fontSize:13,fontWeight:'900',color:C.text,marginBottom:8},
  row:      {paddingHorizontal:4,alignItems:'center'},
  bubble:   {width:50,height:50,borderRadius:25,alignItems:'center',justifyContent:'center',
             borderWidth:2,borderColor:'rgba(0,0,0,0.04)',shadowColor:'#000',shadowOpacity:0.06,shadowRadius:3,elevation:2},
  bubbleOn: {width:64,height:64,borderRadius:32,shadowOpacity:0.2,shadowRadius:8,elevation:6},
  lbl:      {marginTop:4,fontSize:9,fontWeight:'600',textAlign:'center'},
});

// ── Bottom Nav ──────────────────────────────────────────────────────────────
const NAV_H=Platform.OS==='ios'?82:62;
const NAV_TABS=[
  {key:'home',    emoji:'🏠',label:'Нүүр'},
  {key:'calendar',emoji:'📅',label:'Календарь'},
  {key:'info',    emoji:'ℹ️', label:'Мэдээлэл'},
  {key:'settings',emoji:'⚙️',label:'Тохиргоо'},
];
function BottomNav({ active, onPress }) {
  return (
    <View style={bn.bar}>
      {NAV_TABS.map(t=>(
        <TouchableOpacity key={t.key} onPress={()=>onPress(t.key)} style={bn.item}>
          <View style={[bn.ico,active===t.key&&bn.icoOn]}>
            <Text style={{fontSize:20}}>{t.emoji}</Text>
          </View>
          <Text style={[bn.lbl,active===t.key&&{color:C.period,fontWeight:'700'}]}>{t.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}
const bn=StyleSheet.create({
  bar:  {position:'absolute',bottom:0,left:0,right:0,flexDirection:'row',
         backgroundColor:'rgba(255,255,255,0.97)',borderTopWidth:1,borderTopColor:'rgba(0,0,0,0.07)',
         paddingBottom:Platform.OS==='ios'?24:8,paddingTop:8,
         shadowColor:'#000',shadowOpacity:0.08,shadowRadius:10,elevation:14},
  item: {flex:1,alignItems:'center'},
  ico:  {width:44,height:36,borderRadius:18,alignItems:'center',justifyContent:'center'},
  icoOn:{backgroundColor:'#FCE4EC'},
  lbl:  {fontSize:9.5,color:C.sub,marginTop:1,fontWeight:'500'},
});

// ═══════════════════════════════════════════════════════════════════════════
//  CALENDAR SCREEN
// ═══════════════════════════════════════════════════════════════════════════
function CalendarScreen({ pStart, cLen, dayData }) {
  const today=new Date();
  const [vm,setVm]=useState(today.getMonth());
  const [vy,setVy]=useState(today.getFullYear());
  const dim   = daysInMonth(vy,vm);
  const first = new Date(vy,vm,1).getDay();
  const adj   = first===0?6:first-1;
  const cells=[]; for(let i=0;i<adj;i++) cells.push(null); for(let d=1;d<=dim;d++) cells.push(d);
  return (
    <View style={{flex:1,paddingTop:Platform.OS==='ios'?54:36}}>
      <View style={{backgroundColor:'rgba(255,255,255,0.95)',marginHorizontal:12,borderRadius:22,padding:18,
        shadowColor:'#000',shadowOpacity:0.08,shadowRadius:14,elevation:6}}>
        <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
          <TouchableOpacity onPress={()=>vm===0?(setVy(y=>y-1),setVm(11)):setVm(m=>m-1)} style={{padding:8}}>
            <Text style={{fontSize:26,color:C.period,fontWeight:'700'}}>‹</Text>
          </TouchableOpacity>
          <Text style={{fontSize:18,fontWeight:'900',color:C.text}}>{MONTH_F[vm]} {vy}</Text>
          <TouchableOpacity onPress={()=>vm===11?(setVy(y=>y+1),setVm(0)):setVm(m=>m+1)} style={{padding:8}}>
            <Text style={{fontSize:26,color:C.period,fontWeight:'700'}}>›</Text>
          </TouchableOpacity>
        </View>
        <View style={{flexDirection:'row',marginBottom:6}}>
          {['Mo','Tu','We','Th','Fr','Sa','Su'].map((d,i)=>(
            <Text key={i} style={{flex:1,textAlign:'center',fontSize:11,color:C.sub,fontWeight:'700'}}>{d}</Text>
          ))}
        </View>
        <View style={{flexDirection:'row',flexWrap:'wrap'}}>
          {cells.map((d,i)=>{
            if(!d) return <View key={`e${i}`} style={{width:`${100/7}%`,aspectRatio:1}}/>;
            const date=new Date(vy,vm,d);
            const dic =dayInCycle(date,pStart,cLen);
            const ph  =phaseOf(dic,cLen);
            const isTd=d===today.getDate()&&vm===today.getMonth()&&vy===today.getFullYear();
            const dk2 =dateKey(date);
            const moodObj=dayData[dk2]?.mood?MOODS.find(m=>m.key===dayData[dk2].mood):null;
            return (
              <View key={d} style={{width:`${100/7}%`,aspectRatio:1,alignItems:'center',justifyContent:'center',
                backgroundColor:ph.bg,borderRadius:8}}>
                <Text style={{fontSize:13,fontWeight:'700',
                  color:isTd?'#fff':ph.color,
                  backgroundColor:isTd?C.period:'transparent',
                  borderRadius:12,paddingHorizontal:isTd?5:0,paddingVertical:isTd?1:0}}>{d}</Text>
                {moodObj
                  ? <Text style={{fontSize:10}}>{moodObj.emoji}</Text>
                  : <View style={{width:5,height:5,borderRadius:2.5,backgroundColor:ph.color,opacity:0.65,marginTop:1}}/>
                }
              </View>
            );
          })}
        </View>
        <View style={{flexDirection:'row',flexWrap:'wrap',gap:8,marginTop:14,justifyContent:'center'}}>
          {[{bg:'#FFD6E8',c:C.period,l:'Period'},{bg:'#CCF4F9',c:'#26C6DA',l:'Fertile'},
            {bg:'#FFE5CC',c:'#FF7043',l:'Ovulation'},{bg:'#EDE0FF',c:'#9B59B6',l:'Luteal'}].map(({bg,c,l})=>(
            <View key={l} style={{flexDirection:'row',alignItems:'center',gap:4}}>
              <View style={{width:11,height:11,borderRadius:6,backgroundColor:bg,borderWidth:1,borderColor:c}}/>
              <Text style={{fontSize:10,color:C.sub}}>{l}</Text>
            </View>
          ))}
          <View style={{flexDirection:'row',alignItems:'center',gap:4}}>
            <Text style={{fontSize:12}}>😊</Text>
            <Text style={{fontSize:10,color:C.sub}}>Mood logged</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  INFO SCREEN
// ═══════════════════════════════════════════════════════════════════════════
function InfoScreen({ pStart, cLen }) {
  const now=new Date();
  const dic=dayInCycle(now,pStart,cLen);
  const phase=phaseOf(dic,cLen);
  const TOP=Platform.OS==='ios'?54:36;
  const PHASES=[
  {
    ph:phaseOf(0,28),
    days:'1–4 дэх өдөр',
    desc:'Умайн салст гуужиж сарын тэмдэг ирдэг үе. Эстроген ба прогестерон хамгийн бага байдаг. Амрах, дулаан байх, ус сайн уух нь тустай.'
  },
  {
    ph:phaseOf(7,28),
    days:'5–10 дахь өдөр',
    desc:'Өндгөвчинд фолликулууд хөгжиж, эстроген нэмэгдэнэ. Эрч хүч болон сэтгэл санаа сайжирдаг — шинэ зүйл эхлэхэд тохиромжтой үе.'
  },
  {
    ph:{icon:'🌿',label:'Үр тогтох үе',color:'#26C6DA',bg:'#CCF5F8'},
    days:'11–16 дахь өдөр',
    desc:'Үр тогтох магадлал хамгийн өндөр үе. Эстроген дээд хэмжээнд хүрч өөртөө итгэл нэмэгдэнэ. Өндгөн эс гадагшлах нь ихэвчлэн 14 дэх өдөр болдог.'
  },
  {
    ph:phaseOf(21,28),
    days:'17–28 дахь өдөр',
    desc:'Прогестерон нэмэгдэж илүү тайван боловч ядарсан мэдрэмж төрж болно. Дараагийн мөчлөгт бие бэлтгэгдэх үед PMS шинж тэмдэг илэрч болно.'
  },
];
  return (
    <ScrollView style={{flex:1,paddingTop:TOP}} contentContainerStyle={{paddingHorizontal:14,paddingBottom:100}} showsVerticalScrollIndicator={false}>
      {/* Current phase card */}
      <View style={inf.card}>
        <Text style={inf.cardTitle}>📍 Сарын тэмдэг одоогоор</Text>
        <View style={[{flexDirection:'row',alignItems:'center',backgroundColor:phase.bg,borderRadius:14,padding:14,borderLeftWidth:4,borderLeftColor:phase.color}]}>
          <Text style={{fontSize:36}}>{phase.icon}</Text>
          <View style={{flex:1,marginLeft:12}}>
            <Text style={{fontSize:15,fontWeight:'900',color:phase.color}}>{phase.label}</Text>
            <Text style={{fontSize:12,color:C.sub,marginTop:2}}>Day {dic+1} of {cLen} · {cLen-dic} days until next period</Text>
          </View>
        </View>
      </View>
      {/* Cycle phases */}
      <View style={inf.card}>
        <Text style={inf.cardTitle}>🔄 Сарын тэмдгийн талаар ойлгох</Text>
        {PHASES.map((p,pi)=>(
          <View key={pi} style={{borderLeftWidth:3,borderLeftColor:p.ph.color,paddingLeft:12,marginBottom:14}}>
            <View style={{flexDirection:'row',alignItems:'center',gap:7,marginBottom:3}}>
              <Text style={{fontSize:18}}>{p.ph.icon}</Text>
              <Text style={{fontSize:13,fontWeight:'900',color:p.ph.color}}>{p.ph.label}</Text>
              <Text style={{fontSize:10,color:C.sub,fontWeight:'600'}}>{p.days}</Text>
            </View>
            <Text style={{fontSize:12,color:C.text,lineHeight:18}}>{p.desc}</Text>
          </View>
        ))}
      </View>
      {/* Wheel color guide */}
      <View style={inf.card}>
  <Text style={inf.cardTitle}>🎡 Өнгийн тайлбар</Text>
  {[{bg:'#FFD6E0',c:C.period,l:'Сарын тэмдэг (1–4 өдөр)',     d:'Сарын тэмдгийн идэвхтэй үе'},
    {bg:'#FFE5CC',c:'#FF7043',l:'Өндгөн эс (13–14 өдөр)',      d:'Үр тогтох магадлал хамгийн өндөр'},
    {bg:'#CCF4F9',c:'#26C6DA',l:'Үр тогтох үе (11–16 өдөр)',   d:'Жирэмслэх магадлал өндөр өдрүүд'},
    {bg:'#EDE0FF',c:'#9B59B6',l:'Лютейн үе (17–28 өдөр)',      d:'Тэмдэг ирэхийн өмнөх үе'},
    {bg:'#EEF3F7',c:'#607D8B',l:'Энгийн өдрүүд',               d:'Тайван / фолликулын үе'},
  ].map(({bg,c,l,d})=>(
          <View key={l} style={{flexDirection:'row',alignItems:'center',gap:12,marginBottom:11}}>
            <View style={{width:38,height:38,borderRadius:10,backgroundColor:bg,borderWidth:1.5,borderColor:c}}/>
            <View style={{flex:1}}>
              <Text style={{fontSize:13,fontWeight:'800',color:c}}>{l}</Text>
              <Text style={{fontSize:11,color:C.sub}}>{d}</Text>
            </View>
          </View>
        ))}
      </View>
      {/* General tips */}
      <View style={inf.card}>
        <Text style={inf.cardTitle}>🌿 Эрүүл мэндийн зөвлөгөө</Text>
{[['💧','Ус сайн уух','Өдөрт 8 ба түүнээс дээш аяга ус уугаарай, ялангуяа сарын тэмдгийн үед.'],
  ['🥗','Зөв хооллох','Төмрөөр баялаг хоол (бууцай, шош) нь тэмдгийн үед алдагдсан цусыг нөхөхөд тусална.'],
  ['🏃','Идэвхтэй байх','Хөнгөн дасгал нь базлалт багасгаж, эндорфин ялгаруулан сэтгэл санааг сайжруулна.'],
  ['😴','Сайн унтах','7–9 цагийн нойр нь дааврын тэнцвэрийг дэмждэг.'],
  ['📓','Шинж тэмдгээ тэмдэглэх','Тогтмол тэмдэглэснээр дараагийн мөчлөгийг илүү сайн ойлгож, бэлтгэх боломжтой.'],
].map(([ico,title,tip])=>(
          <View key={title} style={{flexDirection:'row',marginBottom:12,gap:10}}>
            <Text style={{fontSize:21}}>{ico}</Text>
            <View style={{flex:1}}>
              <Text style={{fontSize:13,fontWeight:'800',color:C.text}}>{title}</Text>
              <Text style={{fontSize:12,color:C.sub,lineHeight:17,marginTop:2}}>{tip}</Text>
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}
const inf=StyleSheet.create({
  card:      {backgroundColor:'rgba(255,255,255,0.95)',borderRadius:20,padding:18,marginBottom:14,
              shadowColor:'#000',shadowOpacity:0.07,shadowRadius:10,elevation:5},
  cardTitle: {fontSize:15,fontWeight:'900',color:C.text,marginBottom:12},
});

// ═══════════════════════════════════════════════════════════════════════════
//  SETTINGS SCREEN
// ═══════════════════════════════════════════════════════════════════════════
function SettingsScreen({ pStart, cLen, onChangePeriod, userName, onLogout }) {
  const [showPeriod,setShowP]=useState(false);
  const TOP=Platform.OS==='ios'?54:36;
  function Row({icon,title,sub,onPress,red}){
    return (
      <TouchableOpacity onPress={onPress} style={{
        flexDirection:'row',alignItems:'center',paddingVertical:14,paddingHorizontal:18,
        borderBottomWidth:1,borderBottomColor:'#F5F5F5',gap:14}}>
        <Text style={{fontSize:22}}>{icon}</Text>
        <View style={{flex:1}}>
          <Text style={{fontSize:14,fontWeight:'700',color:red?'#E53935':C.text}}>{title}</Text>
          {sub?<Text style={{fontSize:11,color:C.sub,marginTop:1}}>{sub}</Text>:null}
        </View>
        <Text style={{fontSize:18,color:'#CCC'}}>›</Text>
      </TouchableOpacity>
    );
  }
  return (
    <ScrollView style={{flex:1,paddingTop:TOP}} contentContainerStyle={{paddingHorizontal:14,paddingBottom:100}} showsVerticalScrollIndicator={false}>
      {/* Profile */}
      <View style={{backgroundColor:'rgba(255,255,255,0.97)',borderRadius:20,marginBottom:14,
        shadowColor:'#000',shadowOpacity:0.07,shadowRadius:10,elevation:5,overflow:'hidden'}}>
        <View style={{alignItems:'center',padding:24,backgroundColor:'#FFF0F7'}}>
          <View style={{width:74,height:74,borderRadius:37,backgroundColor:'#FCE4EC',borderWidth:3,
            borderColor:C.period,overflow:'hidden',marginBottom:10}}>
            <Image source={require('./assets/asset/images/general/ariacop.jpg')} style={{width:70,height:70,borderRadius:35}} resizeMode="cover"/>
          </View>
          <Text style={{fontSize:18,fontWeight:'900',color:C.text}}>{userName}</Text>
          <Text style={{fontSize:12,color:C.sub,marginTop:2}}>OKY member 🌸</Text>
        </View>
<Row icon="🩸" title="Сарын тэмдгийн тохиргоо"
  sub={`Сүүлд эхэлсэн: ${MONTH_S[pStart.getMonth()]} ${pStart.getDate()} · Мөчлөг: ${cLen} өдөр`}
  onPress={()=>setShowP(true)}/>
</View>

{/* Color guide */}
<View style={{backgroundColor:'rgba(255,255,255,0.97)',borderRadius:20,marginBottom:14,
  shadowColor:'#000',shadowOpacity:0.07,shadowRadius:10,elevation:5,overflow:'hidden'}}>

<Text style={{fontSize:12,fontWeight:'800',color:C.sub,paddingHorizontal:18,paddingTop:14,paddingBottom:8,textTransform:'uppercase',letterSpacing:0.5}}>
ӨНГИЙН ТАЙЛБАР
</Text>

{[{bg:'#FFD6E0',c:C.period,  l:'Сарын тэмдэг',      d:'Сарын тэмдгийн идэвхтэй үе'},
  {bg:'#FFE5CC',c:'#FF7043', l:'Өндгөн эс гадагшлах', d:'Үр тогтох магадлал хамгийн өндөр (13–14 өдөр)'},
  {bg:'#CCF4F9',c:'#26C6DA', l:'Үр тогтох үе',        d:'Жирэмслэх магадлал өндөр (11–16 өдөр)'},
  {bg:'#EDE0FF',c:'#9B59B6', l:'Лютейн үе',           d:'Тэмдэг ирэхийн өмнөх үе'},
  {bg:'#EEF3F7',c:'#607D8B', l:'Энгийн өдрүүд',       d:'Фолликулын / амралтын үе'},
].map(({bg,c,l,d})=>(
          <View key={l} style={{flexDirection:'row',alignItems:'center',gap:12,
            paddingHorizontal:18,paddingVertical:10,borderBottomWidth:1,borderBottomColor:'#F8F8F8'}}>
            <View style={{width:34,height:34,borderRadius:10,backgroundColor:bg,borderWidth:1.5,borderColor:c}}/>
            <View style={{flex:1}}>
              <Text style={{fontSize:13,fontWeight:'700',color:c}}>{l}</Text>
              <Text style={{fontSize:11,color:C.sub}}>{d}</Text>
            </View>
          </View>
        ))}
      </View>
      {/* Account */}
      <View style={{backgroundColor:'rgba(255,255,255,0.97)',borderRadius:20,marginBottom:14,
        shadowColor:'#000',shadowOpacity:0.07,shadowRadius:10,elevation:5,overflow:'hidden'}}>
        <Text style={{fontSize:12,fontWeight:'800',color:C.sub,paddingHorizontal:18,paddingTop:14,paddingBottom:8,textTransform:'uppercase',letterSpacing:0.5}}>ACCOUNT</Text>
       <Row icon="🔒" title="Нууц үг солих" sub="Дансны нууц үгээ шинэчлэх" onPress={()=>{}}/>
<Row icon="🔔" title="Мэдэгдэл" sub="Сарын тэмдгийн сануулга, анхааруулга" onPress={()=>{}}/>
<Row icon="🌐" title="Хэл" sub="Монгол" onPress={()=>{}}/>
</View>

{/* Гарах / Logout */}
      <TouchableOpacity onPress={onLogout} style={{
        backgroundColor:'rgba(255,255,255,0.97)',borderRadius:20,paddingVertical:17,alignItems:'center',
        shadowColor:'#000',shadowOpacity:0.07,shadowRadius:10,elevation:5,
        borderWidth:1.5,borderColor:'rgba(229,57,53,0.28)'}}>
        <Text style={{fontSize:15,fontWeight:'900',color:'#E53935'}}>🚪 Log Out</Text>
      </TouchableOpacity>
      <PeriodSetupModal visible={showPeriod} onClose={()=>setShowP(false)}
        pStart={pStart} cLen={cLen} onChange={onChangePeriod}/>
    </ScrollView>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  PERIOD SETUP MODAL
// ═══════════════════════════════════════════════════════════════════════════
function PeriodSetupModal({ visible, onClose, pStart, cLen, onChange }) {
  const now=new Date();
  const [selM,setSelM]=useState(pStart.getMonth());
  const [selD,setSelD]=useState(pStart.getDate());
  const [selC,setSelC]=useState(cLen);
  if(!visible) return null;
  const dim=daysInMonth(now.getFullYear(),selM);
  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={{flex:1,backgroundColor:'rgba(0,0,0,0.38)',justifyContent:'flex-end'}}
        activeOpacity={1} onPress={onClose}>
        <View style={{backgroundColor:'#fff',borderTopLeftRadius:28,borderTopRightRadius:28,padding:24,
          shadowColor:'#000',shadowOpacity:0.2,shadowRadius:20,elevation:14}}
          onStartShouldSetResponder={()=>true}>
          <View style={{width:36,height:4,borderRadius:2,backgroundColor:'#E0E0E0',alignSelf:'center',marginBottom:16}}/>
          <Text style={{fontSize:20,fontWeight:'900',color:C.period,textAlign:'center',marginBottom:4}}>🩸 Сарын тэмдгийн тохиргоо</Text>
          <Text style={{fontSize:13,color:C.sub,textAlign:'center',marginBottom:16}}>Сарын тэмдэг хэзээ хамгийн сүүлд ирсэн бэ?</Text>
          {[['Month',MONTH_S,selM,setSelM],[`Day (1–${dim})`,Array.from({length:dim},(_,ii)=>ii+1),selD,setSelD]].map(([label,items,sel,setter])=>(
            <View key={label} style={{marginBottom:12}}>
              <Text style={{fontSize:12,fontWeight:'700',color:C.text,marginBottom:6}}>{label}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {items.map((it,idx)=>{
                  const v=typeof it==='number'?it:idx;
                  return (
                    <TouchableOpacity key={idx} onPress={()=>setter(v)}
                      style={{paddingHorizontal:13,paddingVertical:8,borderRadius:18,marginRight:6,
                        backgroundColor:v===sel?C.period:'rgba(0,0,0,0.07)'}}>
                      <Text style={{fontSize:13,color:v===sel?'#fff':C.text,fontWeight:'700'}}>{it}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          ))}
          <Text style={{fontSize:12,fontWeight:'700',color:C.text,marginBottom:6}}>
Мөчлөгийн урт (өдөр)
</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom:22}}>
            {Array.from({length:15},(_,ii)=>ii+21).map(c=>(
              <TouchableOpacity key={c} onPress={()=>setSelC(c)}
                style={{paddingHorizontal:13,paddingVertical:8,borderRadius:18,marginRight:6,
                  backgroundColor:c===selC?C.period:'rgba(0,0,0,0.07)'}}>
                <Text style={{fontSize:13,color:c===selC?'#fff':C.text,fontWeight:'700'}}>{c}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <TouchableOpacity onPress={()=>{onChange(new Date(now.getFullYear(),selM,selD),selC);onClose();}}
            style={{backgroundColor:C.period,borderRadius:22,paddingVertical:14,alignItems:'center'}}>
            <Text style={{color:'#fff',fontWeight:'900',fontSize:16}}>Хадгалагдлаа ✓</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  MAIN APP
// ═══════════════════════════════════════════════════════════════════════════
function MainApp({ userName, initialPStart, onLogout }) {
  const now=new Date();
  const [pStart,setPStart]=useState(initialPStart||new Date(now.getFullYear(),now.getMonth()-1,20));
  const [cLen,setCLen]    =useState(28);
  const [tab,setTab]      =useState('home');
  const [viewMonth,setVM] =useState(now.getMonth());
  const [viewYear,setVY]  =useState(now.getFullYear());
  const [showMM,setMM]    =useState(false);
  const [dayData,setDD]   =useState({});
  const [tapped,setTapped]=useState(null);

  const dic      = dayInCycle(now,pStart,cLen);
  const dLeft    = cLen-dic;
  const phase    = phaseOf(dic,cLen);
  const todayKey = dateKey(now);

  function saveDay(key,data){ setDD(prev=>({...prev,[key]:data})); }

  return (
    <View style={{flex:1,backgroundColor:C.sky}}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent"/>
      <ImageBackground source={require('./assets/asset/images/backgrounds/village-default.png')} style={StyleSheet.absoluteFill} resizeMode="cover"/>
      <View style={{...StyleSheet.absoluteFillObject,backgroundColor:'rgba(210,235,255,0.15)'}}/>

      {/* HOME */}
      {tab==='home'&&(
        <>
          <EllipseWheel
            year={viewYear} month={viewMonth}
            pStart={pStart} cLen={cLen} daysLeft={dLeft}
            dayData={dayData}
            cardOpen={!!tapped}
            onDayTap={(date,day,gx,gy)=>setTapped({date,day,fromX:gx,fromY:gy})}
            onMonthPress={()=>setMM(true)}
          />
          <FloatingClouds userName={userName} daysLeft={dLeft} phase={phase}/>
          <View style={{position:'absolute',bottom:NAV_H+2,left:0,right:0,paddingHorizontal:12,paddingBottom:6}}>
            <MoodBar todayKey={todayKey} dayData={dayData} onSave={saveDay}/>
          </View>
        </>
      )}

      {/* CALENDAR */}
      {tab==='calendar'&&<CalendarScreen pStart={pStart} cLen={cLen} dayData={dayData}/>}

      {/* INFO */}
      {tab==='info'&&<InfoScreen pStart={pStart} cLen={cLen}/>}

      {/* SETTINGS */}
      {tab==='settings'&&(
        <SettingsScreen pStart={pStart} cLen={cLen} userName={userName}
          onChangePeriod={(s,l)=>{setPStart(s);setCLen(l);}} onLogout={onLogout}/>
      )}

      <BottomNav active={tab} onPress={setTab}/>

      {tapped&&(
        <DayCard date={tapped.date} day={tapped.day}
          fromX={tapped.fromX} fromY={tapped.fromY}
          pStart={pStart} cLen={cLen}
          dayData={dayData} onSave={saveDay}
          onClose={()=>setTapped(null)}/>
      )}

      <MonthPicker visible={showMM} onClose={()=>setMM(false)}
        viewMonth={viewMonth} viewYear={viewYear}
        onChange={(m,y)=>{setVM(m);setVY(y);}}/>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  SPLASH SCREEN
// ═══════════════════════════════════════════════════════════════════════════
function SplashScreen({ onDone }) {
  const scale =useRef(new Animated.Value(0.25)).current;
  const opac  =useRef(new Animated.Value(0)).current;
  const slideY=useRef(new Animated.Value(40)).current;
  const exit  =useRef(new Animated.Value(1)).current;
  useEffect(()=>{
    Animated.parallel([
      Animated.spring(scale,  {toValue:1,friction:6,tension:65,useNativeDriver:true}),
      Animated.timing(opac,   {toValue:1,duration:600,useNativeDriver:true}),
      Animated.timing(slideY, {toValue:0,duration:600,easing:Easing.out(Easing.cubic),useNativeDriver:true}),
    ]).start();
    const t=setTimeout(()=>{
      Animated.timing(exit,{toValue:0,duration:500,useNativeDriver:true}).start(onDone);
    },2500);
    return ()=>clearTimeout(t);
  },[]);
  return (
    <Animated.View style={{flex:1,opacity:exit}}>
      <ImageBackground source={require('./assets/asset/images/backgrounds/village-default.png')} style={StyleSheet.absoluteFill} resizeMode="cover"/>
      <View style={{...StyleSheet.absoluteFillObject,backgroundColor:'rgba(250,225,238,0.55)'}}/>
      <View style={{flex:1,alignItems:'center',justifyContent:'center'}}>
        <Animated.View style={{alignItems:'center',opacity:opac,transform:[{scale},{translateY:slideY}]}}>
          <View style={{width:130,height:130,borderRadius:65,backgroundColor:'rgba(255,255,255,0.97)',
            borderWidth:4,borderColor:C.period,overflow:'hidden',marginBottom:20,
            shadowColor:C.period,shadowOpacity:0.32,shadowRadius:22,elevation:16}}>
            <Image source={require('./assets/asset/images/general/ariacop.jpg')} style={{width:122,height:122,borderRadius:61}} resizeMode="cover"/>
          </View>
          <Text style={{fontSize:40,fontWeight:'900',color:C.period,letterSpacing:3,textShadowColor:'rgba(233,30,140,0.18)',textShadowRadius:10}}>OKY</Text>
          <Text style={{fontSize:17,color:'#7B5EA7',fontWeight:'700',marginTop:6}}>
Oky-д тавтай морил 🌸
</Text>
<Text style={{fontSize:13,color:C.sub,marginTop:8}}>
Таны сарын тэмдгийн найдвартай туслах 🌿
</Text>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  WELCOME SCREEN (post-login)
// ═══════════════════════════════════════════════════════════════════════════
function WelcomeScreen({ name, onContinue }) {
  const fade=useRef(new Animated.Value(0)).current;
  const sc  =useRef(new Animated.Value(0.5)).current;
  const exit=useRef(new Animated.Value(1)).current;
  useEffect(()=>{
    Animated.parallel([
      Animated.timing(fade,{toValue:1,duration:500,useNativeDriver:true}),
      Animated.spring(sc,  {toValue:1,friction:6,tension:75,useNativeDriver:true}),
    ]).start();
    const t=setTimeout(()=>{
      Animated.timing(exit,{toValue:0,duration:400,useNativeDriver:true}).start(onContinue);
    },2400);
    return ()=>clearTimeout(t);
  },[]);
  return (
    <Animated.View style={{flex:1,alignItems:'center',justifyContent:'center',opacity:exit}}>
      <ImageBackground source={require('./assets/asset/images/backgrounds/village-default.png')} style={StyleSheet.absoluteFill} resizeMode="cover"/>
      <View style={{...StyleSheet.absoluteFillObject,backgroundColor:'rgba(252,225,238,0.38)'}}/>
      <Animated.View style={{alignItems:'center',opacity:fade,transform:[{scale:sc}]}}>
        <View style={{backgroundColor:'rgba(255,255,255,0.97)',borderRadius:36,padding:32,alignItems:'center',
          shadowColor:C.period,shadowOpacity:0.2,shadowRadius:26,elevation:14}}>
          <View style={{width:112,height:112,borderRadius:56,backgroundColor:'#FCE4EC',
            borderWidth:4,borderColor:C.period,overflow:'hidden',marginBottom:14}}>
            <Image source={require('./assets/asset/images/general/ariacop.jpg')} style={{width:106,height:106,borderRadius:53}} resizeMode="cover"/>
          </View>
          <Text style={{fontSize:16,color:C.sub,fontWeight:'600'}}>Дахин тавтай морил,</Text>
          <Text style={{fontSize:28,fontWeight:'900',color:C.period,marginTop:2}}>{name}! 🌸</Text>
          <Text style={{fontSize:13,color:'#7B5EA7',fontWeight:'700',marginTop:4}}>Таны мөчлөгийг шалгая</Text>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  LOGIN
// ═══════════════════════════════════════════════════════════════════════════

function LoginScreen({ onLogin, onGoSignup }) {
  const [email,setEmail]=useState('');
  const [pw,setPw]      =useState('');
  const [err,setErr]    =useState('');
  const fade =useRef(new Animated.Value(0)).current;
  const slide=useRef(new Animated.Value(40)).current;
  useEffect(()=>{
    Animated.parallel([
      Animated.timing(fade, {toValue:1,duration:600,useNativeDriver:true}),
      Animated.timing(slide,{toValue:0,duration:600,easing:Easing.out(Easing.cubic),useNativeDriver:true}),
    ]).start();
  },[]);
  function go(){
    if(!email.trim()){setErr('Имэйлээ оруулна уу');return;}
    if(!pw.trim()){setErr('Нууц үгээ оруулна уу');return;}
  setErr(''); onLogin(email.split('@')[0] || email);
  }
  return (
    <View style={{flex:1}}>
      <ImageBackground source={require('./assets/asset/images/backgrounds/village-default.png')} style={StyleSheet.absoluteFill} resizeMode="cover"/>
      <View style={au.overlay}/>
      <KeyboardAvoidingView behavior={Platform.OS==='ios'?'padding':'height'} style={{flex:1,justifyContent:'center',padding:22}}>
        <Animated.View style={[au.card,{opacity:fade,transform:[{translateY:slide}]}]}>
          <View style={au.logoCircle}>
            <Image source={require('./assets/asset/images/general/ariacop.jpg')} style={{width:80,height:80,borderRadius:40}} resizeMode="cover"/>
          </View>
          <Text style={au.appName}>OKY</Text>
          <Text style={au.tagline}>Таны сарын тэмдгийн туслах 🌸</Text>
          <View style={{height:14}}/>
          <View style={au.inputWrap}>
            <Text style={au.iico}>📧</Text>
            <TextInput style={au.inp} placeholder="Имэйл" placeholderTextColor="#bbb"
              keyboardType="email-address" autoCapitalize="none"
              value={email} onChangeText={t=>{setEmail(t);setErr('');}}/>
          </View>
          <View style={au.inputWrap}>
            <Text style={au.iico}>🔒</Text>
            <TextInput style={au.inp} placeholder="Нууц үг" placeholderTextColor="#bbb"
              secureTextEntry value={pw} onChangeText={t=>{setPw(t);setErr('');}}/>
          </View>
          {!!err&&<Text style={au.err}>{err}</Text>}
          <TouchableOpacity style={au.btn} onPress={go}>
            <Text style={au.btnT}>Log In 🌸</Text>
          </TouchableOpacity>
          <TouchableOpacity style={au.ghost} onPress={onGoSignup}>
            <Text style={au.ghostT}>Бүртгэлгүй үү? Бүртгүүлэх →</Text>
          </TouchableOpacity>
          <Text style={{textAlign:'center',color:C.sub,fontSize:12,marginTop:8}}>Нууц үгээ мартсан уу?</Text>
        </Animated.View>
      </KeyboardAvoidingView>
    </View>
  );
}


// ═══════════════════════════════════════════════════════════════════════════
//  SIGNUP
// ═══════════════════════════════════════════════════════════════════════════
function SignupScreen({ onSignup, onGoLogin }) {
  const [stp,setStp]         =useState(1);
  const [name,setName]       =useState('');
  const [email,setEmail]     =useState('');
  const [password,setPass]   =useState('');
  const [confirm,setConf]    =useState('');
  const [gender,setGender]   =useState('');
  const [bDay,setBDay]       =useState('');
  const [bYear,setBYear]     =useState('');
  const [bMonth,setBMonth]   =useState(0);
  const [pDay,setPDay]       =useState('');
  const [pMonth,setPMonth]   =useState(new Date().getMonth());
  const [q1,setQ1]           =useState('');
  const [q2,setQ2]           =useState('');
  const [q3,setQ3]           =useState('');
  const [error,setError]     =useState('');
  const fade =useRef(new Animated.Value(0)).current;
  const slide=useRef(new Animated.Value(30)).current;
  useEffect(()=>{
    fade.setValue(0); slide.setValue(30);
    Animated.parallel([
      Animated.timing(fade, {toValue:1,duration:380,useNativeDriver:true}),
      Animated.timing(slide,{toValue:0,duration:380,easing:Easing.out(Easing.cubic),useNativeDriver:true}),
    ]).start();
    setError('');
  },[stp]);
  function next1(){
    if(!name.trim())      {setError('Нэрээ оруулна уу');return;}
    if(!email.trim())     {setError('Имэйлээ оруулна уу');return;}
    if(password.length<6) {setError('Нууц үг 6 тэмдэгтээс дээш байх ёстой');return;}
    if(password!==confirm){setError('Нууц үг таарахгүй байна');return;}
    setStp(2);
  }
  function fin(){
    const d=parseInt(pDay)||1;
    const now=new Date();
    const ps=new Date(now.getFullYear(),pMonth,Math.min(d,daysInMonth(now.getFullYear(),pMonth)));
    onSignup(name.trim(),ps);
  }
  const chip=(val,set,o)=>(
    <TouchableOpacity key={o} onPress={()=>set(o)}
      style={{paddingHorizontal:12,paddingVertical:7,borderRadius:18,marginRight:5,marginBottom:4,
        backgroundColor:val===o?C.period:'rgba(0,0,0,0.07)'}}>
      <Text style={{fontSize:12,color:val===o?'#fff':C.text,fontWeight:'700'}}>{o}</Text>
    </TouchableOpacity>
  );
  const dots=(
    <View style={{flexDirection:'row',justifyContent:'center',gap:8,marginBottom:16}}>
      {[1,2,3].map(s=>(
        <View key={s} style={{width:s===stp?24:8,height:8,borderRadius:4,
          backgroundColor:s<=stp?C.period:'rgba(233,30,140,0.18)'}}/>
      ))}
    </View>
  );
  return (
    <View style={{flex:1}}>
      <ImageBackground source={require('./assets/asset/images/backgrounds/village-default.png')} style={StyleSheet.absoluteFill} resizeMode="cover"/>
      <View style={au.overlay}/>
      <KeyboardAvoidingView behavior={Platform.OS==='ios'?'padding':'height'} style={{flex:1}}>
        <ScrollView contentContainerStyle={{flexGrow:1,justifyContent:'center',padding:22}} keyboardShouldPersistTaps="handled">
          <Animated.View style={[au.card,{opacity:fade,transform:[{translateY:slide}]}]}>
            {dots}
            {stp===1&&<>
              <Text style={au.appName}>OKY 🌸</Text>
              <Text style={au.tagline}>Create account · Step 1 of 3</Text>
              <View style={{height:12}}/>
              {[['👤','Full name','default',name,setName,false],
                ['📧','Email','email-address',email,setEmail,false],
                ['🔒','Password (min 6)','default',password,setPass,true],
                ['🔒','Confirm password','default',confirm,setConf,true],
              ].map(([ico,ph,kbt,val,setter,sec])=>(
                <View key={ph} style={au.inputWrap}>
                  <Text style={au.iico}>{ico}</Text>
                  <TextInput style={au.inp} placeholder={ph} placeholderTextColor="#bbb"
                    keyboardType={kbt} autoCapitalize="none" secureTextEntry={sec}
                    value={val} onChangeText={t=>{setter(t);setError('');}}/>
                </View>
              ))}
            {!!error && <Text style={au.err}>{error}</Text>}
<TouchableOpacity style={au.btn} onPress={next1}>
  <Text style={au.btnT}>Дараагийн →</Text>
</TouchableOpacity>
<TouchableOpacity style={au.ghost} onPress={onGoLogin}>
  <Text style={au.ghostT}>Өмнө нь бүртгүүлсэн бол нэвтрэх</Text>
</TouchableOpacity>
</>}

{stp===2 && <>
  <Text style={au.appName}>Таны мэдээлэл</Text>
  <Text style={au.tagline}>Алхам 2/3</Text>
  <View style={{height:10}}/>
  <Text style={au.lbl}>Хүйс</Text>
  <View style={{flexDirection:'row',flexWrap:'wrap',gap:5,marginBottom:12}}>
    {['Эмэгтэй','Бусад / non-binary','Хариу өгөхийг хүсэхгүй'].map(o => chip(gender,setGender,o))}
  </View>
  <Text style={au.lbl}>Төрсөн өдөр</Text>
              <View style={{flexDirection:'row',gap:6,alignItems:'center',marginBottom:14}}>
                <View style={[au.inputWrap,{flex:0,width:68,marginBottom:0}]}>
                  <TextInput style={[au.inp,{textAlign:'center',paddingHorizontal:2}]} placeholder="Day"
                    placeholderTextColor="#bbb" keyboardType="numeric" value={bDay} onChangeText={setBDay}/>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{flex:1}}>
                  {MONTH_S.map((m,i)=>(
                    <TouchableOpacity key={m} onPress={()=>setBMonth(i)}
                      style={{paddingHorizontal:9,paddingVertical:6,borderRadius:18,marginRight:5,
                        backgroundColor:bMonth===i?C.period:'rgba(0,0,0,0.07)'}}>
                      <Text style={{fontSize:12,color:bMonth===i?'#fff':C.text,fontWeight:'600'}}>{m}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                <View style={[au.inputWrap,{flex:0,width:74,marginBottom:0}]}>
                  <TextInput style={[au.inp,{textAlign:'center',paddingHorizontal:2}]} placeholder="Year"
                    placeholderTextColor="#bbb" keyboardType="numeric" value={bYear} onChangeText={setBYear}/>
                </View>
              </View>
              <TouchableOpacity style={au.btn} onPress={()=>setStp(3)}><Text style={au.btnT}>Next →</Text></TouchableOpacity>
              <TouchableOpacity style={au.ghost} onPress={()=>setStp(1)}><Text style={au.ghostT}>← Back</Text></TouchableOpacity>
            </>}
            {stp===3&&<>
             <Text style={au.appName}>Таны мөчлөг 🩸</Text>
<Text style={au.tagline}>Алхам 3/3</Text>
<View style={{height:8}}/>
<Text style={au.lbl}>Сүүлд сарын тэмдэг эхэлсэн өдөр</Text>
<View style={{flexDirection:'row',gap:6,alignItems:'center',marginBottom:10}}>
                <View style={[au.inputWrap,{flex:0,width:70,marginBottom:0}]}>
                  <TextInput style={[au.inp,{textAlign:'center',paddingHorizontal:2}]} placeholder="Day"
                    placeholderTextColor="#bbb" keyboardType="numeric" value={pDay} onChangeText={t=>{setPDay(t);setError('');}}/>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{flex:1}}>
                  {MONTH_S.map((m,i)=>(
                    <TouchableOpacity key={m} onPress={()=>setPMonth(i)}
                      style={{paddingHorizontal:9,paddingVertical:6,borderRadius:18,marginRight:5,
                        backgroundColor:pMonth===i?C.period:'rgba(0,0,0,0.07)'}}>
                      <Text style={{fontSize:12,color:pMonth===i?'#fff':C.text,fontWeight:'600'}}>{m}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
              <Text style={au.lbl}>Сарын тэмдэг ирсэн үү?</Text>
<View style={{flexDirection:'row',flexWrap:'wrap',gap:5,marginBottom:8}}>
  {['Тийм, саяхан','Одоогоор ирээгүй','Тогтмоггүй'].map(o => chip(q1,setQ1,o))}
</View>

<Text style={au.lbl}>Базлалт байна уу?</Text>
<View style={{flexDirection:'row',flexWrap:'wrap',gap:5,marginBottom:8}}>
  {['Байхгүй','Хөнгөн','Дунд','Хүнд'].map(o => chip(q2,setQ2,o))}
</View>

<Text style={au.lbl}>Цусны хэмжээ</Text>
<View style={{flexDirection:'row',gap:5,marginBottom:10}}>
  {['Бага','Дундаж','Их'].map(o => chip(q3,setQ3,o))}
</View>
              {!!error&&<Text style={au.err}>{error}</Text>}
              <TouchableOpacity style={au.btn} onPress={fin}><Text style={au.btnT}>Let's go! 🌸</Text></TouchableOpacity>
              <TouchableOpacity style={au.ghost} onPress={()=>setStp(2)}><Text style={au.ghostT}>← Буцах</Text></TouchableOpacity>
            </>}
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const au=StyleSheet.create({
  overlay:   {...StyleSheet.absoluteFillObject,backgroundColor:'rgba(235,175,210,0.30)'},
  card:      {backgroundColor:'rgba(255,255,255,0.98)',borderRadius:30,padding:24,
              shadowColor:'#000',shadowOpacity:0.14,shadowRadius:22,elevation:12},
  logoCircle:{alignSelf:'center',width:90,height:90,borderRadius:45,backgroundColor:'#FCE4EC',
              alignItems:'center',justifyContent:'center',marginBottom:12,
              shadowColor:C.period,shadowOpacity:0.25,shadowRadius:14,elevation:7},
  appName:   {textAlign:'center',fontSize:28,fontWeight:'900',color:C.period,marginBottom:4},
  tagline:   {textAlign:'center',fontSize:12,color:C.sub,marginBottom:4},
  lbl:       {fontSize:12,fontWeight:'700',color:C.text,marginBottom:5},
  inputWrap: {flexDirection:'row',alignItems:'center',backgroundColor:'#F8F0F5',borderRadius:15,
              paddingHorizontal:12,paddingVertical:4,marginBottom:10,
              borderWidth:1.5,borderColor:'rgba(233,30,140,0.12)'},
  iico:      {fontSize:17,marginRight:9},
  inp:       {flex:1,fontSize:14,color:C.text,paddingVertical:10},
  err:       {color:'#E53935',fontSize:11,textAlign:'center',marginBottom:8},
  btn:       {backgroundColor:C.period,borderRadius:22,paddingVertical:13,alignItems:'center',marginTop:4,
              shadowColor:C.period,shadowOpacity:0.35,shadowRadius:9,elevation:5},
  btnT:      {color:'#fff',fontWeight:'900',fontSize:15},
  ghost:     {alignItems:'center',marginTop:12,paddingVertical:6},
  ghostT:    {color:C.period,fontWeight:'700',fontSize:12},
});

// ═══════════════════════════════════════════════════════════════════════════
//  ROOT
// ═══════════════════════════════════════════════════════════════════════════
export default function App() {
  const [screen,setScreen]=useState('splash');
  const [userName,setUser]=useState('');
  const [pStart,setPStart]=useState(null);
  if(screen==='splash')  return <SplashScreen  onDone={()=>setScreen('login')}/>;
  if(screen==='login')   return <LoginScreen   onLogin={n=>{setUser(n);setScreen('welcome');}} onGoSignup={()=>setScreen('signup')}/>;
  if(screen==='signup')  return <SignupScreen  onSignup={(n,p)=>{setUser(n);setPStart(p);setScreen('welcome');}} onGoLogin={()=>setScreen('login')}/>;
  if(screen==='welcome') return <WelcomeScreen name={userName} onContinue={()=>setScreen('main')}/>;
  return <MainApp userName={userName} initialPStart={pStart} onLogout={()=>{setUser('');setScreen('login');}}/>;
}
