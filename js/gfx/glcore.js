/* MATCHDAY 0.5 — núcleo WebGL2: programas, malhas indexadas, lotes instanciados (1 draw call por primitiva),
   malha estática do estádio, atlas de texturas. Nenhum objeto é criado por quadro: buffers pré-alocados. */
(function(MD){
'use strict';
const G={};
function compile(gl,type,src){const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error('Shader: '+gl.getShaderInfoLog(s)+'\n'+src.split('\n').slice(0,4).join(' '));return s;}
G.program=function(gl,vs,fs){const p=gl.createProgram();gl.attachShader(p,compile(gl,gl.VERTEX_SHADER,vs));gl.attachShader(p,compile(gl,gl.FRAGMENT_SHADER,fs));gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error('Link: '+gl.getProgramInfoLog(p));
 const u={},n=gl.getProgramParameter(p,gl.ACTIVE_UNIFORMS);for(let i=0;i<n;i++){const info=gl.getActiveUniform(p,i);u[info.name.replace('[0]','')]=gl.getUniformLocation(p,info.name);}return{p,u};};
const NOISE=`float hash(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float vnoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}`;
const LIGHT=`uniform vec3 uEye;uniform vec3 uSun;uniform vec3 uSky;uniform vec3 uGround;uniform vec3 uFog;uniform float uFlash;uniform float uExposure;
vec3 shade(vec3 base,vec3 n,vec3 w,int m){vec3 v=normalize(uEye-w);float hemi=n.y*.5+.5;vec3 amb=mix(uGround,uSky,hemi);
 float ndl=dot(n,uSun);float diff=m==1?clamp((ndl+.4)/1.4,0.,1.):max(ndl,0.);
 vec3 c=base*(amb*.66+diff*vec3(1.,.96,.88)*.7);
 float rim=pow(1.-max(dot(n,v),0.),3.);c+=rim*(m==1?vec3(.95,.62,.48)*base*.35:base*.22+.03);
 if(m==2||m==7){vec3 h=normalize(uSun+v);c+=pow(max(dot(n,h),0.),m==7?70.:28.)*(m==7?.85:.4);}
 if(m==3){vec3 h=normalize(uSun+v);c+=pow(max(dot(n,h),0.),14.)*.1;}
 if(m==6||m==9||m==10)c=base*(m==10?1.6:1.12);
 c+=uFlash*base*.3;float d=length(uEye-w);c=mix(c,uFog,clamp((d-95.)/260.,0.,.6));
 c*=uExposure;c=c/(1.+c*.1);return pow(c,vec3(.96));}`;
/* Programa de partes instanciadas (personagens, bola, adereços) */
G.PART_VS=`#version 300 es
layout(location=0) in vec3 aPos;layout(location=1) in vec3 aNor;layout(location=2) in vec2 aUV;
layout(location=3) in vec4 iM0;layout(location=4) in vec4 iM1;layout(location=5) in vec4 iM2;layout(location=6) in vec4 iM3;layout(location=7) in vec4 iCol;layout(location=8) in vec4 iUV;
uniform mat4 uVP;out vec3 vN;out vec3 vW;out vec4 vCol;out vec2 vUV;flat out vec4 vRect;
void main(){mat4 M=mat4(iM0,iM1,iM2,iM3);vec4 w=M*vec4(aPos,1.);vW=w.xyz;vec3 s2=vec3(dot(M[0].xyz,M[0].xyz),dot(M[1].xyz,M[1].xyz),dot(M[2].xyz,M[2].xyz));
 vN=mat3(M)*(aNor/max(s2,vec3(1e-9)));vCol=iCol;vUV=aUV;vRect=iUV;gl_Position=uVP*w;}`;
G.PART_FS=`#version 300 es
precision highp float;in vec3 vN;in vec3 vW;in vec4 vCol;in vec2 vUV;flat in vec4 vRect;uniform sampler2D uAtlas;uniform float uTime;out vec4 o;
${LIGHT}
void main(){int m=int(vCol.a+.5);
 if(m==5){float r=length(vUV-.5)*2.;float a=(1.-smoothstep(.15,1.,r))*vCol.r;if(a<.01)discard;o=vec4(0.,0.,0.,a);return;}
 vec3 base=vCol.rgb;
 if(vRect.z>0.){vec2 uv=vRect.xy+clamp(vUV,0.,1.)*vRect.zw;if(m==9)uv.x=vRect.x+fract(vUV.x+uTime*.04)*vRect.z;vec4 tx=texture(uAtlas,uv);
  if(m==4){if(tx.a<.45)discard;base=vCol.rgb;}else base=tx.rgb;}
 vec3 n=normalize(vN);if(!gl_FrontFacing)n=-n;o=vec4(shade(base,n,vW,m),1.);}`;
/* Programa estático (estádio, gramado procedural, redes com deformação) */
G.STATIC_VS=`#version 300 es
layout(location=0) in vec3 aPos;layout(location=1) in vec3 aNor;layout(location=2) in vec4 aCol;layout(location=3) in vec2 aUV;
uniform mat4 uVP;uniform vec4 uNet0;uniform vec4 uNet1;uniform float uTime;out vec3 vN;out vec3 vW;out vec4 vCol;out vec2 vUV;
void main(){vec3 p=aPos;int m=int(aCol.a+.5);
 if(m==8){for(int k=0;k<2;k++){vec4 h=k==0?uNet0:uNet1;if(h.w>0.){float d=length(p-h.xyz);p.x+=sign(p.x)*h.w*exp(-d*d*.9)*.9;}}p.x+=sign(p.x)*sin(uTime*1.7+p.z*2.+p.y*3.)*.008;}
 vN=aNor;vW=p;vCol=aCol;vUV=aUV;gl_Position=uVP*vec4(p,1.);}`;
G.STATIC_FS=`#version 300 es
precision highp float;in vec3 vN;in vec3 vW;in vec4 vCol;in vec2 vUV;uniform sampler2D uAtlas;uniform float uTime;uniform vec4 uScreenRect;uniform vec4 uAdsRect;out vec4 o;
${LIGHT}
${NOISE}
void main(){int m=int(vCol.a+.5);vec3 base=vCol.rgb;vec3 n=normalize(vN);
 if(m==1){float st=step(.5,fract((vW.x+54.)/6.75));float cr=step(.5,fract((vW.z+34.)/68.*1.0));vec3 g1=vec3(.17,.46,.24),g2=vec3(.21,.53,.28);base=mix(g1,g2,st);
  float nz=vnoise(vW.xz*1.9)*.07+vnoise(vW.xz*.31)*.09+vnoise(vW.xz*7.)*.04;base*=.9+nz;
  float wear=exp(-pow(length(vW.xz-vec2(48.5,0.)),2.)/60.)+exp(-pow(length(vW.xz-vec2(-48.5,0.)),2.)/60.);base=mix(base,vec3(.36,.42,.25),wear*.22);}
 if(m==6){base=texture(uAtlas,uScreenRect.xy+vUV*uScreenRect.zw).rgb;}
 if(m==9){vec2 uv=uAdsRect.xy+vec2(fract(vUV.x+uTime*.035),vUV.y)*uAdsRect.zw;base=texture(uAtlas,uv).rgb;}
 if(m==8){base=vec3(.93);}
 if(m==11){/* grama sintética (Germinare): verde uniforme, fibras e leve desgaste */float nz=vnoise(vW.xz*5.3)*.07+vnoise(vW.xz*.55)*.08+hash(floor(vW.xz*38.))*.05;base=vec3(.235,.4,.17)*(.9+nz)+vec3(.012,.018,0.)*step(.5,fract(vW.x/5.));
  float wear=exp(-pow(length(vW.xz-vec2(17.,0.)),2.)/9.)+exp(-pow(length(vW.xz-vec2(-17.,0.)),2.)/9.)+exp(-dot(vW.xz,vW.xz)/6.);base=mix(base,vec3(.36,.43,.25),wear*.25);}
 if(m==12){/* madeira com veios */float gr=vnoise(vec2((vW.x+vW.z)*.45,vW.y*22.+vW.x*.2))*.3+vnoise(vec2((vW.x-vW.z)*3.,vW.y*60.))*.08;base*=.82+gr;}
 if(m==13){/* vidro escuro das janelas */float f=pow(1.-max(dot(n,normalize(uEye-vW)),0.),2.);base=mix(base,vec3(.62,.68,.74),.18+f*.45);}
 if(m==14){/* piso de placas de concreto */vec2 g=fract(vW.xz/1.2);float j=step(.04,g.x)*step(.04,g.y);base*=mix(.8,1.,j)*(.94+vnoise(vW.xz*.7)*.08+hash(floor(vW.xz/1.2))*.06);}
 o=vec4(shade(base,n,vW,m==11?1:m),1.);if(m==8)o.a=1.;}`;
/* Torcida: sprites "de papelão" instanciados, animação inteiramente na GPU */
G.CROWD_VS=`#version 300 es
layout(location=0) in vec2 aC;layout(location=1) in vec4 iP;layout(location=2) in vec4 iC;
uniform mat4 uVP;uniform vec3 uRight;uniform float uTime;uniform vec2 uExcite;out vec2 vUV;out vec4 vCol;out float vArms;out float vSeed;out float vShade;
void main(){float s=iP.w;float ex=iC.a<.5?uExcite.x:uExcite.y;ex=max(ex,.08);
 float b=abs(sin(uTime*(5.5+fract(s*13.)*4.)+s*40.))*.32*ex*step(.25,fract(s*3.7))+sin(uTime*1.1+s*20.)*.015;
 vec3 p=iP.xyz+uRight*aC.x*.66+vec3(0.,aC.y*1.18+b,0.);vUV=aC;vCol=iC;vSeed=s;vArms=step(.6,ex)*step(.3,fract(s*7.31));vShade=.75+fract(s*5.3)*.3;gl_Position=uVP*vec4(p,1.);}`;
G.CROWD_FS=`#version 300 es
precision mediump float;in vec2 vUV;in vec4 vCol;in float vArms;in float vSeed;in float vShade;uniform vec3 uFog;uniform float uFlash;out vec4 o;
void main(){vec2 p=vUV;vec3 skin=mix(vec3(.93,.72,.58),vec3(.38,.23,.15),fract(vSeed*17.3));
 float head=step(length((p-vec2(0.,.8))*vec2(1.,1.08)),.155);
 float sh=.33-max(0.,p.y-.5)*.55;float body=step(abs(p.x),sh)*step(0.,p.y)*step(p.y,.66);
 float arms=vArms*(step(abs(abs(p.x)-.31),.06)*step(.5,p.y)*step(p.y,1.));
 float a=max(max(head,body),arms);if(a<.5)discard;vec3 c=head>.5?skin:vCol.rgb;if(arms>.5&&body<.5)c=mix(vCol.rgb,skin,step(.9,p.y));
 c*=vShade*(.55+p.y*.55);c+=uFlash*.25;o=vec4(mix(c,uFog,.18),1.);}`;
/* Bandeiras, bandeirões e bandeirinhas: malha de tecido ondulando no vertex shader */
G.FLAG_VS=`#version 300 es
layout(location=0) in vec2 aG;layout(location=1) in vec4 iO;layout(location=2) in vec4 iS;layout(location=3) in vec4 iC1;layout(location=4) in vec4 iC2;
uniform mat4 uVP;uniform float uTime;uniform float uWave;out vec2 vUV;out vec4 vC1;out vec4 vC2;out float vSh;
void main(){float yaw=iO.w;vec3 r=vec3(cos(yaw),0.,-sin(yaw));vec3 f=vec3(sin(yaw),0.,cos(yaw));float u=aG.x,v=aG.y;
 float amp=iS.z*(.35+uWave);float wv=sin(uTime*(2.4+iS.w)+u*5.5+iC1.a*7.)*amp*u+sin(uTime*1.3+v*3.)*amp*.3*u;
 vec3 p=iO.xyz+r*u*iS.x-vec3(0.,v*iS.y,0.)+f*wv;vUV=aG;vC1=iC1;vC2=iC2;vSh=.82+.18*cos(uTime*(2.4+iS.w)+u*5.5);gl_Position=uVP*vec4(p,1.);}`;
G.FLAG_FS=`#version 300 es
precision mediump float;in vec2 vUV;in vec4 vC1;in vec4 vC2;in float vSh;uniform float uFlash;out vec4 o;
void main(){int pat=int(vC2.a+.5);vec3 c=vC1.rgb;
 if(pat==1)c=mix(vC1.rgb,vC2.rgb,step(.5,fract(vUV.x*3.)));else if(pat==2)c=mix(vC1.rgb,vC2.rgb,step(.5,fract(vUV.y*3.)));else if(pat==3)c=mix(vC1.rgb,vC2.rgb,step(.5,vUV.x));
 else if(pat==4)c=mix(vC1.rgb,vC2.rgb,step(length((vUV-.5)*vec2(1.6,1.)),.28));
 o=vec4(c*vSh+uFlash*.2,1.);}`;
/* Partículas (confete, fogos): movimento calculado no shader a partir do instante de disparo */
G.PART_FX_VS=`#version 300 es
layout(location=0) in vec2 aC;layout(location=1) in vec4 iO;layout(location=2) in vec4 iV;layout(location=3) in vec4 iC;
uniform mat4 uVP;uniform vec3 uRight;uniform vec3 uUp;uniform float uTime;out vec4 vC;out vec2 vUV;
void main(){float t=uTime-iO.w;float life=iV.w;if(t<0.||t>life){gl_Position=vec4(2.,2.,2.,1.);return;}
 vec3 p=iO.xyz+iV.xyz*t+vec3(0.,-4.9*iC.a*t*t,0.);p.x+=sin(t*6.+iO.x)*.3*(1.-iC.a);float sz=.18+.14*(1.-iC.a);
 p+=(uRight*aC.x+uUp*aC.y)*sz*(1.-t/life*.5);vC=vec4(iC.rgb,1.-t/life);vUV=aC;gl_Position=uVP*vec4(p,1.);}`;
G.PART_FX_FS=`#version 300 es
precision mediump float;in vec4 vC;in vec2 vUV;out vec4 o;void main(){if(length(vUV)>.5)discard;o=vec4(vC.rgb*1.4,vC.a);}`;

/* Malha indexada com posição, normal, UV */
G.mesh=function(gl,data){const vao=gl.createVertexArray();gl.bindVertexArray(vao);const vb=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,vb);gl.bufferData(gl.ARRAY_BUFFER,data.v,gl.STATIC_DRAW);
 gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,32,0);gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,3,gl.FLOAT,false,32,12);gl.enableVertexAttribArray(2);gl.vertexAttribPointer(2,2,gl.FLOAT,false,32,24);
 const ib=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ib);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,data.i,gl.STATIC_DRAW);gl.bindVertexArray(null);return{vao,vb,ib,count:data.i.length,tris:data.i.length/3};};
