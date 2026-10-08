import {BufferGeometry, Float32BufferAttribute, Group, Mesh, MeshStandardMaterial} from 'three';

const TAU=Math.PI*2;
const finite=value=>Number.isFinite(value)?value:0;
const clamp=(value,min,max)=>Math.max(min,Math.min(max,finite(value)));

/** An original block-built, older Indonesian statesman caricature. Metres/Y-up,
 * feet at (0,0,0), facing -Z. Visual only: it neither owns nor changes collision.
 * update() takes actual horizontal distance travelled this frame, NOT key state.
 * Return its {changed,active} flags to an on-demand renderer; idle settles fully.
 */
export function createAvatar() {
  const root=new Group();root.name='navigation-avatar';root.visible=false;
  const pose=new Group();pose.name='avatar-pose';root.add(pose);
  const upper=new Group();upper.name='avatar-upper-body';upper.position.y=-.08;pose.add(upper);
  const geometries=new Set(),materials=new Set();
  const material=(name,color,roughness=.88)=>{const m=new MeshStandardMaterial({color,roughness,metalness:0,flatShading:true});m.name=name;materials.add(m);return m;};
  const palette={skin:material('warm skin',0xd5a278),hair:material('black side-parted hair',0x202322),temple:material('subtle grey temples',0x565853),shirt:material('light-blue cotton',0x86b8d5),collar:material('collar and cuffs',0xa9cce2),seam:material('shirt stitching',0x527f9b),trousers:material('charcoal trousers',0x323d47),shoe:material('dark shoes',0x20282c,.68),eye:material('eyes and brows',0x2a2927),mouth:material('warm expression',0x875c48)};

  function geometry(positions) {
    const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(positions,3));g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();geometries.add(g);return g;
  }
  function ring(y,w,d,b) {return [[-w+b,y,-d],[w-b,y,-d],[w,y,-d+b],[w,y,d-b],[w-b,y,d],[-w+b,y,d],[-w,y,d-b],[-w,y,-d+b]];}
  function ringsGeometry(rings) {
    const p=[],tri=(a,b,c)=>p.push(...a,...b,...c);
    for(let j=0;j<rings.length-1;j++)for(let i=0;i<8;i++){const n=(i+1)%8;tri(rings[j][i],rings[j+1][i],rings[j+1][n]);tri(rings[j][i],rings[j+1][n],rings[j][n]);}
    for(let i=0;i<8;i++){tri([0,rings[0][0][1],0],rings[0][i],rings[0][(i+1)%8]);const t=rings.length-1;tri([0,rings[t][0][1],0],rings[t][(i+1)%8],rings[t][i]);}
    return geometry(p);
  }
  const block=ringsGeometry([ring(-.5,.445,.445,.07),ring(-.44,.5,.5,.1),ring(.44,.5,.5,.1),ring(.5,.445,.445,.07)]);
  const box=geometry([
    -.5,-.5,-.5,-.5,.5,-.5,.5,.5,-.5, -.5,-.5,-.5,.5,.5,-.5,.5,-.5,-.5,
    .5,-.5,.5,.5,.5,.5,-.5,.5,.5, .5,-.5,.5,-.5,.5,.5,-.5,-.5,.5,
    -.5,-.5,.5,-.5,.5,.5,-.5,.5,-.5, -.5,-.5,.5,-.5,.5,-.5,-.5,-.5,-.5,
    .5,-.5,-.5,.5,.5,-.5,.5,.5,.5, .5,-.5,-.5,.5,.5,.5,.5,-.5,.5,
    -.5,.5,-.5,-.5,.5,.5,.5,.5,.5, -.5,.5,-.5,.5,.5,.5,.5,.5,-.5,
    -.5,-.5,.5,-.5,-.5,-.5,.5,-.5,-.5, -.5,-.5,.5,.5,-.5,-.5,.5,-.5,.5,
  ]);
  function mesh(name,g,mat,parent=upper,position=[0,0,0],scale=[1,1,1]){const m=new Mesh(g,mat);m.name=name;m.position.fromArray(position);m.scale.fromArray(scale);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
  function mergedBlocks(parts) {
    const p=[],source=box.attributes.position.array;
    for(const {position:[x,y,z],scale:[sx,sy,sz],angle=0} of parts){const c=Math.cos(angle),s=Math.sin(angle);for(let i=0;i<source.length;i+=3){const a=source[i]*sx,b=source[i+1]*sy;p.push(x+c*a-s*b,y+s*a+c*b,z+source[i+2]*sz);}}
    return geometry(p);
  }
  const part=(position,scale,angle=0)=>({position,scale,angle});
  mesh('avatar-shirt',block,palette.shirt,upper,[0,.922,0],[.374,.496,.255]);
  mesh('avatar-waist',block,palette.trousers,upper,[0,.66,0],[.332,.08,.227]);
  mesh('avatar-neck',block,palette.skin,upper,[0,1.202,0],[.132,.105,.134]);
  mesh('avatar-collar',mergedBlocks([
    part([-.05,1.14,-.127],[.076,.092,.012],-.48),part([.05,1.14,-.127],[.076,.092,.012],.48),
    part([0,1.174,.059],[.17,.035,.047]),
  ]),palette.collar);
  mesh('avatar-shirt-details',mergedBlocks([
    part([0,.934,-.129],[.009,.321,.003]),
    ...[.79,.865,.94,1.015].map(y=>part([.004,y,-.133],[.014,.014,.006])),
    part([-.099,1.014,-.129],[.066,.007,.005]),part([-.131,.978,-.129],[.004,.07,.004]),
    part([-.067,.978,-.129],[.004,.07,.004]),part([-.099,.943,-.129],[.066,.004,.004]),
    part([0,.714,.127],[.008,.052,.003]),
  ]),palette.seam);

  const head=new Group();head.name='avatar-head';head.position.set(0,1.405,-.006);upper.add(head);
  // Wide cheeks, a narrower chin and a very short neck create the likeness at
  // navigation scale while keeping a recognizably block-built silhouette.
  const face=new Group();face.name='avatar-face';face.position.z=-.004;head.add(face);
  mesh('avatar-head-shape',ringsGeometry([
    ring(-.178,.103,.08,.032),ring(-.143,.157,.111,.044),ring(-.075,.19,.132,.048),
    ring(.028,.192,.13,.049),ring(.11,.172,.117,.043),ring(.178,.135,.094,.038),
  ]),palette.skin,face);
  mesh('avatar-face-shapes',mergedBlocks([
    part([-.19,-.012,.008],[.038,.086,.075],-.1),part([.19,-.012,.008],[.038,.086,.075],.1),
  ]),palette.skin,face);
  mesh('avatar-nose',block,palette.skin,face,[0,-.016,-.147],[.06,.06,.058]);
  const hairline=ring(.11,.174,.119,.038);
  [.13,.11,.074,.065,.065,.065,.074,.116].forEach((y,i)=>hairline[i][1]=y);
  const hair=ringsGeometry([hairline,ring(.177,.164,.118,.039),ring(.213,.136,.096,.042)]);
  mesh('avatar-hair',hair,palette.hair,head);
  mesh('avatar-hair-sweep',mergedBlocks([
    part([-.045,.151,-.116],[.213,.033,.023],.07),
    part([.115,.137,-.116],[.055,.037,.022],-.15),
    part([-.176,.065,.012],[.012,.052,.087]),part([.176,.065,.012],[.012,.052,.087]),
  ]),palette.hair,head);
  mesh('avatar-hair-part',mergedBlocks([part([.07,.177,-.116],[.006,.038,.007]),part([.059,.214,-.014],[.006,.002,.15])]),palette.temple,head);
  mesh('avatar-temples',mergedBlocks([
    part([-.18,.04,.022],[.007,.037,.045]),part([.18,.04,.022],[.007,.037,.045]),
  ]),palette.temple,head);
  mesh('avatar-eyes-and-brows',mergedBlocks([
    part([-.073,.035,-.134],[.044,.011,.006],-.025),part([.073,.035,-.134],[.044,.011,.006],.025),
    part([-.077,.065,-.132],[.063,.012,.006],.035),part([.077,.065,-.132],[.063,.012,.006],-.035),
  ]),palette.eye,face);
  mesh('avatar-expression',mergedBlocks([
    part([-.018,-.096,-.138],[.038,.007,.005],-.06),part([.018,-.096,-.138],[.038,.007,.005],.06),
    part([-.041,-.092,-.137],[.013,.006,.005],-.48),part([.041,-.092,-.137],[.013,.006,.005],.48),
    part([-.023,-.049,-.172],[.011,.004,.005]),part([.023,-.049,-.172],[.011,.004,.005]),
  ]),palette.mouth,face);

  const arms=[],legs=[];
  for(const sign of [-1,1]) {
    const side=sign<0?'left':'right';
    const arm=new Group();arm.name=`avatar-${side}-arm`;arm.position.set(sign*.204,1.123,0);upper.add(arm);arms.push(arm);
    mesh(`avatar-${side}-sleeve`,block,palette.shirt,arm,[0,-.145,0],[.118,.326,.159]);
    mesh(`avatar-${side}-hand`,block,palette.skin,arm,[0,-.382,-.004],[.091,.151,.116]);
    mesh(`avatar-${side}-cuff`,box,palette.collar,arm,[0,-.303,0],[.119,.025,.159]);
    const leg=new Group();leg.name=`avatar-${side}-leg`;leg.position.set(sign*.089,.58,0);pose.add(leg);legs.push(leg);
    mesh(`avatar-${side}-trouser`,block,palette.trousers,leg,[0,-.225,0],[.15,.446,.183]);
    mesh(`avatar-${side}-shoe`,block,palette.shoe,leg,[0,-.52,-.033],[.158,.12,.252]);
  }
  const stats={meshes:0,triangles:0,geometries:geometries.size,materials:materials.size,textureBytes:0};
  root.traverse(n=>{if(n.isMesh){stats.meshes++;stats.triangles+=(n.geometry.index?.count||n.geometry.attributes.position.count)/3;}});Object.freeze(stats);
  const durations={wave:2.4,cheer:2.6,dance:2.8,smoke:3.4,sit:0,chill:0};
  const channels=[
    [legs[0].rotation,'x'],[legs[1].rotation,'x'],
    [arms[0].rotation,'x'],[arms[1].rotation,'x'],
    [arms[0].rotation,'z'],[arms[1].rotation,'z'],
    [pose.position,'y'],[pose.rotation,'x'],[pose.rotation,'z'],
    [head.rotation,'x'],[head.rotation,'z'],[arms[1].scale,'y'],
  ];
  // Targets reuse one tiny array; actions never allocate meshes or materials.
  const rest=new Float64Array(channels.length);rest[11]=1;
  const target=new Float64Array(rest);
  const smooth=value=>{const v=clamp(value,0,1);return v*v*(3-2*v);};
  const damp=(value,to,elapsed,rate=18)=>{
    const result=value+(to-value)*(1-Math.exp(-elapsed*rate));
    return Math.abs(result-to)<.0001?to:result;
  };
  let phase=0,strength=0,airPhase=0,airStrength=0,disposed=false;
  let emote=null,emoteTime=0,emotePhase='none',mode='idle',active=false;
  let lastGrounded=true,lastFlying=false,lastMoving=false;
  const set=(object,property,value)=>{if(Math.abs(object[property]-value)<1e-7)return false;object[property]=value;return true;};
  function endEmote(reason){if(!emote)return false;emote=null;emoteTime=0;emotePhase=reason;return true;}
  function playEmote(name){
    if(disposed||!Object.hasOwn(durations,name)||!lastGrounded||lastFlying||lastMoving)return false;
    emote=name;emoteTime=0;emotePhase='playing';mode='emote';active=root.visible;return true;
  }
  function cancelEmote(){
    if(disposed||!endEmote('cancelled'))return false;
    mode='idle';active=root.visible;return true;
  }
  function getState(){return {mode,emote,emoteTime,emotePhase,phase,strength,headPitch:head.rotation.x,grounded:lastGrounded,flying:lastFlying,moving:lastMoving,visible:root.visible,active,disposed};}
  function reset(){
    if(disposed)return;
    phase=0;strength=0;airPhase=0;airStrength=0;emote=null;emoteTime=0;emotePhase='none';mode='idle';active=false;
    lastGrounded=true;lastFlying=false;lastMoving=false;
    for(let i=0;i<channels.length;i++){const [object,property]=channels[i];object[property]=rest[i];}
  }
  function update({distance=0,dt=0,pitch=0,visible=true,grounded=true,flying=false,verticalSpeed=0,sprinting=false,moving=false}={}) {
    if(disposed)return {changed:false,active:false};
    let changed=root.visible!==Boolean(visible);root.visible=Boolean(visible);
    const elapsed=clamp(dt,0,.1),travel=clamp(distance,0,.4),rise=clamp(verticalSpeed,-100,100);
    const isFlying=Boolean(flying),onGround=Boolean(grounded)&&!isFlying;
    const travelled=elapsed>0&&travel>1e-6;
    lastGrounded=onGround;lastFlying=isFlying;lastMoving=Boolean(moving)||travelled;
    if(!visible||lastMoving||!onGround)endEmote('cancelled');
    // Hidden first-person never advances transforms or a latent one-shot action.
    if(!visible){active=false;mode=isFlying?'fly':onGround?'idle':rise>0?'jump':'fall';return {changed,active};}
    target.set(rest);
    const walking=onGround&&travelled;
    if(walking)phase=(phase+travel*TAU/.86*(sprinting?1.22:1))%TAU;
    strength=damp(strength,walking?clamp(travel/elapsed/2.4,.12,1.2):0,elapsed);
    const flyingMoving=isFlying&&(lastMoving||Math.abs(rise)>.03);
    airStrength=damp(airStrength,flyingMoving?1:0,elapsed);
    if(flyingMoving)airPhase=(airPhase+elapsed*3.5)%TAU;
    if(isFlying){
      mode='fly';const flutter=Math.sin(airPhase)*airStrength;
      target[0]=.16+flutter*.07;target[1]=.16-flutter*.07;
      target[2]=2.12+flutter*.04;target[3]=2.12-flutter*.04;
      target[4]=-.12;target[5]=.12;target[6]=flutter*.012;target[7]=-.14-airStrength*.08;
    }else if(!onGround){
      mode=rise>0?'jump':'fall';
      const tuck=rise>0?.30+clamp(rise/5,0,1)*.12:.065-clamp(-rise/8,0,1)*.05;
      target[0]=tuck;target[1]=tuck;target[2]=rise>0?.48:-.18;target[3]=target[2];
      target[4]=-.14;target[5]=.14;target[7]=rise>0?-.045:.035;
    }else{
      mode=walking?(sprinting?'sprint':'walk'):'idle';
      const swing=Math.sin(phase)*(sprinting?.76:.50)*strength;
      target[0]=swing;target[1]=-swing;target[2]=-swing*(sprinting?.84:.66);target[3]=-target[2];
      target[6]=Math.abs(Math.sin(phase*2))*(sprinting?.021:.012)*strength;
      target[7]=-(sprinting?.065:.008)*strength;
    }
    if(emote){
      const duration=durations[emote],held=duration===0;
      emoteTime=held?Math.min(.65,emoteTime+elapsed):emoteTime+elapsed;
      if(!held&&emoteTime>=duration){endEmote('finished');mode='idle';}
      else{
        mode='emote';target.set(rest);
        const t=emoteTime,envelope=held?1:smooth(t/.25)*smooth((duration-t)/.35),beat=Math.sin(t*TAU*2);
        if(emote==='wave'){
          target[3]=.12;target[5]=2.25+Math.sin(t*TAU*2.4)*.25;target[10]=-.055;
        }else if(emote==='cheer'){
          target[2]=.17;target[3]=.17;target[4]=-2.62-beat*.06;target[5]=2.62+beat*.06;
          target[6]=(1-Math.cos(t*TAU*2))*.018;
        }else if(emote==='dance'){
          target[0]=beat*.24;target[1]=-beat*.24;target[2]=beat*.65;target[3]=-beat*.65;
          target[4]=-.50-beat*.18;target[5]=.50-beat*.18;target[6]=Math.abs(beat)*.022;
          target[8]=beat*.08;target[10]=-beat*.07;
        }else if(emote==='sit'){
          target[0]=1.48;target[1]=1.48;target[2]=.76;target[3]=.76;
          target[4]=-.09;target[5]=.09;target[6]=-.42;
        }else if(emote==='chill'){
          target[0]=1.48;target[1]=1.36;target[2]=.85;target[3]=.10;
          target[4]=-.14;target[5]=.70;target[6]=-.43;target[7]=.14;target[10]=-.08;
        }else if(emote==='smoke'){
          // Stylized hand-to-mouth gesture only: no branded prop or particles.
          target[3]=2.48+Math.sin(t*2)*.02;target[5]=-.71;target[10]=-.045;target[11]=.82;
        }
        for(let i=0;i<target.length;i++)target[i]=rest[i]+(target[i]-rest[i])*envelope;
      }
    }
    target[9]=clamp(pitch,-.35,.35);
    let settling=false;
    for(let i=0;i<channels.length;i++){
      const [object,property]=channels[i],value=damp(object[property],target[i],elapsed,i===9?20:18);
      changed=set(object,property,value)||changed;if(value!==target[i])settling=true;
    }
    const held=emote!==null&&durations[emote]===0;
    if(held)emotePhase=emoteTime>=.65&&!settling?'held':'playing';
    active=walking||flyingMoving||strength>0||airStrength>0||settling||Boolean(emote&&(!held||emotePhase!=='held'));
    return {changed,active};
  }
  function dispose(){if(disposed)return;disposed=true;active=false;emote=null;emoteTime=0;emotePhase='none';root.removeFromParent();for(const g of geometries)g.dispose();for(const m of materials)m.dispose();}
  reset();return {root,update,reset,dispose,stats,playEmote,cancelEmote,getState};
}
