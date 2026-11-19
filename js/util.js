/* MATCHDAY 0.4 — utilitários compartilhados (sem dependências externas).
   Todos os módulos usam o namespace global MD para funcionar via file:// sem ES modules. */
(function(MD){
'use strict';
const U={};
U.clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
U.lerp=(a,b,t)=>a+(b-a)*t;
U.smooth=t=>{t=U.clamp(t,0,1);return t*t*(3-2*t);};
U.easeOut=t=>{t=U.clamp(t,0,1);return 1-(1-t)*(1-t);};
U.easeIn=t=>{t=U.clamp(t,0,1);return t*t;};
U.easeInOut=t=>{t=U.clamp(t,0,1);return t<.5?2*t*t:1-Math.pow(-2*t+2,2)/2;};
U.dist=(ax,az,bx,bz)=>Math.hypot(bx-ax,bz-az);
U.angleLerp=(a,b,t)=>{let d=((b-a+Math.PI*3)%(Math.PI*2))-Math.PI;return a+d*t;};
U.wrapAngle=a=>((a+Math.PI*3)%(Math.PI*2))-Math.PI;

/* Gerador com semente (mulberry32): reproduz partidas a partir da mesma semente. */
U.rng=function(seed){let a=(seed>>>0)||1;const f=function(){a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};
 f.range=(lo,hi)=>lo+(hi-lo)*f();
 f.int=(lo,hi)=>Math.floor(lo+(hi-lo+1)*f());
 f.pick=arr=>arr[Math.floor(f()*arr.length)];
 f.chance=p=>f()<p;
 f.weighted=list=>{let tot=0;for(const it of list)tot+=Math.max(0,it[1]);let r=f()*tot;for(const it of list){r-=Math.max(0,it[1]);if(r<=0)return it[0];}return list[list.length-1][0];};
 f.gauss=()=>{let u=0,v=0;while(!u)u=f();while(!v)v=f();return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v);};
 f.state=()=>a;
 return f;};
U.hashStr=function(s){let h=2166136261;s=String(s);for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;};
U.logistic=x=>1/(1+Math.exp(-x));

U.escape=s=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
U.initials=s=>String(s||'').split(/\s+/).map(x=>x[0]||'').slice(0,2).join('').toUpperCase();
U.hex2rgb=h=>{let s=String(h||'#ffffff').replace('#','');if(s.length===3)s=s.split('').map(x=>x+x).join('');return[0,2,4].map(i=>(parseInt(s.slice(i,i+2),16)||0)/255);};
U.rgb2hex=c=>'#'+c.map(v=>Math.round(U.clamp(v,0,1)*255).toString(16).padStart(2,'0')).join('');
U.shade=(h,m)=>U.rgb2hex(U.hex2rgb(h).map(v=>v*m));
U.mixHex=(a,b,t)=>{const x=U.hex2rgb(a),y=U.hex2rgb(b);return U.rgb2hex(x.map((v,i)=>U.lerp(v,y[i],t)));};
U.colorDistance=(a,b)=>{const x=U.hex2rgb(a),y=U.hex2rgb(b);return Math.hypot((x[0]-y[0])*0.9,(x[1]-y[1])*1.2,(x[2]-y[2])*0.8);};
U.luma=h=>{const c=U.hex2rgb(h);return c[0]*.299+c[1]*.587+c[2]*.114;};
U.isHex=v=>/^#[0-9a-fA-F]{6}$/.test(v||'');
U.uid=p=>(p||'id')+'-'+Date.now().toString(36)+'-'+Math.floor(Math.random()*1e6).toString(36);
U.deepClone=o=>JSON.parse(JSON.stringify(o));
U.fmtClock=function(sec,phase){const m=Math.floor(sec/60),s=Math.floor(sec%60);
 if(phase==='first'&&m>=45)return '45+'+(m-45)+':'+String(s).padStart(2,'0');
 if(phase!=='first'&&m>=90)return '90+'+(m-90)+':'+String(s).padStart(2,'0');
 return String(m).padStart(2,'0')+':'+String(s).padStart(2,'0');};
U.minuteLabel=function(sec,half){const m=Math.floor(sec/60)+1;
 if(half==='first'&&m>45)return '45+'+(m-45);if(half==='second'&&m>90)return '90+'+(m-90);return String(Math.min(m,half==='first'?45:90));};

/* Matemática 3D compacta (column-major, compatível com WebGL). */
const M={};
M.create=()=>{const m=new Float32Array(16);m[0]=m[5]=m[10]=m[15]=1;return m;};
M.identity=o=>{o.fill(0);o[0]=o[5]=o[10]=o[15]=1;return o;};
M.perspective=(o,fovy,aspect,near,far)=>{const f=1/Math.tan(fovy/2),nf=1/(near-far);o.fill(0);o[0]=f/aspect;o[5]=f;o[10]=(far+near)*nf;o[11]=-1;o[14]=2*far*near*nf;return o;};
M.lookAt=(o,e,c,up)=>{let zx=e[0]-c[0],zy=e[1]-c[1],zz=e[2]-c[2],l=Math.hypot(zx,zy,zz)||1;zx/=l;zy/=l;zz/=l;
 let xx=up[1]*zz-up[2]*zy,xy=up[2]*zx-up[0]*zz,xz=up[0]*zy-up[1]*zx;l=Math.hypot(xx,xy,xz)||1;xx/=l;xy/=l;xz/=l;
 const yx=zy*xz-zz*xy,yy=zz*xx-zx*xz,yz=zx*xy-zy*xx;
 o[0]=xx;o[1]=yx;o[2]=zx;o[3]=0;o[4]=xy;o[5]=yy;o[6]=zy;o[7]=0;o[8]=xz;o[9]=yz;o[10]=zz;o[11]=0;
 o[12]=-(xx*e[0]+xy*e[1]+xz*e[2]);o[13]=-(yx*e[0]+yy*e[1]+yz*e[2]);o[14]=-(zx*e[0]+zy*e[1]+zz*e[2]);o[15]=1;return o;};
M.mul=(o,a,b)=>{const a00=a[0],a01=a[1],a02=a[2],a03=a[3],a10=a[4],a11=a[5],a12=a[6],a13=a[7],a20=a[8],a21=a[9],a22=a[10],a23=a[11],a30=a[12],a31=a[13],a32=a[14],a33=a[15];
 for(let i=0;i<4;i++){const b0=b[i*4],b1=b[i*4+1],b2=b[i*4+2],b3=b[i*4+3];
  o[i*4]=b0*a00+b1*a10+b2*a20+b3*a30;o[i*4+1]=b0*a01+b1*a11+b2*a21+b3*a31;o[i*4+2]=b0*a02+b1*a12+b2*a22+b3*a32;o[i*4+3]=b0*a03+b1*a13+b2*a23+b3*a33;}return o;};
/* Matriz afim de transformação: translação + rotação (yaw Y, pitch X, roll Z na ordem Y*X*Z) + escala. */
M.compose=(o,tx,ty,tz,ry,rx,rz,sx,sy,sz)=>{const cy=Math.cos(ry),sy_=Math.sin(ry),cx=Math.cos(rx),sx_=Math.sin(rx),cz=Math.cos(rz),sz_=Math.sin(rz);
 const m00=cy*cz+sy_*sx_*sz_,m01=cx*sz_,m02=-sy_*cz+cy*sx_*sz_;
 const m10=-cy*sz_+sy_*sx_*cz,m11=cx*cz,m12=sy_*sz_+cy*sx_*cz;
 const m20=sy_*cx,m21=-sx_,m22=cy*cx;
 o[0]=m00*sx;o[1]=m01*sx;o[2]=m02*sx;o[3]=0;o[4]=m10*sy;o[5]=m11*sy;o[6]=m12*sy;o[7]=0;o[8]=m20*sz;o[9]=m21*sz;o[10]=m22*sz;o[11]=0;o[12]=tx;o[13]=ty;o[14]=tz;o[15]=1;return o;};
M.translate=(o,a,x,y,z)=>{if(o!==a)o.set(a);o[12]=a[0]*x+a[4]*y+a[8]*z+a[12];o[13]=a[1]*x+a[5]*y+a[9]*z+a[13];o[14]=a[2]*x+a[6]*y+a[10]*z+a[14];o[15]=a[3]*x+a[7]*y+a[11]*z+a[15];return o;};
M.rotX=(o,a,r)=>{const s=Math.sin(r),c=Math.cos(r),a10=a[4],a11=a[5],a12=a[6],a13=a[7],a20=a[8],a21=a[9],a22=a[10],a23=a[11];if(o!==a){o.set(a);}
 o[4]=a10*c+a20*s;o[5]=a11*c+a21*s;o[6]=a12*c+a22*s;o[7]=a13*c+a23*s;o[8]=a20*c-a10*s;o[9]=a21*c-a11*s;o[10]=a22*c-a12*s;o[11]=a23*c-a13*s;return o;};
M.rotY=(o,a,r)=>{const s=Math.sin(r),c=Math.cos(r),a00=a[0],a01=a[1],a02=a[2],a03=a[3],a20=a[8],a21=a[9],a22=a[10],a23=a[11];if(o!==a){o.set(a);}
 o[0]=a00*c-a20*s;o[1]=a01*c-a21*s;o[2]=a02*c-a22*s;o[3]=a03*c-a23*s;o[8]=a00*s+a20*c;o[9]=a01*s+a21*c;o[10]=a02*s+a22*c;o[11]=a03*s+a23*c;return o;};
M.rotZ=(o,a,r)=>{const s=Math.sin(r),c=Math.cos(r),a00=a[0],a01=a[1],a02=a[2],a03=a[3],a10=a[4],a11=a[5],a12=a[6],a13=a[7];if(o!==a){o.set(a);}
 o[0]=a00*c+a10*s;o[1]=a01*c+a11*s;o[2]=a02*c+a12*s;o[3]=a03*c+a13*s;o[4]=a10*c-a00*s;o[5]=a11*c-a01*s;o[6]=a12*c-a02*s;o[7]=a13*c-a03*s;return o;};
M.scale=(o,a,x,y,z)=>{if(o!==a)o.set(a);for(let i=0;i<4;i++){o[i]*=x;o[4+i]*=y;o[8+i]*=z;}return o;};
M.transformPoint=(m,x,y,z,out)=>{out=out||[0,0,0];out[0]=m[0]*x+m[4]*y+m[8]*z+m[12];out[1]=m[1]*x+m[5]*y+m[9]*z+m[13];out[2]=m[2]*x+m[6]*y+m[10]*z+m[14];return out;};
/* Planos do frustum a partir da matriz view-projection, para culling de esferas. */
M.frustum=(vp,planes)=>{const r=(i,a,b,c,d)=>{const l=Math.hypot(a,b,c)||1;planes[i*4]=a/l;planes[i*4+1]=b/l;planes[i*4+2]=c/l;planes[i*4+3]=d/l;};
 r(0,vp[3]+vp[0],vp[7]+vp[4],vp[11]+vp[8],vp[15]+vp[12]);r(1,vp[3]-vp[0],vp[7]-vp[4],vp[11]-vp[8],vp[15]-vp[12]);
 r(2,vp[3]+vp[1],vp[7]+vp[5],vp[11]+vp[9],vp[15]+vp[13]);r(3,vp[3]-vp[1],vp[7]-vp[5],vp[11]-vp[9],vp[15]-vp[13]);
 r(4,vp[3]+vp[2],vp[7]+vp[6],vp[11]+vp[10],vp[15]+vp[14]);r(5,vp[3]-vp[2],vp[7]-vp[6],vp[11]-vp[10],vp[15]-vp[14]);return planes;};
M.sphereVisible=(planes,x,y,z,r)=>{for(let i=0;i<6;i++){if(planes[i*4]*x+planes[i*4+1]*y+planes[i*4+2]*z+planes[i*4+3]<-r)return false;}return true;};
U.M=M;
MD.U=U;
})(typeof window!=='undefined'?(window.MD=window.MD||{}):(globalThis.MD=globalThis.MD||{}));