/* Lote instanciado: cada primitiva tem buffer próprio de instâncias (mat4 + cor + retângulo de UV = 24 floats) */
class Batch{constructor(gl,mesh,cap){this.gl=gl;this.mesh=mesh;this.cap=cap;this.n=0;this.data=new Float32Array(cap*24);this.buf=gl.createBuffer();gl.bindVertexArray(mesh.vao);gl.bindBuffer(gl.ARRAY_BUFFER,this.buf);gl.bufferData(gl.ARRAY_BUFFER,this.data.byteLength,gl.DYNAMIC_DRAW);
  for(let k=0;k<6;k++){gl.enableVertexAttribArray(3+k);gl.vertexAttribPointer(3+k,4,gl.FLOAT,false,96,k*16);gl.vertexAttribDivisor(3+k,1);}gl.bindVertexArray(null);}
 grow(){const nd=new Float32Array(this.data.length*2);nd.set(this.data);this.data=nd;this.cap*=2;const gl=this.gl;gl.bindBuffer(gl.ARRAY_BUFFER,this.buf);gl.bufferData(gl.ARRAY_BUFFER,this.data.byteLength,gl.DYNAMIC_DRAW);}
 push(m,r,g,b,mat,uv){if(this.n>=this.cap)this.grow();const o=this.n*24,d=this.data;for(let i=0;i<16;i++)d[o+i]=m[i];d[o+16]=r;d[o+17]=g;d[o+18]=b;d[o+19]=mat;
  if(uv){d[o+20]=uv[0];d[o+21]=uv[1];d[o+22]=uv[2];d[o+23]=uv[3];}else{d[o+20]=d[o+21]=d[o+22]=d[o+23]=0;}this.n++;}
 flush(){if(!this.n)return 0;const gl=this.gl;gl.bindVertexArray(this.mesh.vao);gl.bindBuffer(gl.ARRAY_BUFFER,this.buf);gl.bufferSubData(gl.ARRAY_BUFFER,0,this.data,0,this.n*24);gl.drawElementsInstanced(gl.TRIANGLES,this.mesh.count,gl.UNSIGNED_SHORT,0,this.n);const n=this.n;this.n=0;return n;}}
