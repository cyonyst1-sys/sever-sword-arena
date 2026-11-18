window.requestAnimationFrame=()=>0; const T=await import('three'); window.__T=T;
const txt=await (await fetch('/_tmp_model.obj')).text(); const pos=[], idx=[]; let i=0; const n=txt.length;
while(i<n){ let j=txt.indexOf('\n',i); if(j<0) j=n; const c0=txt.charCodeAt(i), c1=txt.charCodeAt(i+1);
  if(c0===118&&c1===32){ const p=txt.slice(i+2,j).split(' '); pos.push(+p[2],+p[1],-p[0]); }
  else if(c0===102&&c1===32){ const p=txt.slice(i+2,j).split(' '); const a=parseInt(p[0])-1; for(let k=1;k<p.length-1;k++) idx.push(a,parseInt(p[k])-1,parseInt(p[k+1])-1); } i=j+1; }
window.__M={pos:new Float32Array(pos),idx:new Uint32Array(idx)};
// render helper: draws a list of {pos, idx, color|colors} meshes from several views and sends it to the receiver
window.__view=async(name,meshes,views,opt={})=>{ const cv=document.createElement('canvas'); const cols=opt.cols||3, rows=Math.ceil(views.length/cols), S=opt.S||380; cv.width=cols*S; cv.height=rows*S; const r=new T.WebGLRenderer({canvas:cv,antialias:true,preserveDrawingBuffer:true}); const sc=new T.Scene(); sc.background=new T.Color(0x8a9098);
  for(const m of meshes){ const g=new T.BufferGeometry(); g.setAttribute('position',new T.BufferAttribute(m.pos,3)); g.setIndex(new T.BufferAttribute(m.idx,1)); if(m.colors) g.setAttribute('color',new T.BufferAttribute(m.colors,3)); g.computeVertexNormals(); sc.add(new T.Mesh(g,new T.MeshStandardMaterial({color:m.color||0xffffff,vertexColors:!!m.colors,roughness:0.8,side:T.DoubleSide,flatShading:!!opt.flat}))); }
  const d=new T.DirectionalLight(0xffffff,2.4); sc.add(d); sc.add(new T.AmbientLight(0xffffff,0.8)); const cam=new T.PerspectiveCamera(opt.fov||30,1,0.01,50); r.setScissorTest(true);
  views.forEach((v,k)=>{ const x=(k%cols)*S,y=(rows-1-Math.floor(k/cols))*S; r.setViewport(x,y,S,S); r.setScissor(x,y,S,S); const c=new T.Vector3(...(v.at||opt.at||[0,0.5,0])); cam.position.set(...v.dir).normalize().multiplyScalar(v.d||opt.d||2.4).add(c); cam.lookAt(c); d.position.copy(cam.position).add(new T.Vector3(1,2,0)); r.render(sc,cam); });
  const b=cv.toDataURL('image/jpeg',0.82).split(',')[1]; await fetch('http://127.0.0.1:8799/?n='+name,{method:'POST',mode:'no-cors',body:b}); r.dispose(); return b.length; };
