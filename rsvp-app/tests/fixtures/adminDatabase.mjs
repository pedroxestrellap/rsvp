import { randomUUID } from "node:crypto";
export function adminDatabase() {
  const guests=[
    {id:"guest-one",wedding_id:"visual-wedding",full_name:"Camila Rosario",phone:"+18095550123",email:"camila@example.com",max_seats:3,is_primary:true,invite_code:"personal-camila",primary_guest_id:null},
    {id:"guest-two",wedding_id:"visual-wedding",full_name:"Mateo Hernández",phone:null,email:"mateo@example.com",max_seats:1,is_primary:true,invite_code:"personal-mateo",primary_guest_id:null},
    {id:"guest-three",wedding_id:"visual-wedding",full_name:"Lucía de la Cruz",phone:null,email:null,max_seats:2,is_primary:true,invite_code:"personal-lucia",primary_guest_id:null},
    {id:"guest-legacy",wedding_id:"visual-wedding",full_name:"Rafael Martínez",phone:null,email:null,max_seats:1,is_primary:null,invite_code:null,primary_guest_id:null},
    {id:"companion-one",wedding_id:"visual-wedding",full_name:"Andrés Rosario",max_seats:1,is_primary:false,primary_guest_id:"guest-one"},
  ];
  const tables={guests,rsvps:[{guest_id:"guest-one",status:"confirmed",seats_confirmed:2},{guest_id:"guest-three",status:"declined",seats_confirmed:0}]};
  return {tables,from(table){
    let action="select",values,single=false;const filters=[];
    const query={select(){return query;},eq(key,value){filters.push(row=>row[key]===value);return query;},in(key,values){filters.push(row=>values.includes(row[key]));return query;},order(){return query;},maybeSingle(){single=true;return query;},insert(value){action="insert";values=value;return query;},update(value){action="update";values=value;return query;},delete(){action="delete";return query;},
      then(resolve,reject){return Promise.resolve().then(()=>{
        let rows=tables[table].filter(row=>filters.every(filter=>filter(row)));
        if(action==="insert"){rows=(Array.isArray(values)?values:[values]).map(row=>({id:randomUUID(),created_at:new Date().toISOString(),...row}));tables[table].push(...rows);}
        if(action==="update")rows.forEach(row=>Object.assign(row,values));
        if(action==="delete")tables[table]=tables[table].filter(row=>!rows.includes(row));
        return {data:single?rows[0]??null:rows,error:null};
      }).then(resolve,reject);},
    };return query;
  }};
}