G.Batch=Batch;

/* Construtor de malha estática (12 floats por vértice: pos, normal, cor+material, uv) */
class StaticBuilder{constructor(){this.v=[];this.i=[];}
 vert(p,n,c,mat,uv){this.v.push(p[0],p[1],p[2],n[0],n[1],n[2],c[0],c[1],c[2],mat,uv?uv[0]:0,uv?uv[1]:0);return this.v.length/12-1;}
 quad(a,b,c,d,col,mat,uvs){const n=G.norm(G.cross(G.sub(b,a),G.sub(d,a)));const k=[a,b,c,d].map((p,j)=>this.vert(p,n,col,mat||0,uvs?uvs[j]:null));this.i.push(k[0],k[1],k[2],k[0],k[2],k[3]);}
 box(x,y,z,sx,sy,sz,col,mat){const a=x-sx/2,b=x+sx/2,c=y-sy/2,d=y+sy/2,e=z-sz/2,f=z+sz/2;const sh=(k)=>col.map(v=>Math.min(1,v*k));
  this.quad([a,c,f],[b,c,f],[b,d,f],[a,d,f],sh(1),mat);this.quad([b,c,e],[a,c,e],[a,d,e],[b,d,e],sh(1),mat);this.quad([b,c,f],[b,c,e],[b,d,e],[b,d,f],sh(1),mat);
  this.quad([a,c,e],[a,c,f],[a,d,f],[a,d,e],sh(1),mat);this.quad([a,d,f],[b,d,f],[b,d,e],[a,d,e],sh(1),mat);this.quad([a,c,e],[b,c,e],[b,c,f],[a,c,f],sh(.8),mat);}
 tube(a,b,r,col,seg=8,mat=0){const d=G.norm(G.sub(b,a)),ref=Math.abs(d[1])<.9?[0,1,0]:[1,0,0],u=G.norm(G.cross(d,ref)),w=G.norm(G.cross(d,u));const base=this.v.length/12;
  for(let k=0;k<=seg;k++){const an=k/seg*Math.PI*2,n=[u[0]*Math.cos(an)+w[0]*Math.sin(an),u[1]*Math.cos(an)+w[1]*Math.sin(an),u[2]*Math.cos(an)+w[2]*Math.sin(an)];
   this.vert([a[0]+n[0]*r,a[1]+n[1]*r,a[2]+n[2]*r],n,col,mat);this.vert([b[0]+n[0]*r,b[1]+n[1]*r,b[2]+n[2]*r],n,col,mat);}
  for(let k=0;k<seg;k++){const i=base+k*2;this.i.push(i,i+2,i+1,i+1,i+2,i+3);}}
 build(gl){const v=new Float32Array(this.v),idx=this.v.length/12>65535?new Uint32Array(this.i):new Uint16Array(this.i);const vao=gl.createVertexArray();gl.bindVertexArray(vao);
  const vb=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,vb);gl.bufferData(gl.ARRAY_BUFFER,v,gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,48,0);gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,3,gl.FLOAT,false,48,12);gl.enableVertexAttribArray(2);gl.vertexAttribPointer(2,4,gl.FLOAT,false,48,24);gl.enableVertexAttribArray(3);gl.vertexAttribPointer(3,2,gl.FLOAT,false,48,40);
  const ib=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ib);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,idx,gl.STATIC_DRAW);gl.bindVertexArray(null);
  return{vao,count:this.i.length,type:idx instanceof Uint32Array?gl.UNSIGNED_INT:gl.UNSIGNED_SHORT,verts:v.length/12,tris:this.i.length/3};}}
