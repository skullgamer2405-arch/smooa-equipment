// Transactional fixture only. This is not a Firestore rules emulator.
export function memoryDb() {
  const rows = new Map(), reads = [];
  const snap = (path) => ({ id:path.split("/").at(-1), exists:rows.has(path), data:()=>structuredClone(rows.get(path)) });
  const ref = path => ({path,id:path.split("/").at(-1),get:async()=>snap(path),set:async value=>rows.set(path,structuredClone(value)),update:async value=>{if(!rows.has(path))throw Error("missing");rows.set(path,{...rows.get(path),...structuredClone(value)});},delete:async()=>rows.delete(path)});
  const compare=(a,b)=>a instanceof Date||b instanceof Date?+a-+b:a<b?-1:a>b?1:0;
  function query(name,filters=[],orders=[],size=Infinity,cursor=[]) {
    const execute=()=>{
      let docs=[...rows.keys()].filter(p=>p.startsWith(name+"/")&&p.split("/").length===2).map(snap);
      for(const [key,op,val] of filters) docs=docs.filter(d=>{const got=d.data()[key],c=compare(got,val);return op==="=="?c===0:op==="in"?val.includes(got):op===">="?c>=0:op==="<="?c<=0:op===">"?c>0:c<0;});
      const sorted=[...orders];if(!sorted.some(([key])=>key==="__name__"))sorted.push(["__name__","asc"]);
      const values=d=>sorted.map(([key])=>key==="__name__"?d.id:d.data()[key]);
      const cmp=(a,b)=>{for(let i=0;i<sorted.length;i++){const c=compare(a[i],b[i])*(sorted[i][1]==="desc"?-1:1);if(c)return c;}return 0;};
      docs.sort((a,b)=>cmp(values(a),values(b)));
      if(cursor.length){if(cursor[0]?.id) docs=docs.slice(docs.findIndex(d=>d.id===cursor[0].id)+1);else docs=docs.filter(d=>cmp(values(d),cursor)>0);}
      return docs.slice(0,size);
    };
    return {doc:id=>ref(name+"/"+id),where:(...f)=>query(name,[...filters,f],orders,size,cursor),orderBy:(key,dir="asc")=>query(name,filters,[...orders,[key,dir]],size,cursor),limit:n=>query(name,filters,orders,n,cursor),startAfter:(...v)=>query(name,filters,orders,size,v),get:async()=>{reads.push({name,size,filters});return {docs:execute()};},count:()=>({get:async()=>({data:()=>({count:execute().length})})})};
  }
  let lock=Promise.resolve();
  return {rows,reads,collection:name=>query(name),runTransaction:async fn=>{
    const previous=lock;let release;lock=new Promise(resolve=>{release=resolve;});await previous;
    let writing=false;const writes=[];
    try{
      const result=await fn({get:async reference=>{if(writing)throw Error("read after write");return reference.get();},create:(r,v)=>{writing=true;writes.push(()=>{if(rows.has(r.path))throw Error("exists");rows.set(r.path,structuredClone(v));});},set:(r,v)=>{writing=true;writes.push(()=>rows.set(r.path,structuredClone(v)));},update:(r,v)=>{writing=true;writes.push(()=>{if(!rows.has(r.path))throw Error("missing");rows.set(r.path,{...rows.get(r.path),...structuredClone(v)});});},delete:r=>{writing=true;writes.push(()=>rows.delete(r.path));}});
      const before=structuredClone(rows);try{writes.forEach(w=>w());}catch(e){rows.clear();for(const [k,v]of before)rows.set(k,v);throw e;}return result;
    }finally{release();}
  }};
}