G.StaticBuilder=StaticBuilder;
G.sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];G.cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];G.norm=v=>{const l=Math.hypot(v[0],v[1],v[2])||1;return[v[0]/l,v[1]/l,v[2]/l];};

/* Atlas 2048x2048 com 16 slots de 512 px: kits, glifos, telão, publicidade. Atualizado só quando muda. */
class Atlas{constructor(gl){this.gl=gl;this.size=2048;this.tex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,this.tex);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,2048,2048,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  this.dirtyMip=true;this.keys={};}
 slot(i){return[(i%4)*512,Math.floor(i/4)*512];}
 rect(i,x,y,w,h){const s=this.slot(i),S=this.size;return[(s[0]+x)/S,(s[1]+y)/S,w/S,h/S];}
 upload(i,canvas,x=0,y=0){const gl=this.gl,s=this.slot(i);gl.bindTexture(gl.TEXTURE_2D,this.tex);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);gl.texSubImage2D(gl.TEXTURE_2D,0,s[0]+x,s[1]+y,gl.RGBA,gl.UNSIGNED_BYTE,canvas);this.dirtyMip=true;}
 mip(){if(!this.dirtyMip)return;const gl=this.gl;gl.bindTexture(gl.TEXTURE_2D,this.tex);gl.generateMipmap(gl.TEXTURE_2D);this.dirtyMip=false;}}
G.Atlas=Atlas;
G.SLOT={HOME:0,AWAY:1,HOME_GK:2,AWAY_GK:3,REF:4,GLYPH0:5,GLYPH1:6,GLYPH2:7,GLYPH3:8,SCREEN:9,ADS:10,STUDIO:11,STUDIO_GK:12,PREVIEW_A:13,PREVIEW_B:14,MISC:15};
/* Regiões dentro de um slot de uniforme (px) */
G.KIT={shirt:[0,0,512,320],lsleeve:[0,320,128,96],rsleeve:[128,320,128,96],shorts:[256,320,256,128],socks:[0,416,256,96],trim:[256,448,256,64]};
MD.GL=G;
})(window.MD=window.MD||{});
